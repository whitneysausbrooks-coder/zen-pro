# NeuroQuest — Workspace

## Overview

NeuroQuest is a pnpm monorepo using TypeScript, designed to be a brain-training and wellness application that applies neuroplasticity science to daily cognitive exercises and promotes mental well-being. It engages users through interactive games (Memory Match / Neural Challenge, Emotional EQ, Compassion Wheel, Neural Card Challenge), a dual-currency reward system (Neural Energy + Compassion Points), and social features, while also incorporating monetization tiers and charitable contributions. Compassion milestones trigger real micro-donations to the World Hunger Relief Fund. The project includes features for user monetization, enterprise solutions, and sponsored impact partnerships, positioning itself as a Health & Fitness / Lifestyle wellness app compliant with Apple App Store guidelines (no gambling terminology or casino framing).

## User Preferences

I prefer iterative development, with a focus on delivering functional, well-tested components in stages.
I like clear, concise communication and prefer that you ask before making any major architectural changes or introducing new external dependencies.
Ensure all changes align with the project's brand identity, emphasizing mental wellness, engagement, and ethical monetization.
I expect comprehensive test coverage for new features and modifications.
Do not make changes to files related to internal Replit configurations without explicit instructions.

## System Architecture

The project is structured as a pnpm workspace monorepo, with distinct `artifacts` for deployable applications and `lib` for shared libraries. It leverages TypeScript 5.9 for strong typing across the board.

**Core Technologies:**
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** Version 24
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`) and `drizzle-zod` for schema generation and validation.
- **API Codegen:** Orval, generating client code and Zod schemas from an OpenAPI specification.
- **Build Tool:** esbuild for CJS bundles.

**Project Structure:**
- `artifacts/api-server`: The primary Express API server.
- `lib/api-spec`: Defines the OpenAPI specification and Orval configuration.
- `lib/api-client-react`: Generated React Query hooks for frontend API interaction.
- `lib/api-zod`: Generated Zod schemas for API request/response validation.
- `lib/db`: Contains Drizzle ORM schema definitions and database connection logic.
- `scripts`: Houses utility scripts for various development and maintenance tasks.

**TypeScript & Composite Projects:**
The monorepo uses TypeScript composite projects (`composite: true`) with project references to manage inter-package dependencies and ensure correct type-checking and build order. Type-checking is performed from the root, emitting only `.d.ts` files, with actual JavaScript bundling handled by esbuild.

**UI/UX and Design (Luxury Celestial Zen):**
- **Design Language:** "Luxury Celestial Zen" — PlayfairDisplay_700Bold headings, PlayfairDisplay_400Regular_Italic subtitles, Inter body. Gold (#D4AF37), forest green (#0A1A10), celestial purple (#2A1F4E), nebula accents. Eyebrow text in CAPS with letterSpacing 3-4.
- **Celestial Aesthetic:** Every screen features cosmic gradient backgrounds (celestialPurple → forestDeep → celestialBlue → black), animated twinkling stars (3 layers), nebula glow circles, and cosmic radiance effects.
- **Neural Audio Engine:** Full soundscape system with Web Audio API-generated binaural beats (Alpha 10Hz, Beta 18Hz, Theta 6Hz), 40Hz Gamma entrainment (MIT research), Solfeggio frequencies (528Hz, 432Hz, 396Hz), and neural noise (Brown noise, Pink noise). Accessible from Train screen with expandable science explanations.
- **Empathy Index:** Multi-dimensional emotional intelligence metric with bar visualization — Compassion, Connection, Mindfulness, Listening, Emotional Safety, Shared Purpose. 87% aggregate score with weekly delta.
- **Heart-Brain Hybrid Score (HBHS):** Composite metric combining Emotional Intelligence (EI), Mental Performance (MP), and Neural Energy Boost (NEB) with formula display. HBHS = √{(EI · MP · NEB) × 1.2{Cohesion}}.
- **Lives Impacted:** Tangible real-world impact metrics — trees planted, meals funded, students funded, therapy sessions. Displayed on Home and Profile screens.
- **Share System:** Native Share API integration on Home (share impact), Play (share wins), and Profile (share journey) screens. Purple-themed share cards with cosmic gradients.
- **GlassCard:** Accepts `style?: ViewStyle | ViewStyle[]` and `elevated?: boolean` prop for luxury glassmorphism.
- **Brain Games:** StroopGame (30s color-ink test), MemoryGrid (progressive 4×4 working memory), BreathingPacer (4-7-8 animated circle with haptics).
- **Compassion Wheel:** Staggered stops 800/1300/1800ms, `winRef.current` avoids stale closures, interval-based symbol cycling, spring bounce on landing. Route: `/wellness`.
- **5-Tab Navigation:** Home, Train, Play, Zen Pro, Profile. NativeTabs (iOS 26+) and ClassicTabs (Expo BlurView).

**Color Palette (constants/colors.ts):**
- Forest: #0A1A10, #14271A, #1B3022, #2A4A35
- Gold: #D4AF37, #E8C84A, #A88C2A, #F0DFA0, #C9A44B
- Celestial: #1A2744, #2A1F4E, #0D3B3B, #3D2B6B, #5A3D8F
- Neural: empathyGreen (#4ADE80), mindfulBlue (#60A5FA), balanceAmber (#FBBF24), neuralPurple (#A78BFA), compassionPink (#F472B6)
- Starlight: #E8DFC8, champagne: #F5E6C8

**Feature Specifications:**
- **Monetization (3-Tier):** Zen Pro ($9.99/mo), Daily Pass ($5/24hr), Extra Spins ($2.99/10), Enterprise Corporate Wellness ($50/seat/year, min 25 seats), Sponsored Jackpots (Bronze $500/mo, Silver $2,500/mo, Gold $10,000/mo). All tiers include 30% revenue to charity.
- **Micro-Donations:** Every spin triggers a real-time micro-donation ($0.10–$0.50 per spin, doubled on jackpots). Tracks total impact, cause allocation breakdown across 6 causes. Persisted in AsyncStorage. Animated pulse on donation.
- **Brain Games:** Stroop Test (30s inhibitory control), Memory Grid (progressive working memory), Pattern Match (visual pattern recognition with adaptive difficulty, 8 rounds, shapes/colors), Pattern Pulse (7-level visual-spatial working memory — watch sequences, reproduce from memory, progressive difficulty), 4-7-8 Breathing Pacer (vagus nerve stimulation), Neural Soundscapes (9 presets).
- **Team Building Exercises (Corporate):** 6 science-backed exercises — Empathy Circle, Blind Collaboration, Digital Trust, Reverse Brainstorm, Gratitude Round, Perspective Swap. Each with duration, participant count, and category tags (empathy/communication/trust/innovation). Corporate wellness metrics banner (87% engagement increase, 3.2x team cohesion, -41% burnout).
- **Enterprise Features:** Team Dashboard, ROI Analytics, SSO/SCIM, Team Challenges, Burnout Detection (AI-powered), CSR Impact Reports, HIPAA/SOC2/GDPR compliance, Dedicated Success Manager. Fortune 500 stats: 12 companies, 48K+ employees, 340% ROI, 94% retention.
- **Games (Legacy):** Neural Stake (memory), The Casino (slots), Emotional EQ (reaction), Mind-Reader Blackjack (card game).
- **Onboarding:** Splash screen, 30s Focus Test, Results with +50 Neural Energy welcome gift.
- **Streak System:** `streak_count`, `last_game_date`, 1.1^streak multiplier (max 2.0), visual glow, casino win boost.
- **Session Management:** Cookie-based (`nq_session`, httpOnly), no login required per browser.
- **Morning Bloom Modal:** Daily gratitude entry, awards 20 Neural Energy.
- **Smart Push Notifications:** Web Push API (VAPID), `push_subscriptions` table, in-app nudges, admin-triggered pushes.
- **Raid Mode:** Admin-toggled global event, doubles `earn-compassion` points, animated banner with live progress.
- **Auth & Paywall:** Replit Auth integration, `AuthGate`, `PaywallGate` with Daily Pass ($5/24hrs) and Zen Pro options.
- **Social Sharing:** 13 platforms, branded copy, PWA support.
- **Legal:** `/copyright` page with Terms of Use, Privacy Policy (CCPA/CPRA, GDPR, data retention, DNT), Disclosures (health disclaimer, no-gambling/sweepstakes, donation transparency, tax notice, in-app purchases, third-party services), IP details, App Store Compliance (age gate, disclaimers, etc.). Dedicated privacy contact: privacy@neuroquestapp.com.
- **Trademarks:** NeuroQuest™, Neural Energy™, Compassion Casino™, Cognitive Stakes™, Mind & Spirit™, Compassion Impact™, Compassion Wheel™, Neural Challenge™, Global Abundance Mission™.
- **Zero-Bug Policy:** All reported bugs must be triaged and fixed before any new feature work begins.

## External Dependencies

- **PostgreSQL:** For database persistence.
- **Drizzle ORM:** Object-relational mapping for database interactions.
- **Express:** Web application framework for the API server.
- **Zod:** Schema declaration and validation library.
- **Orval:** OpenAPI client code generator.
- **React Query:** For data fetching and caching on the frontend (generated client).
- **Stripe:** Payment gateway for subscriptions.
- **Replit Auth:** For user authentication.
- **Web Push API (VAPID):** For push notifications.