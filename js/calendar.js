// Calendar Management Module
const calendarManager = {
    currentDate: new Date(),
    events: [],
    bodyWeight: 192,
    
    init() {
        console.log('🗓️ Calendar Manager Initialized');
        this.currentDate = new Date();
        this.updateMonthYear();
    },
    
    async loadCalendarData() {
        const apiKey = document.getElementById('apiKey').value;
        const bodyWeight = parseInt(document.getElementById('bodyWeight').value);
        
        if (!apiKey) {
            alert('Please enter your API key');
            return;
        }
        
        this.bodyWeight = bodyWeight;
        
        try {
            document.getElementById('loadingState').innerHTML = '<h3>Loading your nutrition calendar...</h3><p>Fetching workouts and races from Intervals.icu</p>';
            
            const startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            const endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 3, 0);
            
            const { athleteId } = intervalsAPI.getDefaults();
            this.events = await intervalsAPI.loadWorkoutsForDateRange(apiKey, athleteId, this.formatDate(startDate), this.formatDate(endDate));
            
            console.log(`Loaded ${this.events.length} events for calendar`);
            
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('legend').style.display = 'flex';
            document.getElementById('calendarHeader').style.display = 'flex';
            document.getElementById('calendarGrid').style.display = 'grid';
            document.getElementById('mobileList').style.display = 'block';
            
            this.renderCalendar();
            
        } catch (error) {
            console.error('Calendar loading error:', error);
            document.getElementById('loadingState').innerHTML = `<h3>Error loading calendar</h3><p>${error.message}</p>`;
        }
    },
    
    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.updateMonthYear();
        
        const grid = document.getElementById('calendarGrid');
        grid.querySelectorAll('.calendar-day').forEach(day => day.remove());
        
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
        
        const totalCells = grid.children.length - 7;
        const cellsNeeded = Math.ceil(totalCells / 7) * 7 - totalCells + 7;
        
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
            const { raceInfo, isCarboLoading, isPostRace } = this.analyzeDayType(fullDate, dayEvents);
            
            const hasEvents = dayEvents.length > 0 || isCarboLoading || isPostRace || raceInfo;
            if (!hasEvents) return;

            const listItem = document.createElement('div');
            listItem.className = 'day-list-item';
            
            const today = new Date();
            if (this.isSameDate(fullDate, today)) listItem.classList.add('today');
            if (raceInfo) listItem.classList.add('race-day');
            else if (isCarboLoading) listItem.classList.add('carb-loading');
            else if (isPostRace) listItem.classList.add('post-race'); // New style class

            const header = document.createElement('div');
            header.className = 'day-list-header';
            
            const dateDiv = document.createElement('div');
            dateDiv.className = 'day-list-date';
            dateDiv.textContent = this.formatDateDisplay(fullDate);
            
            const badgeDiv = document.createElement('div');
            if (raceInfo) badgeDiv.innerHTML = `<span style="background: #f44336; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">RACE</span>`;
            else if (isCarboLoading) badgeDiv.innerHTML = `<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">CARB LOAD</span>`;
            else if (isPostRace) badgeDiv.innerHTML = `<span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">RECOVERY</span>`;
            
            header.appendChild(dateDiv);
            header.appendChild(badgeDiv);
            listItem.appendChild(header);
            
            if (dayEvents.length > 0) {
                const workoutsDiv = document.createElement('div');
                workoutsDiv.className = 'day-list-workouts';
                dayEvents.forEach(event => {
                    const duration = Math.round((event.moving_time || event.duration || 3600) / 60);
                    workoutsDiv.innerHTML += `<div><strong>${event.name || event.type}</strong> - ${duration} min</div>`;
                });
                listItem.appendChild(workoutsDiv);
            }
            
            const nutrition = this.calculateDayNutrition(fullDate, dayEvents, raceInfo, isCarboLoading, isPostRace);
            const nutritionDiv = document.createElement('div');
            nutritionDiv.className = 'day-list-nutrition';
            nutritionDiv.innerHTML = `<strong>${nutrition.calories}</strong> cal • <strong>${nutrition.carbs}g</strong> carbs • <strong>${nutrition.protein}g</strong> protein`;
            listItem.appendChild(nutritionDiv);
            
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
        const { raceInfo, isCarboLoading, isPostRace } = this.analyzeDayType(fullDate, dayEvents);
        
        if (raceInfo) dayElement.classList.add('race-day');
        else if (isCarboLoading) dayElement.classList.add('carb-loading');
        else if (isPostRace) dayElement.classList.add('post-race'); // New style class
        
        dayElement.innerHTML = `<div class="day-number">${day}</div>`;
        const dayContent = document.createElement('div');
        dayContent.className = 'day-content';
        
        if (raceInfo) dayContent.innerHTML += `<div class="race-badge">${raceInfo.category.replace('RACE_', '')}</div>`;
        else if (isCarboLoading) dayContent.innerHTML += `<div class="carb-loading-badge">CARB</div>`;
        else if (isPostRace) dayContent.innerHTML += `<div class="post-race-badge">RECOVERY</div>`;

        dayEvents.forEach(event => {
            const workoutItem = document.createElement('div');
            workoutItem.className = 'workout-item';
            if (event.category === 'RACE_A') workoutItem.classList.add('race-a');
            else if (event.category === 'RACE_B') workoutItem.classList.add('race-b');
            else if (event.category === 'RACE_C') workoutItem.classList.add('race-c');
            const duration = Math.round((event.moving_time || event.duration || 3600) / 60);
            workoutItem.textContent = `${event.name || event.type} (${duration}m)`;
            dayContent.appendChild(workoutItem);
        });
        
        const nutritionInfo = this.calculateDayNutrition(fullDate, dayEvents, raceInfo, isCarboLoading, isPostRace);
        dayContent.innerHTML += `<div class="nutrition-info"><strong>${nutritionInfo.calories}</strong> cal / <strong>${nutritionInfo.carbs}g</strong> C</div>`;
        
        dayElement.appendChild(dayContent);
        dayElement.addEventListener('click', () => this.showDayDetails(fullDate, dayEvents, raceInfo, isCarboLoading, isPostRace));
        return dayElement;
    },
    
    getEventsForDate(date) {
        const dateStr = this.formatDate(date);
        return this.events.filter(event => event.start_date_local.startsWith(dateStr));
    },

    analyzeDayType(date, dayEvents) {
        let raceInfo = dayEvents.find(e => e.category?.startsWith('RACE_')) || null;
        let isCarboLoading = false;
        let isPostRace = false;

        // Check for Post-Race day FIRST
        const yesterday = new Date(date);
        yesterday.setDate(date.getDate() - 1);
        const yesterdayEvents = this.getEventsForDate(yesterday);
        if (yesterdayEvents.some(e => e.category?.startsWith('RACE_'))) {
            isPostRace = true;
            return { raceInfo: null, isCarboLoading: false, isPostRace: true };
        }

        if (raceInfo) {
            return { raceInfo, isCarboLoading: false, isPostRace: false };
        }

        const upcomingRaces = this.findUpcomingRaces(date, 3);
        const importantRace = upcomingRaces.find(r => r.category === 'RACE_A' || r.category === 'RACE_B');
        if (importantRace) {
            const raceDate = new Date(importantRace.start_date_local.split('T')[0] + 'T12:00:00');
            const daysUntilRace = this.calculateDaysUntilRace(date, raceDate);
            // *** FIX: Changed carb loading window to 3 days ***
            if (daysUntilRace >= 1 && daysUntilRace <= 3) {
                isCarboLoading = true;
            }
        }
        
        return { raceInfo, isCarboLoading, isPostRace };
    },
    
    calculateDaysUntilRace(fromDate, raceDate) {
        const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const race = new Date(raceDate.getFullYear(), raceDate.getMonth(), raceDate.getDate());
        const timeDiff = race.getTime() - from.getTime();
        return Math.round(timeDiff / (1000 * 3600 * 24));
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

    calculateDayNutrition(date, dayEvents, raceInfo, isCarboLoading, isPostRace) {
        let totalDuration = dayEvents.reduce((acc, e) => acc + Math.round((e.moving_time || e.duration || 0) / 60), 0);
        let highestIntensity = 'none';
        if (dayEvents.length > 0) {
            highestIntensity = 'easy'; 
        }
        if (raceInfo) highestIntensity = 'threshold';

        return nutritionCalculator.calculate(
            this.bodyWeight, 
            'performance', 
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
        
        const nutrition = this.calculateDayNutrition(date, dayEvents, raceInfo, isCarboLoading, isPostRace);
        
        let content = '<div class="section">';
        if (raceInfo) content += `<h3>🏁 Race Day: ${raceInfo.name}</h3>`;
        else if (isPostRace) content += '<h3>✅ Post-Race Recovery</h3><p>Focus on replenishing glycogen and repairing muscle.</p>';
        else if (isCarboLoading) content += '<h3>🍝 Carb Loading Day</h3>';
        else content += '<h3>📅 Training Day</h3>';
        
        if (dayEvents.length > 0) {
            content += '<h4>Scheduled Workouts:</h4><ul>';
            dayEvents.forEach(event => {
                const duration = Math.round((event.moving_time || event.duration || 3600) / 60);
                content += `<li><strong>${event.name || event.type}</strong> - ${duration} minutes</li>`;
            });
            content += '</ul>';
        }
        
        content += '<h4>Daily Nutrition Target:</h4>';
        content += `<div class="macro-grid" style="margin: 15px 0;"><div class="macro-item"><div class="macro-value">${nutrition.calories}</div><div class="macro-label">Calories</div></div><div class="macro-item"><div class="macro-value">${nutrition.protein}g</div><div class="macro-label">Protein</div></div><div class="macro-item"><div class="macro-value">${nutrition.carbs}g</div><div class="macro-label">Carbs</div></div><div class="macro-item"><div class="macro-value">${nutrition.fat}g</div><div class="macro-label">Fat</div></div></div>`;
        
        content += '</div>';
        modalContent.innerHTML = content;
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
        const monthYear = document.getElementById('monthYear');
        if (monthYear) monthYear.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
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
