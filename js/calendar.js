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
        loadingState.innerHTML = '<h3>Loading your nutrition calendar with completion data...</h3>';
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
        grid.innerHTML = `
            <div class="calendar-header-cell">Sun</div><div class="calendar-header-cell">Mon</div>
            <div class="calendar-header-cell">Tue</div><div class="calendar-header-cell">Wed</div>
            <div class="calendar-header-cell">Thu</div><div class="calendar-header-cell">Fri</div>
            <div class="calendar-header-cell">Sat</div>
        `;
        
        const mobileList = document.getElementById('mobileList');
        mobileList.innerHTML = '';
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const allDays = [];
        
        const prevMonth = new Date(year, month, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonth.getDate() - i;
            const fullDate = new Date(year, month - 1, day);
            grid.appendChild(this.createDayElement(day, true, fullDate));
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const fullDate = new Date(year, month, day);
            grid.appendChild(this.createDayElement(day, false, fullDate));
            allDays.push({ day, fullDate, isCurrentMonth: true });
        }
        
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

            const nutrition = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, fullDate);
            
            listItem.innerHTML = `
                <div class="day-list-header">
                    <div class="day-list-date">${this.formatDateDisplay(fullDate)}</div>
                    <div>
                        ${raceInfo ? '🏁 Race' : isCarboLoading ? '🍝 Carb Load' : isPostRace ? '✅ Recovery' : ''}
                        ${hasCompletedWorkouts ? '📊 Completed' : ''}
                    </div>
                </div>
                <div class="day-list-workouts">
                    ${dayEvents.map(e => `
                        <div>
                            <strong>${e.name}</strong> (${Math.round((e.moving_time||0)/60)} min)
                            ${e.isCompleted ? '✅' : ''}
                            ${e.completionData && e.completionData.perceivedEffort ? ` RPE: ${e.completionData.perceivedEffort}` : ''}
                        </div>
                    `).join('') || 'Rest Day'}
                </div>
                <div class="day-list-nutrition">
                    <strong>${nutrition.calories}</strong> cal • <strong>${nutrition.carbs}g</strong> C • <strong>${nutrition.protein}g</strong> P
                    ${nutrition.adjustmentApplied ? ' 📊 Adjusted' : ''}
                </div>
            `;
            
            listItem.addEventListener('click', () => this.showDayDetails(fullDate, dayEvents, raceInfo, isCarboLoading, isPostRace));
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
        const { raceInfo, isCarboLoading, isPostRace } = this.analyzeDayType(fullDate);
        
        // Check for completed workouts
        const hasCompletedWorkouts = dayEvents.some(e => e.isCompleted);
        const hasAdjustments = dayEvents.some(e => e.isCompleted && e.completionData);
        
        if (raceInfo) dayElement.classList.add('race-day');
        else if (isCarboLoading) dayElement.classList.add('carb-loading');
        else if (isPostRace) dayElement.classList.add('post-race'); 
        
        if (hasCompletedWorkouts) dayElement.classList.add('completed-workout');
        
        const nutritionInfo = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, fullDate);

        dayElement.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-content">
                ${raceInfo ? `<div class="race-badge">${raceInfo.category.replace('RACE_', '')}</div>` : ''}
                ${isCarboLoading ? `<div class="carb-loading-badge">CARB</div>` : ''}
                ${isPostRace ? `<div class="post-race-badge">RECOVERY</div>` : ''}
                ${hasAdjustments ? `<div class="adjustment-badge">📊</div>` : ''}
                ${dayEvents.map(e => `
                    <div class="workout-item ${e.isCompleted ? 'completed' : ''}">
                        ${e.name}
                        ${e.isCompleted ? ' ✅' : ''}
                    </div>
                `).join('')}
            </div>
            <div class="nutrition-info">
                <strong>${nutritionInfo.calories}</strong> cal / <strong>${nutritionInfo.carbs}g</strong> C
                ${nutritionInfo.adjustmentApplied ? ' 📊' : ''}
            </div>
        `;
        
        dayElement.addEventListener('click', () => this.showDayDetails(fullDate, dayEvents, raceInfo, isCarboLoading, isPostRace));
        return dayElement;
    },
    
    getEventsForDate(date) {
        const dateStr = this.formatDate(date);
        return this.events.filter(event => event.start_date_local.startsWith(dateStr));
    },

    analyzeDayType(date) {
        const dayEvents = this.getEventsForDate(date);
        let raceInfo = dayEvents.find(e => e.category?.startsWith('RACE_')) || null;
        let isCarboLoading = false;
        let isPostRace = false;

        const yesterday = new Date(date);
        yesterday.setDate(date.getDate() - 1);
        if (this.getEventsForDate(yesterday).some(e => e.category?.startsWith('RACE_'))) {
            isPostRace = true;
            return { raceInfo: null, isCarboLoading: false, isPostRace: true };
        }

        if (raceInfo) {
            return { raceInfo, isCarboLoading: false, isPostRace: false };
        }

        const upcomingRaces = this.findUpcomingRaces(date, 4); 
        const importantRace = upcomingRaces.find(r => r.category === 'RACE_A' || r.category === 'RACE_B');
        
        if (importantRace) {
            const raceDate = new Date(importantRace.start_date_local.split('T')[0] + 'T12:00:00');
            const daysUntilRace = this.calculateDaysUntilRace(date, raceDate);
            if (daysUntilRace >= 1 && daysUntilRace <= 3) {
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

    calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, date) {
        const totalDuration = dayEvents.reduce((acc, e) => acc + Math.round((e.moving_time || e.duration || 0) / 60), 0);
        
        let highestIntensity = 'none';
        const intensityRanking = { 'none': 0, 'easy': 1, 'strength': 2, 'endurance': 3, 'tempo': 4, 'threshold': 5, 'intervals': 6 };
        
        dayEvents.forEach(event => {
            const workoutType = this.workoutMapper.map(event);
            if (intensityRanking[workoutType] > intensityRanking[highestIntensity]) {
                highestIntensity = workoutType;
            }
        });
        
        // Determine if this is a race day
        const isRaceDay = raceInfo !== null;
        
        console.log(`🗓️ Calendar nutrition calculation for ${date}:`, {
            isRaceDay,
            isCarboLoading, 
            isPostRace,
            highestIntensity,
            totalDuration
        });
        
        // Use enhanced calculation that considers completion data AND race day flags
        return nutritionCalculator.calculateWithCompletionData(
            this.bodyWeight, 
            this.goals, 
            highestIntensity, 
            totalDuration,
            this.formatDate(date),
            dayEvents,
            isRaceDay,      // ← This was missing!
            isPostRace,     // ← This was missing!
            isCarboLoading  // ← This was missing!
        );
    },
    
    showDayDetails(date, dayEvents, raceInfo, isCarboLoading, isPostRace) {
        const modal = document.getElementById('dayDetailModal');
        const modalDate = document.getElementById('modalDate');
        const modalContent = document.getElementById('modalContent');
        
        modalDate.textContent = this.formatDateDisplay(date);
        
        const nutrition = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, date);
        
        let headerText = '📅 Training Day';
        if (raceInfo) headerText = `🏁 Race Day: ${raceInfo.name}`;
        else if (isPostRace) headerText = '✅ Post-Race Recovery';
        else if (isCarboLoading) headerText = '🍝 Carb Loading Day';
        
        let workoutDetailsHtml = '';
        if (dayEvents.length > 0) {
            workoutDetailsHtml = `
                <h4>Scheduled Workouts:</h4>
                <ul>
                    ${dayEvents.map(e => {
                        let workoutHtml = `<li><strong>${e.name || e.type}</strong> - ${Math.round((e.moving_time || e.duration || 3600) / 60)} minutes`;
                        
                        if (e.isCompleted && e.completionData) {
                            const completion = e.completionData;
                            workoutHtml += ` ✅`;
                            if (completion.perceivedEffort) {
                                workoutHtml += ` (RPE: ${completion.perceivedEffort})`;
                            }
                            if (completion.avgHeartRate) {
                                workoutHtml += ` (Avg HR: ${completion.avgHeartRate})`;
                            }
                            if (completion.actualDuration !== Math.round((e.moving_time || e.duration || 3600) / 60)) {
                                workoutHtml += ` (Actual: ${completion.actualDuration} min)`;
                            }
                        }
                        
                        workoutHtml += `</li>`;
                        return workoutHtml;
                    }).join('')}
                </ul>
            `;
        }
        
        modalContent.innerHTML = `
            <div class="section">
                <h3>${headerText}</h3>
                ${workoutDetailsHtml}
                ${nutritionCalculator.formatNutritionResults(nutrition)}
            </div>
        `;
        
        modal.style.display = 'block';
    },

    closeModal() {
        document.getElementById('dayDetailModal').style.display = 'none';
    },
    
    handleModalClick(event) {
        if (event.target === event.currentTarget) this.closeModal();
    },
    
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.loadCalendarData(); // Reload to get completion data for new date range
    },
    
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.loadCalendarData(); // Reload to get completion data for new date range
    },
    
    goToToday() {
        this.currentDate = new Date();
        this.loadCalendarData(); // Reload to get completion data for current month
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