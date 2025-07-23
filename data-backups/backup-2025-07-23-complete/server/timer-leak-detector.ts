/**
 * Timer Leak Detector - Identifies and tracks all timer sources
 * Addresses the 121 active handles causing memory leaks
 */

interface TimerInfo {
  id: NodeJS.Timeout | number;
  type: 'interval' | 'timeout';
  source: string;
  stack: string;
  createdAt: number;
  delay: number;
  isActive: boolean;
}

interface TimerStats {
  totalActiveTimers: number;
  intervalCount: number;
  timeoutCount: number;
  oldestTimer: number;
  timersBySource: Record<string, number>;
  suspiciousTimers: TimerInfo[];
}

export class TimerLeakDetector {
  private timers: Map<NodeJS.Timeout | number, TimerInfo> = new Map();
  private originalSetInterval: typeof setInterval;
  private originalSetTimeout: typeof setTimeout;
  private originalClearInterval: typeof clearInterval;
  private originalClearTimeout: typeof clearTimeout;
  private auditInterval?: NodeJS.Timeout;

  constructor() {
    // Store original functions
    this.originalSetInterval = global.setInterval;
    this.originalSetTimeout = global.setTimeout;
    this.originalClearInterval = global.clearInterval;
    this.originalClearTimeout = global.clearTimeout;

    this.setupTimerTracking();
    this.startTimerAudit();
  }

  private setupTimerTracking(): void {
    console.log('🔍 TIMER LEAK DETECTOR: Setting up comprehensive timer tracking');

    // Override setInterval with tracking
    global.setInterval = (callback: any, delay: number, ...args: any[]): any => {
      const stack = this.captureStack();
      const source = this.extractSource(stack);
      
      const timer = this.originalSetInterval(callback, delay, ...args);
      
      this.timers.set(timer, {
        id: timer,
        type: 'interval',
        source,
        stack,
        createdAt: Date.now(),
        delay,
        isActive: true
      });

      console.log(`⏱️  INTERVAL CREATED: ${source} (delay: ${delay}ms) - Total active: ${this.timers.size}`);
      return timer;
    };

    // Override setTimeout with tracking
    global.setTimeout = (callback: any, delay: number, ...args: any[]): any => {
      const stack = this.captureStack();
      const source = this.extractSource(stack);
      
      const timer = this.originalSetTimeout((...callbackArgs) => {
        // Mark as completed when timeout fires
        const timerInfo = this.timers.get(timer);
        if (timerInfo) {
          timerInfo.isActive = false;
          this.timers.delete(timer);
        }
        callback(...callbackArgs);
      }, delay, ...args);
      
      this.timers.set(timer, {
        id: timer,
        type: 'timeout',
        source,
        stack,
        createdAt: Date.now(),
        delay,
        isActive: true
      });

      console.log(`⏰ TIMEOUT CREATED: ${source} (delay: ${delay}ms) - Total active: ${this.timers.size}`);
      return timer;
    };

    // Override clearInterval with tracking
    global.clearInterval = (timer: any): void => {
      const timerInfo = this.timers.get(timer);
      if (timerInfo) {
        timerInfo.isActive = false;
        this.timers.delete(timer);
        console.log(`🗑️  INTERVAL CLEARED: ${timerInfo.source} - Total active: ${this.timers.size}`);
      }
      
      this.originalClearInterval(timer);
    };

    // Override clearTimeout with tracking
    global.clearTimeout = (timer: any): void => {
      const timerInfo = this.timers.get(timer);
      if (timerInfo) {
        timerInfo.isActive = false;
        this.timers.delete(timer);
        console.log(`🗑️  TIMEOUT CLEARED: ${timerInfo.source} - Total active: ${this.timers.size}`);
      }
      
      this.originalClearTimeout(timer);
    };
  }

  private captureStack(): string {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const err = new Error();
    const stack = err.stack as unknown as NodeJS.CallSite[];
    Error.prepareStackTrace = orig;
    
    return stack
      .slice(3) // Skip timer detector frames
      .map(frame => `${frame.getFunctionName() || 'anonymous'}@${frame.getFileName()}:${frame.getLineNumber()}`)
      .join('\n');
  }

  private extractSource(stack: string): string {
    const lines = stack.split('\n');
    
    // Look for meaningful source files (avoid node_modules)
    for (const line of lines) {
      if (line.includes('server/') && !line.includes('node_modules')) {
        const match = line.match(/([^/]+\.ts):/);
        if (match) {
          const functionMatch = line.match(/^([^@]+)@/);
          const functionName = functionMatch ? functionMatch[1] : 'anonymous';
          return `${match[1]}:${functionName}`;
        }
      }
    }
    
    // Fallback to first non-internal line
    for (const line of lines) {
      if (!line.includes('node_modules') && !line.includes('internal/')) {
        return line.split('@')[0] || 'unknown';
      }
    }
    
    return 'unknown';
  }

  private startTimerAudit(): void {
    // Use original setInterval to avoid tracking this audit timer
    this.auditInterval = this.originalSetInterval.call(global, () => {
      this.performTimerAudit();
    }, 60 * 1000); // Every minute
  }

  private performTimerAudit(): void {
    const stats = this.getTimerStats();
    const processHandles = (process as any)._getActiveHandles?.() || [];
    const processRequests = (process as any)._getActiveRequests?.() || [];

    console.log('🔍 COMPREHENSIVE TIMER AUDIT');
    console.log('============================');
    console.log(`Process Handles: ${processHandles.length}`);
    console.log(`Process Requests: ${processRequests.length}`);
    console.log(`Tracked Timers: ${stats.totalActiveTimers}`);
    console.log(`Intervals: ${stats.intervalCount}`);
    console.log(`Timeouts: ${stats.timeoutCount}`);
    
    if (stats.totalActiveTimers > 0) {
      console.log('\nTimer Sources:');
      Object.entries(stats.timersBySource).forEach(([source, count]) => {
        console.log(`  ${source}: ${count} timers`);
      });
    }

    if (stats.suspiciousTimers.length > 0) {
      console.log('\n⚠️  SUSPICIOUS TIMERS (>5 minutes old):');
      stats.suspiciousTimers.forEach(timer => {
        const age = (Date.now() - timer.createdAt) / 1000 / 60;
        console.log(`  ${timer.source}: ${timer.type} (${age.toFixed(1)}min old, ${timer.delay}ms delay)`);
      });
    }

    // Check for handle leaks
    const unaccountedHandles = processHandles.length - stats.totalActiveTimers;
    if (unaccountedHandles > 10) {
      console.log(`\n🚨 HANDLE LEAK: ${unaccountedHandles} unaccounted process handles`);
      this.investigateUnaccountedHandles(processHandles);
    }

    console.log('============================\n');
  }

  private investigateUnaccountedHandles(handles: any[]): void {
    const handleTypes: Record<string, number> = {};
    
    handles.forEach(handle => {
      const type = handle.constructor?.name || 'unknown';
      handleTypes[type] = (handleTypes[type] || 0) + 1;
    });

    console.log('Handle Types:');
    Object.entries(handleTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  getTimerStats(): TimerStats {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const stats: TimerStats = {
      totalActiveTimers: this.timers.size,
      intervalCount: 0,
      timeoutCount: 0,
      oldestTimer: now,
      timersBySource: {},
      suspiciousTimers: []
    };

    this.timers.forEach(timer => {
      if (!timer.isActive) return;

      if (timer.type === 'interval') {
        stats.intervalCount++;
      } else {
        stats.timeoutCount++;
      }

      // Track by source
      stats.timersBySource[timer.source] = (stats.timersBySource[timer.source] || 0) + 1;

      // Find oldest timer
      if (timer.createdAt < stats.oldestTimer) {
        stats.oldestTimer = timer.createdAt;
      }

      // Flag suspicious long-running timers
      if (timer.createdAt < fiveMinutesAgo) {
        stats.suspiciousTimers.push(timer);
      }
    });

    return stats;
  }

  getAllTimers(): TimerInfo[] {
    return Array.from(this.timers.values()).filter(timer => timer.isActive);
  }

  getTimersBySource(source: string): TimerInfo[] {
    return Array.from(this.timers.values()).filter(timer => 
      timer.isActive && timer.source.includes(source)
    );
  }

  forceCleanupTimers(maxAge?: number): number {
    const cutoff = maxAge ? Date.now() - maxAge : Date.now() - (10 * 60 * 1000); // 10 minutes default
    let cleaned = 0;

    console.log('🧹 FORCE CLEANUP: Clearing old timers');

    this.timers.forEach((timer, id) => {
      if (timer.createdAt < cutoff && timer.isActive) {
        console.log(`🗑️  Force clearing: ${timer.source} (${timer.type}, ${((Date.now() - timer.createdAt) / 1000 / 60).toFixed(1)}min old)`);
        
        if (timer.type === 'interval') {
          this.originalClearInterval.call(global, id as NodeJS.Timeout);
        } else {
          this.originalClearTimeout.call(global, id as NodeJS.Timeout);
        }
        
        timer.isActive = false;
        this.timers.delete(id);
        cleaned++;
      }
    });

    console.log(`✅ Force cleanup completed: ${cleaned} timers cleared`);
    return cleaned;
  }

  destroy(): void {
    // Clear audit interval
    if (this.auditInterval) {
      this.originalClearInterval.call(global, this.auditInterval);
    }

    // Restore original functions
    global.setInterval = this.originalSetInterval;
    global.setTimeout = this.originalSetTimeout;
    global.clearInterval = this.originalClearInterval;
    global.clearTimeout = this.originalClearTimeout;

    console.log('🔍 TIMER LEAK DETECTOR: Tracking disabled and original functions restored');
  }

  generateReport(): any {
    const stats = this.getTimerStats();
    const processHandles = (process as any)._getActiveHandles?.()?.length || 0;
    
    return {
      summary: {
        trackedTimers: stats.totalActiveTimers,
        processHandles,
        unaccountedHandles: processHandles - stats.totalActiveTimers,
        intervalCount: stats.intervalCount,
        timeoutCount: stats.timeoutCount
      },
      sources: stats.timersBySource,
      suspiciousTimers: stats.suspiciousTimers.map(timer => ({
        source: timer.source,
        type: timer.type,
        ageMinutes: (Date.now() - timer.createdAt) / 1000 / 60,
        delay: timer.delay
      })),
      oldestTimerAge: stats.totalActiveTimers > 0 ? (Date.now() - stats.oldestTimer) / 1000 / 60 : 0
    };
  }
}

// Global timer leak detector instance
export const timerLeakDetector = new TimerLeakDetector();