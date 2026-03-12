import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull().unique(),
  neural_energy: integer("neural_energy").notNull().default(100),
  compassion_points: integer("compassion_points").notNull().default(50),
  level: integer("level").notNull().default(1),
  title: text("title").notNull().default("Seeker"),
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

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, updated_at: true });
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, created_at: true });

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
