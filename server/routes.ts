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

  // Update gig
  app.put("/api/gigs/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const gigId = parseInt(req.params.id);
      
      // Verify ownership
      const existingGig = await storage.getGig(gigId);
      if (!existingGig || existingGig.userId !== userId) {
        return res.status(404).json({ message: "Gig not found" });
      }
      
      const updatedGig = await storage.updateGig(gigId, req.body);
      res.json(updatedGig);
    } catch (error) {
      res.status(500).json({ message: "Failed to update gig" });
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

  // Calculate distance with Google Maps API
  app.post("/api/calculate-distance", requireAuth, async (req, res) => {
    try {
      const { startAddress, endAddress, waypoints = [], roundTrip = false } = req.body;
      
      if (!startAddress || !endAddress) {
        return res.status(400).json({ error: "Starting and ending addresses are required" });
      }

      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Google Maps API key not configured" });
      }

      let totalDistance = 0;
      let totalTime = 0;

      // Build route: start -> waypoints -> end
      const routePoints = [startAddress.trim(), ...waypoints.filter((w: any) => w?.trim()), endAddress.trim()];
      
      // Calculate distance for each segment
      for (let i = 0; i < routePoints.length - 1; i++) {
        const origin = encodeURIComponent(routePoints[i]);
        const destination = encodeURIComponent(routePoints[i + 1]);
        
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&units=imperial&key=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
          return res.status(500).json({ error: `Google Maps API error: ${data.status}` });
        }

        const element = data.rows[0]?.elements[0];
        
        if (!element || element.status !== 'OK') {
          return res.status(500).json({ error: `Could not calculate distance between ${routePoints[i]} and ${routePoints[i + 1]}` });
        }

        // Convert meters to miles (1 meter = 0.000621371 miles)
        const segmentMiles = element.distance.value * 0.000621371;
        const segmentMinutes = element.duration.value / 60;
        
        totalDistance += segmentMiles;
        totalTime += segmentMinutes;
      }

      // Apply round trip multiplier
      if (roundTrip) {
        totalDistance *= 2;
        totalTime *= 2;
      }

      // Round up to the nearest whole number
      const distanceMiles = Math.ceil(totalDistance);
      const travelTimeMinutes = Math.round(totalTime);

      res.json({
        status: 'success',
        distanceMiles,
        travelTimeMinutes
      });
      
    } catch (error) {
      console.error("Distance calculation error:", error);
      res.status(500).json({ error: "Failed to calculate distance" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}