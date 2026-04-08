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
- **Empathy Index:** Client-computed score (0–100) from compassion_points, level, and neural_energy balance. Displayed on dashboard with rose progress bar and contextual feedback text. Formula: compassion contribution (sqrt-scaled, max 50) + level contribution (max 30) + consistency bonus (max 20).
- **Heart-Brain Hybrid Score (HBHS):** Client-computed composite score (0–100) combining brain score (sqrt of neural_energy, max 40), heart score (sqrt of compassion_points, max 40), and harmony bonus (balance ratio + level, max 20). Displayed with cyan-to-rose gradient progress bar.
- **Lives Impacted:** Tangible real-world impact metrics — trees planted, meals funded, students funded, therapy sessions. Displayed on Home and Profile screens.
- **Share System:** Dashboard share button navigates to dedicated `/share` page with 13 social platform buttons, message presets, and PWA install section. Share page includes General, Compassion Impact, Challenge a Friend, and Streak message presets.
- **Dashboard Layout Order:** Streak bar → Return Nudge → Notifications → Raid Mode → Global Impact → Current Resonance (stat rings) → Brain Game cards (5) → Empathy Index + HBHS cards → Daily Tasks (Focus & Mind / Heart & Spirit) → Global Leaderboard → Zen Pro → Corporate Wellness → Sponsored Impact. Sidebar: Growth Chart + Chronicle.
- **GlassCard:** Accepts `style?: ViewStyle | ViewStyle[]` and `elevated?: boolean` prop for luxury glassmorphism. No `glow` prop used on dashboard cards (intentionally clean).
- **UI Philosophy:** "Intentional, clean, and focused" — no decorative-only animations, no fake social proof, no staggered entrance delays on dashboard cards. Every element serves a purpose. Page transitions handled by App.tsx `AnimatePresence`. Individual card animations removed.
- **CSS Glow Classes:** `accent-glow` (static subtle gold border, used on enterprise/subscribe pages), `slot-machine-glow` (animated gold pulse, only used on Compassion Wheel game page).
- **Brain Games:** StroopGame (30s color-ink test), MemoryGrid (progressive 4×4 working memory), BreathingPacer (4-7-8 animated circle with haptics).
- **Compassion Wheel:** Staggered stops 800/1300/1800ms, `winRef.current` avoids stale closures, interval-based symbol cycling, spring bounce on landing. Route: `/wellness`.
- **5-Tab Navigation:** Home, Train, Play, Zen Pro, Profile. NativeTabs (iOS 26+) and ClassicTabs (Expo BlurView).
- **Mobile Empathy Index + HBHS:** Home screen computes both scores dynamically from AsyncStorage data (neuralEnergy, totalDonated, streakCount) using `computeEmpathyDimensions()` + `useMemo`. Profile screen already had live-computed values.
- **Mobile Train Screen Order:** Brain Games section appears first (expanded by default), followed by Mindful Tasks, Dopamine Boosters, and Team Building.
- **Apple Compliance (Mobile):** All gambling terminology replaced — "Compassion Casino" → "Compassion Wheel" / "Wellness Hub", "Jackpot" → "Win" / "Reward", share messages cleaned of gambling references.
- **Behavioral Design Patterns:**
  - **Dopamine Triggers:** `CelebrationOverlay` component shows particle-burst celebrations on task completions, game wins, level-ups, and streak milestones (3/7/14/30 days). Replaces plain toasts with visual reward moments. Used across all game pages and dashboard.
  - **Compassion Loops:** Every compassion action immediately connects to real-world impact ("Your 30 points = 0.3 meals closer to ending hunger"). Compassion Wheel jackpots show meal contributions. `complete-task` API returns `meals_contributed` for display.
  - **No-Shame Loops:** Return nudge uses warm language ("Welcome back. Your neural pathways remember you."). Streak breaks are acknowledged gracefully ("You built a X-day streak. That growth is still in you. Day 1 starts now."). No guilt, no shame, no "you lost your streak" messaging. Button text: "Continue Training" not "Train Now".

**Color Palette (constants/colors.ts):**
- Forest: #0A1A10, #14271A, #1B3022, #2A4A35
- Gold: #D4AF37, #E8C84A, #A88C2A, #F0DFA0, #C9A44B
- Celestial: #1A2744, #2A1F4E, #0D3B3B, #3D2B6B, #5A3D8F
- Neural: empathyGreen (#4ADE80), mindfulBlue (#60A5FA), balanceAmber (#FBBF24), neuralPurple (#A78BFA), compassionPink (#F472B6)
- Starlight: #E8DFC8, champagne: #F5E6C8

**Feature Specifications:**
- **Monetization (3-Tier):** Zen Pro ($9.99/mo), Daily Pass ($5/24hr), Extra Spins (via IAP — not yet integrated), Enterprise Corporate Wellness ($50/seat/year, min 25 seats), Sponsored Jackpots (Bronze $500/mo, Silver $2,500/mo, Gold $10,000/mo). All subscription CTAs show informational alerts pending real IAP integration. 30% of subscription revenue to charity.
- **Compassion Impact Tracking:** Spins track compassion milestones locally ($0.10–$0.50 per spin, doubled on wins). Impact displayed across 6 causes. Persisted in AsyncStorage. Animated pulse on milestone. No live payment processing — actual donations processed at revenue level (30% of subscription revenue).
- **Brain Games (9 total):** Stroop Test (30s inhibitory control), Memory Grid (progressive working memory), Pattern Match (visual pattern recognition, 8 rounds), 4-7-8 Breathing Pacer (vagus nerve stimulation), Neural Soundscapes (9 presets), **Neuro Match+** (card-pair matching across 3 difficulty levels — hippocampal pattern separation), **Focus Flow** (lane-based attention trainer — dorsal attention network), **Logic Lift** (number sequence puzzles — lateral PFC fluid intelligence), **N-Back Challenge** (1/2/3-back working memory — Jaeggi 2008), **Emotion Storm** (fast EQ emotion ID — fusiform face area training). All games persist Neural Energy to AsyncStorage on completion.
- **Real-World Impact Counter (Train screen):** Live display of trees planted, meals funded, research hours, students helped — derived from total donations. Refreshes on tab focus and after game sessions.
- **Weekly Progress Tracking (Train screen):** Neural Energy earned, games won, and streak count displayed with live data from AsyncStorage.
- **Team Building Exercises (Corporate):** 6 science-backed exercises — Empathy Circle, Blind Collaboration, Digital Trust, Reverse Brainstorm, Gratitude Round, Perspective Swap. Each with duration, participant count, and category tags (empathy/communication/trust/innovation). Enterprise benefits use qualitative labels (Higher engagement, Stronger cohesion, Better awareness, Improved retention) — no unsubstantiated percentages.
- **Enterprise Features:** Team Dashboard, ROI Analytics, SSO/SCIM, Team Challenges, Burnout Detection (AI-powered), CSR Impact Reports, privacy-first security design, Dedicated Success Manager. No unverified compliance certifications or Fortune 500 client claims in UI.
- **Daily Mindful Tasks:** Focus & Mind (Deep Work, Meditation, Read a Chapter) and Heart & Spirit (Help a Colleague, Active Listening, Express Gratitude). Each task is once-per-day with required reflection input (min 15 chars). Server-side enforcement via `task_completions` table with unique constraint `(session_id, task_id, completion_date)`. Legacy `/earn-energy` and `/earn-compassion` endpoints blocked for dashboard tasks. Completed tasks show checkmark + disabled state + previous response.
- **Games (Legacy):** Neural Stake (memory), The Casino (slots), Emotional EQ (reaction), Mind-Reader Blackjack (card game).
- **Premium Onboarding (Mobile):** 4-step flow (Welcome → Value Props → Compassion → Begin Today) with spring animations, pulsing gradient orbs, dot indicators. Persists completion to `nq_onboarding_complete` AsyncStorage key. First-time users see onboarding; returning users skip to home.
- **Onboarding (Web):** Splash screen, 30s Focus Test, Results with +50 Neural Energy welcome gift.
- **Streak System:** `streak_count`, `last_game_date`, 1.1^streak multiplier (max 2.0), visual glow, casino win boost.
- **Session Management:** Cookie-based (`nq_session`, httpOnly), no login required per browser.
- **Morning Bloom Modal:** Daily gratitude entry, awards 20 Neural Energy.
- **Smart Push Notifications:** Web Push API (VAPID), `push_subscriptions` table, in-app nudges, admin-triggered pushes.
- **Raid Mode:** Admin-toggled global event, doubles `earn-compassion` points, animated banner with live progress.
- **Auth & Paywall:** Replit Auth integration, `AuthGate`, `PaywallGate` with Daily Pass ($5/24hrs) and Zen Pro options.
- **Social Sharing:** 13 platforms, branded copy, PWA support.
- **Legal (Mobile):** In-app `LegalScreen.tsx` modal with Privacy Policy + Terms of Use tabs, accessible from Profile settings. Contact Support opens mailto with fallback. Reset All Data with destructive confirmation. Privacy contact: privacy@neuroquestapp.com.
- **Legal (Web):** `/copyright` page with Terms of Use, Privacy Policy (CCPA/CPRA, GDPR, data retention, DNT), Disclosures (health disclaimer, no-gambling/sweepstakes, donation transparency, tax notice, in-app purchases, third-party services), IP details, App Store Compliance (age gate, disclaimers, etc.).
- **Trademarks:** NeuroQuest™, Neural Energy™, Compassion Casino™, Cognitive Stakes™, Mind & Spirit™, Compassion Impact™, Compassion Wheel™, Neural Challenge™, Global Abundance Mission™.
- **Accessibility (Mobile):** All tab screens have `accessibilityRole`, `accessibilityLabel` on interactive elements. Section headers announce expanded/collapsed state. Settings toggles use `accessibilityState`. Decorative emoji marked `accessibilityElementsHidden`. Onboarding dots hidden from screen readers with grouped progress label.
- **Screen Entrance Animations (Mobile):** Home screen uses 4-phase staggered spring entrance (200/350/500/650ms delays). Train, Play, and Profile screens have fade-in animations triggered after AsyncStorage data loads. All animations use native driver where supported.
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