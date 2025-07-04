// api/intervals-activity.js
// New endpoint to fetch detailed activity data for completion tracking

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { athleteId, apiKey, activityId } = req.body;
    
    if (!athleteId || !apiKey || !activityId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Fetch detailed activity data from Intervals.icu
    const apiUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/activities/${activityId}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      // If activity not found or not accessible, return null instead of error
      if (response.status === 404) {
        return res.status(200).json({ activity: null });
      }
      return res.status(response.status).json({ 
        error: `Intervals.icu API error: ${response.status}` 
      });
    }
    
    const activity = await response.json();
    
    // Process and return the activity data
    const processedActivity = {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      start_date: activity.start_date_local,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      distance: activity.distance,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      average_watts: activity.average_watts,
      weighted_average_watts: activity.weighted_average_watts,
      max_watts: activity.max_watts,
      average_cadence: activity.average_cadence,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      total_elevation_gain: activity.total_elevation_gain,
      kilojoules: activity.kilojoules,
      calories: activity.calories,
      perceived_exertion: activity.perceived_exertion,
      description: activity.description,
      workout_code: activity.workout_code,
      trainer: activity.trainer,
      commute: activity.commute,
      // Training stress and intensity metrics
      training_stress_score: activity.training_stress_score,
      intensity_factor: activity.intensity_factor,
      normalized_power: activity.normalized_power,
      variability_index: activity.variability_index,
      // Weather and conditions
      temperature: activity.temperature,
      wind_speed: activity.wind_speed,
      humidity: activity.humidity,
      // Performance metrics
      average_power_to_weight: activity.average_power ? activity.average_power / (activity.weight || 70) : null,
      efficiency_factor: activity.efficiency_factor,
      // Recovery metrics
      hrv: activity.hrv,
      resting_hr: activity.resting_hr,
      sleep_score: activity.sleep_score
    };
    
    return res.status(200).json({ 
      activity: processedActivity
    });
    
  } catch (error) {
    console.error('Activity proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
