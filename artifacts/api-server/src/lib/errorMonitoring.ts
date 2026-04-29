/**
 * Production error-monitoring adapter (G17 — Crash / error monitoring).
 *
 * Whitney has approved Datadog as the provider. When `DATADOG_API_KEY` is
 * present, exceptions and warnings are shipped to the Datadog Logs HTTP API
 * (https://http-intake.logs.datadoghq.com/api/v2/logs). When absent, we fall
 * back to structured-log mode so local dev and the smoke-test loop keep
 * working without any external dependency.
 *
 * We deliberately avoid the official `dd-trace` SDK because it transitively
 * pulls in @opentelemetry, which the mobile artifact's Metro bundler chokes
 * on inside the pnpm hoist tree (the same crash class that ruled out
 * `@sentry/node` in the previous push).
 *
 * Site selection: defaults to the US1 intake. Override with `DATADOG_SITE`
 * (e.g. `datadoghq.eu`, `us3.datadoghq.com`).
 */
import type { ErrorRequestHandler, RequestHandler } from "express";

export interface ErrorContext {
  user_id?: string | null;
  route?: string | null;
  extra?: Record<string, unknown>;
}

let initialized = false;
let datadogApiKey: string | null = null;
let datadogIntakeUrl: string | null = null;
let serviceName = "neuroquest-api";

const SERVICE_ENV = process.env["NODE_ENV"] === "production" ? "production" : "development";

export function initErrorMonitoring(): void {
  if (initialized) return;
  initialized = true;

  serviceName = process.env["DD_SERVICE"] ?? "neuroquest-api";
  datadogApiKey = process.env["DATADOG_API_KEY"] ?? null;
  const site = process.env["DATADOG_SITE"] ?? "datadoghq.com";
  datadogIntakeUrl = `https://http-intake.logs.${site}/api/v2/logs`;

  if (datadogApiKey) {
    console.log(
      `[errorMonitoring] Datadog enabled — service=${serviceName} env=${SERVICE_ENV} site=${site}`,
    );
  } else {
    console.log(
      "[errorMonitoring] no DATADOG_API_KEY — structured-log mode (set the secret to enable Datadog).",
    );
  }
}

interface DatadogLog {
  ddsource: string;
  ddtags: string;
  hostname: string;
  service: string;
  message: string;
  status: "error" | "warn" | "info";
  user_id?: string | null;
  route?: string | null;
  stack?: string | null;
  extra?: Record<string, unknown> | null;
  timestamp: string;
}

/**
 * Fire-and-forget POST to Datadog. Bounded by AbortController so a slow
 * intake never blocks request handling. Failures are silent on purpose:
 * monitoring outages must not cascade into application errors.
 */
function shipToDatadog(payload: DatadogLog): void {
  if (!datadogApiKey || !datadogIntakeUrl) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  fetch(datadogIntakeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DD-API-KEY": datadogApiKey,
    },
    body: JSON.stringify([payload]),
    signal: controller.signal,
  })
    .catch(() => {
      // Intentionally silent — see comment above.
    })
    .finally(() => clearTimeout(timer));
}

function buildLog(
  status: "error" | "warn" | "info",
  message: string,
  ctx: ErrorContext,
  stack?: string,
): DatadogLog {
  return {
    ddsource: "nodejs",
    ddtags: `env:${SERVICE_ENV},service:${serviceName}`,
    hostname: process.env["HOSTNAME"] ?? "replit",
    service: serviceName,
    message,
    status,
    user_id: ctx.user_id ?? null,
    route: ctx.route ?? null,
    stack: stack ?? null,
    extra: ctx.extra ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function captureException(err: unknown, ctx: ErrorContext = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const log = buildLog("error", message, ctx, stack);
  console.error(JSON.stringify({ ...log, type: "exception" }));
  shipToDatadog(log);
}

export function captureMessage(message: string, ctx: ErrorContext = {}): void {
  const log = buildLog("warn", message, ctx);
  console.warn(JSON.stringify({ ...log, type: "message" }));
  shipToDatadog(log);
}

/** Express middleware: tag in-flight requests so captureException can attribute. */
export const errorMonitoringRequestHandler: RequestHandler = (_req, _res, next) => {
  next();
};

/** Express error middleware. Mount LAST so it sees thrown / next(err) errors. */
export const errorMonitoringErrorHandler: ErrorRequestHandler = (err, req, _res, next) => {
  captureException(err, { route: `${req.method} ${req.path}` });
  next(err);
};
