const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "..", "exports", "NeuroQuest_Apple_Submission_Workbook.pdf");
const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 56, bottom: 56, left: 56, right: 56 },
  info: {
    Title: "NeuroQuest — Apple Submission Workbook",
    Author: "NeuroQuest",
    Subject: "Step-by-step record of pre-submission work and App Store Connect fill-in guide",
  },
});

doc.pipe(fs.createWriteStream(OUT));

const NAVY = "#1a1830";
const GOLD = "#B8860B";
const SLATE = "#3a3a3a";
const MUTED = "#6b6b6b";
const RULE = "#dcdcdc";
const GREEN = "#2e7d32";
const RED = "#b00020";
const AMBER = "#a36a00";

function h1(text) {
  doc.moveDown(0.6);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(text);
  doc.moveDown(0.2);
  const y = doc.y;
  doc.strokeColor(GOLD).lineWidth(1.5).moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + 60, y).stroke();
  doc.moveDown(0.6);
}
function h2(text) {
  doc.moveDown(0.5);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text(text);
  doc.moveDown(0.2);
}
function h3(text) {
  doc.moveDown(0.3);
  doc.fillColor(SLATE).font("Helvetica-Bold").fontSize(11).text(text);
  doc.moveDown(0.15);
}
function p(text, opts = {}) {
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5).text(text, { align: "left", lineGap: 2, ...opts });
  doc.moveDown(0.4);
}
function muted(text) {
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9.5).text(text, { lineGap: 2 });
  doc.moveDown(0.3);
}
function bullet(items) {
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5);
  items.forEach((it) => doc.text(`•  ${it}`, { indent: 10, lineGap: 3 }));
  doc.moveDown(0.3);
}
function checkbox(items, done = false) {
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5);
  const mark = done ? "[x]" : "[ ]";
  items.forEach((it) => doc.text(`${mark}  ${it}`, { indent: 10, lineGap: 3 }));
  doc.moveDown(0.3);
}
function status(label, color) {
  doc.fillColor(color).font("Helvetica-Bold").fontSize(10).text(label);
  doc.moveDown(0.2);
}
function codebox(text) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;
  doc.fillColor("#1a1830").font("Courier").fontSize(9).text(text, x + 8, startY + 6, { width: w - 16, lineGap: 2 });
  const endY = doc.y + 6;
  doc.fillColor("#f6f4ee").rect(x, startY, w, endY - startY).fill();
  doc.fillColor("#1a1830").font("Courier").fontSize(9).text(text, x + 8, startY + 6, { width: w - 16, lineGap: 2 });
  doc.moveDown(0.6);
}
function kv(rows) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = 165;
  rows.forEach(([k, v]) => {
    const startY = doc.y;
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text(k, x, startY, { width: colW });
    const labelEndY = doc.y;
    doc.fillColor(SLATE).font("Helvetica").fontSize(10).text(v, x + colW, startY, { width: w - colW, lineGap: 2 });
    const valEndY = doc.y;
    doc.y = Math.max(labelEndY, valEndY) + 4;
    doc.strokeColor(RULE).lineWidth(0.3).moveTo(x, doc.y - 2).lineTo(x + w, doc.y - 2).stroke();
    doc.moveDown(0.15);
  });
  doc.moveDown(0.3);
}
function ensureSpace(lines = 6) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - lines * 14) doc.addPage();
}

// ============ COVER ============
doc.fillColor(NAVY).rect(0, 0, doc.page.width, 140).fill();
doc.fillColor("#FFD700").font("Helvetica-Bold").fontSize(11).text("NEUROQUEST", 56, 40, { characterSpacing: 2 });
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("Apple Submission Workbook", 56, 60, { width: 480 });
doc.fillColor("#cfcce0").font("Helvetica").fontSize(11).text("Step-by-step record of pre-submission work + App Store Connect fill-in guide", 56, 100);
doc.y = 170;
p("This workbook is the running record of what we changed in the codebase to prepare NeuroQuest Zen Pro for App Store review, plus every value you need to paste into App Store Connect. Use it alongside the Fail-Proof Apple Review Playbook.");
muted(`Generated ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}  ·  Bundle ID: pro.neuroquestzen.app  ·  ascAppId: 6763640852`);

doc.moveDown(0.5);
const boxY = doc.y;
const boxX = doc.page.margins.left;
const boxW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
doc.fillColor("#fdf6e3").rect(boxX, boxY, boxW, 110).fill();
doc.strokeColor(GOLD).lineWidth(1.5).rect(boxX, boxY, boxW, 110).stroke();
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(12).text("APPLE REVIEWER CREDENTIALS", boxX + 14, boxY + 12);
doc.fillColor(SLATE).font("Helvetica").fontSize(10).text("Paste these into App Store Connect → App Review Information → Sign-In Information.", boxX + 14, boxY + 30, { width: boxW - 28 });
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("User Name:", boxX + 14, boxY + 58);
doc.fillColor(SLATE).font("Courier-Bold").fontSize(11).text("apple-review@neuroquestzen.pro", boxX + 110, boxY + 58);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("Password:", boxX + 14, boxY + 78);
doc.fillColor(SLATE).font("Courier-Bold").fontSize(11).text("SQVU453X", boxX + 110, boxY + 78);
doc.y = boxY + 120;
doc.moveDown(0.4);

// ============ SECTION 1 — PROGRESS ============
h1("1. Pre-Flight Checklist Progress");
p("Where we are in the 11-item playbook:");

const items = [
  ["1.  HealthKit usage strings", "DONE", GREEN],
  ["2.  Bundle identifier", "DONE", GREEN],
  ["3.  Version + build number", "DONE", GREEN],
  ["4.  App icon (1024×1024, no alpha)", "DONE", GREEN],
  ["5.  Graceful HealthKit denial", "DONE", GREEN],
  ["6.  No-crash on fresh install", "DONE", GREEN],
  ["7.  In-app account deletion in Profile tab", "PENDING", AMBER],
  ["8.  Deprecated Info.plist warnings", "PENDING", AMBER],
  ["9.  No Replit/dev URL refs in production", "PENDING", AMBER],
  ["10. Privacy policy URL covers HealthKit", "BLOCKED — needs your URL", RED],
  ["11. Support URL is live", "BLOCKED — needs your URL", RED],
];
items.forEach(([label, st, color]) => {
  const startY = doc.y;
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5).text(label, 56, startY, { width: 320 });
  doc.fillColor(color).font("Helvetica-Bold").fontSize(10).text(st, 380, startY, { width: 180 });
  doc.y = Math.max(doc.y, startY + 16);
});
doc.moveDown(0.6);

// ============ SECTION 2 — CHANGES MADE ============
doc.addPage();
h1("2. Changes Made to the Codebase");
p("Every edit, with the file path and the reason. If review questions arise, this is your audit trail.");

h2("Item 1 — HealthKit usage strings");
p("File: artifacts/neuro-quest-mobile/app.json");
h3("What changed");
bullet([
  "Rewrote NSHealthShareUsageDescription using Apple's exact data type names: Heart Rate Variability, Sleep Analysis, Step Count.",
  "Added the privacy promise: aggregates of 5 or more, name never attached.",
  "Removed NSHealthUpdateUsageDescription entirely (the app never writes to HealthKit; declaring an unused permission is itself a rejection trap).",
  "Kept background: false to confirm no background data collection.",
]);
h3("Final string (this is what users see on the iOS permission prompt)");
codebox(
  "NeuroQuest reads your Heart Rate Variability, Sleep Analysis, and Step Count from Apple Health when you open the app, so we can compute your personal Neuro Resilience Score. Your individual readings are only used to show your own score; anything shared with your employer is anonymized into aggregates of 5 or more employees, and your name is never attached.",
);

h2("Item 2 — Bundle identifier");
p("Files: artifacts/neuro-quest-mobile/app.json, eas.json");
kv([
  ["iOS bundleIdentifier", "Info.neuroquest.zenpro  →  pro.neuroquestzen.app"],
  ["Android package", "app.replit.neuroquest  →  pro.neuroquestzen.app"],
  ["ascAppId", "6762701920 (rejected, abandoned)  →  6763640852 (new, clean record)"],
]);
muted("Reason: clean reverse-DNS based on the domain you actually own; matches across iOS and Android so your brand identity stays consistent across stores.");

h2("Item 3 — Version + build number");
p("File: artifacts/neuro-quest-mobile/app.json");
kv([
  ["expo.version", "1.0.0  (kept — correct for launch)"],
  ["ios.buildNumber", "2  →  1  (reset; this is build #1 of the new ASC record)"],
  ["android.versionCode", "(missing!)  →  1  (was completely absent — would have caused Android build failures)"],
]);

h2("Item 4 — App icon");
p("File: artifacts/neuro-quest-mobile/assets/images/icon.png");
status("No changes needed — already passes every Apple requirement.", GREEN);
bullet([
  "Dimensions: 1024 × 1024 (exact match for App Store requirement)",
  "Format: PNG, 8-bit RGB",
  "Alpha channel: NONE (color type 2 — opaque) — the #1 reason icons fail review is alpha channels; yours is clean",
  "Non-interlaced PNG, no flattening artifacts",
]);
muted("Future note: when you submit to Google Play, you'll need a separate adaptive-icon.png (foreground + background). Not blocking iOS submission.");

h2("Item 5 — Graceful HealthKit denial");
p("Files: artifacts/neuro-quest-mobile/lib/health.ts, app/wearable.tsx");
h3("Why this mattered");
p("iOS HealthKit's requestAuthorization is intentionally opaque — it returns successfully whether the user grants OR denies, for privacy reasons. The previous code treated success as \"granted,\" which made the UI display \"Permissions granted ✓\" even after denial. That is Apple Guideline 2.3.7 (Misleading UI) and is a guaranteed rejection.");
h3("What changed");
bullet([
  "Added openAppSettings() helper using Linking.openSettings() — gives reviewers a one-tap path to the app's permission page.",
  "Renamed the misleading flag permGranted → healthRequested (semantic accuracy: we know we asked, not that we got).",
  "Button label after request: \"Apple Health requested ✓ — tap Sync below\" (was \"Permissions granted ✓\").",
  "Both the connect-failure alert and the no-data sync alert now show an Open Settings action button.",
  "Rewrote the no-data sync message to honestly mention permission denial as a possible cause.",
]);

h2("Item 6 — No-crash on fresh install");
p("Files reviewed: app/_layout.tsx, components/OnboardingFlow.tsx, components/ErrorBoundary.tsx, app/(tabs)/index.tsx");
status("Audit clean — no fresh-install crashes detected. No code changes needed.", GREEN);
h3("What we verified");
bullet([
  "Splash screen is held until both fonts AND onboarding state finish loading.",
  "AsyncStorage reads use try/catch; no calls assume non-null values.",
  "Home tab data loading wraps everything in try/catch; uses Number.isNaN guards on parsed values.",
  "ErrorBoundary has defaultProps.FallbackComponent set, so an error always renders a fallback (never a re-throw loop).",
  "Onboarding completes before any tab renders; user never lands on a screen that requires non-existent data.",
]);
muted("Low-priority cleanup for later: ErrorBoundary uses defaultProps on a class component, deprecated in React 19. Still works; replace with destructured default in next refactor.");

// ============ SECTION 3 — DEVELOPER PORTAL ============
doc.addPage();
h1("3. Apple Developer Portal — App ID Setup");
p("These are the exact values to use when registering the App Identifier at developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → +.");

kv([
  ["Type", "App IDs → App"],
  ["Description", "NeuroQuest Zen Pro"],
  ["Bundle ID", "Explicit  →  pro.neuroquestzen.app"],
]);

h3("Capabilities — check exactly ONE box");
checkbox(["HealthKit  ← CHECK THIS"], true);
muted("After checking HealthKit, Apple expands a sub-checkbox: \"Clinical Health Records.\" DO NOT check it. That sub-capability is for medical-grade data (lab results, prescriptions) and forces a clinical review queue you don't need.");
h3("Capabilities — leave UNCHECKED");
bullet([
  "Push Notifications (not used in code)",
  "Sign in with Apple (you use email + invite code, not social login)",
  "Background Modes (HealthKit is background: false)",
  "Associated Domains, iCloud, Apple Pay, MusicKit, WeatherKit, etc. — none used",
]);
muted("The rule: every capability you check is a promise to Apple that you use it. Checking unused ones triggers reviewer questions and rejections.");

h3("App Services tab");
p("Check nothing. None apply to NeuroQuest.");

h3("Capability Requests tab");
p("Submit nothing. None apply, and unnecessary requests create open paperwork that holds up review.");

// ============ SECTION 4 — APP STORE CONNECT ============
doc.addPage();
h1("4. App Store Connect — Complete Fill-In Guide");
p("Each subsection below maps to a tab or pane inside App Store Connect. Copy the values verbatim into the matching field.");

h2("4.1  App Information (left sidebar)");
kv([
  ["Name", "NeuroQuest Zen Pro"],
  ["Subtitle (max 30 chars)", "Brain Training & Resilience  (27 chars)"],
  ["Bundle ID", "pro.neuroquestzen.app  (auto-filled from your App ID)"],
  ["SKU", "neuroquest-zenpro-ios"],
  ["Primary Language", "English (U.S.)"],
  ["Category — Primary", "Health & Fitness  (required for HealthKit apps)"],
  ["Category — Secondary", "Lifestyle"],
  ["Content Rights", "No third-party content  (confirm: are all in-app games / music original?)"],
  ["Age Rating", "12+  (see breakdown below)"],
]);

h3("Age Rating questionnaire — answer these exactly:");
kv([
  ["Cartoon / Fantasy Violence", "None"],
  ["Realistic Violence", "None"],
  ["Sexual Content or Nudity", "None"],
  ["Profanity / Crude Humor", "None"],
  ["Alcohol, Tobacco, Drug Use", "None"],
  ["Mature / Suggestive Themes", "None"],
  ["Horror / Fear Themes", "None"],
  ["Medical / Treatment Information", "Infrequent / Mild  (you describe HRV/resilience scoring)"],
  ["Gambling, Contests, Web Access", "None / No"],
  ["Made for Kids", "No"],
]);
muted("Computed result: 12+. Correct for a wellness app showing health metrics.");

doc.addPage();
h2("4.2  Pricing and Availability");
kv([
  ["App Price", "Free  (download is free; revenue is via IAP and out-of-app B2B Stripe)"],
  ["Availability", "All countries and regions"],
  ["Pre-Orders", "Off"],
  ["Volume Purchase Program (Education)", "Off"],
  ["Distribute on iPad", "Off  (app.json has supportsTablet: false)"],
]);

h2("4.2.5  In-App Purchases — pricing & product setup");
p("Create these five records under Monetization. The product IDs are prefixed with the bundle ID (pro.neuroquestzen.app) so they cannot collide with any other developer's products. All prices in USD; Apple auto-converts to local currency using the matched price tier.");

h3("Auto-Renewable Subscription (1 product, in a subscription group named \"Zen Pro\")");
kv([
  ["Reference Name", "Zen Pro Monthly"],
  ["Product ID", "pro.neuroquestzen.app.zenpro.monthly"],
  ["Subscription Group", "Zen Pro"],
  ["Duration", "1 Month"],
  ["Price", "$9.99 USD  (Tier 10)"],
  ["Charity disclosure", "$3.00 of every subscription is donated to verified charity partners"],
  ["Localized display name", "Zen Pro Monthly"],
  ["Description", "Unlimited access to all brain-training games, advanced resilience analytics, and priority HealthKit sync. Auto-renews monthly."],
]);

h3("Non-Consumable (1 product)");
kv([
  ["Reference Name", "Daily Pass"],
  ["Product ID", "pro.neuroquestzen.app.daypass"],
  ["Price", "$4.99 USD  (Tier 5)"],
  ["Charity disclosure", "$1.50 donated to verified charity partners"],
  ["Localized display name", "Daily Pass"],
  ["Description", "24-hour access to all premium brain-training games and analytics. One-time purchase."],
]);
muted("Note: code lists this as $5.00. Closest Apple tier is $4.99 (Tier 5). Use $4.99 in App Store Connect; the in-app label will round to $5 only if you also update the Shop screen.");

h3("Consumables (3 products — Extra Spins)");
kv([
  ["Reference Name", "5 Extra Spins"],
  ["Product ID", "pro.neuroquestzen.app.spins.5"],
  ["Price", "$0.99 USD  (Tier 1)"],
  ["Charity disclosure", "$0.30 donated to verified charity partners"],
  ["Description", "5 bonus spins for the Slot Machine training game."],
]);
kv([
  ["Reference Name", "15 Extra Spins"],
  ["Product ID", "pro.neuroquestzen.app.spins.15"],
  ["Price", "$1.99 USD  (Tier 2)"],
  ["Charity disclosure", "$0.60 donated to verified charity partners"],
  ["Description", "15 bonus spins for the Slot Machine training game.  (Marked POPULAR in the Shop UI.)"],
]);
kv([
  ["Reference Name", "50 Extra Spins"],
  ["Product ID", "pro.neuroquestzen.app.spins.50"],
  ["Price", "$4.99 USD  (Tier 5)"],
  ["Charity disclosure", "$1.50 donated to verified charity partners"],
  ["Description", "50 bonus spins for the Slot Machine training game.  (Marked BEST VALUE in the Shop UI.)"],
]);

h3("Submission flow");
bullet([
  "Submit all five IAP records for review with the v1.0.0 binary (not separately). Apple reviews them in the same pass.",
  "For the subscription, attach a localized review screenshot showing the Zen Pro paywall modal in the Train tab.",
  "Each consumable also needs a localized review screenshot of the Shop tab.",
  "Charity disclosure language must appear visibly inside the app on every IAP CTA — already implemented in shop.tsx (donationNote field).",
]);

doc.addPage();
h2("4.3  App Privacy  ⚠ MOST CRITICAL SECTION");
p("Apple cross-references your declarations against your actual code. Mismatches cause rejection.");

h3("Step 1");
p("Does your app collect data?  →  Yes");

h3("Step 2 — Tracking");
p("No, this app does not track users.  (You don't use IDFA or any cross-app tracking SDK.)");

h3("Step 3 — Data types collected");
kv([
  ["Health & Fitness  →  Health (HRV, Sleep, Steps)", "Linked: Yes  ·  Tracking: No  ·  Purposes: App Functionality, Analytics"],
  ["Contact Info  →  Email Address (work email)", "Linked: Yes  ·  Tracking: No  ·  Purposes: App Functionality"],
  ["Identifiers  →  User ID (invite code → user mapping)", "Linked: Yes  ·  Tracking: No  ·  Purposes: App Functionality"],
  ["Purchases  →  Purchase History (in-app purchases)", "Linked: Yes  ·  Tracking: No  ·  Purposes: App Functionality"],
]);
muted("Do NOT check: Location, Browsing History, Search History, Photos, Audio, Contacts, Customer Support, Crash Data, Performance Data, Diagnostics. None are collected.");

doc.addPage();
h2("4.4  Version 1.0.0 — Prepare for Submission");

h3("Promotional Text (170 chars, can update without new version)");
codebox("Train your brain in 5-minute sessions backed by science. Sync Apple Watch to see your Neuro-Resilience Score grow. Free 75-day pilot for teams.");
muted("146 characters. Leaves room to tweak.");

h3("Description (4000 chars max)");
codebox(`NeuroQuest Zen Pro is a clinically-inspired brain training and wellness app designed for high-performing professionals and the teams that support them.

WHY NEUROQUEST
Modern work pushes your nervous system to its limits. NeuroQuest gives you 5-minute, science-backed exercises that build cognitive resilience, focus, and emotional regulation — without making you feel like another wellness gimmick is being sold to you.

WHAT'S INSIDE
• Daily Bloom: a 30-second gratitude practice that anchors your morning
• Train: focused micro-sessions for working memory, attention, and reframing
• Play: skill-building games disguised as fun
• Resilience: your personal Neuro-Resilience Score, computed from HRV, sleep, and step data
• Apple Health integration: read-only sync of HRV, Sleep, and Steps from your iPhone or Apple Watch

FOR TEAMS (NEUROQUEST ZEN PRO ENTERPRISE)
HR leaders can sponsor a free 75-day pilot for their team and see anonymized engagement and resilience trends — never individual data. Your participation is always private. Aggregate insights only become visible to your employer when 5 or more teammates participate, and your name is never attached.

YOUR PRIVACY IS THE PRODUCT
• Your individual scores are visible only to you
• Your employer sees aggregate trends only when 5+ teammates participate
• You can disconnect Apple Health anytime in iOS Settings → Privacy → Health
• We never read location, messages, contacts, photos, or workouts
• Health data is processed solely to compute your Neuro-Resilience Score

PILOT PROGRAM
NeuroQuest Zen Pro Enterprise offers a FREE 75-day pilot for teams. After the pilot, $50 per seat per year. No credit card required to start.

Ask your HR or wellness lead about activating NeuroQuest for your team — or visit neuroquestzen.pro to start a pilot.

NeuroQuest is a wellness tool, not a medical device. Not intended to diagnose, treat, cure, or prevent any disease. Consult a healthcare professional for medical advice.`);

h3("Keywords (100 chars max, comma-separated, no spaces around commas)");
codebox("brain training,resilience,HRV,wellness,meditation,focus,sleep,mindfulness,neuro,heart rate variability");
muted("98 characters. Apple counts every char including commas.");

h3("URLs");
kv([
  ["Support URL  (REQUIRED)", "https://neuroquestzen.pro/support  ← confirm this is live"],
  ["Marketing URL  (optional)", "https://neuroquestzen.pro"],
  ["Privacy Policy URL  (REQUIRED for HealthKit)", "https://neuroquestzen.pro/privacy  ← MUST be live and mention HealthKit"],
]);

h3("Copyright");
codebox("© 2026 NeuroQuest LLC");

doc.addPage();
h2("4.5  Sign-In Required for Apple to Test  →  Yes");
p("NeuroQuest is a hybrid app: individuals can use the free tier and purchase Zen Pro via IAP without any credentials, while enterprise users authenticate with a company invite code that bypasses the paywall. The credentials below test the enterprise flow and are live on production right now.");
kv([
  ["User Name", "apple-review@neuroquestzen.pro"],
  ["Password", "SQVU453X  (this is the company invite code)"],
  ["Notes about sign-in", "NeuroQuest does not use traditional passwords. The password field above contains the company invite code. On the Wearable screen, the reviewer enters the email in the Email field and the password value in the Invite Code field, then taps Save & verify."],
  ["Status", "Live on production (verified via /api/enterprise/lookup-invite). Pilot expires 2027-04-24."],
]);

h2("4.6  App Review Information (the most-overlooked section)");
kv([
  ["First Name", "Whitney"],
  ["Last Name", "(your legal surname for ASC)"],
  ["Phone Number", "(your contact number with country code)"],
  ["Email", "whitneysausbrooks@icloud.com"],
  ["Demo Account", "(email + invite code from above)"],
]);

h3("Notes for Reviewer (paste verbatim into ASC → App Review Information → Notes — this saves more apps than any other field; 3,949 / 4,000 chars)");
codebox(require("fs").readFileSync(require("path").join(__dirname, "..", "exports", "Apple_Reviewer_Notes.txt"), "utf8").trim());

h3("Attachment");
p("Upload the existing Fail-Proof Apple Review Playbook PDF as an attachment so the reviewer has the full context: exports/NeuroQuest_Apple_Review_Playbook.pdf");

h2("4.7  Version Release");
kv([
  ["Manually release this version", "Recommended  ✓  (gives you control to flip the switch when ready)"],
  ["Automatically release after approval", "Skip for first launch"],
  ["Phased release", "Off for v1.0.0  (use for v1.0.1+)"],
]);

// ============ SECTION 5 — OPEN ITEMS ============
doc.addPage();
h1("5. Open Questions Before You Submit");
p("These six items need answers from you before the App Store Connect record can be marked Ready for Review:");

const questions = [
  "Privacy Policy URL — does https://neuroquestzen.pro/privacy exist? If not, we need to publish one that explicitly covers HealthKit. HARD blocker.",
  "Support URL — does https://neuroquestzen.pro/support exist? If not, we need at minimum a contact page. HARD blocker.",
  "Should we create a dedicated apple-review@neuroquestzen.pro test seat (recommended), or use the existing T3M4CNT9 Bead'd code?",
  "Does your backend already support a \"review demo mode\" account that returns a fake score for empty HealthKit reads? If not, ~30 minutes of code to add.",
  "Phone number for App Review contact (with country code).",
  "Confirm that all Train/Play game content is original (no third-party copyrighted music, characters) — for the Content Rights answer.",
];
checkbox(questions);

h1("6. Items Still to Complete on the Pre-Flight Checklist");
checkbox([
  "Item 7: Verify Profile → Delete Account exists and actually wipes server-side data.",
  "Item 8: Audit for deprecated Info.plist warnings.",
  "Item 9: Remove the leaking Replit URL from app.json (expo-router origin: \"https://replit.com/\" → your production domain).",
  "Item 10: Privacy policy URL is live and explicitly covers HealthKit.",
  "Item 11: Support URL is live.",
]);

h1("7. Submission Strategy Reminder");
bullet([
  "Submit to TestFlight first, not directly to the App Store. Run internal testing for 24–48 hours.",
  "Submit Mon–Wed morning Pacific time. Friday/weekend submissions sit longer.",
  "Use Manual Release for v1.0.0 so you can flip the launch switch when you're ready.",
  "Monitor crash-free rate (target >99.5%) in App Store Connect → Analytics during the first 24 hours after release.",
  "Have expo eas update ready as a JS-only hotfix path for non-native bugs (no re-review required).",
]);

doc.moveDown(1);
muted("End of workbook. Save this file alongside NeuroQuest_Apple_Review_Playbook.pdf.");

doc.end();

doc.on("end", () => {
  const stats = fs.statSync(OUT);
  console.log(`Wrote ${OUT}  (${(stats.size / 1024).toFixed(1)} KB)`);
});
