// UI Management Module
const ui = {
    showStatus(message, type) {
        const statusDiv = document.getElementById('workoutStatus');
        statusDiv.style.display = 'block';
        statusDiv.textContent = message;
        
        const colors = {
            'loading': '#007bff',
            'success': '#28a745',
            'warning': '#ffc107',
            'error': '#dc3545'
        };
        
        statusDiv.style.backgroundColor = colors[type] || '#6c757d';
        statusDiv.style.color = 'white';
        statusDiv.style.padding = '10px';
        statusDiv.style.borderRadius = '5px';
        statusDiv.style.marginTop = '15px';
    },
    
    toggleManualEntry() {
        const manualSection = document.getElementById('manualSection');
        const button = event.target;
        const isVisible = manualSection.style.display !== 'none';
        
        manualSection.style.display = isVisible ? 'none' : 'block';
        button.textContent = isVisible ? 'Manual Entry' : 'Hide Manual Entry';
    },
    
    hideRaceOverride() {
        document.getElementById('raceOverride').style.display = 'none';
    },
    
    showRaceOverride() {
        const raceOverride = document.getElementById('raceOverride');
        raceOverride.style.display = 'block';
        raceOverride.scrollIntoView({ behavior: 'smooth' });
    },
    
    hideManualSection() {
        document.getElementById('manualSection').style.display = 'none';
        const button = document.querySelector('button.secondary');
        if (button) {
            button.textContent = 'Show Manual Override';
        }
    },
    
    showResults() {
        document.getElementById('results').style.display = 'block';
        document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    },
    
    setFormValues(workoutType, duration) {
        document.getElementById('workoutType').value = workoutType;
        document.getElementById('duration').value = duration;
    },
    
    setTodaysDate() {
        document.getElementById('workoutDate').valueAsDate = new Date();
    }
};
