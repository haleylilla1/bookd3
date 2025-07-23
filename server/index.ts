// CRITICAL: Set NODE_ENV if undefined (Replit environment fix)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('⚠️ NODE_ENV was undefined, set to development');
}

import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { validateSystemOnStartup } from "./startup-validation";
import { setupVite, serveStatic } from "./vite";
import { handleUnhandledRejections, handleUncaughtExceptions } from "./error-handler";
import { advancedCache } from "./advanced-cache";

const app = express();
const port = process.env.PORT || 5000;

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

async function start() {
  // Set up global error handlers
  handleUnhandledRejections();
  handleUncaughtExceptions();
  
  // PHASE 3: Apply monitoring consolidation first
  await import('./monitoring-consolidation');
  
  // Initialize advanced cache
  advancedCache.init().catch(console.error);
  
  // PHASE 2: Initialize Vite optimization before watchers  
  const { viteOptimization } = await import('./vite-optimization');
  viteOptimization.applyRuntimeOptimizations();
  viteOptimization.monitorWatchingEfficiency();
  
  // Initialize FSWatcher leak fix (must be after Vite optimization)
  const { fsWatcherLeakFix } = await import('./fswatcher-leak-fix');
  console.log('👁️  FSWatcher leak fix active - tracking file watcher creation/cleanup');
  
  // Initialize timer leak detection 
  const { timerLeakDetector } = await import('./timer-leak-detector');
  console.log('🔍 Timer leak detection active - tracking all timer creation/cleanup');
  
  // Initialize memory leak fixes
  const { memoryLeakFixer } = await import('./memory-leak-fixes');
  memoryLeakFixer.setupDatabaseConnectionPooling();
  memoryLeakFixer.setupEventListenerCleanup();
  memoryLeakFixer.setupAggressiveGarbageCollection();
  memoryLeakFixer.setupProcessCleanup();
  
  // Start infrastructure systems (simplified and staggered)
  try {
    const { backupSystem } = await import('./backup-system');
    backupSystem.startBackupScheduler();
    
    // PHASE 3: Start unified monitoring system (replaces 4+ separate systems)
    setTimeout(async () => {
      const { unifiedMonitoring } = await import('./unified-monitoring');
      unifiedMonitoring.start();
      console.log('✅ PHASE 3: Unified monitoring system started (consolidated 4+ systems)');
    }, 30000); // Start after 30 seconds
    
    // PHASE 3: Skip separate infrastructure and alerting systems (now unified)
    console.log('🎯 PHASE 3: Skipping separate infrastructure/alerting systems (consolidated into unified monitoring)');
    
  } catch (error) {
    console.error('Failed to start infrastructure systems:', error);
  }
  
  const server = await registerRoutes(app);
  
  // Run startup validation after routes are registered
  validateSystemOnStartup().catch(error => {
    console.error('[STARTUP] Validation failed:', error);
  });
  
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(parseInt(port.toString()), "0.0.0.0", () => {
    // Server started successfully
  });
}

start().catch(() => process.exit(1));