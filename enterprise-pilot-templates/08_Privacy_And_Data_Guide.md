# NeuroQuest Zen Pro — Privacy & Data Guide
## What HR Sees, What HR Doesn't, and Why

This document explains exactly what data flows through your HR Dashboard, what 
your employees see, what NeuroQuest's owner can see, and the technical 
boundaries that enforce all of it. Share this with your legal counsel, 
compliance team, or works council with confidence.

---

## The Promise in One Sentence

> **HR sees the forest. Employees own their tree. NeuroQuest never shares one company's data with another — ever.**

---

## What Your HR Dashboard Shows

Your dashboard at `https://neuroquestzen.pro/company-admin` displays only 
information about **your own company**.

### ✅ HR CAN See

| Category | Specifics |
|---|---|
| **Roster basics** | Employee email, name, optional department, join date |
| **Activity counters** | Number of sessions per employee (count only — not content) |
| **Aggregate wellness scores** | Team-wide WRI, burnout-risk distribution, mood trend, engagement rate — *only when 5+ employees are active* |
| **Seat usage** | How many seats claimed vs purchased |
| **Pilot countdown** | Days remaining in the 75-day pilot |

### ❌ HR CANNOT See

| Category | Why |
|---|---|
| **Any individual's mood, focus, or burnout score** | This is the fundamental promise. We refuse to build the screen that would show it. |
| **Any individual's session content** | What an employee did inside a session is theirs alone. |
| **Aggregate scores when fewer than 5 employees are active** | Below 5, the math could let you reverse-engineer one person. We hide it entirely until the threshold is met. |
| **Other companies' data** | The dashboard backend filters every query by your company ID, enforced by a cryptographically-signed login token. There is no UI or URL that exposes another company. |
| **Free-text employee notes / journal entries** | These are stored encrypted and only the employee can decrypt them. |

---

## What Employees See

Each employee, inside the NeuroQuest app, sees their own:
- Personal WRI score and trend
- Personal burnout-risk classification (with educational context, not alarm)
- Personal mood and focus history
- Recommended exercises and recovery activities
- Their own goal progress

**They do not see** anyone else's scores, the team aggregate, or anything 
about HR's view.

---

## What NeuroQuest's Owner (Whitney) Sees

The owner of NeuroQuest holds a **master administrator key** for the platform 
itself. This is necessary to:
- Provision new company accounts
- Investigate technical issues if a customer reports a bug
- Respond to subpoenas or legal data requests with a documented audit trail
- Generate aggregate platform metrics (e.g. total active users)

**Owner access is logged.** Every administrative action is written to a 
tamper-evident audit log. If we ever access your company's data for support 
purposes, the access is time-stamped and attributable.

**Owner access is restricted to:**
- Whitney Ausbrooks (Founder & CEO)
- Authorized internal NeuroQuest engineering personnel under signed NDA

The master key is **never** issued to:
- Customer companies
- Customer employees
- Vendors, integrators, or third parties
- Investors, advisors, or board members

---

## Technical Boundaries — How This Is Enforced

This isn't a policy — it's enforced in code. Here's how:

### 1. Two completely separate authentication systems
- **Owner / God-Mode:** uses the platform master key, only valid via internal 
  admin URLs. Master key is stored as a server environment variable; the 
  browser never receives it from a server response. The owner pastes it once 
  and the browser stores it locally on the owner's device only.
- **HR Admin Portal:** uses a 30-day cryptographically-signed token (HMAC-SHA256). 
  The token is bound to **one company ID** at creation time and cannot be 
  modified, replayed against another company, or extended.

### 2. Server-side scoping on every query
Every database query made by an HR admin is automatically filtered by the 
company ID embedded in their signed token. There is no API parameter an HR 
admin can pass to query another company. Even if an attacker forged a request 
with a different company ID in the URL, the server ignores the URL parameter 
and uses only the cryptographically-verified token claim.

### 3. The 5-employee aggregate threshold
This is enforced **server-side**. The dashboard simply doesn't receive scores 
until the threshold is met — there's nothing to "unhide" in the browser.

### 4. The owner's master key cannot be used on the HR portal endpoints
The HR portal API requires the signed company token specifically and refuses 
the master key. This is by design: even Whitney cannot accidentally land in 
your HR view and confuse data. Owner access uses a different URL and a 
different code path.

### 5. Audit logging
The following actions are logged with timestamp, actor identity, and target:
- HR admin login (success and failure)
- Employee removal
- Owner/master-key access to any company
- Any data export or report generation

Audit logs are append-only and retained for 7 years.

---

## Data Lifecycle

| Stage | What Happens |
|---|---|
| **In flight** | All data transmitted over TLS 1.2+ with HSTS enforcement |
| **At rest** | PostgreSQL with encryption-at-rest. Personal journal entries are additionally encrypted with per-user keys |
| **During the pilot** | Live in your dashboard; aggregate trends used internally to improve the platform (no individual data ever used for training) |
| **End of pilot — if you continue** | Nothing changes; standard subscription terms apply |
| **End of pilot — if you don't continue** | Data retained 30 days in case you change your mind, then deleted on written request |
| **Employee leaves the company** | HR removes them from the Team tab; their account is deactivated; their personal data is retained per their individual data retention preferences (set inside the app), not the company's |

---

## Compliance Posture

| Standard | Status |
|---|---|
| **GDPR** | Compliant — data subjects can export or delete their own data via in-app controls; we serve as a Processor, your company is the Controller |
| **CCPA / CPRA** | Compliant — same controls as GDPR for California residents |
| **HIPAA** | NeuroQuest is a wellness platform, not a covered entity. We do not collect PHI as defined under HIPAA. We can sign a BAA on request for additional assurance |
| **SOC 2 Type I** | Roadmap target Q4 2026 |
| **SOC 2 Type II** | Roadmap target Q3 2027 |

---

## What Happens If There's a Breach

1. **Detection:** continuous monitoring of access patterns and anomalies
2. **Containment:** affected access tokens revoked within 1 hour of confirmation
3. **Notification:** written notice to your designated security contact within 
   72 hours, regardless of jurisdiction (we apply the strictest GDPR standard 
   globally)
4. **Forensics:** full audit-log review with findings shared
5. **Remediation:** documented post-mortem and corrective actions

---

## Frequently Asked Compliance Questions

**Q: Can you confirm in writing that one company cannot see another company's data?** 
Yes. The HR portal authentication binds a session to exactly one company ID 
via a cryptographically-signed token. All database queries are filtered by 
that company ID server-side. We will provide a written attestation on request.

**Q: Can our IT team review your security architecture?** 
Yes. Email `admin@neuroquestllc.info` to schedule a security review call. 
We can provide architecture diagrams and answer questions under NDA.

**Q: Can we host this on our own infrastructure?** 
Not currently. Single-tenant deployments are on the 2027 roadmap for 
enterprise customers.

**Q: Who has the master key on your end?** 
Only the founder (Whitney Ausbrooks) and a limited set of named engineering 
personnel under NDA. The list is auditable on request.

**Q: How do we delete all our data after the pilot?** 
Email `admin@neuroquestllc.info` with the subject "Data Deletion Request — 
[Company Name]". Hard deletion completes within 30 days. We provide written 
confirmation.

---

## Quick Reference Card (Print Separately)

```
┌────────────────────────────────────────────────────────────┐
│  NEUROQUEST PRIVACY — WHAT HR SEES                         │
├────────────────────────────────────────────────────────────┤
│  ✅ HR sees:                                               │
│     • Team roster + activity counts                        │
│     • Aggregate WRI, burnout %, engagement                 │
│       (only when 5+ employees active)                      │
│     • Seat usage and pilot countdown                       │
│                                                            │
│  ❌ HR never sees:                                         │
│     • Any individual's score                               │
│     • Any session content                                  │
│     • Any data from any other company                      │
│     • Aggregates below 5-active threshold                  │
│                                                            │
│  Enforced by:                                              │
│     • Signed token bound to your company ID                │
│     • Server-side query scoping                            │
│     • Append-only audit log (7-year retention)             │
│                                                            │
│  Compliance: GDPR ✓  CCPA ✓  HIPAA-friendly ✓             │
│  SOC 2 Type I target: Q4 2026                              │
│                                                            │
│  Security review: admin@neuroquestllc.info                 │
└────────────────────────────────────────────────────────────┘
```
