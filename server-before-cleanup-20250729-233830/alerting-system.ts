import { logger } from './logger';
import { monitoringSystem } from './monitoring-system';
import { infrastructureManager } from './infrastructure-manager';

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  service: string;
}

interface AlertRule {
  name: string;
  condition: (metrics: any) => boolean;
  type: 'warning' | 'critical';
  message: string;
  service: string;
  cooldown: number; // minutes
}

export class SimpleAlertingSystem {
  private alerts: Alert[] = [];
  private maxAlerts: number = 100;
  private alertRules: AlertRule[] = [];
  private lastAlertTime: Map<string, number> = new Map();

  constructor() {
    this.setupSimpleAlertRules();
    // Don't start automatically - will be started explicitly
  }

  /**
   * Setup simplified alert rules
   */
  private setupSimpleAlertRules(): void {
    this.alertRules = [
      {
        name: 'critical_memory_usage',
        condition: (metrics) => metrics.memory.percentage > 95,
        type: 'critical',
        message: 'Memory usage is critically high',
        service: 'system',
        cooldown: 30
      },
      {
        name: 'backup_missing',
        condition: (metrics) => !metrics.backup.lastBackup,
        type: 'critical',
        message: 'No backups found',
        service: 'backup',
        cooldown: 120
      },
      {
        name: 'backup_very_old',
        condition: (metrics) => {
          if (!metrics.backup.lastBackup) return false;
          const hoursSinceBackup = (Date.now() - new Date(metrics.backup.lastBackup).getTime()) / (1000 * 60 * 60);
          return hoursSinceBackup > 48; // Only alert if backup is over 48 hours old
        },
        type: 'warning',
        message: 'Backup is very old',
        service: 'backup',
        cooldown: 60
      }
    ];

    logger.info('Simplified alert rules configured', { ruleCount: this.alertRules.length });
  }

  /**
   * Start simplified alert monitoring
   */
  startAlertMonitoring(): void {
    // Check for alerts every 15 minutes (much less frequent)
    setInterval(() => {
      this.checkAlerts();
    }, 15 * 60 * 1000);

    // Run initial alert check after 5 minutes
    setTimeout(() => {
      this.checkAlerts();
    }, 5 * 60 * 1000);

    logger.info('Alert monitoring started - checking every 15 minutes');
  }

  /**
   * Check all alert rules
   */
  private async checkAlerts(): Promise<void> {
    try {
      const metrics = monitoringSystem.getCurrentStatus();
      const now = Date.now();

      for (const rule of this.alertRules) {
        try {
          // Check if rule condition is met
          if (rule.condition(metrics)) {
            const lastAlert = this.lastAlertTime.get(rule.name) || 0;
            const minutesSinceLastAlert = (now - lastAlert) / (1000 * 60);

            // Check cooldown period
            if (minutesSinceLastAlert >= rule.cooldown) {
              this.createAlert(rule, metrics);
              this.lastAlertTime.set(rule.name, now);
            }
          }
        } catch (error) {
          logger.error('Alert rule check failed', { 
            rule: rule.name, 
            error: error.message 
          });
        }
      }

      // Auto-resolve old alerts
      this.autoResolveAlerts();
    } catch (error) {
      logger.error('Alert checking failed', { error: error.message });
    }
  }

  /**
   * Create an alert
   */
  private createAlert(rule: AlertRule, metrics: any): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      type: rule.type,
      title: rule.name.replace(/_/g, ' ').toUpperCase(),
      message: this.formatAlertMessage(rule, metrics),
      timestamp: new Date().toISOString(),
      resolved: false,
      service: rule.service
    };

    this.alerts.unshift(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    // Log alert
    logger[rule.type === 'critical' ? 'error' : 'warn']('ALERT TRIGGERED', {
      id: alert.id,
      type: alert.type,
      service: alert.service,
      message: alert.message
    });
  }

  /**
   * Format alert message with current metrics
   */
  private formatAlertMessage(rule: AlertRule, metrics: any): string {
    let message = rule.message;

    // Add specific details based on rule type
    switch (rule.name) {
      case 'high_memory_usage':
      case 'critical_memory_usage':
        message += ` (${metrics.memory.percentage.toFixed(1)}%)`;
        break;
      case 'high_cpu_usage':
        message += ` (${metrics.cpu.percentage.toFixed(1)}%)`;
        break;
      case 'slow_database_response':
      case 'very_slow_database_response':
        message += ` (${metrics.database.connectionTime}ms)`;
        break;
      case 'backup_old':
        if (metrics.backup.lastBackup) {
          const hoursSinceBackup = (Date.now() - new Date(metrics.backup.lastBackup).getTime()) / (1000 * 60 * 60);
          message += ` (${hoursSinceBackup.toFixed(1)} hours ago)`;
        }
        break;
      case 'database_integrity_issues':
        if (metrics.health && metrics.health.issues) {
          message += ` (${metrics.health.issues.join(', ')})`;
        }
        break;
    }

    return message;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Auto-resolve alerts that are no longer valid
   */
  private autoResolveAlerts(): void {
    const metrics = monitoringSystem.getCurrentStatus();
    
    for (const alert of this.alerts) {
      if (alert.resolved) continue;

      const rule = this.alertRules.find(r => r.name === alert.title.toLowerCase().replace(/ /g, '_'));
      if (rule && !rule.condition(metrics)) {
        alert.resolved = true;
        logger.info('Alert auto-resolved', { 
          id: alert.id, 
          type: alert.type, 
          service: alert.service 
        });
      }
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: 'info' | 'warning' | 'critical'): Alert[] {
    return this.alerts.filter(alert => alert.type === type && !alert.resolved);
  }

  /**
   * Get alerts by service
   */
  getAlertsByService(service: string): Alert[] {
    return this.alerts.filter(alert => alert.service === service && !alert.resolved);
  }

  /**
   * Manually resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      logger.info('Alert manually resolved', { id: alertId });
      return true;
    }
    return false;
  }

  /**
   * Get alert summary
   */
  getAlertSummary(): {
    total: number;
    active: number;
    critical: number;
    warning: number;
    info: number;
    byService: Record<string, number>;
  } {
    const active = this.getActiveAlerts();
    const byService: Record<string, number> = {};

    active.forEach(alert => {
      byService[alert.service] = (byService[alert.service] || 0) + 1;
    });

    return {
      total: this.alerts.length,
      active: active.length,
      critical: active.filter(a => a.type === 'critical').length,
      warning: active.filter(a => a.type === 'warning').length,
      info: active.filter(a => a.type === 'info').length,
      byService
    };
  }

  /**
   * Create manual alert
   */
  createManualAlert(
    type: 'info' | 'warning' | 'critical',
    title: string,
    message: string,
    service: string = 'manual'
  ): string {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      service
    };

    this.alerts.unshift(alert);

    logger[type === 'critical' ? 'error' : type === 'warning' ? 'warn' : 'info']('Manual alert created', {
      id: alert.id,
      type,
      service,
      message
    });

    return alert.id;
  }

  /**
   * Generate alert report
   */
  generateAlertReport(): string {
    const summary = this.getAlertSummary();
    const activeAlerts = this.getActiveAlerts();
    const recentAlerts = this.alerts.slice(0, 10);

    const report = `
# Alert System Report
Generated: ${new Date().toISOString()}

## Alert Summary
- **Total Alerts**: ${summary.total}
- **Active Alerts**: ${summary.active}
- **Critical**: ${summary.critical}
- **Warning**: ${summary.warning}
- **Info**: ${summary.info}

## Alerts by Service
${Object.entries(summary.byService).map(([service, count]) => `- **${service}**: ${count}`).join('\n')}

## Active Alerts
${activeAlerts.length > 0 ? activeAlerts.map(alert => 
  `- **${alert.type.toUpperCase()}** [${alert.service}] ${alert.title}: ${alert.message} (${new Date(alert.timestamp).toLocaleString()})`
).join('\n') : '- No active alerts'}

## Recent Alert History
${recentAlerts.map(alert => 
  `- **${alert.type.toUpperCase()}** [${alert.service}] ${alert.title}: ${alert.message} (${new Date(alert.timestamp).toLocaleString()}) ${alert.resolved ? '✓ Resolved' : '⚠ Active'}`
).join('\n')}

## Alert Rules Status
${this.alertRules.map(rule => `- ${rule.name}: ${rule.type} (cooldown: ${rule.cooldown}m)`).join('\n')}
    `.trim();

    return report;
  }
}

// Export singleton instance
export const alertingSystem = new SimpleAlertingSystem();