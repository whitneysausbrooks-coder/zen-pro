#!/usr/bin/env node
// White-glove pilot provisioning CLI.
// Calls the API server's /api/enterprise/onboard-pilot endpoint.
//
// Usage:
//   node scripts/create-pilot.mjs --name "Acme Inc" --email "hr@acme.com" --seats 50
//   node scripts/create-pilot.mjs --name "Acme Inc" --email "hr@acme.com" --seats 50 --days 75 --industry "Technology"
//
// Optional env:
//   API_BASE         (default: http://localhost:8080)  — point at prod when ready
//   PUBLIC_DOMAIN    (default: https://neuroquestzen.pro) — appears in welcome email block
//   ENTERPRISE_API_KEY  (required) — set automatically by Replit env

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const name = args.name;
const email = args.email;
const seats = parseInt(args.seats || "50", 10);
const days = parseInt(args.days || "75", 10);
const industry = args.industry || undefined;

if (!name || !email || !seats) {
  console.error(
    "Usage: node scripts/create-pilot.mjs --name <company> --email <admin> --seats <n> [--days 75] [--industry <text>]"
  );
  process.exit(1);
}

const API_BASE = process.env.API_BASE || "http://localhost:8080";
const PUBLIC_DOMAIN = process.env.PUBLIC_DOMAIN || "https://neuroquestzen.pro";
const apiKey = process.env.ENTERPRISE_API_KEY;

if (!apiKey) {
  console.error("ERROR: ENTERPRISE_API_KEY env var is required");
  process.exit(1);
}

(async () => {
  const res = await fetch(`${API_BASE}/api/enterprise/onboard-pilot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-enterprise-key": apiKey,
    },
    body: JSON.stringify({
      company_name: name,
      admin_email: email,
      seats,
      pilot_days: days,
      industry,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    console.error("FAILED:", data.error || res.status);
    process.exit(2);
  }
  const fmt = (d) => new Date(d).toISOString().slice(0, 10);
  console.log("\n========================================");
  console.log("  PILOT COMPANY CREATED");
  console.log("========================================");
  console.log(`Company:        ${data.company_name}`);
  console.log(`Company ID:     ${data.company_id}`);
  console.log(`Admin email:    ${data.admin_email}`);
  console.log(`Seats:          ${data.seats}`);
  console.log(`Pilot starts:   ${fmt(data.pilot_started_at)}`);
  console.log(`Pilot ends:     ${fmt(data.pilot_ends_at)}  (${days} days)`);
  console.log(`Invite code:    ${data.invite_code}     <-- send to buyer`);
  console.log("\n----------------------------------------");
  console.log("  PASTE INTO WELCOME EMAIL (HR Portal):");
  console.log("----------------------------------------");
  console.log(`HR Dashboard:      ${PUBLIC_DOMAIN}/company-admin`);
  console.log(`  Sign in email:   ${data.admin_email}`);
  console.log(`  Company code:    ${data.invite_code}`);
  console.log("");
  console.log("----------------------------------------");
  console.log("  PASTE INTO TEAM ANNOUNCEMENT:");
  console.log("----------------------------------------");
  console.log(`Employee join URL: ${PUBLIC_DOMAIN}/join`);
  console.log(`Company code:      ${data.invite_code}`);
  console.log(`Pilot end date:    ${fmt(data.pilot_ends_at)}`);
  console.log("");
  console.log("----------------------------------------");
  console.log("  YOUR GOD-MODE (Whitney only):");
  console.log("----------------------------------------");
  console.log(`Master dashboard:  ${PUBLIC_DOMAIN}/admin-dashboard`);
  console.log(`(append "?key=<your master key>" the first time on each device)`);
  console.log("========================================\n");
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(3);
});
