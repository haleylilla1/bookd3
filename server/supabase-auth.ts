import { createClient } from '@supabase/supabase-js'
import type { Request, Response, NextFunction } from 'express'

const supabaseUrl = process.env.SUPABASE_URL || 'https://gwywiuigckemgngpmbxf.supabase.co'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Extended request type with user info
export interface AuthenticatedRequest extends Request {
  userId: string
  userEmail: string
}

// Middleware to verify Supabase JWT token
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' })
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Add user info to request
    ;(req as AuthenticatedRequest).userId = user.id
    ;(req as AuthenticatedRequest).userEmail = user.email || ''
    
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

// Helper to get user ID from authenticated request
export function getUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest
  if (!authReq.userId) {
    throw new Error('User not authenticated')
  }
  return authReq.userId
}

/**
 * Gets the database user ID (integer) for the current Supabase authenticated user
 * This is the key function all data endpoints should use instead of getUserId
 */
export function getDatabaseUserId(req: Request): number | null {
  // First get the Supabase user ID
  const supabaseUserId = getUserId(req);
  
  // Import mapping function dynamically to avoid circular imports
  const { getDatabaseUserIdFromSupabase } = require('./user-id-mapping');
  
  return getDatabaseUserIdFromSupabase(supabaseUserId);
}