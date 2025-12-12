with open('z:/Documents/AI Coding/scheduler/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the filter to use item_id
content = content.replace(
    '        const availableItems = sourceItems.filter(item => \n            !App.selectedGearShedItems.includes(item.item)\n        );',
    '        const availableItems = sourceItems.filter(item => \n            !App.selectedGearShedItems.includes(item.item_id)\n        );'
)

# 2. Fix moveToSelected function
content = content.replace(
    '    moveToSelected: (itemName) => {\n        if (!App.selectedGearShedItems.includes(itemName)) {\n            App.selectedGearShedItems.push(itemName);\n            App.selectedGearShedItems.sort();\n            App.renderGearShedDualPanel();\n        }\n    },',
    '    moveToSelected: (itemId) => {\n        if (!App.selectedGearShedItems.includes(itemId)) {\n            App.selectedGearShedItems.push(itemId);\n            App.selectedGearShedItems.sort((a, b) => a - b); // Sort numerically by ID\n            App.renderGearShedDualPanel();\n        }\n    },'
)

# 3. Fix moveToAvailable function
content = content.replace(
    '    moveToAvailable: (itemName) => {\n        const index = App.selectedGearShedItems.indexOf(itemName);\n        if (index > -1) {\n            App.selectedGearShedItems.splice(index, 1);\n            App.renderGearShedDualPanel();\n        }\n    },',
    '    moveToAvailable: (itemId) => {\n        const index = App.selectedGearShedItems.indexOf(itemId);\n        if (index > -1) {\n            App.selectedGearShedItems.splice(index, 1);\n            App.renderGearShedDualPanel();\n        }\n    },'
)

# 4. Fix form submission to convert IDs to names
content = content.replace(
    '        if (type === \'GEAR_SHED\') {\n            // Get selected items from right panel\n            selectedItems = App.selectedGearShedItems || [];',
    '        if (type === \'GEAR_SHED\') {\n            // Get selected items from right panel (IDs) and convert to item names\n            const selectedIds = App.selectedGearShedItems || [];\n            selectedItems = selectedIds.map(id => {\n                const item = App.currentGearShedItems.find(i => i.item_id === id);\n                return item ? item.item : null;\n            }).filter(name => name !== null);'
)

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Fixed item_id tracking!")
