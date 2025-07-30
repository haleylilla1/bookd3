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

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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

      const currentPreferred = user.workPreferences?.preferredClients || [];
      if (!currentPreferred.includes(clientName.trim())) {
        const updatedPreferences = {
          ...user.workPreferences,
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

  // Gig routes
  app.get('/api/gigs', requireAuth, async (req: any, res: Response) => {
    try {
      const gigs = await storage.getGigsByUser(getUserId(req));
      res.json(gigs);
    } catch (error) {
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
      
      // Handle multi-day gigs  
      const startDate = new Date(req.body.startDate || req.body.date);
      const endDate = new Date(req.body.endDate || req.body.startDate || req.body.date);
      
      if (startDate.getTime() !== endDate.getTime()) {
        // Multi-day gig: create separate entries for each day
        const gigs = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dayGigData = {
            ...gigData,
            startDate: currentDate.toISOString().split('T')[0],
            endDate: currentDate.toISOString().split('T')[0],
            isMultiDay: true,
            multiDayGroupId: `${userId}-${startDate.getTime()}-${Math.random().toString(36).substr(2, 9)}`
          };
          
          const gig = await storage.createGig(dayGigData);
          gigs.push(gig);
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        res.status(201).json(gigs);
      } else {
        // Single day gig
        const gig = await storage.createGig(gigData);
        res.status(201).json(gig);
      }
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
      
      if (period === 'monthly') {
        const goal = await storage.setMonthlyGoal(userId, date, req.body.amount, req.body.period || 'monthly');
        res.json(goal);
      } else if (period === 'yearly') {
        const goal = await storage.setYearlyGoal(userId, date, req.body.amount, req.body.period || 'yearly');
        res.json(goal);
      } else {
        res.status(400).json({ error: 'Invalid period' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to set goal' });
    }
  });

  // Reports routes
  app.get('/api/reports/html', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { month, year, type = 'monthly' } = req.query;
      
      const { generateProfessionalHTML } = await import('./professional-html-generator');
      const reportRequest = {
        userId,
        month: parseInt(month as string),
        year: parseInt(year as string),
        type: type as string,
        period: type as string
      };
      
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
      const { month, year, type = 'monthly' } = req.query;
      
      const { generateProfessionalHTML } = await import('./professional-html-generator');
      const reportRequest = {
        userId,
        month: parseInt(month as string),
        year: parseInt(year as string),
        type: type as string,
        period: type as string
      };
      
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
      const gigs = await storage.getGigsByUser(userId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let updatedCount = 0;
      for (const gig of gigs) {
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