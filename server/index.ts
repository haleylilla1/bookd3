// CRITICAL: Set NODE_ENV if undefined (Replit environment fix)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('⚠️ NODE_ENV was undefined, set to development');
}

import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
// Removed over-engineered startup validation system
import { setupVite, serveStatic } from "./vite";
import { handleUnhandledRejections, handleUncaughtExceptions } from "./error-handler";

const app = express();
const port = process.env.PORT || 5000;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 100, // Limit to 100 requests per minute for sensitive endpoints
  message: 'Rate limit exceeded, please slow down.',
});

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(limiter); // Apply general rate limiting

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