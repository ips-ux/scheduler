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
                const day = current.getUTCDay(); // 0=Sun, 6=Sat
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

            // Sort available items alphabetically
            availableItems.sort((a, b) => a.item.localeCompare(b.item));

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
                // Get item objects for selected IDs
                const selectedItemObjects = App.selectedGearShedItems
                    .map(itemId => App.currentGearShedItems.find(i => i.item_id === itemId))
                    .filter(item => item !== undefined);

                // Sort selected items alphabetically
                selectedItemObjects.sort((a, b) => a.item.localeCompare(b.item));

                selectedItemObjects.forEach(itemObj => {
                    const div = document.createElement('div');
                    div.className = 'item-list-item';
                    div.textContent = itemObj.item;
                    div.dataset.itemId = itemObj.item_id;
                    div.addEventListener('click', () => App.moveToAvailable(itemObj.item_id));
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

