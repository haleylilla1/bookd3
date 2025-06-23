import type { Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { storage } from "./storage";

const PgSession = connectPgSimple(session);

// Session configuration
export function createSessionConfig() {
  return session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET!,
    name: "giggy.session",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
    },
  });
}

// Passport strategies
function setupStrategies() {
  // Local strategy
  passport.use(new LocalStrategy(
    { usernameField: "email" },
    async (email: string, password: string, done) => {
      try {
        const user = await storage.validatePassword(email.trim().toLowerCase(), password);
        if (user) {
          await storage.logAudit(user.id, 'LOGIN', 'users', user.id, null, null);
          return done(null, user);
        }
        return done(null, false, { message: "Invalid email or password" });
      } catch (error) {
        console.error("Local auth error:", error);
        return done(error);
      }
    }
  ));

  // Google strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await storage.upsertUserByGoogleId(
          profile.id,
          {
            name: profile.displayName || profile.name?.givenName + " " + profile.name?.familyName || "Google User",
            email: profile.emails?.[0]?.value ?? undefined,
            googleId: profile.id,
          }
        );
        await storage.logAudit(user.id, 'LOGIN_GOOGLE', 'users', user.id, null, null);
        return done(null, user);
      } catch (error) {
        console.error("Google auth error:", error);
        return done(error);
      }
    }));
  }

  // Serialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

// Authentication middleware
export const requireAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Authentication required' });
};

// Setup complete authentication system
export function setupAuth(app: Express) {
  // Session middleware
  app.use(createSessionConfig());
  
  // Initialize strategies
  setupStrategies();
  
  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Routes
  setupAuthRoutes(app);
}

function setupAuthRoutes(app: Express) {
  // Google OAuth
  app.get('/api/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { 
      failureRedirect: '/login?error=google_auth_failed',
      failureFlash: false 
    }),
    (req, res) => {
      console.log('Google auth successful');
      res.redirect('/');
    }
  );

  // Local auth
  app.post('/api/auth/login', (req, res, next) => {
    console.log('Login attempt:', req.body.email);
    
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error('Auth error:', err);
        return res.status(500).json({ message: 'Authentication failed' });
      }
      
      if (!user) {
        console.log('Login failed:', info?.message);
        return res.status(401).json({ 
          message: info?.message || 'Invalid credentials' 
        });
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Session error:', loginErr);
          return res.status(500).json({ message: 'Session creation failed' });
        }
        
        console.log('Login successful:', user.email);
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

  // Registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      
      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const user = await storage.createUserWithPassword(normalizedEmail, password, name.trim());
      await storage.logAudit(user.id, 'REGISTER', 'users', user.id, null, null);

      req.login(user, (err) => {
        if (err) {
          console.error('Post-registration login error:', err);
          return res.status(500).json({ message: 'Registration successful, please login' });
        }
        
        console.log('Registration successful:', user.email);
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
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Logout
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
        res.clearCookie('giggy.session');
        res.json({ message: 'Logout successful' });
      });
    });
  });

  // Current user
  app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // Debug endpoint
  app.get('/api/auth/debug', (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      user: req.user || null,
      cookies: req.headers.cookie
    });
  });
}