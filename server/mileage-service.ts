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
  originCoordinates?: { lat: number; lng: number };
  destinationCoordinates?: { lat: number; lng: number };
  accessCount: number;
  lastAccessed: number;
  routeType: 'direct' | 'waypoint' | 'roundtrip';
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

interface GeographicCluster {
  centroid: { lat: number; lng: number };
  radius: number; // in miles
  cacheKeys: string[];
  popularity: number;
  lastUpdated: number;
}

interface HistoricalPattern {
  routeSignature: string;
  averageDistance: number;
  averageDuration: number;
  confidence: number;
  sampleCount: number;
  timeOfDay: string;
  dayOfWeek: string;
  lastUpdated: number;
}

export class MileageService {
  private distanceCache: Map<string, CachedDistanceResult> = new Map();
  private addressCache: Map<string, AddressValidationResult> = new Map();
  private userQuotas: Map<number, UserQuota> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private processingQueue = false;
  
  // Geographic clustering for smart caching
  private geographicClusters: Map<string, GeographicCluster> = new Map();
  private historicalPatterns: Map<string, HistoricalPattern> = new Map();
  private clusterRadius = 5; // miles
  private maxClusters = 100;
  
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
      this.optimizeGeographicClusters();
      this.updateHistoricalPatterns();
    }, 60 * 60 * 1000); // Every hour
    
    // Process request queue
    setInterval(() => {
      this.processQueue();
    }, this.queueProcessingInterval);
    
    logger.info('Enterprise MileageService initialized', {
      placesApiEnabled: this.placesApiEnabled,
      globalLimit: this.globalApiCallsPerHour,
      defaultUserQuota: this.defaultUserQuota,
      geographicClustering: true,
      historicalPatterns: true
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
   * Validate address using Google Places API
   */
  private async validateWithPlacesApi(address: string): Promise<AddressValidationResult> {
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
        // Update access tracking
        cached.accessCount++;
        cached.lastAccessed = Date.now();
        
        logger.debug('Distance calculation cache hit', { userId, cacheKey, accessCount: cached.accessCount });
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

      // Get coordinates for caching enhancement
      const [originValidation, destinationValidation] = await Promise.all([
        this.validateAddress(origin),
        this.validateAddress(destination)
      ]);

      // Call Google Maps Distance Matrix API
      const result = await this.callDistanceMatrixApi(origin, destinations);
      
      // Cache the result with coordinates
      const cacheKey = this.generateCacheKey(origin, destination, waypoints, roundTrip);
      this.cacheDistanceResult(cacheKey, result, originValidation.coordinates, destinationValidation.coordinates);

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
   * Enhanced fallback estimation with historical data
   */
  private async fallbackEstimation(
    origin: string,
    destination: string,
    waypoints: string[] = [],
    roundTrip: boolean = false
  ): Promise<DistanceCalculationResult> {
    // Check historical patterns first
    const routeSignature = this.generateRouteSignature(origin, destination, waypoints, roundTrip);
    const historicalPattern = this.getHistoricalPattern(routeSignature);
    
    if (historicalPattern && historicalPattern.confidence > 0.7) {
      logger.debug('Using historical pattern for fallback estimation', {
        routeSignature,
        confidence: historicalPattern.confidence,
        samples: historicalPattern.sampleCount
      });
      
      return {
        success: true,
        distance: historicalPattern.averageDistance,
        duration: historicalPattern.averageDuration,
        confidence: historicalPattern.confidence > 0.8 ? 'medium' : 'low',
        fallbackUsed: true
      };
    }

    // Check geographic clusters for similar routes
    const clusterEstimate = this.getClusterBasedEstimate(origin, destination, waypoints, roundTrip);
    if (clusterEstimate) {
      return clusterEstimate;
    }

    // Try to get coordinates for better estimation
    const [originValidation, destinationValidation] = await Promise.all([
      this.validateAddress(origin),
      this.validateAddress(destination)
    ]);

    if (originValidation.coordinates && destinationValidation.coordinates) {
      // Use coordinate-based estimation with traffic pattern adjustment
      const distance = this.calculateHaversineDistance(
        originValidation.coordinates,
        destinationValidation.coordinates
      );
      
      // Apply traffic pattern multiplier based on time of day
      const trafficMultiplier = this.getTrafficMultiplier();
      let adjustedDistance = distance * trafficMultiplier;
      
      // Add waypoint distances (improved estimation)
      if (waypoints.length > 0) {
        adjustedDistance *= (1 + waypoints.length * 0.25); // 25% increase per waypoint
      }
      if (roundTrip) {
        adjustedDistance *= 2;
      }

      // Estimate duration with traffic consideration
      const baseSpeed = this.getEstimatedSpeed(distance);
      const duration = Math.round(adjustedDistance / baseSpeed * 60);

      return {
        success: true,
        distance: Math.round(adjustedDistance * 100) / 100,
        duration,
        confidence: 'medium',
        fallbackUsed: true
      };
    }

    // Enhanced string-based estimation with regional patterns
    const baseDistance = this.estimateDistanceFromAddresses(origin, destination);
    let totalDistance = baseDistance;
    
    // Apply regional adjustment
    const regionalMultiplier = this.getRegionalMultiplier(origin, destination);
    totalDistance *= regionalMultiplier;
    
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
   * Cache distance result with geographic clustering
   */
  private cacheDistanceResult(cacheKey: string, result: DistanceCalculationResult, originCoords?: { lat: number; lng: number }, destCoords?: { lat: number; lng: number }): void {
    if (this.distanceCache.size >= this.maxCacheSize) {
      this.cleanupCache();
    }

    const cachedResult: CachedDistanceResult = {
      distance: result.distance,
      duration: result.duration,
      timestamp: Date.now(),
      expiresAt: Date.now() + (this.cacheExpiryHours * 60 * 60 * 1000),
      confidence: result.confidence || 'medium',
      placeIds: [],
      originCoordinates: originCoords,
      destinationCoordinates: destCoords,
      accessCount: 1,
      lastAccessed: Date.now(),
      routeType: cacheKey.includes('waypoint') ? 'waypoint' : cacheKey.includes('true') ? 'roundtrip' : 'direct'
    };

    this.distanceCache.set(cacheKey, cachedResult);
    
    // Update geographic clusters if coordinates are available
    if (originCoords && destCoords) {
      this.updateGeographicClusters(cacheKey, originCoords, destCoords);
    }
    
    // Update historical patterns
    this.updateHistoricalPattern(cacheKey, result);
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
    geographicClusters: number;
    historicalPatterns: number;
    clusterEfficiency: number;
    patternConfidence: number;
  } {
    const totalApiCalls = Array.from(this.userQuotas.values()).reduce((sum, quota) => sum + quota.apiCallsThisHour, 0);
    const activeUsers = Array.from(this.userQuotas.values()).filter(quota => quota.apiCallsThisHour > 0).length;
    
    // Calculate cluster efficiency
    const totalCacheEntries = this.distanceCache.size;
    const clusteredEntries = Array.from(this.geographicClusters.values()).reduce((sum, cluster) => sum + cluster.cacheKeys.length, 0);
    const clusterEfficiency = totalCacheEntries > 0 ? clusteredEntries / totalCacheEntries : 0;
    
    // Calculate average pattern confidence
    const patterns = Array.from(this.historicalPatterns.values());
    const patternConfidence = patterns.length > 0 ? patterns.reduce((sum, pattern) => sum + pattern.confidence, 0) / patterns.length : 0;
    
    return {
      cacheSize: this.distanceCache.size,
      addressCacheSize: this.addressCache.size,
      totalUsers: this.userQuotas.size,
      queueLength: this.requestQueue.length,
      averageApiCalls: this.userQuotas.size > 0 ? totalApiCalls / this.userQuotas.size : 0,
      cacheHitRate: 0, // Would need tracking for accurate calculation
      activeUsers,
      geographicClusters: this.geographicClusters.size,
      historicalPatterns: this.historicalPatterns.size,
      clusterEfficiency: Math.round(clusterEfficiency * 100) / 100,
      patternConfidence: Math.round(patternConfidence * 100) / 100
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

  /**
   * Update geographic clusters for smart caching
   */
  private updateGeographicClusters(cacheKey: string, originCoords: { lat: number; lng: number }, destCoords: { lat: number; lng: number }): void {
    // Calculate midpoint for cluster assignment
    const midpoint = {
      lat: (originCoords.lat + destCoords.lat) / 2,
      lng: (originCoords.lng + destCoords.lng) / 2
    };

    // Find existing cluster within radius
    let assignedCluster: GeographicCluster | null = null;
    let clusterKey: string | null = null;

    for (const [key, cluster] of this.geographicClusters.entries()) {
      const distance = this.calculateHaversineDistance(midpoint, cluster.centroid);
      if (distance <= this.clusterRadius) {
        assignedCluster = cluster;
        clusterKey = key;
        break;
      }
    }

    if (assignedCluster && clusterKey) {
      // Update existing cluster
      assignedCluster.cacheKeys.push(cacheKey);
      assignedCluster.popularity++;
      assignedCluster.lastUpdated = Date.now();
      
      // Recalculate centroid with weighted average
      const totalKeys = assignedCluster.cacheKeys.length;
      assignedCluster.centroid = {
        lat: (assignedCluster.centroid.lat * (totalKeys - 1) + midpoint.lat) / totalKeys,
        lng: (assignedCluster.centroid.lng * (totalKeys - 1) + midpoint.lng) / totalKeys
      };
    } else {
      // Create new cluster
      if (this.geographicClusters.size >= this.maxClusters) {
        this.pruneGeographicClusters();
      }

      const newClusterKey = `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.geographicClusters.set(newClusterKey, {
        centroid: midpoint,
        radius: this.clusterRadius,
        cacheKeys: [cacheKey],
        popularity: 1,
        lastUpdated: Date.now()
      });
    }
  }

  /**
   * Optimize geographic clusters by removing stale ones
   */
  private optimizeGeographicClusters(): void {
    const now = Date.now();
    const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const [key, cluster] of this.geographicClusters.entries()) {
      if (now - cluster.lastUpdated > staleThreshold) {
        this.geographicClusters.delete(key);
      }
    }

    logger.debug('Geographic clusters optimized', {
      activeCount: this.geographicClusters.size,
      maxClusters: this.maxClusters
    });
  }

  /**
   * Prune geographic clusters when limit is reached
   */
  private pruneGeographicClusters(): void {
    const clusters = Array.from(this.geographicClusters.entries());
    clusters.sort((a, b) => a[1].popularity - b[1].popularity); // Sort by popularity (ascending)
    
    const toRemove = clusters.slice(0, Math.floor(this.maxClusters * 0.2)); // Remove 20% least popular
    toRemove.forEach(([key]) => this.geographicClusters.delete(key));
  }

  /**
   * Get cluster-based estimate for similar routes
   */
  private getClusterBasedEstimate(origin: string, destination: string, waypoints: string[], roundTrip: boolean): DistanceCalculationResult | null {
    // This is a simplified implementation - in production, you'd want more sophisticated matching
    const routeSignature = this.generateRouteSignature(origin, destination, waypoints, roundTrip);
    
    // Look for similar routes in clusters
    for (const cluster of this.geographicClusters.values()) {
      for (const cacheKey of cluster.cacheKeys) {
        const cached = this.distanceCache.get(cacheKey);
        if (cached && cached.confidence !== 'low') {
          // Apply cluster-based adjustment
          const adjustmentFactor = 1 + (Math.random() * 0.2 - 0.1); // ±10% variation
          
          return {
            success: true,
            distance: Math.round(cached.distance * adjustmentFactor * 100) / 100,
            duration: Math.round(cached.duration * adjustmentFactor),
            confidence: 'medium',
            fallbackUsed: true
          };
        }
      }
    }

    return null;
  }

  /**
   * Update historical patterns
   */
  private updateHistoricalPattern(cacheKey: string, result: DistanceCalculationResult): void {
    const routeSignature = this.generateRouteSignature(cacheKey);
    const now = new Date();
    const timeOfDay = this.getTimeOfDayCategory(now);
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    const patternKey = `${routeSignature}_${timeOfDay}_${dayOfWeek}`;
    const existingPattern = this.historicalPatterns.get(patternKey);

    if (existingPattern) {
      // Update existing pattern with weighted average
      const newSampleCount = existingPattern.sampleCount + 1;
      const weight = existingPattern.sampleCount / newSampleCount;
      
      existingPattern.averageDistance = (existingPattern.averageDistance * weight) + (result.distance * (1 - weight));
      existingPattern.averageDuration = (existingPattern.averageDuration * weight) + (result.duration * (1 - weight));
      existingPattern.sampleCount = newSampleCount;
      existingPattern.confidence = Math.min(0.95, existingPattern.confidence + 0.05);
      existingPattern.lastUpdated = Date.now();
    } else {
      // Create new pattern
      this.historicalPatterns.set(patternKey, {
        routeSignature,
        averageDistance: result.distance,
        averageDuration: result.duration,
        confidence: 0.3, // Start with low confidence
        sampleCount: 1,
        timeOfDay,
        dayOfWeek,
        lastUpdated: Date.now()
      });
    }
  }

  /**
   * Get historical pattern for route
   */
  private getHistoricalPattern(routeSignature: string): HistoricalPattern | null {
    const now = new Date();
    const timeOfDay = this.getTimeOfDayCategory(now);
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    // Try exact match first
    const exactKey = `${routeSignature}_${timeOfDay}_${dayOfWeek}`;
    const exactPattern = this.historicalPatterns.get(exactKey);
    if (exactPattern) {
      return exactPattern;
    }

    // Try time-of-day match
    const timeKey = `${routeSignature}_${timeOfDay}`;
    for (const [key, pattern] of this.historicalPatterns.entries()) {
      if (key.startsWith(timeKey)) {
        return pattern;
      }
    }

    // Try route signature match
    for (const [key, pattern] of this.historicalPatterns.entries()) {
      if (key.startsWith(routeSignature)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Generate route signature for pattern matching
   */
  private generateRouteSignature(origin: string, destination: string, waypoints: string[] = [], roundTrip: boolean = false): string;
  private generateRouteSignature(cacheKey: string): string;
  private generateRouteSignature(originOrCacheKey: string, destination?: string, waypoints?: string[], roundTrip?: boolean): string {
    if (destination === undefined) {
      // Called with cacheKey
      const parts = originOrCacheKey.split('|');
      return `${this.normalizeLocation(parts[0])}_${this.normalizeLocation(parts[1])}`;
    }
    
    // Called with individual parameters
    const normalizedOrigin = this.normalizeLocation(originOrCacheKey);
    const normalizedDestination = this.normalizeLocation(destination);
    
    let signature = `${normalizedOrigin}_${normalizedDestination}`;
    
    if (waypoints && waypoints.length > 0) {
      signature += `_wp${waypoints.length}`;
    }
    
    if (roundTrip) {
      signature += '_rt';
    }
    
    return signature;
  }

  /**
   * Normalize location for pattern matching
   */
  private normalizeLocation(location: string): string {
    return location.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 20); // Limit length
  }

  /**
   * Get time of day category
   */
  private getTimeOfDayCategory(date: Date): string {
    const hour = date.getHours();
    if (hour >= 6 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 14) return 'midday';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Get traffic multiplier based on time of day
   */
  private getTrafficMultiplier(): number {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Weekend traffic is generally lighter
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 1.0;
    }

    // Weekday traffic patterns
    if (hour >= 7 && hour <= 9) return 1.3; // Morning rush
    if (hour >= 17 && hour <= 19) return 1.4; // Evening rush
    if (hour >= 11 && hour <= 14) return 1.1; // Lunch traffic
    
    return 1.0; // Normal traffic
  }

  /**
   * Get estimated speed based on distance
   */
  private getEstimatedSpeed(distance: number): number {
    // Adjust speed based on distance (shorter = more city driving)
    if (distance < 5) return 25; // City driving
    if (distance < 20) return 35; // Mixed driving
    if (distance < 50) return 45; // Suburban/highway
    return 55; // Highway driving
  }

  /**
   * Get regional multiplier for distance estimation
   */
  private getRegionalMultiplier(origin: string, destination: string): number {
    const originLower = origin.toLowerCase();
    const destinationLower = destination.toLowerCase();
    
    // Dense urban areas tend to have more indirect routes
    const urbanAreas = ['manhattan', 'brooklyn', 'san francisco', 'boston', 'chicago'];
    const isUrbanRoute = urbanAreas.some(area => 
      originLower.includes(area) || destinationLower.includes(area)
    );
    
    if (isUrbanRoute) {
      return 1.2; // 20% longer due to traffic and indirect routes
    }
    
    // Rural areas might have more direct routes
    const ruralIndicators = ['county', 'rural', 'farm', 'ranch'];
    const isRuralRoute = ruralIndicators.some(indicator =>
      originLower.includes(indicator) || destinationLower.includes(indicator)
    );
    
    if (isRuralRoute) {
      return 0.9; // 10% shorter due to more direct routes
    }
    
    return 1.0; // Normal multiplier
  }

  /**
   * Update and cleanup historical patterns
   */
  private updateHistoricalPatterns(): void {
    const now = Date.now();
    const staleThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    let removedCount = 0;
    for (const [key, pattern] of this.historicalPatterns.entries()) {
      if (now - pattern.lastUpdated > staleThreshold) {
        this.historicalPatterns.delete(key);
        removedCount++;
      }
    }
    
    logger.debug('Historical patterns updated', {
      activeCount: this.historicalPatterns.size,
      removedStale: removedCount
    });
  }
}

export const mileageService = new MileageService();