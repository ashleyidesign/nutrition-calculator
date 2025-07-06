// Research-Based Nutrition Calculator - Implementing Scientific Evidence
const nutritionCalculator = {
    
    // Core calculation with forward-looking periodization
    calculate(bodyWeightLbs = null, goals = null, workoutType = null, duration = null, isRaceDay = false, isPostRace = false, isCarboLoading = false, completionAdjustments = null, tomorrowWorkouts = null, powerData = null) {
        const bw = bodyWeightLbs !== null ? bodyWeightLbs : parseInt(document.getElementById('bodyWeight').value);
        const currentGoals = goals !== null ? goals : document.getElementById('goals').value;
        const wt = workoutType !== null ? workoutType : document.getElementById('workoutType').value;
        const dur = duration !== null ? duration : parseInt(document.getElementById('duration').value);
        
        const bodyWeightKg = bw * 0.453592;

        // Calculate using research-based methodology
        const baseMacros = this.calculateResearchBasedMacros(
            bodyWeightKg, wt, dur, isRaceDay, isPostRace, isCarboLoading, currentGoals, tomorrowWorkouts, powerData
        );
        
        const dailyCalories = (baseMacros.protein * 4) + (baseMacros.carbs * 4) + (baseMacros.fat * 9);
        const fueling = this.calculateWorkoutFueling(wt, dur, isRaceDay, isCarboLoading, powerData);

        let finalNutrition = {
            calories: Math.round(dailyCalories),
            ...baseMacros,
            fueling: fueling,
            adjustmentApplied: false,
            periodizationNote: this.getPeriodizationNote(isRaceDay, isPostRace, isCarboLoading, tomorrowWorkouts)
        };

        // Apply completion-based adjustments if available
        if (completionAdjustments) {
            finalNutrition = workoutCompletionTracker.applyAdjustmentToNutrition(finalNutrition, completionAdjustments);
        }

        return finalNutrition;
    },

    // Enhanced calculation for calendar with forward-looking logic
    calculateWithCompletionData(bodyWeightLbs, goals, workoutType, duration, date, workouts = null, isRaceDay = false, isPostRace = false, isCarboLoading = false, tomorrowWorkouts = null, powerData = null) {
        let nutrition = this.calculate(
            bodyWeightLbs, goals, workoutType, duration, isRaceDay, isPostRace, isCarboLoading, null, tomorrowWorkouts, powerData
        );
        
        console.log(`🍎 Research-based nutrition for ${date}:`, {
            isRaceDay, isCarboLoading, isPostRace, workoutType, duration,
            tomorrowWorkouts: tomorrowWorkouts?.length || 0,
            baseCalories: nutrition.calories
        });
        
        // Apply completion adjustments for past dates
        if (workouts && workouts.length > 0) {
            const completionAdjustments = this.analyzeWorkoutsForAdjustments(workouts, date);
            if (completionAdjustments) {
                nutrition = workoutCompletionTracker.applyAdjustmentToNutrition(nutrition, completionAdjustments);
            }
        }
        
        return nutrition;
    },

    // Research-based macro calculation with periodization logic
    calculateResearchBasedMacros(bodyWeightKg, workoutType, duration, isRaceDay, isPostRace, isCarboLoading, goals, tomorrowWorkouts, powerData) {
        let protein, fat, carbs;
        let dayType = 'regular';
        
        // Determine day classification based on research
        if (isRaceDay) {
            dayType = 'race';
        } else if (isPostRace) {
            dayType = 'recovery';
        } else if (isCarboLoading) {
            dayType = 'carbLoading';
        } else {
            // Check if tomorrow has hard workouts (forward-looking periodization)
            const tomorrowIntensity = this.assessTomorrowIntensity(tomorrowWorkouts);
            if (tomorrowIntensity === 'high') {
                dayType = 'priming'; // Day before hard workout
            }
        }

        // Base protein - research suggests 1.4-2.2g/kg for athletes
        const baseProtein = Math.round(bodyWeightKg * 1.72); // 150g for 87kg athlete

        // Calculate based on day type and research principles
        switch (dayType) {
            case 'race':
                // Race day: Ultra-high carbs (8-10g/kg), moderate protein, low fat
                protein = baseProtein;
                fat = Math.round(bodyWeightKg * 0.8); // ~70g
                carbs = this.calculateRaceCarbs(bodyWeightKg, duration, powerData);
                break;

            case 'carbLoading':
                // Carb loading: 8-12g/kg carbs for glycogen supercompensation
                protein = baseProtein;
                fat = Math.round(bodyWeightKg * 0.8); // Keep fat low to make room for carbs
                carbs = Math.round(bodyWeightKg * 8.5); // ~740g for 87kg athlete
                break;

            case 'recovery':
                // Post-race recovery: High carbs + higher protein for tissue repair
                protein = Math.round(baseProtein * 1.15); // Increased for recovery
                fat = Math.round(bodyWeightKg * 1.0);
                carbs = Math.round(bodyWeightKg * 5.5); // High for glycogen replenishment
                break;

            case 'priming':
                // Day before hard workout: Ensure glycogen is topped off
                protein = baseProtein;
                fat = Math.round(bodyWeightKg * 0.9);
                carbs = this.calculatePrimingCarbs(bodyWeightKg, tomorrowWorkouts);
                break;

            default:
                // Regular training day: Scale with today's workout intensity
                protein = baseProtein;
                const macros = this.calculateTrainingDayMacros(bodyWeightKg, workoutType, duration, powerData);
                fat = macros.fat;
                carbs = macros.carbs;
        }

        // Apply goal-based modifications (weight loss periodization)
        if (goals === 'weight-loss' && dayType === 'regular') {
            const adjustments = this.applyWeightLossAdjustments(workoutType, duration, protein, fat, carbs);
            protein = adjustments.protein;
            fat = adjustments.fat;
            carbs = adjustments.carbs;
        } else if (goals === 'performance' && dayType === 'regular') {
            // Performance goal: modest surplus on training days
            carbs = Math.round(carbs * 1.1);
            fat = Math.round(fat * 1.05);
        }

        return { protein, fat, carbs };
    },

    // Calculate race day carbs based on duration and power output
    calculateRaceCarbs(bodyWeightKg, duration, powerData) {
        let baseCarbs = Math.round(bodyWeightKg * 8.6); // ~750g baseline
        
        // Adjust for race duration (longer races need more glycogen storage)
        if (duration > 240) { // >4 hours
            baseCarbs = Math.round(bodyWeightKg * 9.2);
        } else if (duration > 120) { // >2 hours
            baseCarbs = Math.round(bodyWeightKg * 8.8);
        }
        
        return baseCarbs;
    },

    // Calculate carbs for day before hard workout
    calculatePrimingCarbs(bodyWeightKg, tomorrowWorkouts) {
        if (!tomorrowWorkouts || tomorrowWorkouts.length === 0) {
            return Math.round(bodyWeightKg * 3.5); // Default moderate carbs
        }

        const totalTomorrowDuration = tomorrowWorkouts.reduce((sum, w) => 
            sum + (w.duration || w.moving_time || 0) / 60, 0
        );
        
        if (totalTomorrowDuration > 180) { // >3 hours tomorrow
            return Math.round(bodyWeightKg * 6.5); // High carbs for glycogen loading
        } else if (totalTomorrowDuration > 90) { // >1.5 hours tomorrow
            return Math.round(bodyWeightKg * 5.0); // Moderate-high carbs
        } else {
            return Math.round(bodyWeightKg * 3.5); // Standard carbs
        }
    },

    // Calculate macros for regular training days
    calculateTrainingDayMacros(bodyWeightKg, workoutType, duration, powerData) {
        let fat, carbs;

        // Use power data if available (research-based kJ approach)
        if (powerData && powerData.estimatedKJ) {
            const carbsFromKJ = this.calculateCarbsFromKilojoules(powerData.estimatedKJ);
            carbs = Math.max(carbsFromKJ, Math.round(bodyWeightKg * 2.0)); // Minimum baseline
            fat = Math.round(bodyWeightKg * (1.2 - (carbsFromKJ / (bodyWeightKg * 10)))); // Adjust fat down as carbs increase
            return { fat, carbs };
        }

        // Fallback to workout type-based approach - INCREASED BASELINE TO MATCH FUELIN
        switch (workoutType) {
            case 'none':
                // Rest day - further increased to hit 2000 cal weight loss target
                fat = 110; // Increased from 95g
                carbs = 235; // Increased from 200g  
                break;
            case 'easy':
                fat = Math.round(bodyWeightKg * 1.25); // ~109g
                carbs = Math.round(bodyWeightKg * 4.2); // ~365g
                break;
            case 'endurance':
                fat = Math.round(bodyWeightKg * 1.15);
                carbs = Math.round(bodyWeightKg * (5.0 + (duration > 120 ? 1.5 : 0)));
                break;
            case 'tempo':
                fat = Math.round(bodyWeightKg * 1.1);
                carbs = Math.round(bodyWeightKg * 5.7);
                break;
            case 'threshold':
                fat = Math.round(bodyWeightKg * 1.05);
                carbs = Math.round(bodyWeightKg * 6.3);
                break;
            case 'intervals':
                fat = Math.round(bodyWeightKg * 1.0);
                carbs = Math.round(bodyWeightKg * 7.0);
                break;
            case 'strength':
                fat = Math.round(bodyWeightKg * 1.15);
                carbs = Math.round(bodyWeightKg * 4.7);
                break;
            default:
                // Default to rest day values
                fat = 110;
                carbs = 235;
        }

        return { fat, carbs };
    },

    // Calculate carbs from kilojoules (research-based 40-50% replacement)
    calculateCarbsFromKilojoules(estimatedKJ) {
        const replacementRate = 0.45; // 45% replacement as per research
        const carbCalories = estimatedKJ * replacementRate;
        return Math.round(carbCalories / 4); // Convert to grams (4 cal/g)
    },

    // Apply weight loss adjustments using research-based periodization
    applyWeightLossAdjustments(workoutType, duration, protein, fat, carbs) {
        // Research: Higher protein during caloric deficit (2.3-3.1g/kg FFM)
        const adjustedProtein = Math.round(protein * 1.25); // Increase protein significantly
        
        // Create research-based deficit: adjusted to hit 2000 cal target
        let deficitFromCarbs = 0;
        let deficitFromFat = 0;
        
        if (workoutType === 'none' || workoutType === 'easy') {
            // Larger deficit on rest/easy days - tuned to hit exactly 2000 cal
            deficitFromCarbs = Math.round(carbs * 0.38); // 38% carb reduction (was 35%)
            deficitFromFat = Math.round(fat * 0.28); // 28% fat reduction (was 25%)
        } else if (['intervals', 'threshold', 'tempo'].includes(workoutType)) {
            // Smaller deficit on hard days to maintain performance
            deficitFromCarbs = Math.round(carbs * 0.2); // 20% carb reduction
            deficitFromFat = Math.round(fat * 0.15); // 15% fat reduction
        } else {
            // Moderate deficit on endurance days
            deficitFromCarbs = Math.round(carbs * 0.28); // 28% carb reduction
            deficitFromFat = Math.round(fat * 0.2); // 20% fat reduction
        }

        return {
            protein: adjustedProtein,
            fat: Math.max(fat - deficitFromFat, Math.round(fat * 0.6)), // Don't go too low
            carbs: Math.max(carbs - deficitFromCarbs, Math.round(carbs * 0.5)) // Don't go too low
        };
    },

    // Assess tomorrow's workout intensity for forward-looking periodization
    assessTomorrowIntensity(tomorrowWorkouts) {
        if (!tomorrowWorkouts || tomorrowWorkouts.length === 0) return 'low';
        
        const intensityScores = tomorrowWorkouts.map(workout => {
            const type = this.mapWorkoutType(workout);
            const duration = (workout.duration || workout.moving_time || 0) / 60;
            
            const typeScore = {
                'intervals': 5, 'threshold': 4, 'tempo': 3,
                'endurance': 2, 'strength': 2, 'easy': 1, 'none': 0
            }[type] || 1;
            
            const durationMultiplier = duration > 120 ? 1.5 : duration > 60 ? 1.2 : 1.0;
            return typeScore * durationMultiplier;
        });
        
        const maxScore = Math.max(...intensityScores);
        if (maxScore >= 6) return 'high';
        if (maxScore >= 3) return 'medium';
        return 'low';
    },

    // Enhanced workout fueling based on research
    calculateWorkoutFueling(workoutType, duration, isRaceDay, isCarboLoading = false, powerData = null) {
        let duringWorkoutCarbs = 0;
        let fuelingTips = [];
        let preWorkoutCarbs = 'Varies';
        let postWorkoutCarbs = 'Varies';
        let requiresMTC = false;

        if (isRaceDay) {
            // Race day: Research suggests 90-120g/hr for races
            duringWorkoutCarbs = duration > 240 ? 110 : 100; // Higher for ultra-long races
            requiresMTC = true;
            preWorkoutCarbs = '100-120g (2-3 hours before)';
            postWorkoutCarbs = 'Recovery focused - high carbs + protein';
            fuelingTips = [
                'TARGET: 90-120g carbs/hr using Multiple Transportable Carbohydrates (MTC)',
                'Use 1:0.8 glucose:fructose ratio for optimal absorption at high rates',
                'Consider hydrogel technology for rates >90g/hr',
                'Practice your exact race fueling strategy in training'
            ];
        } else if (isCarboLoading) {
            fuelingTips = [
                'Carb loading day - focus on 8-12g carbs per kg body weight',
                'Choose easily digestible carbs: white rice, pasta, bread',
                'Reduce fiber intake to minimize GI distress',
                'Stay well hydrated and avoid new foods'
            ];
        } else if (powerData && powerData.estimatedKJ) {
            // Use research-based kJ approach for advanced users
            const targetCarbsPerHour = this.calculateHourlyCarbsFromKJ(powerData.estimatedKJ / (duration / 60));
            duringWorkoutCarbs = Math.round(targetCarbsPerHour);
            requiresMTC = duringWorkoutCarbs > 60;
            
            fuelingTips = [
                `Power-based fueling: Targeting ${duringWorkoutCarbs}g/hr (45% of ${Math.round(powerData.estimatedKJ)}kJ workload)`,
                requiresMTC ? 'MTC required - use glucose:fructose blend for absorption >60g/hr' : 'Single carb source acceptable at this rate',
                'Adjust based on gut tolerance and training adaptations'
            ];
        } else {
            // Duration and intensity-based approach (research guidelines)
            if (duration < 60) {
                duringWorkoutCarbs = 0;
                fuelingTips = ['Workout <60min: Endogenous glycogen sufficient', 'Consider carb mouth rinse for high-intensity efforts'];
            } else if (duration <= 150) { // 1-2.5 hours
                if (['intervals', 'threshold', 'tempo'].includes(workoutType)) {
                    duringWorkoutCarbs = 60;
                    requiresMTC = true;
                } else {
                    duringWorkoutCarbs = 45;
                }
                fuelingTips = [
                    'Start fueling within first 15-20 minutes',
                    requiresMTC ? 'Use MTC blend for high-intensity work' : 'Single carb source acceptable',
                    'Target consistent intake every 15-20 minutes'
                ];
            } else { // >2.5 hours
                duringWorkoutCarbs = ['intervals', 'threshold', 'tempo'].includes(workoutType) ? 85 : 70;
                requiresMTC = true;
                fuelingTips = [
                    'Long duration requires >60g/hr - MTC mandatory',
                    'Start fueling early and maintain consistent intake',
                    'Consider gut training to increase tolerance',
                    'Monitor hydration and electrolyte needs'
                ];
            }
        }

        return {
            preWorkoutCarbs,
            duringWorkoutCarbs,
            postWorkoutCarbs,
            requiresMTC,
            fluidIntake: 750,
            fuelingTips,
            gutTrainingNote: duringWorkoutCarbs > 60 ? 'This intake rate requires gut training for optimal tolerance' : null
        };
    },

    // Calculate hourly carbs from kJ/hr
    calculateHourlyCarbsFromKJ(kjPerHour) {
        return Math.round(kjPerHour * 0.45 / 4); // 45% replacement, 4 cal/g carbs
    },

    // Get periodization explanation
    getPeriodizationNote(isRaceDay, isPostRace, isCarboLoading, tomorrowWorkouts) {
        if (isRaceDay) return 'Race day fueling - optimized for performance';
        if (isPostRace) return 'Recovery day - enhanced protein + carbs for adaptation';
        if (isCarboLoading) return 'Carb loading - maximizing glycogen storage';
        
        const tomorrowIntensity = this.assessTomorrowIntensity(tomorrowWorkouts);
        if (tomorrowIntensity === 'high') {
            return 'Priming day - higher carbs to prepare for tomorrow\'s hard workout';
        }
        
        return 'Regular training day - matched to today\'s workout demands';
    },

    // Helper function for workout type mapping
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

    // Analyze workouts for completion adjustments
    analyzeWorkoutsForAdjustments(workouts, date) {
        const selectedDate = new Date(date);
        const today = new Date();
        
        if (selectedDate >= today) return null;
        
        let totalAdjustment = {
            calories: 0, carbs: 0, protein: 0, fat: 0,
            reasoning: [], timing: [], recovery: []
        };
        
        let hasAdjustments = false;
        
        workouts.forEach(workout => {
            if (workout.isCompleted && workout.completionData) {
                const analysis = workoutCompletionTracker.analyzeWorkoutCompletion(workout, workout.completionData);
                if (analysis && analysis.adjustment) {
                    const adj = analysis.adjustment;
                    totalAdjustment.calories += adj.calories;
                    totalAdjustment.carbs += adj.carbs;
                    totalAdjustment.protein += adj.protein;
                    totalAdjustment.fat += adj.fat;
                    totalAdjustment.reasoning.push(...adj.reasoning);
                    totalAdjustment.timing.push(...adj.timing);
                    totalAdjustment.recovery.push(...adj.recovery);
                    hasAdjustments = true;
                }
            }
        });
        
        return hasAdjustments ? totalAdjustment : null;
    },

    // Enhanced results formatting
    formatNutritionResults(nutrition) {
        let html = `
            <div class="nutrition-card">
                <h3>🎯 Daily Nutrition Target</h3>
                ${nutrition.periodizationNote ? `<p class="periodization-note"><em>${nutrition.periodizationNote}</em></p>` : ''}
                <div class="macro-grid">
                    <div class="macro-item">
                        <div class="macro-value">${nutrition.calories}</div>
                        <div class="macro-label">Calories</div>
                    </div>
                    <div class="macro-item">
                        <div class="macro-value">${nutrition.protein}g</div>
                        <div class="macro-label">Protein</div>
                    </div>
                    <div class="macro-item">
                        <div class="macro-value">${nutrition.carbs}g</div>
                        <div class="macro-label">Carbs</div>
                    </div>
                    <div class="macro-item">
                        <div class="macro-value">${nutrition.fat}g</div>
                        <div class="macro-label">Fat</div>
                    </div>
                </div>
        `;

        // Add adjustment information if applied
        if (nutrition.adjustmentApplied && nutrition.adjustmentDetails) {
            html += `
                <div class="adjustment-notice">
                    <h4>📊 Workout Completion Adjustment Applied</h4>
                    <p><strong>Reason:</strong> ${nutrition.adjustmentDetails.reason}</p>
                    <div class="adjustment-details">
                        <p><strong>Original plan:</strong> ${nutrition.adjustmentDetails.originalPlan.calories} cal, ${nutrition.adjustmentDetails.originalPlan.carbs}g C, ${nutrition.adjustmentDetails.originalPlan.protein}g P</p>
                        <p><strong>Adjustment:</strong> ${nutrition.calories - nutrition.adjustmentDetails.originalPlan.calories > 0 ? '+' : ''}${nutrition.calories - nutrition.adjustmentDetails.originalPlan.calories} cal</p>
                    </div>
            `;

            if (nutrition.adjustmentDetails.timing && nutrition.adjustmentDetails.timing.length > 0) {
                html += `
                    <div class="timing-recommendations">
                        <h5>⏰ Timing Recommendations:</h5>
                        <ul>
                            ${nutrition.adjustmentDetails.timing.map(tip => `<li>${tip}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            if (nutrition.adjustmentDetails.recovery && nutrition.adjustmentDetails.recovery.length > 0) {
                html += `
                    <div class="recovery-recommendations">
                        <h5>🔄 Recovery Focus:</h5>
                        <ul>
                            ${nutrition.adjustmentDetails.recovery.map(tip => `<li>${tip}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            html += `</div>`;
        }

        // Add fueling information
        if (nutrition.fueling) {
            html += `
                <div class="fueling-notes">
                    <h4>⚡ Workout Fueling Strategy</h4>
                    ${nutrition.fueling.preWorkoutCarbs !== 'Varies' ? `<p><strong>Pre-workout:</strong> ${nutrition.fueling.preWorkoutCarbs}</p>` : ''}
                    <p><strong>During workout:</strong> ${nutrition.fueling.duringWorkoutCarbs}g carbs/hour${nutrition.fueling.requiresMTC ? ' (MTC required)' : ''}</p>
                    ${nutrition.fueling.postWorkoutCarbs !== 'Varies' ? `<p><strong>Post-workout:</strong> ${nutrition.fueling.postWorkoutCarbs}</p>` : ''}
                    <p><strong>Fluid intake:</strong> ${nutrition.fueling.fluidIntake}ml/hour</p>
                    
                    ${nutrition.fueling.gutTrainingNote ? `<div class="gut-training-note"><strong>⚠️ ${nutrition.fueling.gutTrainingNote}</strong></div>` : ''}
                    
                    <ul>
                        ${nutrition.fueling.fuelingTips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }
};