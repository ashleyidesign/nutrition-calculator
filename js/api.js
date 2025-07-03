// Intervals.icu API Module
const intervalsAPI = {
    // Load workouts for a specific date
    async loadWorkouts(apiKey, athleteId, date) {
        console.log('🔥 API: Loading workouts for', date);
        
        const response = await fetch('/api/intervals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                athleteId: athleteId,
                apiKey: apiKey,
                date: date
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        
        return data.events || [];
    },
    
    // Load workouts for multiple dates (for calendar view)
    async loadWorkoutsForDateRange(apiKey, athleteId, startDate, endDate) {
        console.log('🔥 API: Loading workouts for range', startDate, 'to', endDate);
        
        const response = await fetch('/api/intervals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                athleteId: athleteId,
                apiKey: apiKey,
                oldest: startDate,
                newest: endDate
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API range response:', data);
        
        return data.events || [];
    },
    
    // Default athlete ID and API key
    getDefaults() {
        return {
            athleteId: 'i290140',
            apiKey: document.getElementById('apiKey')?.value || '5b7vz3ozlxd42dqx0udbrq7e2'
        };
    }
};
