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
            // Note: This would need to be implemented in your API endpoint
            // Intervals.icu endpoint: /api/v1/athlete/{id}/activities/{activityId}
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
                throw new Error(`Activity API Error: ${response.status}`);
            }
            
            const activityData = await response.json();
            return this.processActivityData(activityData);
            
        } catch (error) {
            console.warn('Could not load activity details:', error);
            return null;
        }
    },

    // Process raw activity data into usable completion data
    processActivityData(rawData) {
        return {
            id: rawData.id,
            actualDuration: Math.round((rawData.moving_time || rawData.elapsed_time) / 60),
            avgHeartRate: rawData.average_heartrate,
            maxHeartRate: rawData.max_heartrate,
            avgPower: rawData.average_watts,
            maxPower: rawData.max_watts,
            avgCadence: rawData.average_cadence,
            elevationGain: rawData.total_elevation_gain,
            distance: rawData.distance,
            avgSpeed: rawData.average_speed,
            calories: rawData.kilojoules ? Math.round(rawData.kilojoules / 4.184) : null,
            trainingStressScore: rawData.weighted_average_watts ? this.calculateTSS(rawData) : null,
            perceivedEffort: rawData.perceived_exertion || null,
            description: rawData.description,
            workoutCode: rawData.workout_code
        };
    },

    // Calculate Training Stress Score approximation
    calculateTSS(activityData) {
        if (!activityData.weighted_average_watts || !activityData.moving_time) return null;
        
        // Basic TSS calculation: (duration_hours * NP^2 * IF) / (FTP * 3600) * 100
        // This is simplified - you'd need FTP data for accurate calculation
        const durationHours = activityData.moving_time / 3600;
        const estimatedFTP = 250; // This should come from athlete profile
        const normalizedPower = activityData.weighted_average_watts || activityData.average_watts;
        const intensityFactor = normalizedPower / estimatedFTP;
        
        return Math.round((durationHours * normalizedPower * intensityFactor) / (estimatedFTP * 3600) * 100);
    },

    // Enhanced workout processing with completion data
    async loadWorkoutsWithCompletionData(apiKey, athleteId, date) {
        const workouts = await this.loadWorkouts(apiKey, athleteId, date);
        
        // For each workout, try to load completion data if it's a past workout
        const selectedDate = new Date(date);
        const today = new Date();
        
        if (selectedDate < today) {
            for (const workout of workouts) {
                if (workout.id) {
                    const completionData = await this.loadActivityDetails(apiKey, athleteId, workout.id);
                    if (completionData) {
                        workout.completionData = completionData;
                        workout.isCompleted = true;
                    }
                }
            }
        }
        
        return workouts;
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
        
        // Load completion data for past workouts
        for (const [dateStr, dayWorkouts] of workoutsByDate) {
            const workoutDate = new Date(dateStr);
            if (workoutDate < today) {
                for (const workout of dayWorkouts) {
                    if (workout.id) {
                        try {
                            const completionData = await this.loadActivityDetails(apiKey, athleteId, workout.id);
                            if (completionData) {
                                workout.completionData = completionData;
                                workout.isCompleted = true;
                            }
                        } catch (error) {
                            console.warn(`Could not load completion data for workout ${workout.id}:`, error);
                        }
                    }
                }
            }
        }
        
        return workouts;
    },
    
    // Default athlete ID and API key
    getDefaults() {
        return {
            athleteId: 'i290140',
            apiKey: document.getElementById('apiKey')?.value || '5b7vz3ozlxd42dqx0udbrq7e2'
        };
    },

    // Helper to determine if a workout is completed
    isWorkoutCompleted(workout) {
        return workout.isCompleted || workout.completionData;
    },

    // Get completion percentage for a workout
    getCompletionPercentage(planned, actual) {
        if (!actual) return 0;
        
        const plannedDuration = planned.duration || ((planned.moving_time || planned.elapsed_time) / 60);
        const actualDuration = actual.actualDuration;
        
        return Math.round((actualDuration / plannedDuration) * 100);
    }
};

// Completion Data Storage (in-memory)
const completionDataStore = {
    data: new Map(),
    
    // Store completion analysis for a workout
    store(workoutId, date, analysis) {
        const key = `${date}_${workoutId}`;
        this.data.set(key, {
            ...analysis,
            timestamp: new Date(),
            applied: false
        });
    },
    
    // Get completion analysis
    get(workoutId, date) {
        const key = `${date}_${workoutId}`;
        return this.data.get(key);
    },
    
    // Get all completion data for a date
    getByDate(date) {
        const results = [];
        for (const [key, value] of this.data) {
            if (key.startsWith(date + '_')) {
                results.push(value);
            }
        }
        return results;
    },
    
    // Mark adjustment as applied
    markApplied(workoutId, date) {
        const key = `${date}_${workoutId}`;
        const data = this.data.get(key);
        if (data) {
            data.applied = true;
            this.data.set(key, data);
        }
    }
};
