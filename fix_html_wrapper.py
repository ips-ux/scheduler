with open('z:/Documents/AI Coding/scheduler/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the search input lines (around line 161-163)
for i in range(len(lines)):
    if 'id="item-search"' in lines[i]:
        # Found the search input, replace it and surrounding lines
        # Count back to find the comment
        start = i
        while start > 0 and '<!-- Search Bar' not in lines[start]:
            start -= 1
        
        # Find the end (the closing >)
        end = i
        while end < len(lines) and 'style="display:none;">' not in lines[end]:
            end += 1
        
        # Replace with new structure
        new_html = '''                        <!-- Search Bar (only for Gear Shed) -->
                        <div class="search-wrapper" style="display:none;" id="item-search-wrapper">
                            <input type="text" id="item-search" class="item-search"
                                placeholder="Search... (* wildcard, - exclude, &quot;exact&quot;)">
                            <button type="button" class="search-clear" id="item-search-clear" style="display:none;">&times;</button>
                        </div>

'''
        lines[start:end+1] = [new_html]
        break

with open('z:/Documents/AI Coding/scheduler/index.html', 'w', encoding='utf-8', newline='') as f:
    f.writelines(lines)

print("HTML search wrapper fixed!")
