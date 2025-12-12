with open('z:/Documents/AI Coding/scheduler/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add console logging at the start of handleFormSubmit
content = content.replace(
    '    handleFormSubmit: async (e) => {\n        e.preventDefault();',
    '    handleFormSubmit: async (e) => {\n        e.preventDefault();\n        console.log(\'Form submit triggered\');'
)

# Add logging for selected items
content = content.replace(
    '        if (selectedItems.length === 0) {\n            App.showAlert(\'Please select at least one item.\', \'error\');',
    '        console.log(\'Selected items:\', selectedItems);\n        \n        if (selectedItems.length === 0) {\n            console.log(\'No items selected - showing alert\');\n            App.showAlert(\'Please select at least one item.\', \'error\');'
)

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Added console logging!")
