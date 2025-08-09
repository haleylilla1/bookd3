import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { db } from "./db";
import { users, gigs } from "@shared/schema";
import { count } from "drizzle-orm";
import RevenueCatService from './revenuecat';
import { 
  generalRateLimit, 
  authRateLimit, 
  exportRateLimit,
  setSecurityHeaders,
  sanitizeRequestBody,
  sanitizeQueryParams,
  validateRequestBody,
  validateQueryParams,
  validateRequestSize,
  secureErrorHandler,
  commonSchemas
} from "./security";
import { userValidation, gigValidation, expenseValidation, goalValidation, sanitizeText, sanitizeNumber, sanitizeAddress } from "@shared/validation";
import { z } from 'zod';


// Helper function to get user ID from request
function getUserId(req: any): number {
  if (!req.userId) {
    throw new Error('User not authenticated');
  }
  return req.userId;
}

// Simple rate limiting removed for production simplicity

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware first
  app.use(setSecurityHeaders);
  app.use(generalRateLimit);
  app.use(sanitizeRequestBody);
  app.use(sanitizeQueryParams);
  app.use(validateRequestSize(500)); // 500KB limit for most requests

  // Setup authentication routes with stricter rate limiting
  const { setupAuthRoutes } = await import('./auth');
  setupAuthRoutes(app);

  app.set('trust proxy', 1);

  // RevenueCat subscription endpoints
  app.get('/api/subscription/status', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get subscription status from RevenueCat
      const status = await RevenueCatService.getSubscriptionStatus(user.id.toString());
      
      res.json({
        hasActiveSubscription: status.hasActiveSubscription,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        expiresAt: user.subscriptionExpiresAt,
        revenueCatData: status
      });
    } catch (error: any) {
      console.error('❌ Subscription status check failed:', error);
      res.status(500).json({ error: 'Failed to check subscription status' });
    }
  });

  app.post('/api/subscription/setup', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Create or get RevenueCat customer
      const revenueCatCustomer = await RevenueCatService.createCustomer(
        user.id.toString(),
        user.email,
        {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          signupDate: user.createdAt
        }
      );

      // Update user with RevenueCat customer ID
      await storage.updateUser(userId, {
        revenuecatCustomerId: user.id.toString()
      });

      res.json({
        success: true,
        customerId: user.id.toString(),
        message: 'RevenueCat customer setup complete'
      });
    } catch (error: any) {
      console.error('❌ RevenueCat setup failed:', error);
      res.status(500).json({ error: 'Failed to setup subscription' });
    }
  });

  app.post('/api/subscription/update', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { tier, status, expiresAt } = req.body;
      
      if (!tier || !status) {
        return res.status(400).json({ error: 'Tier and status are required' });
      }

      // Update user subscription in database
      await storage.updateUser(userId, {
        subscriptionTier: tier,
        subscriptionStatus: status,
        subscriptionExpiresAt: expiresAt ? new Date(expiresAt) : null
      });

      // Track subscription change in RevenueCat
      await RevenueCatService.updateCustomerAttributes(userId.toString(), {
        subscription_tier: tier,
        subscription_status: status,
        subscription_updated: new Date().toISOString()
      });

      res.json({ success: true, message: 'Subscription updated successfully' });
    } catch (error: any) {
      console.error('❌ Subscription update failed:', error);
      res.status(500).json({ error: 'Failed to update subscription' });
    }
  });

  // Support contact endpoint
  app.post('/api/support/contact', requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { subject, category, message, urgency } = req.body;
      
      // Validate required fields
      if (!subject || !category || !message) {
        return res.status(400).json({ error: 'Subject, category, and message are required' });
      }

      // Get user details for context
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Track support request in Klaviyo
      const { KlaviyoService } = await import('./klaviyo');
      const success = await KlaviyoService.trackSupportRequest(user.email, {
        subject: subject.trim(),
        category,
        urgency: urgency || 'medium'
      });

      // Also send email notification to admin (you)
      try {
        const sgMail = await import('@sendgrid/mail');
        if (process.env.SENDGRID_API_KEY) {
          sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
          
          const emailContent = `
            <h2>Support Request - Bookd App</h2>
            <p><strong>From:</strong> ${user.name} (${user.email})</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Urgency:</strong> ${urgency}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${message}</div>
          `;

          await sgMail.default.send({
            to: 'haleylilla@gmail.com',
            from: 'haleylilla@gmail.com',
            replyTo: user.email,
            subject: `Support: ${subject} - ${user.name}`,
            html: emailContent,
          });
        }
      } catch (error) {
        console.log('Note: Failed to send admin notification email');
      }

      res.json({ message: 'Support request sent successfully' });
    } catch (error) {
      console.error('Support contact error:', error);
      res.status(500).json({ error: 'Failed to process support request' });
    }
  });

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

  app.put('/api/user', requireAuth, 
    validateRequestBody(z.object({
      name: userValidation.name.optional(),
      email: userValidation.email.optional(),
      phone: userValidation.phone.optional(),
      homeAddress: userValidation.homeAddress.optional(),
      businessName: userValidation.businessName.optional(),
      businessAddress: userValidation.businessAddress.optional(),
      businessPhone: userValidation.businessPhone.optional(),
      businessEmail: userValidation.businessEmail.optional(),
      defaultTaxPercentage: userValidation.defaultTaxPercentage.optional(),
      customGigTypes: z.array(z.string().transform(sanitizeText)).optional(),
      workPreferences: z.object({
        gigTypes: z.array(z.string().transform(sanitizeText)).optional(),
        preferredClients: z.array(z.string().transform(sanitizeText)).optional()
      }).optional()
    })),
    async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Update notification preferences
  app.post('/api/user/notification-preferences', requireAuth,
    validateRequestBody(z.object({
      notificationPreferences: z.object({
        email: z.boolean(),
        push: z.boolean(),
        reminders: z.boolean(),
        gigReminders: z.boolean(),
        paymentReminders: z.boolean(),
        newOpportunities: z.boolean()
      })
    })),
    async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { notificationPreferences } = req.body;
      
      const updatedUser = await storage.updateUser(userId, { 
        notificationPreferences 
      });
      
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  });

  // Add client to preferred clients list
  app.post('/api/user/add-preferred-client', requireAuth,
    validateRequestBody(z.object({
      clientName: z.string()
        .min(1, 'Client name is required')
        .max(200, 'Client name must be less than 200 characters')
        .transform(sanitizeText)
    })),
    async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { clientName } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const workPreferences = user.workPreferences || {};
      const currentPreferred = (workPreferences as any)?.preferredClients || [];
      if (!currentPreferred.includes(clientName)) {
        const updatedPreferences = {
          ...workPreferences,
          preferredClients: [...currentPreferred, clientName]
        };
        
        await storage.updateUser(userId, { 
          workPreferences: updatedPreferences 
        });
      }

      res.json({ success: true });
    } catch (error) {
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
      const workPreferences = user.workPreferences || { preferredClients: [] };
      
      // Add single gig type to customGigTypes (consistent with profile page)
      const gigType = gigTypes.trim();
      const existingTypes = user.customGigTypes || [];
      const updatedGigTypes = existingTypes.includes(gigType) 
        ? existingTypes 
        : [...existingTypes, gigType];
      
      // Add client (avoid duplicates)
      const updatedClients = (workPreferences as any)?.preferredClients || [];
      if (!updatedClients.includes(clientName.trim())) {
        updatedClients.push(clientName.trim());
      }

      const updateData = {
        name: name.trim(),
        homeAddress: homeAddress.trim(),
        onboardingCompleted: true,
        customGigTypes: updatedGigTypes,  // Save to customGigTypes field
        workPreferences: {
          ...workPreferences,
          preferredClients: updatedClients
        }
      };

      await storage.updateUser(userId, updateData);
      
      // Track onboarding completion in Klaviyo
      try {
        const { KlaviyoService } = await import('./klaviyo');
        await KlaviyoService.trackOnboardingCompleted(user.email, {
          homeAddress: updateData.homeAddress,
          gigTypes: updatedGigTypes,
          preferredClients: updatedClients
        });
      } catch (error) {
        console.log('Note: Failed to track onboarding in Klaviyo');
      }
      
      res.json({ 
        message: 'Setup completed successfully',
        user: {
          name: updateData.name,
          homeAddress: updateData.homeAddress,
          onboardingCompleted: true,
          customGigTypes: updateData.customGigTypes,
          workPreferences: updateData.workPreferences
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save setup data' });
    }
  });

  // Gig routes with pagination
  app.get('/api/gigs', requireAuth,
    validateQueryParams(z.object({
      limit: z.coerce.number().min(1).max(1000).default(50),
      offset: z.coerce.number().min(0).default(0),
      status: z.string().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    })),
    async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { limit, offset } = req.query;
      
      const gigsData = await storage.getGigsByUser(userId, limit, offset);
      res.json(gigsData);
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

  app.post('/api/gigs', requireAuth,
    validateRequestBody(z.object({
      // Core gig fields that match InsertGig schema
      gigType: z.string().min(1, "Gig type is required"),
      eventName: z.string().min(1, "Event name is required"),
      clientName: z.string().min(1, "Client name is required"),
      date: z.string().min(1, "Date is required"),
      startDate: z.string().min(1, "Start date is required"),
      endDate: z.string().optional(),
      expectedPay: z.string().min(1, "Expected pay is required"),
      actualPay: z.string().default("0"),
      tips: z.string().default("0"),
      paymentMethod: z.string().default("Cash"),
      status: z.enum(["upcoming", "pending payment", "completed"]).default("upcoming"),
      duties: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      taxPercentage: z.number().default(23),
      mileage: z.number().default(0),
      parkingExpense: z.string().default("0"),
      parkingDescription: z.string().optional().nullable(),
      parkingReimbursed: z.boolean().default(false),
      otherExpenses: z.string().default("0"),
      otherExpenseDescription: z.string().optional().nullable(),
      otherExpensesReimbursed: z.boolean().default(false),
      totalReceived: z.string().default("0"),
      reimbursedParking: z.string().default("0"),
      reimbursedOther: z.string().default("0"),
      unreimbursedParking: z.string().default("0"),
      unreimbursedOther: z.string().default("0"),
      gotPaidDate: z.string().optional().nullable(),
      // Multi-day gig fields
      isMultiDay: z.boolean().optional(),
      multiDayGroupId: z.string().optional().nullable()
    })),
    async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigData = { ...req.body, userId };
      
      // Create single gig entry (multi-day gigs are ONE database entry with date range)
      const gig = await storage.createGig(gigData);
      
      // Track gig creation in Klaviyo
      try {
        const user = await storage.getUser(userId);
        if (user) {
          const { KlaviyoService } = await import('./klaviyo');
          await KlaviyoService.trackGigCreated(user.email, {
            eventName: gig.eventName,
            expectedPay: parseFloat((gig.expectedPay || 0).toString()),
            gigType: gig.gigType || 'General',
            date: new Date(gig.date).toISOString()
          });
        }
      } catch (error) {
        console.log('Note: Failed to track gig creation in Klaviyo');
      }
      
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
  app.post('/api/gigs/:id/got-paid', requireAuth,
    validateRequestBody(z.object({
      totalReceived: z.union([z.string(), z.number()])
        .transform(val => sanitizeNumber(val, 0))
        .refine(val => val > 0, 'Total received must be greater than 0'),
      parkingSpent: z.union([z.string(), z.number()])
        .transform(val => sanitizeNumber(val, 0))
        .refine(val => val >= 0, 'Parking spent cannot be negative'),
      parkingReimbursed: z.union([z.string(), z.number()])
        .transform(val => sanitizeNumber(val, 0))
        .refine(val => val >= 0, 'Parking reimbursed cannot be negative'),
      otherExpenses: z.array(z.object({
        name: z.string().transform(sanitizeText).refine(val => val.length > 0, 'Expense name required'),
        amount: z.union([z.string(), z.number()]).transform(val => sanitizeNumber(val, 0))
      })).optional().default([]),
      otherReimbursed: z.union([z.string(), z.number()])
        .transform(val => sanitizeNumber(val, 0))
        .refine(val => val >= 0, 'Other reimbursed cannot be negative'),
      mileage: z.union([z.string(), z.number()])
        .transform(val => sanitizeNumber(val, 0))
        .refine(val => val >= 0, 'Mileage cannot be negative'),
      paymentMethod: z.string().transform(sanitizeText).optional(),
      taxPercentage: z.union([z.string(), z.number()])
        .transform(val => sanitizeNumber(val, 25))
        .refine(val => val >= 0 && val <= 100, 'Tax percentage must be between 0 and 100')
    })),
    async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigId = parseInt(req.params.id);
      const {
        totalReceived,
        parkingSpent,
        parkingReimbursed,
        otherExpenses, // Now an array of {name, amount}
        otherReimbursed,
        mileage,
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
        mileage: mileage || 0, // Save calculated mileage
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
  app.get('/api/address-autocomplete', requireAuth, 
    validateQueryParams(z.object({
      input: z.string()
        .min(2, 'Input must be at least 2 characters')
        .max(200, 'Input must be less than 200 characters')
        .transform(sanitizeText)
    })),
    async (req: any, res: Response) => {
    try {
      const { input } = req.query;

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
  app.post('/api/calculate-distance', requireAuth,
    validateRequestBody(z.object({
      startAddress: z.string()
        .min(5, 'Start address is required')
        .max(500, 'Start address must be less than 500 characters')
        .transform(sanitizeAddress),
      endAddress: z.string()
        .min(5, 'End address is required')
        .max(500, 'End address must be less than 500 characters')
        .transform(sanitizeAddress),
      roundTrip: z.boolean().default(false)
    })),
    async (req: any, res: Response) => {
    try {
      const { startAddress, endAddress, roundTrip } = req.body;

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
  app.get('/api/expenses', requireAuth,
    validateQueryParams(z.object({
      limit: z.coerce.number().min(1).max(1000).default(50),
      offset: z.coerce.number().min(0).default(0),
      category: z.string().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    })),
    async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { limit, offset } = req.query;
      
      const expensesData = await storage.getExpensesByUser(userId, limit, offset);
      res.json(expensesData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  app.post('/api/expenses', requireAuth,
    validateRequestBody(z.object({
      description: expenseValidation.description,
      merchant: expenseValidation.merchant,
      businessPurpose: z.string().min(1, 'Business purpose is required'),
      amount: expenseValidation.amount,
      category: expenseValidation.category,
      date: expenseValidation.date,
      notes: expenseValidation.notes.optional(),
      receiptUrl: z.string().url().optional(),
      isBusinessExpense: z.boolean().default(true),
      isTaxDeductible: z.boolean().default(true),
      gigId: z.number().optional()
    })),
    async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const expenseData = { ...req.body, userId };
      console.log('💳 Creating expense:', expenseData);
      console.log('💳 Request validation passed - proceeding with database insert');
      const expense = await storage.createExpense(expenseData);
      console.log('✅ Expense created successfully:', expense.id);
      
      // Track expense creation in Klaviyo
      try {
        const user = await storage.getUser(userId);
        if (user) {
          const { KlaviyoService } = await import('./klaviyo');
          await KlaviyoService.trackExpenseAdded(user.email, {
            amount: parseFloat(expense.amount.toString()),
            category: expense.category,
            description: expense.businessPurpose || 'Business expense'
          });
        }
      } catch (error) {
        console.log('Note: Failed to track expense creation in Klaviyo');
      }
      
      res.json(expense);
    } catch (error) {
      console.error('💥 Failed to create expense:', error);
      res.status(500).json({ error: 'Failed to create expense', details: error instanceof Error ? error.message : 'Unknown error' });
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

  // Backup and Data Export endpoints
  app.get('/api/backup/export', requireAuth, exportRateLimit,
    validateQueryParams(z.object({
      format: z.enum(['json', 'excel']).default('json')
    })),
    async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { format } = req.query;
      console.log(`📦 ${format.toUpperCase()} export requested by user ${userId}`);
      
      const { backupManager } = await import('./backup');
      
      if (format === 'excel') {
        const filepath = await backupManager.exportUserDataAsExcel(userId);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="bookd-export-${userId}-${Date.now()}.xlsx"`);
        res.download(filepath, (err) => {
          if (err) {
            console.error('❌ Excel download failed:', err);
          }
        });
      } else {
        const backupData = await backupManager.createUserBackup(userId);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="bookd-export-${userId}-${Date.now()}.json"`);
        res.json(backupData);
      }
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      res.status(500).json({ error: 'Failed to export user data' });
    }
  });

  app.get('/api/backup/download', requireAuth, exportRateLimit, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      console.log(`📥 Backup download requested by user ${userId}`);
      
      const { backupManager } = await import('./backup');
      const filepath = await backupManager.createBackupArchive(userId);
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="bookd-backup-${userId}-${Date.now()}.zip"`);
      res.download(filepath, (err) => {
        if (err) {
          console.error('❌ Download failed:', err);
        }
      });
      
    } catch (error) {
      console.error('❌ Backup download failed:', error);
      res.status(500).json({ error: 'Failed to create backup archive' });
    }
  });

  app.get('/api/backup/info', requireAuth, async (req: any, res) => {
    try {
      const { backupManager } = await import('./backup');
      const info = await backupManager.getBackupInfo();
      res.json(info);
    } catch (error) {
      console.error('❌ Backup info failed:', error);
      res.status(500).json({ error: 'Failed to get backup information' });
    }
  });

  // Emergency BA feature API endpoints
  
  // Get active emergency gigs (for BA feed)
  // Agency authentication endpoints
  app.post('/api/agencies/register', async (req: Request, res: Response) => {
    try {
      const { email, password, companyName, contactName, phoneNumber, website, description } = req.body;
      
      // Check if agency already exists
      const existingAgency = await storage.getAgencyByEmail(email);
      if (existingAgency) {
        return res.status(400).json({ error: 'Agency with this email already exists' });
      }
      
      // Create new agency
      const agency = await storage.createAgency({
        email,
        passwordHash: password, // Will be hashed in storage
        companyName,
        contactName,
        phoneNumber,
        website,
        description,
      });
      
      // Remove password hash from response
      const { passwordHash, ...agencyWithoutPassword } = agency;
      
      res.json({ 
        success: true, 
        agency: agencyWithoutPassword,
        message: 'Agency registered successfully'
      });
    } catch (error) {
      console.error("❌ Failed to register agency:", error);
      res.status(500).json({ error: "Failed to register agency" });
    }
  });

  app.post('/api/agencies/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      const agency = await storage.validateAgencyPassword(email, password);
      if (!agency) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Remove password hash from response
      const { passwordHash, ...agencyWithoutPassword } = agency;
      
      res.json({ 
        success: true, 
        agency: agencyWithoutPassword,
        message: 'Login successful'
      });
    } catch (error) {
      console.error("❌ Failed to login agency:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.get('/api/emergency-gigs', requireAuth, async (req: any, res) => {
    try {
      const { city } = req.query;
      const gigs = await storage.getActiveEmergencyGigs(city);
      res.json(gigs);
    } catch (error) {
      console.error('❌ Failed to fetch emergency gigs:', error);
      res.status(500).json({ error: 'Failed to fetch emergency gigs' });
    }
  });

  // Create emergency gig (agency post - no auth required for agencies)
  app.post('/api/emergency-gigs', 
    validateRequestBody(z.object({
      agencyEmail: z.string().email(),
      agencyName: z.string().min(1),
      contactEmail: z.string().email(),
      eventName: z.string().min(1),
      eventDate: z.string(),
      city: z.string().min(1),
      venue: z.string().optional(),
      roleDescription: z.string().optional(),
      payRate: z.string().optional(),
      urgency: z.enum(['ASAP', 'Within 24hrs', 'This Week']).default('ASAP'),
      revenuecatTransactionId: z.string().optional()
    })),
    async (req: Request, res: Response) => {
    try {
      const gigData = {
        ...req.body,
        eventDate: new Date(req.body.eventDate)
      };
      
      const gig = await storage.createEmergencyGig(gigData);
      
      // TODO: Send notifications to BAs in the city
      // await notifyBAsInCity(gig.city, gig);
      
      res.status(201).json(gig);
    } catch (error) {
      console.error('❌ Failed to create emergency gig:', error);
      res.status(500).json({ error: 'Failed to create emergency gig' });
    }
  });

  // BA applies to emergency gig
  app.post('/api/emergency-gigs/:id/apply', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigId = parseInt(req.params.id);
      
      // Check if gig exists and is active
      const gig = await storage.getEmergencyGig(gigId);
      if (!gig || gig.status !== 'active') {
        return res.status(404).json({ error: 'Emergency gig not found or no longer active' });
      }
      
      // Create application
      const application = await storage.createBAApplication({
        emergencyGigId: gigId,
        baUserId: userId,
        emailSent: false
      });
      
      // Send email notification to agency
      try {
        const user = await storage.getUser(userId);
        if (user && gig) {
          // Import SendGrid dynamically
          const sgMail = await import('@sendgrid/mail');
          if (process.env.SENDGRID_API_KEY) {
            sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
            
            // Send email to agency about new BA application
            await sgMail.default.send({
              to: gig.agencyEmail,
              from: 'noreply@bookd.tools', // You can customize this sender email
              subject: `New Brand Ambassador Application for ${gig.eventName}`,
              html: `
                <h2>New Brand Ambassador Application</h2>
                <p>A Brand Ambassador has applied for your emergency gig!</p>
                
                <h3>Gig Details:</h3>
                <ul>
                  <li><strong>Event:</strong> ${gig.eventName}</li>
                  <li><strong>Date:</strong> ${new Date(gig.eventDate).toLocaleDateString()}</li>
                  <li><strong>City:</strong> ${gig.city}</li>
                  <li><strong>Pay Rate:</strong> ${gig.payRate || 'Not specified'}</li>
                </ul>
                
                <h3>Brand Ambassador Details:</h3>
                <ul>
                  <li><strong>Name:</strong> ${user.name}</li>
                  <li><strong>Email:</strong> ${user.email}</li>
                </ul>
                
                <p>Please contact the Brand Ambassador directly to discuss next steps.</p>
                
                <p>Best regards,<br/>The Bookd Team</p>
              `
            });
            
            console.log(`📧 Email sent to agency ${gig.agencyEmail} about BA application from ${user.name}`);
          }
        }
      } catch (emailError) {
        console.error('❌ Failed to send email notification:', emailError);
        // Don't fail the application if email fails
      }
      
      res.status(201).json({ message: 'Application submitted successfully', application });
    } catch (error) {
      console.error('❌ Failed to apply to emergency gig:', error);
      res.status(500).json({ error: 'Failed to apply to emergency gig' });
    }
  });

  // Mark emergency gig as filled (for agencies)
  app.post('/api/emergency-gigs/:id/mark-filled',
    validateRequestBody(z.object({
      agencyEmail: z.string().email()
    })),
    async (req: Request, res: Response) => {
    try {
      const gigId = parseInt(req.params.id);
      const { agencyEmail } = req.body;
      
      // Verify agency owns this gig
      const gig = await storage.getEmergencyGig(gigId);
      if (!gig || gig.agencyEmail !== agencyEmail) {
        return res.status(403).json({ error: 'Unauthorized to mark this gig as filled' });
      }
      
      const updatedGig = await storage.markEmergencyGigFilled(gigId);
      
      // TODO: Notify all BAs that applied
      // await notifyBAsGigFilled(gigId);
      
      res.json({ message: 'Gig marked as filled', gig: updatedGig });
    } catch (error) {
      console.error('❌ Failed to mark gig as filled:', error);
      res.status(500).json({ error: 'Failed to mark gig as filled' });
    }
  });

  // Apply security error handler last
  app.use(secureErrorHandler);
  
  const httpServer = createServer(app);
  return httpServer;
}