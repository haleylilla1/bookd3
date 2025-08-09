export interface DistanceResult {
  distanceMiles: number;
  travelTimeMinutes: number;
  status: 'success' | 'error' | 'partial_success';
  error?: string;
  segments?: number;
  roundTrip?: boolean;
  errors?: string[];
  fromCache?: boolean;
}

// Development fallback function for distance estimation
function estimateDistance(origin: string, destination: string): DistanceResult {
  if (!origin.trim() || !destination.trim()) {
    return {
      distanceMiles: 0,
      travelTimeMinutes: 0,
      status: 'error',
      error: 'Origin and destination addresses are required'
    };
  }

  // Simple estimation based on address similarity
  const originWords = origin.toLowerCase().split(/[\s,]+/);
  const destWords = destination.toLowerCase().split(/[\s,]+/);
  
  let similarity = 0;
  const commonWords = originWords.filter(word => destWords.includes(word));
  similarity = commonWords.length / Math.max(originWords.length, destWords.length);
  
  // Estimate distance based on address similarity (less similar = farther apart)
  let estimatedMiles;
  if (similarity > 0.7) {
    estimatedMiles = Math.random() * 5 + 2; // 2-7 miles for very similar addresses
  } else if (similarity > 0.4) {
    estimatedMiles = Math.random() * 15 + 8; // 8-23 miles for somewhat similar
  } else {
    estimatedMiles = Math.random() * 40 + 15; // 15-55 miles for different addresses
  }
  
  const roundedMiles = Math.round(estimatedMiles * 100) / 100;
  const estimatedTime = Math.round(roundedMiles * 2.5); // Rough estimate: 2.5 minutes per mile
  
  return {
    distanceMiles: roundedMiles,
    travelTimeMinutes: estimatedTime,
    status: 'success'
  };
}

export async function calculateDistance(
  origin: string,
  destination: string,
  waypoints: string[] = [],
  roundTrip: boolean = false
): Promise<DistanceResult> {
  if (!origin.trim() || !destination.trim()) {
    return {
      distanceMiles: 0,
      travelTimeMinutes: 0,
      status: 'error',
      error: 'Origin and destination addresses are required'
    };
  }

  try {
    // Use simple retry mechanism
    const { fetchWithRetry } = await import('./mobile-optimization');
    
    const response = await fetchWithRetry('/api/calculate-distance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startAddress: origin,
        endAddress: destination,
        waypoints: waypoints.filter(w => w?.trim()),
        roundTrip
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return {
        distanceMiles: 0,
        travelTimeMinutes: 0,
        status: 'error',
        error: errorData.error || 'Failed to calculate distance'
      };
    }

    const data = await response.json();
    
    // Validate response data
    if (!data.status || typeof data.distanceMiles !== 'number') {
      return {
        distanceMiles: 0,
        travelTimeMinutes: 0,
        status: 'error',
        error: data.error || 'Invalid response from distance service'
      };
    }
    
    return {
      distanceMiles: data.distanceMiles,
      travelTimeMinutes: data.travelTimeMinutes || 0,
      status: data.status,
      segments: data.segments,
      roundTrip: data.roundTrip,
      errors: data.errors,
      fromCache: data.fromCache
    };
  } catch (error) {
    console.error('Distance calculation error:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          distanceMiles: 0,
          travelTimeMinutes: 0,
          status: 'error',
          error: 'Request timeout - please check your internet connection'
        };
      }
      
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return {
          distanceMiles: 0,
          travelTimeMinutes: 0,
          status: 'error',
          error: 'Network error - please check your internet connection'
        };
      }
    }
    
    return {
      distanceMiles: 0,
      travelTimeMinutes: 0,
      status: 'error',
      error: 'Failed to connect to distance calculation service'
    };
  }
}