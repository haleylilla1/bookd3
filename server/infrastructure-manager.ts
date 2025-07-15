import { logger } from './logger';
import { monitoringSystem } from './monitoring-system';
import { backupSystem } from './backup-system';
import { integrityChecker } from './database-integrity';
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

    // Run initial health check after 3 minutes
    setTimeout(() => {
      this.runHealthChecks();
    }, 3 * 60 * 1000);

    logger.info('Infrastructure monitoring started - health checks every 5 minutes');
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

      // System resource check
      checks.push(await this.checkSystemResources());

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
}

// Export singleton instance
export const infrastructureManager = new InfrastructureManager();