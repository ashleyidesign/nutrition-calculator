// Enhanced Nutrition Calculator Aligned with Fuelin Recommendations
const nutritionCalculator = {
    calculate(bodyWeightLbs = null, goals = null, workoutType = null, duration = null, isRaceDay = false, isPostRace = false, isCarboLoading = false, completionAdjustments = null) {
        const bw = bodyWeightLbs !== null ? bodyWeightLbs : parseInt(document.getElementById('bodyWeight').value);
        const currentGoals = goals !== null ? goals : document.getElementById('goals').value;
        const wt = workoutType !== null ? workoutType : document.getElementById('workoutType').value;
        const dur = duration !== null ? duration : parseInt(document.getElementById('duration').value);
        
        const bodyWeightKg = bw * 0.453592;

        const baseMacros = this.calculateMacros(bodyWeightKg, wt, dur, isRaceDay, isPostRace, isCarboLoading, currentGoals);
        const dailyCalories = (baseMacros.protein * 4) + (baseMacros.carbs * 4) + (baseMacros.fat * 9);
        const fueling = this.calculateWorkoutFueling(wt, dur, isRaceDay);

        let finalNutrition = {
            calories: Math.round(dailyCalories),
            ...baseMacros,
            fueling: fueling,
            adjustmentApplied: false
        };

        // Apply completion-based adjustments if available
        if (completionAdjustments) {
            finalNutrition = workoutCompletionTracker.applyAdjustmentToNutrition(finalNutrition, completionAdjustments);
        }

        return finalNutrition;
    },

    // Enhanced calculation that considers completion data for a specific date
    calculateWithCompletionData(bodyWeightLbs, goals, workoutType, duration, date, workouts = null, isRaceDay = false, isPostRace = false, isCarboLoading = false) {
        // Start with base calculation including race day flags
        let nutrition = this.calculate(bodyWeightLbs, goals, workoutType, duration, isRaceDay, isPostRace, isCarboLoading);
        
        console.log(`🍎 Nutrition calculation for ${date}:`, {
            isRaceDay,
            isCarboLoading, 
            isPostRace,
            workoutType,
            duration,
            baseCalories: nutrition.calories
        });
        
        // Check if we have completion data for this date
        if (workouts && workouts.length > 0) {
            const completionAdjustments = this.analyzeWorkoutsForAdjustments(workouts, date);
            if (completionAdjustments) {
                nutrition = workoutCompletionTracker.applyAdjustmentToNutrition(nutrition, completionAdjustments);
            }
        }
        
        return nutrition;
    },

    // Analyze workouts for completion-based adjustments
    analyzeWorkoutsForAdjustments(workouts, date) {
        const selectedDate = new Date(date);
        const today = new Date();
        
        // Only apply adjustments for past dates
        if (selectedDate >= today) return null;
        
        let totalAdjustment = {
            calories: 0,
            carbs: 0,
            protein: 0,
            fat: 0,
            reasoning: [],
            timing: [],
            recovery: []
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

    calculateMacros(bodyWeightKg, workoutType, duration, isRaceDay, isPostRace, isCarboLoading, goals) {
        let protein, fat, carbs;

        // Base values for 192lb (87kg) athlete matching your actual targets
        const baseProtein = 150; // Your consistent protein target
        
        // Step 1: Set macros based on day type (matches Fuelin priority system)
        if (isRaceDay) {
            // Race Day - Ultra high carbs like Fuelin's 749g example
            protein = baseProtein; // Keep protein consistent
            fat = Math.round(bodyWeightKg * 0.8); // Lower fat on race days (about 70g)
            carbs = Math.round(bodyWeightKg * 8.6); // Very high carbs ~750g for race fueling
        } else if (isCarboLoading) {
            // Carb Loading Days - High carbs like Fuelin's 710-714g examples  
            protein = baseProtein; // Keep protein consistent
            fat = Math.round(bodyWeightKg * 0.8); // Lower fat to make room for carbs (about 70g)
            carbs = Math.round(bodyWeightKg * 8.2); // High carbs ~714g for carb loading
        } else if (isPostRace) {
            // Post-Race Recovery - High carbs + higher protein like Fuelin's recovery
            protein = Math.round(baseProtein * 1.1); // Slightly higher protein for recovery (~165g)
            fat = Math.round(bodyWeightKg * 1.0); // Moderate fat (~87g)
            carbs = Math.round(bodyWeightKg * 5.2); // High carbs for glycogen replenishment (~453g)
        } else {
            // Regular Training Days - Base on workout intensity
            protein = baseProtein; // Consistent protein base
            
            switch (workoutType) {
                case 'none':
                    // Rest day - your actual targets: 150p, 80f, 170c
                    fat = 80; // Fixed at 80g fat
                    carbs = 170; // Fixed at 170g carbs
                    break;
                    
                case 'easy':
                    // Easy recovery workout - slight bump from rest day
                    fat = Math.round(bodyWeightKg * 0.95); // ~83g fat  
                    carbs = Math.round(bodyWeightKg * 3.0); // ~260g carbs
                    break;
                    
                case 'endurance':
                    // Long endurance workout - more carbs for sustained energy
                    fat = Math.round(bodyWeightKg * 0.9); // ~78g fat
                    carbs = Math.round(bodyWeightKg * 3.8 + (duration > 120 ? 0.8 * bodyWeightKg : 0)); // ~330g+ carbs
                    break;
                    
                case 'tempo':
                    // Tempo workout - moderate high carbs
                    fat = Math.round(bodyWeightKg * 0.85); // ~74g fat
                    carbs = Math.round(bodyWeightKg * 4.5); // ~390g carbs
                    break;
                    
                case 'threshold':
                    // Threshold workout - high carbs for intensity
                    fat = Math.round(bodyWeightKg * 0.8); // ~70g fat
                    carbs = Math.round(bodyWeightKg * 5.2); // ~450g carbs
                    break;
                    
                case 'intervals':
                    // High intensity intervals - highest training carbs
                    fat = Math.round(bodyWeightKg * 0.75); // ~65g fat
                    carbs = Math.round(bodyWeightKg * 5.8); // ~505g carbs
                    break;
                    
                case 'strength':
                    // Strength training - higher protein, moderate carbs
                    protein = Math.round(baseProtein * 1.2); // ~180g protein
                    fat = Math.round(bodyWeightKg * 0.9); // ~78g fat
                    carbs = Math.round(bodyWeightKg * 3.5); // ~305g carbs
                    break;
                    
                default:
                    // Default to rest day values: 150p, 80f, 170c
                    fat = 80;
                    carbs = 170;
            }
        }

        // Step 2: Apply goal-based adjustments ONLY for regular training days
        const isRegularDay = !isRaceDay && !isPostRace && !isCarboLoading;
        if (isRegularDay) {
            switch(goals) {
                case 'weight-loss':
                    // Create deficit primarily from carbs and fat
                    if (workoutType === 'none' || workoutType === 'easy') {
                        // More aggressive cut on rest/easy days
                        fat = Math.round(fat * 0.85); // Reduce fat by 15%
                        carbs = Math.round(carbs * 0.8); // Reduce carbs by 20%
                    } else {
                        // Smaller cut on workout days to maintain performance
                        fat = Math.round(fat * 0.9); // Reduce fat by 10%
                        carbs = Math.round(carbs * 0.9); // Reduce carbs by 10%
                    }
                    break;
                
                case 'performance':
                    // Add surplus primarily from carbs
                    carbs = Math.round(carbs * 1.15); // Increase carbs by 15%
                    fat = Math.round(fat * 1.05); // Small fat increase
                    break;

                case 'maintenance':
                    // Keep calculated values as-is
                    break;
            }
        }

        return {
            protein: Math.round(protein),
            fat: Math.round(fat),
            carbs: Math.round(carbs)
        };
    },

    calculateWorkoutFueling(workoutType, duration, isRaceDay) {
        let duringWorkoutCarbs = 0;
        let fuelingTips = [];
        let preWorkoutCarbs = 'Varies';
        let postWorkoutCarbs = 'Varies';

        if (isRaceDay) {
            // Race day fueling - very specific like Fuelin
            duringWorkoutCarbs = 90;
            preWorkoutCarbs = '100g (2-3 hours before)';
            postWorkoutCarbs = 'As part of recovery plan';
            fuelingTips = [
                'RACE FUEL: Target 90-120g carbs/hr during race',
                'Consume race day breakfast 2-3 hours before start',
                'Practice your fueling strategy in training',
                'Have backup fuel options ready'
            ];
        } else if (isCarboLoading) {
            // Carb loading specific tips
            fuelingTips = [
                'Focus on easily digestible carbs (rice, pasta, bread)',
                'Reduce fiber intake to minimize GI distress', 
                'Stay well hydrated throughout the day',
                'Avoid trying new foods during carb loading'
            ];
        } else if (duration >= 60 && duration <= 90) {
            duringWorkoutCarbs = 40;
            fuelingTips = [
                'Start fueling within the first 15-20 minutes',
                'Aim for easily digestible carbs',
                'Hydrate regularly throughout the session'
            ];
        } else if (duration > 90) {
            duringWorkoutCarbs = 60;
            if (['tempo', 'threshold', 'intervals'].includes(workoutType)) {
                duringWorkoutCarbs = 80;
            }
            fuelingTips = [
                'Start fueling early and dose frequently (every 15-20 min)',
                'Mix carb types for better absorption',
                'Monitor hydration and electrolyte needs',
                'Practice fueling strategy for longer sessions'
            ];
        } else {
            fuelingTips = [
                'No in-session fueling required for this workout',
                'Focus on pre and post-workout nutrition',
                'Stay hydrated throughout'
            ];
        }

        return {
            preWorkoutCarbs: preWorkoutCarbs,
            duringWorkoutCarbs: duringWorkoutCarbs,
            postWorkoutCarbs: postWorkoutCarbs,
            fluidIntake: 750,
            fuelingTips
        };
    },

    // Format nutrition results for display
    formatNutritionResults(nutrition) {
        let html = `
            <div class="nutrition-card">
                <h3>🎯 Daily Nutrition Target</h3>
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
                    <h4>⚡ Workout Fueling</h4>
                    <p><strong>Pre-workout:</strong> ${nutrition.fueling.preWorkoutCarbs}</p>
                    <p><strong>During workout:</strong> ${nutrition.fueling.duringWorkoutCarbs}g carbs/hour</p>
                    <p><strong>Post-workout:</strong> ${nutrition.fueling.postWorkoutCarbs}</p>
                    <p><strong>Fluid intake:</strong> ${nutrition.fueling.fluidIntake}ml/hour</p>
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