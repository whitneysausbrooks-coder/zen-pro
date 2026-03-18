# NeuroQuest — Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## NeuroQuest Features

**Monetization Tiers:**
- Tier 1 — Zen Pro subscription ($9.99/mo via Stripe). Route: `/subscribe`.
- Tier 2 — B2B Corporate Wellness ($50/seat/year). Route: `/enterprise`. `enterprise_leads` table. `CONTRACTS_SIGNED` constant controls ARR progress bar.
- Tier 3 — Sponsored Jackpots ($500–$10,000/mo). Route: `/sponsor`. `sponsor_leads` table. API: `POST /api/sponsor/contact`, `GET /api/sponsor/leads`. Casino shows cyan banner with current sponsor prize. Dashboard shows Tier 3 CTA card.

**Games:**
- **Neural Stake** (`/brain-game`): Memory match with 3 difficulty tiers — Easy (8 pairs, +50 NE), Medium (10 pairs, +75 NE), Hard (12 pairs, +100 NE). Grid adapts from 4×4 to 5×4 for medium. 12 symbols total (Brain, Flame, Leaf, Moon, Sun, Star, Eye, Wind, Droplets, Cloud, Diamond, Clover).
- **The Casino** (`/casino`): 3-reel slot machine. Sleep Mode (10 PM–6 AM): Meditation Lounge banner appears with breathing exercise (+10 NE for one 14s inhale/hold/exhale cycle). Breathing modal shows inhale 4s → hold 4s → exhale 6s animated circle.
- **Emotional EQ** (`/eq-game`): 10-round reaction game. Large emoji face appears; player has 1.5s to identify the emotion from 4 choices. +4 NE per correct, +2 bonus for < 600ms responses. Max +60 NE per session.
- **Mind-Reader Blackjack** (`/blackjack`): Standard blackjack + "Mind Read" mechanic. After deal, player predicts dealer's hole card: High (8+) or Low (2–7). Correct prediction = +60% payout bonus on any win. Bets: 10/25/50 Neural Energy.

**Onboarding:** First-time visitors (no `nq_onboarding_done` localStorage key) are redirected to `/onboarding` — 3-step flow: (1) Splash screen with gold pulse ring + "Your mind is the stake. The world is the winner." (2) 30s Focus Test — moving gold dot, user taps it, dot speeds up over time, score = hits in 30s. (3) Results screen with focus score, reaction time, rating tier, and "Welcome Gift" of +50 Neural Energy via `POST /api/quest/earn-energy`.

**Streak System:** `streak_count` + `last_game_date` in `user_profiles`. Consecutive-day wins increment streak. Multiplier = min(1.1^streak, 2.0). Streak ≥ 3 → electric-blue glow + 10% casino win boost.

**Session:** Cookie-based (`nq_session`, httpOnly). No login required — each browser = its own profile.

**DB Tables:** `user_profiles`, `activities`, `enterprise_leads`, `sponsor_leads` in `lib/db/src/schema/neuro_quest.ts`.

**API Routes:** `src/routes/quest.ts` (streak, game-complete, energy, compassion), `src/routes/enterprise.ts`, `src/routes/sponsor.ts`, `src/routes/stripe.ts`.

**Morning Bloom Modal:** Daily gratitude gate. `GET /api/quest/gratitude-status` checks if done today. `POST /api/quest/gratitude` saves entry + awards 20 Neural Energy, sets `last_gratitude_date` on `user_profiles`. Modal shows on dashboard load if not done; requires ≥ 3 words; dismisses and refreshes profile on submit. Component: `src/components/morning-bloom-modal.tsx`.

**Smart Push Notifications:** Full Web Push API (VAPID). `push_subscriptions` table stores endpoint/p256dh/auth per session. VAPID keys auto-generated at first server start and persisted in `global_settings`. Service worker: `artifacts/neuro-quest/public/sw.js` (handles push + notificationclick). Hook: `src/hooks/use-notifications.ts`. Dashboard widget: `src/components/notification-widget.tsx` (bell icon + permission request, dismissible, localStorage state). In-app Return Nudge: `src/components/return-nudge.tsx` (shows after 24h+ absence, mentions level + progress to next rank). API routes in `notifications.ts`: `GET /api/notifications/vapid-public-key`, `POST /api/notifications/subscribe`, `DELETE /api/notifications/unsubscribe`, `GET /api/notifications/status`, `GET /api/quest/nudge-status`. Admin trigger: `POST /api/admin/send-nudge` — sends personalized push to all 24h+ inactive subscribers. Message logic: close-to-next-level → "5% away from Luminary" style; multi-day → days count; default → Brain Health Level mention.

**Raid Mode:** Admin-toggled live global event. `global_settings` table (single row) holds `raid_mode_active`, `raid_mode_target`. `POST /api/admin/raid-mode` toggles it. `GET /api/admin/status` returns current state + community wins count. `GET /api/quest/event` is the public endpoint. When active, `earn-compassion` doubles all points automatically. Dashboard shows animated violet `RaidModeBanner` (component: `src/components/raid-mode-banner.tsx`) that polls every 15s with a live community progress bar. Admin panel accessible at `/admin`.

**Auth & Paywall Gates:** All 4 game routes (`/casino`, `/brain-game`, `/blackjack`, `/eq-game`) are double-gated:
1. `AuthGate` (`src/components/auth-gate.tsx`) — checks Replit Auth (`useAuth`). If not logged in, shows a branded "Sign In to Play Free" card that calls `GET /api/login` via Replit Auth OIDC.
2. `PaywallGate` (`src/components/paywall-modal.tsx`) — after auth, checks `GET /api/quest/access-status`. If `has_access: false`, shows the paywall with tier toggle (Daily Pass $5 / Zen Pro $9.99) and 3 payment methods (CashApp, Bitcoin, Stripe card). Daily-pass users see a live countdown timer banner.

**Daily Pass ($5 · 24hrs):** New option on `/subscribe` page (`DailyPassCard` component). `daily_pass_expires` timestamp column added to `user_profiles` table. `GET /api/quest/access-status` checks both `is_pro` and `daily_pass_expires > now()`. Admin panel (`/admin`) has new "Grant Access" section with `POST /api/admin/grant-daily-pass` (session_id + hours) and `POST /api/admin/grant-pro` (session_id) for manual activation after CashApp/BTC payment. Players DM @whitneyshauntaye on X with payment screenshot to request activation.

**Social Sharing System:** Universal 13-platform share panel. Component: `src/components/social-share.tsx`. Exports `SocialSharePanel` (embeddable grid), `FloatingShareButton` (gold FAB on every page). Platforms: X/Twitter, Threads, Facebook, Instagram (copy), WhatsApp, Telegram, LinkedIn, Reddit, TikTok (copy), Pinterest, Discord (copy), Email, SMS. All include branded pre-written copy with hashtags. Dedicated share page at `/share` with 4 preset message variants (General, Jackpot Win, Challenge, Streak). PWA install instructions + native share API. Copyright micro-text on every panel.

**Copyright & IP Protection:** Page at `/copyright` documents: ownership (Whitney Shauntaye), 6 trademarked marks (NeuroQuest™, Compassion Casino™, Compassion Jackpot™, etc.), 10 protected IP elements, user license terms, commercial licensing terms, DMCA notice instructions, governing law (U.S. Copyright Act, Lanham Act, Berne Convention). `CopyrightFooter` component (`src/components/copyright-footer.tsx`) appears at bottom of all main pages with link to `/copyright`.

**Open Graph / Rich Previews:** `index.html` contains full og:title, og:description, og:image, og:url, og:image:width/height/alt, og:site_name, og:locale + complete Twitter Card meta tags (twitter:card=summary_large_image, twitter:site, twitter:creator, twitter:image). Author + copyright meta tags. Canonical URL tag.

**PWA:** `manifest.json` + `sw.js` + icons (192/512) + apple-touch-icon. `beforeinstallprompt` handler in share page for install button. iOS instructions (Share → Add to Home Screen).

**Routes:** `/share` (SharePage), `/copyright` (CopyrightPage).

**Note:** api-server does NOT have `zod` as a direct dependency — use plain JS validation or import from `@workspace/api-zod`.
