import type { Express } from "express";
import passport from "passport";
import { storage } from "./storage";
import { setupGoogleAuth, setupLocalAuth, setupPassportSerialization } from "./authStrategies";

export function setupAuthRoutes(app: Express) {
  // Initialize passport strategies
  setupGoogleAuth();
  setupLocalAuth();
  setupPassportSerialization();
  
  app.use(passport.initialize());
  app.use(passport.session());

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Authentication required' });
  };

  // Google OAuth routes
  app.get('/api/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { 
      failureRedirect: '/login?error=google_auth_failed',
      failureFlash: false 
    }),
    (req, res) => {
      console.log('Google auth successful for user:', req.user);
      res.redirect('/');
    }
  );

  // Local authentication routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: 'Email, password, and name are required' });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const user = await storage.createUserWithPassword(email, password, name);
      await storage.logAudit(user.id, 'REGISTER', 'users', user.id, null, { email, name });

      req.login(user, (err) => {
        if (err) {
          console.error('Login after registration error:', err);
          return res.status(500).json({ message: 'Registration successful but login failed' });
        }
        res.json({ message: 'Registration successful', user: { id: user.id, name: user.name, email: user.email } });
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  app.post('/api/auth/login',
    passport.authenticate('local'),
    (req, res) => {
      res.json({ message: 'Login successful', user: req.user });
    }
  );

  app.post('/api/auth/logout', (req, res) => {
    const userId = (req.user as any)?.id;
    if (userId) {
      storage.logAudit(userId, 'LOGOUT', 'users', userId, null, null);
    }
    
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Session destroy error:', destroyErr);
        }
        
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
      });
    });
  });

  // Get current authenticated user
  app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // Data export routes
  app.post('/api/auth/export-data', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.requestDataExport(userId, 'full_export');
      res.json({ message: 'Data export requested. You will receive an email when ready.' });
    } catch (error) {
      console.error('Data export request error:', error);
      res.status(500).json({ message: 'Failed to request data export' });
    }
  });

  app.get('/api/auth/export-data', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const exportData = await storage.getUserExportData(userId);
      await storage.logAudit(userId, 'EXPORT', 'users', userId, null, null);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="giggy-data-export-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error('Data export error:', error);
      res.status(500).json({ message: 'Failed to export data' });
    }
  });

  return requireAuth;
}