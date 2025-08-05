#!/usr/bin/env node

/**
 * Upload source maps to Sentry after build
 * This script should be run after `npm run build`
 */

const { execSync } = require('child_process');
const path = require('path');

const SENTRY_ORG = 'bookd-yd';
const SENTRY_PROJECT = 'bookd';
const BUILD_DIR = './dist/public';

console.log('📦 Uploading source maps to Sentry...');

try {
  // Create a release
  const release = process.env.VITE_APP_VERSION || `${Date.now()}`;
  console.log(`🏷️  Creating release: ${release}`);
  
  execSync(`npx @sentry/cli releases new ${release}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  // Upload source maps
  console.log('📤 Uploading source maps...');
  execSync(`npx @sentry/cli releases files ${release} upload-sourcemaps ${BUILD_DIR} --url-prefix "~/"`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  // Finalize the release
  console.log('✅ Finalizing release...');
  execSync(`npx @sentry/cli releases finalize ${release}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('🎉 Source maps uploaded successfully!');
  console.log(`Release ${release} is now available in Sentry`);

} catch (error) {
  console.error('❌ Failed to upload source maps:', error.message);
  console.error('Make sure you have set SENTRY_AUTH_TOKEN environment variable');
  process.exit(1);
}