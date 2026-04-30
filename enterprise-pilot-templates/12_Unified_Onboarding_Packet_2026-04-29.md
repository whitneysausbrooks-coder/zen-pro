# NeuroQuest Zen Pro — Unified Onboarding Packet
### Version 2026-04-29 · Owner + Company Admin + Employee
### Domain: **https://neuroquestzen.pro**

This is your single, paste-ready playbook. Three audiences, three sections.
Sections 2 and 3 are written for you to forward verbatim — no editing required
beyond filling in `[brackets]`.

---

## Quick Reference Card

| Audience | URL | Sign in with |
|---|---|---|
| **Owner (Whitney)** | https://neuroquestzen.pro/admin-dashboard | Master key (set once per device) |
| **Company HR Admin** | https://neuroquestzen.pro/company-admin | Their admin email + 8-char company code |
| **Employee** | https://neuroquestzen.pro/join | Work email + 8-char company code |
| **iOS app** | NeuroQuest Zen Pro on App Store *(in TestFlight as of build 4)* | — |
| **Web app** | https://neuroquestzen.pro | — |

| Action | Command (run in Replit shell) |
|---|---|
| Add new pilot company | `node scripts/create-pilot.mjs --name "Acme" --email "hr@acme.com" --seats 50` |
| Add paid (non-pilot) company | `node scripts/create-pilot.mjs --name "Acme" --email "hr@acme.com" --seats 50 --days 365` |
| List existing companies | `curl -H "x-enterprise-key: $ENTERPRISE_API_KEY" https://neuroquestzen.pro/api/enterprise/companies` |

---

## PART 1 — Owner Playbook (For You, Whitney)

### How to add a new company in 3 steps

#### Step 1: Sales close → signed agreement in hand
Do NOT provision until you have the signed pilot agreement back. Use
`01_Pilot_Agreement.md` from this folder for the contract.

#### Step 2: Provision the company (30 seconds)
Open your Replit workspace shell and run:

```bash
node scripts/create-pilot.mjs \
  --name "Acme Corporation" \
  --email "jane.doe@acme.com" \
  --seats 50
```

Optional flags:
- `--days 75` — pilot length (default 75; use `--days 365` for paid annual)
- `--industry "Technology"` — for analytics tagging

The script prints **three blocks** to your terminal:

| Block | What it contains | What to do |
|---|---|---|
| **Pilot Company Created** | Company ID, invite code, pilot start/end dates | Save the invite code somewhere safe (you'll send it in the welcome email) |
| **Paste into Welcome Email (HR Portal)** | URL + admin email + company code | Copy-paste into `02_Welcome_Email.md` template, send to buyer |
| **Paste into Team Announcement** | Employee join URL + company code + pilot end date | Goes inside `03_Team_Announcement.md` (HR sends this to their employees) |

#### Step 3: Send the welcome email
- Open `02_Welcome_Email.md` in this folder
- Replace `[bracketed placeholders]` with the values printed in Step 2
- Attach `03_Team_Announcement.md` and the signed agreement
- Send from `admin@neuroquestllc.info` to the buyer's primary contact
- Target: send within 1 hour of receiving the signed agreement

#### Your god-mode dashboard
- **URL:** https://neuroquestzen.pro/admin-dashboard
- **First time on a new device:** append `?key=YOUR_MASTER_KEY` once. The browser remembers you after that. Your master key is stored in your Replit secrets as `ADMIN_MASTER_KEY` — never paste it into chat or email.
- **What you see:** every company, seat counts, pilot status, billing, audit log, revenue ledger

#### When NOT to use the script
If you already have a company in the system and just need to add seats, change
the admin, or extend a pilot — **do that from the admin dashboard**, not by
re-running the script (re-running creates a duplicate with a new invite code).

---

## PART 2 — HR Admin First 15 Minutes (Forward This to the Buyer)

> **Forward everything below this line, verbatim, to the company's HR/People Ops contact.**
> They've already received the formal welcome email; this is the practical "what do I do Monday morning" guide.

---

### Welcome to NeuroQuest Zen Pro

You've been set up as the HR admin for **[Company Name]**. Here's everything
you need to know to roll this out to your team in the next 15 minutes.

#### Step 1 — Open your private dashboard

> **URL:** https://neuroquestzen.pro/company-admin

Sign in with:
- **Email:** the address Whitney provisioned for you (in your welcome email)
- **Company code:** your 8-character invite code (also in your welcome email — looks like `YM8KE7SW`)

Bookmark this page on every device you'll use.

#### Step 2 — What you can see (and what you can't)

You see **aggregate organizational health** — never any individual employee's
mood, burnout score, or engagement number. This is by design and is a hard
guarantee in the platform code, not a policy you have to enforce.

| Tab | Contents |
|---|---|
| **Overview** | Seats used vs purchased, days remaining in your pilot, your invite code with a one-click "Copy invite message" button |
| **Team** | Every employee who has joined: email, department, join date, activity count. You can remove employees here for offboarding |
| **Wellness** | Aggregate metrics only — participation rate, average mood, engagement, 14-day trend. **Aggregates are suppressed entirely until 5 employees are active** to prevent reverse identification |

You can share that paragraph verbatim with your legal or compliance team.

#### Step 3 — Invite your team

Inside the Overview tab, click **Copy invite message**. It generates this
exact text, ready to paste into Slack / Teams / email:

> Hi team — we've rolled out **NeuroQuest Zen Pro**, a 5-minute-a-day mental
> fitness program. It's free for you for the next 75 days as part of our
> pilot.
>
> **How to join:** Visit **https://neuroquestzen.pro/join** and enter your
> work email and the company code **`[YOUR-CODE]`**.
>
> Pick a brain game, take 5 minutes a day. That's the whole commitment.
> Your individual data is private — leadership only sees team-level trends
> once 5+ teammates are active.
>
> Mobile apps available on iOS (App Store) and Android (Q3 2026).

#### Step 4 — Optional kickoff

Whitney offers a 15-minute kickoff call to co-host with you and answer
employee questions live. Reply to your welcome email to schedule.

#### Privacy guarantees you can quote to legal
- HR sees **aggregate scores only** — never individual employee data
- Aggregate views require **k-anonymity ≥ 5** (5+ active employees)
- Each employee sees **only their own** scores in the app
- Every HR action is logged to a tamper-evident audit log
- Employees can delete their entire history any time from Profile → Delete Account

#### Where to get help
- **Email:** admin@neuroquestllc.info — replies within 24 hours weekdays
- **Urgent:** put "URGENT" in the subject line
- **Detailed reference:** `06_HR_Admin_Quick_Start.md` (full 15-minute guide)
- **Privacy/compliance deep-dive:** `08_Privacy_And_Data_Guide.md`

---

## PART 3 — Employee 60-Second Onboarding (For HR to Send to Their Team)

> **HR: Forward everything below this line, verbatim, to your employees.**
> Or use the auto-generated "Copy invite message" button in your dashboard,
> which produces a shorter version of the same text.

---

### NeuroQuest Zen Pro — Quick Start for the Team

Your employer is offering you free access to **NeuroQuest Zen Pro**, a
5-minute-a-day mental fitness program. Here's how to get in.

#### Web (works on any device)
1. Go to **https://neuroquestzen.pro/join**
2. Enter your **work email**, your name, and the company code: **`[CODE]`**
3. Pick a brain game and play for 5 minutes. That's it.

#### iPhone (App Store)
1. Search for **"NeuroQuest Zen Pro"** in the App Store
2. Install and open
3. Tap **Continue with Email**, sign in with your work email
4. Accept the Terms when prompted
5. Connect Apple Health (optional — for Apple Watch wearable data) or skip with "Maybe later"
6. Enter the company code **`[CODE]`** when prompted

#### Android
Coming Q3 2026. For now, use the web app at https://neuroquestzen.pro — it
works on any Android phone or tablet, no install needed.

#### Apple Watch (optional, makes it more powerful)
If you wear an Apple Watch, the iPhone app reads your heart rate variability
and sleep data (with your permission) to personalize your sessions. See
`11_Wearable_Setup_Handout.md` for the 2-minute setup.

#### What's private to you (no one at work can see)
- Your individual mood, burnout score, engagement, or game performance
- Which days you used the app
- Any biometric data from your Apple Watch
- Anything you write in journaling or reflection prompts

#### What your employer sees
- Total number of teammates who've joined (a count, not who)
- Aggregate wellness trends — and only after 5+ teammates are active
- Nothing else. Ever.

#### Delete your data
Profile tab → **Delete Account**. Removes every record we hold for you.

#### Help
- **Email:** admin@neuroquestllc.info
- **In-app:** Profile → Help

---

## PART 4 — Special Case: Apple TestFlight Reviewer Account

When you submit to App Store Review (or even TestFlight Beta Review), Apple's
reviewer needs a working test account so they can sign in and verify the app.
Run this **once** before your next App Store / TestFlight submission:

```bash
# 1. Create the reviewer's test company
node scripts/create-pilot.mjs \
  --name "Apple Review Test Co" \
  --email "apple.reviewer@neuroquestzen.pro" \
  --seats 5 \
  --days 365

# Save the invite code from the output — that's REVIEWER_INVITE_CODE below
```

Then, in App Store Connect → My Apps → NeuroQuest → **TestFlight** tab →
**Test Information** (left sidebar) → toggle "Sign-in required" ON, paste:

```
Username:  apple.reviewer@neuroquestzen.pro
Password:  [the password you set when you created the matching real account on the live site]

Notes for the reviewer:
- Tap "Continue with Email" on the welcome screen.
- Use the credentials above.
- When asked for a company invite code, enter: [REVIEWER_INVITE_CODE from above]
- Accept the Terms of Service when prompted.
- The "Connect Health" step is optional — tap "Maybe later" to skip.
```

**Important:** You ALSO need to actually create the matching personal account
at https://neuroquestzen.pro/sign-up using `apple.reviewer@neuroquestzen.pro`
and a password you'll paste into the box above. Apple rejects builds when the
reviewer credentials don't actually log in.

---

## PART 5 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Provisioning script says "ENTERPRISE_API_KEY required" | Env var not loaded in your shell | In Replit shell, run `echo $ENTERPRISE_API_KEY` to confirm. If empty, the secret needs to be re-attached in your Replit secrets panel |
| Provisioning script says "Could not generate unique invite code" | Database hiccup, very rare | Re-run the same command — the script retries up to 5 times automatically |
| HR admin can't sign in | Their email doesn't match what you provisioned | Check the admin dashboard → find the company → confirm `admin_email` field. Use the dashboard's "Change admin email" if needed |
| Employee gets "Invalid company code" on /join | Typo, OR pilot has expired | In your admin dashboard, check the company's pilot status. Extend with the dashboard's "Extend pilot" action if needed |
| Aggregate wellness chart shows "Suppressed (k-anonymity)" | Fewer than 5 employees have joined | This is correct, intentional behavior. Wait until 5+ employees are active |
| Mobile app "We couldn't record your acceptance" on ToS | Old build cached | Delete and reinstall from TestFlight (build 4 or higher); ensure phone has internet |

---

## Companion Documents in This Folder

- `00_README.md` — index
- `01_Pilot_Agreement.md` — sign-this-first contract
- `02_Welcome_Email.md` — formal email to buyer (paste invite code from script)
- `03_Team_Announcement.md` — what HR sends their employees
- `04_Discovery_Call_Script.md` — sales call playbook
- `05_Owner_Operations_Manual.md` — full owner reference (longer than this packet)
- `06_HR_Admin_Quick_Start.md` — full HR admin reference
- `07_Success_Metrics_Guide.md` — how to read the wellness numbers
- `08_Privacy_And_Data_Guide.md` — share with legal/compliance
- `09_How_We_Detect_Burnout.md` — methodology, share with skeptical buyers
- `10_Enterprise_Buyer_Welcome_Packet.md` — printable PDF version of welcome
- `11_Wearable_Setup_Handout.md` — Apple Watch / Health Connect setup for employees
- `12_Unified_Onboarding_Packet_2026-04-29.md` — **this file**

---

*Last updated: April 29, 2026. Domain: neuroquestzen.pro. Mobile bundle ID: pro.neuroquestzen.app (iOS reverse-DNS — different thing from the website URL, do not confuse).*
