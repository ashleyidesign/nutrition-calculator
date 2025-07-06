// Create workout visualization chart
    createWorkoutChart(workout) {
        // Check if we have detailed interval data
        if (!workout.intervals || !workout.intervals.intervals || workout.intervals.intervals.length === 0) {
            // Fallback for workouts without detailed structure
            return this.createSimpleWorkoutChart(workout);
        }
        
        const intervals = workout.intervals.intervals;
        const totalDuration = workout.intervals.totalDuration; // in seconds
        const zoneTimes = workout.intervals.zoneTimes || [];
        
        console.log('🎯 Creating detailed workout chart:', {
            name: workout.name,
            intervalCount: intervals.length,
            totalDuration: Math.round(totalDuration / 60) + ' min',
            intervals: intervals.map(i => `${i.durationMinutes}min ${i.intensity}`)
        });
        
        // Generate workout timeline bars
        const timelineBars = intervals.map((interval, index) => {
            const widthPercent = (interval.duration / totalDuration) * 100;
            const durationMin = interval.durationMinutes;
            
            // Get color based on intensity
            const barColor = this.getIntensityColor(interval.intensity);
            
            // Format target value display
            let targetDisplay = '';
            if (interval.targetValue && interval.targetType) {
                if (interval.targetType === 'power') {
                    targetDisplay = `${interval.targetValue}W`;
                } else if (interval.targetType === 'hr_percent') {
                    targetDisplay = `${interval.targetValue}%`;
                }
            }
            
            return `
                <div class="workout-segment" 
                     style="width: ${widthPercent}%; background-color: ${barColor};" 
                     title="${durationMin}min - ${interval.intensity} ${targetDisplay}">
                    <div class="segment-duration">${durationMin}'</div>
                    <div class="segment-intensity">${targetDisplay || interval.intensity.toUpperCase()}</div>
                </div>
            `;
        }).join('');
        
        // Generate zone breakdown
        const zoneBreakdown = zoneTimes
            .filter(zone => zone.secs > 30) // Only show zones with >30 seconds
            .map(zone => {
                const minutes = Math.round(zone.secs / 60);
                const color = this.getZoneColor(zone.id);
                return `
                    <div class="zone-time" style="background-color: ${color}">
                        <span class="zone-label">${zone.id}</span>
                        <span class="zone-duration">${minutes}min</span>
                    </div>
                `;
            }).join('');
        
        // Calculate workout statistics
        const stats = this.calculateWorkoutStats(intervals);
        
        return `
            <div class="workout-chart">
                <h5>📊 Workout Structure</h5>
                
                <div class="workout-timeline">
                    ${timelineBars}
                </div>
                
                <div class="workout-summary">
                    <div class="workout-stats">
                        <div class="total-duration">
                            <strong>Total: ${Math.round(totalDuration / 60)} minutes</strong>
                        </div>
                        <div class="interval-count">
                            ${intervals.length} intervals • ${stats.workIntervalsCount} work + ${stats.restIntervalsCount} recovery
                        </div>
                    </div>
                    
                    ${zoneBreakdown ? `
                        <div class="zone-breakdown">
                            <div class="zone-label-header">Time in Zones:</div>
                            <div class="zone-times">
                                ${zoneBreakdown}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                ${workout.description ? `
                    <div class="workout-description-chart">
                        <h6>Workout Notes:</h6>
                        <div class="workout-notes">${workout.description}</div>
                    </div>
                ` : ''}
                
                <div class="interval-details">
                    <h6>Interval Breakdown:</h6>
                    <div class="interval-list">
                        ${intervals.map((interval, index) => `
                            <div class="interval-item">
                                <span class="interval-number">${index + 1}.</span>
                                <span class="interval-duration">${interval.durationMinutes}min</span>
                                <span class="interval-intensity" style="color: ${this.getIntensityColor(interval.intensity)}">${interval.intensity}</span>
                                ${interval.targetValue ? `<span class="interval-target">${interval.targetValue}${interval.targetType === 'power' ? 'W' : '%'}</span>` : ''}
                                ${interval.description ? `<span class="interval-note">${interval.description}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // Fallback for workouts without detailed interval structure
    createSimpleWorkoutChart(workout) {
        if (!workout.workout_doc || !workout.workout_doc.steps) {
            return `
                <div class="workout-chart">
                    <h5>📊 Workout Overview</h5>
                    <div class="simple-workout-info">
                        <div class="workout-type">${workout.type || 'Workout'}</div>
                        <div class="workout-duration">${Math.round((workout.moving_time || workout.duration || 0) / 60)} minutes</div>
                        ${workout.description ? `<div class="workout-description">${workout.description}</div>` : ''}
                    </div>
                </div>
            `;
        }
        
        // Legacy parsing for older workout doc format
        const steps = workout.workout_doc.steps;
        const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);
        
        const timelineBars = steps.map((step, index) => {
            const widthPercent = (step.duration / totalDuration) * 100;
            const durationMin = Math.round(step.duration / 60);
            
            let intensity = 'moderate';
            let targetText = '';
            let barColor = '#ccc';
            
            if (step.power) {
                const avgPower = (step.power.start + step.power.end) / 2;
                targetText = `${Math.round(avgPower)}W`;
                barColor = this.getPowerZoneColor(avgPower);
                
                if (avgPower < 120) intensity = 'recovery';
                else if (avgPower < 160) intensity = 'endurance';
                else if (avgPower < 200) intensity = 'tempo';
                else if (avgPower < 250) intensity = 'threshold';
                else intensity = 'vo2max';
                
            } else if (step.hr) {
                const avgHR = (step.hr.start + step.hr.end) / 2;
                targetText = `${Math.round(avgHR)}%`;
                barColor = this.getHRZoneColor(avgHR);
            }
            
            return `
                <div class="workout-segment" 
                     style="width: ${widthPercent}%; background-color: ${barColor};" 
                     title="${durationMin}min - ${targetText}">
                    <div class="segment-duration">${durationMin}'</div>
                    <div class="segment-intensity">${targetText}</div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="workout-chart">
                <h5>📊 Workout Structure</h5>
                <div class="workout-timeline">
                    ${timelineBars}
                </div>
                <div class="workout-summary">
                    <div class="total-duration">
                        <strong>Total: ${Math.round(totalDuration / 60)} minutes</strong>
                    </div>
                </div>
                ${workout.description ? `
                    <div class="workout-description-chart">
                        <h6>Workout Notes:</h6>
                        <div class="workout-notes">${workout.description}</div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Calculate workout statistics from intervals
    calculateWorkoutStats(intervals) {
        let workIntervalsCount = 0;
        let restIntervalsCount = 0;
        
        intervals.forEach(interval => {
            if (interval.intensity === 'recovery') {
                restIntervalsCount++;
            } else {
                workIntervalsCount++;
            }
        });
        
        return {
            workIntervalsCount,
            restIntervalsCount
        };
    },

    // Get color based on training intensity
    getIntensityColor(intensity) {
        const colors = {
            'recovery': '#4CAF50',      // Green
            'endurance': '#8BC34A',     // Light Green
            'tempo': '#FFEB3B',         // Yellow
            'threshold': '#FF9800',     // Orange
            'vo2max': '#F44336',        // Red
            'moderate': '#9E9E9E'       // Gray (fallback)
        };
        return colors[intensity] || colors['moderate'];
    },