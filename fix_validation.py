with open('z:/Documents/AI Coding/scheduler/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Gear Shed by removing required attribute when hidden
content = content.replace(
    '            // For Gear Shed: show checkbox UI, hide select\n            if (type === \'GEAR_SHED\') {\n                itemSelect.style.display = \'non e\';\n                itemHint.style.display = \'none\';\n                itemSearchWrapper.style.display = \'block\';\n                itemDualPanel.style.display = \'flex\';',
    '            // For Gear Shed: show dual-panel UI, hide select, remove required\n            if (type === \'GEAR_SHED\') {\n                itemSelect.style.display = \'none\';\n                itemSelect.removeAttribute(\'required\'); // Remove so hidden field doesn\'t block validation\n                itemHint.style.display = \'none\';\n                itemSearchWrapper.style.display = \'block\';\n                itemDualPanel.style.display = \'flex\';'
)

# Add required back when showing select for other types
content = content.replace(
    '            } else {\n                // Other types: use select element\n                itemSelect.style.display = \'block\';\n                itemHint.style.display = \'block\';\n                itemSearchWrapper.style.display = \'none\';\n                itemDualPanel.style.display = \'none\';',
    '            } else {\n                // Other types: use select element, add required back\n                itemSelect.style.display = \'block\';\n                itemSelect.setAttribute(\'required\', \'required\');\n                itemHint.style.display = \'block\';\n                itemSearchWrapper.style.display = \'none\';\n                itemDualPanel.style.display = \'none\';'
)

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Fixed required attribute toggle!")
