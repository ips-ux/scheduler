/**
 * API Handler for Amenity Scheduler
 * Handles communication with Google Apps Script Web App
 * Implements Stale-While-Revalidate caching strategy
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwezMor58DMRrDTLMS0OdjZZQqlck-Gl5urK7uJJVB6IbldrFoaoNGo6qGtHSWXIfBcTQ/exec';

const API = {
    // Check if API is configured
    isConfigured: () => {
        return API_URL && API_URL !== 'YOUR_GAS_WEB_APP_URL';
    },

    /**
     * Generic fetch wrapper with Stale-While-Revalidate strategy
     * @param {string} action - The API action to perform
     * @param {object} payload - Data to send
     * @param {object} options - { useCache: boolean, forceRefresh: boolean }
     * @returns {Promise<{data: any, revalidation?: Promise}>}
     */
    request: async (action, payload = {}, options = {}) => {
        const { useCache = true, forceRefresh = false } = options;

        if (!API.isConfigured()) {
            console.warn('API URL not configured. Using mock data.');
            return API.mockResponse(action, payload);
        }

        // 1. Determine if we can use cache
        const cacheableActions = ['getReservations', 'getItems', 'getStaff'];
        const isCacheable = cacheableActions.includes(action);
        const cacheKey = action;

        // 2. Try to get from cache first
        let cachedResult = null;
        if (isCacheable && useCache && !forceRefresh) {
            cachedResult = Cache.get(cacheKey);
        }

        // 3. Define the network fetch function
        const fetchFromNetwork = async () => {
            try {
                console.log(`📡 Fetching ${action} from network...`);
                const response = await fetch(API_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action, ...payload })
                });

                const data = await response.json();
                if (data.status === 'error') throw new Error(data.message);

                // Update cache if cacheable
                if (isCacheable) {
                    const hasChanged = Cache.hasChanged(cacheKey, data.data);
                    if (hasChanged) {
                        console.log(`↻ Data updated for ${action}`);
                        Cache.set(cacheKey, data.data);
                        return { ...data, hasUpdate: true };
                    } else {
                        console.log(`✓ Data unchanged for ${action}`);
                        return { ...data, hasUpdate: false };
                    }
                }

                return data;
            } catch (error) {
                console.error(`API Error (${action}):`, error);
                throw error;
            }
        };

        // 4. Stale-While-Revalidate Logic
        if (cachedResult) {
            console.log(`⚡ Returning cached ${action} immediately`);

            // Return cached data immediately + a promise for the background update
            return {
                status: 'success',
                data: cachedResult.data,
                fromCache: true,
                // The revalidation promise will resolve with new data ONLY if it changed
                revalidation: fetchFromNetwork().then(networkResult => {
                    if (networkResult.hasUpdate) {
                        return networkResult;
                    }
                    return null; // No update needed
                }).catch(err => {
                    console.warn('Background revalidation failed:', err);
                    return null;
                })
            };
        }

        // 5. No cache available (or force refresh) - await network
        return await fetchFromNetwork();
    },

    // Mock responses for development
    mockResponse: (action, payload) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                switch (action) {
                    case 'getReservations':
                        resolve({
                            status: 'success',
                            data: [
                                {
                                    tx_id: 'mock-1',
                                    rented_to: '101',
                                    item: 'Guest Suite',
                                    resource_type: 'GUEST_SUITE',
                                    status: 'Scheduled',
                                    start_time: new Date(Date.now() + 86400000).toISOString(),
                                    end_time: new Date(Date.now() + 259200000).toISOString(),
                                    total_cost: 250
                                }
                            ]
                        });
                        break;
                    case 'getItems':
                        resolve({
                            status: 'success',
                            data: [
                                { item: 'Guest Suite', resource_type: 'GUEST_SUITE' },
                                { item: 'Sky Lounge', resource_type: 'SKY_LOUNGE' },
                                { item: 'Kayak 1', resource_type: 'GEAR_SHED' },
                                { item: 'Kayak 2', resource_type: 'GEAR_SHED' }
                            ]
                        });
                        break;
                    default:
                        resolve({ status: 'success', message: 'Mock success' });
                }
            }, 500);
        });
    },

    // Methods
    getReservations: (options = {}) => API.request('getReservations', {}, options),
    getItems: (options = {}) => API.request('getItems', {}, options),
    getStaff: (options = {}) => API.request('getStaff', {}, options),
    createReservation: (reservation) => API.request('createReservation', { reservation }, { useCache: false }),
    updateReservation: (reservation) => API.request('updateReservation', { reservation }, { useCache: false }),
    cancelReservation: (tx_id) => API.request('cancelReservation', { tx_id }, { useCache: false }),
    deleteReservation: (tx_id) => API.request('deleteReservation', { tx_id }, { useCache: false }),
    restoreReservation: (tx_id) => API.request('restoreReservation', { tx_id }, { useCache: false })
};
