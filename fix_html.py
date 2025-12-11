with open('z:/Documents/AI Coding/scheduler/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all instances of literal backtick-r-n
content = content.replace('`r`n', '')

with open('z:/Documents/AI Coding/scheduler/index.html', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("HTML fixed!")
