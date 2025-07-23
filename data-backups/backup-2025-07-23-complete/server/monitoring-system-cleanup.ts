/**
 * Monitoring System Cleanup - Consolidates and optimizes timer-heavy monitoring systems
 * Addresses the timer accumulation from multiple monitoring systems
 */

interface CleanupTarget {
  name: string;
  intervals: NodeJS.Timeout[];
  timeouts: NodeJS.Timeout[];
  isActive: boolean;
}

export class MonitoringSystemCleanup {
  private cleanupTargets: Map<string, CleanupTarget> = new Map();
  private consolidatedInterval?: NodeJS.Timeout;

  constructor() {
    this.startConsolidatedMonitoring();
  }

  /**
   * Register a monitoring system for cleanup tracking
   */
  registerSystem(name: string): CleanupTarget {
    const target: CleanupTarget = {
      name,
      intervals: [],
      timeouts: [],
      isActive: true
    };
    
    this.cleanupTargets.set(name, target);
    console.log(`🏥 MONITORING CLEANUP: Registered ${name} for tracking`);
    return target;
  }

  /**
   * Add interval to tracking for a specific system
   */
  trackInterval(systemName: string, interval: NodeJS.Timeout): void {
    const target = this.cleanupTargets.get(systemName);
    if (target) {
      target.intervals.push(interval);
    }
  }

  /**
   * Add timeout to tracking for a specific system
   */
  trackTimeout(systemName: string, timeout: NodeJS.Timeout): void {
    const target = this.cleanupTargets.get(systemName);
    if (target) {
      target.timeouts.push(timeout);
    }
  }

  /**
   * Cleanup a specific monitoring system
   */
  cleanupSystem(systemName: string): number {
    const target = this.cleanupTargets.get(systemName);
    if (!target) return 0;

    let cleaned = 0;

    // Clear all intervals
    target.intervals.forEach(interval => {
      try {
        clearInterval(interval);
        cleaned++;
      } catch (error) {
        console.error(`Error clearing interval for ${systemName}:`, error);
      }
    });

    // Clear all timeouts
    target.timeouts.forEach(timeout => {
      try {
        clearTimeout(timeout);
        cleaned++;
      } catch (error) {
        console.error(`Error clearing timeout for ${systemName}:`, error);
      }
    });

    // Reset the target
    target.intervals = [];
    target.timeouts = [];
    target.isActive = false;

    console.log(`🧹 MONITORING CLEANUP: Cleaned ${cleaned} timers from ${systemName}`);
    return cleaned;
  }

  /**
   * Cleanup all monitoring systems
   */
  cleanupAllSystems(): number {
    let totalCleaned = 0;
    
    this.cleanupTargets.forEach((target, systemName) => {
      totalCleaned += this.cleanupSystem(systemName);
    });

    console.log(`🧹 MONITORING CLEANUP: Total cleaned ${totalCleaned} timers from all systems`);
    return totalCleaned;
  }

  /**
   * Start consolidated monitoring to reduce timer proliferation
   */
  private startConsolidatedMonitoring(): void {
    // Single interval for all monitoring tasks
    this.consolidatedInterval = setInterval(() => {
      this.performConsolidatedChecks();
    }, 2 * 60 * 1000); // Every 2 minutes

    console.log('🏥 MONITORING CLEANUP: Started consolidated monitoring (2min interval)');
  }

  /**
   * Perform all monitoring checks in a single consolidated interval
   */
  private performConsolidatedChecks(): void {
    const memUsage = process.memoryUsage();
    const heapMB = memUsage.heapUsed / 1024 / 1024;
    
    console.log(`🏥 CONSOLIDATED MONITORING: Heap ${heapMB.toFixed(1)}MB`);
    
    // Check for timer proliferation
    let totalTimers = 0;
    this.cleanupTargets.forEach(target => {
      const timerCount = target.intervals.length + target.timeouts.length;
      totalTimers += timerCount;
      
      if (timerCount > 5) {
        console.log(`⚠️  HIGH TIMER COUNT: ${target.name} has ${timerCount} active timers`);
      }
    });

    if (totalTimers > 20) {
      console.log(`🚨 TIMER PROLIFERATION: ${totalTimers} total monitored timers`);
    }

    // Memory pressure checks
    if (heapMB > 110) {
      console.log('⚠️  HIGH MEMORY: Consider cleaning up monitoring systems');
    }
  }

  /**
   * Get monitoring system statistics
   */
  getSystemStats(): any {
    const stats: any = {
      registeredSystems: this.cleanupTargets.size,
      totalIntervals: 0,
      totalTimeouts: 0,
      systems: {}
    };

    this.cleanupTargets.forEach((target, name) => {
      const intervalCount = target.intervals.length;
      const timeoutCount = target.timeouts.length;
      
      stats.totalIntervals += intervalCount;
      stats.totalTimeouts += timeoutCount;
      stats.systems[name] = {
        intervals: intervalCount,
        timeouts: timeoutCount,
        total: intervalCount + timeoutCount,
        active: target.isActive
      };
    });

    return stats;
  }

  /**
   * Shutdown all monitoring and cleanup
   */
  shutdown(): void {
    console.log('🏥 MONITORING CLEANUP: Shutting down all systems');
    
    // Cleanup all registered systems
    this.cleanupAllSystems();
    
    // Clear consolidated monitoring
    if (this.consolidatedInterval) {
      clearInterval(this.consolidatedInterval);
      this.consolidatedInterval = undefined;
    }
    
    console.log('✅ MONITORING CLEANUP: Shutdown complete');
  }
}

// Global monitoring system cleanup instance
export const monitoringSystemCleanup = new MonitoringSystemCleanup();