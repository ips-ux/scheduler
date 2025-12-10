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

        // New Reservation Flow
        document.getElementById('new-reservation-btn').addEventListener('click', () => {
            document.getElementById('type-selection-modal').classList.remove('hidden');
        });

        // Type Selection
        document.querySelectorAll('.type-card').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.type;
                document.getElementById('type-selection-modal').classList.add('hidden');
                App.openReservationModal(null, type);
            });
        });

        // Close Modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });

        // Form
        document.getElementById('reservation-form').addEventListener('submit', App.handleFormSubmit);

        // Date/Time Change (for price calc)
        document.getElementById('res-start-date').addEventListener('change', App.calculatePrice);
        document.getElementById('res-start-time').addEventListener('change', App.calculatePrice);
        document.getElementById('res-end-date').addEventListener('change', App.calculatePrice);
        document.getElementById('res-end-time').addEventListener('change', App.calculatePrice);

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

    openReservationModal: (data = null, type = null) => {
        const modal = document.getElementById('reservation-modal');
        const form = document.getElementById('reservation-form');

        form.reset();
        document.getElementById('res-id').value = '';
        document.getElementById('modal-title').textContent = 'New Reservation';
        document.getElementById('override-container').classList.add('hidden');
        document.getElementById('price-container').classList.add('hidden');

        // Reset inputs
        const startDate = document.getElementById('res-start-date');
        const startTime = document.getElementById('res-start-time');
        const endDate = document.getElementById('res-end-date');
        const endTime = document.getElementById('res-end-time');

        startDate.readOnly = false;
        startTime.readOnly = false;
        endDate.readOnly = false;
        endTime.readOnly = false;

        // Show all time inputs by default
        startDate.closest('.form-group').classList.remove('hidden');
        endDate.closest('.form-group').classList.remove('hidden');

        if (data) {
            // Edit Mode
            document.getElementById('modal-title').textContent = 'Edit Reservation';
            document.getElementById('res-id').value = data.tx_id;
            document.getElementById('res-unit').value = data.rented_to;
            document.getElementById('res-type').value = data.resource_type;

            // Set Type logic
            App.handleTypeLogic(data.resource_type);

            document.getElementById('res-item').value = data.item;

            // Split Date/Time
            const start = new Date(data.start_time);
            const end = new Date(data.end_time);

            startDate.value = start.toISOString().split('T')[0];
            startTime.value = start.toTimeString().slice(0, 5);
            endDate.value = end.toISOString().split('T')[0];
            endTime.value = end.toTimeString().slice(0, 5);

            document.getElementById('res-notes').value = data.rental_notes || '';

            App.calculatePrice();
        } else if (type) {
            // New Mode with Type
            document.getElementById('res-type').value = type;
            App.handleTypeLogic(type);
        }

        modal.classList.remove('hidden');
    },

    handleTypeLogic: (type) => {
        const itemSelect = document.getElementById('res-item');
        const overrideContainer = document.getElementById('override-container');
        const priceContainer = document.getElementById('price-container');

        const startDate = document.getElementById('res-start-date');
        const startTime = document.getElementById('res-start-time');
        const endDate = document.getElementById('res-end-date');
        const endTime = document.getElementById('res-end-time');

        // Filter items
        itemSelect.innerHTML = '';
        const filteredItems = App.items.filter(i => i.resource_type === type);
        filteredItems.forEach(i => {
            const option = document.createElement('option');
            option.value = i.item;
            option.textContent = i.item;
            itemSelect.appendChild(option);
        });

        // Logic based on type
        if (type === 'GEAR_SHED') {
            // Hide times
            startTime.closest('.split-inputs').style.display = 'none'; // Hide time inputs specifically?
            // Actually, we want to hide the TIME input but keep DATE.
            // "Gear Shed: does not display time to the user"
            startTime.style.display = 'none';
            endTime.style.display = 'none';
            // Set defaults for hidden fields
            startTime.value = '10:00';
            endTime.value = '18:00';

        } else {
            startTime.style.display = 'block';
            endTime.style.display = 'block';
        }

        if (type === 'GUEST_SUITE') {
            priceContainer.classList.remove('hidden');
            // Enforce times visually
            startTime.value = '15:00';
            endTime.value = '11:00';
            startTime.readOnly = true;
            endTime.readOnly = true;
        } else if (type === 'SKY_LOUNGE') {
            overrideContainer.classList.remove('hidden');
            priceContainer.classList.remove('hidden');
            // Default times
            startTime.value = '16:00';
            endTime.value = '20:00';
        }

        App.calculatePrice();
    },

    calculatePrice: () => {
        const type = document.getElementById('res-type').value;
        const priceDisplay = document.getElementById('res-price');

        if (type === 'SKY_LOUNGE') {
            priceDisplay.textContent = '$300.00';
            return;
        }

        const sDate = document.getElementById('res-start-date').value;
        const eDate = document.getElementById('res-end-date').value;

        if (type === 'GUEST_SUITE' && sDate && eDate) {
            const start = new Date(sDate);
            const end = new Date(eDate);

            let cost = 0;
            let current = new Date(start);
            // Simple day loop
            while (current < end) {
                const day = current.getDay(); // 0=Sun, 6=Sat
                // Fri(5) and Sat(6) are weekends? 
                // "Fri-Sat" usually means Fri night and Sat night.
                // If day is 5 (Fri) or 6 (Sat), rate is higher.
                if (day === 5 || day === 6) cost += 175;
                else cost += 125;
                current.setDate(current.getDate() + 1);
                if (cost > 10000) break;
            }
            priceDisplay.textContent = `$${cost.toFixed(2)}`;
        } else {
            priceDisplay.textContent = '$0.00';
        }
    },

    handleFormSubmit: async (e) => {
        e.preventDefault();

        const type = document.getElementById('res-type').value;
        const itemSelect = document.getElementById('res-item');

        // Handle Multi-select
        const selectedItems = Array.from(itemSelect.selectedOptions).map(opt => opt.value);

        if (selectedItems.length === 0) {
            App.showAlert('Please select at least one item.', 'error');
            return;
        }

        // Combine Date/Time
        const sDate = document.getElementById('res-start-date').value;
        const sTime = document.getElementById('res-start-time').value;
        const eDate = document.getElementById('res-end-date').value;
        const eTime = document.getElementById('res-end-time').value;

        const startDateTime = `${sDate}T${sTime}`;
        const endDateTime = `${eDate}T${eTime}`;

        const formData = {
            rented_to: document.getElementById('res-unit').value,
            resource_type: type,
            items: selectedItems,
            start_time: startDateTime,
            end_time: endDateTime,
            rental_notes: document.getElementById('res-notes').value,
            override_lock: document.getElementById('res-override').checked
        };

        const id = document.getElementById('res-id').value;

        try {
            let response;
            if (id) {
                formData.tx_id = id;
                formData.item = selectedItems[0]; // Fallback for edit
                response = await API.updateReservation(formData);
            } else {
                response = await API.createReservation(formData);
            }

            if (response.status === 'success') {
                App.showAlert('Reservation saved!', 'success');
                document.getElementById('reservation-modal').classList.add('hidden');
                App.loadData();
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
                <td>${new Date(r.start).toLocaleDateString()} ${new Date(r.start).toLocaleTimeString()}</td>
                <td>${new Date(r.end).toLocaleDateString()} ${new Date(r.end).toLocaleTimeString()}</td>
                <td><span class="status-badge ${r.extendedProps.status.toLowerCase()}">${r.extendedProps.status}</span></td>
                <td>
                    <button class="icon-btn edit-btn" data-id="${r.extendedProps.tx_id}">Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Re-bind edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const res = App.reservations.find(r => r.extendedProps.tx_id === id);
                if (res) App.openReservationModal(res.extendedProps);
            });
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
    }
};

// Expose to window
window.App = App;

// Init if already logged in
if (localStorage.getItem('user_email')) {
    Auth.init();
}
