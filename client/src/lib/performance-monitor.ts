// Simple frontend performance monitoring
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 100; // Keep only recent metrics

  // Track page load time
  trackPageLoad(pageName: string) {
    const loadTime = performance.now();
    this.addMetric(`page_load_${pageName}`, loadTime);
  }

  // Track API response times
  trackApiCall(endpoint: string, startTime: number) {
    const duration = performance.now() - startTime;
    this.addMetric(`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`, duration);
  }

  // Track render times
  trackRender(componentName: string, renderTime: number) {
    this.addMetric(`render_${componentName}`, renderTime);
  }

  // Track user interactions
  trackUserAction(action: string) {
    const timing = performance.now();
    this.addMetric(`user_${action}`, timing);
  }

  private addMetric(name: string, value: number) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now()
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development') {
      if (name.includes('api_') && value > 1000) {
        console.warn(`🐌 Slow API call: ${name} took ${value.toFixed(2)}ms`);
      }
      if (name.includes('render_') && value > 100) {
        console.warn(`🐌 Slow render: ${name} took ${value.toFixed(2)}ms`);
      }
    }
  }

  // Get performance summary
  getSummary() {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 300000); // Last 5 minutes

    const summary: Record<string, { avg: number, count: number, max: number }> = {};
    
    recentMetrics.forEach(metric => {
      const key = metric.name;
      if (!summary[key]) {
        summary[key] = { avg: 0, count: 0, max: 0 };
      }
      summary[key].count++;
      summary[key].max = Math.max(summary[key].max, metric.value);
      summary[key].avg = (summary[key].avg * (summary[key].count - 1) + metric.value) / summary[key].count;
    });

    return summary;
  }

  // Clear old metrics
  cleanup() {
    const cutoff = Date.now() - 600000; // Keep last 10 minutes
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    performanceMonitor.cleanup();
  }, 300000);
}