js_addition = """
// ==========================================
// MOBILE SPA NAVIGATION (Products Dropdown)
// ==========================================

function toggleMobileDropdown() {
    const container = document.getElementById('mobile-dropdown-container');
    if (container) {
        container.classList.toggle('open');
    }
}

// Close dropdown if clicked outside
document.addEventListener('click', function(event) {
    const container = document.getElementById('mobile-dropdown-container');
    if (container && container.classList.contains('open')) {
        const btn = document.querySelector('.mobile-dropdown-btn');
        if (!btn.contains(event.target) && !container.contains(event.target)) {
            container.classList.remove('open');
        }
    }
});

function switchMobileView(viewClass, btnText) {
    // Hide all views by removing all related classes from body
    document.body.classList.remove(
        'show-stats', 
        'show-ai-cost', 
        'show-live-calls', 
        'show-rules-white', 
        'show-rules-black', 
        'show-all-calls', 
        'show-load-graph'
    );
    
    // Add the selected view class
    if (viewClass) {
        document.body.classList.add(viewClass);
    }
    
    // Update the button text if provided
    if (btnText) {
        const btnSpan = document.getElementById('mobile-dropdown-current');
        if (btnSpan) btnSpan.textContent = btnText;
    }
    
    // Close the dropdown
    const container = document.getElementById('mobile-dropdown-container');
    if (container) {
        container.classList.remove('open');
    }
    
    // Trigger resize to fix any charts that were hidden
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
}
"""

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content + "\n" + js_addition)

print("Added mobile SPA JS")
