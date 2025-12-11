import re

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the old functions with the new one
old_pattern = r'    selectAllGearShedItems:.*?},\s+clearAllGearShedItems:.*?},'
new_code = '''    reorderGearShedItems: () => {
        const container = document.getElementById('item-checkbox-list');
        const items = Array.from(container.querySelectorAll('.item-checkbox-item'));
        
        // Sort: checked items first, then unchecked, maintaining alphabetical within each group
        items.sort((a, b) => {
            const aChecked = a.querySelector('input[type="checkbox"]').checked;
            const bChecked = b.querySelector('input[type="checkbox"]').checked;
            
            if (aChecked && !bChecked) return -1;
            if (!aChecked && bChecked) return 1;
            
            // If both same checked state, maintain alphabetical order
            const aText = a.querySelector('label').textContent;
            const bText = b.querySelector('label').textContent;
            return aText.localeCompare(bText);
        });
        
        // Clear and re-append in new order
        container.innerHTML = '';
        items.forEach(item => container.appendChild(item));
    },'''

content = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Done")
