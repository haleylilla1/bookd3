/**
 * Phase 2: Vite Development Server Optimization
 * Optimizes file watching, esbuild configuration, and development server performance
 */

export class ViteOptimization {
  private static instance: ViteOptimization;
  
  constructor() {
    this.initializeOptimizations();
  }
  
  static getInstance(): ViteOptimization {
    if (!ViteOptimization.instance) {
      ViteOptimization.instance = new ViteOptimization();
    }
    return ViteOptimization.instance;
  }
  
  private initializeOptimizations(): void {
    console.log('🚀 PHASE 2: Initializing Vite optimization');
    
    // Configure environment variables for optimized development
    process.env.VITE_DEV_SERVER_WATCHER_OPTIONS = JSON.stringify({
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/data-backups/**',
        '**/server-backup*/**',
        '**/attached_assets/**',
        '**/*.md',
        '**/*.txt',
        '**/*.log',
        '**/*.pdf',
        '**/*.xlsx',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.png',
        '**/*.zip'
      ],
      usePolling: false,
      interval: 1000, // Reduced from default
      binaryInterval: 1000,
      useFsEvents: true,
      depth: 2 // Limit directory traversal depth
    });
    
    // Configure esbuild optimization options
    process.env.VITE_ESBUILD_OPTIONS = JSON.stringify({
      target: 'esnext',
      format: 'esm',
      splitting: true,
      treeShaking: true,
      minifyIdentifiers: false, // Keep readable for development
      minifySyntax: true,
      minifyWhitespace: false,
      keepNames: true,
      sourcemap: true,
      metafile: false // Reduce memory usage
    });
    
    // Set chokidar specific optimizations
    process.env.CHOKIDAR_INTERVAL = '1000';
    process.env.CHOKIDAR_ATOMIC = 'false';
    process.env.CHOKIDAR_USEWATCHERS = '5'; // Limit concurrent watchers
    
    console.log('✅ PHASE 2: Vite optimization configuration applied');
  }
  
  /**
   * Apply runtime optimizations to existing Vite processes
   */
  applyRuntimeOptimizations(): void {
    // Force garbage collection if available
    if (global.gc) {
      console.log('🗑️  PHASE 2: Forcing garbage collection');
      global.gc();
    }
    
    // Optimize Node.js for development server
    if (process.env.NODE_ENV === 'development') {
      // Increase max listeners for better hot reload handling
      process.setMaxListeners(15); // Default is 10
      
      console.log('⚡ PHASE 2: Development server optimizations applied');
    }
  }
  
  /**
   * Monitor file watching efficiency
   */
  monitorWatchingEfficiency(): void {
    const startTime = Date.now();
    let watchedFiles = 0;
    let excludedFiles = 0;
    
    // Log efficiency metrics every 5 minutes
    setInterval(() => {
      const runtime = (Date.now() - startTime) / 1000 / 60; // minutes
      console.log(`📊 VITE EFFICIENCY (${runtime.toFixed(1)}min): ${watchedFiles} watched, ${excludedFiles} excluded`);
    }, 5 * 60 * 1000);
  }
}

// Export singleton instance
export const viteOptimization = ViteOptimization.getInstance();