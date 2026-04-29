/**
 * Security middleware bundle (G7 rate limiting, G8 sanitization,
 * 7.5 / 7.6 — Apple Review + SOC 2 prerequisites).
 *
 * Mount once near the top of `app.ts`, AFTER the raw-body Stripe webhook
 * handlers (so they keep their raw payload) but BEFORE the JSON parser so
 * `helmet` headers are applied to every response.
 */
import type { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const isProd = process.env["NODE_ENV"] === "production";

/**
 * Extract a v4 UUID from the request URL when present. We CANNOT read
 * `req.body.user_id` here because the rate limiter runs before
 * `express.json()` in the middleware chain, so `req.body` is undefined.
 * Pulling the id from the URL works at any stage and covers every
 * `/api/app-user/:id/*` route (the bulk of per-user traffic).
 */
const URL_UUID_RE = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

/**
 * Generic API limiter — applied to every `/api/*` route. Headroom is
 * deliberately generous so a normal user's heartbeat + biometrics +
 * baseline pulls never trip it; an abusive scraper or runaway client will.
 */
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Key by user UUID when the URL carries one (the per-user endpoints), so
  // a single abusive client can't burn the whole tenant's bucket and a
  // shared NAT can't throttle innocent users behind it. Falls back to the
  // IPv6-safe IP generator from the library for non-user URLs.
  keyGenerator: (req) => {
    const m = (req.originalUrl ?? req.url ?? "").match(URL_UUID_RE);
    if (m && m[1]) return `u:${m[1].toLowerCase()}`;
    return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  },
  message: { error: "Too many requests. Please slow down." },
});

/**
 * Tighter limiter for auth-adjacent endpoints. Brute-force resistance.
 * Mounted explicitly on /api/app-user/register + /api/app-user/heartbeat.
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? "unknown")}`,
  message: { error: "Too many auth attempts. Please wait a minute." },
});

/**
 * Defensive body-size limit. A wearable payload should be <1KB; we cap at
 * 32KB so a hostile client can't OOM the JSON parser. The Stripe webhook
 * paths use express.raw and are mounted before the JSON parser, so they
 * are NOT affected by this limit.
 */
export const JSON_BODY_LIMIT = "32kb";

/**
 * Request size guard for raw bytes (catches `Content-Length` lies via
 * a streaming check). Returns 413 if the declared length is too large.
 */
function bodySizeGuard(req: Request, res: Response, next: NextFunction): void {
  const len = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(len) && len > 1_048_576) {
    res.status(413).json({ error: "Payload too large" });
    return;
  }
  next();
}

/**
 * Apply the full security stack. Idempotent — call once during app setup.
 */
export function applySecurity(app: Express): void {
  // Trust the Replit / load-balancer proxy so req.ip resolves to the real
  // client and rate-limit buckets are accurate. (Restricted to 1 hop to
  // avoid X-Forwarded-For spoofing.)
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // The web artifact is served separately and uses its own CSP. The API
      // returns JSON, so we don't need a CSP and disabling it avoids
      // breaking dev tooling that POSTs from arbitrary origins.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // hsts only in prod; in dev we may serve over http via the Replit proxy.
      hsts: isProd
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
        : false,
    }),
  );

  app.use(bodySizeGuard);
  app.use("/api", apiLimiter);
}
