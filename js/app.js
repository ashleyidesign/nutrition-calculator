// Main App Initialization and Event Handling
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Workout Nutrition Calculator v4.0 - Refactored!');
    
    // Set today's date by default
    ui.setTodaysDate();
    
    // Set default to rest day and calculate initial nutrition
    ui.setFormValues('none', 0);
    nutritionCalculator.calculate();
    
    // Add event listeners for auto-calculation when values change
    const fieldsToWatch = ['workoutType', 'duration', 'bodyWeight', 'goals'];
    
    fieldsToWatch.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                if (document.getElementById('results').style.display === 'block') {
                    nutritionCalculator.calculate();
                }
            });
        }
    });
    
    console.log('✅ App initialized successfully');
});

// Global function to ensure backward compatibility
// (in case any inline onclick handlers need these)
window.loadWorkoutData = () => workoutManager.loadWorkoutData();
window.toggleManualEntry = () => ui.toggleManualEntry();
window.calculateNutrition = () => nutritionCalculator.calculate();
window.applyRaceOverride = () => workoutManager.applyRaceOverride();
window.cancelRaceOverride = () => workoutManager.cancelRaceOverride();
