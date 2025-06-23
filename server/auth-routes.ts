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
      
      console.log('Registration attempt:', { email, name, hasPassword: !!password });
      
      // Enhanced validation
      if (!email || !password || !name) {
        console.log('Missing required fields');
        return res.status(400).json({ message: 'Email, password, and name are required' });
      }

      // Trim and normalize inputs
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedName = name.trim();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }

      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        console.log('Email already exists:', normalizedEmail);
        return res.status(400).json({ message: 'An account with this email already exists. Please try logging in instead.' });
      }

      const user = await storage.createUserWithPassword(normalizedEmail, password, normalizedName);
      console.log('User created successfully:', { id: user.id, email: user.email });
      
      await storage.logAudit(user.id, 'REGISTER', 'users', user.id, null, { email: normalizedEmail, name: normalizedName });

      req.login(user, (err) => {
        if (err) {
          console.error('Login after registration error:', err);
          return res.status(500).json({ message: 'Account created successfully, but automatic login failed. Please try logging in manually.' });
        }
        console.log('Registration and login successful for:', user.email);
        res.json({ 
          message: 'Registration successful', 
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email
          } 
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    console.log('Login attempt for email:', req.body.email);
    
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login authentication error:', err);
        return res.status(500).json({ message: 'Authentication server error' });
      }
      
      if (!user) {
        console.log('Login failed for email:', req.body.email, 'Info:', info);
        return res.status(401).json({ 
          message: info?.message || 'Invalid email or password' 
        });
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Login session error:', loginErr);
          return res.status(500).json({ message: 'Session creation failed' });
        }
        
        console.log('Login successful for user:', user.email);
        res.json({ 
          message: 'Login successful', 
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email 
          } 
        });
      });
    })(req, res, next);
  });

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

  // Test endpoint for debugging authentication
  app.get('/api/auth/test', (req, res) => {
    console.log('Auth test - Session ID:', req.sessionID);
    console.log('Auth test - Is authenticated:', req.isAuthenticated());
    console.log('Auth test - User:', req.user);
    console.log('Auth test - Session:', req.session);
    
    res.json({
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      user: req.user || null,
      sessionData: req.session
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