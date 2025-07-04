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
        document.getElementById('loadCalendarBtn')?.addEventListener('click', () => this.loadCalendarData());
        
        // *** NEW: Add event listeners for settings changes ***
        document.getElementById('goals')?.addEventListener('change', () => this.handleSettingsChange());
        document.getElementById('bodyWeight')?.addEventListener('change', () => this.handleSettingsChange());

        // Modal close functionality
        document.querySelector('.day-detail-modal')?.addEventListener('click', (e) => this.handleModalClick(e));
        document.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
    },
    
    // *** NEW: Recalculate calendar when settings change ***
    handleSettingsChange() {
        this.bodyWeight = parseInt(document.getElementById('bodyWeight').value);
        this.goals = document.getElementById('goals').value;
        // Re-render the calendar if data already exists
        if (this.events.length > 0) {
            this.renderCalendar();
        }
    },

    async loadCalendarData() {
        const apiKey = document.getElementById('apiKey').value;
        this.bodyWeight = parseInt(document.getElementById('bodyWeight').value);
        this.goals = document.getElementById('goals').value;
        
        if (!apiKey) {
            alert('Please enter your API key');
            return;
        }
        
        const loadingState = document.getElementById('loadingState');
        loadingState.innerHTML = '<h3>Loading your nutrition calendar...</h3><p>Fetching workouts and races from Intervals.icu</p>';
        
        try {
            const startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
            const endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 2, 0);
            
            const { athleteId } = intervalsAPI.getDefaults();
            this.events = await intervalsAPI.loadWorkoutsForDateRange(apiKey, athleteId, this.formatDate(startDate), this.formatDate(endDate));
            
            console.log(`Loaded ${this.events.length} events for calendar`);
            
            loadingState.style.display = 'none';
            document.getElementById('legend').style.display = 'flex';
            document.getElementById('calendarHeader').style.display = 'flex';
            
            this.renderCalendar();
        } catch (error) {
            console.error('Calendar loading error:', error);
            loadingState.innerHTML = `<h3>Error loading calendar</h3><p>${error.message}</p>`;
        }
    },
    
    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.updateMonthYear();
        
        const grid = document.getElementById('calendarGrid');
        // Clear old days, keeping header row
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

            const nutrition = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace);
            
            listItem.innerHTML = `
                <div class="day-list-header">
                    <div class="day-list-date">${this.formatDateDisplay(fullDate)}</div>
                    <div>${raceInfo ? '🏁 Race' : isCarboLoading ? '🍝 Carb Load' : isPostRace ? '✅ Recovery' : ''}</div>
                </div>
                <div class="day-list-workouts">${dayEvents.map(e => `<div><strong>${e.name}</strong> (${Math.round((e.moving_time||0)/60)} min)</div>`).join('') || 'Rest Day'}</div>
                <div class="day-list-nutrition"><strong>${nutrition.calories}</strong> cal • <strong>${nutrition.carbs}g</strong> C • <strong>${nutrition.protein}g</strong> P</div>
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
        
        if (raceInfo) dayElement.classList.add('race-day');
        else if (isCarboLoading) dayElement.classList.add('carb-loading');
        else if (isPostRace) dayElement.classList.add('post-race'); 
        
        const nutritionInfo = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace);

        dayElement.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-content">
                ${raceInfo ? `<div class="race-badge">${raceInfo.category.replace('RACE_', '')}</div>` : ''}
                ${isCarboLoading ? `<div class="carb-loading-badge">CARB</div>` : ''}
                ${isPostRace ? `<div class="post-race-badge">RECOVERY</div>` : ''}
                ${dayEvents.map(e => `<div class="workout-item">${e.name}</div>`).join('')}
            </div>
            <div class="nutrition-info"><strong>${nutritionInfo.calories}</strong> cal / <strong>${nutritionInfo.carbs}g</strong> C</div>
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

    calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace) {
        const totalDuration = dayEvents.reduce((acc, e) => acc + Math.round((e.moving_time || e.duration || 0) / 60), 0);
        
        let highestIntensity = 'none';
        const intensityRanking = { 'none': 0, 'easy': 1, 'strength': 2, 'endurance': 3, 'tempo': 4, 'threshold': 5, 'intervals': 6 };
        
        dayEvents.forEach(event => {
            const workoutType = this.workoutMapper.map(event);
            if (intensityRanking[workoutType] > intensityRanking[highestIntensity]) {
                highestIntensity = workoutType;
            }
        });
        
        return nutritionCalculator.calculate(
            this.bodyWeight, 
            this.goals, 
            highestIntensity, 
            totalDuration,
            !!raceInfo,
            isPostRace,
            isCarboLoading
        );
    },
    
    showDayDetails(date, dayEvents, raceInfo, isCarboLoading, isPostRace) {
        const modal = document.getElementById('dayDetailModal');
        const modalDate = document.getElementById('modalDate');
        const modalContent = document.getElementById('modalContent');
        
        modalDate.textContent = this.formatDateDisplay(date);
        
        const nutrition = this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace);
        
        let headerText = '📅 Training Day';
        if (raceInfo) headerText = `🏁 Race Day: ${raceInfo.name}`;
        else if (isPostRace) headerText = '✅ Post-Race Recovery';
        else if (isCarboLoading) headerText = '🍝 Carb Loading Day';
        
        modalContent.innerHTML = `
            <div class="section">
                <h3>${headerText}</h3>
                ${dayEvents.length > 0 ? `<h4>Scheduled Workouts:</h4><ul>${dayEvents.map(e => `<li><strong>${e.name || e.type}</strong> - ${Math.round((e.moving_time || e.duration || 3600) / 60)} minutes</li>`).join('')}</ul>` : ''}
                <h4>Daily Nutrition Target:</h4>
                <div class="macro-grid" style="margin: 15px 0;">
                    <div class="macro-item"><div class="macro-value">${nutrition.calories}</div><div class="macro-label">Calories</div></div>
                    <div class="macro-item"><div class="macro-value">${nutrition.protein}g</div><div class="macro-label">Protein</div></div>
                    <div class="macro-item"><div class="macro-value">${nutrition.carbs}g</div><div class="macro-label">Carbs</div></div>
                    <div class="macro-item"><div class="macro-value">${nutrition.fat}g</div><div class="macro-label">Fat</div></div>
                </div>
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
        this.renderCalendar();
    },
    
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
    },
    
    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    },
    
    updateMonthYear() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('monthYear').textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
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
