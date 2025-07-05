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
    
    // Load workouts for multiple dates (for calendar view)
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
        const workouts = await this.loadWorkoutsForDateRange(apiKey, athleteId, startDate, endDate);
        const today = new Date();
        
        // Group workouts by date for efficient processing
        const workoutsByDate = new Map();
        workouts.forEach(workout => {
            const workoutDate = workout.start_date_local.split('T')[0];
            if (!workoutsByDate.has(workoutDate)) {
                workoutsByDate.set(workoutDate, []);
            }
            workoutsByDate.get(workoutDate).push(workout);
        });
        
        // Load completion data for past workouts (limit to avoid too many API calls)
        let completionCallsCount = 0;
        const maxCompletionCalls = 15; // Limit to avoid rate limiting
        
        for (const [dateStr, dayWorkouts] of workoutsByDate) {
            const workoutDate = new Date(dateStr);
            if (workoutDate < today && completionCallsCount < maxCompletionCalls) {
                for (const workout of dayWorkouts) {
                    if (workout.id && completionCallsCount < maxCompletionCalls) {
                        try {
                            const completionData = await this.loadActivityDetails(apiKey, athleteId, workout.id);
                            if (completionData) {
                                workout.completionData = completionData;
                                workout.isCompleted = true;
                                console.log(`✅ Loaded completion data for ${workout.name}: ${completionData.actualDuration}min, RPE: ${completionData.perceivedEffort || 'N/A'}`);
                            }
                            completionCallsCount++;
                        } catch (error) {
                            console.warn(`Could not load completion data for workout ${workout.id}:`, error);
                        }
                    }
                }
            }
        }
        
        console.log(`📊 Loaded completion data for ${completionCallsCount} workouts`);
        return workouts;
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
