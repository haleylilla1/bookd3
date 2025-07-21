import { logger } from './logger';

// OPTIMIZED: Simplified interfaces focusing on core functionality
interface AddressValidation {
  valid: boolean;
  standardized?: string;
  coordinates?: { lat: number; lng: number };
  confidence: 'high' | 'medium' | 'low';
}

interface DistanceResult {
  success: boolean;
  distance: number;
  duration: number;
  confidence: 'high' | 'medium' | 'low';
  fromCache?: boolean;
  fallbackUsed?: boolean;
}

interface CacheEntry {
  distance: number;
  duration: number;
  confidence: 'high' | 'medium' | 'low';
  expiresAt: number;
  accessCount: number;
  coordinates?: { origin: { lat: number; lng: number }, destination: { lat: number; lng: number } };
}

interface UserQuota {
  userId: number;
  calls: number;
  resetTime: number;
  limit: number;
}

// OPTIMIZED: Single MileageService class with core functionality
export class OptimizedMileageService {
  private cache = new Map<string, CacheEntry>();
  private addressCache = new Map<string, AddressValidation>();
  private userQuotas = new Map<number, UserQuota>();
  
  // SIMPLIFIED: Essential configuration only
  private readonly CACHE_EXPIRY_HOURS = 24;
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly USER_QUOTA_LIMIT = 50;
  private readonly FALLBACK_SPEED = 35; // mph
  
  private readonly apiKey: string;
  private readonly isEnabled: boolean;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    this.isEnabled = !!this.apiKey;
    
    // SIMPLIFIED: Single cleanup interval
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
    
    logger.info('Optimized MileageService initialized', {
      enabled: this.isEnabled,
      userQuotaLimit: this.USER_QUOTA_LIMIT,
      cacheExpiry: this.CACHE_EXPIRY_HOURS
    });
  }

  // CORE METHOD: Main distance calculation
  async calculateDistance(
    userId: number,
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceResult> {
    // Check user quota
    if (!this.checkUserQuota(userId)) {
      return this.fallbackEstimation(origin, destination, waypoints, roundTrip);
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(origin, destination, waypoints, roundTrip);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      cached.accessCount++;
      return {
        success: true,
        distance: cached.distance,
        duration: cached.duration,
        confidence: cached.confidence,
        fromCache: true
      };
    }

    // Validate addresses
    const [originValid, destValid] = await Promise.all([
      this.validateAddress(origin),
      this.validateAddress(destination)
    ]);

    if (!originValid.valid || !destValid.valid) {
      return this.fallbackEstimation(origin, destination, waypoints, roundTrip);
    }

    try {
      // Call Google Maps API
      const result = await this.callGoogleMapsApi(origin, destination, waypoints, roundTrip);
      
      // Cache result
      this.cacheResult(cacheKey, result, originValid.coordinates, destValid.coordinates);
      
      // Record API usage
      this.recordApiCall(userId);
      
      return result;
    } catch (error) {
      logger.warn('Google Maps API failed, using fallback', { error: error instanceof Error ? error.message : 'Unknown' });
      return this.fallbackEstimation(origin, destination, waypoints, roundTrip);
    }
  }

  // SIMPLIFIED: Address validation with basic Google Places integration
  private async validateAddress(address: string): Promise<AddressValidation> {
    const cached = this.addressCache.get(address);
    if (cached) return cached;

    if (!this.isEnabled) {
      return this.basicValidation(address);
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results?.[0]) {
        const result = data.results[0];
        const validation: AddressValidation = {
          valid: true,
          standardized: result.formatted_address,
          coordinates: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
          },
          confidence: this.getConfidenceFromTypes(result.types)
        };
        
        this.addressCache.set(address, validation);
        return validation;
      }
    } catch (error) {
      logger.warn('Address validation failed', { address, error: error instanceof Error ? error.message : 'Unknown' });
    }

    return this.basicValidation(address);
  }

  // SIMPLIFIED: Basic address validation fallback
  private basicValidation(address: string): AddressValidation {
    const hasNumbers = /\d/.test(address);
    const hasState = /\b[A-Z]{2}\b/.test(address);
    const hasCity = address.split(',').length >= 2;
    
    const validation: AddressValidation = {
      valid: hasNumbers && (hasState || hasCity),
      standardized: address.trim(),
      confidence: hasNumbers && hasState && hasCity ? 'medium' : 'low'
    };
    
    this.addressCache.set(address, validation);
    return validation;
  }

  // CORE: Google Maps API call
  private async callGoogleMapsApi(
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceResult> {
    const destinations = [destination];
    if (waypoints.length > 0) {
      destinations.splice(0, 0, ...waypoints);
    }
    if (roundTrip) {
      destinations.push(origin);
    }

    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const params = new URLSearchParams({
      origins: origin,
      destinations: destinations.join('|'),
      units: 'imperial',
      key: this.apiKey
    });

    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.status === 'OK' && data.rows?.[0]?.elements) {
      let totalDistance = 0;
      let totalDuration = 0;

      for (const element of data.rows[0].elements) {
        if (element.status === 'OK') {
          totalDistance += element.distance.value * 0.000621371; // Convert meters to miles
          totalDuration += element.duration.value / 60; // Convert seconds to minutes
        }
      }

      return {
        success: true,
        distance: Math.round(totalDistance * 100) / 100,
        duration: Math.round(totalDuration),
        confidence: 'high'
      };
    }

    throw new Error(`Google Maps API error: ${data.status || 'Unknown error'}`);
  }

  // ENHANCED: Fallback estimation with smart logic
  private async fallbackEstimation(
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceResult> {
    // Try coordinate-based calculation first
    const [originValid, destValid] = await Promise.all([
      this.validateAddress(origin),
      this.validateAddress(destination)
    ]);

    if (originValid.coordinates && destValid.coordinates) {
      let distance = this.calculateHaversineDistance(
        originValid.coordinates,
        destValid.coordinates
      );
      
      // Apply realistic adjustments
      distance *= 1.3; // Account for roads not being straight lines
      
      // Add waypoint distance estimate
      if (waypoints.length > 0) {
        distance *= (1 + waypoints.length * 0.2);
      }
      
      if (roundTrip) {
        distance *= 2;
      }
      
      const duration = Math.round(distance / this.FALLBACK_SPEED * 60);
      
      return {
        success: true,
        distance: Math.round(distance * 100) / 100,
        duration,
        confidence: 'medium',
        fallbackUsed: true
      };
    }

    // Basic string-based estimation
    const baseDistance = this.estimateFromStrings(origin, destination);
    let totalDistance = baseDistance;
    
    if (waypoints.length > 0) {
      totalDistance *= (1 + waypoints.length * 0.3);
    }
    if (roundTrip) {
      totalDistance *= 2;
    }
    
    const duration = Math.round(totalDistance / 25 * 60); // Assume 25 mph for city driving
    
    return {
      success: true,
      distance: Math.round(totalDistance * 100) / 100,
      duration,
      confidence: 'low',
      fallbackUsed: true
    };
  }

  // UTILITY: Haversine distance calculation
  private calculateHaversineDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // UTILITY: String-based distance estimation
  private estimateFromStrings(origin: string, destination: string): number {
    const originCity = this.extractCity(origin);
    const destCity = this.extractCity(destination);
    
    if (originCity === destCity) {
      return 15; // Same city average
    }
    
    const originState = this.extractState(origin);
    const destState = this.extractState(destination);
    
    if (originState === destState) {
      return 80; // Same state average
    }
    
    return 200; // Different states average
  }

  private extractCity(address: string): string {
    const parts = address.split(',');
    return parts[parts.length - 2]?.trim().toLowerCase() || '';
  }

  private extractState(address: string): string {
    const match = address.match(/\b[A-Z]{2}\b/);
    return match ? match[0] : '';
  }

  // UTILITY: Cache management
  private generateCacheKey(
    origin: string,
    destination: string,
    waypoints: string[],
    roundTrip: boolean
  ): string {
    return `${origin}|${destination}|${waypoints.join(',')}|${roundTrip}`.toLowerCase();
  }

  private cacheResult(
    cacheKey: string,
    result: DistanceResult,
    originCoords?: { lat: number; lng: number },
    destCoords?: { lat: number; lng: number }
  ): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }

    this.cache.set(cacheKey, {
      distance: result.distance,
      duration: result.duration,
      confidence: result.confidence,
      expiresAt: Date.now() + (this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000),
      accessCount: 1,
      coordinates: originCoords && destCoords ? { origin: originCoords, destination: destCoords } : undefined
    });
  }

  // UTILITY: User quota management
  private checkUserQuota(userId: number): boolean {
    const now = Date.now();
    const hourStart = now - (now % (60 * 60 * 1000));
    
    const quota = this.userQuotas.get(userId);
    if (!quota || quota.resetTime < hourStart) {
      this.userQuotas.set(userId, {
        userId,
        calls: 0,
        resetTime: hourStart,
        limit: this.USER_QUOTA_LIMIT
      });
      return true;
    }
    
    return quota.calls < quota.limit;
  }

  private recordApiCall(userId: number): void {
    const quota = this.userQuotas.get(userId);
    if (quota) {
      quota.calls++;
    }
  }

  // UTILITY: Cleanup and maintenance
  private cleanup(): void {
    const now = Date.now();
    
    // Clean expired cache entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
    
    // Clean old address cache (keep 500 most recent)
    if (this.addressCache.size > 500) {
      const entries = Array.from(this.addressCache.entries());
      this.addressCache.clear();
      entries.slice(-500).forEach(([key, value]) => {
        this.addressCache.set(key, value);
      });
    }
    
    logger.debug('Cache cleanup completed', {
      cacheSize: this.cache.size,
      addressCacheSize: this.addressCache.size,
      userQuotas: this.userQuotas.size
    });
  }

  private cleanupCache(): void {
    // Remove least accessed entries when cache is full
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  // UTILITY: Helper methods
  private getConfidenceFromTypes(types: string[]): 'high' | 'medium' | 'low' {
    if (types.includes('street_address')) return 'high';
    if (types.includes('premise') || types.includes('subpremise')) return 'high';
    if (types.includes('route')) return 'medium';
    return 'low';
  }

  // PUBLIC: Statistics for monitoring
  public getStats(): {
    cacheSize: number;
    addressCacheSize: number;
    totalUsers: number;
    enabled: boolean;
  } {
    return {
      cacheSize: this.cache.size,
      addressCacheSize: this.addressCache.size,
      totalUsers: this.userQuotas.size,
      enabled: this.isEnabled
    };
  }

  // PUBLIC: Clear caches (for testing)
  public clearCaches(): void {
    this.cache.clear();
    this.addressCache.clear();
    this.userQuotas.clear();
  }
}

// Export singleton instance
export const mileageService = new OptimizedMileageService();