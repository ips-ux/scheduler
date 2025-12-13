/**
 * Main Application Logic
 */

const App = {
    calendar: null,
    items: [],
    reservations: [],
    staff: [],
    selectedStaff: null,

    init: async () => {
        console.log('App Initializing...');

        // Initialize Calendar
        App.initCalendar();
        App.initTimePicker();
        App.initStaffSelector();
        App.initNotifications();

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
            dateClick: (info) => {
                // Store the clicked date for use in reservation creation
                App.clickedDate = info.dateStr;
                // Open type selection modal
                document.getElementById('type-selection-modal').classList.remove('hidden');
            },
            height: '100%'
        });
        App.calendar.render();
    },

    loadData: async (forceRefresh = false, manageSpinner = true) => {
        try {
            // Show loading indicator only if not using cache (or forcing refresh)
            const refreshBtn = document.getElementById('refresh-data-btn');

            const handleResponse = async (response, type) => {
                if (response.status === 'success') {
                    // Update Data
                    if (type === 'items') App.items = response.data;
                    if (type === 'staff') {
                        App.staff = response.data;
                        App.renderStaffList();
                    }
                    if (type === 'reservations') {
                        App.reservations = response.data.map(r => ({
                            title: `${r.rented_to} - ${r.item}`,
                            start: r.start_time,
                            end: r.end_time,
                            extendedProps: r,
                            classNames: [r.status.toLowerCase()],
                            backgroundColor: App.getStatusColor(r.status),
                            borderColor: App.getStatusBorderColor(r.status),
                            textColor: App.getStatusTextColor(r.status)
                        }));

                        // Update UI
                        App.calendar.removeAllEvents();
                        App.calendar.addEventSource(App.reservations);
                        App.renderListView();
                        App.updateNotifications();
                    }

                    // Handle Background Revalidation
                    if (response.revalidation) {
                        console.log(`⏳ Background updating ${type}...`);
                        if (refreshBtn) refreshBtn.classList.add('spinning');

                        try {
                            const freshResponse = await response.revalidation;
                            if (freshResponse) {
                                console.log(`✨ New data received for ${type}! Updating UI...`);
                                await handleResponse(freshResponse, type);
                                // Silent update - don't show alert (action-specific messages shown instead)
                            } else {
                                console.log(`✓ Background check complete: ${type} is up to date.`);
                            }
                        } catch (err) {
                            console.warn(`Background update failed for ${type}`, err);
                        } finally {
                            if (refreshBtn) refreshBtn.classList.remove('spinning');
                        }
                    }
                }
            };

            // Start loading
            if (manageSpinner && forceRefresh && refreshBtn) refreshBtn.classList.add('spinning');

            // Fetch Items
            const itemsPromise = API.getItems({ forceRefresh }).then(res => handleResponse(res, 'items'));

            // Fetch Staff
            const staffPromise = API.getStaff({ forceRefresh }).then(res => handleResponse(res, 'staff'));

            // Fetch Reservations
            const resPromise = API.getReservations({ forceRefresh }).then(res => handleResponse(res, 'reservations'));

            await Promise.all([itemsPromise, staffPromise, resPromise]);

        } catch (error) {
            console.error('Failed to load data:', error);
            App.showAlert('Failed to load data.', 'error');
        } finally {
            if (manageSpinner) {
                const refreshBtn = document.getElementById('refresh-data-btn');
                if (refreshBtn) refreshBtn.classList.remove('spinning');
            }
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

        // Back to amenity selection (or close if editing)
        const backBtn = document.getElementById('back-to-amenity');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const isEditMode = document.getElementById('res-id').value !== '';
                if (isEditMode) {
                    document.getElementById('reservation-modal').classList.add('hidden');
                } else {
                    document.getElementById('reservation-modal').classList.add('hidden');
                    document.getElementById('type-selection-modal').classList.remove('hidden');
                }
            });
        }

        // Form
        document.getElementById('reservation-form').addEventListener('submit', App.handleFormSubmit);

        // Cancel Reservation
        document.getElementById('cancel-reservation-btn').addEventListener('click', App.handleCancellation);

        // Restore Reservation
        document.getElementById('restore-reservation-btn').addEventListener('click', App.handleRestore);

        // Complete Reservation
        document.getElementById('complete-reservation-btn').addEventListener('click', App.handleCompleteClick);

        // Complete Reservation Form
        document.getElementById('complete-reservation-form').addEventListener('submit', App.handleCompleteSubmit);

        // Date/Time Change (for price calc and complete button state)
        document.getElementById('res-start-date').addEventListener('change', App.calculatePrice);
        document.getElementById('res-start-time').addEventListener('change', App.calculatePrice);
        document.getElementById('res-end-date').addEventListener('change', () => {
            App.calculatePrice();
            // Update complete button state when end date changes
            const resId = document.getElementById('res-id').value;
            if (resId) {
                App.updateCompleteButtonState();
            }
        });
        document.getElementById('res-end-time').addEventListener('change', App.calculatePrice);

        // Refresh Data
        document.getElementById('refresh-data-btn').addEventListener('click', () => {
            App.loadData(true); // Force refresh
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', Auth.logout);

        // Enhance Date/Time Inputs
        App.enhanceDateInputs();
    },

    enhanceDateInputs: () => {
        const inputs = document.querySelectorAll('input[type="date"], input[type="time"]');
        inputs.forEach(input => {
            // Show picker on mousedown (fixes double-click issue)
            // Show picker on mousedown (fixes double-click issue)
            input.addEventListener('mousedown', (e) => {
                // Ignore clicks on the calendar icon (approx 25px from right)
                // This prevents conflict with native picker behavior
                // Only apply to date inputs to avoid blocking time inputs
                if (input.type === 'date' && e.offsetX > input.offsetWidth - 25) return;

                // Ignore if custom picker is enabled
                if (input.dataset.customPicker) return;

                if ('showPicker' in HTMLInputElement.prototype) {
                    try {
                        input.showPicker();
                        e.preventDefault(); // Prevent default focus behavior to avoid conflict
                    } catch (err) {
                        console.warn('showPicker not supported or failed:', err);
                    }
                }
            });

            // Prevent manual typing (allow Tab for navigation)
            input.addEventListener('keydown', (e) => {
                if (e.key !== 'Tab') {
                    e.preventDefault();
                }
            });

            // Ensure focus triggers picker too (for keyboard nav)
            input.addEventListener('focus', () => {
                if ('showPicker' in HTMLInputElement.prototype) {
                    try {
                        input.showPicker();
                    } catch (err) {
                        // Ignore errors on focus (e.g. if not user-triggered)
                    }
                }
            });
        });
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

        // Reset all form controls to enabled state
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = false);

        document.getElementById('res-id').value = '';
        document.getElementById('modal-title').textContent = 'New Reservation';
        document.getElementById('override-container').classList.add('hidden');
        document.getElementById('price-container').classList.add('hidden');

        // Hide tracking info by default
        document.getElementById('tracking-info').classList.add('hidden');

        // Reset price label to default
        document.getElementById('price-label').textContent = 'Cost';

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

        // If there's a clicked date from the calendar, pre-populate the start date
        if (!data && App.clickedDate) {
            startDate.value = App.clickedDate;
            // Clear the clicked date after using it
            App.clickedDate = null;
        }

        if (data) {
            // Edit Mode
            document.getElementById('modal-title').textContent = 'Edit Reservation';
            document.getElementById('res-id').value = data.tx_id;
            document.getElementById('res-unit').value = data.rented_to;
            document.getElementById('res-type').value = data.resource_type;

            // Set Type logic
            App.handleTypeLogic(data.resource_type);

            // For Gear Shed, we need to populate all items with the same tx_id
            if (data.resource_type === 'GEAR_SHED') {
                // Find all reservations with the same tx_id to get all items
                const allItemsForReservation = App.reservations
                    .filter(r => r.extendedProps.tx_id === data.tx_id)
                    .map(r => r.extendedProps.item);

                // Find the item_id for each item name and add to selectedGearShedItems
                App.selectedGearShedItems = [];
                allItemsForReservation.forEach(itemName => {
                    const itemObj = App.currentGearShedItems.find(i => i.item === itemName);
                    if (itemObj) {
                        App.selectedGearShedItems.push(itemObj.item_id);
                    }
                });

                // Re-render the dual panel to show the selected items
                App.renderGearShedDualPanel();
            } else {
                // For other types, set the item normally
                document.getElementById('res-item').value = data.item;
            }

            // Split Date/Time
            const start = new Date(data.start_time);
            const end = new Date(data.end_time);

            startDate.value = start.toISOString().split('T')[0];
            startTime.value = start.toTimeString().slice(0, 5);
            endDate.value = end.toISOString().split('T')[0];
            endTime.value = end.toTimeString().slice(0, 5);

            document.getElementById('res-notes').value = data.rental_notes || '';

            // Display tracking information
            if (data.scheduled_by) {
                const trackingInfo = document.getElementById('tracking-info');
                const scheduledBySpan = document.getElementById('tracking-scheduled-by');
                const editedByContainer = document.getElementById('tracking-edit-container');
                const editedBySpan = document.getElementById('tracking-edited-by');

                trackingInfo.classList.remove('hidden');
                scheduledBySpan.textContent = data.scheduled_by;

                // Show edit info if available
                if (data.edit_by && data.last_update) {
                    editedByContainer.classList.remove('hidden');
                    editedBySpan.textContent = `${data.edit_by} (${data.last_update})`;
                } else {
                    editedByContainer.classList.add('hidden');
                }
            }

            // Handle price display
            if (data.status === 'Cancelled') {
                // Show cancellation fee from database
                const priceLabel = document.getElementById('price-label');
                const priceDisplay = document.getElementById('res-price');
                priceLabel.textContent = 'Cancellation Fee';
                priceDisplay.textContent = `$${parseFloat(data.total_cost || 0).toFixed(2)}`;
            } else {
                // Calculate regular price
                const priceLabel = document.getElementById('price-label');
                priceLabel.textContent = 'Cost';
                App.calculatePrice();
            }
        } else if (type) {
            // New Mode with Type
            document.getElementById('res-type').value = type;
            App.handleTypeLogic(type);

            // Set intelligent defaults based on type and start date
            if (startDate.value) {
                const clickedDateObj = new Date(startDate.value + 'T00:00:00');

                if (type === 'GUEST_SUITE') {
                    // Set start to clicked date at 3pm
                    startTime.value = '15:00';

                    // Set end to 2 days later at 11am (minimum stay)
                    const endDateObj = new Date(clickedDateObj);
                    endDateObj.setDate(endDateObj.getDate() + 2);
                    endDate.value = endDateObj.toISOString().split('T')[0];
                    endTime.value = '11:00';
                } else if (type === 'SKY_LOUNGE') {
                    // Default to 4pm start, 8pm end (4 hours)
                    startTime.value = '16:00';
                    endTime.value = '20:00';
                    endDate.value = startDate.value; // Same day
                } else if (type === 'GEAR_SHED') {
                    // Set to same day
                    endDate.value = startDate.value;
                    // Times are already set to 10:00 and 18:00 by handleTypeLogic
                }

                // Recalculate price with new dates
                App.calculatePrice();
            }
        }

        // Show/Hide Cancel Button & Handle Cancelled State
        const cancelBtn = document.getElementById('cancel-reservation-btn');
        const restoreBtn = document.getElementById('restore-reservation-btn');
        const completeBtn = document.getElementById('complete-reservation-btn');
        const saveBtn = document.querySelector('#reservation-form button[type="submit"]');

        if (data) {
            cancelBtn.classList.remove('hidden');

            if (data.status === 'Cancelled') {
                // Read-Only Mode for Cancelled Reservations
                document.getElementById('modal-title').textContent = 'Edit Cancelled Reservation';
                inputs.forEach(input => input.disabled = true);
                saveBtn.classList.add('hidden');
                completeBtn.classList.add('hidden');

                // Show price container for cancelled reservations (displays cancellation fee)
                const priceContainer = document.getElementById('price-container');
                priceContainer.classList.remove('hidden');

                // Show Restore button and change Cancel button to Delete button
                restoreBtn.classList.remove('hidden');
                cancelBtn.textContent = 'Delete Reservation';
                cancelBtn.dataset.action = 'delete';
            } else if (data.status === 'Complete') {
                // Read-Only Mode for Completed Reservations
                document.getElementById('modal-title').textContent = 'View Completed Reservation';
                inputs.forEach(input => input.disabled = true);
                saveBtn.classList.add('hidden');
                cancelBtn.classList.add('hidden');
                restoreBtn.classList.add('hidden');
                completeBtn.classList.add('hidden');
            } else {
                // Normal Edit Mode (Scheduled status)
                inputs.forEach(input => input.disabled = false);
                saveBtn.classList.remove('hidden');
                restoreBtn.classList.add('hidden');
                completeBtn.classList.remove('hidden');

                // Reset Cancel button
                cancelBtn.textContent = 'Cancel Reservation';
                cancelBtn.dataset.action = 'cancel';

                // Check if complete button should be enabled
                App.updateCompleteButtonState(data);
            }
        } else {
            // New Reservation Mode
            cancelBtn.classList.add('hidden');
            restoreBtn.classList.add('hidden');
            completeBtn.classList.add('hidden');
            inputs.forEach(input => input.disabled = false);
            saveBtn.classList.remove('hidden');
            cancelBtn.dataset.action = 'cancel';
        }

        modal.classList.remove('hidden');
    },

    handleTypeLogic: (type) => {
        const itemSelect = document.getElementById('res-item');
        const itemSelectGroup = document.getElementById('item-select-group');
        const overrideContainer = document.getElementById('override-container');
        const priceContainer = document.getElementById('price-container');

        const startDate = document.getElementById('res-start-date');
        const startTime = document.getElementById('res-start-time');
        const endDate = document.getElementById('res-end-date');
        const endTime = document.getElementById('res-end-time');

        // Reset custom picker flag
        startTime.removeAttribute('data-custom-picker');

        // Clear items
        itemSelect.innerHTML = '';



        // Hide item selector for Guest Suite and Sky Lounge (space itself is the item)
        if (type === 'GUEST_SUITE' || type === 'SKY_LOUNGE') {
            itemSelectGroup.classList.add('hidden');
            itemSelect.removeAttribute('required'); // Remove required since field is hidden

            // Auto-select the space name as the item
            const option = document.createElement('option');
            option.value = type === 'GUEST_SUITE' ? 'Guest Suite' : 'Sky Lounge';
            option.textContent = option.value;
            option.selected = true;
            itemSelect.appendChild(option);
        } else {
            // Show item selector for Gear Shed
            itemSelectGroup.classList.remove('hidden');

            // Get UI elements
            const itemSearch = document.getElementById('item-search');
            const itemSearchWrapper = document.getElementById('item-search-wrapper');
            const itemSearchClear = document.getElementById('item-search-clear');
            const itemDualPanel = document.getElementById('item-dual-panel');
            const itemHint = document.getElementById('item-hint');

            // For Gear Shed: show checkbox UI, hide select
            if (type === 'GEAR_SHED') {
                itemSelect.style.display = 'none';
                itemSelect.removeAttribute('required');
                itemHint.style.display = 'none';
                itemSearchWrapper.style.display = 'block';
                itemDualPanel.style.display = 'flex';

                // Filter items (Case-insensitive)
                const filteredItems = App.items.filter(i => i.resource_type && i.resource_type.toLowerCase() === type.toLowerCase());

                // Store for search filtering
                App.currentGearShedItems = filteredItems;

                // Initialize selected items (store IDs, not names)
                App.selectedGearShedItems = [];

                // Render dual-panel
                App.renderGearShedDualPanel();

                // Bind search
                itemSearch.value = '';
                itemSearchClear.style.display = 'none';
                itemSearch.removeEventListener('input', App.handleGearShedSearch);
                itemSearch.addEventListener('input', App.handleGearShedSearch);

                // Bind clear button
                itemSearchClear.removeEventListener('click', App.handleClearSearch);
                itemSearchClear.addEventListener('click', App.handleClearSearch);
            } else {
                // Other types: use select element, add required back
                itemSelect.style.display = 'block';
                itemSelect.setAttribute('required', 'required');
                itemHint.style.display = 'block';
                itemSearchWrapper.style.display = 'none';
                itemDualPanel.style.display = 'none';

                // Filter items (Case-insensitive)
                const filteredItems = App.items.filter(i => i.resource_type && i.resource_type.toLowerCase() === type.toLowerCase());

                if (filteredItems.length === 0) {
                    const option = document.createElement('option');
                    option.textContent = 'No items found';
                    itemSelect.appendChild(option);
                }

                filteredItems.forEach(i => {
                    const option = document.createElement('option');
                    option.value = i.item;
                    option.textContent = i.item;
                    itemSelect.appendChild(option);
                });
            }
        }

        // Logic based on type
        if (type === 'GEAR_SHED') {
            // Show and require end date/time fields
            endDate.closest('.form-group').classList.remove('hidden');
            endTime.closest('.form-group').classList.remove('hidden');
            endDate.setAttribute('required', 'required');
            endTime.setAttribute('required', 'required');

            // Hide times ONLY, keep Date visible
            startTime.style.display = 'none';
            endTime.style.display = 'none';

            // Ensure parent container is visible (in case it was hidden previously)
            startTime.closest('.split-inputs').style.display = 'flex';

            // Set defaults for hidden fields
            startTime.value = '10:00';
            endTime.value = '18:00';

        } else {
            startTime.style.display = 'block';
            endTime.style.display = 'block';
        }

        if (type === 'GUEST_SUITE') {
            priceContainer.classList.remove('hidden');

            // Show and require end date/time fields
            endDate.closest('.form-group').classList.remove('hidden');
            endTime.closest('.form-group').classList.remove('hidden');
            endDate.setAttribute('required', 'required');
            endTime.setAttribute('required', 'required');

            // Enforce times visually
            startTime.value = '15:00';
            endTime.value = '11:00';
            startTime.readOnly = true;
            endTime.readOnly = true;
        } else if (type === 'SKY_LOUNGE') {
            overrideContainer.classList.remove('hidden');
            priceContainer.classList.remove('hidden');

            // Hide End Date/Time for Sky Lounge (Single Day, Auto-End)
            endDate.closest('.form-group').classList.add('hidden');
            endTime.closest('.form-group').classList.add('hidden');

            // Remove required attribute from hidden fields
            endDate.removeAttribute('required');
            endTime.removeAttribute('required');

            // Default times
            startTime.value = '10:00';
            endTime.value = '14:00';

            // Set end date to match start date if start date is already set
            if (startDate.value) {
                endDate.value = startDate.value;
            }

            // Ensure editable
            startTime.readOnly = false;

            // Bind Custom Picker to Start Time
            startTime.dataset.customPicker = 'true';

            const openPicker = (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Don't open if read-only
                if (!startTime.readOnly) {
                    App.openTimePicker('res-start-time');
                }
            };

            startTime.addEventListener('click', openPicker);
            startTime.addEventListener('mousedown', openPicker);

            // Auto-calculate End Time on Start Time change
            startTime.addEventListener('change', () => {
                if (startTime.value) {
                    const [h, m] = startTime.value.split(':').map(Number);
                    let endH = h + 4;
                    if (endH >= 24) endH -= 24; // Wrap around (though restricted to 10pm max)
                    endTime.value = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

                    // Sync End Date to Start Date
                    endDate.value = startDate.value;
                }
            });

            // Also sync end date when start date changes
            const syncEndDate = () => {
                if (startDate.value) {
                    endDate.value = startDate.value;
                }
            };
            startDate.addEventListener('change', syncEndDate);
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
    // --- Gear Shed Checkbox Functions ---

    renderGearShedDualPanel: (filteredAvailable = null) => {
        const availableList = document.getElementById('item-available-list');
        const selectedList = document.getElementById('item-selected-list');

        // Get available items (not selected)
        // Use filtered list if provided (from search), otherwise use all items
        const sourceItems = filteredAvailable !== null ? filteredAvailable : App.currentGearShedItems;
        const availableItems = sourceItems.filter(item =>
            !App.selectedGearShedItems.includes(item.item_id)
        );

        // Render available items
        availableList.innerHTML = '';
        if (availableItems.length === 0) {
            availableList.innerHTML = '<div class="item-list-empty">No items available</div>';
        } else {
            availableItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'item-list-item';
                div.textContent = item.item;
                div.dataset.itemId = item.item_id;
                div.addEventListener('click', () => App.moveToSelected(item.item_id));
                availableList.appendChild(div);
            });
        }

        // Render selected items
        selectedList.innerHTML = '';
        if (App.selectedGearShedItems.length === 0) {
            selectedList.innerHTML = '<div class="item-list-empty">No items selected</div>';
        } else {
            App.selectedGearShedItems.forEach(itemId => {
                // Find the item object from current items
                const itemObj = App.currentGearShedItems.find(i => i.item_id === itemId);
                if (!itemObj) return; // Skip if not found

                const div = document.createElement('div');
                div.className = 'item-list-item';
                div.textContent = itemObj.item;
                div.dataset.itemId = itemId;
                div.addEventListener('click', () => App.moveToAvailable(itemId));
                selectedList.appendChild(div);
            });
        }
    },

    handleGearShedSearch: () => {
        const query = document.getElementById('item-search').value;
        const clearBtn = document.getElementById('item-search-clear');

        // Show/hide clear button
        if (clearBtn) {
            clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
        }

        const filteredItems = App.filterGearShedItems(query, App.currentGearShedItems);
        App.renderGearShedDualPanel(filteredItems);
    },

    filterGearShedItems: (query, items) => {
        if (!query.trim()) return items;

        // Parse query for modifiers
        const exactPhrases = [];
        const exclusions = [];
        const wildcards = [];

        // Extract exact phrases "..."
        let remaining = query.replace(/"([^"]+)"/g, (match, phrase) => {
            exactPhrases.push(phrase.toLowerCase());
            return '';
        });

        // Extract tokens
        const tokens = remaining.split(/\s+/).filter(t => t.length > 0);

        tokens.forEach(token => {
            if (token.startsWith('-')) {
                exclusions.push(token.substring(1).toLowerCase());
            } else {
                wildcards.push(token.toLowerCase());
            }
        });

        // Filter items
        return items.filter(item => {
            const itemLower = item.item.toLowerCase();

            // Check exclusions (must NOT match)
            for (let exc of exclusions) {
                if (itemLower.includes(exc)) return false;
            }

            // Check exact phrases (must match ALL)
            for (let phrase of exactPhrases) {
                if (!itemLower.includes(phrase)) return false;
            }

            // Check wildcards (must match ALL)
            for (let wild of wildcards) {
                const regex = new RegExp(wild.replace(/\*/g, '.*'), 'i');
                if (!regex.test(itemLower)) return false;
            }

            return true;
        });
    },

    moveToSelected: (itemId) => {
        if (!App.selectedGearShedItems.includes(itemId)) {
            App.selectedGearShedItems.push(itemId);
            App.selectedGearShedItems.sort((a, b) => a - b); // Sort numerically by ID

            // Preserve search - reapply current filter
            const query = document.getElementById('item-search')?.value || '';
            if (query) {
                const filteredItems = App.filterGearShedItems(query, App.currentGearShedItems);
                App.renderGearShedDualPanel(filteredItems);
            } else {
                App.renderGearShedDualPanel();
            }
        }
    },

    moveToAvailable: (itemId) => {
        const index = App.selectedGearShedItems.indexOf(itemId);
        if (index > -1) {
            App.selectedGearShedItems.splice(index, 1);

            // Preserve search - reapply current filter
            const query = document.getElementById('item-search')?.value || '';
            if (query) {
                const filteredItems = App.filterGearShedItems(query, App.currentGearShedItems);
                App.renderGearShedDualPanel(filteredItems);
            } else {
                App.renderGearShedDualPanel();
            }
        }
    },

    handleClearSearch: () => {
        const itemSearch = document.getElementById('item-search');
        const clearBtn = document.getElementById('item-search-clear');

        itemSearch.value = '';
        if (clearBtn) clearBtn.style.display = 'none';

        // Re-render with full list
        App.renderGearShedDualPanel();
    },

    handleFormSubmit: async (e) => {
        e.preventDefault();
        console.log('Form submit triggered');

        const type = document.getElementById('res-type').value;
        const itemSelect = document.getElementById('res-item');

        // Handle Multi-select - different logic for Gear Shed vs others
        let selectedItems;
        if (type === 'GEAR_SHED') {
            // Get selected items from right panel (IDs) and convert to item names
            const selectedIds = App.selectedGearShedItems || [];
            selectedItems = selectedIds.map(id => {
                const item = App.currentGearShedItems.find(i => i.item_id === id);
                return item ? item.item : null;
            }).filter(name => name !== null);
        } else {
            // Get from select element (Guest Suite/Sky Lounge)
            selectedItems = Array.from(itemSelect.selectedOptions).map(opt => opt.value);
        }

        console.log('Selected items:', selectedItems);

        if (selectedItems.length === 0) {
            console.log('No items selected - showing alert');
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
            override_lock: document.getElementById('res-override').checked,
            scheduled_by: App.selectedStaff ? (App.selectedStaff.name || App.selectedStaff.staff_name) : 'Staff'
        };

        // Add edit tracking if this is an update
        const id = document.getElementById('res-id').value;
        if (id) {
            formData.edit_by = App.selectedStaff ? (App.selectedStaff.name || App.selectedStaff.staff_name) : 'Staff';
            formData.last_update = App.formatTimestamp();
        }

        const refreshBtn = document.getElementById('refresh-data-btn');

        try {
            // Start spinner
            if (refreshBtn) refreshBtn.classList.add('spinning');

            let response;
            if (id) {
                formData.tx_id = id;
                formData.item = selectedItems[0]; // Fallback for edit
                response = await API.updateReservation(formData);
            } else {
                response = await API.createReservation(formData);
            }

            if (response.status === 'success') {
                document.getElementById('reservation-modal').classList.add('hidden');
                await App.loadData(true, false); // Force refresh and wait, don't manage spinner
                App.showAlert('Reservation saved!', 'success');
            } else {
                App.showAlert(response.message || 'Error saving reservation', 'error');
            }
        } catch (error) {
            App.showAlert('An error occurred.', 'error');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    },

    handleCancellation: async () => {
        const id = document.getElementById('res-id').value;
        const type = document.getElementById('res-type').value;
        const startDateStr = document.getElementById('res-start-date').value;
        const startTimeStr = document.getElementById('res-start-time').value;
        const cancelBtn = document.getElementById('cancel-reservation-btn');
        const refreshBtn = document.getElementById('refresh-data-btn');

        if (!id) return;

        // Check if this is a DELETE action (from Cancelled state)
        if (cancelBtn.dataset.action === 'delete') {
            if (!confirm("Are you sure you want to permanently delete this cancelled reservation? This action cannot be undone.")) return;

            try {
                // Start spinner
                if (refreshBtn) refreshBtn.classList.add('spinning');

                const response = await API.deleteReservation(id);
                if (response.status === 'success') {
                    document.getElementById('reservation-modal').classList.add('hidden');
                    await App.loadData(true, false); // Force refresh and wait, don't manage spinner
                    App.showAlert('Reservation deleted successfully.', 'success');
                } else {
                    App.showAlert(response.message || 'Error deleting reservation', 'error');
                }
            } catch (error) {
                console.error('Deletion failed:', error);
                App.showAlert('Failed to delete reservation.', 'error');
            } finally {
                if (refreshBtn) refreshBtn.classList.remove('spinning');
            }
            return;
        }

        // Normal Cancellation Logic
        // Calculate hours until start
        const startDateTime = new Date(`${startDateStr}T${startTimeStr}`);
        const now = new Date();
        const diffMs = startDateTime - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        let fee = 0;
        let message = "Are you sure you want to cancel this reservation?";

        // Fee Logic
        if (diffHours < 72) {
            if (type === 'SKY_LOUNGE') fee = 150;
            if (type === 'GUEST_SUITE') fee = 75;
        }

        if (fee > 0) {
            message = `Cancellation within 72 hours incurs a $${fee} fee. \n\nAre you sure you want to proceed? The reservation will be marked as Cancelled and the fee will be applied.`;
        } else {
            message += "\n\n(No cancellation fee applies)";
        }

        if (!confirm(message)) return;

        try {
            // Start spinner
            if (refreshBtn) refreshBtn.classList.add('spinning');

            let response;
            if (fee > 0) {
                // Soft Cancel (Fee applied)
                response = await API.cancelReservation(id);
            } else {
                // Hard Delete (No fee)
                response = await API.deleteReservation(id);
            }

            if (response.status === 'success') {
                document.getElementById('reservation-modal').classList.add('hidden');
                await App.loadData(true, false); // Force refresh and wait, don't manage spinner
                App.showAlert(fee > 0 ? `Reservation cancelled. $${fee} fee applied.` : 'Reservation cancelled successfully.', 'success');
            } else {
                App.showAlert(response.message || 'Error cancelling reservation', 'error');
            }
        } catch (error) {
            console.error('Cancellation failed:', error);
            App.showAlert('Failed to cancel reservation.', 'error');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    },

    handleRestore: async () => {
        const id = document.getElementById('res-id').value;
        const refreshBtn = document.getElementById('refresh-data-btn');

        if (!id) return;

        if (!confirm("Are you sure you want to restore this cancelled reservation? It will be returned to 'Scheduled' status.")) return;

        try {
            // Start spinner
            if (refreshBtn) refreshBtn.classList.add('spinning');

            const response = await API.restoreReservation(id);
            if (response.status === 'success') {
                document.getElementById('reservation-modal').classList.add('hidden');
                await App.loadData(true, false); // Force refresh and wait, don't manage spinner
                App.showAlert('Reservation restored successfully.', 'success');
            } else {
                App.showAlert(response.message || 'Error restoring reservation', 'error');
            }
        } catch (error) {
            console.error('Restore failed:', error);
            App.showAlert('Failed to restore reservation.', 'error');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    },

    updateCompleteButtonState: (data) => {
        const completeBtn = document.getElementById('complete-reservation-btn');
        const endDateStr = document.getElementById('res-end-date').value;

        if (!endDateStr) {
            completeBtn.disabled = true;
            return;
        }

        // Get today's date (midnight for comparison)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get end date (midnight for comparison)
        const endDate = new Date(endDateStr);
        endDate.setHours(0, 0, 0, 0);

        // Enable button if today is on or after the end date
        if (today >= endDate) {
            completeBtn.disabled = false;
        } else {
            completeBtn.disabled = true;
        }
    },

    handleCompleteClick: () => {
        const completeBtn = document.getElementById('complete-reservation-btn');

        // If button is disabled, show prompt to adjust end date
        if (completeBtn.disabled) {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            if (confirm('This reservation cannot be completed yet. Would you like to adjust the end date to today to enable completion?')) {
                const endDateInput = document.getElementById('res-end-date');
                endDateInput.value = todayStr;

                // Get the current reservation data
                const currentData = {
                    end_time: document.getElementById('res-end-date').value + 'T' + document.getElementById('res-end-time').value
                };

                // Re-check button state
                App.updateCompleteButtonState(currentData);

                App.showAlert('End date updated to today. You can now complete the reservation.', 'success');
            }
            return;
        }

        // Button is enabled - open completion modal
        App.openCompleteModal();
    },

    openCompleteModal: () => {
        const txId = document.getElementById('res-id').value;
        const unit = document.getElementById('res-unit').value;
        const item = document.getElementById('res-item').value;
        const startDate = document.getElementById('res-start-date').value;
        const startTime = document.getElementById('res-start-time').value;
        const endDate = document.getElementById('res-end-date').value;
        const endTime = document.getElementById('res-end-time').value;

        // Populate summary
        document.getElementById('complete-unit').textContent = unit;
        document.getElementById('complete-item').textContent = item;

        // Format period
        const start = new Date(startDate + 'T' + startTime);
        const end = new Date(endDate + 'T' + endTime);
        const formatDateTime = (d) => {
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            const year = d.getFullYear().toString().slice(-2);
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
        };

        document.getElementById('complete-period').textContent = `${formatDateTime(start)} - ${formatDateTime(end)}`;

        // Clear return notes
        document.getElementById('complete-return-notes').value = '';

        // Store tx_id for submission
        document.getElementById('complete-reservation-form').dataset.txId = txId;

        // Show modal
        document.getElementById('complete-reservation-modal').classList.remove('hidden');
    },

    handleCompleteSubmit: async (e) => {
        e.preventDefault();

        const form = e.target;
        const txId = form.dataset.txId;
        const returnNotes = document.getElementById('complete-return-notes').value;
        const refreshBtn = document.getElementById('refresh-data-btn');

        try {
            // Start spinner
            if (refreshBtn) refreshBtn.classList.add('spinning');

            const response = await API.completeReservation(txId, returnNotes, App.selectedStaff ? (App.selectedStaff.name || App.selectedStaff.staff_name) : 'Staff');

            if (response.status === 'success') {
                // Close both modals
                document.getElementById('complete-reservation-modal').classList.add('hidden');
                document.getElementById('reservation-modal').classList.add('hidden');

                // Reload data
                await App.loadData(true, false);

                App.showAlert('Reservation marked as complete!', 'success');
            } else {
                App.showAlert(response.message || 'Error completing reservation', 'error');
            }
        } catch (error) {
            console.error('Completion failed:', error);
            App.showAlert('Failed to complete reservation.', 'error');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    },

    renderListView: () => {
        const tbody = document.querySelector('#reservations-table tbody');
        tbody.innerHTML = '';

        // Helper function to format date as DD/MM/YY
        const formatDate = (date) => {
            const d = new Date(date);
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear().toString().slice(-2);
            return `${day}/${month}/${year}`;
        };

        // Helper function to format time as 12-hour format (HH:MM AM/PM)
        const formatTime = (date) => {
            const d = new Date(date);
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 should be 12
            return `${hours}:${minutes} ${ampm}`;
        };

        App.reservations.forEach(r => {
            const tr = document.createElement('tr');
            if (r.extendedProps.status === 'Cancelled') {
                tr.classList.add('cancelled');
            }

            const rentalNotes = r.extendedProps.rental_notes || '';
            const returnNotes = r.extendedProps.return_notes || '';

            tr.innerHTML = `
                <td>${r.extendedProps.rented_to}</td>
                <td>${r.extendedProps.item}</td>
                <td>${formatDate(r.start)} ${formatTime(r.start)}</td>
                <td>${formatDate(r.end)} ${formatTime(r.end)}</td>
                <td>$${parseFloat(r.extendedProps.total_cost || 0).toFixed(2)}</td>
                <td><span class="status-badge ${r.extendedProps.status.toLowerCase()}">${r.extendedProps.status}</span></td>
                <td>${r.extendedProps.scheduled_by || ''}</td>
                <td>${r.extendedProps.completed_by || ''}</td>
                <td class="notes-cell">${rentalNotes}</td>
                <td class="notes-cell">${returnNotes}</td>
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

    // Format timestamp as mm/dd/yy hh:mm
    formatTimestamp: (date = new Date()) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const year = d.getFullYear().toString().slice(-2);
        let hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
    },

    // --- Staff Selector Logic ---

    initStaffSelector: () => {
        // Load saved staff preference from localStorage
        const savedStaff = localStorage.getItem('selectedStaff');
        if (savedStaff) {
            try {
                App.selectedStaff = JSON.parse(savedStaff);
                App.updateStaffDisplay();
            } catch (e) {
                console.error('Error loading saved staff:', e);
            }
        }

        // Bind staff selector button click
        document.getElementById('staff-selector-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            App.toggleStaffSelector();
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            const popover = document.getElementById('staff-selector-popover');
            if (!popover.classList.contains('hidden') &&
                !popover.contains(e.target) &&
                !e.target.closest('#staff-selector-btn')) {
                popover.classList.add('hidden');
            }
        });
    },

    toggleStaffSelector: () => {
        const popover = document.getElementById('staff-selector-popover');
        const button = document.getElementById('staff-selector-btn');

        if (popover.classList.contains('hidden')) {
            // Position popover below button
            const rect = button.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            popover.style.top = `${rect.bottom + scrollTop + 8}px`;
            popover.style.left = `${rect.left + scrollLeft - 85}px`;

            popover.classList.remove('hidden');
        } else {
            popover.classList.add('hidden');
        }
    },

    renderStaffList: () => {
        const list = document.getElementById('staff-picker-list');
        if (!list) return;

        list.innerHTML = '';

        if (App.staff.length === 0) {
            list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">No staff members found</div>';
            return;
        }

        App.staff.forEach(staff => {
            const item = document.createElement('div');
            item.className = 'staff-picker-item';
            item.textContent = staff.name || staff.staff_name || 'Unknown';

            // Mark selected
            if (App.selectedStaff && (staff.name === App.selectedStaff.name || staff.staff_name === App.selectedStaff.name)) {
                item.classList.add('selected');
            }

            item.addEventListener('click', () => {
                App.selectStaff(staff);
            });

            list.appendChild(item);
        });
    },

    selectStaff: (staff) => {
        App.selectedStaff = staff;

        // Save to localStorage (no expiration)
        localStorage.setItem('selectedStaff', JSON.stringify(staff));

        // Update display
        App.updateStaffDisplay();

        // Re-render list to update selection
        App.renderStaffList();

        // Close popover
        document.getElementById('staff-selector-popover').classList.add('hidden');

        App.showAlert(`Switched to ${staff.name || staff.staff_name}`, 'success');
    },

    updateStaffDisplay: () => {
        const displayElement = document.getElementById('selected-staff-name');
        if (App.selectedStaff) {
            displayElement.textContent = App.selectedStaff.name || App.selectedStaff.staff_name || 'Select Staff';
        } else {
            displayElement.textContent = 'Select Staff';
        }
    },

    // --- Notifications Logic ---

    initNotifications: () => {
        // Bind notifications button click
        document.getElementById('notifications-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            App.toggleNotifications();
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            const popover = document.getElementById('notifications-popover');
            if (!popover.classList.contains('hidden') &&
                !popover.contains(e.target) &&
                !e.target.closest('#notifications-btn')) {
                popover.classList.add('hidden');
            }
        });
    },

    toggleNotifications: () => {
        const popover = document.getElementById('notifications-popover');
        const button = document.getElementById('notifications-btn');

        if (popover.classList.contains('hidden')) {
            // Position popover below button
            const rect = button.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            popover.style.top = `${rect.bottom + scrollTop + 8}px`;
            popover.style.left = `${rect.left + scrollLeft}px`;

            // Render notifications before showing
            App.renderNotifications();

            popover.classList.remove('hidden');
        } else {
            popover.classList.add('hidden');
        }
    },

    updateNotifications: () => {
        // Count unique reservations (by tx_id) that need completion
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const uniqueTxIds = new Set();

        App.reservations.forEach(res => {
            const props = res.extendedProps;

            // Only count scheduled reservations where end date has passed
            if (props.status === 'Scheduled') {
                const endDate = new Date(props.end_time);
                endDate.setHours(0, 0, 0, 0);

                if (endDate <= today) {
                    uniqueTxIds.add(props.tx_id);
                }
            }
        });

        const count = uniqueTxIds.size;
        const badge = document.getElementById('notifications-badge');

        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    renderNotifications: () => {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        list.innerHTML = '';

        // Get unique reservations that need completion
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pendingReservations = new Map(); // Use Map to group by tx_id

        App.reservations.forEach(res => {
            const props = res.extendedProps;

            if (props.status === 'Scheduled') {
                const endDate = new Date(props.end_time);
                endDate.setHours(0, 0, 0, 0);

                if (endDate <= today) {
                    // If we haven't seen this tx_id yet, or if this is the first item, store it
                    if (!pendingReservations.has(props.tx_id)) {
                        pendingReservations.set(props.tx_id, props);
                    }
                }
            }
        });

        if (pendingReservations.size === 0) {
            list.innerHTML = '<div class="notifications-empty">No pending completions</div>';
            return;
        }

        // Sort by end date (oldest first)
        const sortedReservations = Array.from(pendingReservations.values()).sort((a, b) => {
            return new Date(a.end_time) - new Date(b.end_time);
        });

        sortedReservations.forEach(props => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.dataset.txId = props.tx_id;

            const endDate = new Date(props.end_time);
            const daysOverdue = Math.floor((today - endDate) / (1000 * 60 * 60 * 24));

            // Format dates
            const formatDateTime = (d) => {
                const date = new Date(d);
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const year = date.getFullYear().toString().slice(-2);
                let hours = date.getHours();
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
                return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
            };

            const overdueText = daysOverdue > 0 ? `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue` : 'Due today';

            item.innerHTML = `
                <div class="notification-item-header">
                    <span class="notification-item-unit">Unit ${props.rented_to}</span>
                    <span class="notification-item-overdue">${overdueText}</span>
                </div>
                <div class="notification-item-item">${props.item}</div>
                <div class="notification-item-period">${formatDateTime(props.start_time)} - ${formatDateTime(props.end_time)}</div>
            `;

            item.addEventListener('click', () => {
                App.openNotificationReservation(props);
            });

            list.appendChild(item);
        });
    },

    openNotificationReservation: (props) => {
        // Close notifications popover
        document.getElementById('notifications-popover').classList.add('hidden');

        // Open the reservation in edit mode first
        App.openReservationModal(props);

        // Then open the complete modal directly
        setTimeout(() => {
            App.openCompleteModal();
        }, 100);
    },

    getStatusColor: (status) => {
        switch (status) {
            case 'Scheduled': return '#1a237e'; // Primary blue
            case 'Complete': return '#10b981'; // Success green
            case 'Cancelled': return '#ef4444'; // Error red
            default: return '#6b7280';
        }
    },

    // --- Custom Time Picker Logic ---

    initTimePicker: () => {
        try {
            // Populate Hours (Sky Lounge Specific: 10am - 6pm)
            const hourCol = document.getElementById('picker-hour');
            if (!hourCol) return;

            hourCol.innerHTML = '';
            hourCol.insertAdjacentHTML('beforeend', '<div class="picker-item-spacer"></div>');

            // 10, 11, 12, 1, 2, 3, 4, 5, 6 (just numbers, no AM/PM here)
            const hours = [
                { val: 10, ampm: 'AM' },
                { val: 11, ampm: 'AM' },
                { val: 12, ampm: 'PM' },
                { val: 1, ampm: 'PM' },
                { val: 2, ampm: 'PM' },
                { val: 3, ampm: 'PM' },
                { val: 4, ampm: 'PM' },
                { val: 5, ampm: 'PM' },
                { val: 6, ampm: 'PM' }
            ];

            hours.forEach(h => {
                const div = document.createElement('div');
                div.className = 'picker-item';
                div.textContent = h.val.toString(); // Just the number
                div.dataset.value = h.val;
                div.dataset.ampm = h.ampm;
                hourCol.appendChild(div);
            });
            hourCol.insertAdjacentHTML('beforeend', '<div class="picker-item-spacer"></div>');

            // Populate Minutes (00, 15, 30, 45)
            const minCol = document.getElementById('picker-minute');
            minCol.innerHTML = '';
            minCol.insertAdjacentHTML('beforeend', '<div class="picker-item-spacer"></div>');
            ['00', '15', '30', '45'].forEach(m => {
                const div = document.createElement('div');
                div.className = 'picker-item';
                div.textContent = m;
                div.dataset.value = m;
                minCol.appendChild(div);
            });
            minCol.insertAdjacentHTML('beforeend', '<div class="picker-item-spacer"></div>');

            // Populate AM/PM (read-only, auto-updates)
            const ampmCol = document.getElementById('picker-ampm');
            ampmCol.innerHTML = '';
            ampmCol.insertAdjacentHTML('beforeend', '<div class="picker-item-spacer"></div>');
            ['AM', 'PM'].forEach(period => {
                const div = document.createElement('div');
                div.className = 'picker-item';
                div.textContent = period;
                div.dataset.value = period;
                ampmCol.appendChild(div);
            });
            ampmCol.insertAdjacentHTML('beforeend', '<div class="picker-item-spacer"></div>');

            // Bind Scroll Events for visual feedback
            [hourCol, minCol, ampmCol].forEach(col => {
                col.addEventListener('scroll', () => App.handlePickerScroll(col));

                // Click to select item (except AM/PM which is auto-controlled)
                if (col.id !== 'picker-ampm') {
                    col.querySelectorAll('.picker-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const itemTop = item.offsetTop;
                            const scrollTo = itemTop - 96;
                            col.scrollTo({ top: scrollTo, behavior: 'smooth' });
                        });
                    });
                }
            });

            // Auto-update AM/PM and lock minutes when hour changes
            hourCol.addEventListener('scroll', () => {
                App.updateAMPMFromHour();
                App.lockMinutesIfNeeded();
            });

            // OK Button
            document.getElementById('time-picker-ok').addEventListener('click', App.handleTimeSelect);

            // Click Outside to Close
            document.addEventListener('click', (e) => {
                const popover = document.getElementById('time-picker-popover');
                if (!popover.classList.contains('hidden') &&
                    !popover.contains(e.target) &&
                    !e.target.closest('input[type="time"]')) {
                    popover.classList.add('hidden');
                }
            });

        } catch (e) {
            console.error('Error initializing time picker:', e);
        }
    },

    handlePickerScroll: (col) => {
        // Update visual classes based on proximity to center
        const items = col.querySelectorAll('.picker-item');
        const colCenter = col.scrollTop + 120; // 96px padding + 24px half height

        items.forEach(item => {
            const itemCenter = item.offsetTop + 24; // 24px = half of 48px item height
            const diff = Math.abs(colCenter - itemCenter);

            // Remove all classes first
            item.classList.remove('at-center', 'near-center');

            if (diff < 24) {
                // Item is at center
                item.classList.add('at-center');
            } else if (diff < 72) {
                // Item is near center (within 1.5 items)
                item.classList.add('near-center');
            }
        });
    },

    updateAMPMFromHour: () => {
        const hourCol = document.getElementById('picker-hour');
        const ampmCol = document.getElementById('picker-ampm');
        if (!hourCol || !ampmCol) return;

        const hourItems = hourCol.querySelectorAll('.picker-item');
        const colCenter = hourCol.scrollTop + 120;

        let selectedHour = null;
        let minDiff = Infinity;

        hourItems.forEach(item => {
            const itemCenter = item.offsetTop + 24;
            const diff = Math.abs(colCenter - itemCenter);
            if (diff < minDiff) {
                minDiff = diff;
                selectedHour = item;
            }
        });

        if (selectedHour) {
            const ampm = selectedHour.dataset.ampm;
            const ampmItems = ampmCol.querySelectorAll('.picker-item');

            ampmItems.forEach(item => {
                if (item.dataset.value === ampm) {
                    const scrollTo = item.offsetTop - 96;
                    ampmCol.scrollTo({ top: scrollTo, behavior: 'smooth' });
                }
            });
        }
    },

    lockMinutesIfNeeded: () => {
        const hourCol = document.getElementById('picker-hour');
        const minCol = document.getElementById('picker-minute');
        if (!hourCol || !minCol) return;

        const hourItems = hourCol.querySelectorAll('.picker-item');
        const colCenter = hourCol.scrollTop + 120;

        let selectedHour = null;
        let minDiff = Infinity;

        hourItems.forEach(item => {
            const itemCenter = item.offsetTop + 24;
            const diff = Math.abs(colCenter - itemCenter);
            if (diff < minDiff) {
                minDiff = diff;
                selectedHour = item;
            }
        });

        if (selectedHour && parseInt(selectedHour.dataset.value) === 6) {
            const minItems = minCol.querySelectorAll('.picker-item');
            minItems.forEach(item => {
                if (item.dataset.value === '00') {
                    const scrollTo = item.offsetTop - 96;
                    minCol.scrollTo({ top: scrollTo, behavior: 'smooth' });
                }
            });

            minCol.style.pointerEvents = 'none';
            minCol.style.opacity = '0.5';
        } else {
            minCol.style.pointerEvents = 'auto';
            minCol.style.opacity = '1';
        }
    },

    openTimePicker:
        (inputId) => {
            App.activeTimeInput = inputId;
            const input = document.getElementById(inputId);

            // Don't open if field is read-only
            if (input.readOnly) return;

            const popover = document.getElementById('time-picker-popover');

            // Position Popover below the input
            const rect = input.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            popover.style.top = `${rect.bottom + scrollTop + 8}px`;
            popover.style.left = `${rect.left + scrollLeft}px`;

            popover.classList.remove('hidden');

            // Initialize scroll positions based on current value or default
            App.setInitialPickerValue(input.value || '10:00');
        },

    setInitialPickerValue: (timeStr) => {
        // Parse time string (HH:MM) and scroll to appropriate positions
        const [hour24, minute] = timeStr.split(':').map(s => parseInt(s));

        // Convert 24h to 12h format
        let hour12 = hour24;
        if (hour24 === 0) hour12 = 12;
        else if (hour24 > 12) hour12 = hour24 - 12;

        // Find and scroll to the hour
        const hourCol = document.getElementById('picker-hour');
        const hourItems = hourCol.querySelectorAll('.picker-item');
        hourItems.forEach((item, idx) => {
            if (parseInt(item.dataset.value) === hour12) {
                hourCol.scrollTop = item.offsetTop - 96; // Center it
            }
        });

        // Find and scroll to the minute
        const minCol = document.getElementById('picker-minute');
        const minItems = minCol.querySelectorAll('.picker-item');
        minItems.forEach((item, idx) => {
            if (item.dataset.value === minute.toString().padStart(2, '0')) {
                minCol.scrollTop = item.offsetTop - 96; // Center it
            }
        });

        // Trigger initial scroll handler to set classes
        App.handlePickerScroll(hourCol);
        App.handlePickerScroll(minCol);

        // Set AM/PM and check minute lock
        const ampmCol = document.getElementById('picker-ampm');
        App.handlePickerScroll(ampmCol);
        App.updateAMPMFromHour();
        App.lockMinutesIfNeeded();
    },

    handleTimeSelect: () => {
        // Get selected values based on scroll position
        const getSelected = (id) => {
            const col = document.getElementById(id);
            const items = col.querySelectorAll('.picker-item');
            let selected = items[0];
            let minDiff = Infinity;
            const colCenter = col.scrollTop + 120; // 96px padding + 24px half height

            items.forEach(item => {
                const itemCenter = item.offsetTop + 24; // 24px = half of 48px
                const diff = Math.abs(colCenter - itemCenter);
                if (diff < minDiff) {
                    minDiff = diff;
                    selected = item;
                }
            });
            return selected;
        };

        const hourItem = getSelected('picker-hour');
        const minuteItem = getSelected('picker-minute');
        const ampmItem = getSelected('picker-ampm');

        const hour = parseInt(hourItem.dataset.value);
        const ampm = ampmItem.dataset.value; // Read from AM/PM column
        const minute = minuteItem.dataset.value;

        // Convert to 24h for input value
        let hour24 = hour;
        if (ampm === 'PM' && hour !== 12) hour24 += 12;
        if (ampm === 'AM' && hour === 12) hour24 = 0;

        const timeStr = `${hour24.toString().padStart(2, '0')}:${minute}`;
        const input = document.getElementById(App.activeTimeInput);
        input.value = timeStr;

        // Trigger change event (will auto-calculate end time)
        input.dispatchEvent(new Event('change'));

        // Close Popover
        document.getElementById('time-picker-popover').classList.add('hidden');
    },

    // ... (rest of App object)
    getStatusColor: (status) => {
        switch (status) {
            case 'Scheduled': return '#1a237e'; // Primary blue
            case 'Complete': return '#10b981'; // Success green
            case 'Cancelled': return '#e5e7eb'; // Light Grey (Background)
            default: return '#1a237e';
        }
    },

    getStatusBorderColor: (status) => {
        switch (status) {
            case 'Cancelled': return '#d1d5db'; // Slightly darker grey for border
            case 'Complete': return '#059669'; // Darker green for border
            default: return App.getStatusColor(status);
        }
    },

    getStatusTextColor: (status) => {
        switch (status) {
            case 'Cancelled': return '#9ca3af'; // Grey text
            case 'Complete': return '#ffffff'; // White text
            default: return '#ffffff'; // White text
        }
    },
};

// Expose to window
window.App = App;

// Init if already logged in
if (localStorage.getItem('user_email')) {
    Auth.init();
}
