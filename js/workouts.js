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
                document.getElementById('workoutType').value = 'none';
                document.getElementById('duration').value = 0;
                document.getElementById('manualSection').style.display = 'none';
                document.querySelector('button.secondary').textContent = 'Show Manual Override';
                
                // Calculate rest day nutrition
                nutritionCalculator.calculate();
                return;
            }
            
            console.log('🎯 PROCESSING WORKOUTS 🎯');
            
            // Take up to 3 workouts and check for races
            const workouts = activities.slice(0, 3);
            let hasRace = false;
            
            // Check if any workout is a race
            workouts.forEach(workout => {
                const name = (workout.name || '').toLowerCase();
                if (name.includes('race') || name.includes('triathlon') || name.includes('marathon')) {
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
        const raceOverride = document.getElementById('raceOverride');
        const raceWorkoutsDiv = document.getElementById('raceWorkouts');
        
        raceWorkoutsDiv.innerHTML = '';
        
        workouts.forEach((workout, index) => {
            const name = (workout.name || '').toLowerCase();
            const isRace = name.includes('race') || name.includes('triathlon') || name.includes('marathon');
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
                            <option
