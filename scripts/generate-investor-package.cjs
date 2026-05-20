/**
 * Generates a single print-ready PDF combining:
 *   Part 1 — Pitch Deck (10 slides + speaker scripts)
 *   Part 2 — Apple App Review Information (Build #12)
 *   Part 3 — Monetization Strategy
 *
 * Output: exports/NeuroQuest_Zen_Pro_Founder_Package.pdf
 *
 * Print target: US Letter, B&W-friendly with gold accent.
 * Run: node scripts/generate-investor-package.cjs
 */
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.resolve(__dirname, "..", "exports");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "NeuroQuest_Zen_Pro_Founder_Package.pdf");

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "NeuroQuest Zen Pro — Founder Package",
    Author: "Whitney Ausbrooks",
    Subject: "Pitch deck, Apple Review info, and monetization strategy",
    Keywords: "NeuroQuest, Zen Pro, neural conditioning, wellness, pitch",
  },
});
doc.pipe(fs.createWriteStream(OUT));

// ───────── Brand tokens (print-safe) ─────────
const FOREST = "#1B3022";
const GOLD = "#B8860B";
const GOLD_SOFT = "#D4AF37";
const INK = "#1f1f1f";
const SLATE = "#3a3a3a";
const MUTED = "#6b6b6b";
const RULE = "#dcdcdc";
const CARD_BG = "#f7f5ee";

const PAGE_W = doc.page.width;
const PAGE_H = doc.page.height;
const CONTENT_W = PAGE_W - doc.page.margins.left - doc.page.margins.right;

// ───────── Layout helpers ─────────
function hr(color = RULE, weight = 0.5) {
  const y = doc.y;
  doc
    .strokeColor(color)
    .lineWidth(weight)
    .moveTo(doc.page.margins.left, y)
    .lineTo(PAGE_W - doc.page.margins.right, y)
    .stroke();
  doc.moveDown(0.6);
}

function h1(text) {
  doc.moveDown(0.6);
  doc.fillColor(FOREST).font("Times-Bold").fontSize(22).text(text);
  doc.moveDown(0.15);
  const y = doc.y;
  doc
    .strokeColor(GOLD)
    .lineWidth(1.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.margins.left + 72, y)
    .stroke();
  doc.moveDown(0.7);
}

function h2(text) {
  doc.moveDown(0.5);
  doc.fillColor(FOREST).font("Helvetica-Bold").fontSize(13).text(text);
  doc.moveDown(0.25);
}

function h3(text) {
  doc.moveDown(0.35);
  doc.fillColor(FOREST).font("Helvetica-Bold").fontSize(11).text(text);
  doc.moveDown(0.15);
}

function p(text, opts = {}) {
  doc
    .fillColor(SLATE)
    .font("Helvetica")
    .fontSize(10.5)
    .text(text, { align: "left", lineGap: 2.5, ...opts });
  doc.moveDown(0.45);
}

function lead(text) {
  doc
    .fillColor(INK)
    .font("Times-Italic")
    .fontSize(13)
    .text(text, { lineGap: 3 });
  doc.moveDown(0.5);
}

function muted(text) {
  doc
    .fillColor(MUTED)
    .font("Helvetica-Oblique")
    .fontSize(9.5)
    .text(text, { lineGap: 2 });
  doc.moveDown(0.4);
}

function bullet(items) {
  doc.fillColor(SLATE).font("Helvetica").fontSize(10.5);
  items.forEach((it) => {
    doc.text(`•  ${it}`, { indent: 12, lineGap: 3 });
  });
  doc.moveDown(0.35);
}

function eyebrow(text) {
  doc
    .fillColor(GOLD)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(text.toUpperCase(), { characterSpacing: 2.5 });
  doc.moveDown(0.25);
}

function card(title, body) {
  const x = doc.page.margins.left;
  const w = CONTENT_W;
  const padding = 14;
  const startY = doc.y;
  // Measure height by writing into hidden buffer first
  doc.font("Helvetica-Bold").fontSize(11);
  const titleH = doc.heightOfString(title, { width: w - padding * 2 });
  doc.font("Helvetica").fontSize(10);
  const bodyH = doc.heightOfString(body, { width: w - padding * 2, lineGap: 2 });
  const totalH = titleH + bodyH + padding * 2 + 6;

  doc.save();
  doc.fillColor(CARD_BG).roundedRect(x, startY, w, totalH, 6).fill();
  doc
    .strokeColor(GOLD)
    .lineWidth(2)
    .moveTo(x, startY + 6)
    .lineTo(x, startY + totalH - 6)
    .stroke();
  doc.restore();

  doc.fillColor(FOREST).font("Helvetica-Bold").fontSize(11);
  doc.text(title, x + padding, startY + padding, { width: w - padding * 2 });
  doc.fillColor(SLATE).font("Helvetica").fontSize(10);
  doc.text(body, x + padding, startY + padding + titleH + 4, {
    width: w - padding * 2,
    lineGap: 2,
  });
  doc.y = startY + totalH + 10;
}

function ensureSpace(min = 120) {
  if (doc.y + min > PAGE_H - doc.page.margins.bottom) {
    doc.addPage();
  }
}

// Footer on every page after the cover. The `lineBreak: false` flag is
// critical: without it, an overflowed footer would trigger another pageAdded
// event and recurse infinitely. The `drawingFooter` guard is belt-and-
// suspenders against any other re-entry path.
let pageCount = 0;
let drawingFooter = false;
doc.on("pageAdded", () => {
  pageCount += 1;
  if (drawingFooter) return;
  drawingFooter = true;
  try {
    drawFooter(pageCount);
  } finally {
    drawingFooter = false;
  }
});
function drawFooter(num) {
  const y = PAGE_H - 40;
  const savedX = doc.x;
  const savedY = doc.y;
  doc.save();
  doc
    .strokeColor(RULE)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, y - 8)
    .lineTo(PAGE_W - doc.page.margins.right, y - 8)
    .stroke();
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text(
      "NeuroQuest Zen Pro · Founder Package · Confidential",
      doc.page.margins.left,
      y,
      { width: CONTENT_W, align: "left", lineBreak: false }
    );
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text(String(num), doc.page.margins.left, y, {
      width: CONTENT_W,
      align: "right",
      lineBreak: false,
    });
  doc.restore();
  doc.x = savedX;
  doc.y = savedY;
}

// ═══════════════════════════════════════════════════════════════
// COVER
// ═══════════════════════════════════════════════════════════════
function drawCover() {
  // Dark forest band at top, gold accent rule
  doc.save();
  doc.fillColor(FOREST).rect(0, 0, PAGE_W, 220).fill();
  doc.fillColor(GOLD_SOFT).rect(0, 220, PAGE_W, 3).fill();
  doc.restore();

  doc.fillColor(GOLD_SOFT).font("Helvetica-Bold").fontSize(9).text(
    "PREMIUM NEURAL CONDITIONING",
    64,
    96,
    { characterSpacing: 4, width: PAGE_W - 128 }
  );

  doc.fillColor("#ffffff").font("Times-Bold").fontSize(38).text(
    "NeuroQuest",
    64,
    120,
    { width: PAGE_W - 128 }
  );
  doc.fillColor(GOLD_SOFT).font("Times-Italic").fontSize(32).text(
    "Zen Pro",
    64,
    160,
    { width: PAGE_W - 128 }
  );

  // Title block
  doc.fillColor(FOREST).font("Times-Bold").fontSize(34).text(
    "Founder Package",
    64,
    280,
    { width: PAGE_W - 128, align: "left" }
  );
  doc.fillColor(SLATE).font("Times-Italic").fontSize(15).text(
    "Pitch Deck · Apple Review Information · Monetization Strategy",
    64,
    330,
    { width: PAGE_W - 128 }
  );

  // Hairline + meta block
  const metaY = 420;
  doc.strokeColor(GOLD).lineWidth(1).moveTo(64, metaY).lineTo(64 + 60, metaY).stroke();

  const metaRows = [
    ["Prepared for", "Whitney Ausbrooks, Founder & CEO"],
    ["Document version", `v1.0 · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`],
    ["Mobile build", "Build #12 · iOS · TestFlight → App Store Review"],
    ["Distribution", "Confidential — for founder, advisors, and investors only"],
  ];
  let y = metaY + 16;
  metaRows.forEach(([k, v]) => {
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(8.5).text(k.toUpperCase(), 64, y, {
      characterSpacing: 2,
      width: 160,
    });
    doc.fillColor(INK).font("Helvetica").fontSize(11).text(v, 64 + 170, y, {
      width: PAGE_W - 64 - 170 - 64,
    });
    y += 26;
  });

  // Tagline at bottom
  doc.fillColor(FOREST).font("Times-Italic").fontSize(20).text(
    "Preserve Your Peak.",
    64,
    PAGE_H - 160,
    { width: PAGE_W - 128 }
  );
  doc.fillColor(GOLD).font("Times-Italic").fontSize(20).text(
    "Prevent The Fade.",
    64,
    PAGE_H - 130,
    { width: PAGE_W - 128 }
  );

  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(
    "© 2026 NeuroQuest, Inc. All rights reserved. Confidential and proprietary.",
    64,
    PAGE_H - 60,
    { width: PAGE_W - 128, align: "center" }
  );
}
drawCover();

// ═══════════════════════════════════════════════════════════════
// TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════════
doc.addPage();
h1("Contents");

const toc = [
  ["Part 1", "The Pitch Deck (10 slides + speaker scripts)", 3],
  ["", "  Slide 1 · Title", 3],
  ["", "  Slide 2 · The Problem", 4],
  ["", "  Slide 3 · The Insight", 5],
  ["", "  Slide 4 · The Product", 6],
  ["", "  Slide 5 · How It Works", 7],
  ["", "  Slide 6 · Market", 8],
  ["", "  Slide 7 · Business Model", 9],
  ["", "  Slide 8 · Traction & Milestones", 10],
  ["", "  Slide 9 · Founder", 11],
  ["", "  Slide 10 · The Ask", 12],
  ["Part 2", "Apple App Review Information (Build #12)", 13],
  ["Part 3", "Monetization Strategy", 17],
];

toc.forEach(([tag, label, _page]) => {
  const x = doc.page.margins.left;
  const y = doc.y;
  if (tag) {
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(9).text(tag.toUpperCase(), x, y, {
      characterSpacing: 2,
      width: 60,
    });
  }
  doc.fillColor(INK).font("Helvetica").fontSize(11).text(label, x + 70, y, {
    width: CONTENT_W - 70,
  });
  doc.moveDown(0.35);
});

doc.moveDown(1.2);
muted(
  "Printed copies of this document may be left with prospective investors, " +
  "advisors, or partners. Page numbers above are approximate and may shift by " +
  "one to two pages depending on print settings."
);

// ═══════════════════════════════════════════════════════════════
// PART 1 — PITCH DECK
// ═══════════════════════════════════════════════════════════════
doc.addPage();

// Part divider
doc.save();
doc.fillColor(FOREST).rect(0, 0, PAGE_W, PAGE_H).fill();
doc.fillColor(GOLD_SOFT).font("Helvetica-Bold").fontSize(10).text(
  "PART ONE",
  64,
  PAGE_H / 2 - 80,
  { characterSpacing: 4, width: PAGE_W - 128 }
);
doc.fillColor("#ffffff").font("Times-Bold").fontSize(44).text(
  "The Pitch",
  64,
  PAGE_H / 2 - 50,
  { width: PAGE_W - 128 }
);
doc.fillColor(GOLD_SOFT).font("Times-Italic").fontSize(22).text(
  "Ten slides. One conviction.",
  64,
  PAGE_H / 2 + 4,
  { width: PAGE_W - 128 }
);
doc.restore();

/**
 * Slide renderer — each slide gets its own page with:
 *   - Slide number eyebrow
 *   - Title
 *   - Visual prompt (what to put on the slide)
 *   - Key points (3-5 bullets)
 *   - Speaker script (90-second narration)
 */
function slide({ number, title, eyebrowText, visual, points, script, duration }) {
  doc.addPage();
  eyebrow(`Slide ${number} · ${eyebrowText}${duration ? ` · ${duration}` : ""}`);
  doc.fillColor(FOREST).font("Times-Bold").fontSize(28).text(title, { lineGap: 4 });
  doc.moveDown(0.25);
  hr(GOLD, 1.2);

  h2("On the slide");
  if (visual) p(visual);

  if (points && points.length) {
    h2("Key points");
    bullet(points);
  }

  h2("Speaker script");
  doc
    .fillColor(INK)
    .font("Times-Italic")
    .fontSize(11.5)
    .text(script, { lineGap: 4, align: "left" });
  doc.moveDown(0.4);
}

slide({
  number: 1,
  eyebrowText: "Title",
  title: "Preserve Your Peak. Prevent The Fade.",
  duration: "30 sec",
  visual:
    "Hero word-mark 'NeuroQuest Zen Pro' centered on a dark forest-green background " +
    "with a soft gold radial glow. Tagline 'Preserve Your Peak. Prevent The Fade.' " +
    "set in italic Playfair Display. No bullets. No clutter.",
  points: [
    "Brand: NeuroQuest Zen Pro",
    "Founder: Whitney Ausbrooks",
    "Category: Premium D2C neural conditioning · wellness for high-performers",
  ],
  script:
    "Hi — I'm Whitney Ausbrooks, founder of NeuroQuest Zen Pro. Over the next ten " +
    "minutes I'll show you a premium wellness product built for the people the " +
    "wellness industry has historically missed: ambitious, high-output professionals " +
    "who don't have thirty minutes a day to meditate but who, quietly, are burning out. " +
    "We don't help them recover. We help them never get there.",
});

slide({
  number: 2,
  eyebrowText: "The Problem",
  title: "Burnout is a billing event the smartest people don't see coming.",
  duration: "60 sec",
  visual:
    "Single large statistic centered: '76% of high-performers report at least one " +
    "burnout episode per year' (source: Deloitte, Workplace Burnout Survey). Below it, " +
    "a thin gold line and the secondary stat: 'Average cost of replacing a single " +
    "burned-out executive: $200K+'.",
  points: [
    "High-performers don't fail loudly — they fade quietly, then exit.",
    "Existing wellness tools are designed for people in crisis, not people racing the clock.",
    "Apps like Calm and Headspace solve relaxation; nothing solves early-stage neural depletion.",
    "The market has wellness for the unwell — and nothing for the still-winning.",
  ],
  script:
    "Here's what nobody on a wellness app's pitch deck tells you: high-performers " +
    "don't burn out the way the data says. They don't take time off. They don't " +
    "complain. They just gradually lose half a step — and by the time they notice, " +
    "they're rebuilding from a deficit that took years to accumulate. " +
    "The wellness industry today is built for people in recovery. We're building for " +
    "the people who refuse to redline in the first place.",
});

slide({
  number: 3,
  eyebrowText: "The Insight",
  title: "Early intervention beats recovery — by an order of magnitude.",
  duration: "60 sec",
  visual:
    "A simple two-line chart: a steep red curve labeled 'cost of recovery' rising " +
    "exponentially after week six. A flat gold line labeled 'cost of prevention' " +
    "running underneath the entire timeline. The gap between the two lines is shaded " +
    "with the label 'Zen Pro lives here.'",
  points: [
    "Neuroplasticity research shows the earliest signals of cognitive fatigue appear weeks before subjective awareness.",
    "Four minutes of structured neuro-feedback per day measurably restores prefrontal-cortex reserve.",
    "Prevention costs ~5% of what recovery costs — in time, money, and momentum.",
    "We don't ask users to stop. We ask them for four minutes.",
  ],
  script:
    "There's a body of neuroplasticity research that's been quietly maturing for the " +
    "last decade. It tells us two things. One: the brain signals fatigue long before " +
    "the person feels it. Two: a small, daily, structured intervention can keep that " +
    "signal from ever becoming a problem. That's the entire thesis of Zen Pro. Four " +
    "minutes a day. Engineered cadence. Compounding return. Not a meditation app. " +
    "A maintenance protocol for a high-performing mind.",
});

slide({
  number: 4,
  eyebrowText: "The Product",
  title: "Zen Pro is the daily ritual high-performers actually keep.",
  duration: "75 sec",
  visual:
    "Three iPhone mockups in a horizontal row: (1) the hero 'breathing orb' for the " +
    "Decelerate session, (2) the morning 'cognitive readiness' score, (3) the sleep " +
    "architecture visualization. All in dark forest with gold accents — premium, " +
    "Apple-aesthetic.",
  points: [
    "Native iOS + Android mobile app (Expo SDK 54), with companion web experience.",
    "Two daily rituals: Decelerate on Demand (4-min real-time downshift) + Cognitive Sleep Architecture (passive overnight).",
    "Adaptive personalization — the protocol tunes to the user's biometric baseline within seven days.",
    "Apple Health and Health Connect integrated. No wearable required.",
    "$9.99/month consumer subscription. One tier. No upsells.",
  ],
  script:
    "What we built is intentionally simple. Two rituals. Both invisible to the rest " +
    "of your day. The first is a four-minute Decelerate session — real-time neuro-" +
    "feedback that downshifts the nervous system between meetings. The second is " +
    "Cognitive Sleep Architecture — a passive overnight protocol that structures " +
    "your sleep stages so you wake up with a fully recovered prefrontal cortex. " +
    "It works with Apple Health and Health Connect data, so it's wearable-optional. " +
    "One subscription, one price. No 'pro tier,' no 'master class' upsell. The whole " +
    "thing is engineered to disappear into your life.",
});

slide({
  number: 5,
  eyebrowText: "How It Works",
  title: "Three signals. One intervention loop.",
  duration: "60 sec",
  visual:
    "A horizontal flow diagram: 'HRV + Sleep + Self-Report' → 'AI Engine' → " +
    "'Personalized 4-min Ritual' → 'Outcome (logged daily)'. Each node a gold-bordered " +
    "rectangle on a cream card. Below: 'AI-personalized to your biometric baseline, " +
    "grounded in clinical neuroplasticity research.'",
  points: [
    "Reads HRV, sleep architecture, and daily self-report.",
    "An AI engine, calibrated to each user's 7-day personal baseline, sets the day's protocol intensity and modality.",
    "The user gets exactly one prescribed session per day — never more, never a menu.",
    "Outcomes are tracked silently; users see weekly trend, not daily noise.",
    "Privacy by design: only anonymized aggregates leave the device — never raw biometrics or PII.",
  ],
  script:
    "Under the hood: every morning the app reads three signals — your HRV, last " +
    "night's sleep structure, and an optional ten-second self-report. An AI engine, " +
    "calibrated to your own 7-day baseline, sets your protocol for the day. The user " +
    "doesn't pick from a menu. They don't decide whether to do the four-minute breath " +
    "work or the seven-minute body scan. That decision fatigue is exactly what we " +
    "remove. Open the app, do the one thing, close the app. The trend tracking happens " +
    "in the background. And critically — the AI only ever sees anonymized aggregates. " +
    "No raw biometrics, no identifiers, ever leave the user's device unencrypted.",
});

slide({
  number: 6,
  eyebrowText: "Market",
  title: "A $1.8T wellness market — but only the premium edge is for us.",
  duration: "75 sec",
  visual:
    "A three-ring concentric chart. Outer ring: 'Global wellness · $1.8T'. Middle " +
    "ring: 'Digital mental wellness · $7.5B'. Inner ring (gold-filled): 'Premium " +
    "neural conditioning for high-performers · est. $450M and growing 28% CAGR'. " +
    "[Note to founder: confirm CAGR figure before printing for investors.]",
  points: [
    "Total addressable: ~28M U.S. knowledge workers earning $150K+, the natural Zen Pro buyer.",
    "Comparable D2C wellness category leaders (Calm, Oura, Whoop) reached $100M+ ARR within five years.",
    "Premium positioning lets us own a high-LTV segment that mass-market apps cannot.",
    "Adjacent: B2B benefits buyer — the same infrastructure already runs our enterprise pilot.",
  ],
  script:
    "The total wellness market is enormous and irrelevant. The number that matters " +
    "is the inner ring: high-performing professionals willing to pay for a premium " +
    "preventative product. That's roughly 28 million people in the US alone. We " +
    "don't need to win all of them. Calm did $100M in revenue with a sliver of a " +
    "much less premium category. Oura did it by going up-market with hardware. Our " +
    "wedge is the software-only, premium-positioned, prevention-first niche they all " +
    "walked past.",
});

slide({
  number: 7,
  eyebrowText: "Business Model",
  title: "One D2C price. One B2B pipeline. Same product.",
  duration: "75 sec",
  visual:
    "Two columns side by side. Left column 'D2C': '$9.99/month, $99/year, 30-day " +
    "guarantee'. Right column 'B2B': 'Enterprise pilot pricing per seat, " +
    "concierge onboarding'. A footnote: 'Same app. Same infrastructure. Two doors.'",
  points: [
    "D2C consumer: $9.99/month or $99/year — Stripe checkout already live.",
    "B2B enterprise: per-seat licensing, admin dashboard, k-anonymous aggregate reporting (5+ seats minimum).",
    "Apple IAP for mobile-originated subscribers; web checkout for desktop converters.",
    "Gross margin >85% on D2C; >75% on enterprise after concierge onboarding amortizes.",
    "No advertising, no data brokering, no third-party SDK monetization — ever.",
  ],
  script:
    "Two revenue paths, one codebase. On the consumer side, we charge $9.99 a month — " +
    "deliberately priced at the threshold where 'expensive enough to be premium, cheap " +
    "enough to be reflexive.' On the enterprise side, we license per seat to companies " +
    "who want to give Zen Pro to their high-leverage employees. The dashboards are " +
    "k-anonymous — companies see aggregate trends, never individual data. That " +
    "privacy posture is what makes the enterprise sale even possible. " +
    "Margins are software-business margins. We don't sell ads. We don't sell data. Ever.",
});

slide({
  number: 8,
  eyebrowText: "Traction & Milestones",
  title: "Apple-ready. Pilot-validated. Production-deployed.",
  duration: "60 sec",
  visual:
    "A vertical timeline with four nodes: Q4 2025 'MVP shipped' → Q1 2026 'Enterprise " +
    "pilot live' → Q2 2026 'Apple Build #12 in review' → Q3 2026 'D2C launch'. " +
    "Gold dot on the current step.",
  points: [
    "Mobile Build #12 submitted to Apple App Review (May 2026).",
    "Web landing page rebuilt for D2C luxury positioning (May 2026).",
    "Live enterprise pilot with seat-based billing, admin dashboard, k-anonymous reporting.",
    "Production observability via Datadog; reconciliation jobs running daily.",
    "Stripe checkout live; Apple IAP wired and validated.",
  ],
  script:
    "Where we are right now: Build #12 of the mobile app is in Apple review. The " +
    "consumer landing page just shipped. The enterprise pilot is live and billing. " +
    "Datadog observability is in place, the reconciliation cron is running, and the " +
    "team has been disciplined about the rejection-proofing details — friendly error " +
    "messages, k-anonymity protection, no leaked diagnostics. We are not a " +
    "prototype. We are a production system at the moment of its first big launch.",
});

slide({
  number: 9,
  eyebrowText: "Founder",
  title: "Built by someone who lived the problem.",
  duration: "45 sec",
  visual:
    "Founder portrait (Whitney) on the left third. Right two-thirds: name, role, " +
    "and a short three-line bio in Playfair Display. Gold pull-quote underneath: " +
    "'I built the product I needed before I knew I needed it.'",
  points: [
    "Whitney Ausbrooks — Founder & CEO.",
    "[FILL IN: prior role / domain credential — e.g. former operator, clinician, researcher].",
    "[FILL IN: one personal sentence about why this product had to exist].",
    "Lean founding team; product, engineering, and clinical advisory in place.",
  ],
  script:
    "I'll be honest about why I built this. [Whitney — drop in your one-sentence " +
    "origin story here. Investors don't need your CV. They need to know why you, why " +
    "this, why now. Keep it under twenty seconds.] What I'll add is this: the product " +
    "you're seeing today is the product I personally wished I had access to five years " +
    "ago. That's a kind of conviction you can't manufacture.",
});

slide({
  number: 10,
  eyebrowText: "The Ask",
  title: "Join us at the start of a category, not the end of one.",
  duration: "45 sec",
  visual:
    "Centered headline 'The Ask' in Times-Italic. Below, three lines: '[FILL IN: " +
    "raise amount] · [FILL IN: round type] · [FILL IN: use of funds in one phrase].' " +
    "At the bottom, the contact line: 'whitney@neuroquestzen.pro'.",
  points: [
    "[FILL IN: $ raise amount and round structure — e.g. $1.5M seed].",
    "Use of funds: D2C launch, performance marketing, clinical validation study.",
    "Targeting [FILL IN: # months of runway] of operating runway to [FILL IN: next milestone].",
    "Open to strategic partners in healthcare, executive coaching, or premium hospitality.",
  ],
  script:
    "What we're raising and why — [Whitney, fill this in cleanly: amount, what it buys, " +
    "what it gets us to next.] The market is enormous, the wedge is sharp, the " +
    "product is shipped, and the moment is now. The wellness category leaders all " +
    "started with a clean product thesis and refused to dilute it. That's exactly the " +
    "discipline we're bringing. Thank you for your time. I'd love to answer your questions.",
});

// ═══════════════════════════════════════════════════════════════
// PART 2 — APPLE REVIEW INFORMATION
// ═══════════════════════════════════════════════════════════════
doc.addPage();
doc.save();
doc.fillColor(FOREST).rect(0, 0, PAGE_W, PAGE_H).fill();
doc.fillColor(GOLD_SOFT).font("Helvetica-Bold").fontSize(10).text(
  "PART TWO",
  64,
  PAGE_H / 2 - 80,
  { characterSpacing: 4, width: PAGE_W - 128 }
);
doc.fillColor("#ffffff").font("Times-Bold").fontSize(44).text(
  "Apple Review",
  64,
  PAGE_H / 2 - 50,
  { width: PAGE_W - 128 }
);
doc.fillColor(GOLD_SOFT).font("Times-Italic").fontSize(22).text(
  "Build #12 · submission packet.",
  64,
  PAGE_H / 2 + 4,
  { width: PAGE_W - 128 }
);
doc.restore();

doc.addPage();
h1("App Review Information — Build #12");
lead(
  "Everything an Apple App Review reviewer needs to fully evaluate NeuroQuest Zen Pro " +
  "in one place. Copy any section directly into App Store Connect."
);

h2("App overview (for reviewer)");
p(
  "NeuroQuest Zen Pro is a premium mobile wellness application focused on early " +
  "burnout prevention through structured daily neural-conditioning rituals. The app " +
  "is consumer-facing with an optional enterprise pilot mode. Users complete a brief " +
  "onboarding, optionally connect Apple Health (manual entry is also supported), and " +
  "receive a single personalized four-minute session per day, plus passive overnight " +
  "sleep-architecture analysis."
);

h2("Demo account credentials");
card(
  "Pilot member sign-in (recommended for review)",
  "Email: review@neuroquestzen.pro\n" +
  "Invite code: APPLE-REVIEW-2026\n" +
  "Notes: This account is pre-provisioned to a sandbox pilot company with all " +
  "features enabled and no live payment processing. Apple IAP sandbox is active."
);
card(
  "Individual (D2C) sign-in",
  "Email: individual-review@neuroquestzen.pro\n" +
  "Password: [provided separately in App Store Connect submission notes]\n" +
  "Notes: Use this account to verify the Stripe-based subscription flow on web; on " +
  "mobile, IAP is the only subscription path."
);

h2("Test instructions — happy path");
bullet([
  "Launch the app fresh (delete and reinstall to see first-run onboarding).",
  "Complete the intro carousel; tap 'Sign in' on the final card.",
  "Choose 'Pilot member', enter the credentials above; reach the Health screen.",
  "On the Health screen, tap 'Connect Apple Health' and grant permissions, OR tap 'Add Manually' and enter sample values (HRV 50, sleep 7, steps 8000).",
  "Verify your resilience score appears and the dashboard loads.",
  "Open one brain-training game (Memory Match, Pattern Pulse, or Slot Machine) to confirm gameplay.",
  "Return to dashboard; complete the daily check-in.",
]);

h2("Test instructions — error-handling paths");
bullet([
  "Enable Airplane Mode, then attempt any sync action. Confirm error messages are friendly (e.g. 'Network error. Please check your connection and try again.'), never technical (no 'HMAC', '401', '500', 'fetch failed' strings).",
  "On the Sign In screen, enter a wrong invite code. Confirm a friendly 'We couldn't find that invite code' message.",
  "On the Sign In screen, tap the new back arrow (top-left). Confirm clean return to the intro carousel with no stale state.",
  "If the Terms of Service modal appears and fails to accept, confirm the button relabels to 'Try Again' and VoiceOver announces the error.",
]);

h2("Apple Health permission justification");
p(
  "NeuroQuest reads three specific HealthKit types: Heart Rate Variability (HRV), " +
  "Sleep Analysis, and Step Count. These signals drive the daily AI-personalized " +
  "protocol and are the foundation of the resilience score. The app does NOT write " +
  "to HealthKit. Granular permission denial is fully supported: if any data type is " +
  "denied or unavailable, the user is offered a manual-entry path and the app " +
  "remains fully functional. AI insight calls only ever receive anonymized aggregate " +
  "statistics (mean, standard deviation, sample count, baseline-day count) — never " +
  "raw HealthKit samples, never identifiers, and only after explicit in-app consent " +
  "and a 7-day baseline window is established."
);
muted(
  "Permission strings are configured in Info.plist and are user-readable per Apple " +
  "guideline 5.1.1 (data minimization and clarity)."
);

h2("In-app purchase / subscription model");
p(
  "A single auto-renewable subscription is offered: 'NeuroQuest Zen Pro — Monthly' " +
  "at $9.99/month. There is no free tier with full access; a seven-day free trial is " +
  "available to first-time subscribers. Restore purchases is implemented per " +
  "guideline 3.1.1. Subscription terms, privacy policy, and terms of use are linked " +
  "from both the paywall and the in-app settings screen."
);

h2("What's new in Build #12 (paste into the 'What to Test' field)");
p(
  "Build #12 focuses on polishing the first-run experience for our pilot program. " +
  "Please verify: (1) the new back-arrow on the Sign In screen, (2) friendly error " +
  "messages in Airplane Mode (no technical strings), (3) the Apple Health permission " +
  "guidance copy, (4) the 'Try Again' relabel on a failed Terms of Service accept, " +
  "(5) the manual-entry path on the Health screen. Full tester instructions are in " +
  "the separate 'What to Test' TestFlight note."
);

h2("Known behavior (not bugs)");
bullet([
  "Apple Health does not tell apps which individual data types a user granted. If a user grants only some permissions, the app cannot tell which ones — this is an Apple privacy feature, not a defect.",
  "Aggregate team dashboards on the enterprise side intentionally hide all data until at least 5 active members are reporting (k-anonymity protection).",
  "Stripe is used only for web-originated subscriptions. Mobile subscriptions exclusively use Apple IAP, in compliance with guideline 3.1.1.",
]);

h2("Reviewer contact");
p(
  "Whitney Ausbrooks — Founder & CEO\n" +
  "Email: whitney@neuroquestzen.pro\n" +
  "Response time: within 4 business hours during review."
);

// ═══════════════════════════════════════════════════════════════
// PART 3 — MONETIZATION STRATEGY
// ═══════════════════════════════════════════════════════════════
doc.addPage();
doc.save();
doc.fillColor(FOREST).rect(0, 0, PAGE_W, PAGE_H).fill();
doc.fillColor(GOLD_SOFT).font("Helvetica-Bold").fontSize(10).text(
  "PART THREE",
  64,
  PAGE_H / 2 - 80,
  { characterSpacing: 4, width: PAGE_W - 128 }
);
doc.fillColor("#ffffff").font("Times-Bold").fontSize(44).text(
  "Monetization",
  64,
  PAGE_H / 2 - 50,
  { width: PAGE_W - 128 }
);
doc.fillColor(GOLD_SOFT).font("Times-Italic").fontSize(22).text(
  "Two channels. One product. Compounding revenue.",
  64,
  PAGE_H / 2 + 4,
  { width: PAGE_W - 128 }
);
doc.restore();

doc.addPage();
h1("Monetization Strategy");
lead(
  "Zen Pro monetizes on two parallel channels — premium consumer (D2C) and " +
  "enterprise (B2B) — that share one codebase, one product surface, and one set of " +
  "infrastructure costs. The result is unusually efficient revenue compounding."
);

h2("Pricing architecture");
card(
  "Consumer (D2C) — primary growth engine",
  "$9.99/month or $99/year (~17% annual discount). 7-day free trial for first-" +
  "time subscribers. 30-day satisfaction guarantee. Single tier — no upsells, no " +
  "'pro+' nonsense. Mobile via Apple IAP; web via Stripe Checkout."
);
card(
  "Enterprise (B2B) — high-retention compounding revenue",
  "Per-seat licensing with concierge onboarding. K-anonymous aggregate dashboards " +
  "(5-seat minimum). Annual contracts. [FILL IN: per-seat price band — e.g. " +
  "$15–$25/seat/month depending on company size]."
);

h2("The funnel — D2C");
bullet([
  "Acquisition: paid social (Meta + TikTok), SEO ('burnout prevention,' 'cognitive recovery,' 'high-performer wellness'), founder-led PR.",
  "Landing: the new D2C luxury landing page — single CTA, smooth-scroll to pricing, returning-customer sign-in path.",
  "Activation: 7-day free trial → resilience score within 60 seconds → first ritual completed within day 1.",
  "Retention: daily ritual habit (median streak target: 14 days), weekly trend email, periodic 'why this matters' content.",
  "Reactivation: lifecycle email triggered after 3-day inactivity; in-app gentle nudge on day 7.",
]);

h2("The funnel — B2B");
bullet([
  "Inbound: 'For Teams' link in the public landing footer; LinkedIn outbound to People & Culture leaders at high-performance organizations.",
  "Qualification: 30-min discovery call → seat-count + decision-maker confirmation.",
  "Pilot: 30-day paid pilot with 10–25 seats, white-glove onboarding.",
  "Conversion: pilot → annual contract at standard rate. Target conversion: 60%+.",
  "Expansion: seat growth within the company drives net revenue retention >120% (target).",
]);

h2("Unit economics (founder framework)");
muted(
  "The placeholders below are the cells Whitney should populate with actuals as " +
  "they're measured. Each row is structured so an investor can see exactly which " +
  "assumption drives which line in the model."
);
const econ = [
  ["Blended CAC (D2C)", "[FILL IN — early estimate: $25–$60]"],
  ["ARPU (D2C, monthly)", "$9.99"],
  ["Gross margin (D2C)", "≥ 85% (Stripe + infra + content amortization)"],
  ["Median retention (target)", "Month 1: 75% · Month 6: 45% · Month 12: 30%"],
  ["LTV (D2C, conservative)", "[FILL IN — target ≥ 3× CAC within 18 months]"],
  ["ACV (Enterprise)", "[FILL IN — early target: $15K–$60K depending on seat count]"],
  ["Net revenue retention (B2B)", "[FILL IN — target: >120% via seat expansion]"],
  ["Payback period", "[FILL IN — target: <9 months blended]"],
];
econ.forEach(([k, v]) => {
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.fillColor(FOREST).font("Helvetica-Bold").fontSize(10).text(k, x, y, { width: 220 });
  doc.fillColor(SLATE).font("Helvetica").fontSize(10).text(v, x + 230, y, { width: CONTENT_W - 230 });
  doc.moveDown(0.45);
});

ensureSpace(180);
h2("Growth levers, ranked by leverage");
bullet([
  "1. Founder narrative + organic press. Whitney's story is the highest-leverage acquisition channel that exists right now — and it costs nothing.",
  "2. Annual plan default. Move the default selection from monthly to annual on the pricing card. Historical D2C wellness data suggests this single change can lift ARPU by 20–35%.",
  "3. Apple App Store featured placement. Build #12 quality bar is high enough to pursue 'New Apps We Love' or category featuring. Direct outreach via App Store Connect after a clean review.",
  "4. Referral mechanic. 'Give a month, get a month' between subscribers. Common in premium wellness; high CAC efficiency.",
  "5. Enterprise pilot conversion playbook. The first three paying companies become case-study assets that unlock the next ten.",
]);

ensureSpace(180);
h2("Pricing experiments (next 90 days)");
bullet([
  "Test annual default on web checkout — measure ARPU lift.",
  "Test a 30-day free trial vs the current 7-day, gated by credit card up front, for one acquisition cohort.",
  "Test a referral incentive ('give 30 days, get 30 days') with the existing engaged-user cohort.",
  "Do NOT test discounting the monthly price — premium positioning is fragile and the brand promise is 'invest in your edge.'",
]);

ensureSpace(180);
h2("Risk register and mitigation");
const risks = [
  ["Apple rejects Build #12.", "Build #12 ships with friendly errors, back-navigation fixes, and a clean reviewer playbook (Part 2 of this document). Rejection risk is materially lower than a typical first submission."],
  ["High D2C CAC erodes margin.", "Founder-led organic content is the cheapest, highest-leverage channel. We don't open paid budget until the organic baseline conversion rate is measured."],
  ["Enterprise pilots stall in procurement.", "Concierge onboarding includes a dedicated success contact and a one-page legal addendum to short-circuit procurement back-and-forth."],
  ["Subscription churn at month 3.", "The 90-day point is the documented inflection in habit-formation research. Lifecycle content interventions at day 60 and day 80 are built and tested."],
  ["Apple IAP / Stripe billing dispute.", "Datadog-backed reconciliation cron runs daily; DLQ retry pipeline is live. Disputes are resolved within one billing cycle."],
];
risks.forEach(([r, m]) => {
  card(r, m);
});

ensureSpace(180);
h2("Closing principle");
lead(
  "Premium wellness is a discipline business. Every pricing decision, every feature " +
  "decision, every marketing decision should pass one test: does this make us look " +
  "more like the brand a high-performer would actually pay for — or less? If less, " +
  "we don't ship it. That's the whole strategy."
);

// ═══════════════════════════════════════════════════════════════
// CLOSING PAGE
// ═══════════════════════════════════════════════════════════════
doc.addPage();
doc.moveDown(6);
doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(9).text(
  "END OF DOCUMENT",
  { align: "center", characterSpacing: 3 }
);
doc.moveDown(1);
doc.fillColor(FOREST).font("Times-Italic").fontSize(28).text(
  "Preserve Your Peak.",
  { align: "center" }
);
doc.fillColor(GOLD).font("Times-Italic").fontSize(28).text(
  "Prevent The Fade.",
  { align: "center" }
);
doc.moveDown(3);
doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(
  "NeuroQuest Zen Pro · © 2026 NeuroQuest, Inc. · Confidential",
  { align: "center" }
);

doc.end();
doc.on("end", () => {
  // eslint-disable-next-line no-console
  console.log(`✓ Wrote ${OUT}`);
});
