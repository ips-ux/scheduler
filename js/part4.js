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
