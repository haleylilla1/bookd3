// Mobile Optimization Library
// Comprehensive solution for iOS zoom, touch targets, and network timeouts

import { getMobileDebugInfo, validateMobileEnvironment } from "@/utils/mobile-debug";

// 1. iOS Zoom Prevention
export function preventIOSZoom() {
  // Update viewport meta tag for iOS zoom prevention
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }
  
  // Prevent zoom on focus for iOS
  const preventZoomOnFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // Temporarily disable zoom
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
      
      // Re-enable zoom after a delay to allow normal pinch-to-zoom
      setTimeout(() => {
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        }
      }, 500);
    }
  };

  // Add event listeners for focus events
  document.addEventListener('focusin', preventZoomOnFocus);
  document.addEventListener('focusout', () => {
    // Restore zoom capability after focus out
    setTimeout(() => {
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
      }
    }, 100);
  });
  
  return () => {
    document.removeEventListener('focusin', preventZoomOnFocus);
  };
}

// 2. Touch Target Optimization
export interface TouchTargetConfig {
  minSize: number;
  spacing: number;
  hitAreaExpansion: number;
}

export const TOUCH_TARGET_CONFIG: TouchTargetConfig = {
  minSize: 44, // iOS minimum 44px, Android minimum 48px
  spacing: 8, // Minimum spacing between touch targets
  hitAreaExpansion: 12 // Expand hit area beyond visible element
};

export function optimizeTouchTargets(container: HTMLElement = document.body) {
  const touchElements = container.querySelectorAll('button, input, select, textarea, a, [role="button"]');
  
  touchElements.forEach(element => {
    const el = element as HTMLElement;
    const computedStyle = getComputedStyle(el);
    const width = parseInt(computedStyle.width);
    const height = parseInt(computedStyle.height);
    
    // Ensure minimum touch target size
    if (width < TOUCH_TARGET_CONFIG.minSize || height < TOUCH_TARGET_CONFIG.minSize) {
      el.style.minWidth = `${TOUCH_TARGET_CONFIG.minSize}px`;
      el.style.minHeight = `${TOUCH_TARGET_CONFIG.minSize}px`;
      el.style.display = 'inline-flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
    }
    
    // Add touch-friendly spacing
    if (!el.style.margin) {
      el.style.margin = `${TOUCH_TARGET_CONFIG.spacing / 2}px`;
    }
    
    // Expand hit area using pseudo-element
    el.style.position = 'relative';
    el.setAttribute('data-touch-optimized', 'true');
  });
}

// 3. Network Timeout Enhancement
export interface NetworkConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  slowNetworkThreshold: number;
}

export const NETWORK_CONFIG: NetworkConfig = {
  timeout: 30000, // 30 second timeout for mobile
  retryAttempts: 3,
  retryDelay: 1000,
  slowNetworkThreshold: 2000 // Consider slow if > 2 seconds
};

export class MobileNetworkManager {
  private static instance: MobileNetworkManager;
  private networkQuality: 'fast' | 'slow' | 'offline' = 'fast';
  private pendingRequests = new Map<string, AbortController>();
  
  static getInstance(): MobileNetworkManager {
    if (!MobileNetworkManager.instance) {
      MobileNetworkManager.instance = new MobileNetworkManager();
    }
    return MobileNetworkManager.instance;
  }
  
  constructor() {
    this.detectNetworkQuality();
    this.setupNetworkListeners();
  }
  
  private detectNetworkQuality() {
    const connection = (navigator as any).connection;
    if (connection) {
      if (connection.effectiveType === '4g' && connection.downlink > 1.5) {
        this.networkQuality = 'fast';
      } else if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        this.networkQuality = 'slow';
      } else {
        this.networkQuality = 'slow';
      }
    }
    
    if (!navigator.onLine) {
      this.networkQuality = 'offline';
    }
  }
  
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.networkQuality = 'fast';
      this.detectNetworkQuality();
    });
    
    window.addEventListener('offline', () => {
      this.networkQuality = 'offline';
      // Cancel all pending requests
      this.pendingRequests.forEach(controller => controller.abort());
      this.pendingRequests.clear();
    });
  }
  
  async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    requestId?: string
  ): Promise<T> {
    const id = requestId || `${Date.now()}-${Math.random()}`;
    
    if (this.networkQuality === 'offline') {
      throw new Error('No network connection available');
    }
    
    // Adjust timeout based on network quality
    const timeout = this.networkQuality === 'slow' 
      ? NETWORK_CONFIG.timeout * 2 
      : NETWORK_CONFIG.timeout;
    
    const controller = new AbortController();
    this.pendingRequests.set(id, controller);
    
    try {
      const response = await this.fetchWithTimeout(url, {
        ...options,
        signal: controller.signal
      }, timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    } finally {
      this.pendingRequests.delete(id);
    }
  }
  
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const timeoutId = setTimeout(() => {
      if (options.signal && !options.signal.aborted) {
        (options.signal as AbortSignal & { abort?: () => void }).abort?.();
      }
    }, timeout);
    
    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  async makeRequestWithRetry<T>(
    url: string,
    options: RequestInit = {},
    maxRetries: number = NETWORK_CONFIG.retryAttempts
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest<T>(url, options);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Don't retry on certain errors
        if (error instanceof Error && (
          error.message.includes('404') ||
          error.message.includes('401') ||
          error.message.includes('403')
        )) {
          break;
        }
        
        // Exponential backoff
        const delay = NETWORK_CONFIG.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
  
  cancelRequest(requestId: string) {
    const controller = this.pendingRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(requestId);
    }
  }
  
  cancelAllRequests() {
    this.pendingRequests.forEach(controller => controller.abort());
    this.pendingRequests.clear();
  }
  
  getNetworkQuality(): 'fast' | 'slow' | 'offline' {
    return this.networkQuality;
  }
}

// 4. Mobile Form Optimization
export function optimizeMobileForm(form: HTMLFormElement) {
  const inputs = form.querySelectorAll('input, textarea, select');
  
  inputs.forEach(input => {
    const el = input as HTMLInputElement;
    
    // Prevent iOS zoom on input focus
    el.style.fontSize = '16px';
    
    // Optimize input types for mobile keyboards
    if (el.type === 'text' && el.name?.includes('email')) {
      el.type = 'email';
    } else if (el.type === 'text' && el.name?.includes('phone')) {
      el.type = 'tel';
    } else if (el.type === 'text' && el.name?.includes('number')) {
      el.type = 'number';
    }
    
    // Add mobile-friendly attributes
    el.setAttribute('autocomplete', 'on');
    el.setAttribute('autocapitalize', 'words');
    el.setAttribute('autocorrect', 'off');
    
    // Prevent zoom on focus
    el.addEventListener('focus', () => {
      el.style.fontSize = '16px';
    });
  });
}

// 5. Mobile Performance Monitoring
export class MobilePerformanceMonitor {
  private static instance: MobilePerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  
  static getInstance(): MobilePerformanceMonitor {
    if (!MobilePerformanceMonitor.instance) {
      MobilePerformanceMonitor.instance = new MobilePerformanceMonitor();
    }
    return MobilePerformanceMonitor.instance;
  }
  
  startTiming(key: string) {
    this.metrics.set(key, performance.now());
  }
  
  endTiming(key: string): number {
    const startTime = this.metrics.get(key);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.metrics.delete(key);
      return duration;
    }
    return 0;
  }
  
  measureAsync<T>(key: string, fn: () => Promise<T>): Promise<T> {
    this.startTiming(key);
    return fn().finally(() => {
      const duration = this.endTiming(key);
      console.log(`${key}: ${duration.toFixed(2)}ms`);
    });
  }
  
  getMetrics(): { [key: string]: number } {
    return Object.fromEntries(this.metrics);
  }
}

// 6. Initialization Hook
export function initializeMobileOptimization() {
  // Check if we're on a mobile device
  const isMobile = window.innerWidth < 768;
  if (!isMobile) return;
  
  // Initialize iOS zoom prevention
  const cleanupZoom = preventIOSZoom();
  
  // Initialize touch target optimization
  optimizeTouchTargets();
  
  // Initialize network manager
  const networkManager = MobileNetworkManager.getInstance();
  
  // Initialize performance monitoring
  const performanceMonitor = MobilePerformanceMonitor.getInstance();
  
  // Add CSS for touch targets
  const style = document.createElement('style');
  style.textContent = `
    [data-touch-optimized="true"]::before {
      content: '';
      position: absolute;
      top: -${TOUCH_TARGET_CONFIG.hitAreaExpansion}px;
      left: -${TOUCH_TARGET_CONFIG.hitAreaExpansion}px;
      right: -${TOUCH_TARGET_CONFIG.hitAreaExpansion}px;
      bottom: -${TOUCH_TARGET_CONFIG.hitAreaExpansion}px;
      z-index: -1;
    }
    
    @media (max-width: 768px) {
      /* Mobile-specific touch optimizations */
      button, input, select, textarea {
        min-height: 44px;
        min-width: 44px;
        touch-action: manipulation;
      }
      
      /* Prevent iOS zoom on input focus */
      input, textarea, select {
        font-size: 16px !important;
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);
  
  // Log mobile environment validation
  const validation = validateMobileEnvironment();
  if (!validation.valid) {
    console.warn('Mobile environment issues detected:', validation.issues);
  }
  
  return {
    networkManager,
    performanceMonitor,
    cleanup: () => {
      cleanupZoom();
      document.head.removeChild(style);
    }
  };
}

// Export the network manager for use in other modules
export const mobileNetworkManager = MobileNetworkManager.getInstance();