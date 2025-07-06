// Enhanced Intervals.icu API Module with Improved Workout Detection
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
        
        // DEBUG: Check specifically for today's date
        const today = new Date().toISOString().split('T')[0];
        const todaysEvents = (data.events || []).filter(event => 
            event.start_date_local.startsWith(today)
        );
        console.log(`🎯 DEBUGGING: Found ${todaysEvents.length} events for today (${today}):`, todaysEvents);
        
        // Process all events in the range
        const processedEvents = [];
        (data.events || []).forEach(event => {
            const eventDate = event.start_date_local.split('T')[0];
            const processed = this.processEvents([event], eventDate);
            processedEvents.push(...processed);
        });
        
        return processedEvents;
    },

    // IMPROVED: Enhanced event processing with better completion detection
    processEvents(events, date) {
        const today = new Date();
        const eventDate = new Date(date + 'T12:00:00'); // Use noon to avoid timezone issues
        const isPastDate = eventDate < today;
        
        console.log(`Processing ${events.length} events for ${date}, isPastDate: ${isPastDate}`);
        
        return events.map(event => {
            console.log('Processing event:', {
                id: event.id,
                name: event.name,
                type: event.type,
                hasMovingTime: !!event.moving_time,
                hasDistance: !!event.distance,
                hasAvgHR: !!event.average_heartrate,
                hasAvgPower: !!event.average_watts,
                hasCalories: !!event.calories,
                hasKilojoules: !!event.kilojoules
            });
            
            // Determine if this is a completed activity or planned workout
            const isCompleted = this.isEventCompleted(event, isPastDate);
            
            const processedEvent = {
                ...event,
                isCompleted: isCompleted,
                isPastDate: isPastDate,
                detectionReason: this.getDetectionReason(event, isPastDate, isCompleted)
            };
            
            // For completed activities, add completion data directly if we have the metrics
            if (isCompleted && hasActualMetrics) {
                processedEvent.completionData = {
                    id: event.id,
                    actualDuration: Math.round((event.moving_time || event.elapsed_time || 0) / 60),
                    avgHeartRate: event.average_heartrate || null,
                    maxHeartRate: event.max_heartrate || null,
                    avgPower: event.average_watts || null,
                    maxPower: event.max_watts || null,
                    avgCadence: event.average_cadence || null,
                    elevationGain: event.total_elevation_gain || null,
                    distance: event.distance || null,
                    avgSpeed: event.average_speed || null,
                    calories: event.kilojoules ? Math.round(event.kilojoules / 4.184) : 
                             event.calories ? Math.round(event.calories) : null,
                    perceivedEffort: event.perceived_exertion || null,
                    description: event.description || null
                };
            } else if (isCompleted && event.id) {
                // If no direct metrics but has ID, mark for detailed loading
                processedEvent.needsCompletionData = true;
            }
            
            console.log(`Event "${event.name}" marked as ${isCompleted ? 'COMPLETED' : 'PLANNED'} - ${processedEvent.detectionReason}`);
            
            return processedEvent;
        });
    },

    // IMPROVED: Better completion detection with more signals
    isEventCompleted(event, isPastDate) {
        // Key indicators that this is a completed activity:
        
        // 1. Has actual performance metrics (strong indicator)
        const hasActualMetrics = !!(
            event.moving_time ||
            event.distance ||
            event.average_heartrate ||
            event.average_watts ||
            event.kilojoules ||
            event.calories ||
            event.max_heartrate ||
            event.total_elevation_gain
        );
        
        // 2. Has activity ID (necessary but not sufficient)
        const hasActivityId = !!event.id;
        
        // 3. Has specific completed activity fields
        const hasCompletedFields = !!(
            event.start_date_local ||  // Activities have precise start times
            event.elapsed_time ||      // Elapsed time vs moving time
            event.device_name ||       // Device used for recording
            event.external_id          // External platform ID
        );
        
        // If it's a future date, it's definitely planned
        if (!isPastDate) {
            return false;
        }
        
        // If it has strong completion signals, mark as completed
        if (hasActivityId && hasActualMetrics) {
            return true;
        }
        
        // Check for workout structure vs activity structure
        const looksLikePlannedWorkout = !!(
            event.name && 
            event.duration && 
            !hasActualMetrics &&
            !event.start_date_local?.includes(':')  // Planned workouts often have just date
        );
        
        if (looksLikePlannedWorkout) {
            return false;
        }
        
        // For past dates with activity ID but no clear metrics, 
        // it could be a minimal activity entry - mark as completed
        if (isPastDate && hasActivityId) {
            return true;
        }
        
        // Default: if past date, assume completed; if future, assume planned
        return isPastDate;
    },

    // NEW: Get human-readable reason for completion detection
    getDetectionReason(event, isPastDate, isCompleted) {
        if (!isPastDate) return 'Future date - planned';
        
        const hasMetrics = !!(event.moving_time || event.distance || event.average_heartrate || event.average_watts);
        const hasId = !!event.id;
        
        if (isCompleted) {
            if (hasMetrics) return 'Has performance metrics - completed';
            if (hasId && isPastDate) return 'Past date with ID - completed';
            return 'Past date - assumed completed';
        } else {
            if (!hasMetrics && event.duration) return 'No metrics, has duration - planned';
            return 'No clear completion signals - planned';
        }
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
        
        console.log('Processing activity data:', rawData);
        
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

    // IMPROVED: Enhanced range loading with better logging and detection
    async loadWorkoutsForDateRangeWithCompletion(apiKey, athleteId, startDate, endDate) {
        const workouts = await this.loadWorkoutsForDateRange(apiKey, athleteId, startDate, endDate);
        
        console.log(`Processing ${workouts.length} workouts for completion data...`);
        
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
                            console.log(`✅ Loaded completion data for ${workout.name} on ${dateStr}`);
                        } else {
                            console.log(`❌ No completion data for ${workout.name} on ${dateStr}`);
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