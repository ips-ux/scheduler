with open('z:/Documents/AI Coding/scheduler/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add back button handler after the close modal handlers
insert_text = '''        
        // Back to amenity selection
        const backBtn = document.getElementById('back-to-amenity');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                document.getElementById('reservation-modal').classList.add('hidden');
                document.getElementById('type-selection-modal').classList.remove('hidden');
            });
        }
'''

# Find the right place to insert (after close modal handlers)
target = "        });\n\n        // Form"
if target in content:
    content = content.replace(target, "        });\n" + insert_text + "\n        // Form")

with open('z:/Documents/AI Coding/scheduler/js/app.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Back button handler added!")
