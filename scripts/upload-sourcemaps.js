#!/usr/bin/env node

/**
 * Upload source maps to Sentry after build
 * This script should be run after `npm run build`
 */

import { execSync } from 'child_process';
import path from 'path';

const SENTRY_ORG = 'bookd-yd';
const SENTRY_PROJECT = 'bookd';
const BUILD_DIR = './dist/public';

console.log('📦 Uploading source maps to Sentry...');

try {
  // Check for auth token
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  if (!authToken) {
    throw new Error('SENTRY_AUTH_TOKEN environment variable is not set');
  }
  
  // Create a release
  const release = process.env.VITE_APP_VERSION || `${Date.now()}`;
  console.log(`🏷️  Creating release: ${release}`);
  
  const env = { ...process.env, SENTRY_AUTH_TOKEN: authToken };
  
  execSync(`npx @sentry/cli releases new ${release} --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env
  });

  // Upload source maps
  console.log('📤 Uploading source maps...');
  execSync(`npx @sentry/cli releases files ${release} upload-sourcemaps ${BUILD_DIR} --url-prefix "~/" --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env
  });

  // Finalize the release
  console.log('✅ Finalizing release...');
  execSync(`npx @sentry/cli releases finalize ${release} --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env
  });

  console.log('🎉 Source maps uploaded successfully!');
  console.log(`Release ${release} is now available in Sentry`);

} catch (error) {
  console.error('❌ Failed to upload source maps:', error.message);
  console.error('Make sure you have set SENTRY_AUTH_TOKEN environment variable');
  process.exit(1);
}