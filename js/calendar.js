// Include the Terra API code at the top of calendar.js
const terraAPI = {
    async checkAuthStatus() {
        const stored = localStorage.getItem('terra_mfp_auth');
        if (stored) {
            const auth = JSON.parse(stored);
            return auth.expires_at > Date.now();
        }
        return false;
    },

    async getAuthUrl() {
        try {
            const response = await fetch('/api/terra-auth', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
            const data = await response.json();
            return data.authUrl;
        } catch (error) {
            console.error('Terra auth URL error:', error);
            throw error;
        }
    },

    async fetchNutritionData(date, endDate = null) {
        try {
            console.log('🍎 Fetching MyFitnessPal nutrition data for', date);

            const response = await fetch('/api/terra-nutrition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.getUserId(),
                    date: date,
                    endDate: endDate
                })
            });

            if (!response.ok) throw new Error(`Nutrition API error: ${response.status}`);
            const data = await response.json();
            
            this.cacheNutritionData(date, data);
            return data;
        } catch (error) {
            console.error('Terra nutrition fetch error:', error);
            const cached = this.getCachedNutritionData(date);
            if (cached) return cached;
            throw error;
        }
    },

    getUserId() {
        const auth = localStorage.getItem('terra_mfp_auth');
        return auth ? JSON.parse(auth).userId : 'demo_user';
    },

    cacheNutritionData(date, data) {
        const cacheKey = `nutrition_${date}`;
        const cacheData = { ...data, cachedAt: Date.now() };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    },

    getCachedNutritionData(date) {
        const cacheKey = `nutrition_${date}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.cachedAt < 2 * 60 * 60 * 1000) return data;
        }
        return null;
    },

    storeAuthData(authData) {
        const auth = { ...authData, expires_at: Date.now() + (24 * 60 * 60 * 1000) };
        localStorage.setItem('terra_mfp_auth', JSON.stringify(auth));
    },

    clearAuth() {
        localStorage.removeItem('terra_mfp_auth');
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('nutrition_')) localStorage.removeItem(key);
        });
    }
};

// Enhanced Calendar Manager with Terra Integration
const calendarManager = {
    // ... keep all existing properties ...
    currentDate: new Date(),
    events: [],
    bodyWeight: 192,
    goals: 'performance',
    mfpConnected: false,

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
    
    async init() {
        this.updateMonthYear();
        
        // Check MyFitnessPal connection status
        this.mfpConnected = await terraAPI.checkAuthStatus();
        this.updateMFPConnectionStatus();
        
        this.loadCalendarData(); 
        
        document.getElementById('goals')?.addEventListener('change', () => this.handleSettingsChange());
        document.getElementById('bodyWeight')?.addEventListener('change', () => this.handleSettingsChange());
        document.getElementById('apiKey')?.addEventListener('change', () => this.handleSettingsChange());

        // Add MFP connection handlers
        document.getElementById('connectMFPBtn')?.addEventListener('click', () => this.connectToMFP());
        document.getElementById('disconnectMFPBtn')?.addEventListener('click', () => this.disconnectFromMFP());

        document.querySelector('.day-detail-modal')?.addEventListener('click', (e) => this.handleModalClick(e));
        document.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
    },

    updateMFPConnectionStatus() {
        const statusIndicator = document.getElementById('mfpStatusIndicator');
        const statusText = document.getElementById('mfpStatusText');
        const connectBtn = document.getElementById('connectMFPBtn');
        const disconnectBtn = document.getElementById('disconnectMFPBtn');
        const syncInfo = document.getElementById('mfpSyncInfo');

        if (this.mfpConnected) {
            statusIndicator?.classList.remove('disconnected');
            statusText.textContent = 'Connected to MyFitnessPal';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
            syncInfo.textContent = 'Last sync: ' + new Date().toLocaleTimeString();
        } else {
            statusIndicator?.classList.add('disconnected');
            statusText.textContent = 'Not connected';
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
            syncInfo.textContent = 'Connect to sync nutrition data';
        }
    },

    async connectToMFP() {
        try {
            const authUrl = await terraAPI.getAuthUrl();
            window.open(authUrl, '_blank', 'width=500,height=600');
            
            // Listen for auth completion (you'd implement this based on your callback)
            this.listenForAuthCompletion();
        } catch (error) {
            alert('Failed to connect to MyFitnessPal: ' + error.message);
        }
    },

    disconnectFromMFP() {
        terraAPI.clearAuth();
        this.mfpConnected = false;
        this.updateMFPConnectionStatus();
        this.renderCalendar(); // Refresh to remove MFP data
    },

    listenForAuthCompletion() {
        // Simulate successful auth for demo
        setTimeout(() => {
            terraAPI.storeAuthData({ userId: 'demo_user_' + Date.now() });
            this.mfpConnected = true;
            this.updateMFPConnectionStatus();
            this.renderCalendar(); // Refresh calendar with new data
        }, 3000);
    },
    
    // ... keep all existing methods but update calculateDayNutrition ...

    async calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, date) {
        const totalDuration = dayEvents.reduce((acc, e) => acc + Math.round((e.moving_time || e.duration || 0) / 60), 0);
        
        let highestIntensity = 'none';
        const intensityRanking = { 'none': 0, 'easy': 1, 'strength': 2, 'endurance': 3, 'tempo': 4, 'threshold': 5, 'intervals': 6 };
        
        dayEvents.forEach(event => {
            const workoutType = this.workoutMapper.map(event);
            if (intensityRanking[workoutType] > intensityRanking[highestIntensity]) {
                highestIntensity = workoutType;
            }
        });
        
        if (typeof nutritionCalculator === 'undefined') {
            return {
                calories: 2500, protein: 125, carbs: 300, fat: 85,
                fueling: { duringWorkoutCarbs: 0, fluidIntake: 750, fuelingTips: [] }
            };
        }
        
        // Calculate base nutrition
        let nutrition = nutritionCalculator.calculateWithCompletionData(
            this.bodyWeight, this.goals, highestIntensity, totalDuration,
            date, dayEvents, !!raceInfo, isPostRace, isCarboLoading
        );

        // Try to get actual MyFitnessPal data for past dates
        const selectedDate = new Date(date);
        const today = new Date();
        
        if (selectedDate < today && this.mfpConnected) {
            try {
                const actualData = await terraAPI.fetchNutritionData(date);
                if (actualData) {
                    nutrition.actualData = actualData;
                    nutrition.hasActualData = true;
                }
            } catch (error) {
                console.warn('Could not fetch actual nutrition data:', error);
            }
        }

        return nutrition;
    },

    async showDayDetails(date, dayEvents, raceInfo, isCarboLoading, isPostRace) {
        const modal = document.getElementById('dayDetailModal');
        const modalDate = document.getElementById('modalDate');
        const modalContent = document.getElementById('modalContent');
        
        modalDate.textContent = this.formatDateDisplay(date);
        
        // Show loading state
        modalContent.innerHTML = '<div class="loading">Loading nutrition data...</div>';
        modal.style.display = 'block';
        
        // Calculate nutrition (with potential MFP data)
        const nutrition = await this.calculateDayNutrition(dayEvents, raceInfo, isCarboLoading, isPostRace, date);
        
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
                            if (completion.perceivedEffort) workoutHtml += ` (RPE: ${completion.perceivedEffort})`;
                            if (completion.avgHeartRate) workoutHtml += ` (Avg HR: ${completion.avgHeartRate})`;
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
        
        // Format nutrition results with actual vs planned if available
        const nutritionHtml = nutrition.hasActualData ? 
            this.formatNutritionWithActual(nutrition) : 
            (typeof nutritionCalculator !== 'undefined' ? 
                nutritionCalculator.formatNutritionResults(nutrition, nutrition.actualData) : 
                this.formatBasicNutrition(nutrition));
        
        modalContent.innerHTML = `
            <div class="section">
                <h3>${headerText}</h3>
                ${workoutDetailsHtml}
                ${nutritionHtml}
            </div>
        `;
        
        // Animate progress circles after modal is shown
        setTimeout(() => {
            this.animateProgressCircles();
        }, 100);
    },

    formatNutritionWithActual(nutrition) {
        if (!nutrition.hasActualData) {
            return nutritionCalculator.formatNutritionResults(nutrition);
        }

        const actual = nutrition.actualData;
        const planned = {
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat
        };

        const adherence = {
            calories: Math.round((actual.calories / planned.calories) * 100),
            protein: Math.round((actual.protein / planned.protein) * 100),
            carbs: Math.round((actual.carbs / planned.carbs) * 100),
            fat: Math.round((actual.fat / planned.fat) * 100)
        };

        const overallAdherence = Math.round((adherence.calories + adherence.protein + adherence.carbs + adherence.fat) / 4);

        return `
            <div class="nutrition-comparison">
                <h4>🎯 Nutrition Plan vs Actual ${actual.isMockData ? '(Sample Data)' : ''}</h4>
                
                <div class="adherence-summary">
                    <div class="adherence-score ${overallAdherence >= 85 ? 'excellent' : overallAdherence >= 70 ? 'good' : 'needs-improvement'}">${overallAdherence}%</div>
                    <div class="adherence-text">Overall Nutrition Adherence ${overallAdherence >= 85 ? '✅' : overallAdherence >= 70 ? '⚠️' : '❌'}</div>
                    <div class="data-source">📱 Data from: MyFitnessPal ${actual.isMockData ? '(Demo)' : ''}</div>
                </div>

                <div class="comparison-grid">
                    <div class="comparison-item">
                        <div class="macro-label">Calories</div>
                        <div class="planned-actual">
                            <div class="planned">Target: ${planned.calories}</div>
                            <div class="actual ${adherence.calories >= 85 ? 'good' : adherence.calories >= 70 ? 'fair' : 'poor'}">
                                Actual: ${actual.calories} (${adherence.calories}%)
                            </div>
                        </div>
                    </div>

                    <div class="comparison-item">
                        <div class="macro-label">Protein</div>
                        <div class="planned-actual">
                            <div class="planned">Target: ${planned.protein}g</div>
                            <div class="actual ${adherence.protein >= 85 ? 'good' : adherence.protein >= 70 ? 'fair' : 'poor'}">
                                Actual: ${actual.protein}g (${adherence.protein}%)
                            </div>
                        </div>
                    </div>

                    <div class="comparison-item">
                        <div class="macro-label">Carbs</div>
                        <div class="planned-actual">
                            <div class="planned">Target: ${planned.carbs}g</div>
                            <div class="actual ${adherence.carbs >= 85 ? 'good' : adherence.carbs >= 70 ? 'fair' : 'poor'}">
                                Actual: ${actual.carbs}g (${adherence.carbs}%)
                            </div>
                        </div>
                    </div>

                    <div class="comparison-item">
                        <div class="macro-label">Fat</div>
                        <div class="planned-actual">
                            <div class="planned">Target: ${planned.fat}g</div>
                            <div class="actual ${adherence.fat >= 85 ? 'good' : adherence.fat >= 70 ? 'fair' : 'poor'}">
                                Actual: ${actual.fat}g (${adherence.fat}%)
                            </div>
                        </div>
                    </div>
                </div>

                ${actual.meals ? this.formatMealBreakdown(actual.meals) : ''}
            </div>
        `;
    },

    formatMealBreakdown(meals) {
        return `
            <div class="meal-breakdown">
                <h4>🍽️ Meal Breakdown</h4>
                <div class="meals-grid">
                    ${meals.map(meal => `
                        <div class="meal-item">
                            <div class="meal-header">
                                <span class="meal-icon">${meal.icon}</span>
                                <span class="meal-name">${meal.name}</span>
                                <span class="meal-status">${meal.status}</span>
                            </div>
                            <div class="meal-macros">
                                <div class="meal-calories">${meal.calories} cal</div>
                                <div class="meal-breakdown-macros">
                                    ${meal.protein}g P • ${meal.carbs}g C • ${meal.fat}g F
                                </div>
                            </div>
                            <div class="meal-foods">${meal.foods}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    formatBasicNutrition(nutrition) {
        return `
            <div class="nutrition-card">
                <h3>🎯 Daily Nutrition Target</h3>
                <div class="macro-grid">
                    <div class="macro-item"><div class="macro-value">${nutrition.calories}</div><div class="macro-label">Calories</div></div>
                    <div class="macro-item"><div class="macro-value">${nutrition.protein}g</div><div class="macro-label">Protein</div></div>
                    <div class="macro-item"><div class="macro-value">${nutrition.carbs}g</div><div class="macro-label">Carbs</div></div>
                    <div class="macro-item"><div class="macro-value">${nutrition.fat}g</div><div class="macro-label">Fat</div></div>
                </div>
            </div>
        `;
    },

    // ... keep all other existing methods (renderCalendar, previousMonth, etc.) ...
    
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
            document.getElementById('weeklySummary').style.display = 'block';
            
            this.renderCalendar();
            this.renderWeeklySummary();
        } catch (error) {
            console.error('Calendar loading error:', error);
            loadingState.innerHTML = `<h3>Error loading calendar. Check your API key.</h3><p>${error.message}</p>`;
        }
    },

    // Keep all the other existing methods unchanged...
    renderCalendar() { /* existing code */ },
    renderMobileList() { /* existing code */ },
    createDayElement() { /* existing code */ },
    getEventsForDate() { /* existing code */ },
    analyzeDayType() { /* existing code */ },
    calculateDaysUntilRace() { /* existing code */ },
    findUpcomingRaces() { /* existing code */ },
    animateProgressCircles() { /* existing code */ },
    renderWeeklySummary() { /* existing code */ },
    generateWeeklySummaryData() { /* existing code */ },
    closeModal() { /* existing code */ },
    handleModalClick() { /* existing code */ },
    previousMonth() { /* existing code */ },
    nextMonth() { /* existing code */ },
    goToToday() { /* existing code */ },
    updateMonthYear() { /* existing code */ },
    formatDate() { /* existing code */ },
    formatDateDisplay() { /* existing code */ },
    isSameDate() { /* existing code */ }
};
