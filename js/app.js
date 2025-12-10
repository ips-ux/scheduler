/**
 * Main Application Logic
 */

const App = {
    calendar: null,
    items: [],
    reservations: [],

    init: async () => {
        console.log('App Initializing...');

        // Initialize Calendar
        App.initCalendar();

        // Load Data
        await App.loadData();

        // Event Listeners
        App.bindEvents();
    },

    initCalendar: () => {
        const calendarEl = document.getElementById('calendar');
        App.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: App.reservations,
            eventClick: (info) => {
                App.openReservationModal(info.event.extendedProps);
            },
            height: '100%'
        });
        App.calendar.render();
    },

    loadData: async () => {
        try {
            // Fetch Items
            const itemsResponse = await API.getItems();
            if (itemsResponse.status === 'success') {
                App.items = itemsResponse.data;
                App.populateItemSelect();
            }

            // Fetch Reservations
            const resResponse = await API.getReservations();
            if (resResponse.status === 'success') {
                App.reservations = resResponse.data.map(r => ({
                    title: `${r.rented_to} - ${r.item}`,
                    start: r.start_time,
                    end: r.end_time,
                    extendedProps: r,
                    backgroundColor: App.getStatusColor(r.status),
                    borderColor: App.getStatusColor(r.status)
                }));

                // Update Calendar
                App.calendar.removeAllEvents();
                App.calendar.addEventSource(App.reservations);

                // Update List View
                App.renderListView();
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            App.showAlert('Failed to load data.', 'error');
        }
    },

    bindEvents: () => {
        // View Switching
        document.getElementById('view-calendar').addEventListener('click', () => App.switchView('calendar'));
        document.getElementById('view-list').addEventListener('click', () => App.switchView('list'));

        // Modal
        document.getElementById('new-reservation-btn').addEventListener('click', () => App.openReservationModal());
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('reservation-modal').classList.add('hidden');
            });
        });

        // Form
        document.getElementById('reservation-form').addEventListener('submit', App.handleFormSubmit);

        // Resource Type Change
        document.getElementById('res-type').addEventListener('change', App.handleTypeChange);

        // Logout
        document.getElementById('logout-btn').addEventListener('click', Auth.logout);
    },

    switchView: (viewName) => {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

        if (viewName === 'calendar') {
            document.getElementById('calendar-view').classList.remove('hidden');
            document.getElementById('view-calendar').classList.add('active');
            App.calendar.render(); // Re-render to fix sizing
        } else {
            document.getElementById('list-view').classList.remove('hidden');
            document.getElementById('view-list').classList.add('active');
        }
    },

    openReservationModal: (data = null) => {
        const modal = document.getElementById('reservation-modal');
        const form = document.getElementById('reservation-form');

        form.reset();
        document.getElementById('res-id').value = '';
        document.getElementById('modal-title').textContent = 'New Reservation';
        document.getElementById('override-container').classList.add('hidden');

        if (data) {
            document.getElementById('modal-title').textContent = 'Edit Reservation';
            document.getElementById('res-id').value = data.tx_id; // Using tx_id as ID
            document.getElementById('res-unit').value = data.rented_to;
            document.getElementById('res-type').value = data.resource_type;
            App.handleTypeChange(); // Trigger item filter
            document.getElementById('res-item').value = data.item;

            // Format dates for datetime-local (YYYY-MM-DDTHH:mm)
            const start = new Date(data.start_time).toISOString().slice(0, 16);
            const end = new Date(data.end_time).toISOString().slice(0, 16);

            document.getElementById('res-start').value = start;
            document.getElementById('res-end').value = end;
            document.getElementById('res-notes').value = data.rental_notes || '';
        }

        modal.classList.remove('hidden');
    },

    handleTypeChange: () => {
        const type = document.getElementById('res-type').value;
        const itemSelect = document.getElementById('res-item');
        const overrideContainer = document.getElementById('override-container');

        // Filter items
        itemSelect.innerHTML = '<option value="">Select Item...</option>';
        const filteredItems = App.items.filter(i => i.resource_type === type);
        filteredItems.forEach(i => {
            const option = document.createElement('option');
            option.value = i.item;
            option.textContent = i.item;
            itemSelect.appendChild(option);
        });

        // Show/Hide Override
        if (type === 'SKY_LOUNGE') {
            overrideContainer.classList.remove('hidden');
        } else {
            overrideContainer.classList.add('hidden');
        }
    },

    handleFormSubmit: async (e) => {
        e.preventDefault();

        const formData = {
            rented_to: document.getElementById('res-unit').value,
            resource_type: document.getElementById('res-type').value,
            item: document.getElementById('res-item').value,
            start_time: document.getElementById('res-start').value,
            end_time: document.getElementById('res-end').value,
            rental_notes: document.getElementById('res-notes').value,
            override_lock: document.getElementById('res-override').checked
        };

        const id = document.getElementById('res-id').value;

        try {
            let response;
            if (id) {
                formData.tx_id = id;
                response = await API.updateReservation(formData);
            } else {
                response = await API.createReservation(formData);
            }

            if (response.status === 'success') {
                App.showAlert('Reservation saved!', 'success');
                document.getElementById('reservation-modal').classList.add('hidden');
                App.loadData(); // Refresh
            } else {
                App.showAlert(response.message || 'Error saving reservation', 'error');
            }
        } catch (error) {
            App.showAlert('An error occurred.', 'error');
        }
    },

    renderListView: () => {
        const tbody = document.querySelector('#reservations-table tbody');
        tbody.innerHTML = '';

        App.reservations.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.extendedProps.tx_id}</td>
                <td>${r.extendedProps.rented_to}</td>
                <td>${r.extendedProps.item}</td>
                <td>${new Date(r.start).toLocaleDateString()}</td>
                <td>${new Date(r.end).toLocaleDateString()}</td>
                <td><span class="status-badge ${r.extendedProps.status.toLowerCase()}">${r.extendedProps.status}</span></td>
                <td>
                    <button class="icon-btn edit-btn" data-id="${r.extendedProps.tx_id}">Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    showAlert: (msg, type = 'info') => {
        const container = document.getElementById('alert-container');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = msg;
        container.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    },

    getStatusColor: (status) => {
        switch (status) {
            case 'Scheduled': return '#1a237e';
            case 'Complete': return '#10b981';
            case 'Cancelled': return '#ef4444';
            default: return '#6b7280';
        }
    },

    populateItemSelect: () => {
        // Initial population if needed, but mostly handled by handleTypeChange
    }
};

// Expose to window
window.App = App;

// Init if already logged in
if (localStorage.getItem('user_email')) {
    Auth.init();
}
