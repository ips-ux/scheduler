with open('z:/Documents/AI Coding/scheduler/css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the modal section and add modal-header styling if it doesn't exist
if '.modal-header {' not in content:
    # Add after .modal-content
    insert_after = '.modal-content {'
    insert_pos = content.find(insert_after)
    if insert_pos > 0:
        # Find the end of the modal-content block
        next_brace = content.find('}', insert_pos)
        if next_brace > 0:
            new_css = '''

.modal-header {
    position: relative;
    border-bottom: 1px solid var(--border-color);
    padding: var(--spacing-lg);
}

.modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-main);
}
'''
            content = content[:next_brace+1] + new_css + content[next_brace+1:]

with open('z:/Documents/AI Coding/scheduler/css/styles.css', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Added modal-header CSS!")
