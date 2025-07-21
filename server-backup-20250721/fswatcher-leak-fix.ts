/**
 * FSWatcher Leak Fix - Addresses the 117 FSWatcher handles causing memory leaks
 * Root cause: Vite dev server, file watching, and hot reload creating uncleaned watchers
 */

import { FSWatcher } from 'fs';
import { watch } from 'chokidar';
import fs from 'fs';

interface WatcherInfo {
  watcher: FSWatcher | any;
  path: string;
  source: string;
  createdAt: number;
  isActive: boolean;
}

export class FSWatcherLeakFix {
  private watchers: Map<any, WatcherInfo> = new Map();
  private originalWatch: typeof import('fs').watch;
  private originalWatchFile: typeof import('fs').watchFile;
  private cleanupInterval?: NodeJS.Timeout;
  private maxWatchers = 10; // Reasonable limit for production

  constructor() {
    this.originalWatch = fs.watch;
    this.originalWatchFile = fs.watchFile;
    this.setupWatcherTracking();
    this.startWatcherCleanup();
  }

  private setupWatcherTracking(): void {
    console.log('🔍 FSWATCHER LEAK FIX: Setting up comprehensive file watcher tracking');
    
    // Override fs.watch
    fs.watch = (filename: any, options: any, listener?: any) => {
      const stack = this.captureStack();
      const source = this.extractSource(stack);
      
      const watcher = this.originalWatch.call(fs, filename, options, listener);
      
      if (this.watchers.size >= this.maxWatchers) {
        console.log(`🚨 FSWATCHER LIMIT: Reached ${this.maxWatchers} watchers, cleaning oldest`);
        this.cleanupOldestWatchers(5);
      }
      
      this.watchers.set(watcher, {
        watcher,
        path: filename?.toString() || 'unknown',
        source,
        createdAt: Date.now(),
        isActive: true
      });

      console.log(`👁️  WATCHER CREATED: ${source} watching ${filename} - Total: ${this.watchers.size}`);
      
      // Override close method to track cleanup
      const originalClose = watcher.close?.bind(watcher);
      if (originalClose) {
        watcher.close = () => {
          const info = this.watchers.get(watcher);
          if (info) {
            info.isActive = false;
            this.watchers.delete(watcher);
            console.log(`🗑️  WATCHER CLOSED: ${info.source} - Total: ${this.watchers.size}`);
          }
          return originalClose();
        };
      }
      
      return watcher;
    };

    // Override fs.watchFile  
    fs.watchFile = (filename: any, options: any, listener?: any) => {
      const stack = this.captureStack();
      const source = this.extractSource(stack);
      
      console.log(`👁️  FILE WATCHER: ${source} watching file ${filename}`);
      
      // Call original but don't track these as they're harder to manage
      return this.originalWatchFile.call(fs, filename, options, listener);
    };
  }

  private captureStack(): string {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const err = new Error();
    const stack = err.stack as unknown as NodeJS.CallSite[];
    Error.prepareStackTrace = orig;
    
    return stack
      .slice(3) // Skip FSWatcher frames
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
      
      if (line.includes('vite') || line.includes('chokidar')) {
        return 'vite-dev-server';
      }
      
      if (line.includes('node_modules')) {
        const moduleMatch = line.match(/node_modules\/([^/]+)/);
        if (moduleMatch) {
          return `npm:${moduleMatch[1]}`;
        }
      }
    }
    
    return 'unknown';
  }

  private startWatcherCleanup(): void {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.performWatcherAudit();
    }, 5 * 60 * 1000);
  }

  private performWatcherAudit(): void {
    const processHandles = (process as any)._getActiveHandles?.() || [];
    const fsWatcherCount = processHandles.filter((handle: any) => 
      handle.constructor?.name === 'FSWatcher'
    ).length;

    console.log('👁️  FSWATCHER AUDIT');
    console.log('==================');
    console.log(`Process FSWatchers: ${fsWatcherCount}`);
    console.log(`Tracked Watchers: ${this.watchers.size}`);
    console.log(`Untracked FSWatchers: ${fsWatcherCount - this.watchers.size}`);

    if (fsWatcherCount > 20) {
      console.log(`🚨 EXCESSIVE FSWATCHERS: ${fsWatcherCount} detected (>20 threshold)`);
      this.emergencyWatcherCleanup();
    }

    // Log watcher sources
    const sources: Record<string, number> = {};
    this.watchers.forEach(info => {
      sources[info.source] = (sources[info.source] || 0) + 1;
    });

    if (Object.keys(sources).length > 0) {
      console.log('Watcher Sources:');
      Object.entries(sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count} watchers`);
      });
    }

    console.log('==================\n');
  }

  private cleanupOldestWatchers(count: number): void {
    const sortedWatchers = Array.from(this.watchers.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt)
      .slice(0, count);

    console.log(`🧹 CLEANING ${count} OLDEST WATCHERS`);
    
    sortedWatchers.forEach(([watcher, info]) => {
      try {
        if (watcher.close && info.isActive) {
          watcher.close();
        }
        this.watchers.delete(watcher);
        console.log(`🗑️  Cleaned: ${info.source} (${info.path})`);
      } catch (error) {
        console.error(`Error cleaning watcher: ${error}`);
      }
    });
  }

  private emergencyWatcherCleanup(): void {
    console.log('🚨 EMERGENCY FSWATCHER CLEANUP');
    
    // Get all process handles
    const processHandles = (process as any)._getActiveHandles?.() || [];
    const fsWatchers = processHandles.filter((handle: any) => 
      handle.constructor?.name === 'FSWatcher'
    );

    let cleaned = 0;
    fsWatchers.forEach((handle: any) => {
      try {
        // Try to close untracked watchers
        if (handle.close && !this.watchers.has(handle)) {
          handle.close();
          cleaned++;
        }
      } catch (error) {
        // Ignore errors during emergency cleanup
      }
    });

    console.log(`✅ Emergency cleanup: attempted to close ${cleaned} untracked FSWatchers`);
  }

  forceCleanupAllWatchers(): number {
    console.log('🧹 FORCE CLEANUP: Closing all tracked file watchers');
    
    let cleaned = 0;
    this.watchers.forEach((info, watcher) => {
      try {
        if (watcher.close && info.isActive) {
          watcher.close();
          cleaned++;
        }
      } catch (error) {
        console.error(`Error force-closing watcher: ${error}`);
      }
    });

    this.watchers.clear();
    console.log(`✅ Force cleanup completed: ${cleaned} watchers closed`);
    return cleaned;
  }

  getWatcherStats(): any {
    const processHandles = (process as any)._getActiveHandles?.() || [];
    const fsWatcherCount = processHandles.filter((handle: any) => 
      handle.constructor?.name === 'FSWatcher'
    ).length;

    const sources: Record<string, number> = {};
    const paths: Record<string, number> = {};
    
    this.watchers.forEach(info => {
      sources[info.source] = (sources[info.source] || 0) + 1;
      paths[info.path] = (paths[info.path] || 0) + 1;
    });

    return {
      processFSWatchers: fsWatcherCount,
      trackedWatchers: this.watchers.size,
      untrackedWatchers: fsWatcherCount - this.watchers.size,
      sources,
      paths,
      oldestWatcher: this.watchers.size > 0 ? 
        Math.min(...Array.from(this.watchers.values()).map(w => w.createdAt)) : 0
    };
  }

  destroy(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Force cleanup all watchers
    this.forceCleanupAllWatchers();

    // Restore original functions
    fs.watch = this.originalWatch;
    fs.watchFile = this.originalWatchFile;

    console.log('👁️  FSWATCHER LEAK FIX: Tracking disabled and original functions restored');
  }
}

// Global FSWatcher leak fix instance
export const fsWatcherLeakFix = new FSWatcherLeakFix();