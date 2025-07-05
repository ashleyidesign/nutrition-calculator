// Workout Processing Module with Completion Tracker
const workoutManager = {
    currentWorkouts: [],
    
    async loadWorkoutData() {
        console.log('🔥 VERSION 4.0 - REFACTORED ARCHITECTURE! 🔥');
        
        const apiKey = document.getElementById('apiKey').value;
        const workoutDate = document.getElementById('workoutDate').value;
        
        if (!apiKey || !workoutDate) {
            ui.showStatus('Please enter API key and select date', 'error');
            return;
        }
        
        ui.showStatus('Loading workout data...', 'loading');
        
        try {
            const { athleteId } = intervalsAPI.getDefaults();
            const activities = await intervalsAPI.loadWorkouts(apiKey, athleteId, workoutDate);
            
            console.log('Found activities:', activities.length);
            
            if (activities.length === 0) {
                ui.showStatus('No workouts found for this date - showing rest day nutrition', 'warning');
                
                // Set as rest day and calculate nutrition
                ui.setFormValues('none', 0);
                ui.hideManualSection();
                
                // Calculate rest day nutrition
                nutritionCalculator.calculate();
                return;
            }
            
            console.log('🎯 PROCESSING WORKOUTS 🎯');
            
            // Take up to 3 workouts and check for races
            const workouts = activities.slice(0, 3);
            let hasRace = false;
            
            // Check if any workout is a race using the category field
            workouts.forEach(workout => {
                if (workout.category === 'RACE_A' || workout.category === 'RACE_B' || workout.category === 'RACE_C') {
                    hasRace = true;
                }
            });
            
            if (hasRace) {
                console.log('🏁 RACE DETECTED! 🏁');
                this.showRaceOverride(workouts);
                return;
            }
            
            // Process normally
            this.processWorkoutsNormally(workouts);
            
        } catch (error) {
            ui.showStatus(`Error: ${error.message}`, 'error');
        }
    },
    
    showRaceOverride(workouts) {
        this.currentWorkouts = workouts;
        const raceWorkoutsDiv = document.getElementById('raceWorkouts');
        
        raceWorkoutsDiv.innerHTML = '';
        
        workouts.forEach((workout, index) => {
            const name = (workout.name || '').toLowerCase();
            const isRace = workout.category === 'RACE_A' || workout.category === 'RACE_B' || workout.category === 'RACE_C';
            const currentDuration = Math.round((workout.moving_time || workout.duration || 3600) / 60);
            
            const workoutDiv = document.createElement('div');
            workoutDiv.className = 'race-workout';
            workoutDiv.innerHTML = `
                <h4>${workout.name || workout.type} ${isRace ? '🏁' : ''}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Duration (minutes)</label>
                        <input type="number" id="race-duration-${index}" value="${currentDuration}" min="1" max="720">
                    </div>
                    <div class="form-group">
                        <label>Intensity</label>
                        <select id="race-intensity-${index}">
                            <option value="easy">Easy/Recovery</option>
                            <option value="endurance" ${isRace ? 'selected' : ''}>Endurance (Race Pace)</option>
                            <option value="tempo">Tempo</option>
                            <option value="threshold">Threshold</option>
                            <option value="intervals">Intervals</option>
                        </select>
                    </div>
                </div>
            `;
            raceWorkoutsDiv.appendChild(workoutDiv);
        });
        
        ui.showRaceOverride();
    },
    
    applyRaceOverride() {
        let combinedDuration = 0;
        let highestIntensity = 'easy';
        let workoutDescriptions = [];
        
        const intensityRanking = {
            'easy': 1,
            'endurance': 2,
            'tempo': 3,
            'threshold': 4,
            'intervals': 5
        };
        
        this.currentWorkouts.forEach((workout, index) => {
            const duration = parseInt(document.getElementById(`race-duration-${index}`).value);
            const intensity = document.getElementById(`race-intensity-${index}`).value;
            
            combinedDuration += duration;
            workoutDescriptions.push(`${workout.type} (${duration}min, ${intensity})`);
            
            if (intensityRanking[intensity] > intensityRanking[highestIntensity]) {
                highestIntensity = intensity;
            }
        });
        
        console.log(`🏁 Race Override Applied: ${combinedDuration}min at ${highestIntensity}`);
        
        // Set the form values
        ui.setFormValues(highestIntensity, combinedDuration);
        
        // Hide race override and manual section
        ui.hideRaceOverride();
        ui.hideManualSection();
        
        // Calculate nutrition with race settings
        nutritionCalculator.calculate();
        
        ui.showStatus(`Race Day: ${workoutDescriptions.join(' + ')} - Total: ${combinedDuration}min at ${highestIntensity.toUpperCase()}`, 'success');
    },
    
    cancelRaceOverride() {
        ui.hideRaceOverride();
        
        // Process normally without race override
        this.processWorkoutsNormally(this.currentWorkouts);
    },
    
    processWorkoutsNormally(workouts) {
        if (workouts.length > 1) {
            console.log(`Found ${workouts.length} workouts - combining them!`);
            
            // Multiple workouts - combine them
            let combinedDuration = 0;
            let highestIntensity = 'easy';
            let workoutDescriptions = [];
            
            const intensityRanking = {
                'easy': 1,
                'endurance': 2,
                'tempo': 3,
                'threshold': 4,
                'intervals': 5,
                'strength': 2
            };
            
            workouts.forEach((workout, index) => {
                const workoutType = this.mapWorkoutType(workout);
                const durationSeconds = workout.moving_time || workout.duration || 3600;
                const durationMinutes = Math.round(durationSeconds / 60);
                
                console.log(`Workout ${index + 1}: ${workout.type} - ${durationMinutes}min - ${workoutType}`);
                
                combinedDuration += durationMinutes;
                workoutDescriptions.push(`${workout.type} (${durationMinutes}min)`);
                
                if (intensityRanking[workoutType] > intensityRanking[highestIntensity]) {
                    highestIntensity = workoutType;
                }
            });
            
            console.log(`Combined: ${combinedDuration}min at ${highestIntensity} intensity`);
            
            ui.setFormValues(highestIntensity, combinedDuration);
            
            ui.showStatus(`Loaded ${workouts.length} workouts: ${workoutDescriptions.join(' + ')} - Total: ${combinedDuration}min at ${highestIntensity.toUpperCase()}`, 'success');
            
        } else {
            // Single workout
            const workout = workouts[0];
            const workoutType = this.mapWorkoutType(workout);
            const durationSeconds = workout.moving_time || workout.duration || 3600;
            const durationMinutes = Math.round(durationSeconds / 60);
            
            ui.setFormValues(workoutType, durationMinutes);
            
            ui.showStatus(`Loaded: ${workout.name || workout.type} - ${durationMinutes} minutes - ${workoutType.toUpperCase()}`, 'success');
        }
        
        // Hide manual section and calculate nutrition
        ui.hideManualSection();
        nutritionCalculator.calculate();
    },
    
    mapWorkoutType(workout) {
        const name = (workout.name || '').toLowerCase();
        const type = (workout.type || '').toLowerCase();
        
        if (name.includes('recovery') || name.includes('easy')) return 'easy';
        if (name.includes('tempo') || name.includes('zone 3')) return 'tempo';
        if (name.includes('threshold') || name.includes('zone 4')) return 'threshold';
        if (name.includes('interval') || name.includes('zone 5')) return 'intervals';
        if (name.includes('strength endurance') || name.includes('low cadence')) return 'intervals'; // This is your Z5 workout
        if (name.includes('strength') || type.includes('strength')) return 'strength';
        
        return 'endurance';
    }
};

// Workout Completion Tracker Module
// Analyzes completed workouts and suggests nutrition adjustments
const workoutCompletionTracker = {
    
    // Analyze a completed workout against its planned version
    analyzeWorkoutCompletion(plannedWorkout, completionData) {
        console.log('🎯 Analyzing workout completion:', plannedWorkout.name);
        
        if (!completionData) {
            console.log('No completion data available');
            return null;
        }
        
        const analysis = {
            workoutId: plannedWorkout.id,
            planned: this.extractPlannedMetrics(plannedWorkout),
            actual: completionData,
            comparison: {},
            adjustment: null,
            confidence: 0
        };
        
        // Compare planned vs actual metrics
        this.compareMetrics(analysis);
        
        // Generate nutrition adjustment recommendations
        this.generateNutritionAdjustment(analysis);
        
        return analysis;
    },
    
    // Extract planned metrics from workout
    extractPlannedMetrics(workout) {
        const plannedDuration = Math.round((workout.moving_time || workout.duration || 3600) / 60);
        const workoutType = this.mapWorkoutType(workout);
        
        return {
            duration: plannedDuration,
            type: workoutType,
            name: workout.name || workout.type,
            intensity: this.getIntensityLevel(workoutType),
            category: workout.category || 'WORKOUT'
        };
    },
    
    // Compare planned vs actual workout metrics
    compareMetrics(analysis) {
        const planned = analysis.planned;
        const actual = analysis.actual;
        
        // Duration comparison
        const durationRatio = actual.actualDuration / planned.duration;
        analysis.comparison.durationRatio = durationRatio;
        analysis.comparison.durationDifference = actual.actualDuration - planned.duration;
        
        // Intensity analysis (using heart rate if available)
        if (actual.avgHeartRate) {
            analysis.comparison.avgHeartRate = actual.avgHeartRate;
            analysis.comparison.maxHeartRate = actual.maxHeartRate;
            
            // Estimate intensity factor based on HR zones (simplified)
            const estimatedIntensity = this.estimateIntensityFromHR(actual.avgHeartRate);
            analysis.comparison.estimatedIntensity = estimatedIntensity;
        }
        
        // Power analysis (if available)
        if (actual.avgPower) {
            analysis.comparison.avgPower = actual.avgPower;
            analysis.comparison.maxPower = actual.maxPower;
        }
        
        // Perceived effort
        if (actual.perceivedEffort) {
            analysis.comparison.perceivedEffort = actual.perceivedEffort;
            analysis.comparison.effortVsPlanned = this.compareEffortToPlanned(
                actual.perceivedEffort, 
                planned.intensity
            );
        }
        
        // Calculate confidence score based on available data
        analysis.confidence = this.calculateConfidenceScore(analysis);
    },
    
    // Generate nutrition adjustment recommendations
    generateNutritionAdjustment(analysis) {
        const comparison = analysis.comparison;
        const planned = analysis.planned;
        
        let adjustment = {
            calories: 0,
            carbs: 0,
            protein: 0,
            fat: 0,
            reasoning: [],
            timing: [],
            recovery: []
        };
        
        // Duration-based adjustments
        if (Math.abs(comparison.durationDifference) > 15) { // 15+ minute difference
            const durationAdjustment = this.calculateDurationAdjustment(comparison.durationDifference);
            adjustment.calories += durationAdjustment.calories;
            adjustment.carbs += durationAdjustment.carbs;
            adjustment.reasoning.push(
                `Workout duration ${comparison.durationDifference > 0 ? 'exceeded' : 'fell short of'} plan by ${Math.abs(comparison.durationDifference)} minutes`
            );
        }
        
        // Intensity-based adjustments
        if (comparison.perceivedEffort) {
            const intensityAdjustment = this.calculateIntensityAdjustment(
                comparison.perceivedEffort, 
                planned.intensity,
                analysis.actual.actualDuration
            );
            
            if (intensityAdjustment.magnitude > 0) {
                adjustment.calories += intensityAdjustment.calories;
                adjustment.carbs += intensityAdjustment.carbs;
                adjustment.protein += intensityAdjustment.protein;
                adjustment.reasoning.push(intensityAdjustment.reason);
                adjustment.recovery.push(...intensityAdjustment.recovery);
            }
        }
        
        // Heart rate zone analysis
        if (comparison.avgHeartRate) {
            const hrAdjustment = this.calculateHRBasedAdjustment(comparison.avgHeartRate, planned.duration);
            if (hrAdjustment.magnitude > 0) {
                adjustment.calories += hrAdjustment.calories;
                adjustment.carbs += hrAdjustment.carbs;
                adjustment.reasoning.push(hrAdjustment.reason);
                adjustment.timing.push(...hrAdjustment.timing);
            }
        }
        
        // Only apply adjustment if it's significant and we're confident
        const totalMagnitude = Math.abs(adjustment.calories) + Math.abs(adjustment.carbs) + Math.abs(adjustment.protein);
        
        if (totalMagnitude >= 50 && analysis.confidence >= 0.6) {
            analysis.adjustment = adjustment;
        } else {
            console.log('Adjustment magnitude too small or confidence too low - skipping');
        }
    },
    
    // Calculate duration-based adjustments
    calculateDurationAdjustment(durationDifference) {
        // ~10-15 calories per minute of additional exercise
        const caloriesPerMinute = 12;
        const calories = Math.round(durationDifference * caloriesPerMinute);
        const carbs = Math.round(calories * 0.6 / 4); // 60% from carbs
        
        return { calories, carbs };
    },
    
    // Calculate intensity-based adjustments
    calculateIntensityAdjustment(perceivedEffort, plannedIntensity, duration) {
        const plannedRPE = this.getExpectedRPE(plannedIntensity);
        const rpeDifference = perceivedEffort - plannedRPE;
        
        if (Math.abs(rpeDifference) < 1) {
            return { magnitude: 0 };
        }
        
        // Higher than expected effort = more recovery nutrition needed
        if (rpeDifference >= 2) {
            const extraCalories = Math.round(duration * 8); // 8 cal/min extra
            const extraCarbs = Math.round(extraCalories * 0.5 / 4);
            const extraProtein = Math.round(extraCalories * 0.25 / 4);
            
            return {
                magnitude: extraCalories,
                calories: extraCalories,
                carbs: extraCarbs,
                protein: extraProtein,
                reason: `Workout felt harder than planned (RPE ${perceivedEffort} vs expected ${plannedRPE}) - increasing recovery nutrition`,
                recovery: [
                    'Focus on post-workout recovery meal within 30 minutes',
                    'Consider additional protein for muscle repair',
                    'Monitor fatigue levels for next workout'
                ]
            };
        } else if (rpeDifference <= -2) {
            // Much easier than expected
            const reducedCalories = Math.round(duration * -4); // 4 cal/min reduction
            const reducedCarbs = Math.round(Math.abs(reducedCalories) * 0.4 / 4);
            
            return {
                magnitude: Math.abs(reducedCalories),
                calories: reducedCalories,
                carbs: -reducedCarbs,
                protein: 0,
                reason: `Workout felt easier than planned (RPE ${perceivedEffort} vs expected ${plannedRPE}) - slight reduction in intake`,
                recovery: []
            };
        }
        
        return { magnitude: 0 };
    },
    
    // Calculate heart rate based adjustments
    calculateHRBasedAdjustment(avgHeartRate, duration) {
        // Simplified HR zone analysis
        let adjustment = { magnitude: 0 };
        
        if (avgHeartRate > 170) { // High intensity
            const calories = Math.round(duration * 5);
            const carbs = Math.round(calories * 0.7 / 4);
            
            adjustment = {
                magnitude: calories,
                calories: calories,
                carbs: carbs,
                reason: `High average heart rate (${avgHeartRate} bpm) indicates high energy expenditure`,
                timing: [
                    'Prioritize carb intake within 2 hours post-workout',
                    'Consider additional electrolyte replacement'
                ]
            };
        } else if (avgHeartRate < 130) { // Low intensity
            adjustment = {
                magnitude: 0,
                reason: 'Low heart rate suggests efficient, aerobic workout - no additional adjustments needed'
            };
        }
        
        return adjustment;
    },
    
    // Apply nutrition adjustments to base nutrition plan
    applyAdjustmentToNutrition(baseNutrition, adjustmentData) {
        if (!adjustmentData) return baseNutrition;
        
        const adjustedNutrition = {
            ...baseNutrition,
            calories: baseNutrition.calories + adjustmentData.calories,
            carbs: baseNutrition.carbs + adjustmentData.carbs,
            protein: baseNutrition.protein + adjustmentData.protein,
            fat: baseNutrition.fat + adjustmentData.fat,
            adjustmentApplied: true,
            adjustmentDetails: {
                reason: adjustmentData.reasoning.join('. '),
                timing: adjustmentData.timing,
                recovery: adjustmentData.recovery,
                originalPlan: {
                    calories: baseNutrition.calories,
                    carbs: baseNutrition.carbs,
                    protein: baseNutrition.protein,
                    fat: baseNutrition.fat
                }
            }
        };
        
        console.log('📊 Applied nutrition adjustment:', {
            original: baseNutrition.calories,
            adjusted: adjustedNutrition.calories,
            difference: adjustmentData.calories
        });
        
        return adjustedNutrition;
    },
    
    // Helper functions
    mapWorkoutType(workout) {
        const name = (workout.name || '').toLowerCase();
        const type = (workout.type || '').toLowerCase();
        
        if (name.includes('recovery') || name.includes('easy')) return 'easy';
        if (name.includes('tempo') || name.includes('zone 3')) return 'tempo';
        if (name.includes('threshold') || name.includes('zone 4')) return 'threshold';
        if (name.includes('interval') || name.includes('zone 5')) return 'intervals';
        if (name.includes('strength endurance') || name.includes('low cadence')) return 'intervals';
        if (name.includes('strength') || type.includes('strength')) return 'strength';
        
        return 'endurance';
    },
    
    getIntensityLevel(workoutType) {
        const intensityMap = {
            'easy': 1,
            'endurance': 2,
            'strength': 2,
            'tempo': 3,
            'threshold': 4,
            'intervals': 5
        };
        return intensityMap[workoutType] || 2;
    },
    
    getExpectedRPE(workoutType) {
        const rpeMap = {
            'easy': 3,
            'endurance': 5,
            'strength': 6,
            'tempo': 7,
            'threshold': 8,
            'intervals': 9
        };
        return rpeMap[workoutType] || 5;
    },
    
    estimateIntensityFromHR(avgHeartRate) {
        if (avgHeartRate < 130) return 'easy';
        if (avgHeartRate < 150) return 'endurance';
        if (avgHeartRate < 165) return 'tempo';
        if (avgHeartRate < 175) return 'threshold';
        return 'intervals';
    },
    
    compareEffortToPlanned(actualRPE, plannedIntensity) {
        const expectedRPE = this.getExpectedRPE(plannedIntensity);
        return {
            expected: expectedRPE,
            actual: actualRPE,
            difference: actualRPE - expectedRPE
        };
    },
    
    calculateConfidenceScore(analysis) {
        let score = 0.3; // Base confidence
        
        // More data = higher confidence
        if (analysis.actual.perceivedEffort) score += 0.3;
        if (analysis.actual.avgHeartRate) score += 0.2;
        if (analysis.actual.avgPower) score += 0.2;
        if (Math.abs(analysis.comparison.durationDifference) > 10) score += 0.2;
        
        return Math.min(score, 1.0);
    }
};

// Workout Completion Tracker Module
// Analyzes completed workouts and suggests nutrition adjustments
const workoutCompletionTracker = {
    
    // Analyze a completed workout against its planned version
    analyzeWorkoutCompletion(plannedWorkout, completionData) {
        console.log('🎯 Analyzing workout completion:', plannedWorkout.name);
        
        if (!completionData) {
            console.log('No completion data available');
            return null;
        }
        
        const analysis = {
            workoutId: plannedWorkout.id,
            planned: this.extractPlannedMetrics(plannedWorkout),
            actual: completionData,
            comparison: {},
            adjustment: null,
            confidence: 0
        };
        
        // Compare planned vs actual metrics
        this.compareMetrics(analysis);
        
        // Generate nutrition adjustment recommendations
        this.generateNutritionAdjustment(analysis);
        
        return analysis;
    },
    
    // Extract planned metrics from workout
    extractPlannedMetrics(workout) {
        const plannedDuration = Math.round((workout.moving_time || workout.duration || 3600) / 60);
        const workoutType = this.mapWorkoutType(workout);
        
        return {
            duration: plannedDuration,
            type: workoutType,
            name: workout.name || workout.type,
            intensity: this.getIntensityLevel(workoutType),
            category: workout.category || 'WORKOUT'
        };
    },
    
    // Compare planned vs actual workout metrics
    compareMetrics(analysis) {
        const planned = analysis.planned;
        const actual = analysis.actual;
        
        // Duration comparison
        const durationRatio = actual.actualDuration / planned.duration;
        analysis.comparison.durationRatio = durationRatio;
        analysis.comparison.durationDifference = actual.actualDuration - planned.duration;
        
        // Intensity analysis (using heart rate if available)
        if (actual.avgHeartRate) {
            analysis.comparison.avgHeartRate = actual.avgHeartRate;
            analysis.comparison.maxHeartRate = actual.maxHeartRate;
            
            // Estimate intensity factor based on HR zones (simplified)
            const estimatedIntensity = this.estimateIntensityFromHR(actual.avgHeartRate);
            analysis.comparison.estimatedIntensity = estimatedIntensity;
        }
        
        // Power analysis (if available)
        if (actual.avgPower) {
            analysis.comparison.avgPower = actual.avgPower;
            analysis.comparison.maxPower = actual.maxPower;
        }
        
        // Perceived effort
        if (actual.perceivedEffort) {
            analysis.comparison.perceivedEffort = actual.perceivedEffort;
            analysis.comparison.effortVsPlanned = this.compareEffortToPlanned(
                actual.perceivedEffort, 
                planned.intensity
            );
        }
        
        // Calculate confidence score based on available data
        analysis.confidence = this.calculateConfidenceScore(analysis);
    },
    
    // Generate nutrition adjustment recommendations
    generateNutritionAdjustment(analysis) {
        const comparison = analysis.comparison;
        const planned = analysis.planned;
        
        let adjustment = {
            calories: 0,
            carbs: 0,
            protein: 0,
            fat: 0,
            reasoning: [],
            timing: [],
            recovery: []
        };
        
        // Duration-based adjustments
        if (Math.abs(comparison.durationDifference) > 15) { // 15+ minute difference
            const durationAdjustment = this.calculateDurationAdjustment(comparison.durationDifference);
            adjustment.calories += durationAdjustment.calories;
            adjustment.carbs += durationAdjustment.carbs;
            adjustment.reasoning.push(
                `Workout duration ${comparison.durationDifference > 0 ? 'exceeded' : 'fell short of'} plan by ${Math.abs(comparison.durationDifference)} minutes`
            );
        }
        
        // Intensity-based adjustments
        if (comparison.perceivedEffort) {
            const intensityAdjustment = this.calculateIntensityAdjustment(
                comparison.perceivedEffort, 
                planned.intensity,
                analysis.actual.actualDuration
            );
            
            if (intensityAdjustment.magnitude > 0) {
                adjustment.calories += intensityAdjustment.calories;
                adjustment.carbs += intensityAdjustment.carbs;
                adjustment.protein += intensityAdjustment.protein;
                adjustment.reasoning.push(intensityAdjustment.reason);
                adjustment.recovery.push(...intensityAdjustment.recovery);
            }
        }
        
        // Heart rate zone analysis
        if (comparison.avgHeartRate) {
            const hrAdjustment = this.calculateHRBasedAdjustment(comparison.avgHeartRate, planned.duration);
            if (hrAdjustment.magnitude > 0) {
                adjustment.calories += hrAdjustment.calories;
                adjustment.carbs += hrAdjustment.carbs;
                adjustment.reasoning.push(hrAdjustment.reason);
                adjustment.timing.push(...hrAdjustment.timing);
            }
        }
        
        // Only apply adjustment if it's significant and we're confident
        const totalMagnitude = Math.abs(adjustment.calories) + Math.abs(adjustment.carbs) + Math.abs(adjustment.protein);
        
        if (totalMagnitude >= 50 && analysis.confidence >= 0.6) {
            analysis.adjustment = adjustment;
        } else {
            console.log('Adjustment magnitude too small or confidence too low - skipping');
        }
    },
    
    // Calculate duration-based adjustments
    calculateDurationAdjustment(durationDifference) {
        // ~10-15 calories per minute of additional exercise
        const caloriesPerMinute = 12;
        const calories = Math.round(durationDifference * caloriesPerMinute);
        const carbs = Math.round(calories * 0.6 / 4); // 60% from carbs
        
        return { calories, carbs };
    },
    
    // Calculate intensity-based adjustments
    calculateIntensityAdjustment(perceivedEffort, plannedIntensity, duration) {
        const plannedRPE = this.getExpectedRPE(plannedIntensity);
        const rpeDifference = perceivedEffort - plannedRPE;
        
        if (Math.abs(rpeDifference) < 1) {
            return { magnitude: 0 };
        }
        
        // Higher than expected effort = more recovery nutrition needed
        if (rpeDifference >= 2) {
            const extraCalories = Math.round(duration * 8); // 8 cal/min extra
            const extraCarbs = Math.round(extraCalories * 0.5 / 4);
            const extraProtein = Math.round(extraCalories * 0.25 / 4);
            
            return {
                magnitude: extraCalories,
                calories: extraCalories,
                carbs: extraCarbs,
                protein: extraProtein,
                reason: `Workout felt harder than planned (RPE ${perceivedEffort} vs expected ${plannedRPE}) - increasing recovery nutrition`,
                recovery: [
                    'Focus on post-workout recovery meal within 30 minutes',
                    'Consider additional protein for muscle repair',
                    'Monitor fatigue levels for next workout'
                ]
            };
        } else if (rpeDifference <= -2) {
            // Much easier than expected
            const reducedCalories = Math.round(duration * -4); // 4 cal/min reduction
            const reducedCarbs = Math.round(Math.abs(reducedCalories) * 0.4 / 4);
            
            return {
                magnitude: Math.abs(reducedCalories),
                calories: reducedCalories,
                carbs: -reducedCarbs,
                protein: 0,
                reason: `Workout felt easier than planned (RPE ${perceivedEffort} vs expected ${plannedRPE}) - slight reduction in intake`,
                recovery: []
            };
        }
        
        return { magnitude: 0 };
    },
    
    // Calculate heart rate based adjustments
    calculateHRBasedAdjustment(avgHeartRate, duration) {
        // Simplified HR zone analysis
        let adjustment = { magnitude: 0 };
        
        if (avgHeartRate > 170) { // High intensity
            const calories = Math.round(duration * 5);
            const carbs = Math.round(calories * 0.7 / 4);
            
            adjustment = {
                magnitude: calories,
                calories: calories,
                carbs: carbs,
                reason: `High average heart rate (${avgHeartRate} bpm) indicates high energy expenditure`,
                timing: [
                    'Prioritize carb intake within 2 hours post-workout',
                    'Consider additional electrolyte replacement'
                ]
            };
        } else if (avgHeartRate < 130) { // Low intensity
            adjustment = {
                magnitude: 0,
                reason: 'Low heart rate suggests efficient, aerobic workout - no additional adjustments needed'
            };
        }
        
        return adjustment;
    },
    
    // Apply nutrition adjustments to base nutrition plan
    applyAdjustmentToNutrition(baseNutrition, adjustmentData) {
        if (!adjustmentData) return baseNutrition;
        
        const adjustedNutrition = {
            ...baseNutrition,
            calories: baseNutrition.calories + adjustmentData.calories,
            carbs: baseNutrition.carbs + adjustmentData.carbs,
            protein: baseNutrition.protein + adjustmentData.protein,
            fat: baseNutrition.fat + adjustmentData.fat,
            adjustmentApplied: true,
            adjustmentDetails: {
                reason: adjustmentData.reasoning.join('. '),
                timing: adjustmentData.timing,
                recovery: adjustmentData.recovery,
                originalPlan: {
                    calories: baseNutrition.calories,
                    carbs: baseNutrition.carbs,
                    protein: baseNutrition.protein,
                    fat: baseNutrition.fat
                }
            }
        };
        
        console.log('📊 Applied nutrition adjustment:', {
            original: baseNutrition.calories,
            adjusted: adjustedNutrition.calories,
            difference: adjustmentData.calories
        });
        
        return adjustedNutrition;
    },
    
    // Helper functions
    mapWorkoutType(workout) {
        const name = (workout.name || '').toLowerCase();
        const type = (workout.type || '').toLowerCase();
        
        if (name.includes('recovery') || name.includes('easy')) return 'easy';
        if (name.includes('tempo') || name.includes('zone 3')) return 'tempo';
        if (name.includes('threshold') || name.includes('zone 4')) return 'threshold';
        if (name.includes('interval') || name.includes('zone 5')) return 'intervals';
        if (name.includes('strength endurance') || name.includes('low cadence')) return 'intervals';
        if (name.includes('strength') || type.includes('strength')) return 'strength';
        
        return 'endurance';
    },
    
    getIntensityLevel(workoutType) {
        const intensityMap = {
            'easy': 1,
            'endurance': 2,
            'strength': 2,
            'tempo': 3,
            'threshold': 4,
            'intervals': 5
        };
        return intensityMap[workoutType] || 2;
    },
    
    getExpectedRPE(workoutType) {
        const rpeMap = {
            'easy': 3,
            'endurance': 5,
            'strength': 6,
            'tempo': 7,
            'threshold': 8,
            'intervals': 9
        };
        return rpeMap[workoutType] || 5;
    },
    
    estimateIntensityFromHR(avgHeartRate) {
        if (avgHeartRate < 130) return 'easy';
        if (avgHeartRate < 150) return 'endurance';
        if (avgHeartRate < 165) return 'tempo';
        if (avgHeartRate < 175) return 'threshold';
        return 'intervals';
    },
    
    compareEffortToPlanned(actualRPE, plannedIntensity) {
        const expectedRPE = this.getExpectedRPE(plannedIntensity);
        return {
            expected: expectedRPE,
            actual: actualRPE,
            difference: actualRPE - expectedRPE
        };
    },
    
    calculateConfidenceScore(analysis) {
        let score = 0.3; // Base confidence
        
        // More data = higher confidence
        if (analysis.actual.perceivedEffort) score += 0.3;
        if (analysis.actual.avgHeartRate) score += 0.2;
        if (analysis.actual.avgPower) score += 0.2;
        if (Math.abs(analysis.comparison.durationDifference) > 10) score += 0.2;
        
        return Math.min(score, 1.0);
    }
};