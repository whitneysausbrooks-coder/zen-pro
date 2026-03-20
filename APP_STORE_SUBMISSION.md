# NeuroQuest — App Store Submission Guide

## Overview
NeuroQuest is wrapped in a native iOS shell using Capacitor.
Cloud building is handled by Codemagic — no Mac or Xcode required.

---

## Step 1 — Update Your Deployed URL (Do This First)

Open `artifacts/neuro-quest/capacitor.config.ts` and replace:
```
const DEPLOYED_URL = "https://neuroquest.replit.app"
```
with your actual published Replit URL.

**How to find it:** Replit Dashboard → your project → Deployments tab → copy the `.replit.app` link.

---

## Step 2 — Push Code to GitHub

Codemagic needs access to your code via GitHub.

1. Create a new GitHub repository (can be private)
2. Push this codebase to it:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/neuroquest.git
   git push -u origin main
   ```

---

## Step 3 — Set Up Codemagic (Free Account)

1. Go to **[app.codemagic.io](https://app.codemagic.io)** → Sign up (free)
2. Click **"Add application"** → select **GitHub** → choose your repo
3. When asked for project type, select **"Flutter/Other"** then choose **"React Native / Capacitor"**
4. Codemagic will detect the `codemagic.yaml` automatically

---

## Step 4 — Add Apple Developer Credentials to Codemagic

In Codemagic → **Teams** → **Integrations**:

1. **Apple Developer Portal** → Add your Apple ID email + app-specific password
   (Generate one at appleid.apple.com → Security → App-Specific Passwords)

2. **App Store Connect API** (for submitting builds):
   - Go to App Store Connect → Users & Access → Integrations → App Store Connect API
   - Create a new key (role: "App Manager")
   - Download the `.p8` file — **you only get one download**
   - Copy the Key ID and Issuer ID

3. In Codemagic → App Settings → **Environment variables**, add:
   | Variable | Value | Secure? |
   |---|---|---|
   | `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from above | No |
   | `APP_STORE_CONNECT_KEY_IDENTIFIER` | Key ID from above | No |
   | `APP_STORE_CONNECT_PRIVATE_KEY` | Contents of .p8 file | ✅ Yes |

---

## Step 5 — Create the App in App Store Connect

1. Go to **[appstoreconnect.apple.com](https://appstoreconnect.apple.com)**
2. Click **"+"** → **"New App"**
3. Fill in:
   - **Platform:** iOS
   - **Name:** NeuroQuest
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** `com.whitneyshauntaye.neuroquest`
   - **SKU:** `neuroquest-001`
4. Click **Create**

---

## Step 6 — Fill In App Store Listing

### App Information
- **Name:** NeuroQuest
- **Subtitle:** Compassion Casino · Brain Training
- **Category:** Primary = Games / Casino · Secondary = Health & Fitness

### Description (copy-paste ready)
```
NeuroQuest is the world's first Compassion Casino — a brain-training app that 
gamifies neuroplasticity while funding real charitable causes with every spin.

TRAIN YOUR MIND
• Compassion Jackpot™ — slot-style spins that trigger real micro-donations to 
  hunger relief in your name
• Neural Stake™ — memory match challenge that sharpens pattern recognition
• Mind-Reader Blackjack — emotional intelligence training through card play
• Emotional EQ — daily mood and empathy challenges

FEED THE WORLD
Every time you hit 3× Hearts on the Compassion Jackpot, our sponsor brands make 
a real micro-donation to hunger relief in your name. No extra cost to you — your 
generosity is built into every spin.

ZEN PRO MEMBERSHIP
• Unlimited daily spins
• All 4 brain games unlocked
• Ad-free experience
• $9.99/month — cancel any time

FOR ENTERTAINMENT ONLY
NeuroQuest is not a gambling application. No real money can be won. Neural Energy 
is a virtual in-game currency with no monetary value. Must be 18+ to use.
```

### Keywords (100 chars max)
```
brain training,mindfulness,casino game,neuroplasticity,charity,meditation,memory,
```

### Age Rating
Go to **Age Rating** section and answer:
- Simulated Gambling: **Frequent/Intense** → this sets 17+ automatically
- All other categories: None/Infrequent

### Privacy Policy URL
```
https://YOUR_DEPLOYED_URL/copyright#privacy
```

---

## Step 7 — App Pricing
- **Price:** Free (with in-app purchases)

### In-App Purchases to add:
1. **Zen Pro** — Auto-renewable subscription — $9.99/month
2. **Daily Pass** — Non-consumable — $4.99
3. **Extra Spins (10)** — Consumable — $2.99

---

## Step 8 — Screenshots Required

Apple requires screenshots for:
- **iPhone 6.7"** (iPhone 15 Pro Max) — 1290 × 2796 px — minimum 3, up to 10
- **iPhone 6.5"** (iPhone 14 Plus) — 1284 × 2778 px — minimum 3
- **iPad Pro 12.9"** (6th gen) — 2048 × 2732 px — minimum 3 (if supporting iPad)

**Recommended screenshots:**
1. Age gate / welcome screen
2. Dashboard with Neural Energy counter
3. Compassion Jackpot reels mid-spin
4. Jackpot win moment (confetti + donation triggered)
5. Subscribe / Zen Pro screen
6. Memory match game

**Free screenshot tools:** Figma, Canva, or use your iPhone with the app running.

---

## Step 9 — Trigger the Build

In Codemagic → your app → click **"Start new build"** → select `ios-app-store` workflow.

Build takes ~15–25 minutes. When complete, it automatically submits to **TestFlight**.

---

## Step 10 — TestFlight Internal Testing

1. In App Store Connect → TestFlight → add yourself as Internal Tester
2. Download the TestFlight app on your iPhone
3. Test the full app flow
4. When happy, go back to App Store Connect → submit for App Review

---

## Step 11 — Submit for App Review

In App Store Connect:
1. Select your build from TestFlight
2. Fill in any remaining fields
3. Click **"Submit for Review"**
4. Apple reviews in **1–3 business days** (casino-themed apps may take longer)

---

## Bundle ID Registration

Before Step 8, you need to register the Bundle ID in your Apple Developer account:
1. Go to **[developer.apple.com](https://developer.apple.com)** → Certificates, IDs & Profiles
2. Identifiers → "+" → App IDs → App
3. **Bundle ID:** `com.whitneyshauntaye.neuroquest` (Explicit)
4. Check: **Associated Domains**, **Push Notifications** (optional)
5. Click Continue → Register

---

## Checklist Before Submitting

- [ ] Deployed URL updated in `capacitor.config.ts`
- [ ] Code pushed to GitHub
- [ ] Bundle ID registered at developer.apple.com
- [ ] App created in App Store Connect
- [ ] App Store Connect API key added to Codemagic
- [ ] Age Rating set to 17+
- [ ] Privacy Policy URL filled in
- [ ] In-App Purchases created in App Store Connect
- [ ] Screenshots uploaded (6.7" required)
- [ ] Build submitted and tested on TestFlight
