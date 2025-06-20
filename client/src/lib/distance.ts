export interface DistanceResult {
  distanceMiles: number;
  travelTimeMinutes: number;
  status: 'success' | 'error';
  error?: string;
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
  destination: string
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
    const response = await fetch('/api/calculate-distance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin,
        destination
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        distanceMiles: 0,
        travelTimeMinutes: 0,
        status: 'error',
        error: errorData.error || 'Failed to calculate distance'
      };
    }

    const data = await response.json();
    return {
      distanceMiles: data.distanceMiles,
      travelTimeMinutes: data.travelTimeMinutes,
      status: 'success'
    };
  } catch (error) {
    return {
      distanceMiles: 0,
      travelTimeMinutes: 0,
      status: 'error',
      error: 'Failed to connect to distance calculation service'
    };
  }
}