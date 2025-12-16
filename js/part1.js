/**
 * Main Application Logic
 */

const App = {
    calendar: null,
    items: [],
    reservations: [],
    staff: [],
    selectedStaff: null,
    currentSortField: 'item_id',
    currentSortDirection: 'asc',

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
                        // Flatten reservations: if a reservation has multiple items, create an event for each
                        const events = [];
                        response.data.forEach(r => {
                            // Determine items to display
                            let itemsToDisplay = [];
                            if (r.items && Array.isArray(r.items) && r.items.length > 0) {
                                itemsToDisplay = r.items;
                            } else if (r.item) {
                                itemsToDisplay = [r.item];
                            } else {
                                itemsToDisplay = ['Unknown Item'];
                            }

                            itemsToDisplay.forEach(itemName => {
                                events.push({
                                    title: `${r.rented_to} - ${itemName}`,
                                    start: r.start_time,
                                    end: r.end_time,
                                    extendedProps: { ...r, item: itemName }, // Override item for this specific event
                                    classNames: [r.status.toLowerCase()],
                                    backgroundColor: App.getStatusColor(r.status),
                                    borderColor: App.getStatusBorderColor(r.status),
                                    textColor: App.getStatusTextColor(r.status)
                                });
                            });
                        });
                        App.reservations = events;

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

        // Items View
        document.getElementById('view-items').addEventListener('click', () => App.switchView('items'));
        document.getElementById('new-item-btn').addEventListener('click', App.handleNewItem);
        document.getElementById('search-items').addEventListener('input', App.handleItemSearch);

        // Sortable table headers
        document.querySelectorAll('#items-table th.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortField = header.dataset.sort;
                App.handleSort(sortField);
            });
        });
    },

    renderItemsView: () => {
        const view = document.getElementById('items-view');
        console.log('Rendering Items View...', App.items);
        console.log('Items View Classes:', view.className);

        if (view.classList.contains('hidden')) {
            console.error('Items view is still hidden!');
            view.classList.remove('hidden');
        }

        const tbody = document.querySelector('#items-table tbody');
        if (!tbody) {
            console.error('Items table body not found!');
            return;
        }
        tbody.innerHTML = '';

        // Update sort indicators
        document.querySelectorAll('#items-table th.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === App.currentSortField) {
                header.classList.add(`sort-${App.currentSortDirection}`);
            }
        });

        const searchInput = document.getElementById('search-items');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        if (!App.items || App.items.length === 0) {
            console.warn('No items to render.');
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No items found.</td></tr>';
            return;
        }

        const filteredItems = App.items.filter(item =>
            (item.item && item.item.toLowerCase().includes(searchTerm)) ||
            (item.item_id && item.item_id.toLowerCase().includes(searchTerm)) ||
            (item.resource_type && item.resource_type.toLowerCase().includes(searchTerm))
        );


        // Sort by current field and direction
        filteredItems.sort((a, b) => {
            const field = App.currentSortField;
            let valueA = (a[field] || '').toString();
            let valueB = (b[field] || '').toString();

            // Try numeric comparison first if both are numbers
            const numA = parseInt(valueA);
            const numB = parseInt(valueB);

            let comparison = 0;
            if (!isNaN(numA) && !isNaN(numB)) {
                comparison = numA - numB;
            } else {
                // Fall back to string comparison
                comparison = valueA.localeCompare(valueB);
            }

            // Apply sort direction
            return App.currentSortDirection === 'asc' ? comparison : -comparison;
        });


        console.log(`Rendering ${filteredItems.length} items (filtered from ${App.items.length})`);

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');

            // Item ID (Read-only)
            tr.innerHTML += `<td>${item.item_id || '-'}</td>`;

            // Item Name (Editable Text)
            tr.appendChild(App.createEditableCell(item, 'item', 'text'));

            // Description (Editable Text)
            tr.appendChild(App.createEditableCell(item, 'description', 'text'));

            // Resource Type (Editable Popover)
            tr.appendChild(App.createEditableCell(item, 'resource_type', 'popover', ['GEAR_SHED', 'SKY_LOUNGE', 'GUEST_SUITE']));

            // Service Status (Editable Popover)
            tr.appendChild(App.createEditableCell(item, 'service_status', 'popover', ['In Service', 'Not In Service']));

            // Service Notes (Editable Text)
            tr.appendChild(App.createEditableCell(item, 'service_notes', 'text'));

            // Actions
            const actionsTd = document.createElement('td');
            // Add delete button if needed, for now just placeholder
            actionsTd.innerHTML = '';
            tr.appendChild(actionsTd);

            tbody.appendChild(tr);
        });
    },

    createEditableCell: (item, field, type, options = []) => {
        const td = document.createElement('td');
        td.className = 'editable-cell';
        td.textContent = item[field] || (type === 'popover' ? 'Select...' : '-');

        // Colorize status
        if (field === 'service_status') {
            if (item[field] === 'In Service') td.style.color = 'var(--success)';
            if (item[field] === 'Not In Service') td.style.color = 'var(--error)';
        }

        td.addEventListener('click', (e) => {
            if (td.querySelector('input') || document.querySelector('.popover')) return; // Already editing

            if (type === 'text') {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'editable-input';
                input.value = item[field] || '';

                const save = async () => {
                    const newValue = input.value.trim();
                    if (newValue !== item[field]) {
                        const updatedItem = { ...item, [field]: newValue };
                        const res = await API.updateItem(updatedItem);
                        if (res.status === 'success') {
                            // Update local state
                            const idx = App.items.findIndex(i => i.item_id === item.item_id);
                            if (idx !== -1) App.items[idx] = updatedItem;
                            App.renderItemsView();
                        } else {
                            alert('Failed to update item: ' + res.message);
                            td.textContent = item[field] || '-';
                        }
                    } else {
                        td.textContent = item[field] || '-';
                    }
                };

                input.addEventListener('blur', save);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                });

                td.innerHTML = '';
                td.appendChild(input);
                input.focus();
            } else if (type === 'popover') {
                App.showPopover(e.target, options, async (selected) => {
                    const updatedItem = { ...item, [field]: selected };
                    const res = await API.updateItem(updatedItem);
                    if (res.status === 'success') {
                        const idx = App.items.findIndex(i => i.item_id === item.item_id);
                        if (idx !== -1) App.items[idx] = updatedItem;
                        App.renderItemsView();
                    } else {
                        alert('Failed to update item: ' + res.message);
                    }
                });
            }
        });

        return td;
    },

    showPopover: (target, options, onSelect) => {
        // Remove existing popovers
        document.querySelectorAll('.popover').forEach(p => p.remove());

        const popover = document.createElement('div');
        popover.className = 'popover';

        const content = document.createElement('div');
        content.className = 'popover-content popover-list';

        options.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'popover-item';
            div.textContent = opt;
            div.addEventListener('click', () => {
                onSelect(opt);
                popover.remove();
            });
            content.appendChild(div);
        });

        popover.appendChild(content);
        document.body.appendChild(popover);

        // Position
        const rect = target.getBoundingClientRect();
        popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
        popover.style.left = `${rect.left + window.scrollX}px`;

        // Close on click outside
        const closeHandler = (e) => {
            if (!popover.contains(e.target) && e.target !== target) {
                popover.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    },

    handleNewItem: async () => {
        const newItem = {
            item: 'New Item',
            resource_type: 'GEAR_SHED',
            service_status: 'In Service',
            description: '',
            service_notes: ''
        };

        const res = await API.createItem(newItem);
        if (res.status === 'success') {
            App.items.push(res.data);
            App.renderItemsView();
            // Scroll to bottom?
        } else {
            alert('Failed to create item: ' + res.message);
        }
    },

    handleItemSearch: () => {
        App.renderItemsView();
    },

    handleSort: (field) => {
        // Toggle direction if clicking the same field, otherwise default to ascending
        if (App.currentSortField === field) {
            App.currentSortDirection = App.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            App.currentSortField = field;
            App.currentSortDirection = 'asc';
        }

        // Update header visual indicators
        document.querySelectorAll('#items-table th.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === field) {
                header.classList.add(`sort-${App.currentSortDirection}`);
            }
        });

        // Re-render the view with new sort
        App.renderItemsView();
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
        // Get all view sections
        const allViews = document.querySelectorAll('.view-section');
        const currentView = document.querySelector('.view-section:not(.hidden)');

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

        // Determine which view to show
        let targetView, targetBtn;
        if (viewName === 'calendar') {
            targetView = document.getElementById('calendar-view');
            targetBtn = document.getElementById('view-calendar');
        } else if (viewName === 'list') {
            targetView = document.getElementById('list-view');
            targetBtn = document.getElementById('view-list');
        } else if (viewName === 'items') {
            targetView = document.getElementById('items-view');
            targetBtn = document.getElementById('view-items');
        }

        // If switching to the same view, do nothing
        if (currentView === targetView) {
            targetBtn.classList.add('active');
            return;
        }

        // Fade out current view
        if (currentView) {
            currentView.classList.add('fade-out');

            // After fade out completes, hide it and show new view
            setTimeout(() => {
                currentView.classList.add('hidden');
                currentView.classList.remove('fade-out');

                // Show and fade in new view
                targetView.classList.remove('hidden');
                targetView.classList.add('fade-in');
                targetBtn.classList.add('active');

                // Perform view-specific actions
                if (viewName === 'calendar') {
                    App.calendar.render(); // Re-render to fix sizing
                } else if (viewName === 'items') {
                    App.renderItemsView();
                }

                // Remove fade-in class after all animations complete (500ms + 250ms delay)
                setTimeout(() => {
                    targetView.classList.remove('fade-in');
                }, 800);
            }, 300); // Match CSS transition duration
        } else {
            // No current view, just show the target
            targetView.classList.remove('hidden');
            targetView.classList.add('fade-in');
            targetBtn.classList.add('active');

            if (viewName === 'calendar') {
                App.calendar.render();
            } else if (viewName === 'items') {
                App.renderItemsView();
            }

            setTimeout(() => {
                targetView.classList.remove('fade-in');
            }, 800);
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
