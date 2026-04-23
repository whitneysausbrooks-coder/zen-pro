# NeuroQuest — Owner Operations Manual
## (For Whitney Ausbrooks & Internal NeuroQuest Team Only)

> **CONFIDENTIAL.** This document contains your master access key. Do not 
> forward, post, or share with any customer. If you suspect this key has been 
> exposed, ask your developer to rotate it immediately.

---

## 1. Your Master Dashboard — One URL, Total Visibility

**Bookmark this URL on every device you use:**

> ## 🔑 https://neuroquestzen.pro/admin-dashboard?key=YOUR_MASTER_KEY

> 📝 **On your printed copy only**, write your master key in the line below
> and replace `YOUR_MASTER_KEY` in the URL above. The key is intentionally
> NOT stored in this digital file so it cannot leak from the repository.
>
> **My master key:** _______________________________________________

The first time you open the URL, the master key gets saved in your browser. 
After that, you can just go to `https://neuroquestzen.pro/admin-dashboard` and 
you're already in.

### Who should have this URL?
- **You (Whitney)** — primary owner
- **Your co-founder / executive team** — only if they're authorized to see all 
  customer data
- **Your developer** — only when actively troubleshooting

**No one else.** Not customers. Not their employees. Not vendors. Not investors 
(send them a screenshot instead).

### What you can see in this dashboard
- **Companies tab (top of page):** Every company that has ever onboarded, with:
  - Name + industry
  - Their company invite code
  - Their HR admin email
  - Seats used vs purchased
  - Status (PILOT / PAID / SUSPENDED)
  - Days remaining in pilot
  - Click any row to drill in
- **Per-company analytics (after clicking a row + "Executive View"):**
  - Workforce Resilience Index (WRI)
  - Burnout risk distribution
  - Team cohesion score
  - 7-day and 30-day trends
  - Top risk factors affecting that team
  - Projected burnout 7/30 days out
- **Billing / Stripe data** — invoices, webhook health, MRR
- **Revenue ledger** — ASC 606 monthly waterfall, journal entries (CSV exportable)
- **Audit log** — every administrative action across the platform

---

## 2. How You Onboard a New Company (Step-by-Step)

### Phase 1 — Sales (before any system action)

1. **Discovery call.** Use `04_Discovery_Call_Script.md` from this folder.
2. **They say yes.** Send them the **Pilot Agreement** (`01_Pilot_Agreement.md`).
3. **Wait for the signed agreement back.** Do NOT provision before this.

### Phase 2 — Provision (takes 30 seconds)

Once paperwork is signed, open the Replit shell and run:

```bash
node scripts/create-pilot.mjs --name "<Company Name>" --email "<HR admin email>" --seats <number>
```

**Example:**
```bash
node scripts/create-pilot.mjs --name "WKU Innovations Team" --email "j.smith@wku.edu" --seats 50
```

The script will print **three blocks** for you:

| Block | Purpose | What to do with it |
|---|---|---|
| **WELCOME EMAIL (HR Portal)** | Login info for the HR admin | Paste into the welcome email you send the buyer |
| **TEAM ANNOUNCEMENT** | Join URL + code for employees | Paste into the team-wide announcement the buyer will forward |
| **YOUR GOD-MODE** | Your monitoring URL (always the same) | Already bookmarked — confirms account is live |

### Phase 3 — Welcome (within 1 hour of provisioning)

1. Open `02_Welcome_Email.md` from this folder
2. Replace the bracketed placeholders with the values from Block 1
3. Attach the signed Pilot Agreement and the Team Announcement template
4. Send to the HR admin

### Phase 4 — Verify launch

1. Refresh your master dashboard. The new company should appear at the top of 
   the Companies list with **0/50 seats used** and a green **PILOT** badge.
2. Watch the seats count climb over the next 1–7 days as employees join.
3. If after 7 days zero employees have joined → call the HR contact directly. 
   Most likely they didn't forward the announcement.

---

## 3. What You Must Oversee (Recurring Cadence)

### Daily (5 minutes)
- Open master dashboard → glance at Companies list
- Look for: any company with **SUSPENDED** badge, or any with **0 days remaining**

### Weekly (15 minutes per active pilot)
- For each pilot company:
  - Check **seats used** — is adoption growing?
  - Click into Executive View — note the burnout risk and trend direction
  - If burnout-risk trend is rising → schedule an unscheduled check-in call

### At Day 7 of any pilot
- Send the HR admin a short engagement summary email (you write this manually 
  using the data from their Executive View)

### At Day 14 of any pilot
- Schedule a 30-minute check-in call with the HR admin
- Review their dashboard together over screen-share

### At Day 45 of any pilot
- Send the formal **Mid-Pilot ROI Report** (you assemble using export buttons 
  in their Executive View)

### At Day 60 of any pilot
- Have the conversion conversation: continue at $50/seat/year or wind down

### At Day 75 (pilot end)
- Either:
  - **Convert to paid** — your developer will help wire up Stripe billing for 
    that company, OR
  - **Wind down** — politely confirm in writing, the company stays in the 
    system as inactive (no data deletion unless they request it)

---

## 4. Emergency / Edge Case Playbook

| Situation | What to do |
|---|---|
| HR admin lost their access | Run in shell: `psql $DATABASE_URL -c "UPDATE companies SET admin_email='<new email>' WHERE invite_code='<their code>';"` then tell them to log in fresh |
| Employee can't join (says "company not found") | Confirm they typed the code correctly — no zeros, no lowercase. If still failing, your developer can check `psql $DATABASE_URL -c "SELECT * FROM companies WHERE invite_code='<code>';"` |
| Need to remove an entire company | Have your developer run a soft-delete (set `pilot_status='cancelled'`). Hard-delete only on written request from the buyer |
| Master key compromised | Immediately ask developer to set a new `ADMIN_MASTER_KEY` env var and update your bookmark with the new key |
| Press / investor wants a demo | Provision a **real company in your name** with `--name "Demo Co"`, give them a tour, then delete it after. Never demo on a real customer's data. |

---

## 5. Files You Should Always Have on Hand

All in `enterprise-pilot-templates/` folder:

- `00_README.md` — index
- `01_Pilot_Agreement.md` — for customers to sign
- `02_Welcome_Email.md` — what you send within 1 hour of signed agreement
- `03_Team_Announcement.md` — buyer forwards to their employees
- `04_Discovery_Call_Script.md` — for your sales calls
- `05_Owner_Operations_Manual.md` — **this file**
- `06_HR_Admin_Quick_Start.md` — print this for every buyer

---

## 6. Quick Reference Card (Print Separately)

```
┌─────────────────────────────────────────────────────────────┐
│  NEUROQUEST OWNER QUICK REFERENCE                           │
├─────────────────────────────────────────────────────────────┤
│  My dashboard:                                              │
│    https://neuroquestzen.pro/admin-dashboard?key=<YOUR KEY> │
│                                                             │
│  Provision a pilot:                                         │
│    node scripts/create-pilot.mjs \                          │
│      --name "Company Name" \                                │
│      --email "hr@company.com" \                             │
│      --seats 50                                             │
│                                                             │
│  Default pilot length:  75 days, free                       │
│  Post-pilot pricing:    $50 / seat / year                   │
│  Privacy threshold:     5+ employees for aggregate data     │
│                                                             │
│  Support email:  admin@neuroquestllc.info                   │
└─────────────────────────────────────────────────────────────┘
```
