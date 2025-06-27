import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuthRoutes, requireAuth } from "./simple-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup simple authentication
  setupAuthRoutes(app);

  // Secure helper to get user ID with validation
  const getUserId = (req: any): number => {
    const userId = req.userId;
    if (!userId || userId <= 0) {
      throw new Error("Invalid user ID");
    }
    return userId;
  };

  // User profile endpoints
  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      console.log("=== GET /api/user REQUEST RECEIVED ===");
      const userId = getUserId(req);
      console.log("User ID from auth:", userId);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("No user found for ID:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      console.log("GET /api/user - Full user object:", JSON.stringify(user, null, 2));
      console.log("GET /api/user - customGigTypes:", user.customGigTypes);
      console.log("=== SENDING RESPONSE ===");
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.put("/api/user", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { 
        name, 
        email, 
        homeAddress, 
        defaultTaxPercentage, 
        customGigTypes,
        businessName,
        businessAddress,
        businessPhone,
        businessEmail
      } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (homeAddress !== undefined) updateData.homeAddress = homeAddress;
      if (defaultTaxPercentage !== undefined) updateData.defaultTaxPercentage = defaultTaxPercentage;
      if (customGigTypes !== undefined) updateData.customGigTypes = customGigTypes;
      if (businessName !== undefined) updateData.businessName = businessName;
      if (businessAddress !== undefined) updateData.businessAddress = businessAddress;
      if (businessPhone !== undefined) updateData.businessPhone = businessPhone;
      if (businessEmail !== undefined) updateData.businessEmail = businessEmail;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Dashboard stats with user isolation
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const gigs = await storage.getGigsByUser(userId);
      
      const monthlyEarnings = gigs
        .filter(g => g.status === 'completed' && g.actualPay)
        .reduce((sum, g) => sum + parseFloat(g.actualPay || '0'), 0);
      
      res.json({ monthlyEarnings, totalTips: 0, totalExpenses: 0 });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid user ID") {
        return res.status(401).json({ message: "Authentication required" });
      }
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

  // Delete gig - CRITICAL FIX
  app.delete("/api/gigs/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const gigId = parseInt(req.params.id);
      
      // Verify ownership
      const existingGig = await storage.getGig(gigId);
      if (!existingGig || existingGig.userId !== userId) {
        return res.status(404).json({ message: "Gig not found" });
      }
      
      const success = await storage.deleteGig(gigId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete gig" });
      }
      
      res.json({ message: "Gig deleted successfully" });
    } catch (error) {
      console.error("Delete gig error:", error);
      res.status(500).json({ message: "Failed to delete gig" });
    }
  });

  // Goals endpoints with proper user isolation
  app.get("/api/goals/period", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goals = await storage.getGoalsByUser(userId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to get goals" });
    }
  });

  app.post("/api/goals/period/:period/:date", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { period, date } = req.params;
      const { goalAmount } = req.body;
      
      if (period === 'monthly') {
        const dateObj = new Date(date);
        const goal = await storage.setMonthlyGoal(userId, dateObj.getMonth() + 1, dateObj.getFullYear(), goalAmount);
        res.json(goal);
      } else if (period === 'annual') {
        const year = new Date(date).getFullYear();
        const goal = await storage.setYearlyGoal(userId, year, goalAmount);
        res.json(goal);
      } else {
        res.status(400).json({ message: "Invalid period" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to set goal" });
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

  // Expenses endpoints with user isolation
  app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const expenses = await storage.getExpensesByUser(userId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to get expenses" });
    }
  });

  app.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const expenseData = { ...req.body, userId };
      const expense = await storage.createExpense(expenseData);
      res.json(expense);
    } catch (error) {
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expenseId = parseInt(req.params.id);
      
      // Verify ownership
      const existingExpense = await storage.getExpense(expenseId);
      if (!existingExpense || existingExpense.userId !== userId) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      const success = await storage.deleteExpense(expenseId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete expense" });
      }
      
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Test auth endpoint
  app.get('/api/test-auth', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      console.log('Test auth - User ID:', userId);
      res.json({ success: true, userId, authenticated: true });
    } catch (error) {
      console.error('Test auth error:', error);
      res.status(500).json({ message: 'Auth test failed' });
    }
  });

  // PDF Report endpoints with user verification
  app.head('/api/reports/pdf', requireAuth, async (req: any, res) => {
    // HEAD request for mobile verification - just check auth and params
    try {
      const userId = getUserId(req);
      const { period, year, month } = req.query;

      if (!period || !year) {
        return res.status(400).end();
      }

      if (period === 'monthly' && !month) {
        return res.status(400).end();
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.status(200).end();
    } catch (error: any) {
      res.status(500).end();
    }
  });

  app.get('/api/reports/pdf', requireAuth, async (req: any, res) => {
    try {
      console.log('PDF request received:', { 
        query: req.query, 
        cookies: req.cookies,
        userId: req.userId,
        userAgent: req.get('User-Agent')
      });
      
      const userId = getUserId(req);
      console.log('User ID retrieved:', userId);
      
      // Verify user exists to prevent errors
      const userExists = await storage.getUser(userId);
      if (!userExists) {
        console.log('User not found in database:', userId);
        return res.status(404).json({ message: 'User not found' });
      }
      
      const { period, year, month, professional } = req.query;

      if (!period || !year) {
        console.log('Missing period or year');
        return res.status(400).json({ message: 'Period and year are required' });
      }

      if (period === 'monthly' && !month) {
        console.log('Missing month for monthly report');
        return res.status(400).json({ message: 'Month is required for monthly reports' });
      }

      // Check if professional report is requested
      if (professional === 'true') {
        const { generateProfessionalHTML } = await import('./professional-html-generator');
        
        const htmlContent = await generateProfessionalHTML({
          userId,
          period: period as 'monthly' | 'annual',
          year: parseInt(year as string),
          month: month ? parseInt(month as string) : undefined
        });

        const filename = period === 'monthly' 
          ? `professional-tax-report-${year}-${month}`
          : `professional-tax-report-${year}`;

        // Set mobile-friendly HTML headers
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        return res.send(htmlContent);
      }
      
      // Original quick report format
      const { generateHTMLPDF } = await import('./html-pdf-generator');
      
      const htmlContent = await generateHTMLPDF(
        userId,
        period as 'monthly' | 'annual',
        parseInt(year as string),
        month ? parseInt(month as string) : undefined
      );

      const filename = period === 'monthly' 
        ? `freelancer-report-${year}-${month}`
        : `freelancer-report-${year}`;

      // Set mobile-friendly HTML headers
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.send(htmlContent);
    } catch (error: any) {
      console.error('Error generating PDF report:', error);
      console.error('Error stack:', error?.stack);
      
      // Return more specific error information for debugging
      if (error instanceof Error) {
        res.status(500).json({ 
          message: 'Failed to generate PDF report',
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        res.status(500).json({ message: 'Unknown error generating PDF report' });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}