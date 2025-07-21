/**
 * Node.js Memory Leak Profiler
 * Detects actual Node.js application memory leaks beyond cache issues
 */

import { logger } from './logger';

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface LeakPattern {
  type: 'heap_growth' | 'external_growth' | 'rss_growth' | 'gc_ineffective';
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  trend: number; // MB per minute
  duration: number; // minutes
  description: string;
}

interface MemoryAnalysis {
  leaks: LeakPattern[];
  recommendations: string[];
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class NodeJSMemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 60; // 30 minutes at 30-second intervals
  private gcStats = {
    forced: 0,
    lastForced: 0,
    effectiveness: 0 // Percentage memory recovered
  };
  
  private intervalHandle?: NodeJS.Timeout;
  private analyzing = false;

  constructor() {
    this.startProfiling();
  }

  startProfiling(): void {
    console.log('🔬 Node.js Memory Profiler: Starting comprehensive leak detection');
    
    // Take initial snapshot
    this.takeSnapshot();
    
    // Start monitoring every 30 seconds
    this.intervalHandle = setInterval(() => {
      this.takeSnapshot();
      this.analyzeMemoryPatterns();
    }, 30 * 1000);
  }

  stopProfiling(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  private takeSnapshot(): void {
    const memUsage = process.memoryUsage();
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
      heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
      external: memUsage.external / 1024 / 1024, // MB
      rss: memUsage.rss / 1024 / 1024, // MB
      arrayBuffers: memUsage.arrayBuffers / 1024 / 1024 // MB
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    // Log current memory state
    console.log(`🧠 Memory Snapshot: Heap ${snapshot.heapUsed.toFixed(1)}MB/${snapshot.heapTotal.toFixed(1)}MB, RSS ${snapshot.rss.toFixed(1)}MB, External ${snapshot.external.toFixed(1)}MB`);
  }

  private analyzeMemoryPatterns(): void {
    if (this.analyzing || this.snapshots.length < 10) return;
    
    this.analyzing = true;
    
    try {
      const analysis = this.performLeakAnalysis();
      
      if (analysis.leaks.length > 0) {
        this.reportMemoryLeaks(analysis);
        this.attemptLeakMitigation(analysis);
      }
    } catch (error) {
      console.error('Memory analysis failed:', error);
    } finally {
      this.analyzing = false;
    }
  }

  private performLeakAnalysis(): MemoryAnalysis {
    const leaks: LeakPattern[] = [];
    const recommendations: string[] = [];
    
    // Analyze heap growth trend
    const heapLeak = this.analyzeHeapGrowth();
    if (heapLeak) leaks.push(heapLeak);
    
    // Analyze external memory growth
    const externalLeak = this.analyzeExternalGrowth();
    if (externalLeak) leaks.push(externalLeak);
    
    // Analyze RSS growth
    const rssLeak = this.analyzeRSSGrowth();
    if (rssLeak) leaks.push(rssLeak);
    
    // Analyze GC effectiveness
    const gcLeak = this.analyzeGCEffectiveness();
    if (gcLeak) leaks.push(gcLeak);
    
    // Generate recommendations
    recommendations.push(...this.generateRecommendations(leaks));
    
    // Calculate confidence and risk
    const confidence = this.calculateConfidence(leaks);
    const riskLevel = this.assessRiskLevel(leaks);
    
    return { leaks, recommendations, confidence, riskLevel };
  }

  private analyzeHeapGrowth(): LeakPattern | null {
    if (this.snapshots.length < 20) return null;
    
    const recent = this.snapshots.slice(-20); // Last 10 minutes
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = (newest.timestamp - oldest.timestamp) / (60 * 1000); // minutes
    const heapGrowth = newest.heapUsed - oldest.heapUsed; // MB
    const growthRate = heapGrowth / timeDiff; // MB per minute
    
    if (growthRate > 2) { // >2MB per minute growth
      return {
        type: 'heap_growth',
        severity: growthRate > 10 ? 'critical' : growthRate > 5 ? 'severe' : 'moderate',
        trend: growthRate,
        duration: timeDiff,
        description: `Heap growing at ${growthRate.toFixed(2)}MB/min over ${timeDiff.toFixed(1)} minutes`
      };
    }
    
    return null;
  }

  private analyzeExternalGrowth(): LeakPattern | null {
    if (this.snapshots.length < 20) return null;
    
    const recent = this.snapshots.slice(-20);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = (newest.timestamp - oldest.timestamp) / (60 * 1000);
    const externalGrowth = newest.external - oldest.external;
    const growthRate = externalGrowth / timeDiff;
    
    if (growthRate > 1) { // >1MB per minute external growth
      return {
        type: 'external_growth',
        severity: growthRate > 5 ? 'critical' : growthRate > 2 ? 'severe' : 'moderate',
        trend: growthRate,
        duration: timeDiff,
        description: `External memory growing at ${growthRate.toFixed(2)}MB/min (buffers/streams)`
      };
    }
    
    return null;
  }

  private analyzeRSSGrowth(): LeakPattern | null {
    if (this.snapshots.length < 20) return null;
    
    const recent = this.snapshots.slice(-20);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = (newest.timestamp - oldest.timestamp) / (60 * 1000);
    const rssGrowth = newest.rss - oldest.rss;
    const growthRate = rssGrowth / timeDiff;
    
    if (growthRate > 3) { // >3MB per minute RSS growth
      return {
        type: 'rss_growth',
        severity: growthRate > 15 ? 'critical' : growthRate > 8 ? 'severe' : 'moderate',
        trend: growthRate,
        duration: timeDiff,
        description: `RSS growing at ${growthRate.toFixed(2)}MB/min (system memory)`
      };
    }
    
    return null;
  }

  private analyzeGCEffectiveness(): LeakPattern | null {
    // Force GC and measure effectiveness
    const beforeGC = process.memoryUsage().heapUsed;
    
    if (global.gc) {
      global.gc();
      const afterGC = process.memoryUsage().heapUsed;
      const recovered = (beforeGC - afterGC) / 1024 / 1024; // MB
      const effectiveness = (recovered / (beforeGC / 1024 / 1024)) * 100;
      
      this.gcStats.forced++;
      this.gcStats.lastForced = Date.now();
      this.gcStats.effectiveness = effectiveness;
      
      console.log(`🗑️  GC Effectiveness: Recovered ${recovered.toFixed(1)}MB (${effectiveness.toFixed(1)}%)`);
      
      if (effectiveness < 10) { // Less than 10% memory recovered
        return {
          type: 'gc_ineffective',
          severity: effectiveness < 2 ? 'critical' : effectiveness < 5 ? 'severe' : 'moderate',
          trend: 100 - effectiveness,
          duration: 0,
          description: `GC ineffective: Only ${effectiveness.toFixed(1)}% memory recovered`
        };
      }
    }
    
    return null;
  }

  private generateRecommendations(leaks: LeakPattern[]): string[] {
    const recommendations: string[] = [];
    
    leaks.forEach(leak => {
      switch (leak.type) {
        case 'heap_growth':
          recommendations.push('Check for retained closures, uncleaned event listeners, or large object accumulation');
          recommendations.push('Profile heap objects using --inspect and Chrome DevTools');
          break;
          
        case 'external_growth':
          recommendations.push('Audit database connections, file handles, and stream objects');
          recommendations.push('Ensure proper cleanup of external resources (database pools, file descriptors)');
          break;
          
        case 'rss_growth':
          recommendations.push('Monitor for memory fragmentation or native module leaks');
          recommendations.push('Consider process restart strategy for long-running applications');
          break;
          
        case 'gc_ineffective':
          recommendations.push('Objects may be retained by closures or circular references');
          recommendations.push('Use WeakMap/WeakSet for temporary object references');
          break;
      }
    });
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private calculateConfidence(leaks: LeakPattern[]): number {
    if (leaks.length === 0) return 95;
    
    const severityWeights = { minor: 0.2, moderate: 0.5, severe: 0.8, critical: 1.0 };
    const totalWeight = leaks.reduce((sum, leak) => sum + severityWeights[leak.severity], 0);
    
    // Higher confidence with more severe leaks
    return Math.min(95, 50 + (totalWeight * 20));
  }

  private assessRiskLevel(leaks: LeakPattern[]): 'low' | 'medium' | 'high' | 'critical' {
    if (leaks.length === 0) return 'low';
    
    const hasCritical = leaks.some(leak => leak.severity === 'critical');
    const hasSevere = leaks.some(leak => leak.severity === 'severe');
    const hasMultiple = leaks.length > 2;
    
    if (hasCritical || (hasSevere && hasMultiple)) return 'critical';
    if (hasSevere || hasMultiple) return 'high';
    if (leaks.length > 0) return 'medium';
    return 'low';
  }

  private reportMemoryLeaks(analysis: MemoryAnalysis): void {
    console.log('🚨 NODE.JS MEMORY LEAK DETECTED');
    console.log('==================================');
    console.log(`Risk Level: ${analysis.riskLevel.toUpperCase()}`);
    console.log(`Confidence: ${analysis.confidence}%`);
    console.log('');
    
    analysis.leaks.forEach((leak, index) => {
      console.log(`${index + 1}. ${leak.severity.toUpperCase()} ${leak.type.replace('_', ' ').toUpperCase()}`);
      console.log(`   ${leak.description}`);
      console.log('');
    });
    
    if (analysis.recommendations.length > 0) {
      console.log('RECOMMENDATIONS:');
      analysis.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    // Log to structured logger
    logger.error('Node.js memory leak detected', {
      analysis,
      currentMemory: process.memoryUsage(),
      snapshotCount: this.snapshots.length
    });
  }

  private attemptLeakMitigation(analysis: MemoryAnalysis): void {
    console.log('🛠️  ATTEMPTING LEAK MITIGATION');
    
    // Force multiple GC cycles for severe leaks
    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      console.log('🗑️  Forcing aggressive garbage collection (5 cycles)');
      for (let i = 0; i < 5; i++) {
        if (global.gc) global.gc();
        // Small delay between GC cycles
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
    }
    
    // Clear internal caches that might be causing issues
    if (global.gc) {
      const beforeMitigation = process.memoryUsage().heapUsed;
      global.gc();
      const afterMitigation = process.memoryUsage().heapUsed;
      const recovered = (beforeMitigation - afterMitigation) / 1024 / 1024;
      
      console.log(`✅ Mitigation complete: ${recovered.toFixed(1)}MB recovered`);
    }
  }

  getMemoryStats(): any {
    const current = process.memoryUsage();
    const latest = this.snapshots[this.snapshots.length - 1];
    
    return {
      current: {
        heapUsed: current.heapUsed / 1024 / 1024,
        heapTotal: current.heapTotal / 1024 / 1024,
        external: current.external / 1024 / 1024,
        rss: current.rss / 1024 / 1024,
        arrayBuffers: current.arrayBuffers / 1024 / 1024
      },
      snapshots: this.snapshots.length,
      gcStats: this.gcStats,
      trend: latest && this.snapshots.length > 1 ? {
        heapGrowth: latest.heapUsed - this.snapshots[0].heapUsed,
        timespan: (latest.timestamp - this.snapshots[0].timestamp) / (60 * 1000)
      } : null
    };
  }

  getDetailedAnalysis(): MemoryAnalysis | null {
    if (this.snapshots.length < 10) return null;
    return this.performLeakAnalysis();
  }
}

export const nodeJSMemoryProfiler = new NodeJSMemoryProfiler();