// Workout Completion Tracker Module (inline for compatibility)
const workoutCompletionTracker = {
    // Analyze completed workout against planned workout
    analyzeWorkoutCompletion(plannedWorkout, completionData) {
        if (!completionData) return null;
        
        console.log('🎯 Analyzing workout completion:', plannedWorkout.name);
        
        const planned = this.extractPlannedMetrics(plannedWorkout);
        const actual = this.extractActualMetrics(completionData);
        
        const variance = this.calculateVariance(planned, actual);
        const adjustment = this.generateAdjustmentRecommendation(variance, planned, actual);
        
        const analysis = {
            workoutId: plannedWorkout.id,
            workoutName: plannedWorkout.name,
            date: plannedWorkout.start_date_local.split('T')[0],
            planned,
            actual,
            variance,
            adjustment,
            severity: this.calculateAdjustmentSeverity(variance),
            timestamp: new Date()
        };
        
        completionDataStore.store(plannedWorkout.id, analysis.date, analysis);
        return analysis;
    },
    
    extractPlannedMetrics(plannedWorkout) {
        const plannedDuration = Math.round((plannedWorkout.moving_time || plannedWorkout.duration || 3600) / 60);
        const plannedIntensity = this.mapWorkoutTypeToIntensity(plannedWorkout);
        
        return {
            duration: plannedDuration,
            intensity: plannedIntensity,
            intensityScore: this.getIntensityScore(plannedIntensity),
            estimatedStress: this.calculateStressScore(plannedDuration, plannedIntensity),
            type: plannedWorkout.type || 'workout'
        };
    },
    
    extractActualMetrics(completionData) {
        const actualIntensity = this.calculateActualIntensity(completionData);
        
        return {
            duration: completionData.actualDuration,
            intensity: actualIntensity,
            intensityScore: this.getIntensityScore(actualIntensity),
            actualStress: this.calculateStressScore(completionData.actualDuration, actualIntensity),
            avgHeartRate: completionData.avgHeartRate,
            maxHeartRate: completionData.maxHeartRate,
            avgPower: completionData.avgPower,
            perceivedEffort: completionData.perceivedEffort,
            calories: completionData.calories,
            tss: completionData.trainingStressScore
        };
    },
    
    mapWorkoutTypeToIntensity(workout) {
        const name = (workout.name || '').toLowerCase();
        const type = (workout.type || '').toLowerCase();
        
        if (name.includes('recovery') || name.includes('easy')) return 'easy';
        if (name.includes('tempo') || name.includes('zone 3')) return 'tempo';
        if (name.includes('threshold') || name.includes('zone 4')) return 'threshold';
        if (name.includes('interval') || name.includes('zone 5')) return 'intervals';
        if (name.includes('strength endurance') || name.includes('low cadence')) return 'intervals';
        if (name.includes('strength') || type.includes('strength')) return 'strength';
        
        return 'endurance';
    },
    
    calculateActualIntensity(completionData) {
        // Use RPE if available (most reliable)
        if (completionData.perceivedEffort) {
            if (completionData.perceivedEffort <= 3) return 'easy';
            if (completionData.perceivedEffort <= 5) return 'endurance';
            if (completionData.perceivedEffort <= 6) return 'tempo';
            if (completionData.perceivedEffort <= 8) return 'threshold';
            return 'intervals';
        }
        
        // Use heart rate zones if available
        if (completionData.avgHeartRate && completionData.maxHeartRate) {
            const hrPercent = completionData.avgHeartRate / completionData.maxHeartRate;
            if (hrPercent < 0.65) return 'easy';
            if (hrPercent < 0.75) return 'endurance';
            if (hrPercent < 0.85) return 'tempo';
            if (hrPercent < 0.92) return 'threshold';
            return 'intervals';
        }
        
        // Use TSS if available
        if (completionData.trainingStressScore) {
            const tssPerHour = completionData.trainingStressScore / (completionData.actualDuration / 60);
            if (tssPerHour < 60) return 'easy';
            if (tssPerHour < 80) return 'endurance';
            if (tssPerHour < 100) return 'tempo';
            if (tssPerHour < 120) return 'threshold';
            return 'intervals';
        }
        
        // Fallback to duration-based estimation
        if (completionData.actualDuration > 150) return 'endurance';
        if (completionData.actualDuration < 45) return 'intervals';
        return 'tempo';
    },
    
    getIntensityScore(intensity) {
        const scores = { 'easy': 1, 'endurance': 2, 'tempo': 3, 'threshold': 4, 'intervals': 5, 'strength': 2 };
        return scores[intensity] || 2;
    },
    
    calculateStressScore(duration, intensity) {
        const intensityMultipliers = { 
            'easy': 0.6, 
            'endurance': 1.0, 
            'tempo': 1.4, 
            'threshold': 1.8, 
            'intervals': 2.2,
            'strength': 1.2
        };
        return (duration / 60) * (intensityMultipliers[intensity] || 1.0);
    },
    
    calculateVariance(planned, actual) {
        return {
            durationVariance: (actual.duration - planned.duration) / planned.duration,
            intensityVariance: (actual.intensityScore - planned.intensityScore) / planned.intensityScore,
            stressVariance: (actual.actualStress - planned.estimatedStress) / planned.estimatedStress,
            absoluteDurationDiff: actual.duration - planned.duration,
            absoluteIntensityDiff: actual.intensityScore - planned.intensityScore
        };
    },
    
    calculateAdjustmentSeverity(variance) {
        const totalVariance = Math.abs(variance.durationVariance) + Math.abs(variance.intensityVariance);
        
        if (totalVariance > 0.8) return 'high';
        if (totalVariance > 0.4) return 'medium';
        if (totalVariance > 0.15) return 'low';
        return 'none';
    },
    
    generateAdjustmentRecommendation(variance, planned, actual) {
        if (this.calculateAdjustmentSeverity(variance) === 'none') {
            return null;
        }
        
        let calorieAdjustment = 0;
        let carbAdjustment = 0;
        let proteinAdjustment = 0;
        const reasoning = [];
        
        // Duration-based adjustments
        if (Math.abs(variance.durationVariance) > 0.15) {
            const durationMinutes = variance.absoluteDurationDiff;
            const durationCalories = durationMinutes * 10;
            calorieAdjustment += durationCalories;
            carbAdjustment += durationCalories * 0.6 / 4;
            
            reasoning.push(
                durationMinutes > 0 
                    ? `Workout was ${Math.round(Math.abs(variance.durationVariance) * 100)}% longer than planned (+${durationMinutes} min)`
                    : `Workout was ${Math.round(Math.abs(variance.durationVariance) * 100)}% shorter than planned (${durationMinutes} min)`
            );
        }
        
        // Intensity-based adjustments
        if (Math.abs(variance.intensityVariance) > 0.2) {
            const intensityCalories = variance.absoluteIntensityDiff * 120;
            calorieAdjustment += intensityCalories;
            carbAdjustment += intensityCalories * 0.7 / 4;
            
            reasoning.push(
                variance.intensityVariance > 0
                    ? `Workout was more intense than planned (${actual.intensity} vs ${planned.intensity})`
                    : `Workout was less intense than planned (${actual.intensity} vs ${planned.intensity})`
            );
        }
        
        // High stress/RPE adjustments
        if (actual.perceivedEffort && actual.perceivedEffort >= 8) {
            calorieAdjustment += 150;
            proteinAdjustment += 10;
            reasoning.push(`High perceived effort (RPE ${actual.perceivedEffort}) - increasing recovery nutrition`);
        }
        
        // TSS-based fine-tuning
        if (actual.tss && actual.tss > 100) {
            calorieAdjustment += Math.min(100, (actual.tss - 100) * 2);
            reasoning.push(`High training stress (TSS: ${actual.tss}) detected`);
        }
        
        if (!proteinAdjustment) {
            proteinAdjustment = Math.round(calorieAdjustment * 0.15 / 4);
        }
        const fatAdjustment = Math.round(calorieAdjustment * 0.25 / 9);
        
        return {
            calories: Math.round(calorieAdjustment),
            carbs: Math.round(carbAdjustment),
            protein: proteinAdjustment,
            fat: fatAdjustment,
            reasoning: reasoning,
            timing: this.getTimingRecommendations(variance, actual),
            recovery: this.getRecoveryRecommendations(actual)
        };
    },
    
    getTimingRecommendations(variance, actual) {
        const recommendations = [];
        
        if (variance.intensityVariance > 0.3 || (actual.perceivedEffort && actual.perceivedEffort >= 7)) {
            recommendations.push('Prioritize post-workout nutrition within 30 minutes');
            recommendations.push('Increase carb intake in the 2 hours post-workout');
        }
        
        if (variance.durationVariance > 0.3) {
            recommendations.push('Extend post-workout fueling window');
            recommendations.push('Consider larger evening meal to support recovery');
        }
        
        if (actual.actualDuration > 120) {
            recommendations.push('Focus on glycogen replenishment over next 24 hours');
        }
        
        return recommendations;
    },
    
    getRecoveryRecommendations(actual) {
        const recommendations = [];
        
        if (actual.perceivedEffort && actual.perceivedEffort >= 8) {
            recommendations.push('Prioritize hydration and electrolyte replacement');
            recommendations.push('Consider anti-inflammatory foods (tart cherry, turmeric)');
            recommendations.push('Ensure adequate sleep (8+ hours)');
        }
        
        if (actual.tss && actual.tss > 150) {
            recommendations.push('High stress session - extra recovery focus needed');
            recommendations.push('Consider lighter training tomorrow');
        }
        
        if (actual.actualDuration > 180) {
            recommendations.push('Long session - monitor hydration status');
            recommendations.push('Split tomorrow\'s nutrition into smaller, frequent meals');
        }
        
        return recommendations;
    },
    
    applyAdjustmentToNutrition(baseNutrition, adjustment) {
        if (!adjustment) return baseNutrition;
        
        return {
            ...baseNutrition,
            calories: baseNutrition.calories + adjustment.calories,
            protein: baseNutrition.protein + adjustment.protein,
            carbs: baseNutrition.carbs + adjustment.carbs,
            fat: baseNutrition.fat + adjustment.fat,
            adjustmentApplied: true,
            adjustmentDetails: {
                reason: adjustment.reasoning.join('; '),
                timing: adjustment.timing,
                recovery: adjustment.recovery,
                originalPlan: {
                    calories: baseNutrition.calories,
                    protein: baseNutrition.protein,
                    carbs: baseNutrition.carbs,
                    fat: baseNutrition.fat
                }
            }
        };
    }
};

// Enhanced Calendar Manager
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
        loadingState.innerHTML = '<h3>Loading your enhanced nutrition calendar...</h3><p>Fetching workouts and completion data from Intervals.icu...</p>';
        loadingState.style.display = 'block';
        
        try {
            const startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
            const endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 2, 0);
            
            const { athleteId } = intervalsAPI.getDefaults();
            
            this.events = await intervalsAPI.loadWorkoutsForDateRangeWithCompletion(
                apiKey, athleteId, this.formatDate(startDate), this.formatDate(endDate)
            );
            
            const completedCount = this.events.filter(e => e.isCompleted).length;
            console.log(`📊 Loaded ${this.events.length} events for calendar (${completedCount} with completion data)`);
            
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
        
        // Debug logging
        console.log(`🎯 Calculating nutrition for ${date}:`, {
            raceInfo: !!raceInfo,
            isCarboLoading,
            isPostRace,
            highestIntensity,
            totalDuration,
            dayEvents: dayEvents.map(e => ({ name: e.name, category: e.category }))
        });
        
        return nutritionCalculator.calculateWithCompletionData(
            this.bodyWeight, 
            this.goals, 
            highestIntensity, 
            totalDuration,
            date,
            dayEvents,
            !!raceInfo,  // isRaceDay
            isPostRace,  // isPostRace 
            isCarboLoading  // isCarboLoading
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
