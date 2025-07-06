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
    const { athleteId, apiKey, date, oldest, newest } = req.body;
    
    if (!athleteId || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const authHeader = `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    };
    
    let eventsData = [];
    let activitiesData = [];
    
    // Build API URLs for both endpoints
    if (oldest && newest) {
      // Date range query for calendar
      const eventsUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`;
      const activitiesUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`;
      
      console.log('Fetching events from:', eventsUrl);
      console.log('Fetching activities from:', activitiesUrl);
      
      // Fetch both planned events and completed activities
      const [eventsResponse, activitiesResponse] = await Promise.allSettled([
        fetch(eventsUrl, { headers }),
        fetch(activitiesUrl, { headers })
      ]);
      
      // Process events response
      if (eventsResponse.status === 'fulfilled' && eventsResponse.value.ok) {
        eventsData = await eventsResponse.value.json();
        console.log(`Found ${eventsData.length} planned events`);
      } else {
        console.warn('Events API failed:', eventsResponse.status === 'fulfilled' ? eventsResponse.value.status : eventsResponse.reason);
      }
      
      // Process activities response  
      if (activitiesResponse.status === 'fulfilled' && activitiesResponse.value.ok) {
        activitiesData = await activitiesResponse.value.json();
        console.log(`Found ${activitiesData.length} completed activities`);
      } else {
        console.warn('Activities API failed:', activitiesResponse.status === 'fulfilled' ? activitiesResponse.value.status : activitiesResponse.reason);
      }
      
    } else if (date) {
      // Single date query
      const eventsUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${date}&newest=${date}`;
      const activitiesUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${date}&newest=${date}`;
      
      console.log('Fetching events from:', eventsUrl);
      console.log('Fetching activities from:', activitiesUrl);
      
      // Fetch both planned events and completed activities
      const [eventsResponse, activitiesResponse] = await Promise.allSettled([
        fetch(eventsUrl, { headers }),
        fetch(activitiesUrl, { headers })
      ]);
      
      // Process events response
      if (eventsResponse.status === 'fulfilled' && eventsResponse.value.ok) {
        eventsData = await eventsResponse.value.json();
        console.log(`Found ${eventsData.length} planned events for ${date}`);
      } else {
        console.warn('Events API failed:', eventsResponse.status === 'fulfilled' ? eventsResponse.value.status : eventsResponse.reason);
      }
      
      // Process activities response
      if (activitiesResponse.status === 'fulfilled' && activitiesResponse.value.ok) {
        activitiesData = await activitiesResponse.value.json();
        console.log(`Found ${activitiesData.length} completed activities for ${date}`);
      } else {
        console.warn('Activities API failed:', activitiesResponse.status === 'fulfilled' ? activitiesResponse.value.status : activitiesResponse.reason);
      }
      
    } else {
      return res.status(400).json({ error: 'Either date or oldest/newest range required' });
    }
    
    // Combine and deduplicate events
    const combinedEvents = combineEventsAndActivities(eventsData, activitiesData);
    
    console.log(`Returning ${combinedEvents.length} total events (${eventsData.length} planned + ${activitiesData.length} activities)`);
    
    return res.status(200).json({ 
      events: combinedEvents,
      total: combinedEvents.length,
      planned: eventsData.length,
      completed: activitiesData.length
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Helper function to combine and deduplicate events and activities
function combineEventsAndActivities(eventsData, activitiesData) {
  const combined = [];
  const activityIds = new Set();
  
  // Add all planned events first, marking them as planned
  eventsData.forEach(event => {
    combined.push({
      ...event,
      source: 'planned',
      isPlannedWorkout: true
    });
  });
  
  // Add completed activities, marking them as completed
  activitiesData.forEach(activity => {
    // Skip if this activity is already linked to a planned event
    if (activityIds.has(activity.id)) return;
    
    activityIds.add(activity.id);
    
    // Transform activity data to match event structure
    const transformedActivity = {
      ...activity,
      source: 'completed',
      isCompletedActivity: true,
      // Ensure consistent field names
      start_date_local: activity.start_date_local || activity.start_date,
      name: activity.name || activity.type || 'Completed Activity',
      type: activity.type || 'Unknown',
      // Mark as having actual data
      moving_time: activity.moving_time,
      distance: activity.distance,
      average_heartrate: activity.average_heartrate,
      average_watts: activity.average_watts,
      kilojoules: activity.kilojoules,
      calories: activity.calories,
      total_elevation_gain: activity.total_elevation_gain
    };
    
    combined.push(transformedActivity);
  });
  
  // Sort by start date
  combined.sort((a, b) => {
    const dateA = new Date(a.start_date_local || a.start_date);
    const dateB = new Date(b.start_date_local || b.start_date);
    return dateA - dateB;
  });
  
  return combined;
}