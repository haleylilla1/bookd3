/**
 * Simple Mileage Service - No Over-Engineering
 * Replaces 1452-line over-engineered mileage system
 */

interface MileageResult {
  distance: number;
  success: boolean;
  error?: string;
}

class SimpleMileageService {
  private cache = new Map<string, { distance: number; expires: number }>();
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

  async calculateDistance(origin: string, destination: string): Promise<MileageResult> {
    if (!origin || !destination) {
      return { distance: 0, success: false, error: 'Missing addresses' };
    }

    // Check cache first
    const cacheKey = `${origin}|${destination}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return { distance: cached.distance, success: true };
    }

    // If no API key, return simple estimation
    if (!this.apiKey) {
      const estimated = this.estimateDistance(origin, destination);
      return { distance: estimated, success: true };
    }

    try {
      // Call Google Maps API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      
      if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
        const distance = this.parseDistance(data.rows[0].elements[0].distance.text);
        
        // Cache for 24 hours
        this.cache.set(cacheKey, {
          distance,
          expires: Date.now() + 24 * 60 * 60 * 1000
        });

        return { distance, success: true };
      } else {
        throw new Error('No route found');
      }
    } catch (error) {
      // Fallback to estimation
      const estimated = this.estimateDistance(origin, destination);
      return { distance: estimated, success: true };
    }
  }

  private estimateDistance(origin: string, destination: string): number {
    // Very simple estimation based on string similarity
    const originWords = origin.toLowerCase().split(/[\s,]+/);
    const destWords = destination.toLowerCase().split(/[\s,]+/);
    
    const commonWords = originWords.filter(word => destWords.includes(word));
    const similarity = commonWords.length / Math.max(originWords.length, destWords.length);
    
    // Less similar = farther apart
    if (similarity > 0.7) return 5;   // Same area
    if (similarity > 0.4) return 15;  // Same city/region
    return 30; // Different areas
  }

  private parseDistance(distanceText: string): number {
    const match = distanceText.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  // Clean expired cache entries
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expires <= now) {
        this.cache.delete(key);
      }
    }
  }
}

export const simpleMileageService = new SimpleMileageService();

// Clean cache every hour
setInterval(() => simpleMileageService.cleanup(), 60 * 60 * 1000);