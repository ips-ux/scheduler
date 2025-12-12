with open('z:/Documents/AI Coding/scheduler/css/styles.css', 'a', encoding='utf-8') as f:
    f.write('''\n\n/* Modal Header */
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
''')

print("Modal header CSS appended!")
