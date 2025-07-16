import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./unified-auth";

// Helper function to get user ID from request (unified-auth pattern)
function getUserId(req: any): number {
  if (!req.userId) {
    throw new Error('User not authenticated');
  }
  return req.userId;
}
import { globalErrorHandler, asyncHandler, safeDbOperation, validateUserId, validateNumericId } from "./error-handler";
import { logError } from "./logger";
import rateLimit from "express-rate-limit";

export async function registerRoutes(app: Express): Promise<Server> {
  // REPLIT AUTH: Zero-configuration authentication system
  
  // Set trust proxy for rate limiting
  app.set('trust proxy', true);
  
  // Force HTTPS redirect in production
  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(301, `https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });
  }

  // SECURITY: All admin endpoints completely removed for production security
  
  // Rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 password reset requests per hour
    message: 'Too many password reset attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Setup traditional auth routes using unified-auth.ts
  const { setupAuthRoutes } = await import('./unified-auth');
  setupAuthRoutes(app, authLimiter, passwordResetLimiter);

  // Health check endpoint (no sensitive data)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // System monitoring endpoints
  app.get('/api/system-status', requireAuth, asyncHandler(async (req: any, res) => {
    try {
      const { monitoringSystem } = await import('./monitoring-system');
      const { infrastructureManager } = await import('./infrastructure-manager');
      
      const [metrics, health] = await Promise.all([
        monitoringSystem.getCurrentStatus(),
        infrastructureManager.getInfrastructureHealth()
      ]);
      
      res.json({
        metrics,
        infrastructure: health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError('System status check failed', error);
      res.status(500).json({ error: 'Failed to check system status' });
    }
  }));

  app.get('/api/health-report', requireAuth, asyncHandler(async (req: any, res) => {
    try {
      const { infrastructureManager } = await import('./infrastructure-manager');
      const report = await infrastructureManager.generateStatusReport();
      
      res.setHeader('Content-Type', 'text/plain');
      res.send(report);
    } catch (error) {
      logError('Health report generation failed', error);
      res.status(500).json({ error: 'Failed to generate health report' });
    }
  }));

  app.get('/api/metrics-history', requireAuth, asyncHandler(async (req: any, res) => {
    try {
      const { monitoringSystem } = await import('./monitoring-system');
      const hours = parseInt(req.query.hours as string) || 24;
      const history = monitoringSystem.getMetricsHistory(hours);
      
      res.json({
        history,
        period: `${hours} hours`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError('Metrics history fetch failed', error);
      res.status(500).json({ error: 'Failed to fetch metrics history' });
    }
  }));

  app.get('/api/alerts', requireAuth, asyncHandler(async (req: any, res) => {
    try {
      const { alertingSystem } = await import('./alerting-system');
      const activeOnly = req.query.active === 'true';
      const alerts = activeOnly ? alertingSystem.getActiveAlerts() : alertingSystem.getAllAlerts();
      const summary = alertingSystem.getAlertSummary();
      
      res.json({
        alerts,
        summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError('Alerts fetch failed', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  }));

  app.get('/api/alerts-report', requireAuth, asyncHandler(async (req: any, res) => {
    try {
      const { alertingSystem } = await import('./alerting-system');
      const report = alertingSystem.generateAlertReport();
      
      res.setHeader('Content-Type', 'text/plain');
      res.send(report);
    } catch (error) {
      logError('Alert report generation failed', error);
      res.status(500).json({ error: 'Failed to generate alert report' });
    }
  }));

  app.post('/api/alerts/:id/resolve', requireAuth, asyncHandler(async (req: any, res) => {
    try {
      const { alertingSystem } = await import('./alerting-system');
      const alertId = req.params.id;
      const resolved = alertingSystem.resolveAlert(alertId);
      
      if (resolved) {
        res.json({ success: true, message: 'Alert resolved' });
      } else {
        res.status(404).json({ error: 'Alert not found or already resolved' });
      }
    } catch (error) {
      logError('Alert resolution failed', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  }));

  // User data endpoints - all require authentication
  app.get('/api/user', requireAuth, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const user = await safeDbOperation(
      () => storage.getUser(userId),
      'Failed to fetch user data',
      userId
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  }));

  app.put('/api/user', requireAuth, asyncHandler(async (req: any, res) => {
    const userId = getUserId(req);
    const updatedUser = await safeDbOperation(
      () => storage.updateUser(userId, req.body),
      'Failed to update user data',
      userId
    );
    
    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update user' });
    }
    
    res.json(updatedUser);
  }));

  // Gig endpoints
  app.get('/api/gigs', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gigs = await storage.getGigsByUser(userId);
      res.json(gigs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch gigs' });
    }
  });

  app.post('/api/gigs', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gig = await storage.createGig({ ...req.body, userId });
      res.json(gig);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create gig' });
    }
  });

  app.put('/api/gigs/:id', requireAuth, async (req: any, res) => {
    try {
      const gigId = parseInt(req.params.id);
      const userId = getUserId(req);
      const existingGig = await storage.getGig(gigId);
      
      if (!existingGig || existingGig.userId !== userId) {
        return res.status(404).json({ error: 'Gig not found' });
      }
      
      const updatedGig = await storage.updateGig(gigId, req.body);
      res.json(updatedGig);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update gig' });
    }
  });

  app.delete('/api/gigs/:id', requireAuth, async (req: any, res) => {
    try {
      const gigId = parseInt(req.params.id);
      const userId = getUserId(req);
      const existingGig = await storage.getGig(gigId);
      
      if (!existingGig || existingGig.userId !== userId) {
        return res.status(404).json({ error: 'Gig not found' });
      }
      
      await storage.deleteGig(gigId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete gig' });
    }
  });

  // Expense endpoints
  app.get('/api/expenses', requireAuth, async (req: any, res) => {
    try {
      const expenses = await storage.getExpensesByUser(getUserId(req));
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  app.post('/api/expenses', requireAuth, async (req: any, res) => {
    try {
      const expense = await storage.createExpense({ ...req.body, userId: getUserId(req) });
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create expense' });
    }
  });

  app.put('/api/expenses/:id', requireAuth, async (req: any, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      const existingExpense = await storage.getExpense(expenseId);
      
      if (!existingExpense || existingExpense.userId !== getUserId(req)) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      const updatedExpense = await storage.updateExpense(expenseId, req.body);
      res.json(updatedExpense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update expense' });
    }
  });

  app.delete('/api/expenses/:id', requireAuth, async (req: any, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      const existingExpense = await storage.getExpense(expenseId);
      
      if (!existingExpense || existingExpense.userId !== getUserId(req)) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      await storage.deleteExpense(expenseId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  });

  // Goal endpoints
  app.get('/api/goals', requireAuth, async (req: any, res) => {
    try {
      const goals = await storage.getGoalsByUser(getUserId(req));
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch goals' });
    }
  });

  app.post('/api/goals', requireAuth, async (req: any, res) => {
    try {
      const goal = await storage.createGoal({ ...req.body, userId: getUserId(req) });
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create goal' });
    }
  });

  app.put('/api/goals/:id', requireAuth, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const existingGoal = await storage.getGoal(goalId);
      
      if (!existingGoal || existingGoal.userId !== getUserId(req)) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      const updatedGoal = await storage.updateGoal(goalId, req.body);
      res.json(updatedGoal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update goal' });
    }
  });

  app.delete('/api/goals/:id', requireAuth, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.id);
      const existingGoal = await storage.getGoal(goalId);
      
      if (!existingGoal || existingGoal.userId !== getUserId(req)) {
        return res.status(404).json({ error: 'Goal not found' });
      }
      
      await storage.deleteGoal(goalId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete goal' });
    }
  });

  // Monthly/Yearly goal endpoints
  app.get('/api/monthly-goals', requireAuth, async (req: any, res) => {
    try {
      const goals = await storage.getMonthlyGoalsByUser(getUserId(req));
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch monthly goals' });
    }
  });

  app.post('/api/monthly-goals', requireAuth, async (req: any, res) => {
    try {
      const goal = await storage.createMonthlyGoal({ ...req.body, userId: getUserId(req) });
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create monthly goal' });
    }
  });

  app.get('/api/yearly-goals', requireAuth, async (req: any, res) => {
    try {
      const goals = await storage.getYearlyGoalsByUser(getUserId(req));
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch yearly goals' });
    }
  });

  app.post('/api/yearly-goals', requireAuth, async (req: any, res) => {
    try {
      const goal = await storage.createYearlyGoal({ ...req.body, userId: getUserId(req) });
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create yearly goal' });
    }
  });

  // Distance calculation endpoint (authenticated)
  app.post('/api/calculate-distance', requireAuth, async (req: any, res) => {
    try {
      const { startAddress, endAddress, waypoints = [], roundTrip = false } = req.body;
      const userId = getUserId(req);
      
      if (!startAddress || !endAddress) {
        return res.status(400).json({ 
          status: 'error',
          error: 'Start and end addresses are required' 
        });
      }

      const { mileageService } = await import('./mileage-service');
      
      // Use the enterprise mileage service
      const result = await mileageService.calculateDistance(
        userId,
        startAddress,
        endAddress,
        waypoints.filter(w => w?.trim()),
        roundTrip
      );
      
      if (result.success) {
        res.json({
          status: 'success',
          distanceMiles: result.distance,
          travelTimeMinutes: result.duration,
          fromCache: result.fromCache,
          confidence: result.confidence,
          fallbackUsed: result.fallbackUsed
        });
      } else {
        res.status(400).json({ 
          status: 'error',
          error: result.error 
        });
      }
    } catch (error) {
      logger.error('Distance calculation error:', error);
      res.status(500).json({ 
        status: 'error',
        error: 'Failed to calculate distance' 
      });
    }
  });

  // Address validation endpoint
  app.post('/api/validate-address', requireAuth, async (req: any, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }
      
      const { mileageService } = await import('./mileage-service');
      const validation = await mileageService.validateAddress(address);
      res.json(validation);
    } catch (error) {
      logger.error('Address validation error:', error);
      res.status(500).json({ error: 'Failed to validate address' });
    }
  });

  // Mileage service statistics endpoint
  app.get('/api/mileage-stats', requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { mileageService } = await import('./mileage-service');
      
      const systemStats = mileageService.getStats();
      const userStats = mileageService.getUserStats(userId);
      const queueInfo = mileageService.getQueueInfo();
      
      res.json({
        system: systemStats,
        user: userStats,
        queue: queueInfo
      });
    } catch (error) {
      logger.error('Mileage stats error:', error);
      res.status(500).json({ error: 'Failed to get mileage statistics' });
    }
  });

  // Set user priority endpoint (for admin use)
  app.post('/api/set-user-priority', requireAuth, async (req: any, res) => {
    try {
      const { userId, priority } = req.body;
      const requestingUserId = getUserId(req);
      
      // Simple admin check (you could enhance this with proper admin roles)
      if (requestingUserId !== 1) { // Assume user ID 1 is admin
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      if (!userId || !priority || !['high', 'medium', 'low'].includes(priority)) {
        return res.status(400).json({ error: 'Valid userId and priority (high/medium/low) are required' });
      }
      
      const { mileageService } = await import('./mileage-service');
      mileageService.setUserPriority(userId, priority);
      res.json({ success: true, message: `User ${userId} priority set to ${priority}` });
    } catch (error) {
      logger.error('Set user priority error:', error);
      res.status(500).json({ error: 'Failed to set user priority' });
    }
  });

  // PDF report generation endpoints
  app.get('/api/reports/pdf', requireAuth, async (req: any, res) => {
    try {
      const { period, year, month, professional } = req.query;
      const userId = getUserId(req);
      
      if (!period || !year) {
        return res.status(400).json({ error: 'Period and year are required' });
      }

      const reportOptions = {
        userId,
        period: period as 'monthly' | 'annual',
        year: parseInt(year as string),
        month: month ? parseInt(month as string) : undefined
      };

      let pdfBuffer: Buffer;
      
      try {
        // Try professional generator first
        if (professional === 'true') {
          const { ProfessionalPDFGenerator } = await import('./professional-pdf-generator');
          const generator = new ProfessionalPDFGenerator();
          pdfBuffer = await generator.generateReport(reportOptions);
        } else {
          // Use mobile generator
          const { MobilePDFGenerator } = await import('./mobile-pdf');
          const generator = new MobilePDFGenerator();
          pdfBuffer = await generator.generateReport(reportOptions);
        }
      } catch (importError) {
        logError('PDF generator import/execution error', importError as Error, userId);
        // Fallback: Try the other generator
        try {
          if (professional === 'true') {
            const { MobilePDFGenerator } = await import('./mobile-pdf');
            const generator = new MobilePDFGenerator();
            pdfBuffer = await generator.generateReport(reportOptions);
          } else {
            const { ProfessionalPDFGenerator } = await import('./professional-pdf-generator');
            const generator = new ProfessionalPDFGenerator();
            pdfBuffer = await generator.generateReport(reportOptions);
          }
        } catch (fallbackError) {
          logError('Fallback PDF generator also failed', fallbackError as Error, userId);
          throw new Error('Both PDF generators failed');
        }
      }
      
      // Set appropriate headers for PDF download
      const filename = `${period}-income-report-${year}${month ? `-${month}` : ''}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      logError('PDF generation error', error as Error, userId);
      
      // Send more specific error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown PDF generation error';
      
      res.status(500).json({ 
        error: 'Failed to generate PDF report',
        details: errorMessage
      });
    }
  });

  app.get('/api/reports/html', requireAuth, async (req: any, res) => {
    try {
      const { period, year, month } = req.query;
      const userId = getUserId(req);
      
      if (!period || !year) {
        return res.status(400).json({ error: 'Period and year are required' });
      }

      const reportOptions = {
        userId,
        period: period as 'monthly' | 'annual',
        year: parseInt(year as string),
        month: month ? parseInt(month as string) : undefined
      };

      // Import HTML generator
      const { generateProfessionalHTML } = await import('./professional-html-generator');
      
      const htmlContent = await generateProfessionalHTML(reportOptions);
      
      // Set appropriate headers for HTML response
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);
    } catch (error) {
      console.error('HTML generation error:', error);
      res.status(500).json({ error: 'Failed to generate HTML report' });
    }
  });

  // Automatic gig status update endpoint
  app.post('/api/gigs/update-statuses', requireAuth, async (req: any, res) => {
    try {
      const gigs = await storage.getGigsByUser(getUserId(req));
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

  // Custom gig types endpoint
  app.get('/api/gig-types', requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(getUserId(req));
      res.json(user?.customGigTypes || []);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch gig types' });
    }
  });

  app.post('/api/gig-types', requireAuth, async (req: any, res) => {
    try {
      const { gigType } = req.body;
      const user = await storage.getUser(getUserId(req));
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const customGigTypes = user.customGigTypes || [];
      if (!customGigTypes.includes(gigType)) {
        customGigTypes.push(gigType);
        await storage.updateUser(getUserId(req), { customGigTypes });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add gig type' });
    }
  });

  // 404 handler for any remaining admin routes
  app.use('/admin*', (req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use('/api/admin*', (req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Global error handler (must be last)
  app.use(globalErrorHandler);

  const server = createServer(app);
  return server;
}

// Helper function to group multi-day gigs
function groupMultiDayGigs(gigs: any[]): any[] {
  const grouped: any[] = [];
  const processed = new Set<number>();

  for (const gig of gigs) {
    if (processed.has(gig.id)) continue;

    const gigDate = new Date(gig.date);
    const relatedGigs = gigs.filter(g => 
      g.id !== gig.id && 
      g.clientName === gig.clientName &&
      g.gigName === gig.gigName &&
      !processed.has(g.id)
    );

    if (relatedGigs.length > 0) {
      const allGigs = [gig, ...relatedGigs];
      const sortedGigs = allGigs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const firstDate = new Date(sortedGigs[0].date);
      const lastDate = new Date(sortedGigs[sortedGigs.length - 1].date);
      
      const isConsecutive = sortedGigs.every((g, i) => {
        if (i === 0) return true;
        const prevDate = new Date(sortedGigs[i - 1].date);
        const currDate = new Date(g.date);
        return (currDate.getTime() - prevDate.getTime()) === 24 * 60 * 60 * 1000;
      });

      if (isConsecutive && sortedGigs.length <= 7) {
        const totalPay = sortedGigs.reduce((sum, g) => sum + (g.actualPay || g.expectedPay || 0), 0);
        const totalTips = sortedGigs.reduce((sum, g) => sum + (g.tips || 0), 0);
        
        grouped.push({
          ...sortedGigs[0],
          actualPay: totalPay,
          tips: totalTips,
          date: firstDate.toISOString().split('T')[0],
          endDate: lastDate.toISOString().split('T')[0],
          isMultiDay: true,
          dayCount: sortedGigs.length
        });
        
        sortedGigs.forEach(g => processed.add(g.id));
      } else {
        grouped.push(gig);
        processed.add(gig.id);
      }
    } else {
      grouped.push(gig);
      processed.add(gig.id);
    }
  }

  return grouped;
}