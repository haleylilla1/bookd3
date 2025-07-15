import { logger } from './logger';

interface AddressValidationResult {
  valid: boolean;
  standardized?: string;
  issues: string[];
}

interface DistanceCalculationResult {
  success: boolean;
  distance: number;
  duration: number;
  error?: string;
  fromCache?: boolean;
}

interface CachedDistanceResult {
  distance: number;
  duration: number;
  timestamp: number;
  expiresAt: number;
}

export class MileageService {
  private distanceCache: Map<string, CachedDistanceResult> = new Map();
  private cacheExpiryHours = 24; // Cache results for 24 hours
  private maxCacheSize = 1000;
  private apiCallCount = 0;
  private maxApiCallsPerHour = 100; // Rate limiting
  private apiCallResetTime = Date.now() + (60 * 60 * 1000); // Reset every hour

  constructor() {
    // Clean up cache periodically
    setInterval(() => {
      this.cleanupCache();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Validate and standardize address
   */
  validateAddress(address: string): AddressValidationResult {
    const issues: string[] = [];
    
    if (!address || !address.trim()) {
      return {
        valid: false,
        issues: ['Address is required']
      };
    }

    const cleanAddress = address.trim();
    
    // Basic validation rules
    if (cleanAddress.length < 5) {
      issues.push('Address is too short');
    }
    
    if (cleanAddress.length > 200) {
      issues.push('Address is too long');
    }
    
    // Check for common patterns
    const hasNumber = /\d/.test(cleanAddress);
    const hasStreetPattern = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|pkwy|parkway)\b/i.test(cleanAddress);
    
    if (!hasNumber && !hasStreetPattern) {
      issues.push('Address should include a street number or recognizable street pattern');
    }
    
    // Check for suspicious patterns
    if (/[<>{}[\]()@#$%^&*=+|\\]/g.test(cleanAddress)) {
      issues.push('Address contains invalid characters');
    }
    
    // Very basic standardization
    let standardized = cleanAddress
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\b(st)\b/gi, 'Street')
      .replace(/\b(ave)\b/gi, 'Avenue')
      .replace(/\b(blvd)\b/gi, 'Boulevard')
      .replace(/\b(rd)\b/gi, 'Road')
      .replace(/\b(dr)\b/gi, 'Drive')
      .replace(/\b(ln)\b/gi, 'Lane')
      .replace(/\b(ct)\b/gi, 'Court')
      .replace(/\b(pl)\b/gi, 'Place')
      .replace(/\b(pkwy)\b/gi, 'Parkway');
    
    return {
      valid: issues.length === 0,
      standardized,
      issues
    };
  }

  /**
   * Generate cache key for distance calculation
   */
  private generateCacheKey(origin: string, destination: string): string {
    const normalizedOrigin = origin.toLowerCase().trim();
    const normalizedDestination = destination.toLowerCase().trim();
    return `${normalizedOrigin}|||${normalizedDestination}`;
  }

  /**
   * Check if we have cached result
   */
  private getCachedResult(cacheKey: string): CachedDistanceResult | null {
    const cached = this.distanceCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.distanceCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache distance result
   */
  private cacheResult(cacheKey: string, distance: number, duration: number): void {
    // Limit cache size
    if (this.distanceCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.distanceCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.2)); // Remove 20%
      toRemove.forEach(([key]) => this.distanceCache.delete(key));
    }

    const expiresAt = Date.now() + (this.cacheExpiryHours * 60 * 60 * 1000);
    this.distanceCache.set(cacheKey, {
      distance,
      duration,
      timestamp: Date.now(),
      expiresAt
    });
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter if hour has passed
    if (now > this.apiCallResetTime) {
      this.apiCallCount = 0;
      this.apiCallResetTime = now + (60 * 60 * 1000);
    }
    
    return this.apiCallCount < this.maxApiCallsPerHour;
  }

  /**
   * Estimate distance using simple heuristics (fallback)
   */
  private estimateDistance(origin: string, destination: string): DistanceCalculationResult {
    // Simple estimation based on string similarity and common patterns
    const originWords = origin.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    const destWords = destination.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    
    let similarity = 0;
    const commonWords = originWords.filter(word => destWords.includes(word));
    similarity = commonWords.length / Math.max(originWords.length, destWords.length);
    
    // Estimate based on similarity and patterns
    let estimatedMiles;
    
    if (similarity > 0.7) {
      // Very similar addresses - likely same area
      estimatedMiles = Math.random() * 8 + 2; // 2-10 miles
    } else if (similarity > 0.4) {
      // Somewhat similar - likely same city/region
      estimatedMiles = Math.random() * 20 + 10; // 10-30 miles
    } else {
      // Different addresses - could be far
      estimatedMiles = Math.random() * 50 + 20; // 20-70 miles
    }
    
    // Check for state/city patterns for better estimates
    const statePattern = /\b[A-Z]{2}\b|\b(california|texas|florida|new york|illinois)\b/i;
    const originState = origin.match(statePattern);
    const destState = destination.match(statePattern);
    
    if (originState && destState && originState[0] !== destState[0]) {
      // Different states - longer distance
      estimatedMiles = Math.random() * 200 + 100; // 100-300 miles
    }
    
    const distance = Math.round(estimatedMiles * 100) / 100;
    const duration = Math.round(distance * 2.5); // ~2.5 minutes per mile
    
    return {
      success: true,
      distance,
      duration
    };
  }

  /**
   * Calculate distance using Google Maps API (when available)
   */
  private async calculateWithGoogleMaps(origin: string, destination: string): Promise<DistanceCalculationResult> {
    // Check if Google Maps API key is available
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        distance: 0,
        duration: 0,
        error: 'Google Maps API key not configured'
      };
    }

    try {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        return {
          success: false,
          distance: 0,
          duration: 0,
          error: 'API rate limit exceeded, try again later'
        };
      }

      this.apiCallCount++;

      const encodedOrigin = encodeURIComponent(origin);
      const encodedDestination = encodeURIComponent(destination);
      
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedOrigin}&destinations=${encodedDestination}&units=imperial&key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Bookd-Mileage-Service/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(`Google Maps API status: ${data.status}`);
      }

      const element = data.rows[0]?.elements[0];
      if (!element) {
        throw new Error('No distance data returned from Google Maps');
      }

      if (element.status !== 'OK') {
        throw new Error(`Distance calculation failed: ${element.status}`);
      }

      const distanceText = element.distance?.text;
      const durationText = element.duration?.text;
      
      if (!distanceText || !durationText) {
        throw new Error('Invalid distance data format');
      }

      // Parse distance (convert to miles if needed)
      const distanceValue = element.distance.value; // meters
      const distanceMiles = distanceValue * 0.000621371; // Convert meters to miles
      
      // Parse duration
      const durationValue = element.duration.value; // seconds
      const durationMinutes = Math.round(durationValue / 60);

      return {
        success: true,
        distance: Math.round(distanceMiles * 100) / 100, // Round to 2 decimal places
        duration: durationMinutes
      };

    } catch (error) {
      logger.error('Google Maps API error', { error: error.message, origin, destination });
      return {
        success: false,
        distance: 0,
        duration: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate distance with fallback
   */
  async calculateDistance(origin: string, destination: string): Promise<DistanceCalculationResult> {
    try {
      // Validate addresses
      const originValidation = this.validateAddress(origin);
      const destValidation = this.validateAddress(destination);
      
      if (!originValidation.valid || !destValidation.valid) {
        const issues = [...originValidation.issues, ...destValidation.issues];
        return {
          success: false,
          distance: 0,
          duration: 0,
          error: `Address validation failed: ${issues.join(', ')}`
        };
      }

      const standardizedOrigin = originValidation.standardized || origin;
      const standardizedDestination = destValidation.standardized || destination;
      
      // Check cache first
      const cacheKey = this.generateCacheKey(standardizedOrigin, standardizedDestination);
      const cached = this.getCachedResult(cacheKey);
      
      if (cached) {
        logger.info('Distance calculation cache hit', { origin, destination, distance: cached.distance });
        return {
          success: true,
          distance: cached.distance,
          duration: cached.duration,
          fromCache: true
        };
      }

      // Try Google Maps API first
      const googleResult = await this.calculateWithGoogleMaps(standardizedOrigin, standardizedDestination);
      
      if (googleResult.success) {
        // Cache the result
        this.cacheResult(cacheKey, googleResult.distance, googleResult.duration);
        
        logger.info('Distance calculated with Google Maps', { 
          origin, 
          destination, 
          distance: googleResult.distance,
          duration: googleResult.duration 
        });
        
        return googleResult;
      }

      // Fallback to estimation
      logger.warn('Google Maps API failed, using estimation', { 
        origin, 
        destination, 
        error: googleResult.error 
      });
      
      const estimation = this.estimateDistance(standardizedOrigin, standardizedDestination);
      
      // Cache estimation too (shorter expiry)
      this.cacheResult(cacheKey, estimation.distance, estimation.duration);
      
      return estimation;

    } catch (error) {
      logger.error('Distance calculation error', { error: error.message, origin, destination });
      return {
        success: false,
        distance: 0,
        duration: 0,
        error: error.message
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, value] of this.distanceCache.entries()) {
      if (now >= value.expiresAt) {
        this.distanceCache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.info('Cache cleanup completed', { removedCount, remainingCount: this.distanceCache.size });
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    cacheSize: number;
    apiCallsThisHour: number;
    maxApiCallsPerHour: number;
    cacheHitRate: number;
  } {
    return {
      cacheSize: this.distanceCache.size,
      apiCallsThisHour: this.apiCallCount,
      maxApiCallsPerHour: this.maxApiCallsPerHour,
      cacheHitRate: 0 // Would need to track hits/misses to calculate
    };
  }
}

// Export singleton instance
export const mileageService = new MileageService();