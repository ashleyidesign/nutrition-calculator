// Enhanced Nutrition Calculator with Fixed Macro Calculations
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
        let p_mult, f_mult, c_mult;

        // Step 1: Set the baseline macros for the day type
        if (isRaceDay) {
            p_mult = 2.2; f_mult = 1.7; c_mult = 8.6;
        } else if (isPostRace) {
            p_mult = 1.7; f_mult = 1.0; c_mult = 5.2;
        } else if (isCarboLoading) {
            p_mult = 1.7; f_mult = 1.0; c_mult = 8.2;
        } else {
            // This is a regular training or rest day - use FUELIN baseline (~2250 calories for maintenance)
            switch (workoutType) {
                case 'none':
                case 'easy':
                    // Rest/Easy day baseline (matches Fuelin's ~2250 cal target for 192lb athlete)
                    p_mult = 1.8; f_mult = 1.0; c_mult = 2.5; 
                    break;
                case 'endurance':
                    // Long endurance workout (Z1-Z2)
                    p_mult = 1.8; f_mult = 1.1; c_mult = 4.5 + (duration > 120 ? 1.0 : 0);
                    break;
                case 'tempo':
                    // Tempo workout (Z3) - moderate carbs
                    p_mult = 1.75; f_mult = 1.0; c_mult = 5.5;
                    break;
                case 'threshold':
                    // Threshold workout (Z4) - higher carbs
                    p_mult = 1.7; f_mult = 1.0; c_mult = 6.2;
                    break;
                case 'intervals':
                    // High intensity intervals (Z5+) - highest carbs
                    p_mult = 1.7; f_mult = 1.0; c_mult = 6.8;
                    break;
                case 'strength':
                    // Strength training - higher protein, moderate carbs
                    p_mult = 1.9; f_mult = 1.1; c_mult = 4.0;
                    break;
                default:
                    p_mult = 1.7; f_mult = 1.0; c_mult = 2.5;
            }
        }
        
        // Step 2: Apply goal-based adjustments for regular training days only
        const isRegularDay = !isRaceDay && !isPostRace && !isCarboLoading;
        if (isRegularDay) {
            switch(goals) {
                case 'weight-loss':
                    // Create deficit from baseline
                    if (workoutType === 'none' || workoutType === 'easy') {
                        // Target ~2000 calories for rest days during weight loss
                        p_mult = 1.72; f_mult = 0.92; c_mult = 1.95;
                    } else {
                        // Reduce from baseline for workout days
                        f_mult = Math.max(0.8, f_mult - 0.2);
                        c_mult = Math.max(2.0, c_mult - 1.0);
                    }
                    break;
                
                case 'performance':
                    // Add surplus for performance focus
                    p_mult += 0.2;
                    c_mult += 1.5;
                    break;

                case 'maintenance':
                    // Use baseline as-is (already matches Fuelin targets)
                    break;
            }
        }

        return {
            protein: Math.round(bodyWeightKg * p_mult),
            fat: Math.round(bodyWeightKg * f_mult),
            carbs: Math.round(bodyWeightKg * c_mult)
        };
    },

    calculateWorkoutFueling(workoutType, duration, isRaceDay) {
        let duringWorkoutCarbs = 0;
        let fuelingTips = [];

        if (isRaceDay) {
            duringWorkoutCarbs = 90;
            fuelingTips.push('RACE FUEL: Aim for 90-120g carbs/hr. This is your primary goal.');
        } else if (duration >= 60 && duration <= 90) {
            duringWorkoutCarbs = 40;
            fuelingTips.push('Start fueling within the first 15 minutes.');
        } else if (duration > 90) {
            duringWorkoutCarbs = 60;
            if (['tempo', 'threshold', 'intervals'].includes(workoutType)) {
                duringWorkoutCarbs = 80;
            }
            fuelingTips.push('Start fueling early and dose frequently.');
        } else {
            fuelingTips.push('No in-session fueling required for this workout.');
        }

        return {
            preWorkoutCarbs: 'Varies',
            duringWorkoutCarbs: duringWorkoutCarbs,
            postWorkoutCarbs: 'Varies',
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
                    <p><strong>During workout:</strong> ${nutrition.fueling.duringWorkoutCarbs}g carbs/hour</p>
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