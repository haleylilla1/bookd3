import { logger } from './logger';

interface AddressValidationResult {
  valid: boolean;
  standardized?: string;
  issues: string[];
  placeId?: string;
  coordinates?: { lat: number; lng: number };
  formattedAddress?: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface DistanceCalculationResult {
  success: boolean;
  distance: number;
  duration: number;
  error?: string;
  fromCache?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  fallbackUsed?: boolean;
}

interface CachedDistanceResult {
  distance: number;
  duration: number;
  timestamp: number;
  expiresAt: number;
  confidence: 'high' | 'medium' | 'low';
  placeIds: string[];
}

interface UserQuota {
  userId: number;
  apiCallsThisHour: number;
  lastReset: number;
  quotaLimit: number;
  priority: 'high' | 'medium' | 'low';
}

interface QueuedRequest {
  userId: number;
  origin: string;
  destination: string;
  waypoints: string[];
  roundTrip: boolean;
  priority: number;
  timestamp: number;
  resolve: (result: DistanceCalculationResult) => void;
  reject: (error: Error) => void;
}

export class MileageService {
  private distanceCache: Map<string, CachedDistanceResult> = new Map();
  private addressCache: Map<string, AddressValidationResult> = new Map();
  private userQuotas: Map<number, UserQuota> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private processingQueue = false;
  
  private cacheExpiryHours = 24; // Cache results for 24 hours
  private maxCacheSize = 2000; // Increased for better performance
  private addressCacheSize = 1000;
  private globalApiCallsPerHour = 300; // Increased global limit
  private defaultUserQuota = 50; // Per user per hour
  private priorityUserQuota = 100; // For high priority users
  private queueProcessingInterval = 5000; // Process queue every 5 seconds

  private googleMapsApiKey: string;
  private placesApiEnabled: boolean;

  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    this.placesApiEnabled = !!this.googleMapsApiKey;
    
    // Clean up caches periodically
    setInterval(() => {
      this.cleanupCache();
      this.resetUserQuotas();
    }, 60 * 60 * 1000); // Every hour
    
    // Process request queue
    setInterval(() => {
      this.processQueue();
    }, this.queueProcessingInterval);
    
    logger.info('Enterprise MileageService initialized', {
      placesApiEnabled: this.placesApiEnabled,
      globalLimit: this.globalApiCallsPerHour,
      defaultUserQuota: this.defaultUserQuota
    });
  }

  /**
   * Enhanced address validation using Google Places API
   */
  async validateAddress(address: string, useCache: boolean = true): Promise<AddressValidationResult> {
    const issues: string[] = [];
    
    if (!address || !address.trim()) {
      return {
        valid: false,
        issues: ['Address is required']
      };
    }

    const cleanAddress = address.trim();
    
    // Check cache first
    if (useCache && this.addressCache.has(cleanAddress)) {
      const cached = this.addressCache.get(cleanAddress)!;
      logger.debug('Address validation cache hit', { address: cleanAddress });
      return cached;
    }
    
    // Basic validation rules
    if (cleanAddress.length < 5) {
      issues.push('Address is too short');
    }
    
    if (cleanAddress.length > 200) {
      issues.push('Address is too long');
    }
    
    // Check for suspicious patterns
    if (/[<>{}[\]()@#$%^&*=+|\\]/g.test(cleanAddress)) {
      issues.push('Address contains invalid characters');
    }
    
    // If basic validation fails, return early
    if (issues.length > 0) {
      return {
        valid: false,
        issues,
        confidence: 'low'
      };
    }
    
    // Enhanced validation with Google Places API
    if (this.placesApiEnabled) {
      try {
        const result = await this.validateWithPlacesApi(cleanAddress);
        
        // Cache the result
        if (this.addressCache.size >= this.addressCacheSize) {
          this.cleanupAddressCache();
        }
        this.addressCache.set(cleanAddress, result);
        
        return result;
      } catch (error) {
        logger.warn('Places API validation failed, falling back to basic validation', {
          address: cleanAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Fall back to basic validation
        return this.basicAddressValidation(cleanAddress);
      }
    }
    
    // Fallback to basic validation
    return this.basicAddressValidation(cleanAddress);
  }

  /**
   * Basic address validation fallback
   */
  private basicAddressValidation(address: string): AddressValidationResult {
    const issues: string[] = [];
    
    // Check for common patterns
    const hasNumber = /\d/.test(address);
    const hasStreetPattern = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|pkwy|parkway)\b/i.test(address);
    const hasCity = /,\s*[A-Za-z\s]+(?:,\s*[A-Z]{2})?$/i.test(address);
    
    if (!hasNumber && !hasStreetPattern) {
      issues.push('Address should include a street number or recognizable street pattern');
    }
    
    if (!hasCity) {
      issues.push('Address should include city and state (e.g., "New York, NY")');
    }
    
    // Standardize common abbreviations
    let standardized = address
      .replace(/\bst\b/gi, 'Street')
      .replace(/\bave\b/gi, 'Avenue')
      .replace(/\bblvd\b/gi, 'Boulevard')
      .replace(/\brd\b/gi, 'Road')
      .replace(/\bdr\b/gi, 'Drive')
      .replace(/\bln\b/gi, 'Lane')
      .replace(/\bct\b/gi, 'Court')
      .replace(/\bpl\b/gi, 'Place')
      .replace(/\bpkwy\b/gi, 'Parkway');
    
    return {
      valid: issues.length === 0,
      standardized: issues.length === 0 ? standardized : undefined,
      issues,
      confidence: issues.length === 0 ? 'medium' : 'low'
    };
  }

  /**
   * Determine confidence level based on Google Places types
   */
  private determinePlaceConfidence(types: string[]): 'high' | 'medium' | 'low' {
    const highConfidenceTypes = ['street_address', 'premise', 'subpremise'];
    const mediumConfidenceTypes = ['route', 'intersection', 'neighborhood'];
    const lowConfidenceTypes = ['locality', 'administrative_area_level_1', 'country'];
    
    if (types.some(type => highConfidenceTypes.includes(type))) {
      return 'high';
    } else if (types.some(type => mediumConfidenceTypes.includes(type))) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * User quota management
   */
  private getUserQuota(userId: number): UserQuota {
    if (!this.userQuotas.has(userId)) {
      this.userQuotas.set(userId, {
        userId,
        apiCallsThisHour: 0,
        lastReset: Date.now(),
        quotaLimit: this.defaultUserQuota,
        priority: 'medium'
      });
    }
    return this.userQuotas.get(userId)!;
  }

  /**
   * Check if user can make API call
   */
  private canUserMakeApiCall(userId: number): boolean {
    const quota = this.getUserQuota(userId);
    const now = Date.now();
    
    // Reset quota if hour has passed
    if (now - quota.lastReset >= 60 * 60 * 1000) {
      quota.apiCallsThisHour = 0;
      quota.lastReset = now;
    }
    
    return quota.apiCallsThisHour < quota.quotaLimit;
  }

  /**
   * Record API call for user
   */
  private recordApiCall(userId: number): void {
    const quota = this.getUserQuota(userId);
    quota.apiCallsThisHour++;
    
    logger.debug('API call recorded', {
      userId,
      calls: quota.apiCallsThisHour,
      limit: quota.quotaLimit
    });
  }

  /**
   * Set user priority level
   */
  public setUserPriority(userId: number, priority: 'high' | 'medium' | 'low'): void {
    const quota = this.getUserQuota(userId);
    quota.priority = priority;
    
    // Adjust quota based on priority
    switch (priority) {
      case 'high':
        quota.quotaLimit = this.priorityUserQuota;
        break;
      case 'medium':
        quota.quotaLimit = this.defaultUserQuota;
        break;
      case 'low':
        quota.quotaLimit = Math.floor(this.defaultUserQuota * 0.5);
        break;
    }
    
    logger.info('User priority updated', {
      userId,
      priority,
      newLimit: quota.quotaLimit
    });
  }

  /**
   * Reset user quotas (called hourly)
   */
  private resetUserQuotas(): void {
    const now = Date.now();
    for (const [userId, quota] of this.userQuotas.entries()) {
      if (now - quota.lastReset >= 60 * 60 * 1000) {
        quota.apiCallsThisHour = 0;
        quota.lastReset = now;
      }
    }
    logger.debug('User quotas reset check completed');
  }

  /**
   * Add request to queue
   */
  private async queueRequest(
    userId: number,
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceCalculationResult> {
    return new Promise((resolve, reject) => {
      const quota = this.getUserQuota(userId);
      const priority = this.getPriorityScore(quota.priority);
      
      const request: QueuedRequest = {
        userId,
        origin,
        destination,
        waypoints,
        roundTrip,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      };
      
      this.requestQueue.push(request);
      this.requestQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
      
      logger.debug('Request queued', {
        userId,
        queueLength: this.requestQueue.length,
        priority
      });
      
      // Start processing if not already running
      if (!this.processingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Get priority score for sorting
   */
  private getPriorityScore(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 100;
      case 'medium': return 50;
      case 'low': return 10;
      default: return 50;
    }
  }

  /**
   * Process request queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.processingQueue = true;
    
    try {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift()!;
        
        // Check if request has timed out (30 seconds)
        if (Date.now() - request.timestamp > 30000) {
          request.reject(new Error('Request timed out in queue'));
          continue;
        }
        
        // Check if user can make API call
        if (!this.canUserMakeApiCall(request.userId)) {
          // Try fallback estimation
          try {
            const fallbackResult = await this.fallbackEstimation(
              request.origin,
              request.destination,
              request.waypoints,
              request.roundTrip
            );
            request.resolve(fallbackResult);
          } catch (error) {
            request.reject(error as Error);
          }
          continue;
        }
        
        // Process the request
        try {
          const result = await this.processDistanceRequest(
            request.userId,
            request.origin,
            request.destination,
            request.waypoints,
            request.roundTrip
          );
          request.resolve(result);
        } catch (error) {
          request.reject(error as Error);
        }
        
        // Add delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Main distance calculation method with enterprise features
   */
  public async calculateDistance(
    userId: number,
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceCalculationResult> {
    // Validate addresses first
    const [originValidation, destinationValidation] = await Promise.all([
      this.validateAddress(origin),
      this.validateAddress(destination)
    ]);

    if (!originValidation.valid || !destinationValidation.valid) {
      const issues = [...originValidation.issues, ...destinationValidation.issues];
      return {
        success: false,
        distance: 0,
        duration: 0,
        error: `Address validation failed: ${issues.join(', ')}`,
        confidence: 'low'
      };
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(
      originValidation.standardized || origin,
      destinationValidation.standardized || destination,
      waypoints,
      roundTrip
    );

    if (this.distanceCache.has(cacheKey)) {
      const cached = this.distanceCache.get(cacheKey)!;
      if (cached.expiresAt > Date.now()) {
        logger.debug('Distance calculation cache hit', { userId, cacheKey });
        return {
          success: true,
          distance: cached.distance,
          duration: cached.duration,
          fromCache: true,
          confidence: cached.confidence
        };
      }
    }

    // If user can make immediate API call, process directly
    if (this.canUserMakeApiCall(userId)) {
      return this.processDistanceRequest(userId, origin, destination, waypoints, roundTrip);
    }

    // Queue the request
    logger.info('Request queued due to quota limits', { userId });
    return this.queueRequest(userId, origin, destination, waypoints, roundTrip);
  }

  /**
   * Process distance request with Google Maps API
   */
  private async processDistanceRequest(
    userId: number,
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceCalculationResult> {
    try {
      // Record API call
      this.recordApiCall(userId);

      // Build waypoints array
      const destinations = [destination];
      if (waypoints.length > 0) {
        destinations.splice(0, 0, ...waypoints);
      }
      if (roundTrip) {
        destinations.push(origin);
      }

      // Call Google Maps Distance Matrix API
      const result = await this.callDistanceMatrixApi(origin, destinations);
      
      // Cache the result
      const cacheKey = this.generateCacheKey(origin, destination, waypoints, roundTrip);
      this.cacheDistanceResult(cacheKey, result);

      return result;
    } catch (error) {
      logger.error('Distance calculation failed, using fallback', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return this.fallbackEstimation(origin, destination, waypoints, roundTrip);
    }
  }

  /**
   * Call Google Maps Distance Matrix API
   */
  private async callDistanceMatrixApi(
    origin: string,
    destinations: string[]
  ): Promise<DistanceCalculationResult> {
    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const params = new URLSearchParams({
      origins: origin,
      destinations: destinations.join('|'),
      units: 'imperial',
      key: this.googleMapsApiKey
    });

    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.status === 'OK' && data.rows && data.rows[0] && data.rows[0].elements) {
      let totalDistance = 0;
      let totalDuration = 0;
      let hasValidRoute = false;

      for (const element of data.rows[0].elements) {
        if (element.status === 'OK') {
          totalDistance += element.distance.value; // meters
          totalDuration += element.duration.value; // seconds
          hasValidRoute = true;
        }
      }

      if (hasValidRoute) {
        return {
          success: true,
          distance: Math.round(totalDistance / 1609.34 * 100) / 100, // Convert to miles
          duration: Math.round(totalDuration / 60), // Convert to minutes
          confidence: 'high'
        };
      }
    }

    throw new Error(`Distance Matrix API error: ${data.status}`);
  }

  /**
   * Enhanced fallback estimation
   */
  private async fallbackEstimation(
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceCalculationResult> {
    // Try to get coordinates for better estimation
    const [originValidation, destinationValidation] = await Promise.all([
      this.validateAddress(origin),
      this.validateAddress(destination)
    ]);

    if (originValidation.coordinates && destinationValidation.coordinates) {
      // Use coordinate-based estimation
      const distance = this.calculateHaversineDistance(
        originValidation.coordinates,
        destinationValidation.coordinates
      );
      
      // Add waypoint distances (rough estimation)
      let totalDistance = distance;
      if (waypoints.length > 0) {
        totalDistance *= (1 + waypoints.length * 0.3); // 30% increase per waypoint
      }
      if (roundTrip) {
        totalDistance *= 2;
      }

      // Estimate duration (assume 35 mph average)
      const duration = Math.round(totalDistance / 35 * 60);

      return {
        success: true,
        distance: Math.round(totalDistance * 100) / 100,
        duration,
        confidence: 'medium',
        fallbackUsed: true
      };
    }

    // Basic string-based estimation
    const baseDistance = this.estimateDistanceFromAddresses(origin, destination);
    let totalDistance = baseDistance;
    
    if (waypoints.length > 0) {
      totalDistance *= (1 + waypoints.length * 0.3);
    }
    if (roundTrip) {
      totalDistance *= 2;
    }

    const duration = Math.round(totalDistance / 30 * 60); // Assume 30 mph

    return {
      success: true,
      distance: Math.round(totalDistance * 100) / 100,
      duration,
      confidence: 'low',
      fallbackUsed: true
    };
  }

  /**
   * Calculate distance using Haversine formula
   */
  private calculateHaversineDistance(
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number }
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLon = this.toRadians(coord2.lng - coord1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Estimate distance from address strings
   */
  private estimateDistanceFromAddresses(origin: string, destination: string): number {
    // Very basic estimation based on address patterns
    const originLower = origin.toLowerCase();
    const destinationLower = destination.toLowerCase();
    
    // Same city estimation
    if (this.extractCity(originLower) === this.extractCity(destinationLower)) {
      return 5; // 5 miles average for same city
    }
    
    // Different states
    if (this.extractState(originLower) !== this.extractState(destinationLower)) {
      return 300; // 300 miles average for different states
    }
    
    // Same state, different cities
    return 50; // 50 miles average
  }

  /**
   * Extract city from address
   */
  private extractCity(address: string): string {
    const match = address.match(/,\s*([^,]+)(?:,\s*[a-z]{2})?$/);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract state from address
   */
  private extractState(address: string): string {
    const match = address.match(/,\s*([a-z]{2})\s*$/);
    return match ? match[1].trim() : '';
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    origin: string,
    destination: string,
    waypoints: string[],
    roundTrip: boolean
  ): string {
    const key = `${origin}|${destination}|${waypoints.join(',')}|${roundTrip}`;
    return key.toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Cache distance result
   */
  private cacheDistanceResult(cacheKey: string, result: DistanceCalculationResult): void {
    if (this.distanceCache.size >= this.maxCacheSize) {
      this.cleanupCache();
    }

    this.distanceCache.set(cacheKey, {
      distance: result.distance,
      duration: result.duration,
      timestamp: Date.now(),
      expiresAt: Date.now() + (this.cacheExpiryHours * 60 * 60 * 1000),
      confidence: result.confidence || 'medium',
      placeIds: [] // Will be populated if using place IDs
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, cached] of this.distanceCache.entries()) {
      if (cached.expiresAt < now) {
        this.distanceCache.delete(key);
        cleanedCount++;
      }
    }
    
    // If still too large, remove oldest entries
    if (this.distanceCache.size > this.maxCacheSize) {
      const entries = Array.from(this.distanceCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.distanceCache.size - this.maxCacheSize);
      for (const [key] of toRemove) {
        this.distanceCache.delete(key);
        cleanedCount++;
      }
    }
    
    logger.debug('Distance cache cleaned', { cleanedCount, currentSize: this.distanceCache.size });
  }

  /**
   * Clean up address cache
   */
  private cleanupAddressCache(): void {
    // Simple LRU cleanup - remove oldest entries
    const entries = Array.from(this.addressCache.entries());
    const toRemove = Math.floor(this.addressCacheSize * 0.2); // Remove 20%
    
    for (let i = 0; i < toRemove; i++) {
      this.addressCache.delete(entries[i][0]);
    }
    
    logger.debug('Address cache cleaned', { removed: toRemove, currentSize: this.addressCache.size });
  }

  /**
   * Get comprehensive statistics
   */
  public getStats(): {
    cacheSize: number;
    addressCacheSize: number;
    totalUsers: number;
    queueLength: number;
    averageApiCalls: number;
    cacheHitRate: number;
    activeUsers: number;
  } {
    const totalApiCalls = Array.from(this.userQuotas.values()).reduce((sum, quota) => sum + quota.apiCallsThisHour, 0);
    const activeUsers = Array.from(this.userQuotas.values()).filter(quota => quota.apiCallsThisHour > 0).length;
    
    return {
      cacheSize: this.distanceCache.size,
      addressCacheSize: this.addressCache.size,
      totalUsers: this.userQuotas.size,
      queueLength: this.requestQueue.length,
      averageApiCalls: this.userQuotas.size > 0 ? totalApiCalls / this.userQuotas.size : 0,
      cacheHitRate: 0, // Would need tracking for accurate calculation
      activeUsers
    };
  }

  /**
   * Get user-specific statistics
   */
  public getUserStats(userId: number): {
    apiCallsThisHour: number;
    quotaLimit: number;
    priority: string;
    canMakeApiCall: boolean;
    timeUntilReset: number;
  } {
    const quota = this.getUserQuota(userId);
    const timeUntilReset = Math.max(0, 60 * 60 * 1000 - (Date.now() - quota.lastReset));
    
    return {
      apiCallsThisHour: quota.apiCallsThisHour,
      quotaLimit: quota.quotaLimit,
      priority: quota.priority,
      canMakeApiCall: this.canUserMakeApiCall(userId),
      timeUntilReset
    };
  }

  /**
   * Clear all caches (for testing/admin purposes)
   */
  public clearCaches(): void {
    this.distanceCache.clear();
    this.addressCache.clear();
    logger.info('All caches cleared');
  }

  /**
   * Get queue information
   */
  public getQueueInfo(): {
    length: number;
    processingQueue: boolean;
    requests: Array<{
      userId: number;
      priority: number;
      waitTime: number;
    }>;
  } {
    const now = Date.now();
    return {
      length: this.requestQueue.length,
      processingQueue: this.processingQueue,
      requests: this.requestQueue.map(req => ({
        userId: req.userId,
        priority: req.priority,
        waitTime: now - req.timestamp
      }))
    };
  }
}

export const mileageService = new MileageService();
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json`;
    const params = new URLSearchParams({
      input: address,
      inputtype: 'textquery',
      fields: 'place_id,formatted_address,geometry,name,types',
      key: this.googleMapsApiKey
    });

    const response = await fetch(`${url}?${params}`);
    const data = await response.json();

    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const place = data.candidates[0];
      
      // Determine confidence based on place types
      const confidence = this.determinePlaceConfidence(place.types || []);
      
      return {
        valid: true,
        standardized: place.formatted_address,
        placeId: place.place_id,
        coordinates: place.geometry?.location,
        formattedAddress: place.formatted_address,
        confidence,
        issues: []
      };
    } else if (data.status === 'ZERO_RESULTS') {
      return {
        valid: false,
        issues: ['Address not found in Google Places database'],
        confidence: 'low'
      };
    } else {
      throw new Error(`Places API error: ${data.status}`);
    }
  }

  /**
   * Basic address validation fallback
   */
  private basicAddressValidation(address: string): AddressValidationResult {
    const issues: string[] = [];
    
    // Check for common patterns
    const hasNumber = /\d/.test(address);
    const hasStreetPattern = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|pkwy|parkway)\b/i.test(address);
    const hasCity = /,\s*[A-Za-z\s]+(?:,\s*[A-Z]{2})?$/i.test(address);
    
    if (!hasNumber && !hasStreetPattern) {
      issues.push('Address should include a street number or recognizable street pattern');
    }
    
    if (!hasCity) {
      issues.push('Address should include city and state (e.g., "New York, NY")');
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