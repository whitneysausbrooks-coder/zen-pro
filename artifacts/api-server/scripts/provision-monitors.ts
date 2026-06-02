#!/usr/bin/env tsx
/**
 * Datadog monitor provisioner — applies the committed monitor-as-code
 * definitions in `docs/monitors/*.json` to the live Datadog account so the
 * file is the single source of truth and the real monitor can never silently
 * drift or go missing in a fresh environment.
 *
 * Why this exists: the device-signature lockout alert (and any future monitor)
 * previously had to be created/updated by hand in the Datadog UI. A committed
 * JSON that nobody applies is not an alert. This script closes that gap by
 * reconciling each definition on every deploy.
 *
 * Idempotency: each definition is keyed by a `monitor_key:<file-stem>` tag that
 * this script injects automatically. Reconciliation searches for an existing
 * monitor carrying that tag and PUTs (updates) it when found, otherwise POSTs
 * (creates) it — so re-runs update in place instead of duplicating.
 *
 * Modes:
 *   (default)  provision  — create/update monitors to match the files.
 *   --check               — read-only drift detection. Exits 1 if any live
 *                           monitor is missing or differs from its file. Never
 *                           mutates. Use this as a CI/validation guard.
 *
 * Credentials (managed as secrets, never printed):
 *   DATADOG_API_KEY   — required. Same key errorMonitoring.ts uses for logs.
 *   DATADOG_APP_KEY   — required for the Monitors API (also accepts
 *                       DD_APP_KEY / DATADOG_APPLICATION_KEY).
 *   DATADOG_SITE      — optional, defaults to datadoghq.com (e.g. us5.datadoghq.com).
 *
 * Dev-safe: when the credentials are absent (the normal local/dev case) the
 * script logs a skip and exits 0 — provisioning is a no-op without a live key.
 * In provision mode a Datadog API/network failure is logged but does NOT fail
 * the build (monitoring outages must not cascade into deploy failures); pass
 * `--strict` to make API failures exit non-zero.
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONITORS_DIR = path.resolve(__dirname, "..", "docs", "monitors");

const MODE_CHECK = process.argv.includes("--check");
const STRICT = process.argv.includes("--strict");

const API_KEY = process.env["DATADOG_API_KEY"] ?? null;
const APP_KEY =
  process.env["DATADOG_APP_KEY"] ??
  process.env["DD_APP_KEY"] ??
  process.env["DATADOG_APPLICATION_KEY"] ??
  null;
const SITE = process.env["DATADOG_SITE"] ?? "datadoghq.com";
const API_BASE = `https://api.${SITE}/api/v1/monitor`;

interface MonitorDefinition {
  name: string;
  type: string;
  query: string;
  message?: string;
  tags?: string[];
  options?: Record<string, unknown>;
  priority?: number | null;
  [key: string]: unknown;
}

interface LiveMonitor extends MonitorDefinition {
  id: number;
}

/** The tag we inject (and search by) so each file maps to exactly one monitor. */
function monitorKeyTag(fileStem: string): string {
  return `monitor_key:${fileStem}`;
}

/**
 * Build the body we send to Datadog from a committed definition:
 *  - drop private `_`-prefixed fields (e.g. `_runbook`) Datadog does not accept
 *  - ensure the `monitor_key:<stem>` tag is present (de-duplicated)
 */
function toDatadogBody(def: MonitorDefinition, fileStem: string): MonitorDefinition {
  const body: MonitorDefinition = { name: "", type: "", query: "" };
  for (const [k, v] of Object.entries(def)) {
    if (k.startsWith("_")) continue;
    body[k] = v;
  }
  const keyTag = monitorKeyTag(fileStem);
  const tags = new Set([...(def.tags ?? []), keyTag]);
  body.tags = [...tags];
  return body;
}

const headers = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "DD-API-KEY": API_KEY as string,
  "DD-APPLICATION-KEY": APP_KEY as string,
});

/** Find the live monitor carrying this file's `monitor_key` tag, if any. */
async function findExisting(fileStem: string): Promise<LiveMonitor[]> {
  const url = `${API_BASE}?monitor_tags=${encodeURIComponent(monitorKeyTag(fileStem))}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`search failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as LiveMonitor[];
  return Array.isArray(data) ? data : [];
}

async function createMonitor(body: MonitorDefinition): Promise<number> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`create failed (${res.status}): ${await res.text()}`);
  }
  const created = (await res.json()) as LiveMonitor;
  return created.id;
}

async function updateMonitor(id: number, body: MonitorDefinition): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`update failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Compare the fields we own (name/type/query/message/tags/options) between a
 * live monitor and the desired body. Datadog adds/normalizes many fields, so we
 * only diff the surface we manage. Returns a list of differing field names.
 */
function diffFields(live: LiveMonitor, desired: MonitorDefinition): string[] {
  const drift: string[] = [];
  const scalar: (keyof MonitorDefinition)[] = ["name", "type", "query", "message"];
  for (const f of scalar) {
    if ((live[f] ?? null) !== (desired[f] ?? null)) drift.push(String(f));
  }
  const liveTags = [...(live.tags ?? [])].sort();
  const wantTags = [...(desired.tags ?? [])].sort();
  if (JSON.stringify(liveTags) !== JSON.stringify(wantTags)) drift.push("tags");

  // Compare only the option keys the file declares — Datadog backfills others.
  const wantOpts = (desired.options ?? {}) as Record<string, unknown>;
  const liveOpts = (live.options ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(wantOpts)) {
    if (JSON.stringify(liveOpts[k]) !== JSON.stringify(wantOpts[k])) {
      drift.push(`options.${k}`);
    }
  }
  return drift;
}

async function loadDefinitions(): Promise<{ stem: string; def: MonitorDefinition }[]> {
  let entries: string[];
  try {
    entries = await readdir(MONITORS_DIR);
  } catch {
    return [];
  }
  const files = entries.filter((f) => f.endsWith(".json")).sort();
  const out: { stem: string; def: MonitorDefinition }[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(MONITORS_DIR, file), "utf-8");
    out.push({ stem: path.basename(file, ".json"), def: JSON.parse(raw) as MonitorDefinition });
  }
  return out;
}

async function provision(defs: { stem: string; def: MonitorDefinition }[]): Promise<number> {
  let failures = 0;
  for (const { stem, def } of defs) {
    const body = toDatadogBody(def, stem);
    try {
      const existing = await findExisting(stem);
      if (existing.length === 0) {
        const id = await createMonitor(body);
        console.log(`  ➕ created "${def.name}" (id=${id})`);
      } else {
        if (existing.length > 1) {
          console.warn(
            `  ⚠️  ${existing.length} monitors carry monitor_key:${stem} — updating the first (id=${existing[0]!.id}); clean up the duplicates in Datadog.`,
          );
        }
        await updateMonitor(existing[0]!.id, body);
        console.log(`  🔄 updated "${def.name}" (id=${existing[0]!.id})`);
      }
    } catch (err) {
      failures++;
      console.error(`  ❌ ${stem}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failures;
}

async function check(defs: { stem: string; def: MonitorDefinition }[]): Promise<number> {
  let drifted = 0;
  for (const { stem, def } of defs) {
    const body = toDatadogBody(def, stem);
    try {
      const existing = await findExisting(stem);
      if (existing.length === 0) {
        drifted++;
        console.error(`  ❌ ${stem}: no live monitor found (expected "${def.name}")`);
        continue;
      }
      if (existing.length > 1) {
        drifted++;
        console.error(`  ❌ ${stem}: ${existing.length} live monitors carry monitor_key:${stem} (expected 1)`);
        continue;
      }
      const fields = diffFields(existing[0]!, body);
      if (fields.length > 0) {
        drifted++;
        console.error(`  ❌ ${stem}: live monitor drifts from file in: ${fields.join(", ")}`);
      } else {
        console.log(`  ✅ ${stem}: live monitor matches file (id=${existing[0]!.id})`);
      }
    } catch (err) {
      drifted++;
      console.error(`  ❌ ${stem}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return drifted;
}

async function main() {
  const defs = await loadDefinitions();
  if (defs.length === 0) {
    console.log(`[provision-monitors] no monitor definitions in ${MONITORS_DIR} — nothing to do.`);
    return;
  }

  if (!API_KEY || !APP_KEY) {
    const missing = [!API_KEY && "DATADOG_API_KEY", !APP_KEY && "DATADOG_APP_KEY"]
      .filter(Boolean)
      .join(", ");
    console.log(
      `[provision-monitors] skipped — ${missing} not set (no-op without live Datadog credentials).`,
    );
    // Skipping is the expected dev behavior; do not fail.
    return;
  }

  console.log(
    `[provision-monitors] ${MODE_CHECK ? "checking" : "provisioning"} ${defs.length} monitor(s) on ${SITE}`,
  );

  if (MODE_CHECK) {
    const drifted = await check(defs);
    if (drifted > 0) {
      console.error(`[provision-monitors] DRIFT: ${drifted} monitor(s) out of sync.`);
      process.exit(1);
    }
    console.log("[provision-monitors] all monitors match their committed definitions.");
    return;
  }

  const failures = await provision(defs);
  if (failures > 0) {
    const msg = `[provision-monitors] ${failures} monitor(s) failed to apply.`;
    if (STRICT) {
      console.error(msg);
      process.exit(1);
    }
    // Non-strict (default, e.g. inside the deploy build): log but do not break
    // the deploy over a Datadog outage.
    console.warn(`${msg} Continuing (non-strict).`);
    return;
  }
  console.log("[provision-monitors] done.");
}

main().catch((err) => {
  console.error("[provision-monitors] unexpected error:", err);
  // Never break the deploy build over monitoring; strict callers opt in.
  process.exit(STRICT ? 1 : 0);
});
