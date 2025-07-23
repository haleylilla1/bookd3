/**
 * DASHBOARD OPTIMIZATION: Single-query dashboard data with aggressive caching
 * Eliminates N+1 problems, reduces 5-10 queries to 1 query per user
 */

import { db } from "./db";
import { users, gigs, monthlyGoals, yearlyGoals } from "@shared/schema";
import { eq, and, gte, lte, sql, count, sum } from "drizzle-orm";
import { cache } from "./simple-cache";

interface DashboardData {
  user: {
    id: number;
    email: string;
    username: string;
    name: string;
    homeAddress: string | null;
    defaultTaxPercentage: number;
    customGigTypes: string[];
  };
  monthlyStats: {
    actualEarnings: number;
    projectedEarnings: number;
    totalGigs: number;
    completedGigs: number;
    upcomingGigs: number;
    pendingPaymentGigs: number;
    totalExpenses: number;
    estimatedTaxes: number;
    goal: number | null;
  };
  annualStats: {
    actualEarnings: number;
    projectedEarnings: number;
    totalGigs: number;
    completedGigs: number;
    upcomingGigs: number;
    pendingPaymentGigs: number;
    totalExpenses: number;
    estimatedTaxes: number;
    goal: number | null;
  };
  recentGigs: Array<{
    id: number;
    eventName: string;
    clientName: string;
    gigType: string;
    date: string;
    status: string;
    expectedPay: string;
    actualPay: string;
  }>;
}

// ULTRA-OPTIMIZED: Single database query for complete dashboard
export async function getDashboardData(userId: number): Promise<DashboardData> {
  const cacheKey = `dashboard:${userId}`;
  
  // Check cache first (2-minute TTL for dashboard data)
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached as DashboardData;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  // Month boundaries
  const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const monthEnd = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;
  
  // Year boundaries  
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  try {
    // SINGLE MEGA-QUERY: Fetch everything in one go using Common Table Expressions
    const result = await db.execute(sql`
      WITH user_data AS (
        SELECT 
          id, email, username, name, 
          "homeAddress", "defaultTaxPercentage", "customGigTypes"
        FROM users 
        WHERE id = ${userId}
      ),
      monthly_gigs AS (
        SELECT 
          id, "eventName", "clientName", "gigType", date, status,
          "expectedPay", "actualPay", tips, "taxPercentage",
          "parkingExpense", "otherExpenses"
        FROM gigs 
        WHERE "userId" = ${userId} 
          AND date >= ${monthStart} 
          AND date <= ${monthEnd}
      ),
      annual_gigs AS (
        SELECT 
          id, "eventName", "clientName", "gigType", date, status,
          "expectedPay", "actualPay", tips, "taxPercentage",
          "parkingExpense", "otherExpenses"
        FROM gigs 
        WHERE "userId" = ${userId} 
          AND date >= ${yearStart} 
          AND date <= ${yearEnd}
      ),
      monthly_stats AS (
        SELECT 
          COUNT(*) as total_gigs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_gigs,
          COUNT(CASE WHEN status = 'upcoming' THEN 1 END) as upcoming_gigs,
          COUNT(CASE WHEN status = 'pending_payment' THEN 1 END) as pending_payment_gigs,
          COALESCE(SUM(
            CASE WHEN status = 'completed' 
            THEN COALESCE(NULLIF("actualPay", '')::numeric, NULLIF("expectedPay", '')::numeric, 0) + COALESCE(NULLIF(tips, '')::numeric, 0)
            ELSE 0 END
          ), 0) as actual_earnings,
          COALESCE(SUM(
            COALESCE(NULLIF("actualPay", '')::numeric, NULLIF("expectedPay", '')::numeric, 0) + COALESCE(NULLIF(tips, '')::numeric, 0)
          ), 0) as projected_earnings,
          COALESCE(SUM(
            COALESCE(NULLIF("parkingExpense", '')::numeric, 0) + COALESCE(NULLIF("otherExpenses", '')::numeric, 0)
          ), 0) as total_expenses,
          COALESCE(SUM(
            (COALESCE(NULLIF("expectedPay", '')::numeric, 0) + COALESCE(NULLIF(tips, '')::numeric, 0)) * 
            (COALESCE("taxPercentage", 23) / 100.0)
          ), 0) as estimated_taxes
        FROM monthly_gigs
      ),
      annual_stats AS (
        SELECT 
          COUNT(*) as annual_total_gigs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as annual_completed_gigs,
          COUNT(CASE WHEN status = 'upcoming' THEN 1 END) as annual_upcoming_gigs,
          COUNT(CASE WHEN status = 'pending_payment' THEN 1 END) as annual_pending_payment_gigs,
          COALESCE(SUM(
            CASE WHEN status = 'completed' 
            THEN COALESCE(NULLIF("actualPay", '')::numeric, NULLIF("expectedPay", '')::numeric, 0) + COALESCE(NULLIF(tips, '')::numeric, 0)
            ELSE 0 END
          ), 0) as annual_actual_earnings,
          COALESCE(SUM(
            COALESCE(NULLIF("actualPay", '')::numeric, NULLIF("expectedPay", '')::numeric, 0) + COALESCE(NULLIF(tips, '')::numeric, 0)
          ), 0) as annual_projected_earnings,
          COALESCE(SUM(
            COALESCE(NULLIF("parkingExpense", '')::numeric, 0) + COALESCE(NULLIF("otherExpenses", '')::numeric, 0)
          ), 0) as annual_total_expenses,
          COALESCE(SUM(
            (COALESCE(NULLIF("expectedPay", '')::numeric, 0) + COALESCE(NULLIF(tips, '')::numeric, 0)) * 
            (COALESCE("taxPercentage", 23) / 100.0)
          ), 0) as annual_estimated_taxes
        FROM annual_gigs
      ),
      recent_gigs AS (
        SELECT 
          id, "eventName", "clientName", "gigType", date, status,
          "expectedPay", "actualPay"
        FROM gigs 
        WHERE "userId" = ${userId}
        ORDER BY date DESC 
        LIMIT 10
      ),
      monthly_goal AS (
        SELECT "goalAmount"
        FROM "monthlyGoals" 
        WHERE "userId" = ${userId} AND month = ${currentMonth} AND year = ${currentYear}
        LIMIT 1
      ),
      annual_goal AS (
        SELECT "goalAmount"
        FROM "yearlyGoals" 
        WHERE "userId" = ${userId} AND year = ${currentYear}
        LIMIT 1
      )
      SELECT 
        u.*,
        ms.*,
        ans.*,
        mg."goalAmount" as monthly_goal,
        ag."goalAmount" as annual_goal,
        COALESCE(json_agg(
          json_build_object(
            'id', rg.id,
            'eventName', rg."eventName",
            'clientName', rg."clientName", 
            'gigType', rg."gigType",
            'date', rg.date,
            'status', rg.status,
            'expectedPay', rg."expectedPay",
            'actualPay', rg."actualPay"
          ) ORDER BY rg.date DESC
        ) FILTER (WHERE rg.id IS NOT NULL), '[]'::json) as recent_gigs
      FROM user_data u
      CROSS JOIN monthly_stats ms
      CROSS JOIN annual_stats ans  
      LEFT JOIN monthly_goal mg ON true
      LEFT JOIN annual_goal ag ON true
      LEFT JOIN recent_gigs rg ON true
      GROUP BY 
        u.id, u.email, u.username, u.name, u."homeAddress", u."defaultTaxPercentage", u."customGigTypes",
        ms.total_gigs, ms.completed_gigs, ms.upcoming_gigs, ms.pending_payment_gigs, 
        ms.actual_earnings, ms.projected_earnings, ms.total_expenses, ms.estimated_taxes,
        ans.annual_total_gigs, ans.annual_completed_gigs, ans.annual_upcoming_gigs, ans.annual_pending_payment_gigs,
        ans.annual_actual_earnings, ans.annual_projected_earnings, ans.annual_total_expenses, ans.annual_estimated_taxes,
        mg."goalAmount", ag."goalAmount"
    `);

    if (!result.rows || result.rows.length === 0) {
      throw new Error('User not found');
    }

    const row = result.rows[0] as any;

    const dashboardData: DashboardData = {
      user: {
        id: row.id,
        email: row.email,
        username: row.username,
        name: row.name,
        homeAddress: row.homeAddress,
        defaultTaxPercentage: row.defaultTaxPercentage || 23,
        customGigTypes: row.customGigTypes || []
      },
      monthlyStats: {
        actualEarnings: parseFloat(row.actual_earnings) || 0,
        projectedEarnings: parseFloat(row.projected_earnings) || 0,
        totalGigs: parseInt(row.total_gigs) || 0,
        completedGigs: parseInt(row.completed_gigs) || 0,
        upcomingGigs: parseInt(row.upcoming_gigs) || 0,
        pendingPaymentGigs: parseInt(row.pending_payment_gigs) || 0,
        totalExpenses: parseFloat(row.total_expenses) || 0,
        estimatedTaxes: parseFloat(row.estimated_taxes) || 0,
        goal: row.monthly_goal ? parseFloat(row.monthly_goal) : null
      },
      annualStats: {
        actualEarnings: parseFloat(row.annual_actual_earnings) || 0,
        projectedEarnings: parseFloat(row.annual_projected_earnings) || 0,
        totalGigs: parseInt(row.annual_total_gigs) || 0,
        completedGigs: parseInt(row.annual_completed_gigs) || 0,
        upcomingGigs: parseInt(row.annual_upcoming_gigs) || 0,
        pendingPaymentGigs: parseInt(row.annual_pending_payment_gigs) || 0,
        totalExpenses: parseFloat(row.annual_total_expenses) || 0,
        estimatedTaxes: parseFloat(row.annual_estimated_taxes) || 0,
        goal: row.annual_goal ? parseFloat(row.annual_goal) : null
      },
      recentGigs: Array.isArray(row.recent_gigs) ? row.recent_gigs : []
    };

    // Cache for 2 minutes (aggressive caching for dashboard)
    cache.set(cacheKey, dashboardData, 120);
    
    return dashboardData;

  } catch (error) {
    console.error('Dashboard query failed:', error);
    throw new Error('Failed to fetch dashboard data');
  }
}

// Cache invalidation when user data changes
export async function invalidateDashboardCache(userId: number) {
  await cache.invalidate(`dashboard:${userId}`);
  await cache.invalidate(`user:${userId}`);
  await cache.invalidate(`gigs:${userId}`);
}

// Batch user data fetching (for admin/analytics)
export async function getBatchUserStats(userIds: number[]) {
  const cacheKey = `batch:users:${userIds.sort().join(',')}`;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await db.execute(sql`
      SELECT 
        u.id,
        u.email,
        u.username,
        COUNT(g.id) as total_gigs,
        COALESCE(SUM(
          CASE WHEN g.status = 'completed'
          THEN COALESCE(NULLIF(g."actualPay", '')::numeric, NULLIF(g."expectedPay", '')::numeric, 0) + COALESCE(NULLIF(g.tips, '')::numeric, 0)
          ELSE 0 END
        ), 0) as total_earnings,
        COUNT(CASE WHEN g.status = 'completed' THEN 1 END) as completed_gigs
      FROM users u
      LEFT JOIN gigs g ON u.id = g."userId"
      WHERE u.id = ANY(${userIds})
      GROUP BY u.id, u.email, u.username
      ORDER BY total_earnings DESC
    `);

    const stats = result.rows || [];
    
    // Cache for 5 minutes
    cache.set(cacheKey, stats, 300);
    
    return stats;

  } catch (error) {
    console.error('Batch user stats query failed:', error);
    throw new Error('Failed to fetch batch user stats');
  }
}