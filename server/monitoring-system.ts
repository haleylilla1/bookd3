import { logger } from './logger';
import { db } from './db';
import { backupSystem } from './backup-system';
import { integrityChecker } from './database-integrity';
import fs from 'fs/promises';
import os from 'os';

interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    loadAverage: number[];
    percentage: number;
  };
  database: {
    userCount: number;
    gigCount: number;
    expenseCount: number;
    connectionTime: number;
  };
  backup: {
    lastBackup: string | null;
    backupCount: number;
    totalSize: number;
  };
  health: {
    overall: 'healthy' | 'warning' | 'critical';
    issues: string[];
  };
}

interface AlertConfig {
  memoryThreshold: number;
  cpuThreshold: number;
  diskThreshold: number;
  responseTimeThreshold: number;
}

export class SimpleMonitoringSystem {
  private metrics: SystemMetrics[] = [];
  private maxMetrics: number = 288; // 24 hours of 5-minute intervals
  private alertConfig: AlertConfig = {
    memoryThreshold: 85, // 85% memory usage
    cpuThreshold: 80, // 80% CPU usage
    diskThreshold: 90, // 90% disk usage
    responseTimeThreshold: 2000 // 2 seconds
  };
  private isCollectingMetrics: boolean = false;

  constructor() {
    this.startMetricsCollection();
  }

  /**
   * Start collecting system metrics every 5 minutes
   */
  startMetricsCollection(): void {
    // Collect initial metrics
    setTimeout(() => {
      this.collectMetrics();
    }, 30000); // Wait 30 seconds after startup

    // Collect metrics every 5 minutes
    setInterval(() => {
      this.collectMetrics();
    }, 5 * 60 * 1000);

    logger.info('Monitoring system started - collecting metrics every 5 minutes');
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    if (this.isCollectingMetrics) {
      logger.warn('Metrics collection already in progress');
      return this.metrics[0] || this.getDefaultMetrics();
    }

    this.isCollectingMetrics = true;
    const startTime = Date.now();

    try {
      // Collect system metrics
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const cpuPercentage = Math.min(100, (loadAvg[0] / cpuCount) * 100);

      // Collect database metrics
      const dbStartTime = Date.now();
      const [userCount, gigCount, expenseCount] = await Promise.all([
        db.query.users.findMany().then(users => users.length),
        db.query.gigs.findMany().then(gigs => gigs.length),
        db.query.expenses.findMany().then(expenses => expenses.length)
      ]);
      const connectionTime = Date.now() - dbStartTime;

      // Collect backup metrics
      const backupInfo = await backupSystem.getBackupInfo();

      // Collect health status
      const healthCheck = await integrityChecker.checkHealth();

      // Determine overall health
      const issues: string[] = [];
      const memoryPercentage = (usedMemory / totalMemory) * 100;
      
      if (memoryPercentage > this.alertConfig.memoryThreshold) {
        issues.push(`High memory usage: ${memoryPercentage.toFixed(1)}%`);
      }
      
      if (cpuPercentage > this.alertConfig.cpuThreshold) {
        issues.push(`High CPU usage: ${cpuPercentage.toFixed(1)}%`);
      }
      
      if (connectionTime > this.alertConfig.responseTimeThreshold) {
        issues.push(`Slow database response: ${connectionTime}ms`);
      }

      if (!healthCheck.healthy) {
        issues.push(`Database integrity issues: ${healthCheck.message}`);
      }

      const overall = issues.length === 0 ? 'healthy' : 
                     issues.length <= 2 ? 'warning' : 'critical';

      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: memoryPercentage
        },
        cpu: {
          loadAverage: loadAvg,
          percentage: cpuPercentage
        },
        database: {
          userCount,
          gigCount,
          expenseCount,
          connectionTime
        },
        backup: {
          lastBackup: backupInfo.lastBackup,
          backupCount: backupInfo.count,
          totalSize: backupInfo.totalSize
        },
        health: {
          overall,
          issues
        }
      };

      // Store metrics (keep only last 288 entries - 24 hours)
      this.metrics.unshift(metrics);
      if (this.metrics.length > this.maxMetrics) {
        this.metrics = this.metrics.slice(0, this.maxMetrics);
      }

      // Log important metrics
      logger.info('System metrics collected', {
        memory: `${memoryPercentage.toFixed(1)}%`,
        cpu: `${cpuPercentage.toFixed(1)}%`,
        database: `${connectionTime}ms`,
        users: userCount,
        gigs: gigCount,
        health: overall,
        issues: issues.length
      });

      // Alert on critical issues
      if (overall === 'critical') {
        logger.error('CRITICAL SYSTEM ALERT', {
          issues,
          memory: memoryPercentage,
          cpu: cpuPercentage,
          dbTime: connectionTime
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to collect metrics', { error: error.message });
      return this.getDefaultMetrics();
    } finally {
      this.isCollectingMetrics = false;
    }
  }

  /**
   * Get default metrics for error cases
   */
  private getDefaultMetrics(): SystemMetrics {
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: 0,
        total: os.totalmem(),
        percentage: 0
      },
      cpu: {
        loadAverage: [0, 0, 0],
        percentage: 0
      },
      database: {
        userCount: 0,
        gigCount: 0,
        expenseCount: 0,
        connectionTime: 0
      },
      backup: {
        lastBackup: null,
        backupCount: 0,
        totalSize: 0
      },
      health: {
        overall: 'critical',
        issues: ['Failed to collect metrics']
      }
    };
  }

  /**
   * Get current system status
   */
  getCurrentStatus(): SystemMetrics {
    return this.metrics[0] || this.getDefaultMetrics();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const maxEntries = Math.min(hours * 12, this.maxMetrics); // 12 entries per hour (5-minute intervals)
    return this.metrics.slice(0, maxEntries);
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    uptime: string;
    memory: string;
    cpu: string;
    database: string;
    backup: string;
    issues: string[];
  } {
    const current = this.getCurrentStatus();
    
    return {
      status: current.health.overall,
      uptime: this.formatUptime(current.uptime),
      memory: `${current.memory.percentage.toFixed(1)}%`,
      cpu: `${current.cpu.percentage.toFixed(1)}%`,
      database: `${current.database.connectionTime}ms`,
      backup: current.backup.lastBackup 
        ? `${current.backup.backupCount} backups, last: ${new Date(current.backup.lastBackup).toLocaleString()}`
        : 'No backups',
      issues: current.health.issues
    };
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(): {
    memoryTrend: 'improving' | 'stable' | 'degrading';
    cpuTrend: 'improving' | 'stable' | 'degrading';
    databaseTrend: 'improving' | 'stable' | 'degrading';
  } {
    if (this.metrics.length < 6) {
      return {
        memoryTrend: 'stable',
        cpuTrend: 'stable',
        databaseTrend: 'stable'
      };
    }

    const recent = this.metrics.slice(0, 3);
    const previous = this.metrics.slice(3, 6);

    const recentMemory = recent.reduce((sum, m) => sum + m.memory.percentage, 0) / recent.length;
    const previousMemory = previous.reduce((sum, m) => sum + m.memory.percentage, 0) / previous.length;

    const recentCpu = recent.reduce((sum, m) => sum + m.cpu.percentage, 0) / recent.length;
    const previousCpu = previous.reduce((sum, m) => sum + m.cpu.percentage, 0) / previous.length;

    const recentDb = recent.reduce((sum, m) => sum + m.database.connectionTime, 0) / recent.length;
    const previousDb = previous.reduce((sum, m) => sum + m.database.connectionTime, 0) / previous.length;

    return {
      memoryTrend: this.getTrend(recentMemory, previousMemory),
      cpuTrend: this.getTrend(recentCpu, previousCpu),
      databaseTrend: this.getTrend(recentDb, previousDb)
    };
  }

  /**
   * Determine trend direction
   */
  private getTrend(recent: number, previous: number): 'improving' | 'stable' | 'degrading' {
    const change = ((recent - previous) / previous) * 100;
    
    if (change > 10) return 'degrading';
    if (change < -10) return 'improving';
    return 'stable';
  }

  /**
   * Create system health report
   */
  async createHealthReport(): Promise<string> {
    const summary = this.getHealthSummary();
    const trends = this.getPerformanceTrends();
    const recent = this.getMetricsHistory(1);

    const report = `
# System Health Report
Generated: ${new Date().toISOString()}

## Overall Status: ${summary.status.toUpperCase()}

## System Metrics
- **Uptime**: ${summary.uptime}
- **Memory Usage**: ${summary.memory}
- **CPU Usage**: ${summary.cpu}
- **Database Response**: ${summary.database}
- **Backup Status**: ${summary.backup}

## Performance Trends
- **Memory**: ${trends.memoryTrend}
- **CPU**: ${trends.cpuTrend}
- **Database**: ${trends.databaseTrend}

## Current Issues
${summary.issues.length > 0 ? summary.issues.map(issue => `- ${issue}`).join('\n') : '- No issues detected'}

## Recent Activity (Last Hour)
${recent.slice(0, 5).map(m => 
  `- ${new Date(m.timestamp).toLocaleTimeString()}: Memory ${m.memory.percentage.toFixed(1)}%, CPU ${m.cpu.percentage.toFixed(1)}%, DB ${m.database.connectionTime}ms`
).join('\n')}

## Recommendations
${this.generateRecommendations(summary)}
    `.trim();

    return report;
  }

  /**
   * Generate health recommendations
   */
  private generateRecommendations(summary: any): string {
    const recommendations: string[] = [];

    if (parseFloat(summary.memory) > 80) {
      recommendations.push('- Consider optimizing memory usage or scaling server resources');
    }

    if (parseFloat(summary.cpu) > 70) {
      recommendations.push('- High CPU usage detected, monitor for performance bottlenecks');
    }

    if (parseInt(summary.database) > 1000) {
      recommendations.push('- Database response time is slow, consider query optimization');
    }

    if (summary.backup === 'No backups') {
      recommendations.push('- Backup system needs attention');
    }

    if (recommendations.length === 0) {
      recommendations.push('- System is operating within normal parameters');
    }

    return recommendations.join('\n');
  }
}

// Export singleton instance
export const monitoringSystem = new SimpleMonitoringSystem();