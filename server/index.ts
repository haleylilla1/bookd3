import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { validateSystemOnStartup } from "./startup-validation";
import { setupVite, serveStatic } from "./vite";
import { handleUnhandledRejections, handleUncaughtExceptions } from "./error-handler";
import { cache } from "./simple-cache";

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
  
  // Initialize Redis cache
  cache.init().catch(console.error);
  
  // Start infrastructure systems (simplified and staggered)
  try {
    const { backupSystem } = await import('./backup-system');
    backupSystem.startBackupScheduler();
    
    // Start monitoring systems with delays to reduce startup load
    setTimeout(async () => {
      const { monitoringSystem } = await import('./monitoring-system');
      monitoringSystem.startMetricsCollection();
    }, 30000); // Start after 30 seconds
    
    setTimeout(async () => {
      const { infrastructureManager } = await import('./infrastructure-manager');
      infrastructureManager.startHealthMonitoring();
    }, 60000); // Start after 1 minute
    
    setTimeout(async () => {
      const { alertingSystem } = await import('./alerting-system');
      alertingSystem.startAlertMonitoring();
    }, 90000); // Start after 1.5 minutes
    
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

  server.listen(port, "0.0.0.0", () => {
    // Server started successfully
  });
}

start().catch(() => process.exit(1));