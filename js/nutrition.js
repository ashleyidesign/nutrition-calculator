const nutritionCalculator = {
    calculate(bodyWeightLbs = null, goals = null, workoutType = null, duration = null, isRaceDay = false, isPostRace = false, isCarboLoading = false, completionAdjustments = null) {
        const bw = bodyWeightLbs !== null ? bodyWeightLbs : parseInt(document.getElementById('bodyWeight')?.value || 192);
        const currentGoals = goals !== null ? goals : document.getElementById('goals')?.value || 'performance';
        const wt = workoutType !== null ? workoutType : document.getElementById('workoutType')?.value || 'none';
        const dur = duration !== null ? duration : parseInt(document.getElementById('duration')?.value || 0);
        
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
        if (completionAdjustments && typeof workoutCompletionTracker !== 'undefined') {
            finalNutrition = workoutCompletionTracker.applyAdjustmentToNutrition(finalNutrition, completionAdjustments);
        }

        return finalNutrition;
    },

    // Enhanced calculation that considers completion data for a specific date
    calculateWithCompletionData(bodyWeightLbs, goals, workoutType, duration, date, workouts = null, isRaceDay = false, isPostRace = false, isCarboLoading = false) {
        // Start with base calculation using the race/carb loading flags
        console.log(`🧮 Nutrition calculation for ${date}:`, {
            workoutType, duration, isRaceDay, isPostRace, isCarboLoading
        });
        
        let nutrition = this.calculate(bodyWeightLbs, goals, workoutType, duration, isRaceDay, isPostRace, isCarboLoading);
        
        console.log(`📊 Base nutrition calculated:`, nutrition);
        
        // Check if we have completion data for this date
        if (workouts && workouts.length > 0 && typeof workoutCompletionTracker !== 'undefined') {
            const completionAdjustments = this.analyzeWorkoutsForAdjustments(workouts, date);
            if (completionAdjustments) {
                nutrition = workoutCompletionTracker.applyAdjustmentToNutrition(nutrition, completionAdjustments);
                console.log(`📊 Applied completion adjustments:`, nutrition);
            }
        }
        
        return nutrition;
    },

    // Analyze workouts for completion-based adjustments
    analyzeWorkoutsForAdjustments(workouts, date) {
        if (typeof workoutCompletionTracker === 'undefined') return null;
        
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
                    
                    console.log(`📊 Applied adjustment for ${workout.name}: ${adj.calories} cal, reason: ${adj.reasoning.join(', ')}`);
                }
            }
        });
        
        return hasAdjustments ? totalAdjustment : null;
    },

    calculateMacros(bodyWeightKg, workoutType, duration, isRaceDay, isPostRace, isCarboLoading, goals) {
        let p_mult, f_mult, c_mult;

        // Step 1: Set the baseline macros for the day type (assuming "Maintenance" goal)
        if (isRaceDay) {
            p_mult = 2.2; f_mult = 1.7; c_mult = 8.6;
        } else if (isPostRace) {
            p_mult = 1.7; f_mult = 1.0; c_mult = 5.2;
        } else if (isCarboLoading) {
            p_mult = 1.7; f_mult = 1.0; c_mult = 8.2;
        } else {
            // This is a regular training or rest day. Set "Maintenance" as the baseline.
            switch (workoutType) {
                case 'none':
                case 'easy':
                    p_mult = 1.8; f_mult = 1.0; c_mult = 2.5; 
                    break;
                case 'endurance':
                    p_mult = 1.8; f_mult = 1.1; c_mult = 4.3 + (duration > 120 ? 1.0 : 0);
                    break;
                case 'tempo':
                case 'threshold':
                case 'intervals':
                     p_mult = 1.7; f_mult = 1.0; c_mult = 6.4;
                     break;
                case 'strength':
                     p_mult = 1.9; f_mult = 1.1; c_mult = 3.5;
                     break;
                default:
                    p_mult = 1.7; f_mult = 1.0; c_mult = 2.5;
            }
        }
        
        // Step 2: If it's a regular day, apply adjustments based on the selected goal
        const isRegularDay = !isRaceDay && !isPostRace && !isCarboLoading;
        if (isRegularDay) {
            switch(goals) {
                case 'weight-loss':
                    if (workoutType === 'none' || workoutType === 'easy') {
                        p_mult = 1.72; f_mult = 0.92; c_mult = 1.95;
                    } else {
                        f_mult = Math.max(0.8, f_mult - 0.2);
                        c_mult = Math.max(2.0, c_mult - 1.0);
                    }
                    break;
                
                case 'performance':
                    p_mult += 0.2;
                    c_mult += 1.5;
                    break;

                case 'maintenance':
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
    formatNutritionResults(nutrition, nutritionData = null) {
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

        // Add nutrition tracking if data is available
        if (nutritionData) {
            html += this.formatNutritionTracking(nutrition, nutritionData);
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
    },

    // Format nutrition tracking with progress circles
    formatNutritionTracking(target, actual) {
        const caloriesPercent = Math.round((actual.calories / target.calories) * 100);
        const proteinPercent = Math.round((actual.protein / target.protein) * 100);
        const carbsPercent = Math.round((actual.carbs / target.carbs) * 100);
        const fatPercent = Math.round((actual.fat / target.fat) * 100);
        
        const overallAdherence = Math.round((caloriesPercent + proteinPercent + carbsPercent + fatPercent) / 4);
        
        return `
            <div class="nutrition-tracking">
                <h4>📊 Nutrition Tracking <span class="sample-data">(Sample Data from MyFitnessPal)</span></h4>
                
                <div class="adherence-summary">
                    <div class="adherence-score">${overallAdherence}%</div>
                    <div class="adherence-text">Overall Nutrition Adherence ${overallAdherence >= 85 ? '✅' : overallAdherence >= 70 ? '⚠️' : '❌'}</div>
                </div>
                
                <div class="progress-grid">
                    <div class="progress-item">
                        <div class="progress-circle">
                            <svg>
                                <circle class="bg-circle" cx="60" cy="60" r="50"></circle>
                                <circle class="progress-ring calories" cx="60" cy="60" r="50" 
                                        stroke-dasharray="314" stroke-dashoffset="${314 - (314 * caloriesPercent / 100)}"></circle>
                            </svg>
                            <div class="progress-text">
                                <div class="progress-percentage">${caloriesPercent}%</div>
                            </div>
                        </div>
                        <div class="progress-label">Calories</div>
                        <div class="progress-values">${actual.calories.toLocaleString()} / ${target.calories.toLocaleString()}</div>
                    </div>

                    <div class="progress-item">
                        <div class="progress-circle">
                            <svg>
                                <circle class="bg-circle" cx="60" cy="60" r="50"></circle>
                                <circle class="progress-ring protein" cx="60" cy="60" r="50" 
                                        stroke-dasharray="314" stroke-dashoffset="${314 - (314 * proteinPercent / 100)}"></circle>
                            </svg>
                            <div class="progress-text">
                                <div class="progress-percentage">${proteinPercent}%</div>
                            </div>
                        </div>
                        <div class="progress-label">Protein</div>
                        <div class="progress-values">${actual.protein}g / ${target.protein}g</div>
                    </div>

                    <div class="progress-item">
                        <div class="progress-circle">
                            <svg>
                                <circle class="bg-circle" cx="60" cy="60" r="50"></circle>
                                <circle class="progress-ring carbs" cx="60" cy="60" r="50" 
                                        stroke-dasharray="314" stroke-dashoffset="${314 - (314 * carbsPercent / 100)}"></circle>
                            </svg>
                            <div class="progress-text">
                                <div class="progress-percentage">${carbsPercent}%</div>
                            </div>
                        </div>
                        <div class="progress-label">Carbs</div>
                        <div class="progress-values">${actual.carbs}g / ${target.carbs}g</div>
                    </div>

                    <div class="progress-item">
                        <div class="progress-circle">
                            <svg>
                                <circle class="bg-circle" cx="60" cy="60" r="50"></circle>
                                <circle class="progress-ring fat" cx="60" cy="60" r="50" 
                                        stroke-dasharray="314" stroke-dashoffset="${314 - (314 * fatPercent / 100)}"></circle>
                            </svg>
                            <div class="progress-text">
                                <div class="progress-percentage">${fatPercent}%</div>
                            </div>
                        </div>
                        <div class="progress-label">Fat</div>
                        <div class="progress-values">${actual.fat}g / ${target.fat}g</div>
                    </div>
                </div>

                ${actual.meals ? this.formatMealTiming(actual.meals) : ''}
            </div>
        `;
    },

    // Format meal timing information
    formatMealTiming(meals) {
        return `
            <div class="timing-notes">
                ${meals.map(meal => `
                    <div class="meal-timing">
                        <h5>${meal.icon} ${meal.name}</h5>
                        <p><strong>Consumed:</strong> ${meal.calories} calories</p>
                        <p>${meal.foods}</p>
                        <p><strong>Status:</strong> ${meal.status}</p>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // Generate sample nutrition data for testing
    generateSampleNutritionData(target, date) {
        // Generate realistic sample data based on target
        const variance = 0.85 + (Math.random() * 0.3); // 85% to 115% of target
        
        return {
            date: date,
            calories: Math.round(target.calories * variance),
            protein: Math.round(target.protein * (0.9 + Math.random() * 0.2)),
            carbs: Math.round(target.carbs * (0.7 + Math.random() * 0.4)),
            fat: Math.round(target.fat * (0.8 + Math.random() * 0.4)),
            meals: [
                {
                    icon: "🌅",
                    name: "Pre-Workout (5:30 AM)",
                    calories: 680,
                    foods: "Oatmeal, banana, coffee",
                    status: "On target ✅"
                },
                {
                    icon: "⚡",
                    name: "During Workout (6:00-9:05 AM)",
                    calories: 240,
                    foods: "Sports drinks, gels",
                    status: "30g carbs short ⚠️"
                },
                {
                    icon: "🔄",
                    name: "Post-Workout (9:30 AM)",
                    calories: 1240,
                    foods: "Recovery shake, sandwich",
                    status: "Within 30 min ✅"
                }
            ]
        };
    }
};
