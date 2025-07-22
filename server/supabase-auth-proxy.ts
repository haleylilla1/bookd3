import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    supabaseUserId?: string;
    supabaseAccessToken?: string;
    supabaseEmail?: string;
  }
}

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function signUpProxy(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password are required' } });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: { message: 'Password must be at least 6 characters long' } });
    }

    // Create user with Supabase Admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: name ? { name } : {},
      email_confirm: true // Auto-confirm for development
    });

    if (error) {
      console.error('Supabase signup error:', error);
      return res.status(400).json({ error: { message: error.message } });
    }

    if (data.user) {
      console.log('✅ User created successfully:', data.user.email);
      
      // User created successfully, no need for session link in auto-confirm mode

      return res.status(201).json({ 
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name
        },
        message: 'Account created successfully'
      });
    }

    return res.status(500).json({ error: { message: 'Failed to create user' } });

  } catch (error: any) {
    console.error('Signup proxy error:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}

export async function signInProxy(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password are required' } });
    }

    // Sign in with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase signin error:', error);
      return res.status(401).json({ error: { message: error.message || 'Invalid email or password' } });
    }

    if (data.user && data.session) {
      console.log('✅ User signed in successfully:', data.user.email);
      
      // Ensure session exists and store session info
      if (!req.session) {
        return res.status(500).json({ error: { message: 'Session not initialized' } });
      }
      
      req.session.supabaseUserId = data.user.id;
      req.session.supabaseAccessToken = data.session.access_token;
      req.session.supabaseEmail = data.user.email;

      return res.json({ 
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name
        }
      });
    }

    return res.status(500).json({ error: { message: 'Failed to sign in' } });

  } catch (error: any) {
    console.error('Signin proxy error:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}

export async function signOutProxy(req: Request, res: Response) {
  try {
    // Clear server-side session
    if (req.session && req.session.supabaseAccessToken) {
      // Optionally invalidate Supabase session
      await supabaseAdmin.auth.admin.signOut(req.session.supabaseAccessToken);
    }

    req.session.destroy((err: any) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ error: { message: 'Failed to sign out' } });
      }
      
      res.clearCookie('connect.sid');
      return res.json({ message: 'Signed out successfully' });
    });

  } catch (error: any) {
    console.error('Signout proxy error:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}

export async function getCurrentUserProxy(req: Request, res: Response) {
  try {
    // Check if session exists first
    if (!req.session || !req.session.supabaseUserId) {
      return res.status(401).json({ error: { message: 'Not authenticated' } });
    }

    // Get user from Supabase
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(req.session.supabaseUserId);

    if (error || !data.user) {
      console.error('Get user error:', error);
      return res.status(401).json({ error: { message: 'Session invalid' } });
    }

    return res.json({
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name
    });

  } catch (error: any) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}

export async function resetPasswordProxy(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: { message: 'Email is required' } });
    }

    // Generate password reset link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (error) {
      console.error('Password reset error:', error);
      return res.status(400).json({ error: { message: error.message } });
    }

    console.log('✅ Password reset link generated for:', email);
    
    // In production, you would send this link via email
    // For development, log it or return it
    return res.json({ 
      message: 'Password reset link sent to your email',
      // In development only:
      resetLink: process.env.NODE_ENV === 'development' ? data.properties?.action_link : undefined
    });

  } catch (error: any) {
    console.error('Reset password proxy error:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}

// Middleware to check authentication
export function requireSupabaseAuth(req: Request, res: Response, next: any) {
  if (!req.session.supabaseUserId) {
    return res.status(401).json({ error: { message: 'Authentication required' } });
  }
  next();
}