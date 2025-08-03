import { pgTable, text, serial, integer, boolean, date, decimal, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for persistent authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User sessions table for better session management
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sessionId: varchar("session_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
});

// Enhanced users table with multi-provider auth support
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  title: text("title").default("Gig Worker"),
  defaultTaxPercentage: integer("default_tax_percentage").default(23),
  customGigTypes: text("custom_gig_types").array().default([]),
  homeAddress: text("home_address"),
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessPhone: text("business_phone"),
  businessEmail: text("business_email"),
  
  // Multi-provider auth fields
  replitId: varchar("replit_id").unique(),
  googleId: varchar("google_id").unique(),
  passwordHash: varchar("password_hash"), // For email/password auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Account status and onboarding
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  emailVerified: boolean("email_verified").default(false),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  
  // User preferences
  notificationPreferences: jsonb("notification_preferences").default({
    email: true,
    push: true,
    reminders: true
  }),
  workPreferences: jsonb("work_preferences").default({
    primaryGigTypes: [],
    preferredClients: [],
    workingHours: { start: "09:00", end: "17:00" }
  }),
  
  // Trial and subscription tracking
  trialStartDate: timestamp("trial_start_date"),
  trialEndDate: timestamp("trial_end_date"),
  subscriptionStatus: varchar("subscription_status").default("trial"), // trial, free, premium, suspended
  subscriptionTier: varchar("subscription_tier").default("trial"), // trial, free, premium
  lastLoginAt: timestamp("last_login_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const monthlyGoals = pgTable("monthly_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  goalAmount: decimal("goal_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const weeklyGoals = pgTable("weekly_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  weekStartDate: date("week_start_date").notNull(),
  goalAmount: decimal("goal_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const yearlyGoals = pgTable("yearly_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  year: integer("year").notNull(),
  goalAmount: decimal("goal_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gigs = pgTable("gigs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  gigType: text("gig_type").notNull(),
  eventName: text("event_name").notNull().default("Event"),
  clientName: text("client_name").notNull(),
  date: date("date").notNull(),
  startDate: date("start_date").notNull(), // For multi-day support
  endDate: date("end_date"), // For multi-day support  
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
  parkingDescription: text("parking_description"),
  parkingReimbursed: boolean("parking_reimbursed").default(false),
  otherExpenses: decimal("other_expenses", { precision: 10, scale: 2 }),
  otherExpenseDescription: text("other_expense_description"),
  otherExpensesReimbursed: boolean("other_expenses_reimbursed").default(false),
  
  // "Got Paid" tax-smart fields
  totalReceived: decimal("total_received", { precision: 10, scale: 2 }),
  reimbursedParking: decimal("reimbursed_parking", { precision: 10, scale: 2 }),
  reimbursedOther: decimal("reimbursed_other", { precision: 10, scale: 2 }),
  unreimbursedParking: decimal("unreimbursed_parking", { precision: 10, scale: 2 }),
  unreimbursedOther: decimal("unreimbursed_other", { precision: 10, scale: 2 }),
  gotPaidDate: timestamp("got_paid_date"),
  
  gigAddress: text("gig_address"),
  distanceMiles: decimal("distance_miles", { precision: 8, scale: 2 }),
  travelTimeMinutes: integer("travel_time_minutes"),
  includeInResume: boolean("include_in_resume").default(true),
  // Multi-day gig support
  isMultiDay: boolean("is_multi_day").default(false),
  multiDayGroupId: text("multi_day_group_id"), // Groups multi-day gig entries together
  createdAt: timestamp("created_at").defaultNow(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  category: text("category").notNull(), // savings, rent, gear, tax, other
  name: text("name").notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0"),
  dueDate: date("due_date"),
  isCompleted: boolean("is_completed").default(false),
  goalDuration: text("goal_duration").notNull().default("monthly"), // "monthly" or "yearly"
});

// Enhanced expense tracking and budget management
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(), // Bills, Expenses, Savings, Income, Debt
  subcategories: text("subcategories").array(), // ["Rent", "Insurance", "Groceries"]
  subcategoryDefaults: jsonb("subcategory_defaults"), // {Rent: {amount: 1200, type: "constant"}, Groceries: {amount: 400, type: "variable"}}
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(), // Bills, Expenses, Savings, Income, Debt
  subcategory: text("subcategory"), // Rent, Insurance, etc.
  description: text("description"),
  isIncome: boolean("is_income").default(false),
  gigId: integer("gig_id"), // Link to gig if it's gig income
  allocations: jsonb("allocations"), // [{goalId: 1, amount: 100}, {type: "emergency", amount: 50}]
  createdAt: timestamp("created_at").defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  budgetAmount: decimal("budget_amount", { precision: 10, scale: 2 }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const allocations = pgTable("allocations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  gigId: integer("gig_id"), // Link to gig income
  goalId: integer("goal_id"), // Link to savings goal
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  allocationType: text("allocation_type").notNull(), // "goal", "savings", "emergency"
  description: text("description"),
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

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientEmail: varchar("client_email", { length: 255 }),
  clientAddress: text("client_address"),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  businessAddress: text("business_address"),
  businessEmail: varchar("business_email", { length: 255 }),
  businessPhone: varchar("business_phone", { length: 50 }),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  items: jsonb("items").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertGigSchema = createInsertSchema(gigs).omit({
  id: true,
  createdAt: true,
}).extend({
  // Make all fields optional with safe defaults
  gigType: z.string().default("Other"),
  eventName: z.string().default("Event"),
  clientName: z.string().default("Client"),
  date: z.string().default(() => new Date().toISOString().split('T')[0]),
  status: z.string().default("upcoming"),
  taxPercentage: z.number().default(23),
  mileage: z.number().default(0),
}).passthrough(); // Allow extra fields without validation errors

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

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
});

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

// Audit logging for data security and compliance
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action").notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT
  tableName: varchar("table_name"), // Which table was affected
  recordId: integer("record_id"), // ID of the affected record
  oldValues: jsonb("old_values"), // Previous values for updates/deletes
  newValues: jsonb("new_values"), // New values for creates/updates
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Database backup tracking
export const backupLogs = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  backupType: varchar("backup_type").notNull(), // daily, weekly, manual
  status: varchar("status").notNull(), // pending, completed, failed
  filePath: varchar("file_path"),
  fileSize: integer("file_size"), // in bytes
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

// User data export requests
export const dataExportRequests = pgTable("data_export_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  requestType: varchar("request_type").notNull(), // full_export, specific_data
  status: varchar("status").notNull(), // pending, processing, completed, failed
  filePath: varchar("file_path"),
  expiresAt: timestamp("expires_at"), // Export files expire after 7 days
  requestedAt: timestamp("requested_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Type definitions for new tables
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertBackupLogSchema = createInsertSchema(backupLogs).omit({
  id: true,
  startedAt: true,
});

export const insertDataExportRequestSchema = createInsertSchema(dataExportRequests).omit({
  id: true,
  requestedAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertBackupLog = z.infer<typeof insertBackupLogSchema>;
export type BackupLog = typeof backupLogs.$inferSelect;

export type InsertDataExportRequest = z.infer<typeof insertDataExportRequestSchema>;
export type DataExportRequest = typeof dataExportRequests.$inferSelect;
