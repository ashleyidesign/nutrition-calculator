// Nutrition Calculation Module - V3 with specific g/kg targets
const nutritionCalculator = {
    /**
     * Main calculation function.
     * This function now primarily acts as a wrapper for the new calculateMacros function.
     */
    calculate(bodyWeightLbs = null, goals = null, workoutType = null, duration = null, isRaceDay = false, isPostRace = false, isCarboLoading = false) {
        const bw = bodyWeightLbs !== null ? bodyWeightLbs : parseInt(document.getElementById('bodyWeight').value);
        const currentGoals = goals !== null ? goals : document.getElementById('goals').value;
        const wt = workoutType !== null ? workoutType : document.getElementById('workoutType').value;
        const dur = duration !== null ? duration : parseInt(document.getElementById('duration').value);
        
        const bodyWeightKg = bw * 0.453592;

        console.log(`Calculating (V3): ${bw}lbs, Goal: ${currentGoals}, Type: ${wt}, Dur: ${dur}min, Race: ${isRaceDay}, PostRace: ${isPostRace}, CarbLoad: ${isCarboLoading}`);

        const macros = this.calculateMacros(bodyWeightKg, wt, dur, isRaceDay, isPostRace, isCarboLoading, currentGoals);

        const dailyCalories = (macros.protein * 4) + (macros.carbs * 4) + (macros.fat * 9);

        const fueling = this.calculateWorkoutFueling(wt, dur, isRaceDay);

        if (document.getElementById('totalCalories')) {
            this.updateNutritionDisplay(dailyCalories, macros.protein, macros.carbs, macros.fat, fueling);
        }

        return {
            calories: Math.round(dailyCalories),
            ...macros,
            fueling: fueling
        };
    },

    /**
     * NEW CORE LOGIC: Calculates macros based on specific g/kg targets from your screenshots.
     */
    calculateMacros(bodyWeightKg, workoutType, duration, isRaceDay, isPostRace, isCarboLoading, goals) {
        let p_mult = 1.8, f_mult = 1.0, c_mult = 3.0; // Default multipliers

        if (isRaceDay) {
            // Targets from Jul 12 screenshot
            p_mult = 2.2; 
            f_mult = 1.7;
            c_mult = 8.6;
        } else if (isPostRace) {
            // Targets from Jul 13 screenshot
            p_mult = 1.7;
            f_mult = 1.0;
            c_mult = 5.2;
        } else if (isCarboLoading) {
            // Targets from Jul 11 screenshot
            p_mult = 1.7;
            f_mult = 1.0;
            c_mult = 8.2;
        } else {
            // Non-event day logic based on workout type
            switch (workoutType) {
                case 'none': // True Rest Day
                case 'easy': // Low Volume day like Jul 8
                    p_mult = 1.7;
                    f_mult = 1.0;
                    c_mult = 2.4;
                    break;
                case 'endurance': // Like Jul 9
                    p_mult = 1.8;
                    f_mult = 1.1;
                    c_mult = 4.3 + (duration > 120 ? 1.0 : 0); // Add carbs for longer duration
                    break;
                case 'tempo':
                case 'threshold':
                case 'intervals': // High intensity/volume like Jul 10
                     p_mult = 1.7;
                     f_mult = 1.0;
                     c_mult = 6.4;
                     break;
                default:
                    p_mult = 1.7;
                    f_mult = 1.0;
                    c_mult = 2.5;
            }
        }
        
        // Adjust for goals (only for non-event days)
        if (!isRaceDay && !isPostRace && !isCarboLoading && goals === 'weight-loss') {
            f_mult = Math.max(0.8, f_mult - 0.2);
            c_mult = Math.max(2.0, c_mult - 0.5);
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
            // Your app isn't giving you race fueling, so we will!
            duringWorkoutCarbs = 90;
            fuelingTips.push('RACE FUEL: Aim for 90-120g carbs/hr. This is your primary goal.');
            fuelingTips.push('Use a mix of gels, drinks, and solids if tolerated.');
            fuelingTips.push('Practice this fueling strategy in training!');
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
