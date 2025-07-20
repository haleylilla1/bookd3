import { logger } from './logger';
import { monitoringSystem } from './monitoring-system';
import { backupSystem } from './backup-system';
import { integrityChecker } from './database-integrity';
import { advancedCache } from './advanced-cache';
import fs from 'fs/promises';
import path from 'path';

interface InfrastructureHealth {
  status: 'healthy' | 'warning' | 'critical';
  services: {
    database: 'online' | 'offline' | 'degraded';
    backup: 'active' | 'inactive' | 'failed';
    monitoring: 'running' | 'stopped' | 'error';
  };
  resources: {
    memory: number;
    cpu: number;
    disk: number;
  };
  alerts: string[];
  recommendations: string[];
}

interface ServiceCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  responseTime: number;
}

export class InfrastructureManager {
  private healthChecks: ServiceCheck[] = [];
  private alertThresholds = {
    memory: 90,
    cpu: 95,
    disk: 95,
    responseTime: 5000
  };
  
  private memoryThresholds = {
    warning: 400, // 400MB warning threshold
    critical: 500, // 500MB emergency cleanup threshold
    lastCleanup: 0 // Track last emergency cleanup time
  };

  constructor() {
    // Don't start automatically - will be started explicitly
  }

  /**
   * Start simplified health monitoring
   */
  startHealthMonitoring(): void {
    // Run health checks every 5 minutes (reduced frequency)
    setInterval(() => {
      this.runHealthChecks();
    }, 5 * 60 * 1000);

    // Run memory monitoring every 30 seconds for responsive memory management
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 30 * 1000);

    // Run initial health check after 3 minutes
    setTimeout(() => {
      this.runHealthChecks();
    }, 3 * 60 * 1000);

    // Start memory monitoring immediately
    this.monitorMemoryUsage();

    logger.info('Infrastructure monitoring started - health checks every 5 minutes, memory monitoring every 30 seconds');
  }

  /**
   * Run comprehensive health checks
   */
  async runHealthChecks(): Promise<ServiceCheck[]> {
    const checks: ServiceCheck[] = [];

    try {
      // Database health check
      checks.push(await this.checkDatabaseHealth());

      // Backup system health check
      checks.push(await this.checkBackupHealth());

      // System resource check (includes memory monitoring)
      checks.push(await this.checkSystemResources());
      
      // Memory-specific check
      checks.push(await this.checkMemoryHealth());

      // Monitoring system check
      checks.push(await this.checkMonitoringHealth());

      // Application health check
      checks.push(await this.checkApplicationHealth());

      this.healthChecks = checks;

      // Log health summary
      const healthyChecks = checks.filter(c => c.status === 'healthy').length;
      const warningChecks = checks.filter(c => c.status === 'warning').length;
      const criticalChecks = checks.filter(c => c.status === 'critical').length;

      logger.info('Health checks completed', {
        total: checks.length,
        healthy: healthyChecks,
        warning: warningChecks,
        critical: criticalChecks
      });

      // Alert on critical issues
      if (criticalChecks > 0) {
        const criticalMessages = checks
          .filter(c => c.status === 'critical')
          .map(c => `${c.name}: ${c.message}`);
        
        logger.error('CRITICAL INFRASTRUCTURE ALERT', {
          criticalIssues: criticalMessages
        });
      }

      return checks;
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      return [{
        name: 'System Health',
        status: 'critical',
        message: `Health check failed: ${error.message}`,
        responseTime: 0
      }];
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceCheck> {
    const startTime = Date.now();
    
    try {
      const healthCheck = await integrityChecker.checkHealth();
      const responseTime = Date.now() - startTime;

      return {
        name: 'Database',
        status: healthCheck.healthy ? 'healthy' : 'warning',
        message: healthCheck.healthy 
          ? `Database healthy - ${healthCheck.userCount} users, ${healthCheck.gigCount} gigs`
          : healthCheck.message,
        responseTime
      };
    } catch (error) {
      return {
        name: 'Database',
        status: 'critical',
        message: `Database check failed: ${error.message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check backup system health
   */
  private async checkBackupHealth(): Promise<ServiceCheck> {
    const startTime = Date.now();
    
    try {
      const backupInfo = await backupSystem.getBackupInfo();
      const responseTime = Date.now() - startTime;

      if (backupInfo.count === 0) {
        return {
          name: 'Backup System',
          status: 'warning',
          message: 'No backups found',
          responseTime
        };
      }

      const lastBackupTime = backupInfo.lastBackup ? new Date(backupInfo.lastBackup) : null;
      const now = new Date();
      const hoursSinceBackup = lastBackupTime 
        ? (now.getTime() - lastBackupTime.getTime()) / (1000 * 60 * 60)
        : 999;

      if (hoursSinceBackup > 25) { // Should backup daily
        return {
          name: 'Backup System',
          status: 'warning',
          message: `Last backup ${hoursSinceBackup.toFixed(1)} hours ago`,
          responseTime
        };
      }

      return {
        name: 'Backup System',
        status: 'healthy',
        message: `${backupInfo.count} backups, last: ${hoursSinceBackup.toFixed(1)}h ago`,
        responseTime
      };
    } catch (error) {
      return {
        name: 'Backup System',
        status: 'critical',
        message: `Backup check failed: ${error.message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check system resources
   */
  private async checkSystemResources(): Promise<ServiceCheck> {
    const startTime = Date.now();
    
    try {
      const metrics = monitoringSystem.getCurrentStatus();
      const responseTime = Date.now() - startTime;

      const issues: string[] = [];
      
      if (metrics.memory.percentage > this.alertThresholds.memory) {
        issues.push(`Memory ${metrics.memory.percentage.toFixed(1)}%`);
      }
      
      if (metrics.cpu.percentage > this.alertThresholds.cpu) {
        issues.push(`CPU ${metrics.cpu.percentage.toFixed(1)}%`);
      }

      if (issues.length > 0) {
        return {
          name: 'System Resources',
          status: issues.length > 1 ? 'critical' : 'warning',
          message: `High usage: ${issues.join(', ')}`,
          responseTime
        };
      }

      return {
        name: 'System Resources',
        status: 'healthy',
        message: `Memory ${metrics.memory.percentage.toFixed(1)}%, CPU ${metrics.cpu.percentage.toFixed(1)}%`,
        responseTime
      };
    } catch (error) {
      return {
        name: 'System Resources',
        status: 'critical',
        message: `Resource check failed: ${error.message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check monitoring system health
   */
  private async checkMonitoringHealth(): Promise<ServiceCheck> {
    const startTime = Date.now();
    
    try {
      const summary = monitoringSystem.getHealthSummary();
      const responseTime = Date.now() - startTime;

      return {
        name: 'Monitoring System',
        status: summary.status === 'healthy' ? 'healthy' : 'warning',
        message: summary.status === 'healthy' 
          ? `Monitoring active - uptime ${summary.uptime}`
          : `Monitoring issues: ${summary.issues.join(', ')}`,
        responseTime
      };
    } catch (error) {
      return {
        name: 'Monitoring System',
        status: 'critical',
        message: `Monitoring check failed: ${error.message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check application health
   */
  private async checkApplicationHealth(): Promise<ServiceCheck> {
    const startTime = Date.now();
    
    try {
      // Check if essential services are responsive
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;

      const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      return {
        name: 'Application',
        status: 'healthy',
        message: `Running ${Math.floor(uptime / 60)}m, using ${memoryMB}MB`,
        responseTime
      };
    } catch (error) {
      return {
        name: 'Application',
        status: 'critical',
        message: `Application check failed: ${error.message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get current infrastructure health
   */
  async getInfrastructureHealth(): Promise<InfrastructureHealth> {
    const checks = await this.runHealthChecks();
    const metrics = monitoringSystem.getCurrentStatus();
    
    // Determine service statuses
    const dbCheck = checks.find(c => c.name === 'Database');
    const backupCheck = checks.find(c => c.name === 'Backup System');
    const monitoringCheck = checks.find(c => c.name === 'Monitoring System');

    const services = {
      database: this.mapServiceStatus(dbCheck?.status || 'critical'),
      backup: this.mapBackupStatus(backupCheck?.status || 'critical'),
      monitoring: this.mapMonitoringStatus(monitoringCheck?.status || 'critical')
    };

    // Get resource usage
    const resources = {
      memory: metrics.memory.percentage,
      cpu: metrics.cpu.percentage,
      disk: 0 // Not easily measurable in Node.js
    };

    // Generate alerts
    const alerts: string[] = [];
    const criticalChecks = checks.filter(c => c.status === 'critical');
    const warningChecks = checks.filter(c => c.status === 'warning');

    criticalChecks.forEach(check => {
      alerts.push(`CRITICAL: ${check.name} - ${check.message}`);
    });

    warningChecks.forEach(check => {
      alerts.push(`WARNING: ${check.name} - ${check.message}`);
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks, metrics);

    // Determine overall status
    const overallStatus = criticalChecks.length > 0 ? 'critical' :
                         warningChecks.length > 0 ? 'warning' : 'healthy';

    return {
      status: overallStatus,
      services,
      resources,
      alerts,
      recommendations
    };
  }

  /**
   * Map service status
   */
  private mapServiceStatus(status: string): 'online' | 'offline' | 'degraded' {
    switch (status) {
      case 'healthy': return 'online';
      case 'warning': return 'degraded';
      case 'critical': return 'offline';
      default: return 'offline';
    }
  }

  /**
   * Map backup status
   */
  private mapBackupStatus(status: string): 'active' | 'inactive' | 'failed' {
    switch (status) {
      case 'healthy': return 'active';
      case 'warning': return 'inactive';
      case 'critical': return 'failed';
      default: return 'failed';
    }
  }

  /**
   * Map monitoring status
   */
  private mapMonitoringStatus(status: string): 'running' | 'stopped' | 'error' {
    switch (status) {
      case 'healthy': return 'running';
      case 'warning': return 'stopped';
      case 'critical': return 'error';
      default: return 'error';
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(checks: ServiceCheck[], metrics: any): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (metrics.memory.percentage > 80) {
      recommendations.push('Consider optimizing memory usage or increasing server resources');
    }

    // CPU recommendations
    if (metrics.cpu.percentage > 70) {
      recommendations.push('Monitor CPU usage for performance bottlenecks');
    }

    // Database recommendations
    const dbCheck = checks.find(c => c.name === 'Database');
    if (dbCheck && dbCheck.responseTime > 1000) {
      recommendations.push('Database response time is slow, consider query optimization');
    }

    // Backup recommendations
    const backupCheck = checks.find(c => c.name === 'Backup System');
    if (backupCheck && backupCheck.status !== 'healthy') {
      recommendations.push('Review backup system configuration and logs');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('System is operating within normal parameters');
    }

    return recommendations;
  }

  /**
   * Get recent health check results
   */
  getRecentHealthChecks(): ServiceCheck[] {
    return this.healthChecks;
  }

  /**
   * Generate infrastructure status report
   */
  async generateStatusReport(): Promise<string> {
    const health = await this.getInfrastructureHealth();
    const summary = monitoringSystem.getHealthSummary();
    
    const report = `
# Infrastructure Status Report
Generated: ${new Date().toISOString()}

## Overall Status: ${health.status.toUpperCase()}

## Services Status
- **Database**: ${health.services.database}
- **Backup System**: ${health.services.backup}
- **Monitoring**: ${health.services.monitoring}

## Resource Usage
- **Memory**: ${health.resources.memory.toFixed(1)}%
- **CPU**: ${health.resources.cpu.toFixed(1)}%
- **Uptime**: ${summary.uptime}

## Active Alerts
${health.alerts.length > 0 ? health.alerts.map(alert => `- ${alert}`).join('\n') : '- No active alerts'}

## Recommendations
${health.recommendations.map(rec => `- ${rec}`).join('\n')}

## Recent Health Checks
${this.healthChecks.map(check => 
  `- ${check.name}: ${check.status.toUpperCase()} - ${check.message} (${check.responseTime}ms)`
).join('\n')}
    `.trim();

    return report;
  }

  /**
   * Monitor Node.js memory usage with intelligent cache cleanup
   */
  private async monitorMemoryUsage(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const rssMB = memUsage.rss / 1024 / 1024;
      const externalMB = memUsage.external / 1024 / 1024;
      
      // Log detailed memory information every 2 minutes
      const now = Date.now();
      if (!this.lastMemoryLog || (now - this.lastMemoryLog) > 2 * 60 * 1000) {
        console.log(`🧠 Memory: Heap ${heapUsedMB.toFixed(1)}MB/${heapTotalMB.toFixed(1)}MB, RSS ${rssMB.toFixed(1)}MB, External ${externalMB.toFixed(1)}MB`);
        this.lastMemoryLog = now;
      }
      
      // Warning threshold (400MB)
      if (heapUsedMB > this.memoryThresholds.warning && heapUsedMB < this.memoryThresholds.critical) {
        logger.warn(`⚠️ Memory Warning: Heap usage ${heapUsedMB.toFixed(1)}MB exceeds ${this.memoryThresholds.warning}MB threshold`, {
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          rss: rssMB,
          external: externalMB,
          cacheSize: await this.getCacheSize()
        });
      }
      
      // Critical threshold (500MB) - trigger emergency cleanup
      if (heapUsedMB > this.memoryThresholds.critical) {
        const timeSinceLastCleanup = now - this.memoryThresholds.lastCleanup;
        
        // Only run emergency cleanup once every 5 minutes to prevent thrashing
        if (timeSinceLastCleanup > 5 * 60 * 1000) {
          logger.error(`🚨 CRITICAL Memory Alert: ${heapUsedMB.toFixed(1)}MB exceeds ${this.memoryThresholds.critical}MB - triggering emergency cleanup`, {
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            rss: rssMB,
            external: externalMB
          });
          
          await this.emergencyMemoryCleanup();
          this.memoryThresholds.lastCleanup = now;
        }
      }
      
    } catch (error) {
      logger.error('Memory monitoring failed', { error: error.message });
    }
  }
  
  private lastMemoryLog: number = 0;
  
  /**
   * Emergency memory cleanup when critical threshold is reached
   */
  private async emergencyMemoryCleanup(): Promise<void> {
    const startTime = Date.now();
    let cleanupActions: string[] = [];
    
    try {
      // Get memory before cleanup
      const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // 1. Force advanced cache cleanup
      try {
        const cacheStats = await advancedCache.getStats();
        if (cacheStats.cacheSize > 100) {
          // Use advanced cache's emergency cleanup with 50% reduction
          await advancedCache.emergencyCleanup(0.5);
          cleanupActions.push(`Advanced cache: reduced from ${cacheStats.cacheSize} entries (50% cleanup)`);
        }
      } catch (error) {
        cleanupActions.push(`Cache cleanup failed: ${error.message}`);
      }
      
      // 2. Force garbage collection if available
      if (global.gc) {
        global.gc();
        cleanupActions.push('Forced garbage collection');
      } else {
        cleanupActions.push('GC not available (run with --expose-gc for emergency GC)');
      }
      
      // 3. Clear Node.js internal caches (carefully)
      if (require.cache) {
        const moduleCount = Object.keys(require.cache).length;
        cleanupActions.push(`Module cache: ${moduleCount} modules (preserved for stability)`);
      }
      
      // 4. Check memory after cleanup
      const memUsageAfter = process.memoryUsage();
      const heapAfterMB = memUsageAfter.heapUsed / 1024 / 1024;
      const cleanupDuration = Date.now() - startTime;
      const memoryReduced = memBefore - heapAfterMB;
      
      logger.info(`✅ Emergency cleanup completed in ${cleanupDuration}ms`, {
        memoryBefore: `${memBefore.toFixed(1)}MB`,
        memoryAfter: `${heapAfterMB.toFixed(1)}MB`,
        memoryReduced: `${memoryReduced.toFixed(1)}MB`,
        actions: cleanupActions,
        duration: cleanupDuration
      });
      
      // If still critical after cleanup, log severe warning
      if (heapAfterMB > this.memoryThresholds.critical) {
        logger.error(`🔥 SEVERE: Memory still critical after cleanup (${heapAfterMB.toFixed(1)}MB) - consider server restart`, {
          cleanupActions,
          memoryReduced: `${memoryReduced.toFixed(1)}MB`,
          recommendedAction: 'Server restart may be required'
        });
      }
      
    } catch (error) {
      logger.error('Emergency memory cleanup failed', { 
        error: error.message,
        duration: Date.now() - startTime 
      });
    }
  }
  
  /**
   * Get current cache size for memory monitoring
   */
  private async getCacheSize(): Promise<number> {
    try {
      const stats = await advancedCache.getStats();
      return stats.cacheSize;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Check memory health status
   */
  private async checkMemoryHealth(): Promise<ServiceCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const rssMB = memUsage.rss / 1024 / 1024;
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `Heap: ${heapUsedMB.toFixed(1)}MB/${heapTotalMB.toFixed(1)}MB, RSS: ${rssMB.toFixed(1)}MB`;
      
      if (heapUsedMB > this.memoryThresholds.warning) {
        status = 'warning';
        message += ` (⚠️ ${this.memoryThresholds.warning}MB+ threshold)`;
      }
      
      if (heapUsedMB > this.memoryThresholds.critical) {
        status = 'critical';
        message += ` (🚨 ${this.memoryThresholds.critical}MB+ critical)`;
      }
      
      return {
        name: 'Memory Health',
        status,
        message,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Memory Health',
        status: 'critical',
        message: 'Failed to check memory health',
        responseTime: Date.now() - startTime
      };
    }
  }
}

// Export singleton instance
export const infrastructureManager = new InfrastructureManager();