import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGigSchema, insertGoalSchema, insertAllocationSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const currentUserId = 1; // For MVP, we'll use a single user

  // Gigs routes
  app.get("/api/gigs", async (req, res) => {
    try {
      const gigs = await storage.getGigsByUser(currentUserId);
      res.json(gigs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gigs" });
    }
  });

  app.get("/api/gigs/date-range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const gigs = await storage.getGigsByDateRange(currentUserId, startDate as string, endDate as string);
      res.json(gigs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gigs by date range" });
    }
  });

  app.post("/api/gigs", async (req, res) => {
    try {
      const gigData = insertGigSchema.parse({ ...req.body, userId: currentUserId });
      const gig = await storage.createGig(gigData);
      res.status(201).json(gig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid gig data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create gig" });
    }
  });

  app.put("/api/gigs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      const gig = await storage.updateGig(id, updateData);
      
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }
      
      res.json(gig);
    } catch (error) {
      res.status(500).json({ message: "Failed to update gig" });
    }
  });

  app.delete("/api/gigs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteGig(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Gig not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete gig" });
    }
  });

  // Goals routes
  app.get("/api/goals", async (req, res) => {
    try {
      const goals = await storage.getGoalsByUser(currentUserId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const goalData = insertGoalSchema.parse({ ...req.body, userId: currentUserId });
      const goal = await storage.createGoal(goalData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goal data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.put("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      const goal = await storage.updateGoal(id, updateData);
      
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error) {
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  // Allocations routes
  app.get("/api/allocations", async (req, res) => {
    try {
      const allocations = await storage.getAllocationsByUser(currentUserId);
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch allocations" });
    }
  });

  app.post("/api/allocations", async (req, res) => {
    try {
      const allocationData = insertAllocationSchema.parse({ ...req.body, userId: currentUserId });
      const allocation = await storage.createAllocation(allocationData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid allocation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create allocation" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const gigs = await storage.getGigsByUser(currentUserId);
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      const monthlyGigs = gigs.filter(gig => gig.date.startsWith(currentMonth));
      const completedGigs = monthlyGigs.filter(gig => gig.status === "completed");
      const upcomingGigs = gigs.filter(gig => gig.status === "upcoming");
      
      const totalEarnings = completedGigs.reduce((sum, gig) => 
        sum + (parseFloat(gig.actualPay || "0")), 0);
      const totalExpenses = completedGigs.reduce((sum, gig) => 
        sum + (parseFloat(gig.transportationExpense || "0")) + 
             (parseFloat(gig.parkingExpense || "0")) + 
             (parseFloat(gig.otherExpenses || "0")), 0);
      
      // Client leaderboard
      const clientStats = new Map<string, { gigs: number, total: number }>();
      completedGigs.forEach(gig => {
        const client = gig.clientName;
        const current = clientStats.get(client) || { gigs: 0, total: 0 };
        clientStats.set(client, {
          gigs: current.gigs + 1,
          total: current.total + parseFloat(gig.actualPay || "0")
        });
      });
      
      const topClients = Array.from(clientStats.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const avgPerGig = completedGigs.length > 0 ? totalEarnings / completedGigs.length : 0;
      const taxEstimate = totalEarnings * 0.23; // Default 23%

      res.json({
        monthlyEarnings: totalEarnings,
        completedGigs: completedGigs.length,
        upcomingGigs: upcomingGigs.length,
        avgPerGig,
        taxEstimate,
        totalExpenses,
        topClients,
        recentGigs: completedGigs.slice(-5).reverse()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // User profile
  app.get("/api/user", async (req, res) => {
    try {
      const user = await storage.getUser(currentUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
