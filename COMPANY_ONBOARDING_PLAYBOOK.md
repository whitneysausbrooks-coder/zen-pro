# Onboarding a New Company to NeuroQuest Zen Pro

This is the end-to-end playbook for getting a new company live, from "they signed the contract" to "their employees are using the app and the HR admin is seeing aggregate insights."

Substitute the real company name, admin email, and seat count anywhere you see `Acme Corp` / `hr@acmecorp.com` / `50`.

---

## Phase 0 — Before You Touch the API (5 minutes)

You should already have:
- Company name, admin contact name, admin work email
- Final seat count (paid + pilot)
- Industry (optional, but used for benchmarks later)
- Pilot duration agreed (default: **75 days**) — or "no pilot, paid from day one"
- Whether they need **SSO** (Okta / Azure AD / Google Workspace) or **SCIM** auto-provisioning
- Whether billing is **Stripe** (most common) or **invoice / NET-30** (handled outside the app)

If any of these are unclear, send the discovery-call script (`enterprise-pilot-templates/04_Discovery_Call_Script.md`) and lock them down first. Don't onboard without an admin email — every operational notification routes there.

---

## Phase 1 — Create the Company in the System (1 API call, 30 seconds)

This single call creates the `companies` row, generates a unique 8-character invite code, sets the pilot window, and audit-logs the event.

```bash
# Replace with your actual production domain if different
API="https://neuroquestzen.pro"

curl -sS -X POST "$API/api/enterprise/onboard-pilot" \
  -H "Content-Type: application/json" \
  -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d '{
    "company_name": "Acme Corp",
    "admin_email": "hr@acmecorp.com",
    "seats": 50,
    "pilot_days": 75,
    "industry": "manufacturing"
  }'
```

You'll get back JSON like:

```json
{
  "success": true,
  "company_id": "uuid-here",
  "company_name": "Acme Corp",
  "admin_email": "hr@acmecorp.com",
  "invite_code": "K7M2QP4X",
  "seats": 50,
  "pilot_started_at": "2026-04-30T...",
  "pilot_ends_at": "2026-07-14T..."
}
```

**SAVE THE `invite_code` AND `company_id`** — you'll need both. Put them in 1Password under "Acme Corp — NeuroQuest" so you can find them later.

> **Notes:**
> - `seats` is both the initial count AND the cap. Employees beyond this number cannot register with this invite code (server-enforced via `seatEnforcement.ts`).
> - `pilot_days` defaults to 75 if omitted. Set it to whatever you negotiated. You can extend later by direct DB update.
> - For a paid-from-day-one customer, still use this endpoint — it's the cleanest path. Just plan to flip `subscription_status` to `active` after Stripe Checkout completes (Phase 2).
> - The endpoint requires the `x-enterprise-key` header. `$ADMIN_MASTER_KEY` is the secret already in your Replit environment.

---

## Phase 2 — Set Up Billing (Stripe, ~5 minutes — SKIP if NET-30 invoiced offline)

### 2a. Create the Stripe customer for this company

```bash
curl -sS -X POST "$API/api/stripe-enterprise/create-company" \
  -H "Content-Type: application/json" \
  -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d '{
    "company_id": "uuid-from-phase-1",
    "company_name": "Acme Corp",
    "admin_email": "hr@acmecorp.com"
  }'
```

This creates a Stripe Customer object and links its ID to your `companies` row. No charge yet.

### 2b. Generate a Stripe Checkout link for them

```bash
curl -sS -X POST "$API/api/stripe-enterprise/subscribe" \
  -H "Content-Type: application/json" \
  -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d '{
    "company_id": "uuid-from-phase-1",
    "seats": 50
  }'
```

You'll get back a `checkout_url` like `https://checkout.stripe.com/c/pay/cs_live_...`. **Email this URL to the HR admin** (`hr@acmecorp.com`) with a short note like:

> Hi <admin first name>, here's your secure Stripe Checkout link for your 50-seat NeuroQuest Zen Pro subscription. The link is valid for 24 hours. After checkout, your seats activate automatically and you'll receive your HR admin login. — Whitney

### 2c. (Automatic) Webhook syncs status

When the admin completes Checkout, Stripe fires `checkout.session.completed` to your webhook endpoint. `lib/enterpriseWebhook.ts` listens for this and flips `companies.subscription_status` from `trialing` to `active`. You don't have to do anything.

### 2d. (Later) Adjusting seats mid-cycle

If Acme adds 10 more employees in July:

```bash
curl -sS -X POST "$API/api/stripe-enterprise/update-seats" \
  -H "Content-Type: application/json" \
  -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d '{
    "company_id": "uuid-from-phase-1",
    "new_seats": 60
  }'
```

This forces Stripe to prorate the charge mid-month (ASC-606-compliant — your accountant will thank you).

---

## Phase 3 — (Optional) Set Up SSO / SCIM (~10 minutes — only if requested)

Most pilots skip this and use the invite-code flow. SSO is only worth the configuration time for companies of 100+ seats with an existing IdP.

### 3a. Configure their identity provider

```bash
curl -sS -X POST "$API/api/enterprise/sso/configure" \
  -H "Content-Type: application/json" \
  -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d '{
    "company_id": "uuid-from-phase-1",
    "provider": "okta",
    "discovery_url": "https://acmecorp.okta.com/.well-known/openid-configuration",
    "client_id": "<from Okta admin>",
    "client_secret": "<from Okta admin>",
    "domain_restrictions": ["acmecorp.com"],
    "auto_provision": true
  }'
```

Once configured, employees who sign in via their corporate Okta are auto-created in `enterprise_users`, no invite code needed.

### 3b. (Even more optional) SCIM auto-roster sync

If they want to push their full employee directory in (and have it auto-deactivate when someone leaves the company), give them:
- **SCIM endpoint:** `https://neuroquestzen.pro/api/enterprise/scim/v2`
- **Bearer token:** generate a per-company SCIM token (TODO: this is a forward-looking feature — currently shares `ENTERPRISE_API_KEY`. Roadmap item before going past 5 enterprise customers.)

---

## Phase 4 — Send the Welcome Packet to the HR Admin (5 minutes)

Open `enterprise-pilot-templates/02_Welcome_Email.md` and `06_HR_Admin_Quick_Start.md`. Fill in:

- Company name → "Acme Corp"
- Invite code → `K7M2QP4X`
- HR admin login URL → `https://neuroquestzen.pro/admin` (or whatever your company-admin web route is)
- Pilot end date → from the response in Phase 1
- A direct calendar link for office hours / 1:1 onboarding call

Email both documents to `hr@acmecorp.com`. Subject:

> Welcome to NeuroQuest Zen Pro — Acme Corp pilot details inside

---

## Phase 5 — HR Admin Sends the Invite Code to Their Employees (HR's job, you supply the template)

Give the HR admin the template at `enterprise-pilot-templates/03_Team_Announcement.md`. They customize and broadcast to their employees via Slack / email / company intranet. Key things the message must include:

1. The **invite code** (`K7M2QP4X`)
2. **App Store link** (once Build #9 ships — until then, TestFlight invite via email)
3. The phrase "100% private — your individual data stays with you, only anonymized aggregates of 5+ employees go to your HR team" (this is **the** trust gate — every dropout in pilots traces to this not being said clearly)
4. Optional opt-in language for connecting an Apple Watch / Galaxy Watch / Fitbit / Garmin

---

## Phase 6 — Employee Sign-up Flow (their experience, no work for you)

1. Employee downloads NQ Zen Pro from App Store
2. Onboarding asks for: name, work email, **invite code** → enters `K7M2QP4X` and `theirname@acmecorp.com`
3. Mobile app calls `GET /api/enterprise/lookup-invite?code=K7M2QP4X` → confirms valid + returns Acme branding
4. App registers them in `app_users` AND `enterprise_users` (linked by company_id)
5. Triple-weight consent gate → HealthKit/Health Connect permission → 7-day baseline countdown begins
6. After 7 days of biometric samples: their personal Resilience Score becomes available + AI insights unlock

If an employee gets "Invalid invite code", first check: did they type uppercase? Codes are case-sensitive in the lookup.

---

## Phase 7 — HR Admin Dashboard Goes Live (automatic, once 5 employees join)

The HR admin logs into `https://neuroquestzen.pro/admin` (their email is already authorized — they sign in via the same Clerk SSO that all other admins use, OR via magic-link to the `admin_email` you registered in Phase 1).

They see:
- **Wellness Summary** (`/api/company-admin/wellness-summary`) — aggregate mood, engagement, resilience trend
- **Wearable Engagement** (`/api/company-admin/wearable-engagement`) — % of employees who've connected a watch
- **Seat Utilization** — how many of their 50 seats are actually claimed

⚠️ **All aggregate views are gated behind a 5-employee minimum.** Until employee #5 completes their first session, the dashboard shows: *"Aggregate wellness data appears once 5 or more employees have joined and completed their baseline. This protects individual privacy."* This is intentional — never disable the gate, even if the admin asks. It's the foundation of the privacy promise.

---

## Phase 8 — Your Ongoing Operations (per company, ~15 min/month)

| Cadence | Task | How |
|---|---|---|
| Weekly | Spot-check pilot progress | Query `companies` table: how many seats claimed, how many active in last 7d, average resilience trend |
| Monthly | Send the HR admin a digest | Pull the wellness-summary endpoint, screenshot the trend chart, email to admin with 1 paragraph of commentary |
| At pilot end (~75 days) | Convert to paid OR offboard | If converting: run `/stripe-enterprise/subscribe` for a paid plan + flip `pilot_status` to `converted`. If offboarding: run `/stripe-enterprise/cancel` + email all employees that they have 30 days to export their data via Profile → Privacy & Data |
| As needed | Add seats | `/stripe-enterprise/update-seats` per Phase 2d |
| As needed | Remove a former employee | They self-delete via the in-app GDPR delete route, OR you anonymize via `POST /api/app-user/:id/delete` (HMAC-signed) |

---

## Quick Reference — Onboard a Company in 60 Seconds

```bash
API="https://neuroquestzen.pro"
COMPANY="Acme Corp"
ADMIN="hr@acmecorp.com"
SEATS=50

# 1. Create company + invite code
RESP=$(curl -sS -X POST "$API/api/enterprise/onboard-pilot" \
  -H "Content-Type: application/json" \
  -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d "{\"company_name\":\"$COMPANY\",\"admin_email\":\"$ADMIN\",\"seats\":$SEATS,\"pilot_days\":75}")
echo "$RESP"
COMPANY_ID=$(echo "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['company_id'])")
INVITE=$(echo "$RESP"   | python3 -c "import json,sys;print(json.load(sys.stdin)['invite_code'])")

# 2. Stripe customer + checkout link
curl -sS -X POST "$API/api/stripe-enterprise/create-company" \
  -H "Content-Type: application/json" -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d "{\"company_id\":\"$COMPANY_ID\",\"company_name\":\"$COMPANY\",\"admin_email\":\"$ADMIN\"}"

curl -sS -X POST "$API/api/stripe-enterprise/subscribe" \
  -H "Content-Type: application/json" -H "x-enterprise-key: $ADMIN_MASTER_KEY" \
  -d "{\"company_id\":\"$COMPANY_ID\",\"seats\":$SEATS}"

echo ""
echo "DONE. Invite code: $INVITE  | Company ID: $COMPANY_ID"
echo "Now: email Welcome packet + Checkout URL to $ADMIN"
```

Save this snippet. Every new company is one paste-and-edit away.

---

## Want me to onboard a real company now?

If you have the company name + admin email + seat count ready, tell me:

> "Onboard <Company Name>, admin <email>, <N> seats, pilot <D> days"

…and I'll fire the calls against the live API, paste you back the invite code + Checkout URL, and walk you through what to email the admin. I'll never onboard a company without your explicit go.
