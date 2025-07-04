// Workout Processing Module
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
