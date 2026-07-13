css_addition = """

/* =========================================
   MOBILE SPA DROPDOWN MENU & LAYOUT
   ========================================= */
@media (max-width: 768px) {
    /* Set Login Background for Dashboard */
    body {
        background: url('parking_bg.jpg') no-repeat center center fixed !important;
        background-size: cover !important;
    }
    
    /* Dark overlay to make content readable */
    body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(18, 20, 24, 0.85); /* TradingView-esque dark overlay */
        z-index: -1;
    }

    /* Hide all main sections by default */
    .dashboard-content > .stats-controls,
    .dashboard-content > .stats-grid,
    .dashboard-content > hr,
    .dashboard-content > .graph-section,
    .dashboard-content > .all-calls-section,
    .dashboard-content > .sub-stats-grid {
        display: none !important;
    }
    
    /* Hide specific sub-components depending on view */
    #mobile-ai-cost-section > div[style*="display: grid"] > div:nth-child(1), /* Graph */
    #mobile-ai-cost-section > div[style*="display: grid"] > div:nth-child(2), /* List */
    #mobile-rules-section > div[style*="display: grid"] > div:nth-child(1), /* Whitelist */
    #mobile-rules-section > div[style*="display: grid"] > div:nth-child(2) /* Blacklist */ {
        display: none !important;
    }

    /* -----------------------------------------
       VIEW DISPLAY CLASSES
       ----------------------------------------- */
       
    body.show-stats .dashboard-content > .stats-grid,
    body.show-stats .dashboard-content > .sub-stats-grid {
        display: grid !important;
    }
    
    body.show-ai-cost .dashboard-content > #mobile-ai-cost-section { display: block !important; }
    body.show-ai-cost #mobile-ai-cost-section > div[style*="display: grid"] { display: flex !important; flex-direction: column; }
    body.show-ai-cost #mobile-ai-cost-section > div[style*="display: grid"] > div:nth-child(1) { display: flex !important; width: 100%; min-height: 350px; }
    
    body.show-live-calls .dashboard-content > #mobile-ai-cost-section { display: block !important; margin-top: 0 !important; }
    body.show-live-calls #mobile-ai-cost-section > .section-header { display: none !important; } /* Hide the title "עלויות וצריכת AI" when viewing just calls */
    body.show-live-calls #mobile-ai-cost-section > div[style*="display: grid"] { display: flex !important; flex-direction: column; height: calc(100vh - 200px) !important; }
    body.show-live-calls #mobile-ai-cost-section > div[style*="display: grid"] > div:nth-child(2) { display: flex !important; flex: 1; border: none; padding: 5px; background: transparent; }
    
    body.show-rules-white .dashboard-content > #mobile-rules-section { display: block !important; margin-top: 0 !important; }
    body.show-rules-white #mobile-rules-section > div[style*="display: grid"] { display: flex !important; flex-direction: column; }
    body.show-rules-white #mobile-rules-section > div[style*="display: grid"] > div:nth-child(1) { display: flex !important; }

    body.show-rules-black .dashboard-content > #mobile-rules-section { display: block !important; margin-top: 0 !important; }
    body.show-rules-black #mobile-rules-section > div[style*="display: grid"] { display: flex !important; flex-direction: column; }
    body.show-rules-black #mobile-rules-section > div[style*="display: grid"] > div:nth-child(2) { display: flex !important; }

    body.show-all-calls .dashboard-content > .all-calls-section { display: block !important; margin-top: 0 !important; }
    
    body.show-load-graph .dashboard-content > #mobile-load-graph-section { display: block !important; margin-top: 0 !important; }

    /* -----------------------------------------
       DROPDOWN MENU UI (TradingView Style)
       ----------------------------------------- */
       
    .mobile-dropdown-container {
        position: relative;
        width: 100%;
        margin-top: 15px;
        z-index: 1000;
    }
    
    .mobile-dropdown-btn {
        background: rgba(42, 46, 57, 0.9);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 12px 20px;
        color: #fff;
        font-size: 1.1rem;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: all 0.2s ease;
    }
    
    .mobile-dropdown-btn:active {
        background: rgba(42, 46, 57, 1);
    }
    
    .mobile-dropdown-btn svg {
        transition: transform 0.2s ease;
    }
    
    .mobile-dropdown-container.open .mobile-dropdown-btn svg {
        transform: rotate(180deg);
    }
    
    .mobile-dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 8px;
        background: #1e222d;
        border: 1px solid #2a2e39;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        display: none;
        flex-direction: column;
        overflow: hidden;
    }
    
    .mobile-dropdown-container.open .mobile-dropdown-menu {
        display: flex;
    }
    
    .mobile-dropdown-item {
        padding: 15px 20px;
        display: flex;
        align-items: center;
        gap: 15px;
        color: #d1d4dc;
        text-decoration: none;
        border-bottom: 1px solid #2a2e39;
        cursor: pointer;
        transition: background 0.2s ease;
    }
    
    .mobile-dropdown-item:last-child {
        border-bottom: none;
    }
    
    .mobile-dropdown-item:active {
        background: #2a2e39;
    }
    
    .mobile-dropdown-item svg {
        color: #787b86;
        width: 20px;
        height: 20px;
    }
    
    .mobile-dropdown-item-content {
        display: flex;
        flex-direction: column;
    }
    
    .mobile-dropdown-item-title {
        font-size: 1rem;
        font-weight: 500;
        color: #fff;
    }
    
    .mobile-dropdown-item-desc {
        font-size: 0.8rem;
        color: #787b86;
        margin-top: 2px;
    }
    
    /* Clean background default - hide content completely if no view class is active */
    body:not(.show-stats):not(.show-ai-cost):not(.show-live-calls):not(.show-rules-white):not(.show-rules-black):not(.show-all-calls):not(.show-load-graph) .dashboard-content {
        display: none !important;
    }
}
"""

with open('style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# I will remove the old ".dashboard-content > .stats-grid { display: grid !important; ... }" stacking rules
import re
# Find the start of "/* Mobile Layout (No Tabs)" to the end of that block
pattern = r"\/\* \n     \* Mobile Layout \(No Tabs\).*?\/\* Increase button\/input sizes for touch \*\/"
content = re.sub(pattern, "/* Increase button/input sizes for touch */", content, flags=re.DOTALL)

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(content + css_addition)

print("Added mobile SPA CSS")
import os
import re

with open('style.css', 'r', encoding='utf-8') as f:
    content = f.read()

css_to_add = """
/* Combined Stats Styles */
.combined-stat {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 15px 20px !important;
    flex-direction: row !important;
}

.combined-stat .stat-main {
    flex: 1;
    text-align: right;
    display: flex;
    flex-direction: column;
}

.combined-stat .stat-secondary {
    text-align: left;
    padding-right: 15px;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    min-width: 100px;
}

.combined-stat h3 {
    margin-bottom: 5px !important;
    font-size: 0.85rem !important;
}

.combined-stat .stat-value {
    font-size: 1.5rem !important;
}

.combined-stat .stat-secondary .stat-value {
    font-size: 1.2rem !important;
    color: var(--text-muted);
}
"""

if '.combined-stat {' not in content:
    # insert before .sub-stats-grid
    content = content.replace('.sub-stats-grid {', css_to_add + '\n.sub-stats-grid {')

    # Also change the grid template to repeat(2, 1fr) by default since there are only 2 cards now!
    content = re.sub(r'\.stats-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4,\s*1fr\);', r'.stats-grid {\n    display: grid;\n    grid-template-columns: repeat(2, 1fr);', content)
    
    # And make it 1 column on mobile
    content = content.replace('    .stats-grid { grid-template-columns: repeat(2, 1fr); }', '    /* stats-grid handles mobile now */')
    content = content.replace('    .stats-grid { grid-template-columns: 1fr; }', '    .stats-grid { grid-template-columns: 1fr; }')

    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(content)
    print("CSS updated")
else:
    print("CSS already updated")
