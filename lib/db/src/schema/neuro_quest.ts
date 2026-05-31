import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull().unique(),
  neural_energy: integer("neural_energy").notNull().default(100),
  compassion_points: integer("compassion_points").notNull().default(50),
  level: integer("level").notNull().default(1),
  title: text("title").notNull().default("Seeker"),
  stripe_customer_id: text("stripe_customer_id"),
  is_pro: boolean("is_pro").notNull().default(false),
  daily_pass_expires: timestamp("daily_pass_expires"),
  streak_count: integer("streak_count").notNull().default(0),
  last_game_date: text("last_game_date"),
  last_gratitude_date: text("last_gratitude_date"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const globalSettingsTable = pgTable("global_settings", {
  id: serial("id").primaryKey(),
  raid_mode_active: boolean("raid_mode_active").notNull().default(false),
  raid_mode_target: integer("raid_mode_target").notNull().default(100),
  raid_started_at: timestamp("raid_started_at"),
  vapid_public_key: text("vapid_public_key"),
  vapid_private_key: text("vapid_private_key"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  type: text("type").notNull(),
  activity: text("activity").notNull(),
  amount: integer("amount").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const enterpriseLeadsTable = pgTable("enterprise_leads", {
  id: serial("id").primaryKey(),
  contact_name: text("contact_name").notNull(),
  company: text("company").notNull(),
  work_email: text("work_email").notNull(),
  team_size: text("team_size").notNull(),
  tier: text("tier").notNull().default("team"),
  message: text("message"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const sponsorLeadsTable = pgTable("sponsor_leads", {
  id: serial("id").primaryKey(),
  brand_name: text("brand_name").notNull(),
  contact_name: text("contact_name").notNull(),
  work_email: text("work_email").notNull(),
  prize_idea: text("prize_idea"),
  monthly_budget: text("monthly_budget").notNull(),
  tier: text("tier").notNull().default("featured"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const taskCompletionsTable = pgTable("task_completions", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  task_id: text("task_id").notNull(),
  completion_date: text("completion_date").notNull(),
  user_response: text("user_response").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("task_completions_unique_daily").on(table.session_id, table.task_id, table.completion_date),
]);

// ---- Compassion Reels: business-funded micro-donations (every.org) ----
// One row per month tracks the HARD spending cap and how much the business has
// already committed this period. The milestone endpoint locks this row
// (SELECT ... FOR UPDATE) before accruing, so concurrent plays / bots can never
// push committed giving past `budget_cents`.
export const compassionBudgetTable = pgTable("compassion_budget", {
  id: serial("id").primaryKey(),
  period: text("period").notNull().unique(), // "YYYY-MM"
  budget_cents: integer("budget_cents").notNull(),
  accrued_cents: integer("accrued_cents").notNull().default(0),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Ledger of real, business-funded micro-donations accrued from Compassion
// Milestones. Amounts are settled to the nonprofit in batches via every.org;
// `status` walks accrued -> settling -> settled (or failed).
export const compassionDonationsTable = pgTable("compassion_donations", {
  id: serial("id").primaryKey(),
  session_id: text("session_id"),
  period: text("period").notNull(),
  amount_cents: integer("amount_cents").notNull(),
  nonprofit_slug: text("nonprofit_slug").notNull(),
  milestone_kind: text("milestone_kind").notNull().default("reels_three_match"),
  status: text("status").notNull().default("accrued"),
  batch_id: text("batch_id"),
  every_org_charge_id: text("every_org_charge_id"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  settled_at: timestamp("settled_at"),
});

export type CompassionBudget = typeof compassionBudgetTable.$inferSelect;
export type CompassionDonation = typeof compassionDonationsTable.$inferSelect;

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, updated_at: true });
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, created_at: true });
export const insertEnterpriseLeadSchema = createInsertSchema(enterpriseLeadsTable).omit({ id: true, created_at: true });

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
export type InsertEnterpriseLead = z.infer<typeof insertEnterpriseLeadSchema>;
export type EnterpriseLead = typeof enterpriseLeadsTable.$inferSelect;
