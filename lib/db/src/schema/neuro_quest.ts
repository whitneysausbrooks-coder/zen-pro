import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
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
  updated_at: timestamp("updated_at").notNull().defaultNow(),
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

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, updated_at: true });
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, created_at: true });
export const insertEnterpriseLeadSchema = createInsertSchema(enterpriseLeadsTable).omit({ id: true, created_at: true });

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
export type InsertEnterpriseLead = z.infer<typeof insertEnterpriseLeadSchema>;
export type EnterpriseLead = typeof enterpriseLeadsTable.$inferSelect;
