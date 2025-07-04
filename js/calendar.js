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
        
        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Add previous month's trailing days
        const prevMonth = new Date(year, month, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonth.getDate() - i;
            const dayElement = this.createDayElement(day, true, new Date(year, month - 1, day));
            grid.appendChild(dayElement);
        }
        
        // Add current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = this.createDayElement(day, false, new Date(year, month, day));
            grid.appendChild(dayElement);
        }
        
        // Add next month's leading days to fill the grid
        const totalCells = grid.children.length - 7; // Subtract header row
        const cellsNeeded = Math.ceil(totalCells / 7) * 7 - totalCells + 7;
        
        for (let day = 1; day <= cellsNeeded; day++) {
            const dayElement = this.createDayElement(day, true, new Date(year, month + 1, day));
            grid.appendChild(dayElement);
        }
    },
    
    createDayElement(day, isOtherMonth, fullDate) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }
        
        // Check if it's today
        const today = new Date();
        if (this.isSameDate(fullDate, today)) {
            dayElement.classList.add('today');
        }
        
        // Get events for this day
        const dayEvents = this.getEventsForDate(fullDate);
        const { raceInfo, isCarboLoading } = this.analyzeDayType(fullDate, dayEvents);
        
        // Apply day styling based on type
        if (raceInfo) {
            dayElement.classList.add('race-day');
        } else if (isCarboLoading) {
            dayElement.classList.add('carb-loading');
        }
        
        // Create day content
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);
        
        const dayContent = document.createElement('div');
        dayContent.className = 'day-content';
        
        // Add race badge
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
        
        // Add workout items
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
        
        // Add nutrition info
        if (dayEvents.length > 0 || isCarboLoading) {
            const nutritionInfo = this.calculateDayNutrition(fullDate, dayEvents, isCarboLoading);
            const nutritionDiv = document.createElement('div');
            nutritionDiv.className = 'nutrition-info';
            nutritionDiv.innerHTML = `
                <div><strong>${nutritionInfo.calories}</strong> cal</div>
                <div><strong>${nutritionInfo.carbs}g</strong> carbs</div>
            `;
            dayContent.appendChild(nutritionDiv);
        }
        
        dayElement.appendChild(dayContent);
        
        // Add click handler
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
        // Check if this day has a race
        const raceEvent = dayEvents.find(event => 
            event.category === 'RACE_A' || event.category === 'RACE_B' || event.category === 'RACE_C'
        );
        
        if (raceEvent) {
            return { raceInfo: raceEvent, isCarboLoading: false };
        }
        
        // Check if this is within carb-loading window (3-7 days before A or B race)
        const upcomingRaces = this.findUpcomingRaces(date, 7);
        const importantRace = upcomingRaces.find(race => 
            race.category === 'RACE_A' || race.category === 'RACE_B'
        );
        
        if (importantRace) {
            const daysUntilRace = this.daysBetween(date, new Date(importantRace.start_date_local));
            if (daysUntilRace >= 3 && daysUntilRace <= 7) {
                return { raceInfo: null, isCarboLoading: true };
            }
        }
        
        return { raceInfo: null, isCarboLoading: false };
    },
    
    findUpcomingRaces(fromDate, daysAhead) {
        const endDate = new Date(fromDate);
        endDate.setDate(endDate.getDate() + daysAhead);
        
        return this.events.filter(event => {
            if (!event.category || !event.category.startsWith('RACE_')) return false;
            
            const eventDate = new Date(event.start_date_local);
            return eventDate > fromDate && eventDate <= endDate;
        });
    },
    
    calculateDayNutrition(date, dayEvents, isCarboLoading) {
        // Base calculation using existing nutrition module
        let totalDuration = 0;
        let highestIntensity = 'none';
        
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
            
            // Map workout type (simplified)
            let workoutType = 'endurance';
            if (event.category && event.category.startsWith('RACE_')) {
                workoutType = 'threshold'; // Assume race pace
            }
            
            if (intensityRanking[workoutType] > intensityRanking[highestIntensity]) {
                highestIntensity = workoutType;
            }
        });
        
        // Calculate base nutrition
        const nutrition = nutritionCalculator.calculate(this.bodyWeight, 'weight-loss', highestIntensity, totalDuration);
        
        // Adjust for carb loading
        if (isCarboLoading) {
            const upcomingRaces = this.findUpcomingRaces(date, 7);
            const importantRace = upcomingRaces.find(race => 
                race.category === 'RACE_A' || race.category === 'RACE_B'
            );
            
            if (importantRace) {
                const daysUntilRace = this.daysBetween(date, new Date(importantRace.start_date_local));
                
                // Carb loading formula: increase carbs based on days until race
                if (daysUntilRace >= 3) {
                    const carbMultiplier = 1.5 + (0.1 * (7 - daysUntilRace)); // 1.5x to 1.9x
                    nutrition.carbs = Math.round(nutrition.carbs * carbMultiplier);
                    nutrition.calories = (nutrition.protein * 4) + (nutrition.fat * 9) + (nutrition.carbs * 4);
                }
            }
        }
        
        return nutrition;
    },
    
    showDayDetails(date, dayEvents, isCarboLoading, raceInfo) {
        const modal = document.getElementById('dayDetailModal');
        const modalDate = document.getElementById('modalDate');
        const modalContent = document.getElementById('modalContent');
        
        modalDate.textContent = this.formatDateDisplay(date);
        
        const nutrition = this.calculateDayNutrition(date, dayEvents, isCarboLoading);
        
        let content = '<div class="section">';
        
        // Day type header
        if (raceInfo) {
            content += `<h3>🏁 ${raceInfo.category.replace('RACE_', '')}-Priority Race Day</h3>`;
        } else if (isCarboLoading) {
            content += '<h3>🍝 Carb Loading Day</h3>';
            const upcomingRaces = this.findUpcomingRaces(date, 7);
            const importantRace = upcomingRaces.find(race => 
                race.category === 'RACE_A' || race.category === 'RACE_B'
            );
            if (importantRace) {
                const daysUntilRace = this.daysBetween(date, new Date(importantRace.start_date_local));
                content += `<p>Preparing for <strong>${importantRace.name}</strong> in ${daysUntilRace} days</p>`;
            }
        } else {
            content += '<h3>📅 Training Day</h3>';
        }
        
        // Workouts
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
        
        // Nutrition plan
        content += '<h4>Daily Nutrition Target:</h4>';
        content += '<div class="macro-grid" style="margin: 15px 0;">';
        content += `<div class="macro-item"><div class="macro-value">${nutrition.calories}</div><div class="macro-label">Calories</div></div>`;
        content += `<div class="macro-item"><div class="macro-value">${nutrition.protein}g</div><div class="macro-label">Protein</div></div>`;
        content += `<div class="macro-item"><div class="macro-value">${nutrition.carbs}g</div><div class="macro-label">Carbs</div></div>`;
        content += `<div class="macro-item"><div class="macro-value">${nutrition.fat}g</div><div class="macro-label">Fat</div></div>`;
        content += '</div>';
        
        // Carb loading guidance
        if (isCarboLoading) {
            content += '<div class="fueling-notes"><h4>Carb Loading Strategy:</h4><ul>';
            content += '<li>Focus on easily digestible carbs (pasta, rice, bread)</li>';
            content += '<li>Reduce fiber and fat intake slightly</li>';
            content += '<li>Stay well hydrated</li>';
            content += '<li>Avoid trying new foods</li>';
            content += '</ul></div>';
        }
        
        // Race day specific advice
        if (raceInfo) {
            const raceDuration = Math.round((raceInfo.moving_time || raceInfo.duration || 3600) / 60);
            content += '<div class="fueling-notes"><h4>Race Day Strategy:</h4><ul>';
            if (raceDuration > 60) {
                content += `<li>Pre-race: ${nutrition.fueling.preWorkoutCarbs}g carbs 1-2 hours before</li>`;
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
    
    
    daysBetween(startDate, endDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }
};
