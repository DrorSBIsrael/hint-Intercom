import re

dropdown_html_owner_admin = """
        <!-- Mobile Dropdown Menu -->
        <div class="mobile-only mobile-dropdown-container" id="mobile-dropdown-container" style="padding: 0 15px;">
            <div class="mobile-dropdown-btn" onclick="toggleMobileDropdown()">
                <span id="mobile-dropdown-current">מוצרים</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="mobile-dropdown-menu">
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-stats', 'סטטיסטיקה')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">סטטיסטיקה</span>
                        <span class="mobile-dropdown-item-desc">נתונים כלליים וגרפים</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-ai-cost', 'עליות וצריכת AI')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">עליות וצריכת AI</span>
                        <span class="mobile-dropdown-item-desc">עלות תקופתית וניצול מכסות</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-live-calls', 'אזור שיחות')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">אזור שיחות</span>
                        <span class="mobile-dropdown-item-desc">שיחות בזמן אמת</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-rules-white', 'ניהול מורשים')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">ניהול מורשים</span>
                        <span class="mobile-dropdown-item-desc">רשימת הרכבים המורשים</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-rules-black', 'ניהול חסומים')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">ניהול חסומים</span>
                        <span class="mobile-dropdown-item-desc">רשימת הרכבים החסומים</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-all-calls', 'כל השיחות')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">כל השיחות</span>
                        <span class="mobile-dropdown-item-desc">היסטוריה מלאה</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-load-graph', 'עומס שיחות')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">עומס שיחות</span>
                        <span class="mobile-dropdown-item-desc">מגמות טלפוניות בזמן</span>
                    </div>
                </a>
            </div>
        </div>
"""

dropdown_html_operator = """
        <!-- Mobile Dropdown Menu -->
        <div class="mobile-only mobile-dropdown-container" id="mobile-dropdown-container" style="padding: 0 15px;">
            <div class="mobile-dropdown-btn" onclick="toggleMobileDropdown()">
                <span id="mobile-dropdown-current">מוצרים</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="mobile-dropdown-menu">
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-stats', 'סטטיסטיקה')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">סטטיסטיקה</span>
                        <span class="mobile-dropdown-item-desc">נתונים כלליים וגרפים</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-all-calls', 'כל השיחות')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">כל השיחות</span>
                        <span class="mobile-dropdown-item-desc">היסטוריה מלאה</span>
                    </div>
                </a>
                <a class="mobile-dropdown-item" onclick="switchMobileView('show-load-graph', 'עומס שיחות')">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
                    <div class="mobile-dropdown-item-content">
                        <span class="mobile-dropdown-item-title">עומס שיחות</span>
                        <span class="mobile-dropdown-item-desc">מגמות טלפוניות בזמן</span>
                    </div>
                </a>
            </div>
        </div>
"""

def insert_after_header(filename, dropdown_html):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if we already have it to avoid duplicates
    if 'id="mobile-dropdown-container"' in content:
        # Replace existing
        content = re.sub(r'<!-- Mobile Dropdown Menu -->.*?</div>\s*</div>', dropdown_html, content, flags=re.DOTALL)
    else:
        # Insert after </header>
        content = content.replace("</header>", "</header>\n" + dropdown_html)
        
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

insert_after_header('owner_dashboard.html', dropdown_html_owner_admin)
insert_after_header('admin_dashboard.html', dropdown_html_owner_admin)
insert_after_header('index.html', dropdown_html_operator)

print("Added dropdown HTML to files.")
