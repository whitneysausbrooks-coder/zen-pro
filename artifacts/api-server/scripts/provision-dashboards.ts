#!/usr/bin/env tsx
/**
 * Datadog dashboard provisioner — applies the committed dashboard-as-code
 * definitions in `docs/dashboards/*.json` to the live Datadog account so the
 * file is the single source of truth and the real dashboard can never silently
 * drift or go missing in a fresh environment.
 *
 * Why this exists: the device-signature pass-rate dashboard (and any future
 * dashboard) previously had to be created/updated by hand in the Datadog UI — the
 * exact drift/missing-in-fresh-env problem the monitor provisioner already solves
 * for `docs/monitors/*.json`. A committed JSON that nobody applies is just a
 * document. This script closes that gap by reconciling each definition on every
 * deploy, mirroring `provision-monitors.ts`.
 *
 * Idempotency: the Datadog Dashboards API (v1) has no tag field we can search on
 * the way Monitors do, so each definition is keyed by a `dashboard_key:<file-stem>`
 * marker that this script appends (once) to the dashboard description. On re-runs
 * it lists dashboards, finds the one whose description carries that marker, and
 * PUTs (updates) it when found, otherwise POSTs (creates) it — so re-runs update
 * in place instead of duplicating.
 *
 * Modes:
 *   (default)  provision  — create/update dashboards to match the files.
 *   --check               — read-only drift detection. Exits 1 if any live
 *                           dashboard is missing or differs from its file. Never
 *                           mutates. Use this as a CI/validation guard.
 *
 * Credentials (managed as secrets, never printed):
 *   DATADOG_API_KEY   — required. Same key errorMonitoring.ts uses for logs.
 *   DATADOG_APP_KEY   — required for the Dashboards API (also accepts
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
const DASHBOARDS_DIR = path.resolve(__dirname, "..", "docs", "dashboards");

const MODE_CHECK = process.argv.includes("--check");
const STRICT = process.argv.includes("--strict");

const API_KEY = process.env["DATADOG_API_KEY"] ?? null;
const APP_KEY =
  process.env["DATADOG_APP_KEY"] ??
  process.env["DD_APP_KEY"] ??
  process.env["DATADOG_APPLICATION_KEY"] ??
  null;
const SITE = process.env["DATADOG_SITE"] ?? "datadoghq.com";
const API_BASE = `https://api.${SITE}/api/v1/dashboard`;

interface DashboardDefinition {
  title: string;
  description?: string;
  layout_type?: string;
  reflow_type?: string;
  widgets?: unknown[];
  template_variables?: unknown[];
  [key: string]: unknown;
}

interface DashboardSummary {
  id: string;
  title: string;
  description?: string;
}

/** The marker we append to (and search by) so each file maps to one dashboard. */
function dashboardKeyMarker(fileStem: string): string {
  return `dashboard_key:${fileStem}`;
}

/**
 * Build the body we send to Datadog from a committed definition:
 *  - drop private `_`-prefixed fields (e.g. `_runbook`) Datadog does not accept
 *  - ensure the `dashboard_key:<stem>` marker is present in the description
 *    exactly once (idempotent — re-running never stacks duplicate markers)
 */
function toDatadogBody(def: DashboardDefinition, fileStem: string): DashboardDefinition {
  const body: DashboardDefinition = { title: "" };
  for (const [k, v] of Object.entries(def)) {
    if (k.startsWith("_")) continue;
    body[k] = v;
  }
  const marker = dashboardKeyMarker(fileStem);
  const baseDesc = stripMarker(def.description ?? "");
  body.description = baseDesc
    ? `${baseDesc}\n\n[managed: ${marker}]`
    : `[managed: ${marker}]`;
  return body;
}

/** Remove any previously-appended `[managed: dashboard_key:...]` marker line. */
function stripMarker(description: string): string {
  return description.replace(/\n*\[managed: dashboard_key:[^\]]*\]\s*$/, "");
}

const headers = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "DD-API-KEY": API_KEY as string,
  "DD-APPLICATION-KEY": APP_KEY as string,
});

/** Find the live dashboard whose description carries this file's marker, if any. */
async function findExisting(fileStem: string): Promise<DashboardSummary[]> {
  const res = await fetch(API_BASE, { headers: headers() });
  if (!res.ok) {
    throw new Error(`list failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { dashboards?: DashboardSummary[] };
  const all = Array.isArray(data.dashboards) ? data.dashboards : [];
  const marker = dashboardKeyMarker(fileStem);
  return all.filter((d) => (d.description ?? "").includes(marker));
}

/** Fetch the full dashboard (widgets included) for drift comparison. */
async function getDashboard(id: string): Promise<DashboardDefinition> {
  const res = await fetch(`${API_BASE}/${id}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`fetch failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as DashboardDefinition;
}

async function createDashboard(body: DashboardDefinition): Promise<string> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`create failed (${res.status}): ${await res.text()}`);
  }
  const created = (await res.json()) as DashboardSummary;
  return created.id;
}

async function updateDashboard(id: string, body: DashboardDefinition): Promise<void> {
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
 * Stable signature of a widget tree: type + title for each widget, recursing
 * into group widgets. Datadog backfills widget ids and many default fields, so a
 * raw deep-equal would always report drift — this captures the structure we own
 * (which widgets exist, in what order, of what type) without that churn.
 */
function widgetSignature(widgets: unknown[] | undefined): string {
  const parts: string[] = [];
  for (const w of widgets ?? []) {
    const def = (w as { definition?: Record<string, unknown> }).definition ?? {};
    const type = String(def["type"] ?? "");
    const title = String(def["title"] ?? "");
    parts.push(`${type}:${title}`);
    if (Array.isArray(def["widgets"])) {
      parts.push(`[${widgetSignature(def["widgets"] as unknown[])}]`);
    }
  }
  return parts.join("|");
}

/**
 * Compare the fields we own (title/description/layout/reflow/template vars and
 * the widget structure) between a live dashboard and the desired body. Returns a
 * list of differing field names.
 */
function diffFields(live: DashboardDefinition, desired: DashboardDefinition): string[] {
  const drift: string[] = [];
  const scalar: (keyof DashboardDefinition)[] = [
    "title",
    "description",
    "layout_type",
    "reflow_type",
  ];
  for (const f of scalar) {
    if ((live[f] ?? null) !== (desired[f] ?? null)) drift.push(String(f));
  }
  if (
    JSON.stringify(live.template_variables ?? []) !==
    JSON.stringify(desired.template_variables ?? [])
  ) {
    drift.push("template_variables");
  }
  if (widgetSignature(live.widgets) !== widgetSignature(desired.widgets)) {
    drift.push("widgets");
  }
  return drift;
}

async function loadDefinitions(): Promise<{ stem: string; def: DashboardDefinition }[]> {
  let entries: string[];
  try {
    entries = await readdir(DASHBOARDS_DIR);
  } catch {
    return [];
  }
  const files = entries.filter((f) => f.endsWith(".json")).sort();
  const out: { stem: string; def: DashboardDefinition }[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(DASHBOARDS_DIR, file), "utf-8");
    out.push({ stem: path.basename(file, ".json"), def: JSON.parse(raw) as DashboardDefinition });
  }
  return out;
}

async function provision(defs: { stem: string; def: DashboardDefinition }[]): Promise<number> {
  let failures = 0;
  for (const { stem, def } of defs) {
    const body = toDatadogBody(def, stem);
    try {
      const existing = await findExisting(stem);
      if (existing.length === 0) {
        const id = await createDashboard(body);
        console.log(`  ➕ created "${def.title}" (id=${id})`);
      } else {
        if (existing.length > 1) {
          console.warn(
            `  ⚠️  ${existing.length} dashboards carry dashboard_key:${stem} — updating the first (id=${existing[0]!.id}); clean up the duplicates in Datadog.`,
          );
        }
        await updateDashboard(existing[0]!.id, body);
        console.log(`  🔄 updated "${def.title}" (id=${existing[0]!.id})`);
      }
    } catch (err) {
      failures++;
      console.error(`  ❌ ${stem}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failures;
}

async function check(defs: { stem: string; def: DashboardDefinition }[]): Promise<number> {
  let drifted = 0;
  for (const { stem, def } of defs) {
    const body = toDatadogBody(def, stem);
    try {
      const existing = await findExisting(stem);
      if (existing.length === 0) {
        drifted++;
        console.error(`  ❌ ${stem}: no live dashboard found (expected "${def.title}")`);
        continue;
      }
      if (existing.length > 1) {
        drifted++;
        console.error(`  ❌ ${stem}: ${existing.length} live dashboards carry dashboard_key:${stem} (expected 1)`);
        continue;
      }
      const live = await getDashboard(existing[0]!.id);
      const fields = diffFields(live, body);
      if (fields.length > 0) {
        drifted++;
        console.error(`  ❌ ${stem}: live dashboard drifts from file in: ${fields.join(", ")}`);
      } else {
        console.log(`  ✅ ${stem}: live dashboard matches file (id=${existing[0]!.id})`);
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
    console.log(`[provision-dashboards] no dashboard definitions in ${DASHBOARDS_DIR} — nothing to do.`);
    return;
  }

  if (!API_KEY || !APP_KEY) {
    const missing = [!API_KEY && "DATADOG_API_KEY", !APP_KEY && "DATADOG_APP_KEY"]
      .filter(Boolean)
      .join(", ");
    console.log(
      `[provision-dashboards] skipped — ${missing} not set (no-op without live Datadog credentials).`,
    );
    // Skipping is the expected dev behavior; do not fail.
    return;
  }

  console.log(
    `[provision-dashboards] ${MODE_CHECK ? "checking" : "provisioning"} ${defs.length} dashboard(s) on ${SITE}`,
  );

  if (MODE_CHECK) {
    const drifted = await check(defs);
    if (drifted > 0) {
      console.error(`[provision-dashboards] DRIFT: ${drifted} dashboard(s) out of sync.`);
      process.exit(1);
    }
    console.log("[provision-dashboards] all dashboards match their committed definitions.");
    return;
  }

  const failures = await provision(defs);
  if (failures > 0) {
    const msg = `[provision-dashboards] ${failures} dashboard(s) failed to apply.`;
    if (STRICT) {
      console.error(msg);
      process.exit(1);
    }
    // Non-strict (default, e.g. inside the deploy build): log but do not break
    // the deploy over a Datadog outage.
    console.warn(`${msg} Continuing (non-strict).`);
    return;
  }
  console.log("[provision-dashboards] done.");
}

main().catch((err) => {
  console.error("[provision-dashboards] unexpected error:", err);
  // Never break the deploy build over monitoring; strict callers opt in.
  process.exit(STRICT ? 1 : 0);
});
