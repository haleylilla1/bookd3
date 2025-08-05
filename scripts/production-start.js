#!/usr/bin/env node

/**
 * Production startup script for Bookd
 * Validates environment and starts the production server
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Bookd production server...');

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SENDGRID_API_KEY', 
  'GOOGLE_MAPS_API_KEY',
  'SENTRY_DSN',
  'VITE_SENTRY_DSN'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease configure these in your Replit Secrets or deployment environment.');
  process.exit(1);
}

// Validate production build exists
const distPath = path.join(process.cwd(), 'dist');
const serverFile = path.join(distPath, 'index.js');
const publicDir = path.join(distPath, 'public');

if (!fs.existsSync(serverFile)) {
  console.error('❌ Production build not found. Run "npm run build" first.');
  process.exit(1);
}

if (!fs.existsSync(publicDir)) {
  console.error('❌ Frontend build not found. Run "npm run build" first.');
  process.exit(1);
}

// Set production environment
process.env.NODE_ENV = 'production';

console.log('✅ Environment validation passed');
console.log('✅ Production build found');
console.log('🌟 Starting server...');

// Start the production server
try {
  execSync('npm start', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to start production server:', error.message);
  process.exit(1);
}