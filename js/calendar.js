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
            
            // Get date range (current month + next 2 months for race planning)
            const startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            const endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 3, 0);
            
            // Load events from Intervals.icu
            const { athleteId } = intervalsAPI.getDefaults();
            this.events = await intervalsAPI.loadWorkoutsForDateRange(
                apiKey, 
                athleteId, 
                this.formatDate(startDate), 
                this.formatDate(endDate)
            );
            
            console.log(`Loaded ${this.events.length} events for calendar`);
            
            // Show calendar
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
        
        // Update header
        this.updateMonthYear();
        
        // Clear existing calendar days (keep headers)
        const grid = document.getElementById('calendarGrid');
        const existingDays = grid.querySelectorAll('.calendar-day');
        existingDays.forEach(day => day.remove());
        
        // Clear mobile list
        const mobileList = document.getElementById('mobileList');
        mobileList.innerHTML = '';
        
        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Store all days for mobile list
        const allDays = [];
        
        // Add previous month's trailing days
        const prevMonth = new Date(year, month, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonth.getDate() - i;
            const fullDate = new Date(year, month - 1, day);
            const dayElement = this.createDayElement(day, true, fullDate);
            grid.appendChild(dayElement);
        }
        
        // Add current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const fullDate = new Date(year, month, day);
            const dayElement = this.createDayElement(day, false, fullDate);
            grid.appendChild(dayElement);
            
            allDays.push({ day, fullDate, isCurrentMonth: true });
        }
        
        // Add next month's leading days to fill the grid
        const totalCells = grid.children.length - 7;
        const cellsNeeded = Math.ceil(totalCells / 7) * 7 - totalCells + 7;
        
        for (let day = 1; day <= cellsNeeded; day++) {
            const fullDate = new Date(year, month + 1, day);
            const dayElement = this.createDayElement(day, true, fullDate);
            grid.appendChild(dayElement);
        }
        
        this.renderMobileList(allDays);
    },
    
    renderMobileList(allDays) {
        const mobileList = document.getElementById('mobileList');
        
        allDays.forEach(({ day, fullDate, isCurrentMonth }) => {
            if (!isCurrentMonth) return;
            
            const dayEvents = this.getEventsForDate(fullDate);
            const { raceInfo, isCarboLoading } = this.analyzeDayType(fullDate, dayEvents);
            
            const hasEvents = dayEvents.length > 0 || isCarboLoading;
            
            const listItem = document.createElement('div');
            listItem.className = 'day-list-item';
            
            if (!hasEvents) return;
            
            const today = new Date();
            if (this.isSameDate(fullDate, today)) {
                listItem.classList.add('today');
            }
            
            if (raceInfo) {
                listItem.classList.add('race-day');
            } else if (isCarboLoading) {
                listItem.classList.add('carb-loading');
            }
            
            const header = document.createElement('div');
            header.className = 'day-list-header';
            
            const dateDiv = document.createElement('div');
            dateDiv.className = 'day-list-date';
            dateDiv.textContent = this.formatDateDisplay(fullDate);
            
            const badgeDiv = document.createElement('div');
            if (raceInfo) {
                badgeDiv.innerHTML = `<span style="background: #f44336; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">${raceInfo.category.replace('RACE_', '')} RACE</span>`;
            } else if (isCarboLoading) {
                badgeDiv.innerHTML = `<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">CARB LOADING</span>`;
            }
            
            header.appendChild(dateDiv);
            header.appendChild(badgeDiv);
            listItem.appendChild(header);
            
            if (dayEvents.length > 0) {
                const workoutsDiv = document.createElement('div');
                workoutsDiv.className = 'day-list-workouts';
                
                dayEvents.forEach(event => {
                    const duration = Math.round((event.moving_time || event.duration || 3600) / 60);
                    const workoutDiv = document.createElement('div');
                    workoutDiv.style.marginBottom = '5px';
                    workoutDiv.innerHTML = `<strong>${event.name || event.type}</strong> - ${duration} minutes`;
                    workoutsDiv.appendChild(workoutDiv);
                });
                
                listItem.appendChild(workoutsDiv);
            }
            
            const nutrition = this.calculateDayNutrition(fullDate, dayEvents, isCarboLoading);
            const nutritionDiv = document.createElement('div');
            nutritionDiv.className = 'day-list-nutrition';
            nutritionDiv.innerHTML = `<strong>${nutrition.calories}</strong> cal • <strong>${nutrition.carbs}g</strong> carbs • <strong>${nutrition.protein}g</strong> protein`;
            listItem.appendChild(nutritionDiv);
            
            listItem.addEventListener('click', () => {
                this.showDayDetails(fullDate, dayEvents, isCarboLoading, raceInfo);
            });
            
            mobileList.appendChild(listItem);
        });

        if (mobileList.children.length === 0) {
            const noEventsDiv = document.createElement('div');
            noEventsDiv.className = 'day-list-item';
            noEventsDiv.style.textAlign = 'center';
            noEventsDiv.style.color = '#666';
            noEventsDiv.innerHTML = '<h3>No workouts or races this month</h3><p>Enjoy your rest days!</p>';
            mobileList.appendChild(noEventsDiv);
        }
    },
    
    createDayElement(day, isOtherMonth, fullDate) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }
        
        const today = new Date();
        if (this.isSameDate(fullDate, today)) {
            dayElement.classList.add('today');
        }
        
        const dayEvents = this.getEventsForDate(fullDate);
        const { raceInfo, isCarboLoading } = this.analyzeDayType(fullDate, dayEvents);
        
        if (raceInfo) {
            dayElement.classList.add('race-day');
        } else if (isCarboLoading) {
            dayElement.classList.add('carb-loading');
        }
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);
        
        const dayContent = document.createElement('div');
        dayContent.className = 'day-content';
        
        if (raceInfo) {
            const raceBadge = document.createElement('div');
            raceBadge.className = 'race-badge';
            raceBadge.textContent = raceInfo.category.replace('RACE_', '');
            dayElement.appendChild(raceBadge);
        } else if (isCarboLoading) {
            const carbBadge = document.createElement('div');
            carbBadge.className = 'carb-loading-badge';
            carbBadge.textContent = 'CARB';
            dayElement.appendChild(carbBadge);
        }
        
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
        
        const nutritionInfo = this.calculateDayNutrition(fullDate, dayEvents, isCarboLoading);
        const nutritionDiv = document.createElement('div');
        nutritionDiv.className = 'nutrition-info';
        nutritionDiv.innerHTML = `
            <div><strong>${nutritionInfo.calories}</strong> cal</div>
            <div><strong>${nutritionInfo.carbs}g</strong> carbs</div>
        `;
        dayContent.appendChild(nutritionDiv);
        
        dayElement.appendChild(dayContent);
        
        dayElement.addEventListener('click', () => {
            this.showDayDetails(fullDate, dayEvents, isCarboLoading, raceInfo);
        });
        
        return dayElement;
    },
    
    getEventsForDate(date) {
        const dateStr = this.formatDate(date);
        return this.events.filter(event => {
            const eventDate = event.start_date_local.split('T')[0];
            return eventDate === dateStr;
        });
    },
    
    analyzeDayType(date, dayEvents) {
        const raceEvent = dayEvents.find(event => 
            event.category === 'RACE_A' || event.category === 'RACE_B' || event.category === 'RACE_C'
        );
        
        if (raceEvent) {
            return { raceInfo: raceEvent, isCarboLoading: false };
        }
        
        const upcomingRaces = this.findUpcomingRaces(date, 5);
        const importantRace = upcomingRaces.find(race => 
            race.category === 'RACE_A' || race.category === 'RACE_B'
        );
        
        if (importantRace) {
            const raceDateStr = importantRace.start_date_local.split('T')[0];
            const raceDate = new Date(raceDateStr + 'T12:00:00');
            const daysUntilRace = this.calculateDaysUntilRace(date, raceDate);
            
            if (daysUntilRace >= 1 && daysUntilRace <= 3) {
                return { raceInfo: null, isCarboLoading: true };
            }
        }
        
        return { raceInfo: null, isCarboLoading: false };
    },
    
    calculateDaysUntilRace(fromDate, raceDate) {
        const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const race = new Date(raceDate.getFullYear(), raceDate.getMonth(), raceDate.getDate());
        
        const timeDiff = race.getTime() - from.getTime();
        const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
        
        return daysDiff;
    },
    
    findUpcomingRaces(fromDate, daysAhead) {
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + daysAhead);
        
        return this.events.filter(event => {
            if (!event.category || !event.category.startsWith('RACE_')) return false;
            
            const eventDateStr = event.start_date_local.split('T')[0];
            const eventDate = new Date(eventDateStr + 'T12:00:00');
            
            const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
            const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            
            return eventDateOnly > fromDateOnly && eventDateOnly <= endDateOnly;
        });
    },

    calculateDayNutrition(date, dayEvents, isCarboLoading) {
        // This function now correctly gathers all necessary data before calling the calculator.
        let totalDuration = 0;
        let highestIntensity = 'none';
        const goals = 'weight-loss'; // Default goal for the calendar context
    
        const intensityRanking = {
            'none': 0,
            'easy': 1,
            'endurance': 2,
            'tempo': 3,
            'threshold': 4,
            'intervals': 5,
            'strength': 2
        };
    
        dayEvents.forEach(event => {
            const duration = Math.round((event.moving_time || event.duration || 3600) / 60);
            totalDuration += duration;
            let workoutType = 'endurance';
            if (event.category && event.category.startsWith('RACE_')) {
                workoutType = 'threshold';
            }
            if (intensityRanking[workoutType] > intensityRanking[highestIntensity]) {
                highestIntensity = workoutType;
            }
        });
    
        // Call the calculator with all arguments, so it doesn't need to touch the DOM.
        return nutritionCalculator.calculate(
            this.bodyWeight, 
            goals, 
            highestIntensity, 
            totalDuration, 
            isCarboLoading
        );
    },
    
    showDayDetails(date, dayEvents, isCarboLoading, raceInfo) {
        const modal = document.getElementById('dayDetailModal');
        const modalDate = document.getElementById('modalDate');
        const modalContent = document.getElementById('modalContent');
    
        modalDate.textContent = this.formatDateDisplay(date);
    
        // This function now correctly calls the one above to get the nutrition data.
        const nutrition = this.calculateDayNutrition(date, dayEvents, isCarboLoading);
    
        let content = '<div class="section">';
        if (raceInfo) {
            content += `<h3>🏁 ${raceInfo.category.replace('RACE_', '')}-Priority Race Day</h3>`;
        } else if (isCarboLoading) {
            content += '<h3>🍝 Carb Loading Day</h3>';
            const upcomingRaces = this.findUpcomingRaces(date, 5);
            const importantRace = upcomingRaces.find(race => race.category === 'RACE_A' || race.category === 'RACE_B');
            if (importantRace) {
                const raceDateStr = importantRace.start_date_local.split('T')[0];
                const raceDate = new Date(raceDateStr + 'T12:00:00');
                const daysUntilRace = this.calculateDaysUntilRace(date, raceDate);
                content += `<p>Preparing for <strong>${importantRace.name}</strong> in ${daysUntilRace} days</p>`;
            }
        } else {
            content += '<h3>📅 Training Day</h3>';
        }
    
        if (dayEvents.length > 0) {
            content += '<h4>Scheduled Workouts:</h4><ul>';
            dayEvents.forEach(event => {
                const duration = Math.round((event.moving_time || event.duration || 3600) / 60);
                content += `<li><strong>${event.name || event.type}</strong> - ${duration} minutes`;
                if (event.category && event.category.startsWith('RACE_')) {
                    content += ` <span style="color: #f44336; font-weight: bold;">[${event.category.replace('RACE_', '')} RACE]</span>`;
                }
                content += '</li>';
            });
            content += '</ul>';
        }
    
        content += '<h4>Daily Nutrition Target:</h4>';
        content += '<div class="macro-grid" style="margin: 15px 0;">';
        content += `<div class="macro-item"><div class="macro-value">${nutrition.calories}</div><div class="macro-label">Calories</div></div>`;
        content += `<div class="macro-item"><div class="macro-value">${nutrition.protein}g</div><div class="macro-label">Protein</div></div>`;
        content += `<div class="macro-item"><div class="macro-value">${nutrition.carbs}g</div><div class="macro-label">Carbs</div></div>`;
        content += `<div class="macro-item"><div class="macro-value">${nutrition.fat}g</div><div class="macro-label">Fat</div></div>`;
        content += '</div>';
    
        if (isCarboLoading) {
            content += '<div class="fueling-notes"><h4>Carb Loading Strategy:</h4><ul>';
            content += '<li>Focus on easily digestible carbs (pasta, rice, bread)</li>';
            content += '<li>Reduce fiber and fat intake slightly</li>';
            content += '<li>Stay well hydrated</li>';
            content += '<li>Avoid trying new foods</li>';
            content += '</ul></div>';
        }
    
        if (raceInfo) {
            const raceDuration = Math.round((raceInfo.moving_time || raceInfo.duration || 3600) / 60);
            content += '<div class="fueling-notes"><h4>Race Day Strategy:</h4><ul>';
            if (raceDuration > 60) {
                content += `<li>Pre-race: ${nutrition.fueling.preWorkoutCarbs} carbs 1-2 hours before</li>`;
                content += `<li>During race: ${nutrition.fueling.duringWorkoutCarbs}g carbs per hour</li>`;
                content += `<li>Hydration: ${nutrition.fueling.fluidIntake}ml per hour</li>`;
            } else {
                content += '<li>Pre-race meal 2-3 hours before</li>';
                content += '<li>Small carb snack 30-60 minutes before</li>';
            }
            content += '<li>Post-race: Focus on recovery nutrition within 30 minutes</li>';
            content += '</ul></div>';
        }
    
        content += '</div>';
        modalContent.innerHTML = content;
        modal.style.display = 'block';
    },

    closeModal() {
        document.getElementById('dayDetailModal').style.display = 'none';
    },
    
    handleModalClick(event) {
        if (event.target === event.currentTarget) {
            this.closeModal();
        }
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
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const monthYear = document.getElementById('monthYear');
        if (monthYear) {
            monthYear.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        }
    },
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },
    
    formatDateDisplay(date) {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    },
    
    isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    },
    
    daysBetween(startDate, endDate) {
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        
        const timeDiff = end.getTime() - start.getTime();
        return Math.round(timeDiff / (1000 * 3600 * 24));
    }
};
