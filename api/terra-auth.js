// api/terra-auth.js - Terra API Authentication
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method === 'GET') {
        // Return Terra auth URL for MyFitnessPal
        try {
            const terraApiKey = process.env.TERRA_API_KEY || 'your-terra-api-key';
            const terraDevId = process.env.TERRA_DEV_ID || 'your-terra-dev-id';
            const redirectUri = process.env.TERRA_REDIRECT_URI || 'https://your-app.vercel.app/terra-callback';
            
            const authUrl = `https://api.tryterra.co/v2/auth/generateAuthURL`;
            
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': terraApiKey,
                    'dev-id': terraDevId
                },
                body: JSON.stringify({
                    resource: 'MYFITNESSPAL',
                    auth_success_redirect_url: redirectUri,
                    auth_failure_redirect_url: redirectUri,
                    lang: 'en'
                })
            });
            
            if (!response.ok) {
                throw new Error(`Terra API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            return res.status(200).json({
                authUrl: data.auth_url,
                userId: data.user_id
            });
            
        } catch (error) {
            console.error('Terra auth error:', error);
            return res.status(500).json({
                error: 'Failed to generate auth URL',
                details: error.message
            });
        }
    }
    
    if (req.method === 'POST') {
        // Handle auth callback/token exchange
        try {
            const { code, state } = req.body;
            
            // In a real implementation, you'd exchange the code for tokens
            // For now, we'll just return success
            return res.status(200).json({
                success: true,
                message: 'Authentication successful'
            });
            
        } catch (error) {
            console.error('Terra auth callback error:', error);
            return res.status(500).json({
                error: 'Authentication failed',
                details: error.message
            });
        }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}

// api/terra-nutrition.js - Fetch nutrition data from MyFitnessPal via Terra
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { userId, date, endDate } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const terraApiKey = process.env.TERRA_API_KEY || 'your-terra-api-key';
        const terraDevId = process.env.TERRA_DEV_ID || 'your-terra-dev-id';
        
        // Format dates for Terra API
        const startDate = date || new Date().toISOString().split('T')[0];
        const endDateFormatted = endDate || startDate;
        
        // Fetch nutrition data from Terra API
        const nutritionUrl = `https://api.tryterra.co/v2/nutrition`;
        
        const response = await fetch(nutritionUrl, {
            method: 'GET',
            headers: {
                'X-API-Key': terraApiKey,
                'dev-id': terraDevId
            },
            // In real implementation, you'd pass user_id and date parameters
        });
        
        if (!response.ok) {
            // Return mock data if Terra API is not available
            return res.status(200).json(generateMockNutritionData(startDate));
        }
        
        const data = await response.json();
        
        // Process Terra nutrition data
        const processedData = processTerraData(data, startDate);
        
        return res.status(200).json(processedData);
        
    } catch (error) {
        console.error('Terra nutrition API error:', error);
        
        // Return mock data as fallback
        const mockData = generateMockNutritionData(req.body.date || new Date().toISOString().split('T')[0]);
        return res.status(200).json(mockData);
    }
}

// Helper function to process Terra API data
function processTerraData(terraData, date) {
    // Process Terra's nutrition data format
    const nutrition = terraData.data?.[0]?.nutrition || {};
    
    return {
        date: date,
        source: 'myfitnesspal',
        calories: nutrition.calories_consumed || 0,
        protein: Math.round(nutrition.protein_g || 0),
        carbs: Math.round(nutrition.carbs_g || 0),
        fat: Math.round(nutrition.fat_g || 0),
        fiber: Math.round(nutrition.fiber_g || 0),
        sugar: Math.round(nutrition.sugar_g || 0),
        sodium: Math.round(nutrition.sodium_mg || 0),
        meals: processMeals(terraData.data?.[0]?.meals || []),
        lastSync: new Date().toISOString()
    };
}

// Helper function to process meal data
function processMeals(mealsData) {
    const mealTypes = {
        'breakfast': { icon: '🌅', name: 'Breakfast' },
        'lunch': { icon: '🌞', name: 'Lunch' },
        'dinner': { icon: '🌙', name: 'Dinner' },
        'snacks': { icon: '🍎', name: 'Snacks' }
    };
    
    return mealsData.map(meal => {
        const mealType = meal.meal_type?.toLowerCase() || 'snacks';
        const typeInfo = mealTypes[mealType] || mealTypes['snacks'];
        
        return {
            icon: typeInfo.icon,
            name: typeInfo.name,
            time: meal.time || '12:00',
            calories: meal.calories || 0,
            protein: Math.round(meal.protein_g || 0),
            carbs: Math.round(meal.carbs_g || 0),
            fat: Math.round(meal.fat_g || 0),
            foods: meal.foods?.map(food => food.name).join(', ') || 'No foods logged',
            status: getMealStatus(meal)
        };
    });
}

// Helper function to determine meal status
function getMealStatus(meal) {
    const calories = meal.calories || 0;
    
    if (calories === 0) return 'Not logged ❌';
    if (calories < 200) return 'Light meal ⚠️';
    if (calories > 800) return 'Large meal 📊';
    return 'Good portion ✅';
}

// Generate realistic mock data for development/fallback
function generateMockNutritionData(date) {
    const baseCalories = 2200 + (Math.random() * 800 - 400); // 1800-2600 range
    const variance = 0.85 + (Math.random() * 0.3); // 85-115% adherence
    
    const targetCalories = Math.round(baseCalories);
    const actualCalories = Math.round(targetCalories * variance);
    
    // Calculate macros based on realistic ratios
    const protein = Math.round((actualCalories * 0.2) / 4); // 20% protein
    const carbs = Math.round((actualCalories * 0.5) / 4);   // 50% carbs  
    const fat = Math.round((actualCalories * 0.3) / 9);     // 30% fat
    
    // Generate meal data
    const meals = generateMockMeals(actualCalories);
    
    return {
        date: date,
        source: 'myfitnesspal_mock',
        calories: actualCalories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        fiber: Math.round(25 + Math.random() * 15), // 25-40g fiber
        sugar: Math.round(carbs * 0.3), // ~30% of carbs as sugar
        sodium: Math.round(2000 + Math.random() * 1000), // 2000-3000mg sodium
        meals: meals,
        lastSync: new Date().toISOString(),
        isMockData: true
    };
}

// Generate realistic mock meal data
function generateMockMeals(totalCalories) {
    const mealDistribution = {
        breakfast: 0.25,
        lunch: 0.35, 
        dinner: 0.30,
        snacks: 0.10
    };
    
    const mealTypes = [
        { 
            icon: '🌅', 
            name: 'Breakfast (6:30 AM)', 
            type: 'breakfast',
            foods: ['Oatmeal with berries', 'Greek yogurt', 'Coffee'],
            targetRatio: mealDistribution.breakfast
        },
        { 
            icon: '🌞', 
            name: 'Lunch (12:15 PM)', 
            type: 'lunch',
            foods: ['Chicken salad', 'Quinoa', 'Mixed vegetables'],
            targetRatio: mealDistribution.lunch
        },
        { 
            icon: '🌙', 
            name: 'Dinner (7:00 PM)', 
            type: 'dinner', 
            foods: ['Salmon', 'Sweet potato', 'Broccoli', 'Brown rice'],
            targetRatio: mealDistribution.dinner
        },
        { 
            icon: '🍎', 
            name: 'Snacks', 
            type: 'snacks',
            foods: ['Apple with almond butter', 'Protein bar'],
            targetRatio: mealDistribution.snacks
        }
    ];
    
    return mealTypes.map(meal => {
        const mealCalories = Math.round(totalCalories * meal.targetRatio * (0.8 + Math.random() * 0.4));
        const protein = Math.round((mealCalories * 0.2) / 4);
        const carbs = Math.round((mealCalories * 0.5) / 4);
        const fat = Math.round((mealCalories * 0.3) / 9);
        
        return {
            icon: meal.icon,
            name: meal.name,
            time: meal.name.includes('(') ? meal.name.match(/\(([^)]+)\)/)[1] : '12:00',
            calories: mealCalories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            foods: meal.foods.join(', '),
            status: getMealStatusFromCalories(mealCalories, meal.type)
        };
    });
}

// Helper to generate meal status based on calories and meal type
function getMealStatusFromCalories(calories, mealType) {
    const targets = {
        breakfast: { min: 300, max: 600 },
        lunch: { min: 500, max: 800 },
        dinner: { min: 400, max: 750 },
        snacks: { min: 100, max: 300 }
    };
    
    const target = targets[mealType] || targets.snacks;
    
    if (calories === 0) return 'Not logged ❌';
    if (calories < target.min) return 'Below target ⚠️';
    if (calories > target.max) return 'Above target 📊';
    return 'On target ✅';
}

// js/terra-api.js - Frontend Terra API integration
const terraAPI = {
    // Check if user is authenticated with MyFitnessPal
    async checkAuthStatus() {
        const stored = localStorage.getItem('terra_mfp_auth');
        if (stored) {
            const auth = JSON.parse(stored);
            // Check if auth is still valid (not expired)
            return auth.expires_at > Date.now();
        }
        return false;
    },

    // Get Terra authentication URL for MyFitnessPal
    async getAuthUrl() {
        try {
            const response = await fetch('/api/terra-auth', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Auth API error: ${response.status}`);
            }

            const data = await response.json();
            return data.authUrl;

        } catch (error) {
            console.error('Terra auth URL error:', error);
            throw error;
        }
    },

    // Fetch nutrition data from MyFitnessPal via Terra
    async fetchNutritionData(date, endDate = null) {
        try {
            console.log('🍎 Fetching MyFitnessPal nutrition data for', date);

            const response = await fetch('/api/terra-nutrition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.getUserId(),
                    date: date,
                    endDate: endDate
                })
            });

            if (!response.ok) {
                throw new Error(`Nutrition API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('📊 Received nutrition data:', data);

            // Cache the data
            this.cacheNutritionData(date, data);

            return data;

        } catch (error) {
            console.error('Terra nutrition fetch error:', error);
            
            // Return cached data if available
            const cached = this.getCachedNutritionData(date);
            if (cached) {
                console.log('📦 Using cached nutrition data');
                return cached;
            }
            
            throw error;
        }
    },

    // Get stored user ID
    getUserId() {
        const auth = localStorage.getItem('terra_mfp_auth');
        if (auth) {
            return JSON.parse(auth).userId;
        }
        return 'demo_user'; // Fallback for demo
    },

    // Cache nutrition data locally
    cacheNutritionData(date, data) {
        const cacheKey = `nutrition_${date}`;
        const cacheData = {
            ...data,
            cachedAt: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    },

    // Get cached nutrition data
    getCachedNutritionData(date) {
        const cacheKey = `nutrition_${date}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            // Return if cached within last 2 hours
            if (Date.now() - data.cachedAt < 2 * 60 * 60 * 1000) {
                return data;
            }
        }
        return null;
    },

    // Store authentication data
    storeAuthData(authData) {
        const auth = {
            ...authData,
            expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        localStorage.setItem('terra_mfp_auth', JSON.stringify(auth));
    },

    // Clear authentication
    clearAuth() {
        localStorage.removeItem('terra_mfp_auth');
        // Clear all cached nutrition data
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('nutrition_')) {
                localStorage.removeItem(key);
            }
        });
    }
};

// Enhanced nutrition calculator with Terra integration
const nutritionCalculatorEnhanced = {
    ...nutritionCalculator,

    // Calculate nutrition with actual MyFitnessPal data
    async calculateWithActualData(bodyWeightLbs, goals, workoutType, duration, date, workouts = null, isRaceDay = false, isPostRace = false, isCarboLoading = false) {
        // Get base nutrition plan
        const basePlan = this.calculateWithCompletionData(
            bodyWeightLbs, goals, workoutType, duration, date, workouts, isRaceDay, isPostRace, isCarboLoading
        );

        // Try to get actual nutrition data for past dates
        const selectedDate = new Date(date);
        const today = new Date();
        
        if (selectedDate < today) {
            try {
                const actualData = await terraAPI.fetchNutritionData(date);
                if (actualData) {
                    return {
                        ...basePlan,
                        actualData: actualData,
                        hasActualData: true
                    };
                }
            } catch (error) {
                console.warn('Could not fetch actual nutrition data:', error);
            }
        }

        return basePlan;
    },

    // Format results with actual vs planned comparison
    formatNutritionResultsWithActual(nutrition) {
        if (!nutrition.hasActualData) {
            return this.formatNutritionResults(nutrition, nutrition.actualData);
        }

        const actual = nutrition.actualData;
        const planned = {
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat
        };

        // Calculate adherence percentages
        const adherence = {
            calories: Math.round((actual.calories / planned.calories) * 100),
            protein: Math.round((actual.protein / planned.protein) * 100),
            carbs: Math.round((actual.carbs / planned.carbs) * 100),
            fat: Math.round((actual.fat / planned.fat) * 100)
        };

        const overallAdherence = Math.round((adherence.calories + adherence.protein + adherence.carbs + adherence.fat) / 4);

        let html = `
            <div class="nutrition-card">
                <h3>🎯 Nutrition Plan vs Actual ${actual.isMockData ? '(Sample Data)' : ''}</h3>
                
                <div class="nutrition-comparison">
                    <div class="adherence-summary">
                        <div class="adherence-score ${overallAdherence >= 85 ? 'excellent' : overallAdherence >= 70 ? 'good' : 'needs-improvement'}">${overallAdherence}%</div>
                        <div class="adherence-text">Overall Nutrition Adherence ${overallAdherence >= 85 ? '✅' : overallAdherence >= 70 ? '⚠️' : '❌'}</div>
                        <div class="data-source">Data from: MyFitnessPal ${actual.isMockData ? '(Demo)' : ''}</div>
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
                </div>

                ${actual.meals ? this.formatMealBreakdown(actual.meals) : ''}
            </div>
        `;

        // Add adjustment information if applied
        if (nutrition.adjustmentApplied) {
            html += this.formatAdjustmentInfo(nutrition);
        }

        // Add fueling information
        if (nutrition.fueling) {
            html += this.formatFuelingInfo(nutrition.fueling);
        }

        return html;
    },

    // Format meal breakdown
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
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { terraAPI, nutritionCalculatorEnhanced };
}
