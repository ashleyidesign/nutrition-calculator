// Nutrition Calculation Module - Updated with Fuelin's Methodology
const nutritionCalculator = {
    /**
     * Main calculation function.
     * Determines the "traffic light" color for the day and calculates macros accordingly.
     */
    calculate(bodyWeightLbs = null, goals = null, workoutType = null, duration = null, isCarboLoading = false) {
        // Get values from form if not provided, converting to the correct types
        bodyWeightLbs = bodyWeightLbs || parseInt(document.getElementById('bodyWeight').value);
        const bodyWeightKg = bodyWeightLbs * 0.453592;
        
        goals = goals || document.getElementById('goals').value;
        workoutType = workoutType || document.getElementById('workoutType').value;
        duration = duration || parseInt(document.getElementById('duration').value);

        console.log(`Calculating (Fuelin Method): ${bodyWeightLbs}lbs (${bodyWeightKg.toFixed(2)}kg), Goal: ${goals}, Workout: ${workoutType}, Duration: ${duration}min, Carb Loading: ${isCarboLoading}`);

        // 1. Set Protein and Fat based on Fuelin's core recommendations
        const dailyProtein = this.calculateProtein(bodyWeightKg, goals);
        const dailyFat = this.calculateFat(bodyWeightKg, goals);

        // 2. Determine daily carbs using the "Traffic Light" system
        const dailyCarbs = this.calculateCarbohydrates(bodyWeightKg, workoutType, duration, goals, isCarboLoading);

        // 3. Calculate total calories from macros
        const dailyCalories = (dailyProtein * 4) + (dailyCarbs * 4) + (dailyFat * 9);

        console.log(`Results: ${dailyCalories} cal, ${dailyProtein}p, ${dailyCarbs}c, ${dailyFat}f`);

        // 4. Calculate workout-specific fueling
        const fueling = this.calculateWorkoutFueling(workoutType, duration);

        // 5. Update the UI
        this.updateNutritionDisplay(dailyCalories, dailyProtein, dailyCarbs, dailyFat, fueling);

        return {
            calories: dailyCalories,
            protein: dailyProtein,
            carbs: dailyCarbs,
            fat: dailyFat,
            fueling: fueling
        };
    },

    /**
     * Calculates protein based on body weight.
     * Fuelin recommends 2.0-2.5 g/kg. We'll use 2.2 as a baseline.
     * [cite: 15]
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
     * [cite: 16]
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
     * 
     */
    calculateCarbohydrates(bodyWeightKg, workoutType, duration, goals, isCarboLoading) {
        let carbMultiplier; // This will be our g/kg multiplier

        // Determine the "color" for the day based on workout type
        switch (workoutType) {
            case 'none': // RED DAY
                carbMultiplier = 2.5; // Increased from previous version for better rest day fueling
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
            carbMultiplier = Math.max(2.0, carbMultiplier - 1.0); // Ensure a minimum for weight loss goals
        }

        // Apply carb-loading multiplier if applicable
        // This makes the existing calendar logic more effective
        if (isCarboLoading) {
            carbMultiplier *= 1.75; // Using a more aggressive multiplier
            console.log("Applying carb loading. New carb multiplier:", carbMultiplier);
        }

        return Math.round(bodyWeightKg * carbMultiplier);
    },

    /**
     * Calculates in-workout fueling based on duration and intensity.
     * Based on Fuelin's duration-based protocols.
     * [cite: 31, 36, 37]
     */
    calculateWorkoutFueling(workoutType, duration) {
        let duringWorkoutCarbs = 0; // g/hr
        let fuelingTips = [];

        if (workoutType === 'none' || duration < 60) {
            // No fueling required for sessions under 60 mins
            // [cite: 32]
            fuelingTips.push('No in-session fueling required for workouts under 60 minutes.');
        } else if (duration >= 60 && duration <= 90) {
            // Moderate sessions: 40-70g per hour
            // [cite: 33, 36]
            duringWorkoutCarbs = 40;
            fuelingTips.push('Start fueling within the first 15 minutes.');
            fuelingTips.push('Aim for 40-70g of carbs per hour.');
        } else { // 90+ minutes
            // High-intensity/long sessions: 60-90g per hour
            // [cite: 34, 37]
            if (['tempo', 'threshold', 'intervals'].includes(workoutType)) {
                duringWorkoutCarbs = 80;
                fuelingTips.push('Aim for 60-90g of carbs per hour. Use multiple transportable carbs (glucose:fructose).');
            } else {
                duringWorkoutCarbs = 60;
                fuelingTips.push('Aim for 40-70g of carbs per hour.');
            }
            fuelingTips.push('Start fueling within the first 10-15 minutes.');
            fuelingTips.push('Take smaller doses frequently to avoid GI distress.'); // [cite: 41]
        }

        return {
            preWorkoutCarbs: 'Varies', // Fuelin focuses more on daily total
            duringWorkoutCarbs: duringWorkoutCarbs,
            postWorkoutCarbs: 'Varies', // Focus on a mixed meal within 2 hours
            fluidIntake: 500, // General recommendation
            fuelingTips
        };
    },

    /**
     * Updates the UI with the calculated nutrition plan.
     */
    updateNutritionDisplay(calories, protein, carbs, fat, fueling) {
        // Update daily macros
        document.getElementById('totalCalories').textContent = Math.round(calories);
        document.getElementById('totalProtein').textContent = protein + 'g';
        document.getElementById('totalCarbs').textContent = carbs + 'g';
        document.getElementById('totalFat').textContent = fat + 'g';

        // Update workout fueling
        document.getElementById('preWorkout').textContent = fueling.preWorkoutCarbs;
        document.getElementById('duringWorkout').textContent = fueling.duringWorkoutCarbs + 'g';
        document.getElementById('postWorkout').textContent = fueling.postWorkoutCarbs;
        document.getElementById('fluidIntake').textContent = fueling.fluidIntake + 'ml';

        // Update fueling tips
        const tipsList = document.getElementById('fuelingTips');
        tipsList.innerHTML = '';
        fueling.fuelingTips.forEach(tip => {
            const li = document.createElement('li');
li.textContent = tip;
tipsList.appendChild(li);
        });

        // Show/hide fueling card
        const workoutType = document.getElementById('workoutType').value;
        const fuelingCard = document.getElementById('fuelingCard');
        fuelingCard.style.display = workoutType === 'none' ? 'none' : 'block';

        // Show results
        document.getElementById('results').style.display = 'block';
    }
};
