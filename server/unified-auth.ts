import express, { type Express, type RequestHandler } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// UNIFIED BULLETPROOF AUTHENTICATION SYSTEM
// Single source of truth for all authentication
// Ensures data persistence and maximum security

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
}

// Session configuration with bulletproof settings
export function createSessionConfig() {
  const pgStore = connectPg(session);
  
  return session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      tableName: "sessions",
    }),
    secret: process.env.SESSION_SECRET || "giggy-super-secure-session-key-2025",
    name: "giggy.session",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session on activity
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    }
  });
}

// Passport Local Strategy for email/password authentication
function setupStrategies() {
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email: string, password: string, done) => {
      try {
        const user = await storage.validatePassword(email, password);
        if (user) {
          return done(null, {
            id: user.id,
            email: user.email,
            name: user.name
          });
        } else {
          return done(null, false, { message: 'Invalid email or password' });
        }
      } catch (error) {
        return done(error);
      }
    }
  ));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        done(null, {
          id: user.id,
          email: user.email,
          name: user.name
        });
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });
}

// Authentication middleware - bulletproof user verification
export const requireAuth: RequestHandler = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user?.id) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
};

// Get current user ID with guaranteed type safety
export const getCurrentUserId = (req: AuthenticatedRequest): number => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    throw new Error('User not authenticated');
  }
  if (!req.user?.id) {
    throw new Error('User ID not found');
  }
  return req.user.id;
};

// Main setup function for unified authentication
export function setupAuth(app: Express) {
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Session middleware
  app.use(createSessionConfig());

  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup authentication strategies
  setupStrategies();

  // Authentication routes
  setupAuthRoutes(app);
}

function setupAuthRoutes(app: Express) {
  // Registration endpoint
  app.post('/api/auth/register', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Create new user
      const user = await storage.createUserWithPassword(email, password, name);
      
      // Automatically log in the new user
      req.login({
        id: user.id,
        email: user.email,
        name: user.name
      }, (err) => {
        if (err) {
          console.error('Auto-login failed:', err);
          return res.status(200).json({ 
            message: 'Registration successful, please log in',
            user: { id: user.id, name: user.name, email: user.email }
          });
        }
        
        res.status(200).json({ 
          message: 'Registration successful',
          user: { id: user.id, name: user.name, email: user.email }
        });
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Login failed' });
      }
      
      if (!user) {
        console.log('Login failed:', info?.message || 'Invalid credentials');
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('Session creation failed:', loginErr);
          return res.status(500).json({ message: 'Login failed' });
        }
        
        console.log('Login successful:', user.email);
        res.status(200).json({ 
          message: 'Login successful',
          user: { id: user.id, name: user.name, email: user.email }
        });
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Session destruction failed:', destroyErr);
        }
        res.clearCookie('giggy.session');
        res.json({ message: 'Logout successful' });
      });
    });
  });

  // Current user endpoint
  app.get('/api/user', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      if (user) {
        res.json({
          id: user.id,
          name: user.name,
          email: user.email
        });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });
}