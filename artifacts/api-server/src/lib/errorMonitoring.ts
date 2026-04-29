/**
 * Production error-monitoring adapter (G17 — Crash / error monitoring).
 *
 * Today this is a structured-logging no-op. The interface is shaped so that
 * swapping in Sentry, Datadog, Bugsnag, or Honeycomb is a one-file change:
 * pick a provider, fill in `init()` + `captureException()` + the express
 * middlewares, and every existing call site keeps working.
 *
 * We deliberately avoid pulling in @sentry/node today because it transitively
 * requires @opentelemetry, which the mobile artifact's Metro bundler chokes on
 * inside the pnpm hoist tree. When you're ready to wire a real provider, do it
 * inside this file only.
 */
import type { ErrorRequestHandler, RequestHandler } from "express";

export interface ErrorContext {
  user_id?: string | null;
  route?: string | null;
  extra?: Record<string, unknown>;
}

let initialized = false;

export function initErrorMonitoring(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env["SENTRY_DSN"] ?? process.env["ERROR_MONITORING_DSN"];
  if (dsn) {
    console.log(
      "[errorMonitoring] DSN detected but no provider wired — running in structured-log mode. " +
        "See lib/errorMonitoring.ts to enable.",
    );
  } else {
    console.log("[errorMonitoring] no DSN configured — structured-log mode.");
  }
}

export function captureException(err: unknown, ctx: ErrorContext = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // Stringify so prod log aggregators (Replit, Datadog tail, etc.) can parse.
  console.error(
    JSON.stringify({
      level: "error",
      type: "exception",
      message,
      stack,
      user_id: ctx.user_id ?? null,
      route: ctx.route ?? null,
      extra: ctx.extra ?? null,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function captureMessage(message: string, ctx: ErrorContext = {}): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      type: "message",
      message,
      user_id: ctx.user_id ?? null,
      route: ctx.route ?? null,
      extra: ctx.extra ?? null,
      timestamp: new Date().toISOString(),
    }),
  );
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
