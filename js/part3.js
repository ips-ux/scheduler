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
    } else if (type === 'GUEST_SUITE') {
        // Guest Suite - the space itself is the item
        selectedItems = ['Guest Suite'];
    } else if (type === 'SKY_LOUNGE') {
        // Sky Lounge - the space itself is the item
        selectedItems = ['Sky Lounge'];
    } else {
        // Fallback: Get from select element
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
        items: selectedItems, // Store array of items
        item: selectedItems.join(', '), // Store comma-separated string for display/backward compatibility
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
            // Update existing reservation
            formData.tx_id = id;
            response = await API.updateReservation(formData);
        } else {
            // Create new reservation (single document with items array)
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
