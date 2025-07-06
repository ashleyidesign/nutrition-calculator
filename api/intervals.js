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
        
        // Fetch detailed workout structure for planned events
        eventsData = await fetchWorkoutDetails(eventsData, athleteId, headers);
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
        
        // Fetch detailed workout structure for planned events
        eventsData = await fetchWorkoutDetails(eventsData, athleteId, headers);
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

// NEW: Fetch detailed workout structure for events
async function fetchWorkoutDetails(events, athleteId, headers) {
  const enhancedEvents = [];
  
  for (const event of events) {
    let enhancedEvent = { ...event };
    
    // For planned workouts, fetch detailed structure if available
    if (event.id && (event.workout_doc || event.type === 'Workout')) {
      try {
        // Fetch detailed workout data including intervals
        const workoutUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/events/${event.id}`;
        console.log(`Fetching workout details for event ${event.id}:`, workoutUrl);
        
        const workoutResponse = await fetch(workoutUrl, { headers });
        
        if (workoutResponse.ok) {
          const workoutDetails = await workoutResponse.json();
          console.log(`✅ Got workout details for ${event.name}:`, {
            hasSteps: !!workoutDetails.workout_doc?.steps,
            stepCount: workoutDetails.workout_doc?.steps?.length || 0,
            hasZoneTimes: !!workoutDetails.workout_doc?.zoneTimes
          });
          
          // Merge detailed workout structure
          enhancedEvent = {
            ...enhancedEvent,
            workout_doc: workoutDetails.workout_doc,
            description: workoutDetails.description || enhancedEvent.description,
            workout_code: workoutDetails.workout_code || enhancedEvent.workout_code,
            // Add intervals structure for easier parsing
            intervals: parseWorkoutIntervals(workoutDetails.workout_doc)
          };
        } else {
          console.warn(`Failed to fetch workout details for event ${event.id}: ${workoutResponse.status}`);
        }
      } catch (error) {
        console.warn(`Error fetching workout details for event ${event.id}:`, error.message);
      }
    }
    
    enhancedEvents.push(enhancedEvent);
  }
  
  return enhancedEvents;
}

// NEW: Parse workout document into simplified intervals structure
function parseWorkoutIntervals(workoutDoc) {
  if (!workoutDoc || !workoutDoc.steps) {
    return null;
  }
  
  const intervals = [];
  let currentTime = 0;
  
  workoutDoc.steps.forEach((step, index) => {
    const duration = step.duration || 0; // Duration in seconds
    const durationMinutes = Math.round(duration / 60);
    
    // Determine intensity from power or HR zones
    let intensity = 'moderate';
    let targetValue = null;
    let targetType = null;
    
    if (step.power) {
      const avgPower = (step.power.start + step.power.end) / 2;
      targetValue = Math.round(avgPower);
      targetType = 'power';
      
      // Classify power zones (rough estimates)
      if (avgPower < 120) intensity = 'recovery';
      else if (avgPower < 160) intensity = 'endurance'; 
      else if (avgPower < 200) intensity = 'tempo';
      else if (avgPower < 250) intensity = 'threshold';
      else intensity = 'vo2max';
      
    } else if (step.hr) {
      const avgHR = (step.hr.start + step.hr.end) / 2;
      targetValue = Math.round(avgHR);
      targetType = 'hr_percent';
      
      // Classify HR zones (% of LTHR)
      if (avgHR < 75) intensity = 'recovery';
      else if (avgHR < 82) intensity = 'endurance';
      else if (avgHR < 87) intensity = 'tempo';
      else if (avgHR < 92) intensity = 'threshold';
      else intensity = 'vo2max';
    }
    
    intervals.push({
      index: index,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration: duration,
      durationMinutes: durationMinutes,
      intensity: intensity,
      targetValue: targetValue,
      targetType: targetType,
      description: step.text || step.note || null,
      rawStep: step // Keep original for detailed parsing
    });
    
    currentTime += duration;
  });
  
  // Add zone time summary if available
  const zoneTimes = workoutDoc.zoneTimes || [];
  const significantZones = zoneTimes.filter(zone => zone.secs > 60); // Only zones with >1 min
  
  return {
    intervals: intervals,
    totalDuration: currentTime,
    totalDurationMinutes: Math.round(currentTime / 60),
    zoneTimes: significantZones,
    workoutType: classifyWorkoutFromIntervals(intervals, significantZones)
  };
}

// NEW: Classify workout type based on interval structure
function classifyWorkoutFromIntervals(intervals, zoneTimes) {
  if (!intervals || intervals.length === 0) return 'unknown';
  
  // Count time in different intensities
  let recoveryTime = 0;
  let enduranceTime = 0;
  let tempoTime = 0;
  let thresholdTime = 0;
  let vo2maxTime = 0;
  
  intervals.forEach(interval => {
    const duration = interval.duration;
    switch(interval.intensity) {
      case 'recovery': recoveryTime += duration; break;
      case 'endurance': enduranceTime += duration; break;
      case 'tempo': tempoTime += duration; break;
      case 'threshold': thresholdTime += duration; break;
      case 'vo2max': vo2maxTime += duration; break;
    }
  });
  
  const totalTime = recoveryTime + enduranceTime + tempoTime + thresholdTime + vo2maxTime;
  
  // Classify based on dominant intensity
  if (vo2maxTime / totalTime > 0.15) return 'intervals';
  if (thresholdTime / totalTime > 0.25) return 'threshold';
  if (tempoTime / totalTime > 0.3) return 'tempo';
  if (enduranceTime / totalTime > 0.6) return 'endurance';
  
  // Check for strength endurance patterns (low cadence, high force)
  const hasLowCadence = intervals.some(interval => 
    interval.description && interval.description.toLowerCase().includes('cadence')
  );
  if (hasLowCadence) return 'strength';
  
  return 'endurance'; // Default fallback
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