/**
 * Performance Monitoring System for 1,000+ Concurrent Users
 * 
 * Tracks bottlenecks, memory usage, and API response times
 * for enterprise-level scalability analysis.
 */

import type { Request, Response, NextFunction } from 'express';

interface PerformanceMetrics {
  timestamp: number;
  endpoint: string;
  method: string;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  activeConnections: number;
  statusCode: number;
  userId?: number;
}

interface SystemMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  memoryUsageMB: number;
  activeUsers: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k metrics
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes
  private slowQueryThreshold = 1000; // 1 second
  private activeUsers = new Set<number>();

  constructor() {
    // Cleanup old metrics periodically
    setInterval(() => this.cleanup(), this.cleanupInterval);
    
    // Monitor Node.js memory usage
    setInterval(() => this.checkMemoryUsage(), 30000); // Every 30 seconds
  }

  /**
   * Express middleware to track API performance
   */
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      // Track active user
      const userId = (req as any).user?.id;
      if (userId) {
        this.activeUsers.add(userId);
      }

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const endMemory = process.memoryUsage();

        const metric: PerformanceMetrics = {
          timestamp: Date.now(),
          endpoint: req.path,
          method: req.method,
          responseTime,
          memoryUsage: endMemory,
          activeConnections: this.getActiveConnections(),
          statusCode: res.statusCode,
          userId
        };

        this.addMetric(metric);

        // Alert on slow responses
        if (responseTime > this.slowQueryThreshold) {
          console.warn(`🐌 SLOW RESPONSE: ${req.method} ${req.path} took ${responseTime}ms`);
        }
      });

      next();
    };
  }

  /**
   * Track database query performance
   */
  trackQuery(query: string, duration: number) {
    if (duration > this.slowQueryThreshold) {
      console.warn(`🐌 SLOW QUERY: ${query} took ${duration}ms`);
    }
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000); // Last 5 minutes
    
    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerMinute: 0,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        activeUsers: this.activeUsers.size,
        slowQueries: []
      };
    }

    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    return {
      averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      requestsPerMinute: Math.round(recentMetrics.length / 5), // 5-minute window
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      activeUsers: this.activeUsers.size,
      slowQueries: this.getSlowQueries()
    };
  }

  /**
   * Get performance bottlenecks analysis
   */
  getBottlenecks() {
    const recentMetrics = this.getRecentMetrics(10 * 60 * 1000); // Last 10 minutes
    
    // Group by endpoint
    const endpointStats = new Map<string, { count: number; totalTime: number; maxTime: number }>();
    
    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      const existing = endpointStats.get(key) || { count: 0, totalTime: 0, maxTime: 0 };
      
      existing.count++;
      existing.totalTime += metric.responseTime;
      existing.maxTime = Math.max(existing.maxTime, metric.responseTime);
      
      endpointStats.set(key, existing);
    });

    // Find bottlenecks
    const bottlenecks = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: Math.round(stats.totalTime / stats.count),
        maxTime: stats.maxTime,
        requestCount: stats.count,
        requestsPerMinute: Math.round(stats.count / 10) // 10-minute window
      }))
      .filter(b => b.averageTime > 500 || b.maxTime > 2000) // Bottleneck thresholds
      .sort((a, b) => b.averageTime - a.averageTime);

    return bottlenecks;
  }

  /**
   * Memory leak detection
   */
  private checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    // Alert on high memory usage
    if (heapUsedMB > 512) { // 512MB threshold
      console.warn(`⚠️  HIGH MEMORY USAGE: ${heapUsedMB}MB heap used`);
    }
    
    // Clean up inactive users (haven't made requests in 15 minutes)
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    const recentActiveUsers = new Set(
      this.metrics
        .filter(m => m.timestamp > fifteenMinutesAgo && m.userId)
        .map(m => m.userId!)
    );
    
    this.activeUsers = recentActiveUsers;
  }

  private addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private getRecentMetrics(timeWindowMs: number): PerformanceMetrics[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  private getSlowQueries() {
    // This would be populated by trackQuery calls
    return [];
  }

  private getActiveConnections(): number {
    // This would track active HTTP connections
    return this.activeUsers.size;
  }

  private cleanup() {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > tenMinutesAgo);
  }
}

export const performanceMonitor = new PerformanceMonitor();