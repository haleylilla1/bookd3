// CRITICAL: Set NODE_ENV if undefined (Replit environment fix)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('⚠️ NODE_ENV was undefined, set to development');
}

// Initialize Sentry first, before other imports
import { initSentry } from "./lib/sentry";
initSentry();

import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
// Removed over-engineered startup validation system
import { setupVite, serveStatic } from "./vite";
import { handleUnhandledRejections, handleUncaughtExceptions } from "./error-handler";
import { performanceMonitor } from "./performance-monitor";

const app = express();
const port = process.env.PORT || 5000;

// Production configuration
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction 
  ? [
      process.env.CORS_ORIGIN || 'https://app.bookd.tools', 
      'https://app.bookd.tools',
      'https://bookd.tools',
      'https://www.bookd.tools'
    ]
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

// CORS configuration for production
if (isProduction) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });
}

// Rate limiting middleware (production-optimized)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000') || 1000, // 1000 requests default
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 100, // Limit to 100 requests per minute for sensitive endpoints
  message: 'Rate limit exceeded, please slow down.',
});

// Basic middleware (production-optimized)
const maxRequestSize = process.env.MAX_REQUEST_SIZE || '10mb';
app.use(express.json({ limit: maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: maxRequestSize }));
app.use(cookieParser());
app.use(limiter); // Apply general rate limiting

// Security headers for production
if (isProduction) {
  app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

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