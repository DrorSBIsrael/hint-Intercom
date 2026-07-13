import os

files = ['index.html', 'owner_dashboard.html', 'admin_dashboard.html']
for filename in files:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple replace
    import re
    content = re.sub(r'style\.css\?v=\d+', 'style.css?v=129', content)
    content = re.sub(r'app\.js\?v=\d+', 'app.js?v=129', content)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

print("Versions bumped to 129")
