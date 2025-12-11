/**
 * API Handler for Amenity Scheduler
 * Handles communication with Google Apps Script Web App
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxFtnSX9H2Gf300S0uJH5JOrNPZeXPaGdNfvxlLCRDH_lNb4ht3VtPMSuxEJ3gbpuZhKQ/exec';

const API = {
    // Check if API is configured
    isConfigured: () => {
        return API_URL && API_URL !== 'YOUR_GAS_WEB_APP_URL';
    },

    // Generic fetch wrapper
    request: async (action, payload = {}) => {
        if (!API.isConfigured()) {
            console.warn('API URL not configured. Using mock data.');
            return API.mockResponse(action, payload);
        }

        try {
            // GAS Web Apps often have CORS issues with POST, so we use no-cors or JSONP if needed.
            // However, for a standard setup, we'll try standard POST with text/plain to avoid preflight if possible,
            // or rely on the GAS script handling CORS correctly (doGet/doPost).
            // A common pattern for GAS is sending data as JSON string in body.

            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({ action, ...payload })
            });

            const data = await response.json();
            if (data.status === 'error') {
                throw new Error(data.message);
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
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
                                    start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                                    end_time: new Date(Date.now() + 259200000).toISOString(), // +3 days
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
    getReservations: () => API.request('getReservations'),
    getItems: () => API.request('getItems'),
    createReservation: (reservation) => API.request('createReservation', { reservation }),
    updateReservation: (reservation) => API.request('updateReservation', { reservation }),
    cancelReservation: (tx_id) => API.request('cancelReservation', { tx_id })
};
