// Nutrition Calculation Module
const nutritionCalculator = {
    calculate(bodyWeight = null, goals = null, workoutType = null, duration = null) {
        // Get values from form if not provided
        bodyWeight = bodyWeight || parseInt(document.getElementById('bodyWeight').value);
        goals = goals || document.getElementById('goals').value;
        workoutType = workoutType || document.getElementById('workoutType').value;
        duration = duration || parseInt(document.getElementById('duration').value);
        
        console.log(`Calculating: ${bodyWeight}lbs, ${goals}, ${workoutType}, ${duration}min`);
        
        let dailyCalories, dailyProtein, dailyFat, dailyCarbs;
        
        if (goals === 'weight-loss') {
            const macros = this.calculateWeightLossMacros(bodyWeight, workoutType, duration);
            dailyCalories = macros.calories;
            dailyProtein = macros.protein;
            dailyFat = macros.fat;
            dailyCarbs = macros.carbs;
            
        } else if (goals === 'maintenance') {
            const macros = this.calculateMaintenanceMacros(bodyWeight, workoutType, duration);
            dailyCalories = macros.calories;
            dailyProtein = macros.protein;
            dailyFat = macros.fat;
            dailyCarbs = macros.carbs;
            
        } else { // performance
            const macros = this.calculatePerformanceMacros(bodyWeight, workoutType, duration);
            dailyCalories = macros.calories;
            dailyProtein = macros.protein;
            dailyFat = macros.fat;
            dailyCarbs = macros.carbs;
        }
        
        console.log(`Results: ${dailyCalories} cal, ${dailyProtein}p, ${dailyCarbs}c, ${dailyFat}f`);
        
        // Calculate workout fueling
        const fueling = this.calculateWorkoutFueling(bodyWeight, workoutType, duration);
        
        // Update UI
        this.updateNutritionDisplay(dailyCalories, dailyProtein, dailyCarbs, dailyFat, fueling);
        
        return {
            calories: dailyCalories,
            protein: dailyProtein,
            carbs: dailyCarbs,
            fat: dailyFat,
            fueling: fueling
        };
    },
    
    calculateWeightLossMacros(bodyWeight, workoutType, duration) {
        // Check if this is a race day (high duration suggests race)
        const isRaceDay = duration > 180; // 3+ hours suggests race
        
        if (isRaceDay) {
            console.log('🏁 RACE DAY NUTRITION CALCULATION 🏁');
            
            // Race-specific macro calculations based on duration
            if (duration >= 240) { // 4+ hours = ultra-endurance
                return {
                    protein: Math.round(bodyWeight * 0.94), // ~180g at 192lbs
                    fat: Math.round(bodyWeight * 0.78), // ~150g at 192lbs  
                    carbs: Math.round(bodyWeight * 3.9), // ~745g at 192lbs
                    calories: 0 // Will be calculated below
                };
            } else { // 3-4 hours = long race
                return {
                    protein: Math.round(bodyWeight * 0.86), // ~165g at 192lbs
                    fat: Math.round(bodyWeight * 0.65), // ~125g at 192lbs
                    carbs: Math.round(bodyWeight * 3.0), // ~575g at 192lbs
                    calories: 0
                };
            }
        } else {
            // Regular training day calculations
            const protein = Math.round(bodyWeight * 0.78); // ~150g at 192lbs
            const fat = Math.round(bodyWeight * 0.41); // ~79g at 192lbs
            
            let carbs;
            if (workoutType === 'none') {
                carbs = Math.round(bodyWeight * 0.885); // Rest day ~170g at 192lbs
            } else {
                // Base carbs by intensity level
                const intensityMultipliers = {
                    'easy': 1.0,      // Easy recovery
                    'endurance': 1.1, // Zone 2 (~211g at 192lbs)
                    'tempo': 1.6,     // Zone 3 (~307g at 192lbs)
                    'threshold': 1.7, // Zone 4
                    'intervals': 1.8, // Zone 5
                    'strength': 1.2   // Strength training
                };
                
                const baseCarbs = bodyWeight * intensityMultipliers[workoutType];
                
                // Adjust for duration
                let durationAdjustment = 1.0;
                if (duration > 120) durationAdjustment = 1.1;      // +10% for 2+ hours
                else if (duration > 90) durationAdjustment = 1.05; // +5% for 90+ min
                
                carbs = Math.round(baseCarbs * durationAdjustment);
            }
            
            return { protein, fat, carbs, calories: 0 };
        }
    },
    
    calculateMaintenanceMacros(bodyWeight, workoutType, duration) {
        const bodyWeightKg = bodyWeight * 0.453592;
        return {
            protein: Math.round(bodyWeightKg * 1.6),
            fat: Math.round(bodyWeight * 0.5),
            carbs: Math.round(bodyWeight * 1.8),
            calories: 0
        };
    },
    
    calculatePerformanceMacros(bodyWeight, workoutType, duration) {
        const bodyWeightKg = bodyWeight * 0.453592;
        return {
            protein: Math.round(bodyWeightKg * 1.4),
            fat: Math.round(bodyWeight * 0.6),
            carbs: Math.round(bodyWeight * 2.0),
            calories: 0
        };
    },
    
    calculateWorkoutFueling(bodyWeight, workoutType, duration) {
        const bodyWeightKg = bodyWeight * 0.453592;
        let preWorkoutCarbs = 0;
        let duringWorkoutCarbs = 0;
        let postWorkoutCarbs = 0;
        let fluidIntake = 0;
        let fuelingTips = [];
        
        if (workoutType === 'none') {
            fuelingTips.push('Rest day - focus on recovery nutrition');
        } else if (duration < 60) {
            preWorkoutCarbs = Math.round(bodyWeightKg * 0.5);
            fluidIntake = 400;
            postWorkoutCarbs = Math.round(bodyWeightKg * 0.8);
            fuelingTips.push('Pre: 1-2 hours before workout');
            fuelingTips.push('Post: Within 30 minutes after workout');
        } else {
            preWorkoutCarbs = Math.round(bodyWeightKg * 0.7);
            duringWorkoutCarbs = duration < 120 ? 25 : 35;
            postWorkoutCarbs = Math.round(bodyWeightKg * 1.0);
            fluidIntake = 500;
            fuelingTips.push('Pre: 1-2 hours before workout');
            fuelingTips.push('During: Start fueling after 60 minutes');
            fuelingTips.push('Post: Within 30 minutes');
        }
        
        return {
            preWorkoutCarbs,
            duringWorkoutCarbs,
            postWorkoutCarbs,
            fluidIntake,
            fuelingTips
        };
    },
    
    updateNutritionDisplay(calories, protein, carbs, fat, fueling) {
        // Calculate total calories from macros if not provided
        if (calories === 0) {
            calories = (protein * 4) + (fat * 9) + (carbs * 4);
        }
        
        // Update daily macros
        document.getElementById('totalCalories').textContent = calories;
        document.getElementById('totalProtein').textContent = protein + 'g';
        document.getElementById('totalCarbs').textContent = carbs + 'g';
        document.getElementById('totalFat').textContent = fat + 'g';
        
        // Update workout fueling
        document.getElementById('preWorkout').textContent = fueling.preWorkoutCarbs + 'g';
        document.getElementById('duringWorkout').textContent = fueling.duringWorkoutCarbs + 'g';
        document.getElementById('postWorkout').textContent = fueling.postWorkoutCarbs + 'g';
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
        document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    }
};
