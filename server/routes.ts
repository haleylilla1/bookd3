import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuthRoutes, requireAuth } from "./simple-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup simple authentication
  setupAuthRoutes(app);

  // Simple helper to get user ID from request
  const getUserId = (req: any) => req.userId;

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const gigs = await storage.getGigsByUser(userId);
      
      const monthlyEarnings = gigs
        .filter(g => g.status === 'completed' && g.actualPay)
        .reduce((sum, g) => sum + parseFloat(g.actualPay || '0'), 0);
      
      res.json({ monthlyEarnings, totalTips: 0, totalExpenses: 0 });
    } catch (error) {
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Get all gigs
  app.get("/api/gigs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const gigs = await storage.getGigsByUser(userId);
      res.json(gigs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get gigs" });
    }
  });

  // Create gig
  app.post("/api/gigs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const gigData = { ...req.body, userId };
      const gig = await storage.createGig(gigData);
      res.json(gig);
    } catch (error) {
      res.status(500).json({ message: "Failed to create gig" });
    }
  });

  // Get goals
  app.get("/api/goals/period", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const goals = await storage.getGoalsByUser(userId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to get goals" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}