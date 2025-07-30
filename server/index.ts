// CRITICAL: Set NODE_ENV if undefined (Replit environment fix)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('⚠️ NODE_ENV was undefined, set to development');
}

import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
// Removed over-engineered startup validation system
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
  
  // Initialize ultra-simple cache system
  const { ultraSimpleCache } = await import("./ultra-simple-cache");
  ultraSimpleCache.init();
  
  console.log('✅ Server startup: Core systems initialized');
  
  try {
    const server = await registerRoutes(app);
  
  // Simple startup - no over-engineered validation systems
  
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

    server.listen(parseInt(port.toString()), "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

start().catch(() => process.exit(1));