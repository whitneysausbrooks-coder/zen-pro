#!/usr/bin/env tsx
import { createRevenueSchedule, handleSeatChangeProspective, runDailyRecognition } from "../src/lib/revenueRecognition.js";
import { query } from "../src/lib/db.js";

const CO = "00000000-0000-0000-0000-000000000099";
const SUB = "sub_audit_proof_proration";
const PRICE = 1200;

async function cleanup() {
  await query("DELETE FROM revenue_journal WHERE company_id = $1", [CO]);
  await query("DELETE FROM revenue_schedules WHERE company_id = $1", [CO]);
}

async function runAuditValidation() {
  await cleanup();

  const SCENARIOS = [
    { name: "A", seats: 75,  addSeats: 25,  changeDay: 10, startMonth: [2026,6],  endMonth: [2026,7]  },
    { name: "B", seats: 200, addSeats: 100, changeDay: 20, startMonth: [2026,5],  endMonth: [2026,6]  },
    { name: "C", seats: 50,  addSeats: 1,   changeDay: 2,  startMonth: [2027,1],  endMonth: [2027,2]  },
    { name: "D", seats: 10,  addSeats: 90,  changeDay: 29, startMonth: [2026,7],  endMonth: [2026,8]  },
    { name: "E", seats: 500, addSeats: 500, changeDay: 15, startMonth: [2026,8],  endMonth: [2026,9]  },
  ];

  console.log("╔═══════════════════════════════════════════════════════════════════════╗");
  console.log("║  ASC 606 PRORATION VALIDATION — AUDIT-PROOF CERTIFICATION SCRIPT    ║");
  console.log("║  Stripe proration_behavior: 'always_invoice'                        ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════╝\n");

  let allPassed = true;

  for (const S of SCENARIOS) {
    const subId = `${SUB}_${S.name}`;
    const periodStart = new Date(Date.UTC(S.startMonth[0], S.startMonth[1], 1));
    const periodEnd = new Date(Date.UTC(S.endMonth[0], S.endMonth[1], 1));
    const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`━━━ Scenario ${S.name}: ${S.seats} → ${S.seats + S.addSeats} seats, change day ${S.changeDay}/${totalDays} ━━━\n`);

    const schedId = await createRevenueSchedule(CO, subId, periodStart, periodEnd, S.seats, "new_subscription");
    const origSched = (await query("SELECT * FROM revenue_schedules WHERE id = $1", [schedId])).rows[0];
    const origDRR = origSched.daily_rate;
    const expectedOrigDRR = Math.round(S.seats * PRICE / totalDays);

    console.log(`  DRR: $${(origDRR / 100).toFixed(2)}/day (expected $${(expectedOrigDRR / 100).toFixed(2)})`);
    if (origDRR !== expectedOrigDRR) { console.log(`  ❌ DRR mismatch\n`); allPassed = false; continue; }
    console.log(`  ✅ DRR correct\n`);

    const daysBeforeChange = S.changeDay - 1;
    for (let d = 1; d <= daysBeforeChange; d++) {
      await runDailyRecognition(new Date(Date.UTC(S.startMonth[0], S.startMonth[1], d, 12)));
    }

    const preChange = (await query("SELECT recognized_to_date FROM revenue_schedules WHERE id = $1", [schedId])).rows[0];
    if (preChange.recognized_to_date !== origDRR * daysBeforeChange) {
      console.log(`  ❌ Pre-change recognition mismatch\n`); allPassed = false; continue;
    }
    console.log(`  ✅ Pre-change recognition: $${(preChange.recognized_to_date / 100).toFixed(2)}`);

    const changeDate = new Date(Date.UTC(S.startMonth[0], S.startMonth[1], S.changeDay, 10));
    const newSeats = S.seats + S.addSeats;
    await handleSeatChangeProspective(CO, subId, newSeats, S.seats, changeDate);

    const active = (await query(
      "SELECT * FROM revenue_schedules WHERE company_id = $1 AND subscription_id = $2 AND status = 'active'",
      [CO, subId]
    )).rows[0];

    const remainingDays = Math.round((periodEnd.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));
    const expectedNewRemVal = Math.round(newSeats * PRICE * remainingDays / totalDays);
    const expectedNewDRR = Math.round(expectedNewRemVal / remainingDays);

    console.log(`  Seat change → ${newSeats}: DRR $${(active.daily_rate / 100).toFixed(2)} (expected $${(expectedNewDRR / 100).toFixed(2)})`);
    if (active.daily_rate !== expectedNewDRR || active.deferred_balance !== expectedNewRemVal) {
      console.log(`  ❌ Post-change mismatch\n`); allPassed = false; continue;
    }
    console.log(`  ✅ Post-change DRR + deferred correct`);

    let dayErrors = 0;
    for (let d = S.changeDay; d < S.changeDay + remainingDays; d++) {
      await runDailyRecognition(new Date(Date.UTC(S.startMonth[0], S.startMonth[1], d, 12)));
      const dateStr = new Date(Date.UTC(S.startMonth[0], S.startMonth[1], d)).toISOString().slice(0, 10);
      const j = (await query(
        `SELECT amount FROM revenue_journal WHERE company_id = $1 AND entry_date = $2 AND schedule_id = $3 AND entry_type = 'recognition' ORDER BY created_at DESC LIMIT 1`,
        [CO, dateStr, active.id]
      )).rows[0];
      if (j && j.amount !== expectedNewDRR && d < S.changeDay + remainingDays - 1) dayErrors++;
    }

    const final = (await query("SELECT * FROM revenue_schedules WHERE id = $1", [active.id])).rows[0];
    const invariant = final.recognized_to_date + final.deferred_balance === final.total_amount;
    const deferredZero = final.deferred_balance === 0;

    console.log(`  Invariant (rec + def = total): ${invariant ? "✅" : "❌"}`);
    console.log(`  Deferred = $0 at end:          ${deferredZero ? "✅" : "❌"}`);
    console.log(`  DRR day-by-day match:          ${dayErrors === 0 ? "✅" : "❌ " + dayErrors + " errors"}`);

    const pass = invariant && deferredZero && dayErrors === 0;
    if (!pass) allPassed = false;
    console.log(`  SCENARIO ${S.name}: ${pass ? "✅ PASS" : "❌ FAIL"}\n`);
  }

  console.log(allPassed
    ? "\n✅ AUDIT-PROOF CERTIFICATION: ALL 5 SCENARIOS PASSED"
    : "\n❌ AUDIT FAILED");

  await cleanup();
  process.exit(allPassed ? 0 : 1);
}

runAuditValidation().catch(e => { console.error(e); process.exit(1); });
