import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { db } from "./db";
import { users, gigs } from "@shared/schema";
import { count } from "drizzle-orm";


// Helper function to get user ID from request
function getUserId(req: any): number {
  if (!req.userId) {
    throw new Error('User not authenticated');
  }
  return req.userId;
}

// Simple rate limiting removed for production simplicity

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  const { setupAuthRoutes } = await import('./auth');
  setupAuthRoutes(app);

  app.set('trust proxy', 1);

  // Health check endpoints for UptimeRobot monitoring
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Database connectivity check
  app.get('/api/health/database', async (req, res) => {
    try {
      // Simple query to verify database connection
      const result = await db.select().from(users).limit(1);
      res.json({ 
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({ 
        status: 'error',
        database: 'disconnected',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Authentication system check
  app.get('/api/health/auth', (req, res) => {
    // Check if auth endpoints are responsive
    res.json({ 
      status: 'ok',
      auth: 'available',
      endpoints: ['login', 'register', 'reset-password'],
      timestamp: new Date().toISOString()
    });
  });

  // Core functionality check
  app.get('/api/health/core', async (req, res) => {
    try {
      // Verify core tables exist and are accessible
      const gigCheck = await db.select().from(gigs).limit(1);
      
      res.json({ 
        status: 'ok',
        core_features: {
          gigs: 'accessible',
          database_tables: 'ready',
          calculations: 'ready'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({ 
        status: 'error',
        core_features: 'degraded',
        error: 'Core functionality check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // User routes
  app.get('/api/user', requireAuth, async (req: any, res: Response) => {
    try {
      const user = await storage.getUser(getUserId(req));
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.put('/api/user', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Add client to preferred clients list
  app.post('/api/user/add-preferred-client', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { clientName } = req.body;
      
      if (!clientName || typeof clientName !== 'string') {
        return res.status(400).json({ error: 'Client name is required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const workPreferences = user.workPreferences || {};
      const currentPreferred = (workPreferences as any)?.preferredClients || [];
      if (!currentPreferred.includes(clientName.trim())) {
        const updatedPreferences = {
          ...workPreferences,
          preferredClients: [...currentPreferred, clientName.trim()]
        };
        
        await storage.updateUser(userId, { 
          workPreferences: updatedPreferences 
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error adding preferred client:', error);
      res.status(500).json({ error: 'Failed to add preferred client' });
    }
  });

  // Onboarding setup endpoint
  app.post('/api/user/setup', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { name, homeAddress, gigTypes, clientName } = req.body;
      
      // Validate required fields
      if (!name || !homeAddress || !gigTypes || !clientName) {
        return res.status(400).json({ error: 'All setup fields are required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user profile with setup data
      const workPreferences = user.workPreferences || { primaryGigTypes: [], preferredClients: [] };
      
      // Add gig types (split by comma and clean up)
      const gigTypesList = gigTypes.split(',').map((type: string) => type.trim()).filter(Boolean);
      const existingTypes = ((workPreferences as any)?.primaryGigTypes || []);
      const allTypes = [...existingTypes, ...gigTypesList];
      const updatedGigTypes = Array.from(new Set(allTypes));
      
      // Add client (avoid duplicates)
      const updatedClients = (workPreferences as any)?.preferredClients || [];
      if (!updatedClients.includes(clientName.trim())) {
        updatedClients.push(clientName.trim());
      }

      const updateData = {
        name: name.trim(),
        homeAddress: homeAddress.trim(),
        onboardingCompleted: true,
        workPreferences: {
          ...workPreferences,
          primaryGigTypes: updatedGigTypes,
          preferredClients: updatedClients
        }
      };

      await storage.updateUser(userId, updateData);
      
      res.json({ 
        message: 'Setup completed successfully',
        user: {
          name: updateData.name,
          homeAddress: updateData.homeAddress,
          onboardingCompleted: true,
          workPreferences: updateData.workPreferences
        }
      });
    } catch (error) {
      console.error('Error saving setup data:', error);
      res.status(500).json({ error: 'Failed to save setup data' });
    }
  });

  // Gig routes with pagination
  app.get('/api/gigs', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      console.log('🔍 Fetching gigs for user:', userId);
      const gigsData = await storage.getGigsByUser(userId, limit, offset);
      console.log('✅ Gigs fetched successfully:', gigsData.gigs.length, 'of', gigsData.total);
      res.json(gigsData);
    } catch (error) {
      console.error('❌ Error fetching gigs:', error);
      res.status(500).json({ error: 'Failed to fetch gigs' });
    }
  });

  app.get('/api/dashboard/optimized', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const lightweight = req.query.lightweight === 'true';
      
      if (lightweight) {
        const lightData = await storage.getLightweightDashboardData(userId);
        res.json(lightData);
      } else {
        const fullData = await storage.getDashboardData(userId);
        res.json(fullData);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  app.post('/api/gigs', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigData = { ...req.body, userId };
      
      // Create single gig entry (multi-day gigs are ONE database entry with date range)
      const gig = await storage.createGig(gigData);
      res.status(201).json(gig);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create gig' });
    }
  });

  app.put('/api/gigs/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigId = parseInt(req.params.id);
      const updateData = { ...req.body, userId };
      
      // Handle multi-day gig updates
      if (req.body.isMultiDay && req.body.multiDayGroupId) {
        // Update all gigs in the multi-day group
        const updatedGigs = await storage.updateMultiDayGigs(req.body.multiDayGroupId, updateData);
        res.json(updatedGigs);
      } else {
        const updatedGig = await storage.updateGig(gigId, updateData);
        res.json(updatedGig);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update gig' });
    }
  });

  app.delete('/api/gigs/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigId = parseInt(req.params.id);
      
      // Check if this is part of a multi-day gig
      const gig = await storage.getGig(gigId);
      if (gig && gig.isMultiDay && gig.multiDayGroupId) {
        await storage.deleteMultiDayGigs(gig.multiDayGroupId);
        res.json({ message: 'Multi-day gig deleted successfully' });
      } else {
        await storage.deleteGig(gigId);
        res.json({ message: 'Gig deleted successfully' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete gig' });
    }
  });

  // "Got Paid" endpoint for tax-smart payment processing
  app.post('/api/gigs/:id/got-paid', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigId = parseInt(req.params.id);
      const {
        totalReceived,
        parkingSpent,
        parkingReimbursed,
        otherExpenses, // Now an array of {name, amount}
        otherReimbursed,
        paymentMethod,
        taxPercentage
      } = req.body;

      // Calculate total other expenses
      const totalOtherSpent = Array.isArray(otherExpenses) 
        ? otherExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)
        : 0;

      // Validate gig ownership
      const gig = await storage.getGig(gigId);
      if (!gig || gig.userId !== userId) {
        return res.status(404).json({ error: 'Gig not found' });
      }

      // Calculate tax-smart values
      const taxableIncome = totalReceived - parkingReimbursed - otherReimbursed;
      const unreimbursedParking = Math.max(0, parkingSpent - parkingReimbursed);
      const unreimbursedOther = Math.max(0, totalOtherSpent - otherReimbursed);

      // Update gig with payment data
      const updateData = {
        status: 'completed',
        actualPay: taxableIncome.toString(),
        totalReceived: totalReceived.toString(),
        reimbursedParking: parkingReimbursed.toString(),
        reimbursedOther: otherReimbursed.toString(),
        unreimbursedParking: unreimbursedParking.toString(),
        unreimbursedOther: unreimbursedOther.toString(),
        gotPaidDate: new Date(),
        paymentMethod: paymentMethod || null,
        taxPercentage: taxPercentage || 25,
        // Update existing expense fields for backward compatibility
        parkingExpense: parkingSpent.toString(),
        otherExpenses: totalOtherSpent.toString(),
        parkingReimbursed: parkingReimbursed > 0,
        otherExpensesReimbursed: otherReimbursed > 0
      };

      const updatedGig = await storage.updateGig(gigId, updateData);
      res.json(updatedGig);
    } catch (error) {
      console.error('Error processing got paid:', error);
      res.status(500).json({ error: 'Failed to process payment' });
    }
  });

  // Goals routes
  app.get('/api/goals', requireAuth, async (req: any, res) => {
    try {
      const goals = await storage.getGoalsByUser(getUserId(req));
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch goals' });
    }
  });

  app.get('/api/goals/period', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { period, date } = req.query;
      
      if (period === 'monthly') {
        const goals = await storage.getMonthlyGoalsByUser(userId, date as string);
        res.json(goals);
      } else if (period === 'yearly') {
        const goals = await storage.getYearlyGoalsByUser(userId, date as string);
        res.json(goals);
      } else {
        res.status(400).json({ error: 'Invalid period' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch period goals' });
    }
  });

  app.post('/api/goals/period/:period/:date', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { period, date } = req.params;
      const { amount } = req.body;
      
      if (period === 'monthly') {
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        const goal = await storage.setMonthlyGoal(userId, month, year, amount);
        res.json(goal);
      } else if (period === 'yearly') {
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const goal = await storage.setYearlyGoal(userId, year, amount);
        res.json(goal);
      } else {
        res.status(400).json({ error: 'Invalid period' });
      }
    } catch (error) {
      console.error('Goal update error:', error);
      res.status(500).json({ error: 'Failed to set goal' });
    }
  });

  // Reports routes
  app.get('/api/reports/html', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { month, year, quarter, period = 'monthly' } = req.query;
      
      const { generateProfessionalHTML } = await import('./professional-html-generator');
      const reportRequest: any = {
        userId,
        year: parseInt(year as string),
        period: period as 'monthly' | 'quarterly' | 'annual'
      };
      
      if (period === 'monthly' && month) {
        reportRequest.month = parseInt(month as string);
      } else if (period === 'quarterly' && quarter) {
        reportRequest.quarter = parseInt(quarter as string);
      }
      
      const htmlContent = await generateProfessionalHTML(reportRequest);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).send(htmlContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  // PDF route (same as HTML for simplicity)
  app.get('/api/reports/pdf', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { month, year, quarter, period = 'monthly' } = req.query;
      
      const { generateProfessionalHTML } = await import('./professional-html-generator');
      const reportRequest: any = {
        userId,
        year: parseInt(year as string),
        period: period as 'monthly' | 'quarterly' | 'annual'
      };
      
      if (period === 'monthly' && month) {
        reportRequest.month = parseInt(month as string);
      } else if (period === 'quarterly' && quarter) {
        reportRequest.quarter = parseInt(quarter as string);
      }
      
      const htmlContent = await generateProfessionalHTML(reportRequest);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).send(htmlContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  // Receipt proxy route
  app.get('/api/receipt-proxy/*', async (req: any, res) => {
    try {
      const receiptPath = req.params[0];
      const { receiptStorage } = await import('./receipt-storage');
      
      const imageUrl = `https://gwywiuigckemgngpmbxf.supabase.co/storage/v1/object/public/receipts/${receiptPath}`;
      
      // Simple proxy without complex logic
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch receipt: ${response.status}`);
      }
      
      const imageBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(Buffer.from(imageBuffer));
    } catch (error) {
      res.status(404).send('Receipt not found');
    }
  });

  // Auto-update gig statuses
  app.get('/api/gigs/update-statuses', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigsData = await storage.getGigsByUser(userId, 1000); // Get all for status update
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let updatedCount = 0;
      for (const gig of gigsData.gigs) {
        const gigDate = new Date(gig.date);
        gigDate.setHours(0, 0, 0, 0);
        
        if (gig.status === 'upcoming' && gigDate < today) {
          await storage.updateGig(gig.id, { status: 'pending payment' });
          updatedCount++;
        }
      }
      
      res.json({ updatedCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update gig statuses' });
    }
  });

  // Custom gig types
  app.get('/api/gig-types', requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(getUserId(req));
      res.json(user?.customGigTypes || []);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch gig types' });
    }
  });

  // Address autocomplete endpoint using Google Places API
  app.get('/api/address-autocomplete', requireAuth, async (req: any, res: Response) => {
    try {
      const { input } = req.query;
      
      if (!input || typeof input !== 'string' || input.length < 2) {
        return res.json({ suggestions: [] });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.json({ suggestions: [] });
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=address`
      );

      if (!response.ok) {
        return res.json({ suggestions: [] });
      }

      const data = await response.json();
      
      if (data.status === 'OK' && data.predictions) {
        const suggestions = data.predictions.slice(0, 5).map((prediction: any) => ({
          description: prediction.description,
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || ''
        }));
        
        res.json({ suggestions });
      } else {
        res.json({ suggestions: [] });
      }
    } catch (error) {
      res.json({ suggestions: [] });
    }
  });

  // Distance calculation endpoint - simplified from over-engineered mileage service
  app.post('/api/calculate-distance', requireAuth, async (req: any, res: Response) => {
    try {
      const { startAddress, endAddress, roundTrip } = req.body;
      
      if (!startAddress || !endAddress) {
        return res.status(400).json({ 
          error: 'Start and end addresses are required',
          status: 'error'
        });
      }

      const { simpleMileageService } = await import('./simple-mileage');
      const result = await simpleMileageService.calculateDistance(startAddress, endAddress);
      
      if (result.success) {
        let distanceMiles = result.distance;
        if (roundTrip) {
          distanceMiles *= 2;
        }
        
        res.json({
          status: 'success',
          distanceMiles,
          travelTimeMinutes: Math.round(distanceMiles * 2.5), // Simple estimate
          fromCache: false,
          roundTrip
        });
      } else {
        res.status(400).json({
          status: 'error',
          error: result.error || 'Failed to calculate distance',
          distanceMiles: 0,
          travelTimeMinutes: 0
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: 'Distance calculation service error',
        distanceMiles: 0,
        travelTimeMinutes: 0
      });
    }
  });

  // Expense routes
  app.get('/api/expenses', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const expensesData = await storage.getExpensesByUser(userId, limit, offset);
      res.json(expensesData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  app.post('/api/expenses', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const expenseData = { ...req.body, userId };
      const expense = await storage.createExpense(expenseData);
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create expense' });
    }
  });

  app.put('/api/expenses/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const expenseId = parseInt(req.params.id);
      
      // Verify ownership
      const existingExpense = await storage.getExpense(expenseId);
      if (!existingExpense || existingExpense.userId !== userId) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      const updatedExpense = await storage.updateExpense(expenseId, req.body);
      res.json(updatedExpense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update expense' });
    }
  });

  app.delete('/api/expenses/:id', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const expenseId = parseInt(req.params.id);
      
      // Verify ownership
      const existingExpense = await storage.getExpense(expenseId);
      if (!existingExpense || existingExpense.userId !== userId) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      const success = await storage.deleteExpense(expenseId);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  });

  // Simple database health check
  app.get('/api/db-health', requireAuth, async (req: any, res: Response) => {
    try {
      const userCount = await db.select({ count: count() }).from(users);
      const gigCount = await db.select({ count: count() }).from(gigs);
      
      res.json({
        status: 'healthy',
        users: userCount[0].count,
        gigs: gigCount[0].count,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        error: 'Database check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}