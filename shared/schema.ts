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
  
  // User preferences and notification settings
  notificationPreferences: jsonb("notification_preferences").default({
    email: true,
    push: true,
    reminders: true,
    gigReminders: true,
    paymentReminders: true,
    newOpportunities: false
  }),
  pushTokens: jsonb("push_tokens").default([]), // Store device push notification tokens
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
  
  // Emergency BA profile fields
  bio: text("bio"),
  headshotUrls: text("headshot_urls").array().default([]),
  resumeUrl: varchar("resume_url", { length: 500 }),
  w2Documents: text("w2_documents").array().default([]),
  emergencyNotifications: boolean("emergency_notifications").default(true),
  preferredCities: text("preferred_cities").array().default([]),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // AUTHENTICATION INDEXES for fast lookups
  index("idx_users_email").on(table.email), // Login queries
  index("idx_users_replit_id").on(table.replitId), // Replit auth
  index("idx_users_active").on(table.isActive), // Active users only
]);

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
}, (table) => [
  // CRITICAL SCALABILITY INDEXES for 1,000+ users with 10,000+ records each
  index("idx_gigs_user_id").on(table.userId), // Most common query: user's gigs
  index("idx_gigs_user_date").on(table.userId, table.date), // Dashboard date filtering
  index("idx_gigs_user_status").on(table.userId, table.status), // Status filtering
  index("idx_gigs_date_range").on(table.date), // Date range queries
  index("idx_gigs_user_created").on(table.userId, table.createdAt), // Pagination ordering
]);

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
}, (table) => [
  // SCALABILITY INDEXES for goals
  index("idx_goals_user_id").on(table.userId), // User's goals
  index("idx_goals_user_status").on(table.userId, table.isCompleted), // Active goals
]);

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
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format  
  amount: varchar("amount", { length: 20 }).notNull(),
  merchant: varchar("merchant", { length: 255 }),
  businessPurpose: text("business_purpose").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // Business expense category
  gigId: integer("gig_id").references(() => gigs.id), // Optional link to gig
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // SCALABILITY INDEXES for expense queries
  index("idx_expenses_user_id").on(table.userId), // User's expenses
  index("idx_expenses_user_date").on(table.userId, table.date), // Date filtering
  index("idx_expenses_user_category").on(table.userId, table.category), // Category filtering
  index("idx_expenses_gig_id").on(table.gigId), // Gig-linked expenses
]);

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

// Agencies table for posting emergency gigs
export const agencies = pgTable("agencies", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }),
  website: varchar("website", { length: 255 }),
  description: text("description"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_agencies_email").on(table.email),
]);

// Emergency BA feature tables
export const emergencyGigs = pgTable("emergency_gigs", {
  id: serial("id").primaryKey(),
  agencyId: integer("agency_id").references(() => agencies.id),
  agencyEmail: varchar("agency_email", { length: 255 }).notNull(),
  agencyName: varchar("agency_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  eventName: varchar("event_name", { length: 255 }).notNull(),
  eventDate: timestamp("event_date").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  venue: varchar("venue", { length: 255 }),
  roleDescription: text("role_description"),
  payRate: varchar("pay_rate", { length: 100 }),
  urgency: varchar("urgency", { length: 50 }).default("ASAP"),
  status: varchar("status", { length: 20 }).default("active"),
  revenuecatTransactionId: varchar("revenuecat_transaction_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  filledAt: timestamp("filled_at"),
});

export const baApplications = pgTable("ba_applications", {
  id: serial("id").primaryKey(),
  emergencyGigId: integer("emergency_gig_id").notNull().references(() => emergencyGigs.id),
  baUserId: integer("ba_user_id").notNull().references(() => users.id),
  appliedAt: timestamp("applied_at").defaultNow(),
  emailSent: boolean("email_sent").default(false),
});

export const insertAgencySchema = createInsertSchema(agencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmergencyGigSchema = createInsertSchema(emergencyGigs).omit({
  id: true,
  createdAt: true,
});

export const insertBAApplicationSchema = createInsertSchema(baApplications).omit({
  id: true,
  appliedAt: true,
});

export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type Agency = typeof agencies.$inferSelect;
export type InsertEmergencyGig = z.infer<typeof insertEmergencyGigSchema>;
export type EmergencyGig = typeof emergencyGigs.$inferSelect;
export type InsertBAApplication = z.infer<typeof insertBAApplicationSchema>;
export type BAApplication = typeof baApplications.$inferSelect;

// Business expense categories for tax deductions
export const BUSINESS_EXPENSE_CATEGORIES = [
  "Promo & Marketing",
  "Car (besides mileage)", 
  "Platform or Payment Fees",
  "Hired Help",
  "Big Gear or Equipment",
  "Insurance (other than health)",
  "Legal and Professional Services",
  "Office Expenses", 
  "Rent or Lease (equipment or business property)",
  "Gear Repairs and Maintenance",
  "Supplies",
  "Work Travel",
  "Work Meals (50% deductible)",
  "Utilities",
  "Appearance / Wardrobe (for performers/models)",
  "Other Expenses"
] as const;

// Smart category suggestions to reduce decision fatigue
export const FREQUENTLY_USED_CATEGORIES = [
  "Work Travel", 
  "Big Gear or Equipment",
  "Car (besides mileage)",
  "Work Meals (50% deductible)",
  "Supplies"
] as const;

// Category suggestions based on merchant/purpose keywords
export const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  // Transportation & Travel
  "uber": ["Work Travel", "Car (besides mileage)"],
  "lyft": ["Work Travel", "Car (besides mileage)"], 
  "gas": ["Car (besides mileage)", "Work Travel"],
  "fuel": ["Car (besides mileage)", "Work Travel"],
  "parking": ["Work Travel", "Car (besides mileage)"],
  "toll": ["Work Travel", "Car (besides mileage)"],
  "hotel": ["Work Travel"],
  "airbnb": ["Work Travel"],
  "flight": ["Work Travel"],
  "airline": ["Work Travel"],
  
  // Equipment & Gear
  "camera": ["Big Gear or Equipment"],
  "lens": ["Big Gear or Equipment"],
  "tripod": ["Big Gear or Equipment"],
  "microphone": ["Big Gear or Equipment"],
  "lighting": ["Big Gear or Equipment"],
  "backdrop": ["Big Gear or Equipment"],
  "costume": ["Appearance / Wardrobe (for performers/models)"],
  "makeup": ["Appearance / Wardrobe (for performers/models)"],
  "props": ["Big Gear or Equipment"],
  "amazon": ["Big Gear or Equipment", "Supplies"],
  "best buy": ["Big Gear or Equipment"],
  
  // Food & Entertainment
  "restaurant": ["Work Meals (50% deductible)"],
  "coffee": ["Work Meals (50% deductible)"],
  "starbucks": ["Work Meals (50% deductible)"],
  "lunch": ["Work Meals (50% deductible)"],
  "dinner": ["Work Meals (50% deductible)"],
  "catering": ["Work Meals (50% deductible)"],
  
  // Communications & Office
  "phone": ["Office Expenses"],
  "internet": ["Office Expenses", "Utilities"],
  "verizon": ["Office Expenses"],
  "at&t": ["Office Expenses"],
  "t-mobile": ["Office Expenses"],
  "office depot": ["Office Expenses"],
  "staples": ["Office Expenses"],
  "supplies": ["Supplies"],
  "paper": ["Office Expenses"],
  "ink": ["Office Expenses"],
  "printer": ["Big Gear or Equipment", "Office Expenses"],
  
  // Professional Services
  "lawyer": ["Legal and Professional Services"],
  "attorney": ["Legal and Professional Services"],
  "accountant": ["Legal and Professional Services"],
  "insurance": ["Insurance (other than health)"],
  "coach": ["Legal and Professional Services"],
  "training": ["Legal and Professional Services"],
  "course": ["Legal and Professional Services"],
  "workshop": ["Legal and Professional Services"],
  
  // Marketing & Promotion
  "facebook": ["Promo & Marketing"],
  "instagram": ["Promo & Marketing"],
  "google ads": ["Promo & Marketing"],
  "advertising": ["Promo & Marketing"],
  "marketing": ["Promo & Marketing"],
  "website": ["Promo & Marketing"],
  "business cards": ["Promo & Marketing"],
  
  // Platform & Fees
  "paypal": ["Platform or Payment Fees"],
  "stripe": ["Platform or Payment Fees"],
  "square": ["Platform or Payment Fees"],
  "venmo": ["Platform or Payment Fees"],
  "fee": ["Platform or Payment Fees"],
  "commission": ["Platform or Payment Fees"]
};

// Get smart category suggestions based on merchant and purpose
export const getCategorySuggestions = (merchant?: string, purpose?: string): string[] => {
  const suggestions = new Set<string>();
  
  // Check merchant name for keywords
  if (merchant) {
    const merchantLower = merchant.toLowerCase();
    Object.entries(CATEGORY_SUGGESTIONS).forEach(([keyword, categories]) => {
      if (merchantLower.includes(keyword)) {
        categories.forEach(cat => suggestions.add(cat));
      }
    });
  }
  
  // Check purpose for keywords
  if (purpose) {
    const purposeLower = purpose.toLowerCase();
    Object.entries(CATEGORY_SUGGESTIONS).forEach(([keyword, categories]) => {
      if (purposeLower.includes(keyword)) {
        categories.forEach(cat => suggestions.add(cat));
      }
    });
  }
  
  return Array.from(suggestions);
};

// Zod schemas for validation
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
});



export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
});

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

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
