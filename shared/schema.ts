import { pgTable, text, serial, integer, boolean, date, decimal, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Additional fields for gig tracking
  phone: text("phone"),
  title: text("title").default("Gig Worker"),
  defaultTaxPercentage: integer("default_tax_percentage").default(23),
  customGigTypes: text("custom_gig_types").array().default([]),
  homeAddress: text("home_address"),
});

export const monthlyGoals = pgTable("monthly_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  goalAmount: decimal("goal_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const weeklyGoals = pgTable("weekly_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  weekStartDate: date("week_start_date").notNull(),
  goalAmount: decimal("goal_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const yearlyGoals = pgTable("yearly_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  year: integer("year").notNull(),
  goalAmount: decimal("goal_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gigs = pgTable("gigs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  gigType: text("gig_type").notNull(),
  eventName: text("event_name").notNull().default("Event"),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  expectedPay: decimal("expected_pay", { precision: 10, scale: 2 }),
  actualPay: decimal("actual_pay", { precision: 10, scale: 2 }),
  tips: decimal("tips", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("upcoming"), // upcoming, completed, pending_payment
  duties: text("duties"),
  taxPercentage: integer("tax_percentage").default(23),
  mileage: integer("mileage"),
  notes: text("notes"),
  parkingExpense: decimal("parking_expense", { precision: 10, scale: 2 }),
  parkingReceipts: text("parking_receipts").array(),
  otherExpenses: decimal("other_expenses", { precision: 10, scale: 2 }),
  otherExpenseReceipts: text("other_expense_receipts").array(),
  gigAddress: text("gig_address"),
  distanceMiles: decimal("distance_miles", { precision: 8, scale: 2 }),
  travelTimeMinutes: integer("travel_time_minutes"),
  includeInResume: boolean("include_in_resume").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  category: text("category").notNull(), // savings, rent, gear, tax, other
  name: text("name").notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0"),
  dueDate: date("due_date"),
  isCompleted: boolean("is_completed").default(false),
  goalDuration: text("goal_duration").notNull().default("monthly"), // "monthly" or "yearly"
});

export const allocations = pgTable("allocations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  gigId: integer("gig_id").notNull(),
  goalId: integer("goal_id"), // nullable for piggy bank allocations
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  allocationType: text("allocation_type").notNull().default("goal"), // "goal" or "piggy_bank"
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyStats = pgTable("weekly_stats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  weekStartDate: date("week_start_date").notNull(), // Monday of the week
  weekEndDate: date("week_end_date").notNull(), // Sunday of the week
  actualEarnings: decimal("actual_earnings", { precision: 10, scale: 2 }).default("0"),
  projectedEarnings: decimal("projected_earnings", { precision: 10, scale: 2 }).default("0"),
  completedGigs: integer("completed_gigs").default(0),
  upcomingGigs: integer("upcoming_gigs").default(0),
  weeklyGoal: decimal("weekly_goal", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const monthlyStats = pgTable("monthly_stats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  actualEarnings: decimal("actual_earnings", { precision: 10, scale: 2 }).default("0"),
  projectedEarnings: decimal("projected_earnings", { precision: 10, scale: 2 }).default("0"),
  completedGigs: integer("completed_gigs").default(0),
  upcomingGigs: integer("upcoming_gigs").default(0),
  monthlyGoal: decimal("monthly_goal", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const yearlyStats = pgTable("yearly_stats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  year: integer("year").notNull(),
  actualEarnings: decimal("actual_earnings", { precision: 10, scale: 2 }).default("0"),
  projectedEarnings: decimal("projected_earnings", { precision: 10, scale: 2 }).default("0"),
  completedGigs: integer("completed_gigs").default(0),
  upcomingGigs: integer("upcoming_gigs").default(0),
  yearlyGoal: decimal("yearly_goal", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertGigSchema = createInsertSchema(gigs).omit({
  id: true,
  createdAt: true,
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
});

export const insertAllocationSchema = createInsertSchema(allocations).omit({
  id: true,
  createdAt: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGig = z.infer<typeof insertGigSchema>;
export type Gig = typeof gigs.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocations.$inferSelect;

export const insertWeeklyStatsSchema = createInsertSchema(weeklyStats).omit({
  id: true,
  createdAt: true,
});

export const insertMonthlyStatsSchema = createInsertSchema(monthlyStats).omit({
  id: true,
  createdAt: true,
});

export const insertYearlyStatsSchema = createInsertSchema(yearlyStats).omit({
  id: true,
  createdAt: true,
});

export type InsertWeeklyStats = z.infer<typeof insertWeeklyStatsSchema>;
export type WeeklyStats = typeof weeklyStats.$inferSelect;
export type InsertMonthlyStats = z.infer<typeof insertMonthlyStatsSchema>;
export type MonthlyStats = typeof monthlyStats.$inferSelect;
export type InsertYearlyStats = z.infer<typeof insertYearlyStatsSchema>;
export type YearlyStats = typeof yearlyStats.$inferSelect;

export const insertMonthlyGoalSchema = createInsertSchema(monthlyGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyGoalSchema = createInsertSchema(weeklyGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertYearlyGoalSchema = createInsertSchema(yearlyGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMonthlyGoal = z.infer<typeof insertMonthlyGoalSchema>;
export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type InsertWeeklyGoal = z.infer<typeof insertWeeklyGoalSchema>;
export type WeeklyGoal = typeof weeklyGoals.$inferSelect;
export type InsertYearlyGoal = z.infer<typeof insertYearlyGoalSchema>;
export type YearlyGoal = typeof yearlyGoals.$inferSelect;
