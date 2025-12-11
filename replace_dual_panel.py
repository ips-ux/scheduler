import re

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the rendering call
content = content.replace(
    '                // Render checkboxes\n                App.renderGearShedCheckboxes(filteredItems);',
    '                // Initialize selected items\n                App.selectedGearShedItems = [];\n                \n                // Render dual-panel\n                App.renderGearShedDualPanel();'
)

# 2. Replace renderGearShedCheckboxes function
old_render = re.compile(r'    renderGearShedCheckboxes:.*?    \},', re.DOTALL)
new_render = '''    renderGearShedDualPanel: () => {
        const availableList = document.getElementById('item-available-list');
        const selectedList = document.getElementById('item-selected-list');
        
        // Get available items (not selected)
        const availableItems = App.currentGearShedItems.filter(item => 
            !App.selectedGearShedItems.includes(item.item)
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
                div.dataset.itemName = item.item;
                div.addEventListener('click', () => App.moveToSelected(item.item));
                availableList.appendChild(div);
            });
        }
        
        // Render selected items
        selectedList.innerHTML = '';
        if (App.selectedGearShedItems.length === 0) {
            selectedList.innerHTML = '<div class="item-list-empty">No items selected</div>';
        } else {
            App.selectedGearShedItems.forEach(itemName => {
                const div = document.createElement('div');
                div.className = 'item-list-item';
                div.textContent = itemName;
                div.dataset.itemName = itemName;
                div.addEventListener('click', () => App.moveToAvailable(itemName));
                selectedList.appendChild(div);
            });
        }
    },'''

content = old_render.sub(new_render, content)

# 3. Update search handler
content = content.replace(
    '        App.renderGearShedCheckboxes(filteredItems);',
    '        App.renderGearShedDualPanel();'
)

# 4. Replace reorderGearShedItems with move functions
old_reorder = re.compile(r'    reorderGearShedItems:.*?    \},', re.DOTALL)
new_move_funcs = '''    moveToSelected: (itemName) => {
        if (!App.selectedGearShedItems.includes(itemName)) {
            App.selectedGearShedItems.push(itemName);
            App.selectedGearShedItems.sort();
            App.renderGearShedDualPanel();
        }
    },
    
    moveToAvailable: (itemName) => {
        const index = App.selectedGearShedItems.indexOf(itemName);
        if (index > -1) {
            App.selectedGearShedItems.splice(index, 1);
            App.renderGearShedDualPanel();
        }
    },'''

content = old_reorder.sub(new_move_funcs, content)

# 5. Update form submission
content = content.replace(
    '            // Get checked items from checkbox list\n            const checkboxes = document.querySelectorAll(\'#item-checkbox-list input[type="checkbox"]:checked\');\n            selectedItems = Array.from(checkboxes).map(cb => cb.value);',
    '            // Get selected items from right panel\n            selectedItems = App.selectedGearShedItems || [];'
)

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Done!")
