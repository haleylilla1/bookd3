import bcrypt from 'bcryptjs';
import { storage } from './storage';

// Simple session store in memory (for development)
const sessions = new Map<string, { userId: number; expires: number }>();

export function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function createSession(userId: number): string {
  const sessionId = generateSessionId();
  const expires = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
  sessions.set(sessionId, { userId, expires });
  return sessionId;
}

export function getSession(sessionId: string): { userId: number } | null {
  const session = sessions.get(sessionId);
  if (!session || session.expires < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { userId: session.userId };
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

// Simple auth middleware with bulletproof user isolation
export function requireAuth(req: any, res: any, next: any) {
  const sessionId = req.cookies?.sessionId;
  const session = sessionId ? getSession(sessionId) : null;
  
  if (!session || !session.userId || session.userId <= 0) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  req.userId = session.userId;
  next();
}

// Auth routes
export function setupAuthRoutes(app: any) {
  // Login
  app.post('/api/auth/login', async (req: any, res: any) => {
    try {
      const { email, password } = req.body;
      const user = await storage.validatePassword(email, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const sessionId = createSession(user.id);
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax'
      });
      
      res.json({ 
        message: "Login successful", 
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Register
  app.post('/api/auth/register', async (req: any, res: any) => {
    try {
      const { email, password, name } = req.body;
      const user = await storage.createUserWithPassword(email, password, name);
      
      const sessionId = createSession(user.id);
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });
      
      res.json({ 
        message: "Registration successful", 
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req: any, res: any) => {
    const sessionId = req.cookies?.sessionId;
    if (sessionId) {
      destroySession(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ message: "Logout successful" });
  });

  // Get current user
  app.get('/api/user', requireAuth, async (req: any, res: any) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, name: user.name, email: user.email });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });
}