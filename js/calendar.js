const calendarManager = {
    currentDate: new Date(),
    events: [],
    bodyWeight: 192,
    goals: 'performance',

    workoutMapper: {
        map(workout) {
            const name = (workout.name || '').toLowerCase();
            const type = (workout.type || '').toLowerCase();
            if (name.includes('recovery') || name.includes('easy')) return 'easy';
            if (name.includes('tempo') || name.includes('zone 3')) return 'tempo';
            if (name.includes('threshold') || name.includes('zone 4')) return 'threshold';
            if (name.includes('interval') || name.includes('zone 5')) return 'intervals';
            if (name.includes('strength endurance') || name.includes('low cadence')) return 'intervals';
            if (name.includes('strength') || type.includes('strength')) return 'strength';
            return 'endurance';
        }
    },

    // Get workout type icon
    getWorkoutIcon(workout) {
        const type = (workout.type || '').toLowerCase();
        const name = (workout.name || '').toLowerCase();
        
        // Check activity type first
        if (type.includes('ride') || type.includes('bike') || type.includes('cycling')) return '🚴';
        if (type.includes('run') || type.includes('running')) return '🏃';
        if (type.includes('walk') || type.includes('walking')) return '🚶';
        if (type.includes('swim') || type.includes('swimming')) return '🏊';
        if (type.includes('strength') || type.includes('weight')) return '💪';
        if (type.includes('yoga') || type.includes('pilates')) return '🧘';
        if (type.includes('row') || type.includes('rowing')) return '🚣';
        
        // Check workout name for clues
        if (name.includes('bike') || name.includes('cycling') || name.includes('ride')) return '🚴';
        if (name.includes('run') || name.includes('running') || name.includes('jog')) return '🏃';
        if (name.includes('walk') || name.includes('walking') || name.includes('hike')) return '🚶';
        if (name.includes('swim') || name.includes('swimming')) return '🏊';
        if (name.includes('strength') || name.includes('weight') || name.includes('lift')) return '💪';
        if (name.includes('yoga') || name.includes('pilates') || name.includes('stretch')) return '🧘';
        if (name.includes('row') || name.includes('rowing') || name.includes('erg')) return '🚣';
        
        // Default workout icon
        return '🏋️';
    },
    
    init() {
        this.updateMonthYear();
        this.loadCalendarData(); 
        
        document.getElementById('goals')?.addEventListener('change', () => this.handleSettingsChange());
        document.getElementById('bodyWeight')?.addEventListener('change', () => this.handleSettingsChange());
        document.getElementById('apiKey')?.addEventListener('change', () => this.handleSettingsChange());

        document.querySelector('.day-detail-modal')?.addEventListener('click', (e) => this.handleModalClick(e));
        document.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
    },
    
    handleSettingsChange() {
        this.bodyWeight = parseInt(document.getElementById('bodyWeight').value);
        this.goals = document.getElementById('goals').value;
        if (this.events.length > 0) {
            this.renderCalendar();
        } else {
            this.loadCalendarData();
        }
    },

    async loadCalendarData() {
        const apiKey = document.getElementById('apiKey').value;
        this.bodyWeight = parseInt(document.getElementById('bodyWeight').value);
        this.goals = document.getElementById('goals').value;
        
        if (!apiKey) {
            document.getElementById('loadingState').innerHTML = `<h3>Please enter your Intervals.icu API Key</h3>`;
            return;
        }
        
        const loadingState = document.getElementById('loadingState');
        loadingState.innerHTML = '<h3>Loading your nutrition calendar with forward-looking periodization...</h3>';
        loadingState.style.display = 'block';
        
        try {
            const startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
            const endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 2, 0);
            
            const { athleteId } = intervalsAPI.getDefaults();
            
            // Load workouts with completion data
            this.events = await intervalsAPI.loadWorkoutsForDateRangeWithCompletion(
                apiKey, athleteId, this.formatDate(startDate), this.formatDate(endDate)
            );
            
            console.log(`Loaded ${this.events.length} events for calendar (with completion data)`);
            console.log('Today\'s events:', this.events.filter(e => e.start_date_local.startsWith(this.formatDate(new Date()))));
            
            loadingState.style.display = 'none';
            document.getElementById('legend').style.display = 'flex';
            document.getElementById('calendarHeader').style.display = 'flex';
            
            this.renderCalendar();
        } catch (error) {
            console.error('Calendar loading error:', error);
            loadingState.innerHTML = `<h3>Error loading calendar. Check your API key.</h3><p>${error.message}</p>`;
        }
    },
    
    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.updateMonthYear();
        
        const grid = document.getElementById('calendarGrid');
        // Updated header to start with Monday
        grid.innerHTML = `
            <div class="calendar-header-cell">Mon</div><div class="calendar-header-cell">Tue</div>
            <div class="calendar-header-cell">Wed</div><div class="calendar-header-cell">Thu</div>
            <div class="calendar-header-cell">Fri</div><div class="calendar-header-cell">Sat</div>
            <div class="calendar-header-cell">Sun</div>
        `;
        
        const mobileList = document.getElementById('mobileList');
        mobileList.innerHTML = '';
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        // Calculate starting day of week with Monday as 0
        let startingDayOfWeek = (firstDay.getDay() + 6) % 7;
        
        const allDays = [];
        
        // Add previous month days to fill the first week (if needed)
        if (startingDayOfWeek > 0) {
            const prevMonth = new Date(year, month, 0);
            for (let i = startingDayOfWeek - 1; i >= 0; i--) {
                const day = prevMonth.getDate() - i;
                const fullDate = new Date(year, month - 1, day);
                grid.appendChild(this.createDayElement(day, true, fullDate));
            }
        }
        
        // Add current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const fullDate = new Date(year, month, day);
            grid.appendChild(this.createDayElement(day, false, fullDate));
            allDays.push({ day, fullDate, isCurrentMonth: true });
        }
        
        // Add next month days to fill the last week
        const totalCells = startingDayOfWeek + daysInMonth;
        const cellsNeeded = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

        for (let day = 1; day <= cellsNeeded; day++) {
            const fullDate = new Date(year, month + 1, day);
            grid.appendChild(this.createDayElement(day, true, fullDate));
        }
        
        this.renderMobileList(allDays);
    },
    
    renderMobileList(allDays) {
        const mobileList = document.getElementById('mobileList');
        allDays.forEach(({ day, fullDate, isCurrentMonth }) => {
            if (!isCurrentMonth) return;
            
            const dayEvents = this.getEventsForDate(fullDate);
            const tomorrowWorkouts = this.getTomorrowWorkouts(fullDate);
            const { raceInfo, isCarboLoading, isPostRace } = this.analyzeDayType(fullDate);
            
            const listItem = document.createElement('div');
            listItem.className = 'day-list-item';
            
            const today = new Date();
            if (this.isSameDate(fullDate, today)) listItem.classList.add('today');
            if (raceInfo) listItem.classList.add('race-day');
            else if (isCarboLoading) listItem.classList.add('carb-loading');
            else if (isPostRace) listItem.classList.add('post-race'); 

            // Check for completed workouts
            const hasCompletedWorkouts = dayEvents.some(e => e.isCompleted);
            if (hasCompletedWorkouts) listItem.classList.add('completed-workout');

            const nutrition = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, fullDate, tomorrowWorkouts);
            
            // Add periodization indicator
            const periodizationClass = this.getPeriodizationClass(nutrition.periodizationNote);
            if (periodizationClass) listItem.classList.add(periodizationClass);
            
            listItem.innerHTML = `
                <div class="day-list-header">
                    <div class="day-list-date">${this.formatDateDisplay(fullDate)}</div>
                    <div>
                        ${raceInfo ? '🏁 Race' : isCarboLoading ? '🍝 Carb Load' : isPostRace ? '✅ Recovery' : ''}
                        ${hasCompletedWorkouts ? '📊 Completed' : ''}
                        ${tomorrowWorkouts.length > 0 && this.assessTomorrowIntensity(tomorrowWorkouts) === 'high' ? '🔥 Priming' : ''}
                    </div>
                </div>
                <div class="day-list-workouts">
                    ${dayEvents.map(e => `
                        <div>
                            ${this.getWorkoutIcon(e)} <strong>${e.name}</strong> (${Math.round((e.moving_time||0)/60)} min)
                            ${e.isCompleted ? '✅' : ''}
                            ${e.completionData && e.completionData.perceivedEffort ? ` RPE: ${e.completionData.perceivedEffort}` : ''}
                        </div>
                    `).join('') || 'Rest Day'}
                    ${tomorrowWorkouts.length > 0 ? `<div class="tomorrow-workouts"><em>Tomorrow: ${tomorrowWorkouts.map(w => `${this.getWorkoutIcon(w)} ${w.name || w.type}`).join(', ')}</em></div>` : ''}
                </div>
                <div class="day-list-nutrition">
                    <strong>${nutrition.calories}</strong> cal • <strong>${nutrition.carbs}g</strong> C • <strong>${nutrition.protein}g</strong> P
                    ${nutrition.adjustmentApplied ? ' 📊 Adjusted' : ''}
                </div>
            `;
            
            listItem.addEventListener('click', () => this.showDayDetails(fullDate, dayEvents, raceInfo, isCarboLoading, isPostRace, tomorrowWorkouts));
            mobileList.appendChild(listItem);
        });
    },
    
    createDayElement(day, isOtherMonth, fullDate) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        if (isOtherMonth) dayElement.classList.add('other-month');

        const today = new Date();
        if (this.isSameDate(fullDate, today)) dayElement.classList.add('today');
        
        const dayEvents = this.getEventsForDate(fullDate);
        const tomorrowWorkouts = this.getTomorrowWorkouts(fullDate);
        const { raceInfo, isCarboLoading, isPostRace } = this.analyzeDayType(fullDate);
        
        // Check for completed workouts
        const hasCompletedWorkouts = dayEvents.some(e => e.isCompleted);
        const hasAdjustments = dayEvents.some(e => e.isCompleted && e.completionData);
        
        if (raceInfo) dayElement.classList.add('race-day');
        else if (isCarboLoading) dayElement.classList.add('carb-loading');
        else if (isPostRace) dayElement.classList.add('post-race'); 
        
        if (hasCompletedWorkouts) dayElement.classList.add('completed-workout');
        
        // Forward-looking nutrition calculation
        const nutritionInfo = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, fullDate, tomorrowWorkouts);

        // Check if this is a priming day (day before hard workout)
        const isPrimingDay = tomorrowWorkouts.length > 0 && this.assessTomorrowIntensity(tomorrowWorkouts) === 'high';
        if (isPrimingDay && !raceInfo && !isCarboLoading && !isPostRace) {
            dayElement.classList.add('priming-day');
        }

        dayElement.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-content">
                ${raceInfo ? `<div class="race-badge">${raceInfo.category.replace('RACE_', '')}</div>` : ''}
                ${isCarboLoading ? `<div class="carb-loading-badge">CARB</div>` : ''}
                ${isPostRace ? `<div class="post-race-badge">RECOVERY</div>` : ''}
                ${isPrimingDay ? `<div class="priming-badge">PRIME</div>` : ''}
                ${hasAdjustments ? `<div class="adjustment-badge">📊</div>` : ''}
                ${dayEvents.map(e => `
                    <div class="workout-item ${e.isCompleted ? 'completed' : ''}">
                        ${this.getWorkoutIcon(e)} ${e.name}
                        ${e.isCompleted ? ' ✅' : ''}
                    </div>
                `).join('')}
            </div>
            <div class="nutrition-info">
                <strong>${nutritionInfo.calories}</strong> cal / <strong>${nutritionInfo.carbs}g</strong> C
                ${nutritionInfo.adjustmentApplied ? ' 📊' : ''}
                ${isPrimingDay ? ' 🔥' : ''}
            </div>
        `;
        
        dayElement.addEventListener('click', () => this.showDayDetails(fullDate, dayEvents, raceInfo, isCarboLoading, isPostRace, tomorrowWorkouts));
        return dayElement;
    },
    
    getEventsForDate(date) {
        const dateStr = this.formatDate(date);
        return this.events.filter(event => event.start_date_local.startsWith(dateStr));
    },

    // Get tomorrow's workouts for forward-looking periodization
    getTomorrowWorkouts(date) {
        const tomorrow = new Date(date);
        tomorrow.setDate(date.getDate() + 1);
        return this.getEventsForDate(tomorrow);
    },

    // Assess tomorrow's workout intensity
    assessTomorrowIntensity(tomorrowWorkouts) {
        if (!tomorrowWorkouts || tomorrowWorkouts.length === 0) return 'low';
        
        const intensityScores = tomorrowWorkouts.map(workout => {
            const type = this.workoutMapper.map(workout);
            const duration = (workout.duration || workout.moving_time || 0) / 60;
            
            const typeScore = {
                'intervals': 5, 'threshold': 4, 'tempo': 3,
                'endurance': 2, 'strength': 2, 'easy': 1, 'none': 0
            }[type] || 1;
            
            const durationMultiplier = duration > 120 ? 1.5 : duration > 60 ? 1.2 : 1.0;
            return typeScore * durationMultiplier;
        });
        
        const maxScore = Math.max(...intensityScores);
        if (maxScore >= 6) return 'high';
        if (maxScore >= 3) return 'medium';
        return 'low';
    },

    // Extract power data from workout
    extractPowerData(dayEvents) {
        if (!dayEvents || dayEvents.length === 0) return null;
        
        // Look for power data in completed workouts
        for (const event of dayEvents) {
            if (event.completionData && event.completionData.avgPower) {
                const duration = event.completionData.actualDuration || (event.moving_time || event.duration || 0) / 60;
                const avgPower = event.completionData.avgPower;
                const estimatedKJ = Math.round((avgPower * duration * 60) / 1000); // Convert to kJ
                
                return {
                    avgPower,
                    duration,
                    estimatedKJ
                };
            }
        }
        
        // For planned workouts, estimate based on workout type and duration
        const totalDuration = dayEvents.reduce((sum, e) => sum + (e.duration || e.moving_time || 0) / 60, 0);
        if (totalDuration > 0) {
            const highestIntensity = this.getHighestWorkoutIntensity(dayEvents);
            const estimatedPower = this.estimatePowerFromIntensity(highestIntensity);
            const estimatedKJ = Math.round((estimatedPower * totalDuration * 60) / 1000);
            
            return {
                avgPower: estimatedPower,
                duration: totalDuration,
                estimatedKJ,
                isEstimated: true
            };
        }
        
        return null;
    },

    // Estimate power based on workout intensity
    estimatePowerFromIntensity(workoutType) {
        // Conservative estimates for 70kg athlete (adjust based on user)
        const powerEstimates = {
            'intervals': 300,
            'threshold': 260,
            'tempo': 220,
            'endurance': 180,
            'easy': 150,
            'strength': 200,
            'none': 0
        };
        
        const basePower = powerEstimates[workoutType] || 180;
        // Scale for user's weight (rough approximation)
        const weightFactor = this.bodyWeight / 154; // 154 lbs = 70kg baseline
        return Math.round(basePower * weightFactor);
    },

    // Get highest workout intensity from day's events
    getHighestWorkoutIntensity(dayEvents) {
        let highestIntensity = 'none';
        const intensityRanking = { 
            'none': 0, 'easy': 1, 'strength': 2, 'endurance': 3, 
            'tempo': 4, 'threshold': 5, 'intervals': 6 
        };
        
        dayEvents.forEach(event => {
            const workoutType = this.workoutMapper.map(event);
            if (intensityRanking[workoutType] > intensityRanking[highestIntensity]) {
                highestIntensity = workoutType;
            }
        });
        
        return highestIntensity;
    },

    analyzeDayType(date) {
        const dayEvents = this.getEventsForDate(date);
        let raceInfo = dayEvents.find(e => e.category?.startsWith('RACE_')) || null;
        let isCarboLoading = false;
        let isPostRace = false;

        // Check if yesterday was a race (for post-race recovery)
        const yesterday = new Date(date);
        yesterday.setDate(date.getDate() - 1);
        if (this.getEventsForDate(yesterday).some(e => e.category?.startsWith('RACE_'))) {
            isPostRace = true;
            return { raceInfo: null, isCarboLoading: false, isPostRace: true };
        }

        // If this day is a race, return race info
        if (raceInfo) {
            return { raceInfo, isCarboLoading: false, isPostRace: false };
        }

        // Check for upcoming races within 3 days for carb loading
        const upcomingRaces = this.findUpcomingRaces(date, 3); 
        const importantRace = upcomingRaces.find(r => r.category === 'RACE_A' || r.category === 'RACE_B');
        
        if (importantRace) {
            const raceDate = new Date(importantRace.start_date_local.split('T')[0] + 'T12:00:00');
            const daysUntilRace = this.calculateDaysUntilRace(date, raceDate);
            
            // Carb loading: 2 days before and 1 day before race
            if (daysUntilRace >= 1 && daysUntilRace <= 2) {
                isCarboLoading = true;
            }
        }
        
        return { raceInfo, isCarboLoading, isPostRace };
    },
    
    calculateDaysUntilRace(fromDate, raceDate) {
        const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const race = new Date(raceDate.getFullYear(), raceDate.getMonth(), raceDate.getDate());
        return Math.round((race - from) / (1000 * 60 * 60 * 24));
    },
    
    findUpcomingRaces(fromDate, daysAhead) {
        const endDate = new Date(fromDate);
        endDate.setDate(fromDate.getDate() + daysAhead);
        return this.events.filter(event => {
            if (!event.category?.startsWith('RACE_')) return false;
            const eventDate = new Date(event.start_date_local.split('T')[0] + 'T12:00:00');
            return eventDate > fromDate && eventDate <= endDate;
        });
    },

    // Forward-looking nutrition calculation
    calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, date, tomorrowWorkouts = null) {
        const totalDuration = dayEvents.reduce((acc, e) => acc + Math.round((e.moving_time || e.duration || 0) / 60), 0);
        
        const highestIntensity = this.getHighestWorkoutIntensity(dayEvents);
        
        // Extract power data if available
        const powerData = this.extractPowerData(dayEvents);
        
        // Determine if this is a race day
        const isRaceDay = raceInfo !== null;
        
        console.log(`🗓️ Forward-looking nutrition calculation for ${date}:`, {
            isRaceDay, isCarboLoading, isPostRace, highestIntensity, totalDuration,
            tomorrowWorkouts: tomorrowWorkouts?.length || 0,
            powerData: powerData ? `${powerData.estimatedKJ}kJ` : 'none'
        });
        
        // Use research-based calculation with forward-looking logic
        return nutritionCalculator.calculateWithCompletionData(
            this.bodyWeight, 
            this.goals, 
            highestIntensity, 
            totalDuration,
            this.formatDate(date),
            dayEvents,
            isRaceDay,      
            isPostRace,     
            isCarboLoading,
            tomorrowWorkouts, // Pass tomorrow's workouts
            powerData         // Pass power data
        );
    },

    // Get periodization CSS class for styling
    getPeriodizationClass(periodizationNote) {
        if (!periodizationNote) return null;
        
        if (periodizationNote.includes('Priming')) return 'priming-day';
        if (periodizationNote.includes('Recovery')) return 'recovery-day';
        if (periodizationNote.includes('Race')) return 'race-day';
        if (periodizationNote.includes('Carb loading')) return 'carb-loading-day';
        
        return null;
    },
    
    showDayDetails(date, dayEvents, raceInfo, isCarboLoading, isPostRace, tomorrowWorkouts = null) {
        const modal = document.getElementById('dayDetailModal');
        const modalDate = document.getElementById('modalDate');
        const modalContent = document.getElementById('modalContent');
        
        modalDate.textContent = this.formatDateDisplay(date);
        
        const nutrition = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, date, tomorrowWorkouts);
        
        let headerText = '📅 Training Day';
        if (raceInfo) headerText = `🏁 Race Day: ${raceInfo.name}`;
        else if (isPostRace) headerText = '✅ Post-Race Recovery';
        else if (isCarboLoading) headerText = '🍝 Carb Loading Day';
        else if (tomorrowWorkouts && tomorrowWorkouts.length > 0 && this.assessTomorrowIntensity(tomorrowWorkouts) === 'high') {
            headerText = '🔥 Priming Day - Preparing for Tomorrow';
        }
        
        let workoutDetailsHtml = '';
        if (dayEvents.length > 0) {
            workoutDetailsHtml = `
                <div class="workouts-section">
                    <h4>Today's Activities</h4>
                    <div class="workout-cards">
                        ${dayEvents.map(e => {
                            const duration = Math.round((e.moving_time || e.duration || 3600) / 60);
                            const workoutIcon = this.getWorkoutIcon(e);
                            
                            let completionHtml = '';
                            if (e.isCompleted && e.completionData) {
                                const c = e.completionData;
                                completionHtml = `
                                    <div class="completion-data">
                                        <div class="completion-header">
                                            <span class="completed-badge">✅ Completed</span>
                                            <span class="actual-duration">${c.actualDuration} min</span>
                                        </div>
                                        <div class="workout-metrics">
                                            ${c.avgHeartRate ? `<div class="metric"><span class="metric-label">Avg HR</span><span class="metric-value">${c.avgHeartRate} bpm</span></div>` : ''}
                                            ${c.maxHeartRate ? `<div class="metric"><span class="metric-label">Max HR</span><span class="metric-value">${c.maxHeartRate} bpm</span></div>` : ''}
                                            ${c.avgPower ? `<div class="metric"><span class="metric-label">Avg Power</span><span class="metric-value">${c.avgPower}W</span></div>` : ''}
                                            ${c.maxPower ? `<div class="metric"><span class="metric-label">Max Power</span><span class="metric-value">${c.maxPower}W</span></div>` : ''}
                                            ${c.distance ? `<div class="metric"><span class="metric-label">Distance</span><span class="metric-value">${(c.distance / 1000).toFixed(1)} km</span></div>` : ''}
                                            ${c.elevationGain ? `<div class="metric"><span class="metric-label">Elevation</span><span class="metric-value">${Math.round(c.elevationGain)}m</span></div>` : ''}
                                            ${c.avgSpeed ? `<div class="metric"><span class="metric-label">Avg Speed</span><span class="metric-value">${(c.avgSpeed * 3.6).toFixed(1)} km/h</span></div>` : ''}
                                            ${c.calories ? `<div class="metric"><span class="metric-label">Calories</span><span class="metric-value">${c.calories} kcal</span></div>` : ''}
                                            ${c.perceivedEffort ? `<div class="metric"><span class="metric-label">RPE</span><span class="metric-value">${c.perceivedEffort}/10</span></div>` : ''}
                                        </div>
                                        ${c.description ? `<div class="workout-description">${c.description}</div>` : ''}
                                    </div>
                                `;
                            } else if (e.isCompleted) {
                                completionHtml = `<div class="completion-simple">✅ Completed (${duration} min)</div>`;
                            } else {
                                completionHtml = `<div class="planned-workout">📅 Planned (${duration} min)</div>`;
                            }
                            
                            // Add workout chart for planned workouts
                            const workoutChart = !e.isCompleted ? this.createWorkoutChart(e) : '';
                            
                            return `
                                <div class="workout-card ${e.isCompleted ? 'completed' : 'planned'}">
                                    <div class="workout-header">
                                        <div class="workout-title">
                                            <span class="workout-icon">${workoutIcon}</span>
                                            <span class="workout-name">${e.name || e.type}</span>
                                        </div>
                                        <div class="workout-type">${e.type}</div>
                                    </div>
                                    ${completionHtml}
                                    ${workoutChart}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Add tomorrow's workout preview if relevant
        let tomorrowDetailsHtml = '';
        if (tomorrowWorkouts && tomorrowWorkouts.length > 0) {
            const tomorrowIntensity = this.assessTomorrowIntensity(tomorrowWorkouts);
            tomorrowDetailsHtml = `
                <div class="tomorrow-section">
                    <h4>Tomorrow's Plan <span class="intensity-badge ${tomorrowIntensity}">${tomorrowIntensity} intensity</span></h4>
                    <div class="tomorrow-workouts">
                        ${tomorrowWorkouts.map(w => `
                            <div class="tomorrow-workout">
                                <span class="workout-icon">${this.getWorkoutIcon(w)}</span>
                                <span class="workout-name">${w.name || w.type}</span>
                                <span class="workout-duration">${Math.round((w.moving_time || w.duration || 3600) / 60)} min</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        modalContent.innerHTML = `
            <div class="modal-day-header">
                <h3>${headerText}</h3>
                <div class="day-meta">
                    ${this.formatDateDisplay(date)} ${tomorrowWorkouts?.length > 0 ? `• Tomorrow: ${this.assessTomorrowIntensity(tomorrowWorkouts)} intensity` : ''}
                </div>
            </div>

            ${workoutDetailsHtml}
            ${tomorrowDetailsHtml}
            
            <div class="nutrition-section">
                ${nutritionCalculator.formatNutritionResults(nutrition)}
            </div>
        `;
        
        modal.style.display = 'block';
    },

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
        
        // Find max intensity for scaling
        const maxIntensityValue = this.getMaxIntensityValue(intervals);
        
        // Generate workout chart bars with varying heights
        const chartBars = intervals.map((interval, index) => {
            const widthPercent = (interval.duration / totalDuration) * 100;
            const durationMin = interval.durationMinutes;
            
            // Calculate height based on intensity
            const intensityValue = this.getIntensityValue(interval);
            const heightPercent = (intensityValue / maxIntensityValue) * 100;
            
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
            } else {
                targetDisplay = interval.intensity.toUpperCase();
            }
            
            return `
                <div class="workout-bar" 
                     style="width: ${widthPercent}%; height: ${heightPercent}%; background-color: ${barColor};" 
                     title="${durationMin}min - ${interval.intensity} ${interval.targetValue || ''}${interval.targetType === 'power' ? 'W' : interval.targetType === 'hr_percent' ? '%' : ''}">
                    <div class="bar-content">
                        <div class="bar-duration">${durationMin}'</div>
                        <div class="bar-intensity">${targetDisplay}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Generate time markers
        const timeMarkers = this.generateTimeMarkers(intervals, totalDuration);
        
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
                
                <div class="workout-bar-chart">
                    <div class="intensity-axis">
                        <div class="axis-label-top">${Math.round(maxIntensityValue)}${intervals.some(i => i.targetType === 'power') ? 'W' : '%'}</div>
                        <div class="axis-label-mid">${Math.round(maxIntensityValue/2)}${intervals.some(i => i.targetType === 'power') ? 'W' : '%'}</div>
                        <div class="axis-label-bottom">0${intervals.some(i => i.targetType === 'power') ? 'W' : '%'}</div>
                    </div>
                    <div class="chart-container">
                        <div class="workout-bars">
                            ${chartBars}
                        </div>
                        <div class="time-axis">
                            ${timeMarkers.join('')}
                        </div>
                    </div>
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

    // Get numeric intensity value for height calculation
    getIntensityValue(interval) {
        // If we have actual target values, use those
        if (interval.targetValue) {
            return interval.targetValue;
        }
        
        // Otherwise use intensity-based estimates
        const intensityValues = {
            'recovery': 80,      // Low intensity
            'endurance': 140,    // Moderate intensity
            'tempo': 180,        // Medium-high intensity
            'threshold': 220,    // High intensity
            'vo2max': 280,       // Very high intensity
            'moderate': 120      // Default
        };
        
        return intensityValues[interval.intensity] || intensityValues['moderate'];
    },

    // Find maximum intensity value for chart scaling
    getMaxIntensityValue(intervals) {
        let maxValue = 0;
        
        intervals.forEach(interval => {
            const value = this.getIntensityValue(interval);
            if (value > maxValue) {
                maxValue = value;
            }
        });
        
        // Add some headroom for better visual appearance
        return Math.max(maxValue * 1.1, 100);
    },

    // Generate time markers for x-axis
    generateTimeMarkers(intervals, totalDuration) {
        const timeMarkers = [];
        let currentTime = 0;
        
        // Add start marker
        timeMarkers.push(`<div class="time-marker" style="left: 0%;">0:00</div>`);
        
        intervals.forEach((interval, index) => {
            currentTime += interval.duration;
            const minutes = Math.floor(currentTime / 60);
            const seconds = currentTime % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            const position = (currentTime / totalDuration) * 100;
            
            // Only add markers for significant intervals to avoid crowding
            if (interval.duration >= 120 || index === intervals.length - 1) { // 2+ minutes or last interval
                timeMarkers.push(`<div class="time-marker" style="left: ${position}%;">${timeStr}</div>`);
            }
        });
        
        return timeMarkers;
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

    // Get power zone colors (approximate zones)
    getPowerZoneColor(watts) {
        if (watts < 120) return '#4CAF50';      // Z1 - Active Recovery (Green)
        if (watts < 140) return '#8BC34A';      // Z2 - Endurance (Light Green)  
        if (watts < 160) return '#FFEB3B';      // Z3 - Tempo (Yellow)
        if (watts < 180) return '#FF9800';      // Z4 - Threshold (Orange)
        return '#F44336';                       // Z5+ - VO2/Anaerobic (Red)
    },

    // Get HR zone colors (based on LTHR percentage)
    getHRZoneColor(lthrPercent) {
        if (lthrPercent < 75) return '#4CAF50';     // Z1 - Active Recovery
        if (lthrPercent < 82) return '#8BC34A';     // Z2 - Endurance
        if (lthrPercent < 87) return '#FFEB3B';     // Z3 - Tempo  
        if (lthrPercent < 92) return '#FF9800';     // Z4 - Threshold
        return '#F44336';                           // Z5+ - VO2/Anaerobic
    },

    // Get zone colors by zone ID
    getZoneColor(zoneId) {
        const zoneColors = {
            'Z1': '#4CAF50',    // Green
            'Z2': '#8BC34A',    // Light Green
            'Z3': '#FFEB3B',    // Yellow
            'Z4': '#FF9800',    // Orange
            'Z5': '#F44336',    // Red
            'Z6': '#E91E63',    // Pink
            'Z7': '#9C27B0'     // Purple
        };
        return zoneColors[zoneId] || '#ccc';
    },

    closeModal() {
        document.getElementById('dayDetailModal').style.display = 'none';
    },
    
    handleModalClick(event) {
        if (event.target === event.currentTarget) this.closeModal();
    },
    
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.loadCalendarData();
    },
    
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.loadCalendarData();
    },
    
    goToToday() {
        this.currentDate = new Date();
        this.loadCalendarData();
    },
    
    updateMonthYear() {
        document.getElementById('monthYear').textContent = `${this.currentDate.toLocaleDateString('en-US', { month: 'long' })} ${this.currentDate.getFullYear()}`;
    },
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },
    
    formatDateDisplay(date) {
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    },
    
    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
    }
};