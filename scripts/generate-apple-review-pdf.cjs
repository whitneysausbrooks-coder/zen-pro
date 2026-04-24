const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "..", "exports", "NeuroQuest_Apple_Review_Playbook.pdf");
const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 56, bottom: 56, left: 56, right: 56 },
  info: {
    Title: "NeuroQuest — Fail-Proof Apple Review Playbook",
    Author: "NeuroQuest",
    Subject: "App Store submission checklist tailored to NeuroQuest mobile",
  },
});

doc.pipe(fs.createWriteStream(OUT));

// ---------- design tokens ----------
const NAVY = "#1a1830";
const GOLD = "#B8860B";
const SLATE = "#3a3a3a";
const MUTED = "#6b6b6b";
const RULE = "#dcdcdc";
const RISK_HI = "#b00020";
const RISK_MED = "#a36a00";
const RISK_LO = "#2e7d32";

function hr() {
  doc.moveDown(0.4);
  const y = doc.y;
  doc.strokeColor(RULE).lineWidth(0.5).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.moveDown(0.6);
}

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

function p(text, opts = {}) {
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5).text(text, { align: "left", lineGap: 2, ...opts });
  doc.moveDown(0.4);
}

function muted(text) {
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9.5).text(text, { lineGap: 2 });
  doc.moveDown(0.4);
}

function bullet(items) {
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5);
  items.forEach((it) => {
    doc.text(`•  ${it}`, { indent: 10, lineGap: 3 });
  });
  doc.moveDown(0.3);
}

function checkbox(items) {
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5);
  items.forEach((it) => {
    doc.text(`[ ]  ${it}`, { indent: 10, lineGap: 3 });
  });
  doc.moveDown(0.3);
}

function blockquote(text) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;
  doc.fillColor(SLATE).font("Helvetica-Oblique").fontSize(10).text(text, x + 14, startY, { width: w - 14, lineGap: 3 });
  const endY = doc.y;
  doc.strokeColor(GOLD).lineWidth(2).moveTo(x + 4, startY - 2).lineTo(x + 4, endY).stroke();
  doc.moveDown(0.5);
}

function codebox(text) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fillColor("#f6f4ee").rect(x, doc.y, w, 0).fill();
  const startY = doc.y;
  doc.fillColor("#1a1830").font("Courier").fontSize(9.5).text(text, x + 8, startY + 6, { width: w - 16, lineGap: 2 });
  const endY = doc.y + 6;
  // redraw rect with correct height behind text
  doc.fillColor("#f6f4ee").rect(x, startY, w, endY - startY).fill();
  doc.fillColor("#1a1830").font("Courier").fontSize(9.5).text(text, x + 8, startY + 6, { width: w - 16, lineGap: 2 });
  doc.moveDown(0.6);
}

// ---------- cover ----------
doc.fillColor(NAVY).rect(0, 0, doc.page.width, 130).fill();
doc.fillColor("#FFD700").font("Helvetica-Bold").fontSize(11).text("NEUROQUEST", 56, 40, { characterSpacing: 2 });
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("Fail-Proof Apple Review Playbook", 56, 60, { width: 480 });
doc.fillColor("#cfcce0").font("Helvetica").fontSize(11).text("App Store submission checklist for the NeuroQuest mobile app", 56, 100);
doc.moveDown(2);
doc.y = 160;

doc.fillColor(SLATE).font("Helvetica").fontSize(10.5).text(
  "This playbook is tailored to NeuroQuest's actual configuration: Apple HealthKit (HRV, Sleep, Step Count), enterprise invite-code identity, B2B pilot model with Stripe billing, and expo-iap installed. Following every step in order typically clears Apple review on the first submission.",
  { lineGap: 3 },
);
muted("Generated from your build state · Save and tick off each item before you submit.");

// ---------- Section 1 ----------
h1("1. The Five Things That Will Get You Rejected on This App Specifically");
p("These are the highest-probability rejection causes for your particular combination of features. Address all five before submitting.");

h2("a)  HealthKit usage strings that aren't specific");
p("In app.json, the NSHealthShareUsageDescription must explain exactly what you read and why — and name each data type. Reviewers reject generic strings like \"to track your health.\" Use this template:");
blockquote("\"NeuroQuest reads your Heart Rate Variability, Sleep, and Step Count to compute your daily Neuro Resilience Score. Your data stays on your device and is only shared with your employer in fully-anonymized aggregates of 5 or more employees.\"");

h2("b)  Account deletion missing");
p("Since June 2022, any app with account creation must offer in-app account deletion — not a \"contact us\" link. Add a \"Delete my account\" button in the Profile tab that wipes the user from enterprise_users server-side and clears AsyncStorage.");

h2("c)  Sign in with Apple");
p("Guideline 4.8: if you offer any third-party social login, you must also offer Sign in with Apple. You currently use email + invite_code (not social), which is safe — but document this in the review notes so the reviewer doesn't misread invite_code as third-party login.");

h2("d)  Therapeutic / medical claims");
p("\"Brain training,\" \"resilience,\" and \"wellness\" are fine. \"Treats anxiety,\" \"diagnoses burnout,\" or \"clinical-grade\" anywhere user-facing will trigger a medical-device escalation that can take weeks. Audit every screen and the App Store description, then add this footer disclaimer:");
blockquote("\"NeuroQuest is a wellness tool, not a medical device. Not intended to diagnose, treat, cure, or prevent any disease. Consult a healthcare professional for medical advice.\"");

h2("e)  IAP misconfiguration");
p("You have expo-iap installed. If the app sells anything to consumers (subscriptions, unlocks, etc.), it must go through Apple In-App Purchase. Your B2B model — enterprise pays $50/seat/year via Stripe outside the app — is exempt under guideline 3.1.3(b), but only if employees never see a paywall in the app. If expo-iap isn't actually selling anything to end users right now, remove the dependency before submitting; reviewers see it and ask \"what are you selling?\"");

// ---------- Section 2 ----------
doc.addPage();
h1("2. Pre-Flight Checklist");
p("Complete every item in artifacts/neuro-quest-mobile before you build the submission archive.");

checkbox([
  "app.json → NSHealthShareUsageDescription is specific (use the template above)",
  "app.json → bundle identifier is your final production one (not com.expo.…)",
  "app.json → version + build number incremented",
  "App icon is exactly 1024×1024, no transparency, no rounded corners (Apple adds them)",
  "App launches and is fully usable without granting HealthKit permission",
  "App does not crash on a fresh install with no logged-in user",
  "\"Delete account\" exists in the Profile tab and actually deletes server-side",
  "No console warnings about deprecated permissions or Info.plist keys",
  "No references to Replit or development URLs anywhere user-facing — only the production domain",
  "Privacy policy URL is live and explicitly covers HealthKit data (Apple checks)",
  "Support URL is live (can be a Notion page or a mailto: form)",
]);

// ---------- Section 3 ----------
h1("3. App Store Connect Configuration");

h2("Privacy Nutrition Labels");
p("Declare every data type the app collects. Be conservative — over-declaring is safe; missing a category is a rejection.");
bullet([
  "Health & Fitness → HRV, Sleep, Steps → \"Used for App Functionality\" → Linked to user → Not used for tracking",
  "Contact Info → Email → \"Used for App Functionality\" → Linked to user",
  "Identifiers → User ID → \"Used for App Functionality\" → Linked to user",
]);

h2("Categories and ratings");
bullet([
  "Age Rating: 4+ is fine if there is no user-generated content, no chat, and no ads",
  "Category: Health & Fitness (primary), Medical (secondary). Do NOT set Medical as primary — it triggers stricter review",
  "App Privacy: link to your live privacy policy URL",
]);

h2("Screenshots");
p("Required for 6.7\" iPhone, 6.5\" iPhone, and 5.5\" iPhone — you can usually generate from one device frame. Show the real app UI, not marketing mockups. Apple rejects screenshots that include other apps' UI or false claims.");

// ---------- Section 4 ----------
doc.addPage();
h1("4. Review Notes (the magic field most people skip)");
p("In App Store Connect → \"App Review Information\" → \"Notes,\" paste the text below. Customize the bracketed fields. This single field has saved more apps than any other step.");

codebox(
  [
    "NeuroQuest is a B2B enterprise wellness platform. End users are",
    "employees of customer companies (currently in pilot with Kaylee's",
    "Creatives and Bead'd) who receive a one-time invite code from",
    "their HR admin. There is no consumer signup or self-serve purchase",
    "path, which is why we use email + invite code rather than Sign in",
    "with Apple — the invite code is a first-party shared secret, not",
    "third-party social authentication.",
    "",
    "Demo credentials for review:",
    "  Work email:  appreview@neuroquestzen.pro",
    "  Invite code: [create a dedicated reviewer code on prod]",
    "",
    "HealthKit usage: We read HRV, Sleep, and Step Count once per",
    "session to compute the user's daily Neuro Resilience Score,",
    "displayed only to the user. Aggregates shared with the employer",
    "require a minimum cohort of 5 connected employees and are",
    "anonymized; no individual employee data is ever exposed.",
    "",
    "Payment model: Companies pay $50/seat/year directly to NeuroQuest",
    "via Stripe (B2B services exempt under guideline 3.1.3(b)).",
    "Employees never see a paywall in the app.",
    "",
    "Account deletion: Available in Profile tab. Deletes user record",
    "server-side and revokes all sessions.",
  ].join("\n"),
);

p("Create the reviewer account on production before you submit. Bind the invite code to a real test company with at least one piece of seeded content so the reviewer sees a working dashboard, not an empty state.");

// ---------- Section 5 ----------
h1("5. Submission Strategy");
bullet([
  "Submit to TestFlight first, not directly to the App Store. Run the build through internal testing for 24–48 hours to catch crashes you'll otherwise discover during review.",
  "Submit Mon–Wed morning Pacific time. Reviews submitted Friday afternoon or weekends sit longer.",
  "Use phased release (App Store Connect → Version Release). Rolls the update out 1% / 2% / 5% / 10% / 20% / 50% / 100% over 7 days. If a crash spikes, you halt before all users are hit.",
]);

// ---------- Section 6 ----------
h1("6. The 24-Hour Watch After Approval");
bullet([
  "Monitor crash-free rate in App Store Connect → Analytics. Target greater than 99.5%.",
  "Watch the deployment logs for HealthKit sync errors — if iOS pushes back on auth, you'll see it server-side first.",
  "Have a rollback plan: expo eas update can push a JS-only hotfix without re-review for non-native bugs.",
]);

// ---------- Section 7: Risk table ----------
doc.addPage();
h1("7. Most Common Rejection Reasons (for your app)");
p("Quick-reference table of every flagged risk category, your likelihood, and the single mitigation that prevents it.");

const tableX = doc.page.margins.left;
const tableW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const colW = [tableW * 0.42, tableW * 0.16, tableW * 0.42];

function tableHeader() {
  const y = doc.y;
  doc.fillColor(NAVY).rect(tableX, y, tableW, 22).fill();
  doc.fillColor("#FFD700").font("Helvetica-Bold").fontSize(10);
  doc.text("RISK", tableX + 8, y + 6, { width: colW[0] - 8 });
  doc.text("LIKELIHOOD", tableX + colW[0] + 8, y + 6, { width: colW[1] - 8 });
  doc.text("WHAT STOPS IT", tableX + colW[0] + colW[1] + 8, y + 6, { width: colW[2] - 8 });
  doc.y = y + 22;
}

function tableRow(risk, level, fix, alt = false) {
  const padding = 6;
  doc.font("Helvetica").fontSize(10).fillColor(SLATE);
  const heights = [
    doc.heightOfString(risk, { width: colW[0] - padding * 2 }),
    doc.heightOfString(level, { width: colW[1] - padding * 2 }),
    doc.heightOfString(fix, { width: colW[2] - padding * 2 }),
  ];
  const rowH = Math.max(...heights) + padding * 2;
  const y = doc.y;
  if (alt) {
    doc.fillColor("#faf8f1").rect(tableX, y, tableW, rowH).fill();
  }
  doc.fillColor(SLATE).font("Helvetica").fontSize(10);
  doc.text(risk, tableX + padding, y + padding, { width: colW[0] - padding * 2 });
  const levelColor = level === "High" ? RISK_HI : level === "Medium" ? RISK_MED : RISK_LO;
  doc.fillColor(levelColor).font("Helvetica-Bold").text(level, tableX + colW[0] + padding, y + padding, { width: colW[1] - padding * 2 });
  doc.fillColor(SLATE).font("Helvetica").text(fix, tableX + colW[0] + colW[1] + padding, y + padding, { width: colW[2] - padding * 2 });
  doc.y = y + rowH;
  doc.strokeColor(RULE).lineWidth(0.5).moveTo(tableX, doc.y).lineTo(tableX + tableW, doc.y).stroke();
}

tableHeader();
const rows = [
  ["Vague HealthKit usage string", "High", "Use the specific template in section 1a"],
  ["Missing account deletion", "High", "Add Profile → Delete Account"],
  ["Reviewer can't log in", "Medium", "Pre-create reviewer account on prod, paste creds in review notes"],
  ["Therapeutic claims in copy", "Medium", "Audit copy + add disclaimer footer"],
  ["expo-iap installed but unused", "Medium", "Remove the dependency or wire it to a real product"],
  ["App requires HealthKit to function", "Low", "Test the \"denied permission\" path"],
  ["Privacy policy doesn't mention HealthKit", "Low", "One-line addition to your privacy policy"],
];
rows.forEach((r, i) => tableRow(r[0], r[1], r[2], i % 2 === 1));

// ---------- footer on every page ----------
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  const footerY = doc.page.height - 36;
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
  doc.text("NeuroQuest — Apple Review Playbook", doc.page.margins.left, footerY, { width: 300 });
  doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - doc.page.margins.right - 100, footerY, { width: 100, align: "right" });
}

doc.end();

doc.on("end", () => {});
process.on("exit", () => console.log("Wrote:", OUT));
