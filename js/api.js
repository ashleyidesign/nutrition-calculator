// Enhanced Intervals.icu API Module with Proper Planned vs Completed Logic
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
        
        // Process events to distinguish planned vs completed
        const processedEvents = this.processEvents(data.events || [], date);
        
        return processedEvents;
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
        
        // Process all events in the range
        const processedEvents = [];
        (data.events || []).forEach(event => {
            const eventDate = event.start_date_local.split('T')[0];
            const processed = this.processEvents([event], eventDate);
            processedEvents.push(...processed);
        });
        
        return processedEvents;
    },

    // Process events to determine if they are planned or completed
    processEvents(events, date) {
        const today = new Date();
        const eventDate = new Date(date + 'T12:00:00'); // Use noon to avoid timezone issues
        const isPastDate = eventDate < today;
        
        return events.map(event => {
            // Determine if this is a completed activity or planned workout
            const isCompleted = this.isEventCompleted(event, isPastDate);
            
            const processedEvent = {
                ...event,
                isCompleted: isCompleted,
                isPastDate: isPastDate
            };
            
            // Add completion data if it's a completed activity
            if (isCompleted && event.id) {
                // The completion data would be loaded separately via loadActivityDetails
                // For now, we mark it as needing completion data
                processedEvent.needsCompletionData = true;
            }
            
            return processedEvent;
        });
    },

    // Determine if an event represents a completed activity
    isEventCompleted(event, isPastDate) {
        // Key indicators that this is a completed activity:
        // 1. Has actual metrics (moving_time, distance, etc.)
        // 2. Is in the past
        // 3. Has activity-specific fields
        
        const hasActualMetrics = !!(
            event.moving_time ||
            event.distance ||
            event.average_heartrate ||
            event.average_watts ||
            event.kilojoules ||
            event.calories
        );
        
        const hasActivityId = !!event.id;
        
        // If it's a future date, it's definitely planned
        if (!isPastDate) {
            return false;
        }
        
        // If it's a past date and has actual metrics, it's likely completed
        if (isPastDate && hasActualMetrics && hasActivityId) {
            return true;
        }
        
        // If it's a past date but only has planned workout structure, it's incomplete/planned
        const isPlannedWorkout = !!(
            event.name && 
            (event.duration || event.moving_time) && 
            !hasActualMetrics
        );
        
        if (isPlannedWorkout) {
            return false;
        }
        
        // Default: if it's past date with an ID, assume completed
        return isPastDate && hasActivityId;
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
                throw new Error(`Activity API Error: ${response.status}`);
            }
            
            const activityData = await response.json();
            
            // Check if we got valid activity data
            if (!activityData.activity) {
                return null;
            }
            
            return this.processActivityData(activityData.activity);
            
        } catch (error) {
            console.warn('Could not load activity details:', error);
            return null;
        }
    },

    // Process raw activity data into usable completion data
    processActivityData(rawData) {
        if (!rawData) return null;
        
        return {
            id: rawData.id,
            actualDuration: Math.round((rawData.moving_time || rawData.elapsed_time || 0) / 60),
            avgHeartRate: rawData.average_heartrate || null,
            maxHeartRate: rawData.max_heartrate || null,
            avgPower: rawData.average_watts || null,
            maxPower: rawData.max_watts || null,
            avgCadence: rawData.average_cadence || null,
            elevationGain: rawData.total_elevation_gain || null,
            distance: rawData.distance || null,
            avgSpeed: rawData.average_speed || null,
            calories: rawData.kilojoules ? Math.round(rawData.kilojoules / 4.184) : 
                     rawData.calories ? Math.round(rawData.calories) : null,
            trainingStressScore: rawData.training_stress_score || 
                               (rawData.weighted_average_watts ? this.calculateTSS(rawData) : null),
            perceivedEffort: rawData.perceived_exertion || null,
            description: rawData.description || null,
            workoutCode: rawData.workout_code || null
        };
    },

    // Calculate Training Stress Score approximation
    calculateTSS(activityData) {
        if (!activityData.weighted_average_watts || !activityData.moving_time) return null;
        
        const durationHours = activityData.moving_time / 3600;
        const estimatedFTP = 250; // This should come from athlete profile
        const normalizedPower = activityData.weighted_average_watts || activityData.average_watts;
        const intensityFactor = normalizedPower / estimatedFTP;
        
        return Math.round((durationHours * normalizedPower * intensityFactor) / (estimatedFTP * 3600) * 100);
    },

    // Enhanced workout processing with proper completion data
    async loadWorkoutsWithCompletionData(apiKey, athleteId, date) {
        const workouts = await this.loadWorkouts(apiKey, athleteId, date);
        
        // For completed workouts, try to load detailed completion data
        for (const workout of workouts) {
            if (workout.isCompleted && workout.needsCompletionData && workout.id) {
                const completionData = await this.loadActivityDetails(apiKey, athleteId, workout.id);
                if (completionData) {
                    workout.completionData = completionData;
                }
            }
        }
        
        return workouts;
    },

    // Enhanced range loading with proper completion logic
    async loadWorkoutsForDateRangeWithCompletion(apiKey, athleteId, startDate, endDate) {
        const workouts = await this.loadWorkoutsForDateRange(apiKey, athleteId, startDate, endDate);
        
        // Group workouts by date for efficient processing
        const workoutsByDate = new Map();
        workouts.forEach(workout => {
            const workoutDate = workout.start_date_local.split('T')[0];
            if (!workoutsByDate.has(workoutDate)) {
                workoutsByDate.set(workoutDate, []);
            }
            workoutsByDate.get(workoutDate).push(workout);
        });
        
        // Load completion data for completed workouts only
        for (const [dateStr, dayWorkouts] of workoutsByDate) {
            for (const workout of dayWorkouts) {
                if (workout.isCompleted && workout.needsCompletionData && workout.id) {
                    try {
                        const completionData = await this.loadActivityDetails(apiKey, athleteId, workout.id);
                        if (completionData) {
                            workout.completionData = completionData;
                        }
                    } catch (error) {
                        console.warn(`Could not load completion data for workout ${workout.id}:`, error);
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
        return workout.isCompleted === true;
    },

    // Get completion percentage for a workout
    getCompletionPercentage(planned, actual) {
        if (!actual || !planned) return 0;
        
        const plannedDuration = planned.duration || ((planned.moving_time || planned.elapsed_time || 3600) / 60);
        const actualDuration = actual.actualDuration || 0;
        
        if (plannedDuration === 0) return 100;
        
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