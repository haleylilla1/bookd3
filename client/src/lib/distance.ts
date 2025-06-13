export interface DistanceResult {
  distanceMiles: number;
  travelTimeMinutes: number;
  status: 'success' | 'error';
  error?: string;
}

export async function calculateDistance(
  origin: string,
  destination: string
): Promise<DistanceResult> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return {
      distanceMiles: 0,
      travelTimeMinutes: 0,
      status: 'error',
      error: 'Google Maps API key not configured'
    };
  }

  if (!origin.trim() || !destination.trim()) {
    return {
      distanceMiles: 0,
      travelTimeMinutes: 0,
      status: 'error',
      error: 'Origin and destination addresses are required'
    };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return {
        distanceMiles: 0,
        travelTimeMinutes: 0,
        status: 'error',
        error: `Google Maps API error: ${data.status}`
      };
    }

    const element = data.rows[0]?.elements[0];
    
    if (!element || element.status !== 'OK') {
      return {
        distanceMiles: 0,
        travelTimeMinutes: 0,
        status: 'error',
        error: 'Could not calculate distance between addresses'
      };
    }

    // Convert meters to miles (1 meter = 0.000621371 miles)
    const distanceMiles = Math.round((element.distance.value * 0.000621371) * 100) / 100;
    
    // Convert seconds to minutes
    const travelTimeMinutes = Math.round(element.duration.value / 60);

    return {
      distanceMiles,
      travelTimeMinutes,
      status: 'success'
    };
  } catch (error) {
    return {
      distanceMiles: 0,
      travelTimeMinutes: 0,
      status: 'error',
      error: 'Failed to connect to Google Maps API'
    };
  }
}