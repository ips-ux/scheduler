with open('z:/Documents/AI Coding/scheduler/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the icons with correct emojis
content = content.replace(
    '<div class="type-icon">🌆</div>\n                    <h3>Guest Suite</h3>',
    '<div class="type-icon">🏠</div>\n                    <h3>Guest Suite</h3>'
)

content = content.replace(
    '<div class="type-icon">🎿</div>\n                    <h3>Sky Lounge</h3>',
    '<div class="type-icon">🌆</div>\n                    <h3>Sky Lounge</h3>'
)

content = content.replace(
    '<div class="type-icon">??</div>\n                    <h3>Gear Shed</h3>',
    '<div class="type-icon">🎿</div>\n                    <h3>Gear Shed</h3>'
)

# Fix close button to have type="button"
content = content.replace(
    '<button class="close-modal">&times;</button>',
    '<button type="button" class="close-modal">&times;</button>'
)

with open('z:/Documents/AI Coding/scheduler/index.html', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Fixed icons and close button!")
