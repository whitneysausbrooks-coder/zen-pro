import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sponsorLeadsTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.post("/sponsor/contact", async (req, res) => {
  try {
    const { brand_name, contact_name, work_email, prize_idea, monthly_budget, tier } = req.body;
    if (!brand_name || !contact_name || !work_email || !monthly_budget) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [lead] = await db
      .insert(sponsorLeadsTable)
      .values({
        brand_name: String(brand_name),
        contact_name: String(contact_name),
        work_email: String(work_email),
        prize_idea: prize_idea ? String(prize_idea) : null,
        monthly_budget: String(monthly_budget),
        tier: tier ? String(tier) : "featured",
      })
      .returning();
    return res.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("Sponsor contact error:", err);
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/sponsor/leads", async (_req, res) => {
  const leads = await db
    .select()
    .from(sponsorLeadsTable)
    .orderBy(sponsorLeadsTable.created_at);
  res.json(leads);
});

export default router;
