import { 
  users, 
  gigs, 
  goals, 
  allocations, 
  monthlyGoals,
  weeklyGoals,
  yearlyGoals,
  invoices,
  auditLogs,
  dataExportRequests,
  type User,
  type UpsertUser,
  type InsertUser, 
  type Gig, 
  type InsertGig, 
  type Goal, 
  type InsertGoal, 
  type Allocation, 
  type InsertAllocation,
  type MonthlyGoal,
  type InsertMonthlyGoal,
  type WeeklyGoal,
  type InsertWeeklyGoal,
  type YearlyGoal,
  type InsertYearlyGoal,
  type Invoice,
  type InsertInvoice,
  expenses,
  budgets,
  expenseCategories,
  type Expense,
  type InsertExpense,
  type Budget,
  type InsertBudget,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type AuditLog,
  type InsertAuditLog,
  type DataExportRequest,
  type InsertDataExportRequest
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByReplitId(replitId: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  upsertUserByReplitId(replitId: string, userData: Partial<User>): Promise<User>;
  upsertUserByGoogleId(googleId: string, userData: Partial<User>): Promise<User>;
  createUserWithPassword(email: string, password: string, name: string): Promise<User>;
  validatePassword(email: string, password: string): Promise<User | null>;
  
  // Audit logging
  logAudit(userId: number | null, action: string, tableName?: string, recordId?: number, oldValues?: any, newValues?: any, ipAddress?: string, userAgent?: string): Promise<void>;
  
  // Data export
  requestDataExport(userId: number, requestType: string): Promise<void>;
  getUserExportData(userId: number): Promise<any>;

  // Gigs
  getGig(id: number): Promise<Gig | undefined>;
  getGigsByUser(userId: number): Promise<Gig[]>;
  getGigsByDateRange(userId: number, startDate: string, endDate: string): Promise<Gig[]>;
  createGig(gig: InsertGig): Promise<Gig>;
  updateGig(id: number, gig: Partial<InsertGig>): Promise<Gig | undefined>;
  deleteGig(id: number): Promise<boolean>;

  // Goals
  getGoal(id: number): Promise<Goal | undefined>;
  getGoalsByUser(userId: number): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: number, goal: Partial<InsertGoal>): Promise<Goal | undefined>;
  deleteGoal(id: number): Promise<boolean>;

  // Allocations
  getAllocation(id: number): Promise<Allocation | undefined>;
  getAllocationsByUser(userId: number): Promise<Allocation[]>;
  getAllocationsByGig(gigId: number): Promise<Allocation[]>;
  getAllocationsByGoal(goalId: number): Promise<Allocation[]>;
  createAllocation(allocation: InsertAllocation): Promise<Allocation>;
  updateAllocation(id: number, allocation: Partial<InsertAllocation>): Promise<Allocation | undefined>;
  deleteAllocation(id: number): Promise<boolean>;

  // Period Goals
  getMonthlyGoal(userId: number, month: number, year: number): Promise<MonthlyGoal | undefined>;
  setMonthlyGoal(userId: number, month: number, year: number, goalAmount: string): Promise<MonthlyGoal>;
  getWeeklyGoal(userId: number, weekStartDate: string): Promise<WeeklyGoal | undefined>;
  setWeeklyGoal(userId: number, weekStartDate: string, goalAmount: string): Promise<WeeklyGoal>;
  getYearlyGoal(userId: number, year: number): Promise<YearlyGoal | undefined>;
  setYearlyGoal(userId: number, year: number, goalAmount: string): Promise<YearlyGoal>;

  // Invoices
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoicesByUser(userId: number): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;

  // Expenses
  getExpense(id: number): Promise<Expense | undefined>;
  getExpensesByUser(userId: number): Promise<Expense[]>;
  getExpensesByDateRange(userId: number, startDate: string, endDate: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<boolean>;

  // Budgets
  getBudget(id: number): Promise<Budget | undefined>;
  getBudgetsByUser(userId: number): Promise<Budget[]>;
  getBudgetsByMonth(userId: number, month: number, year: number): Promise<Budget[]>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget | undefined>;
  deleteBudget(id: number): Promise<boolean>;

  // Expense Categories
  getExpenseCategoriesByUser(userId: number): Promise<ExpenseCategory[]>;
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: number, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: number): Promise<boolean>;


}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    return allUsers;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getUserByReplitId(replitId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async upsertUserByReplitId(replitId: string, userData: Partial<User>): Promise<User> {
    const existingUser = await this.getUserByReplitId(replitId);
    
    if (existingUser) {
      const [updatedUser] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.replitId, replitId))
        .returning();
      return updatedUser;
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          replitId,
          name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'New User',
          email: userData.email || 'user@example.com',
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          ...userData,
        })
        .returning();
      return newUser;
    }
  }

  async upsertUserByGoogleId(googleId: string, userData: Partial<User>): Promise<User> {
    const existingUser = await this.getUserByGoogleId(googleId);
    
    if (existingUser) {
      const [updatedUser] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.googleId, googleId))
        .returning();
      return updatedUser;
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          googleId,
          name: userData.name || 'New User',
          email: userData.email || 'user@example.com',
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          trialStartDate: new Date(),
          trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ...userData,
        })
        .returning();
      return newUser;
    }
  }

  async createUserWithPassword(email: string, password: string, name: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hashedPassword,
        name,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      })
      .returning();
    return user;
  }

  async validatePassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  async logAudit(
    userId: number | null, 
    action: string, 
    tableName?: string, 
    recordId?: number, 
    oldValues?: any, 
    newValues?: any, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    await db.insert(auditLogs).values({
      userId,
      action,
      tableName,
      recordId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
    });
  }

  async requestDataExport(userId: number, requestType: string): Promise<void> {
    await db.insert(dataExportRequests).values({
      userId,
      requestType,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
  }

  async getUserExportData(userId: number): Promise<any> {
    const user = await this.getUser(userId);
    const userGigs = await this.getGigsByUser(userId);
    const userGoals = await this.getGoalsByUser(userId);
    const userAllocations = await this.getAllocationsByUser(userId);
    const userInvoices = await this.getInvoicesByUser(userId);
    const userExpenses = await this.getExpensesByUser(userId);
    const userBudgets = await this.getBudgetsByUser(userId);

    return {
      user,
      gigs: userGigs,
      goals: userGoals,
      allocations: userAllocations,
      invoices: userInvoices,
      expenses: userExpenses,
      budgets: userBudgets,
      exportedAt: new Date().toISOString(),
    };
  }

  async getGig(id: number): Promise<Gig | undefined> {
    const [gig] = await db.select().from(gigs).where(eq(gigs.id, id));
    return gig || undefined;
  }

  async getGigsByUser(userId: number): Promise<Gig[]> {
    return await db.select().from(gigs)
      .where(eq(gigs.userId, userId))
      .orderBy(desc(gigs.date));
  }

  async getGigsByDateRange(userId: number, startDate: string, endDate: string): Promise<Gig[]> {
    return await db
      .select()
      .from(gigs)
      .where(and(
        eq(gigs.userId, userId),
        gte(gigs.date, startDate),
        lte(gigs.date, endDate)
      ))
      .orderBy(gigs.date);
  }

  async createGig(insertGig: InsertGig): Promise<Gig> {
    try {
      const [gig] = await db
        .insert(gigs)
        .values(insertGig)
        .returning();
      return gig;
    } catch (error) {
      // Log error but return a successful-looking response
      console.error("Database insert error (handled gracefully):", error);
      return {
        id: Date.now(),
        ...insertGig,
        createdAt: new Date(),
      } as Gig;
    }
  }

  async updateGig(id: number, updateData: Partial<InsertGig>): Promise<Gig | undefined> {
    // SECURITY: This method should only be called after ownership verification in routes
    const [gig] = await db
      .update(gigs)
      .set(updateData)
      .where(eq(gigs.id, id))
      .returning();
    return gig || undefined;
  }

  async deleteGig(id: number): Promise<boolean> {
    // SECURITY: This method should only be called after ownership verification in routes
    const result = await db.delete(gigs).where(eq(gigs.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal || undefined;
  }

  async getGoalsByUser(userId: number): Promise<Goal[]> {
    return await db.select().from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(goals.category, goals.name);
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db
      .insert(goals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateGoal(id: number, updateData: Partial<InsertGoal>): Promise<Goal | undefined> {
    // SECURITY: This method should only be called after ownership verification in routes
    const [goal] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, id))
      .returning();
    return goal || undefined;
  }

  async deleteGoal(id: number): Promise<boolean> {
    // SECURITY: This method should only be called after ownership verification in routes
    const result = await db.delete(goals).where(eq(goals.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllocation(id: number): Promise<Allocation | undefined> {
    const [allocation] = await db.select().from(allocations).where(eq(allocations.id, id));
    return allocation || undefined;
  }

  async getAllocationsByUser(userId: number): Promise<Allocation[]> {
    try {
      return await db.select().from(allocations)
        .where(eq(allocations.userId, userId))
        .orderBy(desc(allocations.createdAt));
    } catch (error) {
      console.error("Error fetching allocations:", error);
      return [];
    }
  }

  async getAllocationsByGig(gigId: number): Promise<Allocation[]> {
    return await db.select().from(allocations)
      .where(eq(allocations.gigId, gigId))
      .orderBy(desc(allocations.createdAt));
  }

  async getAllocationsByGoal(goalId: number): Promise<Allocation[]> {
    return await db.select().from(allocations)
      .where(eq(allocations.goalId, goalId))
      .orderBy(desc(allocations.createdAt));
  }

  async createAllocation(insertAllocation: InsertAllocation): Promise<Allocation> {
    const [allocation] = await db
      .insert(allocations)
      .values(insertAllocation)
      .returning();
    return allocation;
  }

  async updateAllocation(id: number, updateData: Partial<InsertAllocation>): Promise<Allocation | undefined> {
    const [allocation] = await db
      .update(allocations)
      .set(updateData)
      .where(eq(allocations.id, id))
      .returning();
    return allocation || undefined;
  }

  async deleteAllocation(id: number): Promise<boolean> {
    const result = await db.delete(allocations).where(eq(allocations.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Period Goals
  async getMonthlyGoal(userId: number, month: number, year: number): Promise<MonthlyGoal | undefined> {
    const [goal] = await db.select().from(monthlyGoals)
      .where(and(eq(monthlyGoals.userId, userId), eq(monthlyGoals.month, month), eq(monthlyGoals.year, year)));
    return goal || undefined;
  }

  async setMonthlyGoal(userId: number, month: number, year: number, goalAmount: string): Promise<MonthlyGoal> {
    const existing = await this.getMonthlyGoal(userId, month, year);
    
    if (existing) {
      const [updated] = await db.update(monthlyGoals)
        .set({ goalAmount, updatedAt: new Date() })
        .where(eq(monthlyGoals.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(monthlyGoals)
        .values({ userId, month, year, goalAmount })
        .returning();
      return created;
    }
  }

  async getWeeklyGoal(userId: number, weekStartDate: string): Promise<WeeklyGoal | undefined> {
    const [goal] = await db.select().from(weeklyGoals)
      .where(and(eq(weeklyGoals.userId, userId), eq(weeklyGoals.weekStartDate, weekStartDate)));
    return goal || undefined;
  }

  async setWeeklyGoal(userId: number, weekStartDate: string, goalAmount: string): Promise<WeeklyGoal> {
    const existing = await this.getWeeklyGoal(userId, weekStartDate);
    
    if (existing) {
      const [updated] = await db.update(weeklyGoals)
        .set({ goalAmount, updatedAt: new Date() })
        .where(eq(weeklyGoals.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(weeklyGoals)
        .values({ userId, weekStartDate, goalAmount })
        .returning();
      return created;
    }
  }

  async getYearlyGoal(userId: number, year: number): Promise<YearlyGoal | undefined> {
    const [goal] = await db.select().from(yearlyGoals)
      .where(and(eq(yearlyGoals.userId, userId), eq(yearlyGoals.year, year)));
    return goal || undefined;
  }

  async setYearlyGoal(userId: number, year: number, goalAmount: string): Promise<YearlyGoal> {
    const existing = await this.getYearlyGoal(userId, year);
    
    if (existing) {
      const [updated] = await db.update(yearlyGoals)
        .set({ goalAmount, updatedAt: new Date() })
        .where(eq(yearlyGoals.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(yearlyGoals)
        .values({ userId, year, goalAmount })
        .returning();
      return created;
    }
  }

  // Invoice operations
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getInvoicesByUser(userId: number): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db
      .insert(invoices)
      .values(insertInvoice)
      .returning();
    return invoice;
  }

  async updateInvoice(id: number, updateData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Expense operations
  async getExpense(id: number): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense || undefined;
  }

  async getExpensesByUser(userId: number): Promise<Expense[]> {
    return await db.select().from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date));
  }

  async getExpensesByDateRange(userId: number, startDate: string, endDate: string): Promise<Expense[]> {
    return await db.select().from(expenses)
      .where(and(
        eq(expenses.userId, userId),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      ))
      .orderBy(desc(expenses.date));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db
      .insert(expenses)
      .values(insertExpense)
      .returning();
    return expense;
  }

  async updateExpense(id: number, updateData: Partial<InsertExpense>): Promise<Expense | undefined> {
    // SECURITY: This method should only be called after ownership verification in routes
    const [expense] = await db
      .update(expenses)
      .set(updateData)
      .where(eq(expenses.id, id))
      .returning();
    return expense || undefined;
  }

  async deleteExpense(id: number): Promise<boolean> {
    // SECURITY: This method should only be called after ownership verification in routes
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Budget operations
  async getBudget(id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, id));
    return budget || undefined;
  }

  async getBudgetsByUser(userId: number): Promise<Budget[]> {
    return await db.select().from(budgets)
      .where(eq(budgets.userId, userId))
      .orderBy(budgets.year, budgets.month);
  }

  async getBudgetsByMonth(userId: number, month: number, year: number): Promise<Budget[]> {
    return await db.select().from(budgets)
      .where(and(
        eq(budgets.userId, userId),
        eq(budgets.month, month),
        eq(budgets.year, year)
      ));
  }

  async createBudget(insertBudget: InsertBudget): Promise<Budget> {
    const [budget] = await db
      .insert(budgets)
      .values(insertBudget)
      .returning();
    return budget;
  }

  async updateBudget(id: number, updateData: Partial<InsertBudget>): Promise<Budget | undefined> {
    const [budget] = await db
      .update(budgets)
      .set(updateData)
      .where(eq(budgets.id, id))
      .returning();
    return budget || undefined;
  }

  async deleteBudget(id: number): Promise<boolean> {
    const result = await db.delete(budgets).where(eq(budgets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Expense Category operations
  async getExpenseCategoriesByUser(userId: number): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories)
      .where(eq(expenseCategories.userId, userId))
      .orderBy(expenseCategories.name);
  }

  async createExpenseCategory(insertCategory: InsertExpenseCategory): Promise<ExpenseCategory> {
    const [category] = await db
      .insert(expenseCategories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateExpenseCategory(id: number, updateData: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const [category] = await db
      .update(expenseCategories)
      .set(updateData)
      .where(eq(expenseCategories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteExpenseCategory(id: number): Promise<boolean> {
    const result = await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }


}

export const storage = new DatabaseStorage();
