const nutritionCalculator = {
    calculate(bodyWeightLbs = null, goals = null, workoutType = null, duration = null, isRaceDay = false, isPostRace = false, isCarboLoading = false) {
        const bw = bodyWeightLbs !== null ? bodyWeightLbs : parseInt(document.getElementById('bodyWeight').value);
        const currentGoals = goals !== null ? goals : document.getElementById('goals').value;
        const wt = workoutType !== null ? workoutType : document.getElementById('workoutType').value;
        const dur = duration !== null ? duration : parseInt(document.getElementById('duration').value);
        
        const bodyWeightKg = bw * 0.453592;

        const macros = this.calculateMacros(bodyWeightKg, wt, dur, isRaceDay, isPostRace, isCarboLoading, currentGoals);
        const dailyCalories = (macros.protein * 4) + (macros.carbs * 4) + (macros.fat * 9);
        const fueling = this.calculateWorkoutFueling(wt, dur, isRaceDay);

        return {
            calories: Math.round(dailyCalories),
            ...macros,
            fueling: fueling
        };
    },

    calculateMacros(bodyWeightKg, workoutType, duration, isRaceDay, isPostRace, isCarboLoading, goals) {
        let p_mult, f_mult, c_mult;

        if (isRaceDay) {
            p_mult = 2.2; f_mult = 1.7; c_mult = 8.6;
        } else if (isPostRace) {
            p_mult = 1.7; f_mult = 1.0; c_mult = 5.2;
        } else if (isCarboLoading) {
            p_mult = 1.7; f_mult = 1.0; c_mult = 8.2;
        } else {
            switch (workoutType) {
                case 'none':
                case 'easy':
                    p_mult = 1.72; f_mult = 0.92; c_mult = 1.95;
                    break;
                case 'endurance':
                    p_mult = 1.8; f_mult = 1.1; c_mult = 4.3 + (duration > 120 ? 1.0 : 0);
                    break;
                case 'tempo':
                case 'threshold':
                case 'intervals':
                     p_mult = 1.7; f_mult = 1.0; c_mult = 6.4;
                     break;
                default:
                    p_mult = 1.7; f_mult = 1.0; c_mult = 2.5;
            }
        }
        
        // *** FIX: Apply weight loss deficit ONLY to training days, not rest days ***
        if (goals === 'weight-loss' && !isRaceDay && !isPostRace && !isCarboLoading) {
            if (workoutType !== 'none' && workoutType !== 'easy') {
                f_mult = Math.max(0.8, f_mult - 0.2);
                c_mult = Math.max(2.0, c_mult - 1.0);
            }
        } else if (goals === 'maintenance' && (workoutType === 'none' || workoutType === 'easy')) {
             // For maintenance, use the ~2000 calorie targets on rest days
            p_mult = 1.72; f_mult = 0.92; c_mult = 1.95;
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
    }
};
