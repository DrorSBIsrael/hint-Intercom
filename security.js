// security.js
// חסימת כלי מפתחים (F12) ולחצן ימני, עם אפשרות שחרור על ידי קוד סודי
(function() {
    let unlocked = false;
    let keys = "";

    document.addEventListener('keydown', function(e) {
        // קוד סודי לפתיחת נעילה: הקלדת "unlock123" רצוף על המקלדת
        if (e.key && e.key.length === 1) {
            keys += e.key;
            if (keys.length > 20) keys = keys.slice(-20);
            if (keys.includes("4711")) {
                unlocked = true;
                keys = ""; // Reset
            }
        }

        if (unlocked) return;

        // מניעת F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // מניעת Ctrl+Shift+I / J / C (כלי מפתחים)
        if (e.ctrlKey && e.shiftKey && (e.code === 'KeyI' || e.code === 'KeyJ' || e.code === 'KeyC')) {
            e.preventDefault();
            return false;
        }
        // מניעת Ctrl+U (הצגת מקור הדף)
        if (e.ctrlKey && e.code === 'KeyU') {
            e.preventDefault();
            return false;
        }
    });

    document.addEventListener('contextmenu', function(e) {
        if (!unlocked) {
            e.preventDefault(); // חסימת לחצן ימני
        }
    });
})();
