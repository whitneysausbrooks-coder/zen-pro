---
name: Enterprise write patterns (seat caps, audit logs)
description: Rules for multi-step writes in the enterprise/pilot API to avoid billing leaks and false 500s
---

# Seat-cap enforcement must lock the company row
Any endpoint that admits a member into a company (e.g. `/enterprise/join`) must do
check-then-insert **inside a transaction** with `SELECT ... FROM companies WHERE ... FOR UPDATE`
on the company row, then re-run the seat check on that same transaction client, then insert, then COMMIT.

**Why:** seats are billed at $12/seat/mo. A plain check-then-insert (read count, then insert,
no lock) lets concurrent joins both pass the seat check and both insert, overshooting the paid
cap — a silent revenue leak. The DB UNIQUE on `enterprise_users.email` does NOT protect this
because the colliding rows are different people.
**How to apply:** `checkSeatAvailability(companyId, executor?)` takes an optional executor; pass the
locked transaction client so its COUNT participates in the lock. Verified with a 6-way concurrent
join test on a 1-seat pilot → exactly 1 winner.

# Audit logging is best-effort and goes AFTER commit, in its own try/catch
`auditLog(...)` writes a separate row and must never roll back or fail the business write.
Place it after `COMMIT`, wrapped in its own `try/catch` that only `console.warn`s.

**Why:** if auditLog throws while still inside the main `try`, control falls into the transaction
`catch`, returns 500, and the caller retries — even though the join already committed. Telemetry
failure must not look like request failure.
**How to apply:** same pattern applies to any other seat-mutating path (e.g. `/enterprise/users`)
if it can create company members.
