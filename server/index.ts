import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { handleUnhandledRejections, handleUncaughtExceptions } from "./error-handler";

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
  
  // Start infrastructure systems
  try {
    const { backupSystem } = await import('./backup-system');
    const { monitoringSystem } = await import('./monitoring-system');
    const { infrastructureManager } = await import('./infrastructure-manager');
    const { alertingSystem } = await import('./alerting-system');
    
    backupSystem.startBackupScheduler();
    monitoringSystem.startMetricsCollection();
    infrastructureManager.startHealthMonitoring();
    // alertingSystem starts automatically in constructor
  } catch (error) {
    console.error('Failed to start infrastructure systems:', error);
  }
  
  const server = await registerRoutes(app);
  
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