// Nutrition Calculation Module - Updated with Fuelin's Methodology
const nutritionCalculator = {
    /**
     * Main calculation function.
     * Determines the "traffic light" color for the day and calculates macros accordingly.
     */
    calculate(bodyWeightLbs = null, goals = null, workoutType = null, duration = null, isCarboLoading = false) {
        // --- FIX: Only query the DOM if values are not passed in as arguments ---
        const bw = bodyWeightLbs !== null ? bodyWeightLbs : parseInt(document.getElementById('bodyWeight').value);
        const currentGoals = goals !== null ? goals : document.getElementById('goals').value;
        const wt = workoutType !== null ? workoutType : document.getElementById('workoutType').value;
        const dur = duration !== null ? duration : parseInt(document.getElementById('duration').value);
        
        const bodyWeightKg = bw * 0.453592;

        console.log(`Calculating (Fuelin Method): ${bw}lbs (${bodyWeightKg.toFixed(2)}kg), Goal: ${currentGoals}, Workout: ${wt}, Duration: ${dur}min, Carb Loading: ${isCarboLoading}`);

        // 1. Set Protein and Fat based on Fuelin's core recommendations
        const dailyProtein = this.calculateProtein(bodyWeightKg, currentGoals);
        const dailyFat = this.calculateFat(bodyWeightKg, currentGoals);

        // 2. Determine daily carbs using the "Traffic Light" system
        const dailyCarbs = this.calculateCarbohydrates(bodyWeightKg, wt, dur, currentGoals, isCarboLoading);

        // 3. Calculate total calories from macros
        const dailyCalories = (dailyProtein * 4) + (dailyCarbs * 4) + (dailyFat * 9);

        console.log(`Results: ${dailyCalories} cal, ${dailyProtein}p, ${dailyCarbs}c, ${dailyFat}f`);

        // 4. Calculate workout-specific fueling
        const fueling = this.calculateWorkoutFueling(wt, dur);

        // 5. Update the UI *only if* the elements exist (i.e., we are on index.html)
        if (document.getElementById('totalCalories')) {
            this.updateNutritionDisplay(dailyCalories, dailyProtein, dailyCarbs, dailyFat, fueling);
        }

        // Always return the calculated values
        return {
            calories: Math.round(dailyCalories),
            protein: dailyProtein,
            carbs: dailyCarbs,
            fat: dailyFat,
            fueling: fueling
        };
    },

    /**
     * Calculates protein based on body weight.
     * Fuelin recommends 2.0-2.5 g/kg. We'll use 2.2 as a baseline.
     */
    calculateProtein(bodyWeightKg, goals) {
        let multiplier = 2.2; // g/kg
        if (goals === 'performance') {
            multiplier = 2.5;
        }
        return Math.round(bodyWeightKg * multiplier);
    },

    /**
     * Calculates fat based on body weight.
     * Fuelin recommends 0.9-1.2 g/kg. We'll use 1.0 as a baseline.
     */
    calculateFat(bodyWeightKg, goals) {
        let multiplier = 1.0; // g/kg
        if (goals === 'weight-loss') {
            multiplier = 0.9;
        }
        return Math.round(bodyWeightKg * multiplier);
    },

    /**
     * Calculates carbohydrates using the "Traffic Light" system.
     * Red (Rest/Low), Yellow (Moderate), Green (High-Intensity).
     */
    calculateCarbohydrates(bodyWeightKg, workoutType, duration, goals, isCarboLoading) {
        let carbMultiplier; // This will be our g/kg multiplier

        // Determine the "color" for the day based on workout type
        switch (workoutType) {
            case 'none': // RED DAY
                carbMultiplier = 2.5;
                break;
            case 'easy':
            case 'strength': // YELLOW DAY
                carbMultiplier = 3.5;
                break;
            case 'endurance': // YELLOW/GREEN DAY
                carbMultiplier = 4.5;
                break;
            case 'tempo':
            case 'threshold': // GREEN DAY
                carbMultiplier = 6.0;
                break;
            case 'intervals': // HIGH GREEN DAY
                carbMultiplier = 7.0;
                break;
            default:
                carbMultiplier = 3.0;
        }

        // Adjust for duration on longer workouts
        if (duration > 90) {
            carbMultiplier += 1.0;
        }
        if (duration > 150) {
            carbMultiplier += 1.5;
        }

        // Adjust for goals
        if (goals === 'performance') {
            carbMultiplier += 1.0;
        }
        if (goals === 'weight-loss') {
            carbMultiplier = Math.max(2.0, carbMultiplier - 1.0);
        }

        // Apply carb-loading multiplier if applicable
        if (isCarboLoading) {
            carbMultiplier *= 1.75;
            console.log("Applying carb loading. New carb multiplier:", carbMultiplier);
        }

        return Math.round(bodyWeightKg * carbMultiplier);
    },

    /**
     * Calculates in-workout fueling based on duration and intensity.
     */
    calculateWorkoutFueling(workoutType, duration) {
        let duringWorkoutCarbs = 0; // g/hr
        let fuelingTips = [];

        if (workoutType === 'none' || duration < 60) {
            fuelingTips.push('No in-session fueling required for workouts under 60 minutes.');
        } else if (duration >= 60 && duration <= 90) {
            duringWorkoutCarbs = 40;
            fuelingTips.push('Start fueling within the first 15 minutes.');
            fuelingTips.push('Aim for 40-70g of carbs per hour.');
        } else { // 90+ minutes
            if (['tempo', 'threshold', 'intervals'].includes(workoutType)) {
                duringWorkoutCarbs = 80;
                fuelingTips.push('Aim for 60-90g of carbs per hour. Use multiple transportable carbs (glucose:fructose).');
            } else {
                duringWorkoutCarbs = 60;
                fuelingTips.push('Aim for 40-70g of carbs per hour.');
            }
            fuelingTips.push('Start fueling within the first 10-15 minutes.');
            fuelingTips.push('Take smaller doses frequently to avoid GI distress.');
        }

        return {
            preWorkoutCarbs: 'Varies',
            duringWorkoutCarbs: duringWorkoutCarbs,
            postWorkoutCarbs: 'Varies',
            fluidIntake: 500,
            fuelingTips
        };
    },

    /**
     * Updates the UI with the calculated nutrition plan.
     */
    updateNutritionDisplay(calories, protein, carbs, fat, fueling) {
        document.getElementById('totalCalories').textContent = Math.round(calories);
        document.getElementById('totalProtein').textContent = protein + 'g';
        document.getElementById('totalCarbs').textContent = carbs + 'g';
        document.getElementById('totalFat').textContent = fat + 'g';
        document.getElementById('preWorkout').textContent = fueling.preWorkoutCarbs;
        document.getElementById('duringWorkout').textContent = fueling.duringWorkoutCarbs + 'g';
        document.getElementById('postWorkout').textContent = fueling.postWorkoutCarbs;
        document.getElementById('fluidIntake').textContent = fueling.fluidIntake + 'ml';
        const tipsList = document.getElementById('fuelingTips');
        tipsList.innerHTML = '';
        fueling.fuelingTips.forEach(tip => {
            const li = document.createElement('li');
            li.textContent = tip;
            tipsList.appendChild(li);
        });
        const workoutType = document.getElementById('workoutType').value;
        const fuelingCard = document.getElementById('fuelingCard');
        fuelingCard.style.display = workoutType === 'none' ? 'none' : 'block';
        document.getElementById('results').style.display = 'block';
    }
};
