import { 
  users, 
  gigs, 
  goals, 
  allocations, 
  monthlyGoals,
  weeklyGoals,
  yearlyGoals,
  type User, 
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
  type InsertYearlyGoal
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;

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
  deleteAllocation(id: number): Promise<boolean>;

  // Period Goals
  getMonthlyGoal(userId: number, month: number, year: number): Promise<MonthlyGoal | undefined>;
  setMonthlyGoal(userId: number, month: number, year: number, goalAmount: string): Promise<MonthlyGoal>;
  getWeeklyGoal(userId: number, weekStartDate: string): Promise<WeeklyGoal | undefined>;
  setWeeklyGoal(userId: number, weekStartDate: string, goalAmount: string): Promise<WeeklyGoal>;
  getYearlyGoal(userId: number, year: number): Promise<YearlyGoal | undefined>;
  setYearlyGoal(userId: number, year: number, goalAmount: string): Promise<YearlyGoal>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
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

  async getGig(id: number): Promise<Gig | undefined> {
    const [gig] = await db.select().from(gigs).where(eq(gigs.id, id));
    return gig || undefined;
  }

  async getGigsByUser(userId: number): Promise<Gig[]> {
    return await db.select().from(gigs).where(eq(gigs.userId, userId));
  }

  async getGigsByDateRange(userId: number, startDate: string, endDate: string): Promise<Gig[]> {
    return await db
      .select()
      .from(gigs)
      .where(eq(gigs.userId, userId));
  }

  async createGig(insertGig: InsertGig): Promise<Gig> {
    const [gig] = await db
      .insert(gigs)
      .values(insertGig)
      .returning();
    return gig;
  }

  async updateGig(id: number, updateData: Partial<InsertGig>): Promise<Gig | undefined> {
    const [gig] = await db
      .update(gigs)
      .set(updateData)
      .where(eq(gigs.id, id))
      .returning();
    return gig || undefined;
  }

  async deleteGig(id: number): Promise<boolean> {
    const result = await db.delete(gigs).where(eq(gigs.id, id));
    return result.rowCount > 0;
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal || undefined;
  }

  async getGoalsByUser(userId: number): Promise<Goal[]> {
    return await db.select().from(goals).where(eq(goals.userId, userId));
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db
      .insert(goals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateGoal(id: number, updateData: Partial<InsertGoal>): Promise<Goal | undefined> {
    const [goal] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, id))
      .returning();
    return goal || undefined;
  }

  async deleteGoal(id: number): Promise<boolean> {
    const result = await db.delete(goals).where(eq(goals.id, id));
    return result.rowCount > 0;
  }

  async getAllocation(id: number): Promise<Allocation | undefined> {
    const [allocation] = await db.select().from(allocations).where(eq(allocations.id, id));
    return allocation || undefined;
  }

  async getAllocationsByUser(userId: number): Promise<Allocation[]> {
    return await db.select().from(allocations).where(eq(allocations.userId, userId));
  }

  async getAllocationsByGig(gigId: number): Promise<Allocation[]> {
    return await db.select().from(allocations).where(eq(allocations.gigId, gigId));
  }

  async getAllocationsByGoal(goalId: number): Promise<Allocation[]> {
    return await db.select().from(allocations).where(eq(allocations.goalId, goalId));
  }

  async createAllocation(insertAllocation: InsertAllocation): Promise<Allocation> {
    const [allocation] = await db
      .insert(allocations)
      .values(insertAllocation)
      .returning();
    return allocation;
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
}

export const storage = new DatabaseStorage();
