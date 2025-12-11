with open('z:/Documents/AI Coding/scheduler/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Simple string replacements
content = content.replace('<div class="type-icon">???</div>', '<div class="type-icon">🏠</div>', 1)
content = content.replace('<div class="type-icon">??</div>', '<div class="type-icon">🌆</div>', 1)  
content = content.replace('<div class="type-icon">??</div>', '<div class="type-icon">🎿</div>', 1)

with open('z:/Documents/AI Coding/scheduler/index.html', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Icons fixed!")
