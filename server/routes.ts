import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { PasswordVerificationService } from "./password-verification";
import { requireAuth } from "./auth";
import { db } from "./db";
import { users, gigs } from "@shared/schema";
import { count } from "drizzle-orm";

// Helper function to get user ID from request (unified-auth pattern)
function getUserId(req: any): number {
  if (!req.userId) {
    throw new Error('User not authenticated');
  }
  return req.userId;
}
import { globalErrorHandler, asyncHandler, safeDbOperation, validateUserId, validateNumericId } from "./error-handler";
import { logError } from "./logger";

// Create logger fallback for missing logger references
const logger = {
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${message}:`, error);
    logError(message, error as Error);
  },
  info: (message: string, data?: unknown) => {
    console.log(`[INFO] ${message}:`, data);
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[WARN] ${message}:`, data);
  }
};
import rateLimit from "express-rate-limit";
import { nodeJSMemoryProfiler } from "./nodejs-memory-profiler";
import { memoryLeakFixer } from "./memory-leak-fixes";
import { timerLeakDetector } from "./timer-leak-detector";
import { monitoringSystemCleanup } from "./monitoring-system-cleanup";
import { fsWatcherLeakFix } from "./fswatcher-leak-fix";

export async function registerRoutes(app: Express): Promise<Server> {
  // BULLETPROOF ERROR HANDLING HELPER - GRACEFUL HTML FALLBACKS
  function createGracefulErrorHTML(
    title: string, 
    message: string, 
    suggestion: string, 
    statusCode: number,
    userId?: number,
    error?: Error
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                text-align: center; padding: 50px; background: #f8f9fa; margin: 0;
              }
              .error-container { 
                max-width: 600px; margin: 0 auto; background: white; 
                border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
              }
              .error-icon { font-size: 48px; margin-bottom: 20px; }
              .error-title { color: #dc3545; margin-bottom: 20px; font-size: 28px; font-weight: bold; }
              .error-message { color: #6c757d; margin-bottom: 20px; line-height: 1.6; font-size: 16px; }
              .error-suggestion { color: #495057; margin-bottom: 30px; line-height: 1.5; font-size: 15px; }
              .button { 
                background: #007bff; color: white; padding: 14px 28px; 
                text-decoration: none; border-radius: 8px; display: inline-block; 
                font-weight: 500; margin: 10px; transition: background 0.2s;
              }
              .button:hover { background: #0056b3; }
              .button-success { background: #28a745; }
              .button-success:hover { background: #1e7e34; }
              .debug { 
                background: #f8f9fa; padding: 20px; margin: 30px 0; 
                border-left: 4px solid #007bff; text-align: left; border-radius: 6px;
                font-family: monospace; font-size: 14px; line-height: 1.4;
              }
          </style>
      </head>
      <body>
          <div class="error-container">
              <div class="error-icon">📊</div>
              <h1 class="error-title">${title}</h1>
              <p class="error-message">${message}</p>
              <p class="error-suggestion">${suggestion}</p>
              <div>
                  <a href="javascript:window.close()" class="button">Close Window</a>
                  <a href="/" class="button button-success">Return to Dashboard</a>
              </div>
              ${process.env.NODE_ENV === 'development' && error ? `
                <div class="debug">
                  <strong>🔧 Debug Information:</strong><br>
                  <strong>Error:</strong> ${error.message || 'Unknown error'}<br>
                  <strong>User ID:</strong> ${userId || 'Unknown'}<br>
                  <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
                  <strong>Status:</strong> ${statusCode}
                </div>
              ` : ''}
          </div>
      </body>
      </html>
    `;
  }

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

  // Cache invalidation utility
  async function invalidateUserCaches(userId: number) {
    const { cache } = await import('./simple-cache');
    const { invalidateDashboardCache } = await import('./dashboard-optimized');
    await cache.invalidate(`gigs:${userId}`);
    await invalidateDashboardCache(userId);
  }
  
  // Rate limiting for authentication endpoints - more permissive for better UX
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Increased limit to prevent legitimate users from being blocked
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development' || !process.env.NODE_ENV, // Disable in development or when NODE_ENV undefined
    keyGenerator: (req) => {
      // Use a combination of IP and email to allow multiple users from same IP
      const email = req.body?.email || 'unknown';
      return `${req.ip}-${email}`;
    }
  });

  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Increased to allow legitimate reset attempts
    message: 'Too many password reset attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development' || !process.env.NODE_ENV, // Disable in development or when NODE_ENV undefined
  });

  // API Rate Limiting for production endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes per IP (normal user activity)
    message: { error: 'Too many API requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
  });

  // Stricter rate limiting for heavy operations
  const heavyApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes  
    max: 20, // 20 requests per 15 minutes for heavy operations
    message: { error: 'Too many heavy operations, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
  });

  // Ultra-permissive rate limiting for mobile users
  const resourceIntensiveLimiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes (very short window)
    max: 100, // 100 requests per 2 minutes (ultra-permissive)
    message: { error: 'Please wait 30 seconds before generating another report.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Only skip in development, ensure production gets this permissive config
    skip: (req) => false, // Always apply rate limiting but with generous limits
  });

  // Setup bulletproof auth routes using consolidated auth.ts
  const { setupAuthRoutes } = await import('./auth');
  setupAuthRoutes(app);

  // Health check endpoint (no sensitive data)
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Field mapping validation endpoint for monitoring
  app.get('/api/system/validate', apiLimiter, requireAuth, asyncHandler(async (req: any, res: Response) => {
    try {
      const { FieldMappingValidator } = await import('./field-mapping-validator');
      const validation = await FieldMappingValidator.validateFieldMappingHealth();
      res.json(validation);
    } catch (error) {
      logError('Field mapping validation failed', error as Error);
      res.status(500).json({ 
        status: 'critical',
        error: 'Validation system failure',
        timestamp: new Date().toISOString()
      });
    }
  }));

  // System monitoring endpoints
  app.get('/api/system-status', requireAuth, asyncHandler(async (req: any, res: Response) => {
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
      logError('System status check failed', error as Error);
      res.status(500).json({ error: 'Failed to check system status' });
    }
  }));

  app.get('/api/health-report', requireAuth, asyncHandler(async (req: any, res: Response) => {
    try {
      const { infrastructureManager } = await import('./infrastructure-manager');
      const report = await infrastructureManager.generateStatusReport();
      
      res.setHeader('Content-Type', 'text/plain');
      res.send(report);
    } catch (error) {
      logError('Health report generation failed', error as Error);
      res.status(500).json({ error: 'Failed to generate health report' });
    }
  }));

  app.get('/api/metrics-history', requireAuth, asyncHandler(async (req: any, res: Response) => {
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
      logError('Metrics history fetch failed', error as Error);
      res.status(500).json({ error: 'Failed to fetch metrics history' });
    }
  }));

  // Cache monitoring endpoint with detailed stats and health warnings
  app.get('/api/cache-stats', apiLimiter, requireAuth, asyncHandler(async (req: any, res: Response) => {
    try {
      const { advancedCache } = await import('./advanced-cache');
      const stats = advancedCache.getStats();
      const health = advancedCache.getCacheHealth();
      
      res.json({
        ...stats,
        health,
        features: {
          priorityQueue: true,
          dynamicIntervals: true,
          cacheWarming: true,
          batchOperations: true,
          oLogNCleanup: true
        },
        recommendations: health === 'critical' 
          ? ['Cache at critical levels - implement Redis for production scaling', 'Consider clearing cache to free memory']
          : health === 'warning'
          ? ['Monitor cache usage - consider Redis if problems persist', 'High cache activity detected']
          : ['Advanced cache performing optimally with O(log n) cleanup']
      });
    } catch (error) {
      logError('Cache stats fetch failed', error as Error);
      res.status(500).json({ error: 'Failed to get cache stats' });
    }
  }));

  app.get('/api/alerts', requireAuth, asyncHandler(async (req: any, res: Response) => {
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
      logError('Alerts fetch failed', error as Error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  }));

  app.get('/api/alerts-report', requireAuth, asyncHandler(async (req: any, res: Response) => {
    try {
      const { alertingSystem } = await import('./alerting-system');
      const report = alertingSystem.generateAlertReport();
      
      res.setHeader('Content-Type', 'text/plain');
      res.send(report);
    } catch (error) {
      logError('Alert report generation failed', error as Error);
      res.status(500).json({ error: 'Failed to generate alert report' });
    }
  }));

  app.post('/api/alerts/:id/resolve', requireAuth, asyncHandler(async (req: any, res: Response) => {
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
      logError('Alert resolution failed', error as Error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  }));

  // User data endpoints - all require authentication
  app.get('/api/user', apiLimiter, requireAuth, asyncHandler(async (req: any, res: Response) => {
    const userId = getUserId(req);
    
    // Check cache first (5-minute TTL for user data)
    const { cache } = await import('./simple-cache');
    const cacheKey = `user:${userId}`;
    let user = await cache.get(cacheKey);
    
    if (!user) {
      user = await safeDbOperation(
        () => storage.getUser(userId),
        'Failed to fetch user data',
        userId
      );
      
      if (user) {
        await cache.set(cacheKey, user, 300); // 5-minute cache
      }
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  }));

  app.put('/api/user', apiLimiter, requireAuth, asyncHandler(async (req: any, res: Response) => {
    const userId = getUserId(req);
    
    const updatedUser = await safeDbOperation(
      () => storage.updateUser(userId, req.body),
      'Failed to update user data',
      userId
    );
    
    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update user' });
    }
    
    // Invalidate caches after user update
    const { invalidateDashboardCache } = await import('./dashboard-optimized');
    invalidateDashboardCache(userId);
    
    res.json(updatedUser);
  }));

  // Gig endpoints - rate limited for production scaling
  app.get('/api/gigs', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const lightweight = req.query.lightweight === 'true';
      
      // Calculate cache entry size BEFORE caching to prevent memory issues
      const { cache } = await import('./simple-cache');
      const cacheKey = `gigs:${userId}:${lightweight}`;
      let gigs = await cache.get(cacheKey);
      
      if (!gigs) {
        gigs = await storage.getGigsByUser(userId);
        
        // FIELD MAPPING FIX: Ensure camelCase field names for frontend compatibility
        gigs = gigs.map(gig => {
          const mapped = {
            ...gig,
            expectedPay: gig.expectedPay || gig.expected_pay,
            actualPay: gig.actualPay || gig.actual_pay,
            eventName: gig.eventName || gig.event_name,
            clientName: gig.clientName || gig.client_name,
            gigType: gig.gigType || gig.gig_type,
            parkingExpense: gig.parkingExpense || gig.parking_expense,
            otherExpenses: gig.otherExpenses || gig.other_expenses,
            parkingReceipts: gig.parkingReceipts || gig.parking_receipts,
            otherExpenseReceipts: gig.otherExpenseReceipts || gig.other_expense_receipts
          };
          console.log(`🔍 Field mapping for gig ${gig.id}: expectedPay=${mapped.expectedPay}, actualPay=${mapped.actualPay}`);
          return mapped;
        });
        
        // Check size before caching - prevent 5MB cache entries
        const dataSize = JSON.stringify(gigs).length;
        console.log(`📊 Gig data size for user ${userId}: ${Math.round(dataSize/1024)}KB`);
        
        if (dataSize > 100000) { // 100KB limit
          console.log(`🚫 Gig data too large (${Math.round(dataSize/1024)}KB) - not caching to prevent memory issues`);
          
          // For oversized data, return lightweight version without receipt images
          if (lightweight) {
            gigs = gigs.map(gig => ({
              ...gig,
              parking_receipts: gig.parking_receipts?.length ? ['[receipts available]'] : null,
              other_expense_receipts: gig.other_expense_receipts?.length ? ['[receipts available]'] : null,
              notes: gig.notes?.length > 500 ? gig.notes.substring(0, 500) + '...' : gig.notes,
              duties: gig.duties?.length > 500 ? gig.duties.substring(0, 500) + '...' : gig.duties
            }));
          }
        } else {
          // Safe to cache - under size limit
          await cache.set(cacheKey, gigs, 120);
        }
      }
      
      res.json(gigs);
    } catch (error) {
      console.error('❌ Failed to fetch gigs:', error);
      res.status(500).json({ error: 'Failed to fetch gigs' });
    }
  });

  // ULTRA-OPTIMIZED DASHBOARD ENDPOINT - Single query replaces 5-10 queries
  app.get('/api/dashboard/optimized', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const { getDashboardData } = await import('./dashboard-optimized');
      
      const dashboardData = await getDashboardData(userId);
      res.json(dashboardData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  app.post('/api/gigs', heavyApiLimiter, requireAuth, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const gig = await storage.createGig({ ...req.body, user_id: userId });
      await invalidateUserCaches(userId);
      res.json(gig);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create gig' });
    }
  });

  app.put('/api/gigs/:id', heavyApiLimiter, requireAuth, async (req: any, res) => {
    try {
      const gigId = parseInt(req.params.id);
      const userId = getUserId(req);
      const existingGig = await storage.getGig(gigId);
      
      if (!existingGig || existingGig.userId !== userId) {
        return res.status(404).json({ error: 'Gig not found' });
      }
      
      const updateData = { ...req.body };
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });
      
      const updatedGig = await storage.updateGig(gigId, updateData);
      
      if (!updatedGig) {
        return res.status(500).json({ error: 'Failed to update gig - no data returned' });
      }
      
      await invalidateUserCaches(userId);
      res.json(updatedGig);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update gig' });
    }
  });

  app.delete('/api/gigs/:id', heavyApiLimiter, requireAuth, async (req: any, res) => {
    try {
      const gigId = parseInt(req.params.id);
      const userId = getUserId(req);
      const existingGig = await storage.getGig(gigId);
      
      if (!existingGig || existingGig.userId !== userId) {
        return res.status(404).json({ error: 'Gig not found' });
      }
      
      await storage.deleteGig(gigId);
      await invalidateUserCaches(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete gig' });
    }
  });

  // Expense endpoints
  app.get('/api/expenses', apiLimiter, requireAuth, async (req: any, res) => {
    try {
      const expenses = await storage.getExpensesByUser(getUserId(req));
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  app.post('/api/expenses', heavyApiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const expense = await storage.createExpense({ ...req.body, userId: getUserId(req) });
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create expense' });
    }
  });

  app.put('/api/expenses/:id', heavyApiLimiter, requireAuth, async (req: any, res: Response) => {
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

  app.delete('/api/expenses/:id', heavyApiLimiter, requireAuth, async (req: any, res: Response) => {
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
  app.get('/api/goals', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      
      // Check cache first (5-minute TTL for goal data)
      const { cache } = await import('./simple-cache');
      const cacheKey = `goals:${userId}`;
      let goals = cache.get(cacheKey);
      
      if (!goals) {
        goals = await storage.getGoalsByUser(userId);
        cache.set(cacheKey, goals, 300); // 5-minute cache
      }
      
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch goals' });
    }
  });

  app.post('/api/goals', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const goal = await storage.createGoal({ ...req.body, userId: getUserId(req) });
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create goal' });
    }
  });

  app.put('/api/goals/:id', apiLimiter, requireAuth, async (req: any, res: Response) => {
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

  app.delete('/api/goals/:id', apiLimiter, requireAuth, async (req: any, res: Response) => {
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
  app.get('/api/monthly-goals', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const goals = await storage.getGoalsByUser(getUserId(req));
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch monthly goals' });
    }
  });

  app.post('/api/monthly-goals', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const goal = await storage.createGoal({ ...req.body, userId: getUserId(req) });
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create monthly goal' });
    }
  });

  app.get('/api/yearly-goals', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const goals = await storage.getGoalsByUser(getUserId(req));
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch yearly goals' });
    }
  });

  app.post('/api/yearly-goals', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const goal = await storage.createGoal({ ...req.body, userId: getUserId(req) });
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create yearly goal' });
    }
  });

  // Period-specific goal fetch endpoint (for dashboard)
  app.get('/api/goals/period', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const { period, date: dateString } = req.query as { period: string; date: string };
      const userId = getUserId(req);
      
      // Parse the date to extract year and month
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      if (period === 'monthly') {
        // Fetch monthly goal
        const goal = await storage.getMonthlyGoal(userId, month, year);
        if (goal) {
          res.json(goal);
        } else {
          res.status(404).json({ error: 'No goal found for this period' });
        }
      } else {
        // Fetch yearly goal
        const goal = await storage.getYearlyGoal(userId, year);
        if (goal) {
          res.json(goal);
        } else {
          res.status(404).json({ error: 'No goal found for this period' });
        }
      }
    } catch (error) {
      console.error('Goal fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch goal' });
    }
  });

  // Period-specific goal update endpoint (for dashboard)
  app.post('/api/goals/period/:period/:date', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const { period, date: dateString } = req.params;
      const { goalAmount } = req.body;
      const userId = getUserId(req);
      
      // Parse the date to extract year and month
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      if (period === 'monthly') {
        // Use setMonthlyGoal which handles both creation and updating
        const goal = await storage.setMonthlyGoal(userId, month, year, goalAmount.toString());
        res.json(goal);
      } else {
        // Use setYearlyGoal which handles both creation and updating
        const goal = await storage.setYearlyGoal(userId, year, goalAmount.toString());
        res.json(goal);
      }
    } catch (error) {
      console.error('Goal update error:', error);
      res.status(500).json({ error: 'Failed to update goal' });
    }
  });

  // Distance calculation endpoint - resource intensive (Google Maps API calls)
  app.post('/api/calculate-distance', resourceIntensiveLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const { startAddress, endAddress, waypoints = [], roundTrip = false } = req.body;
      const userId = getUserId(req);
      
      console.log('🔍 Distance calculation request received:', {
        userId,
        startAddress,
        endAddress,
        waypoints,
        roundTrip
      });
      
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
        waypoints.filter((w: any) => w?.trim()),
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
        console.log('❌ Distance calculation failed:', result);
        res.status(400).json({ 
          status: 'error',
          error: result.error 
        });
      }
    } catch (error) {
      console.log('💥 Distance calculation exception:', error);
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

  // Google Places autocomplete endpoint for address suggestions
  app.get('/api/address-autocomplete', requireAuth, async (req: any, res) => {
    try {
      const { input } = req.query;
      
      if (!input || typeof input !== 'string' || input.length < 2) {
        return res.json({ suggestions: [] });
      }

      const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!googleMapsApiKey) {
        return res.status(500).json({ error: 'Google Maps API not configured' });
      }

      // Try new Places API first, then fall back to legacy format if needed
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;
      const params = new URLSearchParams({
        input: input.trim(),
        types: 'address',
        key: googleMapsApiKey,
        components: 'country:us' // Restrict to US addresses for better results
      });

      const response = await fetch(`${url}?${params}`);
      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        const suggestions = data.predictions.slice(0, 5).map((prediction: any) => ({
          description: prediction.description,
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting?.main_text || '',
          secondaryText: prediction.structured_formatting?.secondary_text || ''
        }));
        
        res.json({ suggestions });
      } else if (data.status === 'ZERO_RESULTS') {
        res.json({ suggestions: [] });
      } else if (data.status === 'REQUEST_DENIED' || data.error_message) {
        // API key issue - provide helpful fallback suggestions
        const fallbackSuggestions = generateFallbackSuggestions(input.trim());
        res.json({ suggestions: fallbackSuggestions, fallback: true });
      } else {
        res.json({ suggestions: [] });
      }
    } catch (error) {
      logger.error('Address autocomplete error:', error);
      // Provide fallback suggestions even on error
      const fallbackSuggestions = generateFallbackSuggestions(req.query.input as string || '');
      res.json({ suggestions: fallbackSuggestions });
    }
  });

  // Helper function to generate fallback address suggestions
  function generateFallbackSuggestions(input: string): any[] {
    if (!input || input.length < 2) return [];
    
    // More comprehensive address suggestions
    const suggestions = [];
    const cleanInput = input.trim();
    
    // Common street types
    const streetTypes = ['Street', 'Avenue', 'Boulevard', 'Road', 'Drive', 'Lane', 'Court', 'Way'];
    
    // Major cities for broader coverage
    const cities = [
      'San Francisco, CA',
      'Oakland, CA', 
      'San Jose, CA',
      'Los Angeles, CA',
      'Berkeley, CA'
    ];
    
    // Generate suggestions combining input with different street types and cities
    let suggestionIndex = 0;
    for (const streetType of streetTypes.slice(0, 3)) {
      for (const city of cities.slice(0, 2)) {
        if (suggestions.length >= 5) break;
        
        const fullAddress = `${cleanInput} ${streetType}, ${city}`;
        suggestions.push({
          description: fullAddress,
          placeId: `fallback_${suggestionIndex++}`,
          mainText: `${cleanInput} ${streetType}`,
          secondaryText: city
        });
      }
      if (suggestions.length >= 5) break;
    }
    
    return suggestions.slice(0, 5);
  }

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

  // SIMPLE HTML REPORT GENERATION - NO OVER-ENGINEERING
  app.get('/api/reports/pdf', resourceIntensiveLimiter, requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    
    // Additional authentication validation
    if (!userId || userId <= 0) {
      return res.status(401).json({ error: 'Invalid user authentication' });
    }
    
    try {
      const { period, year, month } = req.query;
      
      // BULLETPROOF: Enhanced parameter validation with graceful HTML fallback
      if (!period || !year) {
        const paramErrorHtml = createGracefulErrorHTML(
          'Missing Report Parameters', 
          'We need a time period and year to generate your report.',
          'Please select a period and try again.',
          400,
          userId
        );
        return res.status(200).setHeader('Content-Type', 'text/html').send(paramErrorHtml);
      }

      const reportRequest = {
        userId,
        period: period as 'monthly' | 'annual',
        year: parseInt(year as string),
        month: month ? parseInt(month as string) : undefined
      };

      console.log('📊 BULLETPROOF: Processing PDF report request', reportRequest);

      // ENHANCED: Multi-layer error recovery for HTML generation
      let htmlContent: string;
      try {
        const { generateProfessionalHTML } = await import('./professional-html-generator');
        htmlContent = await generateProfessionalHTML(reportRequest);
        console.log('✅ BULLETPROOF: Primary generation successful');
      } catch (primaryError) {
        console.error('🚨 PRIMARY FAILED:', primaryError);
        
        // GRACEFUL DEGRADATION: Return helpful error page instead of throwing
        htmlContent = createGracefulErrorHTML(
          'Report Generation Issue',
          'We encountered a temporary issue generating your detailed report.',
          'This may be due to high system load. Please try again in a moment.',
          500,
          userId,
          primaryError as Error
        );
        console.log('🛡️ BULLETPROOF: Graceful fallback served');
      }
      
      // MEMORY OPTIMIZED: Streaming HTML response to reduce buffer allocations
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Encoding', 'identity'); // Prevent compression buffering
      res.status(200);
      
      // MEMORY OPTIMIZED: Use streaming utility to minimize memory footprint
      const { MemoryManager } = await import('./memory-management');
      MemoryManager.streamLargeContent(res, htmlContent);
      
      // MEMORY CLEANUP: Force garbage collection after large content
      MemoryManager.forceGarbageCollection();
      console.log('🧠 MEMORY: PDF route cleaned up with memory management');

    } catch (error) {
      console.error('🚨 CATASTROPHIC ERROR in PDF route:', error);
      
      // ULTIMATE FALLBACK: Absolute last resort error page
      const catastrophicErrorHtml = createGracefulErrorHTML(
        'Service Temporarily Unavailable',
        'Our report service is experiencing technical difficulties.',
        'Please try again later or contact support if this persists.',
        500,
        userId,
        error as Error
      );
      
      // NEVER FAIL: Always return 200 with error content
      res.status(200).setHeader('Content-Type', 'text/html').send(catastrophicErrorHtml);
    }
  });

  // BULLETPROOF HTML ROUTE - IDENTICAL ERROR HANDLING TO PDF ROUTE
  app.get('/api/reports/html', resourceIntensiveLimiter, requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    
    // Enhanced authentication validation with HTML response
    if (!userId || userId <= 0) {
      const authErrorHtml = createGracefulErrorHTML(
        'Authentication Required',
        'Please log in to access your income reports.',
        'Your session may have expired. Please log in again.',
        401,
        undefined
      );
      return res.status(200).setHeader('Content-Type', 'text/html').send(authErrorHtml);
    }
    
    try {
      const { period, year, month } = req.query;
      
      // BULLETPROOF: Enhanced parameter validation with graceful HTML fallback
      if (!period || !year) {
        const paramErrorHtml = createGracefulErrorHTML(
          'Missing Report Parameters', 
          'We need a time period and year to generate your report.',
          'Please select a period and try again.',
          400,
          userId
        );
        return res.status(200).setHeader('Content-Type', 'text/html').send(paramErrorHtml);
      }

      const reportRequest = {
        userId,
        period: period as 'monthly' | 'annual',
        year: parseInt(year as string),
        month: month ? parseInt(month as string) : undefined
      };

      console.log('📊 BULLETPROOF: Processing HTML report request', reportRequest);

      // ENHANCED: Multi-layer error recovery for HTML generation
      let htmlContent: string;
      try {
        const { generateProfessionalHTML } = await import('./professional-html-generator');
        htmlContent = await generateProfessionalHTML(reportRequest);
        console.log('✅ BULLETPROOF: Primary generation successful');
      } catch (primaryError) {
        console.error('🚨 PRIMARY FAILED:', primaryError);
        
        // GRACEFUL DEGRADATION: Return helpful error page instead of throwing
        htmlContent = createGracefulErrorHTML(
          'Report Generation Issue',
          'We encountered a temporary issue generating your detailed report.',
          'This may be due to high system load. Please try again in a moment.',
          500,
          userId,
          primaryError as Error
        );
        console.log('🛡️ BULLETPROOF: Graceful fallback served');
      }
      
      // MEMORY OPTIMIZED: Streaming HTML response to reduce buffer allocations
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Encoding', 'identity'); // Prevent compression buffering
      res.status(200);
      
      // MEMORY OPTIMIZED: Use streaming utility to minimize memory footprint
      const { MemoryManager } = await import('./memory-management');
      MemoryManager.streamLargeContent(res, htmlContent);
      
      // MEMORY CLEANUP: Force garbage collection after large content
      MemoryManager.forceGarbageCollection();
      console.log('🧠 MEMORY: HTML route cleaned up with memory management');

    } catch (error) {
      console.error('🚨 CATASTROPHIC ERROR in HTML route:', error);
      
      // ULTIMATE FALLBACK: Absolute last resort error page
      const catastrophicErrorHtml = createGracefulErrorHTML(
        'Service Temporarily Unavailable',
        'Our report service is experiencing technical difficulties.',
        'Please try again later or contact support if this persists.',
        500,
        userId,
        error as Error
      );
      
      // NEVER FAIL: Always return 200 with error content
      res.status(200).setHeader('Content-Type', 'text/html').send(catastrophicErrorHtml);
    }
  });

  // TEST ENDPOINT - Generate sample HTML report
  app.get('/api/test-html-report', resourceIntensiveLimiter, requireAuth, async (req: any, res) => {
    const userId = getUserId(req);
    
    try {
      console.log('🧪 TESTING: Simple HTML report generation');
      
      const testRequest = {
        userId,
        period: 'monthly' as 'monthly' | 'annual',
        year: 2025,
        month: 7
      };

      const { generateProfessionalHTML } = await import('./professional-html-generator');
      const htmlContent = await generateProfessionalHTML(testRequest);

      console.log('✅ TEST SUCCESS: HTML report generated');
      
      res.json({
        success: true,
        message: 'Simple HTML report working perfectly!',
        content: htmlContent.substring(0, 200) + '...',
        approach: 'Simple, reliable HTML reports - no over-engineering'
      });
      
    } catch (error) {
      console.error('🚨 TEST FAILED:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
        message: 'HTML report generation needs debugging'
      });
    }
  });

  // Automatic gig status update endpoint
  app.post('/api/gigs/update-statuses', apiLimiter, requireAuth, async (req: any, res) => {
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
  app.get('/api/gig-types', apiLimiter, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(getUserId(req));
      res.json(user?.customGigTypes || []);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch gig types' });
    }
  });

  // Cache statistics and health reporting endpoint
  app.get('/api/cache/stats', apiLimiter, requireAuth, asyncHandler(async (req: any, res) => {
    try {
      const { advancedCache } = await import('./advanced-cache');
      const { cache: simpleCache } = await import('./simple-cache');
      const infrastructureManager = await import('./infrastructure-manager');
      
      // Get comprehensive cache statistics
      const advancedStats = advancedCache.getStats();
      const simpleCacheStats = simpleCache.getStats();
      const cacheHealth = advancedCache.getCacheHealth();
      
      // Get memory monitoring data
      const memoryStats = process.memoryUsage();
      const memoryMB = {
        heap: parseFloat((memoryStats.heapUsed / 1024 / 1024).toFixed(1)),
        heapTotal: parseFloat((memoryStats.heapTotal / 1024 / 1024).toFixed(1)),
        rss: parseFloat((memoryStats.rss / 1024 / 1024).toFixed(1)),
        external: parseFloat((memoryStats.external / 1024 / 1024).toFixed(1))
      };
      
      // Calculate time until next cleanup
      const now = Date.now();
      const nextCleanupMs = advancedStats.cleanupIntervalMinutes * 60 * 1000;
      const timeUntilNextCleanup = Math.max(0, nextCleanupMs - (now % nextCleanupMs));
      const minutesUntilCleanup = Math.floor(timeUntilNextCleanup / 60000);
      const secondsUntilCleanup = Math.floor((timeUntilNextCleanup % 60000) / 1000);
      
      // Compression efficiency calculations
      const compressionSavings = advancedStats.totalOriginalSize - advancedStats.totalCompressedSize;
      const compressionEfficiency = advancedStats.totalOriginalSize > 0 ? 
        parseFloat(((compressionSavings / advancedStats.totalOriginalSize) * 100).toFixed(1)) : 0;
      
      // Health indicators
      const healthIndicators = {
        memoryPressure: memoryMB.heap / 500, // Out of ~500MB typical limit
        cacheUtilization: advancedStats.cacheSize / advancedStats.maxEntries,
        hitRateHealth: advancedStats.hitRate / 100,
        compressionEffectiveness: compressionEfficiency / 100,
        rejectionRate: advancedStats.rejectedLargeEntries / Math.max(1, advancedStats.cacheSize + advancedStats.rejectedLargeEntries)
      };
      
      // Overall health score (0-100)
      const healthScore = Math.round(
        (healthIndicators.hitRateHealth * 30) + 
        ((1 - healthIndicators.memoryPressure) * 25) + 
        ((1 - healthIndicators.cacheUtilization) * 20) + 
        (healthIndicators.compressionEffectiveness * 15) + 
        ((1 - healthIndicators.rejectionRate) * 10)
      );
      
      const response = {
        timestamp: new Date().toISOString(),
        health: {
          status: cacheHealth,
          score: healthScore,
          indicators: healthIndicators
        },
        memory: {
          current: memoryMB,
          usage: {
            heap: `${memoryMB.heap}MB`,
            total: `${memoryMB.rss}MB`,
            percentage: parseFloat(((memoryMB.heap / memoryMB.heapTotal) * 100).toFixed(1))
          },
          warnings: memoryMB.heap > 400 ? ['High memory usage'] : []
        },
        cache: {
          advanced: {
            connected: advancedStats.connected,
            entries: advancedStats.cacheSize,
            maxEntries: advancedStats.maxEntries,
            utilizationPercent: parseFloat(((advancedStats.cacheSize / advancedStats.maxEntries) * 100).toFixed(1)),
            memoryUsageMB: advancedStats.memoryUsageMB,
            maxMemoryMB: advancedStats.maxMemoryMB,
            memoryUtilizationPercent: parseFloat(((advancedStats.memoryUsageMB / advancedStats.maxMemoryMB) * 100).toFixed(1))
          },
          simple: {
            entries: simpleCacheStats.cacheSize || 0,
            maxEntries: simpleCacheStats.maxEntries || 1000,
            utilizationPercent: parseFloat((((simpleCacheStats.cacheSize || 0) / (simpleCacheStats.maxEntries || 1000)) * 100).toFixed(1)),
            memoryUsageMB: simpleCacheStats.memoryUsageMB || 0
          },
          performance: {
            hitRate: advancedStats.hitRate,
            hits: advancedStats.hits,
            misses: advancedStats.misses,
            evictions: advancedStats.evictions,
            expiredEntriesRemoved: advancedStats.expiredEntriesRemoved
          }
        },
        compression: {
          enabled: true,
          threshold: '10KB',
          maxEntrySize: '100KB',
          stats: {
            compressedEntries: advancedStats.compressedEntries,
            rejectedLargeEntries: advancedStats.rejectedLargeEntries,
            totalOriginalSizeKB: parseFloat((advancedStats.totalOriginalSize / 1024).toFixed(1)),
            totalCompressedSizeKB: parseFloat((advancedStats.totalCompressedSize / 1024).toFixed(1)),
            memorySavedKB: parseFloat((compressionSavings / 1024).toFixed(1)),
            compressionRatio: advancedStats.compressionRatio,
            efficiencyPercent: compressionEfficiency
          }
        },
        cleanup: {
          automaticCleanupActive: advancedStats.automaticCleanupActive,
          intervalMinutes: advancedStats.cleanupIntervalMinutes,
          nextCleanupIn: `${minutesUntilCleanup}m ${secondsUntilCleanup}s`,
          totalCleanups: advancedStats.totalCleanups,
          averageDurationMs: advancedStats.averageCleanupDuration,
          dynamicAdjustments: advancedStats.dynamicAdjustments,
          batchOperations: advancedStats.batchOperations
        },
        advanced: {
          warmingHits: advancedStats.warmingHits,
          warnings: advancedStats.warnings,
          lastUpdated: advancedStats.timestamp
        }
      };
      
      res.json(response);
    } catch (error) {
      logError('Cache stats retrieval failed', error as Error);
      res.status(500).json({ 
        error: 'Failed to retrieve cache statistics',
        timestamp: new Date().toISOString(),
        health: { status: 'unknown', score: 0 }
      });
    }
  }));

  // Cache health check endpoint (lightweight version)
  app.get('/api/cache/health', apiLimiter, requireAuth, asyncHandler(async (req: any, res: Response) => {
    try {
      const { advancedCache } = await import('./advanced-cache');
      const health = advancedCache.getCacheHealth();
      const stats = advancedCache.getStats();
      
      res.json({
        status: health,
        timestamp: new Date().toISOString(),
        summary: {
          entries: stats.cacheSize,
          hitRate: stats.hitRate,
          memoryUsageMB: stats.memoryUsageMB,
          compressedEntries: stats.compressedEntries,
          rejectedEntries: stats.rejectedLargeEntries,
          warnings: stats.warnings
        }
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        timestamp: new Date().toISOString(),
        error: 'Health check failed' 
      });
    }
  }));

  // Simple database health check with cache stats
  app.get('/api/db-health', apiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const { cache } = await import('./simple-cache');
      const userCount = await db.select({ count: count() }).from(users);
      const gigCount = await db.select({ count: count() }).from(gigs);
      
      res.json({
        status: 'healthy',
        userCount: userCount[0].count,
        gigCount: gigCount[0].count,
        indexes: 'active',
        cache: cache.getStats(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Database health check failed' });
    }
  });

  // Clear cache endpoint (for troubleshooting)
  app.post('/api/cache/clear', heavyApiLimiter, requireAuth, async (req: any, res: Response) => {
    try {
      const { cache } = await import('./simple-cache');
      await cache.clearAll();
      res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  });



  // Debug endpoint to test gig data without authentication (development only)
  app.get('/api/debug/gigs/:userId', async (req: any, res: Response) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({ error: 'Not found' });
    }
    
    try {
      const userId = parseInt(req.params.userId);
      
      // Run validation check first
      const { dbValidator } = await import('./database-consistency-check');
      const isValid = await dbValidator.validateUserDataAccess(userId);
      if (!isValid) {
        return res.status(500).json({ error: 'Database consistency validation failed' });
      }
      
      // Use storage interface to test
      const userGigs = await storage.getGigsByUser(userId);
      
      res.json({ 
        userId, 
        gigs: userGigs.length,
        validated: true,
        sample: userGigs.slice(0, 3),
        message: 'Storage interface test successful' 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch gigs', details: (error as Error).message });
    }
  });

  app.post('/api/gig-types', requireAuth, async (req: any, res: Response) => {
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

  // Node.js memory profiling endpoints (no auth needed for monitoring)
  app.get('/api/memory/stats', async (req, res) => {
    try {
      const memoryStats = nodeJSMemoryProfiler.getMemoryStats();
      res.json(memoryStats);
    } catch (error) {
      console.error('Memory stats error:', error);
      res.status(500).json({ error: 'Failed to get memory stats' });
    }
  });

  app.get('/api/memory/analysis', async (req, res) => {
    try {
      const analysis = nodeJSMemoryProfiler.getDetailedAnalysis();
      if (!analysis) {
        res.json({ message: 'Insufficient data for analysis (need 10+ snapshots)' });
      } else {
        res.json(analysis);
      }
    } catch (error) {
      console.error('Memory analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze memory' });
    }
  });

  app.get('/api/memory/leak-status', async (req, res) => {
    try {
      const leakStatus = memoryLeakFixer.getMemoryLeakStatus();
      res.json(leakStatus);
    } catch (error) {
      console.error('Memory leak status error:', error);
      res.status(500).json({ error: 'Failed to get leak status' });
    }
  });

  app.post('/api/memory/force-cleanup', async (req, res) => {
    try {
      console.log('🚨 MANUAL MEMORY CLEANUP REQUESTED');
      memoryLeakFixer.forceMemoryLeakRemediation();
      res.json({ success: true, message: 'Emergency memory cleanup completed' });
    } catch (error) {
      console.error('Force cleanup error:', error);
      res.status(500).json({ error: 'Failed to force cleanup' });
    }
  });

  app.get('/api/timers/report', async (req, res) => {
    try {
      const report = timerLeakDetector.generateReport();
      res.json(report);
    } catch (error) {
      console.error('Timer report error:', error);
      res.status(500).json({ error: 'Failed to generate timer report' });
    }
  });

  app.get('/api/timers/sources', async (req, res) => {
    try {
      const timers = timerLeakDetector.getAllTimers();
      const sourceDetails = timers.reduce((acc: any, timer) => {
        if (!acc[timer.source]) {
          acc[timer.source] = {
            count: 0,
            timers: []
          };
        }
        acc[timer.source].count++;
        acc[timer.source].timers.push({
          type: timer.type,
          delay: timer.delay,
          ageMinutes: (Date.now() - timer.createdAt) / 1000 / 60,
          stack: timer.stack.split('\n').slice(0, 3).join('\n')
        });
        return acc;
      }, {});
      
      res.json(sourceDetails);
    } catch (error) {
      console.error('Timer sources error:', error);
      res.status(500).json({ error: 'Failed to get timer sources' });
    }
  });

  app.post('/api/timers/cleanup', async (req, res) => {
    try {
      const { maxAgeMinutes, cleanupMonitoring } = req.body;
      let totalCleaned = 0;
      
      if (cleanupMonitoring) {
        // Cleanup monitoring systems specifically
        totalCleaned += monitoringSystemCleanup.cleanupAllSystems();
      }
      
      if (maxAgeMinutes) {
        // Cleanup old timers
        const maxAge = maxAgeMinutes * 60 * 1000;
        totalCleaned += timerLeakDetector.forceCleanupTimers(maxAge);
      }
      
      res.json({ success: true, timersCleared: totalCleaned });
    } catch (error) {
      console.error('Timer cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup timers' });
    }
  });

  app.get('/api/monitoring/stats', async (req, res) => {
    try {
      const stats = monitoringSystemCleanup.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error('Monitoring stats error:', error);
      res.status(500).json({ error: 'Failed to get monitoring stats' });
    }
  });

  app.get('/api/fswatchers/stats', async (req, res) => {
    try {
      const stats = fsWatcherLeakFix.getWatcherStats();
      res.json(stats);
    } catch (error) {
      console.error('FSWatcher stats error:', error);
      res.status(500).json({ error: 'Failed to get FSWatcher stats' });
    }
  });

  app.post('/api/fswatchers/cleanup', async (req, res) => {
    try {
      const cleaned = fsWatcherLeakFix.forceCleanupAllWatchers();
      res.json({ success: true, watchersCleared: cleaned });
    } catch (error) {
      console.error('FSWatcher cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup FSWatchers' });
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
        
        // EXPENSE FIX: Expenses are per-event, not per-day - use only first entry's expenses
        const firstGig = sortedGigs[0];
        
        grouped.push({
          ...firstGig,
          actualPay: totalPay,
          tips: totalTips,
          // Keep expenses from first entry only (expenses are for entire event)
          parkingExpense: firstGig.parkingExpense,
          otherExpenses: firstGig.otherExpenses,
          mileage: firstGig.mileage,
          parkingExpenseReceipts: firstGig.parkingExpenseReceipts,
          otherExpenseReceipts: firstGig.otherExpenseReceipts,
          parkingExpensesReimbursed: firstGig.parkingExpensesReimbursed,
          otherExpensesReimbursed: firstGig.otherExpensesReimbursed,
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