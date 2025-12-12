with open('z:/Documents/AI Coding/scheduler/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add clear button binding
content = content.replace(
    '                // Bind search\n                itemSearch.value = \'\';\n                itemSearch.removeEventListener(\'input\', App.handleGearShedSearch); // Remove old\n                itemSearch.addEventListener(\'input\', App.handleGearShedSearch);',
    '                // Bind search\n                itemSearch.value = \'\';\n                itemSearchClear.style.display = \'none\';\n                itemSearch.removeEventListener(\'input\', App.handleGearShedSearch);\n                itemSearch.addEventListener(\'input\', App.handleGearShedSearch);\n                \n                // Bind clear button\n                itemSearchClear.removeEventListener(\'click\', App.handleClearSearch);\n                itemSearchClear.addEventListener(\'click\', App.handleClearSearch);'
)

# 2. Update handleGearShedSearch to show/hide clear button
content = content.replace(
    '    handleGearShedSearch: () => {\n        const query = document.getElementById(\'item-search\').value;\n        const filteredItems = App.filterGearShedItems(query, App.currentGearShedItems);\n        App.renderGearShedDualPanel(filteredItems);\n    },',
    '    handleGearShedSearch: () => {\n        const query = document.getElementById(\'item-search\').value;\n        const clearBtn = document.getElementById(\'item-search-clear\');\n        \n        // Show/hide clear button\n        if (clearBtn) {\n            clearBtn.style.display = query.length > 0 ? \'flex\' : \'none\';\n        }\n        \n        const filteredItems = App.filterGearShedItems(query, App.currentGearShedItems);\n        App.renderGearShedDualPanel(filteredItems);\n    },'
)

# 3. Add handleClearSearch function before handleFormSubmit
insert_pos = content.find('    handleFormSubmit: async (e) =>')
if insert_pos > 0:
    new_func = '''    handleClearSearch: () => {
        const itemSearch = document.getElementById('item-search');
        const clearBtn = document.getElementById('item-search-clear');
        
        itemSearch.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        
        // Re-render with full list
        App.renderGearShedDualPanel();
    },

    '''
    content = content[:insert_pos] + new_func + content[insert_pos:]

# 4. Update move functions to preserve search
content = content.replace(
    '    moveToSelected: (itemId) => {\n        if (!App.selectedGearShedItems.includes(itemId)) {\n            App.selectedGearShedItems.push(itemId);\n            App.selectedGearShedItems.sort((a, b) => a - b); // Sort numerically by ID\n            App.renderGearShedDualPanel();\n        }\n    },',
    '    moveToSelected: (itemId) => {\n        if (!App.selectedGearShedItems.includes(itemId)) {\n            App.selectedGearShedItems.push(itemId);\n            App.selectedGearShedItems.sort((a, b) => a - b); // Sort numerically by ID\n            \n            // Preserve search - reapply current filter\n            const query = document.getElementById(\'item-search\')?.value || \'\';\n            if (query) {\n                const filteredItems = App.filterGearShedItems(query, App.currentGearShedItems);\n                App.renderGearShedDualPanel(filteredItems);\n            } else {\n                App.renderGearShedDualPanel();\n            }\n        }\n    },'
)

content = content.replace(
    '    moveToAvailable: (itemId) => {\n        const index = App.selectedGearShedItems.indexOf(itemId);\n        if (index > -1) {\n            App.selectedGearShedItems.splice(index, 1);\n            App.renderGearShedDualPanel();\n        }\n    },',
    '    moveToAvailable: (itemId) => {\n        const index = App.selectedGearShedItems.indexOf(itemId);\n        if (index > -1) {\n            App.selectedGearShedItems.splice(index, 1);\n            \n            // Preserve search - reapply current filter\n            const query = document.getElementById(\'item-search\')?.value || \'\';\n            if (query) {\n                const filteredItems = App.filterGearShedItems(query, App.currentGearShedItems);\n                App.renderGearShedDualPanel(filteredItems);\n            } else {\n                App.renderGearShedDualPanel();\n            }\n        }\n    },'
)

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Search persistence and clear button complete!")
