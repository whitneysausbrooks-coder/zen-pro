import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { enterpriseLeadsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/enterprise/inquiry", async (req, res) => {
  const { contact_name, company, work_email, team_size, tier, message } = req.body as {
    contact_name: string;
    company: string;
    work_email: string;
    team_size: string;
    tier: string;
    message?: string;
  };

  if (!contact_name || !company || !work_email || !team_size) {
    return res.status(400).json({ error: "contact_name, company, work_email, and team_size are required" });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(work_email);
  if (!emailOk) return res.status(400).json({ error: "Invalid email address" });

  const [lead] = await db
    .insert(enterpriseLeadsTable)
    .values({ contact_name, company, work_email, team_size, tier: tier || "team", message: message || null })
    .returning();

  console.log(`New enterprise lead: ${company} (${work_email}) — ${team_size} seats — ${tier}`);

  return res.json({ success: true, id: lead.id });
});

router.get("/enterprise/leads", async (_req, res) => {
  const leads = await db
    .select()
    .from(enterpriseLeadsTable)
    .orderBy(desc(enterpriseLeadsTable.created_at))
    .limit(100);
  return res.json({ data: leads });
});

export default router;
