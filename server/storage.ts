import { users, gigs, goals, allocations, type User, type InsertUser, type Gig, type InsertGig, type Goal, type InsertGoal, type Allocation, type InsertAllocation } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private gigs: Map<number, Gig>;
  private goals: Map<number, Goal>;
  private allocations: Map<number, Allocation>;
  private currentUserId: number;
  private currentGigId: number;
  private currentGoalId: number;
  private currentAllocationId: number;

  constructor() {
    this.users = new Map();
    this.gigs = new Map();
    this.goals = new Map();
    this.allocations = new Map();
    this.currentUserId = 1;
    this.currentGigId = 1;
    this.currentGoalId = 1;
    this.currentAllocationId = 1;

    // Initialize with a default user
    this.createUser({
      name: "Sarah Johnson",
      email: "sarah@example.com",
      phone: "(555) 123-4567",
      title: "Experienced Event & Brand Ambassador"
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updateData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Gigs
  async getGig(id: number): Promise<Gig | undefined> {
    return this.gigs.get(id);
  }

  async getGigsByUser(userId: number): Promise<Gig[]> {
    return Array.from(this.gigs.values()).filter(gig => gig.userId === userId);
  }

  async getGigsByDateRange(userId: number, startDate: string, endDate: string): Promise<Gig[]> {
    return Array.from(this.gigs.values()).filter(gig => 
      gig.userId === userId && 
      gig.date >= startDate && 
      gig.date <= endDate
    );
  }

  async createGig(insertGig: InsertGig): Promise<Gig> {
    const id = this.currentGigId++;
    const createdAt = new Date();
    const gig: Gig = { ...insertGig, id, createdAt };
    this.gigs.set(id, gig);
    return gig;
  }

  async updateGig(id: number, updateData: Partial<InsertGig>): Promise<Gig | undefined> {
    const gig = this.gigs.get(id);
    if (!gig) return undefined;
    
    const updatedGig = { ...gig, ...updateData };
    this.gigs.set(id, updatedGig);
    return updatedGig;
  }

  async deleteGig(id: number): Promise<boolean> {
    return this.gigs.delete(id);
  }

  // Goals
  async getGoal(id: number): Promise<Goal | undefined> {
    return this.goals.get(id);
  }

  async getGoalsByUser(userId: number): Promise<Goal[]> {
    return Array.from(this.goals.values()).filter(goal => goal.userId === userId);
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const id = this.currentGoalId++;
    const goal: Goal = { ...insertGoal, id };
    this.goals.set(id, goal);
    return goal;
  }

  async updateGoal(id: number, updateData: Partial<InsertGoal>): Promise<Goal | undefined> {
    const goal = this.goals.get(id);
    if (!goal) return undefined;
    
    const updatedGoal = { ...goal, ...updateData };
    this.goals.set(id, updatedGoal);
    return updatedGoal;
  }

  async deleteGoal(id: number): Promise<boolean> {
    return this.goals.delete(id);
  }

  // Allocations
  async getAllocation(id: number): Promise<Allocation | undefined> {
    return this.allocations.get(id);
  }

  async getAllocationsByUser(userId: number): Promise<Allocation[]> {
    return Array.from(this.allocations.values()).filter(allocation => allocation.userId === userId);
  }

  async getAllocationsByGig(gigId: number): Promise<Allocation[]> {
    return Array.from(this.allocations.values()).filter(allocation => allocation.gigId === gigId);
  }

  async getAllocationsByGoal(goalId: number): Promise<Allocation[]> {
    return Array.from(this.allocations.values()).filter(allocation => allocation.goalId === goalId);
  }

  async createAllocation(insertAllocation: InsertAllocation): Promise<Allocation> {
    const id = this.currentAllocationId++;
    const createdAt = new Date();
    const allocation: Allocation = { ...insertAllocation, id, createdAt };
    this.allocations.set(id, allocation);
    return allocation;
  }

  async deleteAllocation(id: number): Promise<boolean> {
    return this.allocations.delete(id);
  }
}

export const storage = new MemStorage();
