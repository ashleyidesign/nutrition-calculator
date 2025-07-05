// Enhanced Intervals.icu API Module with Completion Data
const intervalsAPI = {
    // Load workouts for a specific date
    async loadWorkouts(apiKey, athleteId, date) {
        console.log('🔥 API: Loading workouts for', date);
        
        const response = await fetch('/api/intervals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                athleteId: athleteId,
                apiKey: apiKey,
                date: date
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        
        return data.events || [];
    },
    
    // Load all activities for a date range (completed workouts)
    async loadActivitiesForDateRange(apiKey, athleteId, startDate, endDate) {
        console.log('🏃 API: Loading activities for range', startDate, 'to', endDate);
        
        const response = await fetch('/api/intervals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                athleteId: athleteId,
                apiKey: apiKey,
                oldest: startDate,
                newest: endDate,
                type: 'activities' // We'll modify the endpoint to handle this
            })
        });
        
        if (!response.ok) {
            throw new Error(`Activities API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Activities API response:', data);
        
        return data.activities || [];
    },
    async loadWorkoutsForDateRange(apiKey, athleteId, startDate, endDate) {
        console.log('🔥 API: Loading workouts for range', startDate, 'to', endDate);
        
        const response = await fetch('/api/intervals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                athleteId: athleteId,
                apiKey: apiKey,
                oldest: startDate,
                newest: endDate
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API range response:', data);
        
        return data.events || [];
    },

    // Load completed activity data for a specific workout
    async loadActivityDetails(apiKey, athleteId, activityId) {
        console.log('🎯 API: Loading activity details for', activityId);
        
        try {
            const response = await fetch('/api/intervals-activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    athleteId: athleteId,
                    apiKey: apiKey,
                    activityId: activityId
                })
            });
            
            if (!response.ok) {
                console.warn(`Activity API Error: ${response.status} for activity ${activityId}`);
                return null;
            }
            
            const data = await response.json();
            console.log('🔍 Raw API response for activity', activityId, ':', data);
            
            return data.activity ? this.processActivityData(data.activity) : null;
            
        } catch (error) {
            console.warn('Could not load activity details:', error);
            return null;
        }
    },

    // Process raw activity data into usable completion data
    processActivityData(rawData) {
        console.log('🔍 Processing activity data:', rawData);
        
        // Handle the case where rawData might be nested under 'activity'
        const activityData = rawData.activity || rawData;
        
        const processedData = {
            id: activityData.id,
            actualDuration: Math.round((activityData.moving_time || activityData.elapsed_time || 0) / 60),
            avgHeartRate: activityData.average_heartrate,
            maxHeartRate: activityData.max_heartrate,
            avgPower: activityData.average_watts,
            maxPower: activityData.max_watts,
            avgCadence: activityData.average_cadence,
            elevationGain: activityData.total_elevation_gain,
            distance: activityData.distance,
            avgSpeed: activityData.average_speed,
            calories: activityData.kilojoules ? Math.round(activityData.kilojoules / 4.184) : null,
            trainingStressScore: activityData.training_stress_score,
            perceivedEffort: activityData.perceived_exertion || null,
            description: activityData.description,
            workoutCode: activityData.workout_code
        };
        
        console.log('✅ Processed activity data:', processedData);
        return processedData;
    },

    // Enhanced range loading with completion data for past workouts
    async loadWorkoutsForDateRangeWithCompletion(apiKey, athleteId, startDate, endDate) {
        // Load both planned workouts (events) and completed workouts (activities)
        const [events, activities] = await Promise.all([
            this.loadWorkoutsForDateRange(apiKey, athleteId, startDate, endDate),
            this.loadActivitiesForDateRange(apiKey, athleteId, startDate, endDate)
        ]);
        
        const today = new Date();
        
        // Process planned workouts and add completion data
        const workoutsByDate = new Map();
        events.forEach(workout => {
            const workoutDate = workout.start_date_local.split('T')[0];
            if (!workoutsByDate.has(workoutDate)) {
                workoutsByDate.set(workoutDate, []);
            }
            workoutsByDate.get(workoutDate).push(workout);
        });
        
        // Add completion data to planned workouts
        let completionCallsCount = 0;
        const maxCompletionCalls = 15;
        
        for (const [dateStr, dayWorkouts] of workoutsByDate) {
            const workoutDate = new Date(dateStr);
            if (workoutDate < today && completionCallsCount < maxCompletionCalls) {
                for (const workout of dayWorkouts) {
                    if (workout.paired_activity_id && completionCallsCount < maxCompletionCalls) {
                        try {
                            const activityId = workout.paired_activity_id.replace('i', '');
                            console.log(`🔗 Found paired activity ${activityId} for planned workout ${workout.name}`);
                            
                            const completionData = await this.loadActivityDetails(apiKey, athleteId, activityId);
                            if (completionData) {
                                workout.completionData = completionData;
                                workout.isCompleted = true;
                                workout.wasPlanned = true;
                                console.log(`✅ Loaded completion data for planned workout ${workout.name}: ${completionData.actualDuration}min, RPE: ${completionData.perceivedEffort || 'N/A'}`);
                            }
                            completionCallsCount++;
                        } catch (error) {
                            console.warn(`Could not load completion data for workout ${workout.id}:`, error);
                        }
                    }
                }
            }
        }
        
        // Process activities and add unplanned workouts
        const plannedActivityIds = new Set();
        events.forEach(event => {
            if (event.paired_activity_id) {
                plannedActivityIds.add(event.paired_activity_id.replace('i', ''));
            }
        });
        
        activities.forEach(activity => {
            const activityDate = activity.start_date_local.split('T')[0];
            const activityDateObj = new Date(activityDate);
            
            // Only add activities that are in the past and weren't already planned
            if (activityDateObj < today && !plannedActivityIds.has(activity.id.toString())) {
                console.log(`🆕 Found unplanned activity: ${activity.name || activity.type}`);
                
                // Convert activity to workout format
                const unplannedWorkout = {
                    id: `activity_${activity.id}`,
                    name: activity.name || `${activity.type} (Unplanned)`,
                    type: activity.type,
                    start_date_local: activity.start_date_local,
                    moving_time: activity.moving_time,
                    duration: activity.moving_time,
                    category: 'WORKOUT',
                    completionData: this.processActivityData(activity),
                    isCompleted: true,
                    wasPlanned: false,
                    isUnplanned: true
                };
                
                if (!workoutsByDate.has(activityDate)) {
                    workoutsByDate.set(activityDate, []);
                }
                workoutsByDate.get(activityDate).push(unplannedWorkout);
            }
        });
        
        // Flatten back to array
        const allWorkouts = [];
        for (const dayWorkouts of workoutsByDate.values()) {
            allWorkouts.push(...dayWorkouts);
        }
        
        const completedCount = allWorkouts.filter(e => e.isCompleted).length;
        const unplannedCount = allWorkouts.filter(e => e.isUnplanned).length;
        console.log(`📊 Loaded ${allWorkouts.length} total workouts: ${completedCount} completed, ${unplannedCount} unplanned`);
        
        return allWorkouts;
    },
    
    // Default athlete ID and API key
    getDefaults() {
        return {
            athleteId: 'i290140',
            apiKey: document.getElementById('apiKey')?.value || '5b7vz3ozlxd42dqx0udbrq7e2'
        };
    }
};

// Completion Data Storage (in-memory)
const completionDataStore = {
    data: new Map(),
    
    store(workoutId, date, analysis) {
        const key = `${date}_${workoutId}`;
        this.data.set(key, {
            ...analysis,
            timestamp: new Date(),
            applied: false
        });
    },
    
    get(workoutId, date) {
        const key = `${date}_${workoutId}`;
        return this.data.get(key);
    },
    
    getByDate(date) {
        const results = [];
        for (const [key, value] of this.data) {
            if (key.startsWith(date + '_')) {
                results.push(value);
            }
        }
        return results;
    },
    
    markApplied(workoutId, date) {
        const key = `${date}_${workoutId}`;
        const data = this.data.get(key);
        if (data) {
            data.applied = true;
            this.data.set(key, data);
        }
    }
};
