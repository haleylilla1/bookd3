import { pgTable, text, serial, integer, boolean, date, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  title: text("title").default("Gig Worker"),
});

export const gigs = pgTable("gigs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  gigType: text("gig_type").notNull(),
  eventName: text("event_name").notNull().default("Event"),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  expectedPay: decimal("expected_pay", { precision: 10, scale: 2 }),
  actualPay: decimal("actual_pay", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("upcoming"), // upcoming, completed, pending_payment
  duties: text("duties"),
  taxPercentage: integer("tax_percentage").default(23),
  mileage: integer("mileage"),
  notes: text("notes"),
  transportationExpense: decimal("transportation_expense", { precision: 10, scale: 2 }),
  parkingExpense: decimal("parking_expense", { precision: 10, scale: 2 }),
  otherExpenses: decimal("other_expenses", { precision: 10, scale: 2 }),
  includeInResume: boolean("include_in_resume").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  category: text("category").notNull(), // savings, rent, gear, tax, other
  name: text("name").notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0"),
  dueDate: date("due_date"),
  isCompleted: boolean("is_completed").default(false),
});

export const allocations = pgTable("allocations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  gigId: integer("gig_id").notNull(),
  goalId: integer("goal_id"), // nullable for piggy bank allocations
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  allocationType: text("allocation_type").notNull().default("goal"), // "goal" or "piggy_bank"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGig = z.infer<typeof insertGigSchema>;
export type Gig = typeof gigs.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocations.$inferSelect;
