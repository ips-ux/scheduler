with open('z:/Documents/AI Coding/scheduler/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the modal footer buttons
content = content.replace(
    '                <div class="modal-footer">\n                    <button type="submit" class="primary-btn">Create Reservation</button>\n                </div>',
    '                <div class="modal-footer">\n                    <button type="button" class="secondary-btn" id="back-to-amenity">← Back</button>\n                    <button type="submit" class="primary-btn">Create Reservation</button>\n                </div>'
)

with open('z:/Documents/AI Coding/scheduler/index.html', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Back button added to modal footer!")
