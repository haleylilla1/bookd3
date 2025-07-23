/**
 * Phase 3: Unified Monitoring System
 * Consolidates 4+ separate monitoring systems into a single efficient monitor
 * Reduces timer overhead from 20+ timers to 2-3 optimized timers
 */

import { logger } from './logger';
import os from 'os';

interface UnifiedMetrics {
  timestamp: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    utilization: number;
  };
  timers: {
    intervals: number;
    timeouts: number;
    total: number;
  };
  watchers: {
    fsWatchers: number;
  };
  activity: {
    level: 'low' | 'medium' | 'high';
    score: number;
  };
}

export class UnifiedMonitoring {
  private static instance: UnifiedMonitoring;
  private metrics: UnifiedMetrics[] = [];
  private maxMetrics = 50; // Keep last 50 snapshots only
  private primaryInterval?: NodeJS.Timeout;
  private secondaryInterval?: NodeJS.Timeout;
  private isActive = false;
  private activityScore = 0;
  private lastActivity = Date.now();
  
  // Phase 3: Smart monitoring thresholds
  private readonly ACTIVITY_THRESHOLD = 60; // Points needed for "high activity"
  private readonly MEMORY_CRITICAL = 95; // % utilization
  private readonly TIMER_WARNING = 30; // Number of active timers
  
  constructor() {
    console.log('🎯 PHASE 3: Initializing unified monitoring system');
  }
  
  static getInstance(): UnifiedMonitoring {
    if (!UnifiedMonitoring.instance) {
      UnifiedMonitoring.instance = new UnifiedMonitoring();
    }
    return UnifiedMonitoring.instance;
  }
  
  /**
   * Start unified monitoring with smart intervals
   */
  start(): void {
    if (this.isActive) {
      console.log('⚠️  UNIFIED MONITORING: Already active, skipping start');
      return;
    }
    
    this.isActive = true;
    console.log('🚀 PHASE 3: Starting unified monitoring with smart intervals');
    
    // Primary monitoring: Every 2 minutes (reduced from 30s)
    this.primaryInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeActivity();
    }, 2 * 60 * 1000);
    
    // Secondary monitoring: Only during high activity (adaptive)
    this.scheduleSmartMonitoring();
    
    // Collect initial metrics
    this.collectMetrics();
    
    logger.info('Unified monitoring started - primary: 2min, secondary: adaptive');
  }
  
  /**
   * Smart monitoring that only activates during high activity
   */
  private scheduleSmartMonitoring(): void {
    this.secondaryInterval = setInterval(() => {
      const activityLevel = this.getActivityLevel();
      
      if (activityLevel === 'high') {
        console.log('🔥 HIGH ACTIVITY: Running additional monitoring check');
        this.collectMetrics();
        this.checkCriticalSystems();
      }
    }, 60 * 1000); // Check every minute, but only act during high activity
  }
  
  /**
   * Collect comprehensive system metrics
   */
  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    const processHandles = (process as any)._getActiveHandles?.() || [];
    
    // Count different types of handles
    const fsWatchers = processHandles.filter((h: any) => 
      h.constructor?.name === 'FSWatcher'
    ).length;
    
    // Get timer count from our timer leak detector if available
    let intervalCount = 0;
    let timeoutCount = 0;
    
    // Estimate timers (simplified since we can't easily count all)
    const totalTimers = processHandles.length;
    
    const metrics: UnifiedMetrics = {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        utilization: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100 * 100) / 100
      },
      timers: {
        intervals: intervalCount,
        timeouts: timeoutCount,
        total: totalTimers
      },
      watchers: {
        fsWatchers
      },
      activity: {
        level: this.getActivityLevel(),
        score: this.activityScore
      }
    };
    
    // Add to metrics queue
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift(); // Remove oldest
    }
    
    // Log important events
    this.logImportantEvents(metrics);
  }
  
  /**
   * Calculate current activity level
   */
  private getActivityLevel(): 'low' | 'medium' | 'high' {
    if (this.activityScore >= this.ACTIVITY_THRESHOLD) {
      return 'high';
    } else if (this.activityScore >= 30) {
      return 'medium';
    }
    return 'low';
  }
  
  /**
   * Analyze system activity and update score
   */
  private analyzeActivity(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    // Decay activity score over time
    if (timeSinceLastActivity > 5 * 60 * 1000) { // 5 minutes
      this.activityScore = Math.max(0, this.activityScore - 10);
    }
    
    // Check for activity indicators
    const latest = this.metrics[this.metrics.length - 1];
    if (latest) {
      // High memory usage indicates activity
      if (latest.memory.utilization > 90) {
        this.activityScore += 15;
        this.lastActivity = now;
      }
      
      // Many timers indicate activity
      if (latest.timers.total > this.TIMER_WARNING) {
        this.activityScore += 10;
        this.lastActivity = now;
      }
      
      // Cap the score
      this.activityScore = Math.min(100, this.activityScore);
    }
  }
  
  /**
   * Check critical systems during high activity
   */
  private checkCriticalSystems(): void {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;
    
    // Critical memory check
    if (latest.memory.utilization >= this.MEMORY_CRITICAL) {
      console.log(`🚨 CRITICAL MEMORY: ${latest.memory.utilization}% utilization`);
      this.triggerEmergencyCleanup();
    }
    
    // Timer proliferation check
    if (latest.timers.total > this.TIMER_WARNING) {
      console.log(`⚠️  TIMER WARNING: ${latest.timers.total} active handles`);
    }
    
    // FSWatcher check
    if (latest.watchers.fsWatchers > 10) {
      console.log(`👁️  WATCHER WARNING: ${latest.watchers.fsWatchers} active FSWatchers`);
    }
  }
  
  /**
   * Trigger emergency cleanup
   */
  private triggerEmergencyCleanup(): void {
    console.log('🧹 UNIFIED MONITORING: Triggering emergency cleanup');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️  Forced garbage collection');
    }
    
    // Reduce activity score to prevent repeated triggers
    this.activityScore = Math.max(0, this.activityScore - 30);
  }
  
  /**
   * Log important events
   */
  private logImportantEvents(metrics: UnifiedMetrics): void {
    const { memory, activity, timers } = metrics;
    
    // Only log during significant events to reduce noise
    if (memory.utilization > 90 || activity.level === 'high' || timers.total > 25) {
      console.log(`🏥 UNIFIED MONITOR: Memory ${memory.utilization}%, Activity ${activity.level} (${activity.score}), Handles ${timers.total}`);
    }
  }
  
  /**
   * Get current system status
   */
  getStatus() {
    const latest = this.metrics[this.metrics.length - 1];
    return {
      isActive: this.isActive,
      metricsCount: this.metrics.length,
      activityLevel: this.getActivityLevel(),
      activityScore: this.activityScore,
      latest: latest || null
    };
  }
  
  /**
   * Stop all monitoring
   */
  stop(): void {
    if (this.primaryInterval) {
      clearInterval(this.primaryInterval);
      this.primaryInterval = undefined;
    }
    
    if (this.secondaryInterval) {
      clearInterval(this.secondaryInterval);
      this.secondaryInterval = undefined;
    }
    
    this.isActive = false;
    console.log('🛑 UNIFIED MONITORING: Stopped all monitoring intervals');
  }
  
  /**
   * Update activity score (called by external systems)
   */
  recordActivity(points: number = 5): void {
    this.activityScore = Math.min(100, this.activityScore + points);
    this.lastActivity = Date.now();
  }
}

// Export singleton instance
export const unifiedMonitoring = UnifiedMonitoring.getInstance();