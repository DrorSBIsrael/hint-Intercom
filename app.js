// Mobile Detection
if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    document.documentElement.classList.add('is-mobile');
}

// Utility to fix API dates that are stored as local time but returned as UTC
function fixApiDates(data) {
    if (!data || !Array.isArray(data)) return data;
    data.forEach(item => {
        if (item.created_at && item.created_at.endsWith('+00:00')) {
            // Remove +00:00 so the browser treats it as local time instead of UTC!
            item.created_at = item.created_at.replace('+00:00', '');
        }
    });
    return data;
}
// Cache Buster for Old Parking Format or Missing Names
(function checkOldParkingFormat() {
    const parkingsStr = sessionStorage.getItem('intercom_allowed_parkings');
    if (parkingsStr) {
        try {
            const arr = JSON.parse(parkingsStr);
            if (arr.length > 0) {
                const first = arr[0];
                if (typeof first === 'string' || (typeof first === 'object' && !first.name)) {
                    sessionStorage.removeItem('intercom_session_token');
                    sessionStorage.removeItem('intercom_allowed_parkings');
                    if (window.location.pathname.includes('owner_dashboard.html')) {
                        window.location.href = 'index.html';
                    }
                }
            }
        } catch(e) {}
    }
})();

// State
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://hint-intercom-backend.onrender.com';

let allCalls = [];
let filteredCalls = [];
let lastFetchedTime = 0;

// Removed lastSeen variables since they break on filtering
let isSoundEnabled = true;


// ----------------------------------------------------
// Multi-language Support
// ----------------------------------------------------
let currentLang = localStorage.getItem('app_lang') || 'he';

function updateUIForLanguage() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = (currentLang === 'he' || currentLang === 'ar') ? 'rtl' : 'ltr';
    
    // Update translations
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = translations[currentLang][key];
            } else {
                el.innerText = translations[currentLang][key];
            }
        } else {
            el.innerText = t(key);
        }
    });
    
    // Update the dropdown button text
    const currentLangBtn = document.getElementById('current-lang-btn');
    if (currentLangBtn) {
        if (currentLang === 'he') currentLangBtn.innerText = 'עברית ▾';
        else if (currentLang === 'ar') currentLangBtn.innerText = 'العربية ▾';
        else if (currentLang === 'en') currentLangBtn.innerText = 'English ▾';
        else if (currentLang === 'ru') currentLangBtn.innerText = 'Русский ▾';
    }
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        el.placeholder = t(key);
    });
    
    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.id !== 'current-lang-btn') {
            const langCode = btn.getAttribute('data-lang');
            const checkIcon = btn.querySelector('.lang-check');
            if (langCode === currentLang) {
                btn.style.opacity = '1';
                btn.style.background = 'rgba(255, 255, 255, 0.05)';
                if (checkIcon) checkIcon.style.opacity = '1';
            } else {
                btn.style.opacity = '0.7';
                btn.style.background = 'transparent';
                if (checkIcon) checkIcon.style.opacity = '0';
            }
        }
    });
}

// Language Dropdown Logic
const langDropdownBtn = document.getElementById('current-lang-btn');
const langDropdownMenu = document.getElementById('lang-dropdown-menu');

if (langDropdownBtn && langDropdownMenu) {
    langDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langDropdownMenu.classList.toggle('hidden');
    });
    
    document.addEventListener('click', () => {
        if (!langDropdownMenu.classList.contains('hidden')) {
            langDropdownMenu.classList.add('hidden');
        }
    });
}

document.querySelectorAll('.lang-btn').forEach(btn => {
    // Only bind to elements that actually have data-lang to change it
    if(btn.id !== 'current-lang-btn') {
        btn.addEventListener('click', (e) => {
            const lang = e.target.getAttribute('data-lang');
            if (lang) {
                currentLang = lang;
                localStorage.setItem('app_lang', currentLang);
                updateUIForLanguage();
                if (typeof pollCalls === 'function' && typeof cachedAllCalls !== 'undefined') {
                    renderTable(cachedAllCalls);
                } else if (typeof renderTable === 'function') {
                    renderTable(allCalls);
                }
            }
        });
    }
});

// Run initially after a tiny timeout to ensure DOM is ready
setTimeout(() => {
    updateUIForLanguage();
}, 100);

let audioCtx = null;
let audioCtxInitialized = false;

function initAudioContext() {
    if (!audioCtxInitialized) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        // Play silent sound to unlock audio engine
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.01);

        audioCtxInitialized = true;
        ['click', 'touchstart', 'keydown'].forEach(evt => {
            document.removeEventListener(evt, initAudioContext);
        });
    }
}

['click', 'touchstart', 'keydown'].forEach(evt => {
    document.addEventListener(evt, initAudioContext);
});

function playNotificationSound() {
    if (!isSoundEnabled) return;
    
    // Fallback if somehow not initialized
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    function playTone(freq, duration, type='sine', vol=0.5) {
        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gainNode.gain.value = vol;
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {
            console.warn("playTone error:", e);
        }
    }

    const soundType = document.getElementById('sound-select')?.value || '1';
    
    const playSelectedTone = () => {
        if (soundType === '1') {
            playTone(784, 0.4, 'sine', 0.5);
            setTimeout(() => playTone(659, 0.6, 'sine', 0.5), 400);
        } else if (soundType === '2') {
            playTone(300, 0.15, 'triangle', 0.7);
            setTimeout(() => playTone(300, 0.25, 'triangle', 0.5), 200);
        } else if (soundType === '3') {
            playTone(880, 0.6, 'sine', 0.4);
            setTimeout(() => playTone(1108, 0.8, 'sine', 0.4), 150);
        } else if (soundType === '4') {
            playTone(440, 0.1, 'square', 0.2);
            setTimeout(() => playTone(440, 0.1, 'square', 0.2), 300);
        }
    };

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            playSelectedTone();
        }).catch(e => {
            console.warn("AudioContext resume failed:", e);
            // Browser blocked audio.
            const btn = document.getElementById('sound-toggle-btn');
            if (btn) {
                btn.style.color = '#ff3b30'; // Highlight the button
                setTimeout(() => { btn.style.color = ''; }, 2000);
            }
        });
    } else {
        playSelectedTone();
    }
}

document.getElementById('sound-toggle-btn')?.addEventListener('click', (e) => {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('intercom_pref_sound_enabled', isSoundEnabled);
    
    const soundWaves = document.getElementById('sound-waves');
    const soundMuteLine = document.getElementById('sound-mute-line');
    if (soundWaves) soundWaves.style.display = isSoundEnabled ? 'block' : 'none';
    if (soundMuteLine) soundMuteLine.style.display = isSoundEnabled ? 'none' : 'block';
    
    e.currentTarget.style.opacity = isSoundEnabled ? '1' : '0.7';
    
    const soundSelect = document.getElementById('sound-select');
    if (soundSelect) {
        soundSelect.style.display = isSoundEnabled ? 'block' : 'none';
    }
    
    if (isSoundEnabled) playNotificationSound();
});

document.getElementById('sound-select')?.addEventListener('change', (e) => {
    localStorage.setItem('intercom_pref_sound_type', e.target.value);
    if (isSoundEnabled) playNotificationSound();
});

let currentParkingId = 'all';

// Setup DOM elements
const elLoginScreen = document.getElementById('login-screen');
const elTwoFaScreen = document.getElementById('two-fa-screen');
const elDashboardScreen = document.getElementById('dashboard-screen');
const elGlobalClock = document.getElementById('global-clock');

// Helper to switch screens
function showScreen(screenId) {
    if (screenId === 'two-fa-screen') {
        document.getElementById('two-fa-screen').classList.add('active');
        return;
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ----------------------------------------------------
// Clock
// ----------------------------------------------------
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }); // HH:MM:SS
    const dateStr = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }); // DD.MM.YYYY
    const elGlobalClock = document.getElementById('global-clock');
    const elGlobalDate = document.getElementById('global-date');
    if (elGlobalClock) {
        elGlobalClock.dir = "ltr";
        elGlobalClock.innerHTML = `<span class="time-text">${timeStr}</span>`;
    }
    if (elGlobalDate) {
        elGlobalDate.dir = "ltr";
        elGlobalDate.innerHTML = `<span class="date-text">${dateStr}</span>`;
    }
    
    // Update Greeting
    const greetingEls = document.querySelectorAll('.greeting-container, #greeting-container');
    if (greetingEls.length > 0) {
        const hour = now.getHours();
        let transKey = 'good_night';
        if (hour >= 5 && hour < 12) transKey = 'good_morning';
        else if (hour >= 12 && hour < 18) transKey = 'good_afternoon';
        else if (hour >= 18 && hour < 22) transKey = 'good_evening';
        
        const rawUsername = sessionStorage.getItem('username') || '';
        // Extract only the first word (Hebrew or English), ignoring symbols and subsequent words
        const username = rawUsername.split(/[^a-zA-Zא-ת]/)[0] || rawUsername;
        
        const parkingSelect = document.getElementById('parking-selector');
        let parkingName = '';
        if (parkingSelect && parkingSelect.options.length > 0 && parkingSelect.value !== 'all') {
            parkingName = parkingSelect.options[parkingSelect.selectedIndex].text;
        }
        
        // As requested: instead of "All Parkings" (כל החניות), write the username.
        // We will put them on a single line: [Greeting] [Username]
        let htmlStr = `<div style="display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; width: 100%;">`;
        
        htmlStr += `<span style="font-size: 1.43rem; font-weight: 700; color: var(--text-highlight); line-height: 1;">${t(transKey)}</span>`;
        
        if (username) {
            htmlStr += `<span style="font-size: 1.43rem; font-weight: 700; opacity: 0.85; line-height: 1;">${username}</span>`;
        }
        if (parkingName) {
            htmlStr += `<span style="font-size: 1.15rem; font-weight: 500; color: var(--text-main); margin-top: 2px;">ב${parkingName}</span>`;
        }
        htmlStr += `</div>`;
        
        greetingEls.forEach(el => el.innerHTML = htmlStr);
    }
}
setInterval(updateClock, 1000);
updateClock();

// ----------------------------------------------------
// Login Logic
// ----------------------------------------------------
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

if (loginForm) {
    // Load remember me
    const rememberMeCheck = document.getElementById('remember-me');
    const userField = document.getElementById('username');
    const passField = document.getElementById('password');
    if (rememberMeCheck && userField && passField) {
        const savedUser = localStorage.getItem('intercom_remember_user');
        const savedPass = localStorage.getItem('intercom_remember_pass');
        if (savedUser && savedPass) {
            userField.value = savedUser;
            passField.value = savedPass;
            rememberMeCheck.checked = true;
        }
    }

    loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    // Check pattern explicitly in JS just in case
    if (!/^[a-zA-Z0-9@]+$/.test(pass)) {
        loginError.innerText = "הסיסמא יכולה להכיל רק אותיות, מספרים ו-@";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            loginError.innerText = "";
            sessionStorage.setItem('intercom_session_token', data.session_token);
            sessionStorage.setItem('username', user);
            
            const rememberMe = document.getElementById('remember-me')?.checked;
            if (rememberMe) {
                localStorage.setItem('intercom_remember_user', user);
                localStorage.setItem('intercom_remember_pass', pass);
            } else {
                localStorage.removeItem('intercom_remember_user');
                localStorage.removeItem('intercom_remember_pass');
            }
            

            // Move to 2FA
            showScreen('two-fa-screen');
            // Auto focus first 2FA input
            const firstInput = document.querySelector('.code-input');
            if(firstInput) firstInput.focus();
        } else {
            loginError.innerText = data.error || "שם משתמש או סיסמא שגויים";
        }
    } catch (err) {
        console.error(err);
        loginError.innerText = "שגיאת רשת מול השרת";
    }
});
}

// ----------------------------------------------------
// 2FA Logic
// ----------------------------------------------------
const codeInputs = document.querySelectorAll('.code-input');
const twoFaError = document.getElementById('two-fa-error');

if (codeInputs.length > 0) {
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
        // Allow only numbers
        input.value = input.value.replace(/[^0-9]/g, '');
        
        if (input.value !== '') {
            // Move to next
            if (index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            } else {
                // Last digit entered, auto submit
                checkTwoFaCode();
            }
        }
    });

    // Handle backspace
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value === '' && index > 0) {
            codeInputs[index - 1].focus();
        }
    });
});
}

function checkTwoFaCode() {
    let code = Array.from(codeInputs).map(i => i.value).join('');
    if (code.length === 6) {
        const sessionToken = sessionStorage.getItem('intercom_session_token');
        if (!sessionToken) {
            twoFaError.innerText = "סשן לא חוקי, אנא התחבר מחדש";
            return;
        }
        
        fetch(`${API_BASE_URL}/api/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_token: sessionToken, code: code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                twoFaError.innerText = "";
                if (data.auth_token) sessionStorage.setItem('intercom_auth_token', data.auth_token);
                if (data.username) sessionStorage.setItem('username', data.username);
                if (data.role) sessionStorage.setItem('intercom_user_role', data.role);
                if (data.allowed_parkings) sessionStorage.setItem('intercom_allowed_parkings', JSON.stringify(data.allowed_parkings));
                if (data.rate_per_minute) sessionStorage.setItem('intercom_rate_per_minute', data.rate_per_minute);
                if (typeof startSessionMonitor === 'function') startSessionMonitor();
                if (data.role === 'admin' || data.role === 'owner' || data.role === 'manager') {
                    window.location.href = 'owner_dashboard.html';
                } else {
                    initDashboard();
                    showScreen('dashboard-screen');
                }
            } else {
                twoFaError.innerText = data.error || "קוד אימות שגוי";
                // Clear inputs on error
                codeInputs.forEach(i => i.value = '');
                codeInputs[0].focus();
            }
        })
        .catch(err => {
            console.error(err);
            twoFaError.innerText = "שגיאת רשת מול השרת";
        });
    }
}

document.getElementById('close-2fa-btn')?.addEventListener('click', () => {
    document.getElementById('two-fa-screen').classList.remove('active');
    if (typeof codeInputs !== 'undefined') codeInputs.forEach(i => i.value = '');
    if (twoFaError) twoFaError.innerText = '';
});

document.addEventListener('keydown', (e) => {
    const twoFaScreen = document.getElementById('two-fa-screen');
    if (e.key === 'Escape' && twoFaScreen && twoFaScreen.classList.contains('active')) {
        twoFaScreen.classList.remove('active');
        if (typeof codeInputs !== 'undefined') codeInputs.forEach(i => i.value = '');
        if (twoFaError) twoFaError.innerText = '';
    }
});

// ----------------------------------------------------
// Theme & Accessibility
// ----------------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
const fontSizeSlider = document.getElementById('font-size-slider');
const appBody = document.getElementById('app-body');

let baseFontSize = 16;

const savedFontSize = localStorage.getItem('intercom_font_size');
if (savedFontSize) {
    baseFontSize = parseInt(savedFontSize, 10);
    document.documentElement.style.setProperty('--base-font-size', `${baseFontSize}px`);
    if (fontSizeSlider) fontSizeSlider.value = baseFontSize;
} else {
    if (fontSizeSlider) fontSizeSlider.value = 16;
}


themeToggle.addEventListener('click', () => {
    if (appBody.classList.contains('dark-mode')) {
        appBody.classList.remove('dark-mode');
        appBody.classList.add('light-mode');
        localStorage.setItem('intercom_pref_theme', 'light-mode');
    } else {
        appBody.classList.remove('light-mode');
        appBody.classList.add('dark-mode');
        localStorage.setItem('intercom_pref_theme', 'dark-mode');
    }
});

if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', (e) => {
        baseFontSize = parseInt(e.target.value, 10);
        document.documentElement.style.setProperty('--base-font-size', `${baseFontSize}px`);
        localStorage.setItem('intercom_font_size', baseFontSize);
    });
}

document.getElementById('logout-btn').addEventListener('click', () => {
    // Clear 2FA inputs
    if (typeof codeInputs !== 'undefined') codeInputs.forEach(i => i.value = '');
    const uname = document.getElementById('username');
    if (uname) uname.value = '';
    const pwd = document.getElementById('password');
    if (pwd) pwd.value = '';
    
    sessionStorage.removeItem('intercom_session_token');
    sessionStorage.removeItem('intercom_user_role');
    
    if (document.getElementById('owner-dashboard-marker')) {
        window.location.href = 'index.html';
    } else {
        showScreen('login-screen');
    }
});

// ----------------------------------------------------
// Dashboard Logic & Data Fetching
// ----------------------------------------------------

async function pollOperatorCallsFast() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/operator_calls?t=${Date.now()}`);
        if (!res.ok) return;
        let opCalls = await res.json();
        opCalls = fixApiDates(opCalls);
        opCalls = filterDataByAllowedParkings(opCalls);
        
        let shouldRender = false;
        let shouldBeep = false;
        window.notifiedCallIds = window.notifiedCallIds || new Set();
        
        opCalls.forEach(opCall => {
            const existingIdx = allCalls.findIndex(c => String(c.id) === String(opCall.id));
            if (existingIdx === -1) {
                // Completely new call (or old one falling out of cache)
                opCall.isNew = true;
                allCalls.unshift(opCall);
                shouldRender = true;
                
                if (!window.notifiedCallIds.has(String(opCall.id))) {
                    const isRecent = (Date.now() - new Date(opCall.created_at).getTime()) < 1000 * 60 * 60; // 1 hour
                    if (isRecent) {
                        shouldBeep = true;
                    }
                    window.notifiedCallIds.add(String(opCall.id));
                }
            } else {
                // Exists, check if it just became forwarded
                const oldCall = allCalls[existingIdx];
                if (String(oldCall.is_forwarded).toLowerCase() !== 'true') {
                    opCall.isNew = true;
                    allCalls[existingIdx] = opCall;
                    shouldRender = true;
                    
                    if (!window.notifiedCallIds.has(String(opCall.id))) {
                        shouldBeep = true;
                        window.notifiedCallIds.add(String(opCall.id));
                    }
                }
            }
        });
        
        if (shouldRender) {
            allCalls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            applyFilters();
        }
        if (shouldBeep) {
            playNotificationSound();
        }
    } catch (e) {
        console.error("Fast polling error:", e);
    }
}



function filterDataByAllowedParkings(dataArray) {
    const role = sessionStorage.getItem('intercom_user_role');
    if (role === 'admin') return dataArray;
    
    const allowedParkingsStr = sessionStorage.getItem('intercom_allowed_parkings');
    let allowedParkings = [];
    if (allowedParkingsStr) {
        try { allowedParkings = JSON.parse(allowedParkingsStr); } catch(e) {}
    }
    if (allowedParkings.length === 0) return []; // If operator has no parkings assigned, they see nothing
    
    const allowedStr = allowedParkings.map(p => String(p.id || p));
    return dataArray.filter(item => allowedStr.includes(String(item.parking_id)));
}

async function fetchInitialCalls() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/calls?t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch calls");
        let newCalls = await res.json();
        newCalls = fixApiDates(newCalls);
        newCalls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        newCalls = filterDataByAllowedParkings(newCalls);

            let playSound = false;
            
            if (allCalls.length === 0) {
                allCalls = newCalls;
            } else {
                // Check for genuinely new calls
                const genuinelyNewCalls = newCalls.filter(nc => !allCalls.find(oc => String(oc.id) === String(nc.id)));
                if (genuinelyNewCalls.length > 0) {
                    if (genuinelyNewCalls.some(nc => String(nc.is_forwarded).toLowerCase() === 'true')) {
                        playSound = true;
                    }
                }
                
                // Check top 10 for updates to is_forwarded
                for (let i = 0; i < Math.min(newCalls.length, 10); i++) {
                    const nc = newCalls[i];
                    const oc = allCalls.find(c => String(c.id) === String(nc.id));
                    if (oc && String(oc.is_forwarded).toLowerCase() === 'false' && String(nc.is_forwarded).toLowerCase() === 'true') {
                        nc.isNew = true;
                        playSound = true;
                    }
                }
                
                // Keep 'isNew' tag for UI animation
                const oldLatestId = allCalls[0].id;
                for (let i = 0; i < newCalls.length; i++) {
                    if (newCalls[i].id === oldLatestId) break;
                    newCalls[i].isNew = true;
                }
                
                // Preserve old operator calls that might not be in the top 2000 recent calls
                const existingOpCalls = allCalls.filter(c => String(c.is_forwarded).toLowerCase() === 'true');
                const merged = [...newCalls];
                existingOpCalls.forEach(opc => {
                    if (!merged.find(mc => String(mc.id) === String(opc.id))) {
                        merged.push(opc);
                    }
                });
                merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                allCalls = merged;
            }
            
            const role = sessionStorage.getItem('intercom_user_role');
            const allowedParkingsStr = sessionStorage.getItem('intercom_allowed_parkings');
            let allowedParkings = [];
            if (allowedParkingsStr) {
                try { allowedParkings = JSON.parse(allowedParkingsStr); } catch(e) {}
            }
            const allowedStr = allowedParkings.map(p => String(p.id || p));
            
            const parkingSelect = document.getElementById('parking-selector');
            if (parkingSelect && parkingSelect.options.length <= 1) {
                let lots = [];
                if (role === 'admin') {
                    lots = [...new Set(allCalls.map(c => c.parking_id))].filter(Boolean);
                    if (allowedParkings.length > 0) {
                        lots = [...new Set([...lots, ...allowedStr])].filter(Boolean);
                    }
                } else {
                    lots = [...allowedStr];
                }
                
                parkingSelect.innerHTML = '';
                if (lots.length > 1 || role === 'admin') {
                    parkingSelect.innerHTML = '<option value="all">כל החניונים</option>';
                }
                
                lots.forEach(lot => {
                    const opt = document.createElement('option');
                    opt.value = lot;
                    
                    let name = typeof getParkingNameById === 'function' ? getParkingNameById(lot) : lot;
                    if (name === String(lot)) {
                        opt.innerText = `${name}`;
                    } else {
                        opt.innerText = `${name} (מס' ${lot})`;
                    }

                    if (lot === currentParkingId || lots.length === 1) {
                        opt.selected = true;
                        currentParkingId = lot; // Auto-select if only 1 option
                    }
                    parkingSelect.appendChild(opt);
                });
                
                const displaySpan = document.getElementById('selected-parking-display');
                if (displaySpan) {
                    displaySpan.innerText = parkingSelect.options[parkingSelect.selectedIndex].text;
                }
            
            // Populate owner list forms if present
            document.querySelectorAll('.owner-parking-select').forEach(sel => {
                sel.innerHTML = '<option value="">בחר חניון (חובה)</option>';
                lots.forEach(lot => {
                    const opt = document.createElement('option');
                    opt.value = lot;
                    opt.innerText = typeof getParkingNameById === 'function' ? getParkingNameById(lot) : lot;
                    sel.appendChild(opt);
                });
            });

            // Populate manual event parking datalist
            const evPidList = document.getElementById('ev_pid_list');
            if (evPidList) {
                evPidList.innerHTML = '';
                lots.forEach(lot => {
                    const opt = document.createElement('option');
                    opt.value = lot;
                    opt.innerText = typeof getParkingNameById === 'function' ? getParkingNameById(lot) : lot;
                    evPidList.appendChild(opt);
                });
            }
        }
        
        populateActionDbDropdown(allCalls);
        
        applyFilters();
        
        if (typeof refreshMobileDropdownNames === 'function') {
            refreshMobileDropdownNames();
        }
        
        calculateAICosts(allCalls);
        
        if (playSound && !isInitialLoad) {
            playNotificationSound();
        }
    } catch (e) {
        console.error("Failed to poll CSV", e);
    }
}

window.dbParkingNames = {};

async function fetchParkingNames() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/parkings?t=${Date.now()}`);
        if (res.ok) {
            window.dbParkingNames = await res.json();
        }
    } catch (e) {
        console.error("Failed to fetch parking names", e);
    }
}

async function initDashboard() {
    await fetchParkingNames();
    // Fetch caches independently so they don't block initial calls
    fetchAndRenderActionList('blocked').catch(e => console.warn('Blocked fetch skipped', e));
    fetchAndRenderActionList('authorized').catch(e => console.warn('Authorized fetch skipped', e));
    
    await fetchInitialCalls();
    
    try {
        const configRes = await fetch(`${API_BASE_URL}/api/config`);
        const config = await configRes.json();
        
        if (config.SUPABASE_URL && config.SUPABASE_KEY && window.supabase) {
            const supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
            
            supabaseClient
              .channel('realtime-calls')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'calls_log' }, payload => {
                let newCall = payload.new;
                if (!newCall) return; // handles DELETE where payload.new is null
                
                // Fix timezone offset for incoming realtime calls
                if (newCall.created_at && newCall.created_at.endsWith('+00:00')) {
                    newCall.created_at = newCall.created_at.replace('+00:00', '');
                }
                
                // Convert booleans to strings to match existing logic if needed
                if (typeof newCall.is_forwarded === 'boolean') {
                    newCall.is_forwarded = newCall.is_forwarded ? 'true' : 'false';
                }
                
                // Check permissions before adding
                if (filterDataByAllowedParkings([newCall]).length === 0) return;

                if (payload.eventType === 'INSERT') {
                    newCall.isNew = true;
                    // Add to start of array
                    allCalls.unshift(newCall);
                    
                    // Play notification sound ONLY if it's forwarded to the operator
                    if (String(newCall.is_forwarded).toLowerCase() === 'true') {
                        playNotificationSound();
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const existingIdx = allCalls.findIndex(c => String(c.id) === String(newCall.id));
                    if (existingIdx !== -1) {
                        const oldCall = allCalls[existingIdx];
                        const wasForwarded = String(oldCall.is_forwarded).toLowerCase() === 'true';
                        const isNowForwarded = String(newCall.is_forwarded).toLowerCase() === 'true';
                        
                        allCalls[existingIdx] = newCall;
                        
                        // If it changed from NOT forwarded to forwarded, play the sound!
                        if (!wasForwarded && isNowForwarded) {
                            newCall.isNew = true;
                            playNotificationSound();
                        }
                    } else {
                        // Not in list yet, treat as insert
                        allCalls.unshift(newCall);
                        if (String(newCall.is_forwarded).toLowerCase() === 'true') {
                            playNotificationSound();
                        }
                    }
                }
                
                // Apply filters & update UI
                applyFilters();
                calculateAICosts(allCalls);
              })
              .subscribe();
              
            supabaseClient
              .channel('realtime-lists')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'blacklist' }, payload => {
                  if (typeof fetchAndRenderActionList === 'function') {
                      fetchAndRenderActionList('blocked').catch(e => console.warn('Blocked fetch skipped', e));
                  }
              })
              .on('postgres_changes', { event: '*', schema: 'public', table: 'whitelist' }, payload => {
                  if (typeof fetchAndRenderActionList === 'function') {
                      fetchAndRenderActionList('authorized').catch(e => console.warn('Authorized fetch skipped', e));
                  }
              })
              .subscribe();
              
            console.log("Supabase Realtime connected for calls and lists!");
        }
    } catch(e) {
        console.error("Failed to setup realtime", e);
    }
    
    // Initialize the single global polling timer
    startGlobalPolling();
    
    // Attach guards to all scrollable lists and tables
    setupGlobalListGuards();
    
    // Setup owner forms
    setupOwnerListForms();
    // Initial fetch done at start of initDashboard
}

document.getElementById('parking-selector')?.addEventListener('change', (e) => {
    currentParkingId = e.target.value;
    localStorage.setItem('intercom_pref_parking', currentParkingId);
    applyFilters();
});

// Load preferences on initialization
function loadPreferences() {
    const savedParking = localStorage.getItem('intercom_pref_parking');
    if (savedParking && document.getElementById('parking-selector')) {
        document.getElementById('parking-selector').value = savedParking;
        currentParkingId = savedParking;
    }

    // Timeframe preferences intentionally not loaded, defaults to today/24h

    const savedTheme = localStorage.getItem('intercom_pref_theme');
    if (savedTheme && document.getElementById('app-body')) {
        const appBody = document.getElementById('app-body');
        appBody.classList.remove('dark-mode', 'light-mode');
        appBody.classList.add(savedTheme);
    }

    const savedSoundEnabled = localStorage.getItem('intercom_pref_sound_enabled');
    if (savedSoundEnabled !== null) {
        isSoundEnabled = savedSoundEnabled === 'true';
        // If owner dashboard (no toggle), force true
        if (!document.getElementById('sound-toggle-btn')) {
            isSoundEnabled = true;
        }
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            soundBtn.style.opacity = isSoundEnabled ? '1' : '0.7';
            const soundWaves = document.getElementById('sound-waves');
            const soundMuteLine = document.getElementById('sound-mute-line');
            if (soundWaves) soundWaves.style.display = isSoundEnabled ? 'block' : 'none';
            if (soundMuteLine) soundMuteLine.style.display = isSoundEnabled ? 'none' : 'block';
        }
        const soundSelect = document.getElementById('sound-select');
        if (soundSelect) {
            soundSelect.style.display = isSoundEnabled ? 'block' : 'none';
        }
    }

    const savedSoundType = localStorage.getItem('intercom_pref_sound_type');
    if (savedSoundType && document.getElementById('sound-select')) {
        document.getElementById('sound-select').value = savedSoundType;
    }
}
loadPreferences();

function applyFilters() {
    if (currentParkingId === 'all') {
        filteredCalls = allCalls;
    } else {
        filteredCalls = allCalls.filter(c => c.parking_id === currentParkingId);
    }
    
    updateStatistics();
    updateRecentCalls();
    renderPopularTimes();
    updateLanesList();
    
    // Re-render action lists to reflect dynamic entry/exit times from allCalls
    if (typeof cachedBlocked !== 'undefined' && cachedBlocked) {
        renderActionList('blocked', cachedBlocked);
        if (typeof renderOwnerActionList === 'function') renderOwnerActionList('blocked', cachedBlocked);
    }
    if (typeof cachedAuthorized !== 'undefined' && cachedAuthorized) {
        renderActionList('authorized', cachedAuthorized);
        if (typeof renderOwnerActionList === 'function') renderOwnerActionList('authorized', cachedAuthorized);
    }
    
    updateTable();
    
    if (typeof updateGraph === 'function') {
        try { updateGraph(); } catch(e){}
    }
    
    // Also re-render the action lists based on the newly selected parking
    if (typeof fetchAndRenderActionList === 'function') {
        fetchAndRenderActionList('blocked').catch(() => []);
        fetchAndRenderActionList('authorized').catch(() => []);
    }
    
    setTimeout(() => {
        allCalls.forEach(c => { c.isNew = false; });
    }, 3100); // Wait until animations finish
}

// ----------------------------------------------------
// UI Updates
// ----------------------------------------------------
document.getElementById('stats-timeframe')?.addEventListener('change', (e) => {
    const customContainer = document.getElementById('custom-date-range');
    const loader = document.getElementById('global-loader');
    
    if (loader) loader.style.display = 'flex';
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (customContainer) {
                if (e.target.value === 'custom') {
                    customContainer.style.display = 'flex';
                    if (loader) loader.style.display = 'none';
                } else {
                    customContainer.style.display = 'none';
                    updateStatistics();
                    if (loader) loader.style.display = 'none';
                }
            } else {
                updateStatistics();
                if (loader) loader.style.display = 'none';
            }
        });
    });
});

document.getElementById('apply-custom-date')?.addEventListener('click', () => {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'flex';
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            updateStatistics();
            if (loader) loader.style.display = 'none';
        });
    });
});

document.getElementById('ai-cost-timeframe')?.addEventListener('change', () => {
    calculateAICosts(allCalls);
});

function getStatsCalls() {
    const timeframeEl = document.getElementById('stats-timeframe');
    if (!timeframeEl) return filteredCalls;
    const timeframe = timeframeEl.value;
    
    let latestDate = new Date();
    if(allCalls.length > 0) {
         latestDate = new Date(allCalls[0].created_at);
    }
    
    let statsCalls = filteredCalls;
    
    if (timeframe === 'today') {
        const startOfDay = new Date(latestDate);
        startOfDay.setHours(0,0,0,0);
        statsCalls = filteredCalls.filter(c => new Date(c.created_at) >= startOfDay);
    } else if (timeframe === '7d') {
        const past = new Date(latestDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        statsCalls = filteredCalls.filter(c => new Date(c.created_at) >= past);
    } else if (timeframe === '30d') {
        const past = new Date(latestDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        statsCalls = filteredCalls.filter(c => new Date(c.created_at) >= past);
    } else if (timeframe === '3m') {
        const past = new Date(latestDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        statsCalls = filteredCalls.filter(c => new Date(c.created_at) >= past);
    } else if (timeframe === '6m') {
        const past = new Date(latestDate.getTime() - 180 * 24 * 60 * 60 * 1000);
        statsCalls = filteredCalls.filter(c => new Date(c.created_at) >= past);
    } else if (timeframe === '12m') {
        const past = new Date(latestDate.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
        statsCalls = filteredCalls.filter(c => new Date(c.created_at) >= past);
    } else if (timeframe === 'custom') {
        const startVal = document.getElementById('custom-start-date')?.value;
        const endVal = document.getElementById('custom-end-date')?.value;
        if (startVal && endVal) {
            const startD = new Date(startVal);
            startD.setHours(0, 0, 0, 0);
            const endD = new Date(endVal);
            endD.setHours(23, 59, 59, 999);
            statsCalls = filteredCalls.filter(c => {
                const d = new Date(c.created_at);
                return d >= startD && d <= endD;
            });
        }
    }
    return statsCalls;
}

function updateStatistics() {
    const statsCalls = getStatsCalls();
    
    // Make sure the popular times graph updates too when timeframe changes
    renderPopularTimes();
    
    // Update AI Cost when timeframe changes
    calculateAICosts(allCalls);
    
    // Sync graph timeframe with stats timeframe
    const statsTf = document.getElementById('stats-timeframe');
    const graphTf = document.getElementById('graph-timeframe');
    if (statsTf && graphTf) {
        const val = statsTf.value;
        if (val === 'today') graphTf.value = '24h';
        else if (val === '7d') graphTf.value = '7d';
        else if (val === '30d') graphTf.value = '30d';
        else if (val !== 'custom') graphTf.value = 'monthly';
        
        // Hide custom graph inputs if not custom
        const customGraphDates = document.getElementById('custom-graph-dates');
        if (customGraphDates && val !== 'custom') {
            customGraphDates.style.display = 'none';
        }
        
        if (typeof updateGraph === 'function') {
            try { updateGraph(); } catch(e){}
        }
    }
    
    if (!window.animateValue) {
        window.animateValue = function(elementId, newValue, formatFn) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const startValue = parseFloat(el.dataset.val) || 0;
            if (startValue === newValue) {
                el.innerHTML = formatFn(newValue);
                return;
            }
            el.dataset.val = newValue;
            
            let startTimestamp = null;
            // Short animation so it doesn't look like it's lagging
            const delta = Math.abs(newValue - startValue);
            const duration = delta <= 2 ? 200 : 500;
            
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const current = easeOut * (newValue - startValue) + startValue;
                el.innerHTML = formatFn(current);
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    el.innerHTML = formatFn(newValue);
                }
            };
            window.requestAnimationFrame(step);
        };
    }
    
    const aiCalls = statsCalls.filter(c => String(c.is_forwarded).toLowerCase() !== 'true' && c.is_forwarded !== true);
    const opCalls = statsCalls.filter(c => String(c.is_forwarded).toLowerCase() === 'true' || c.is_forwarded === true);
    
    const totalCallsCount = statsCalls.length;
    const aiPercent = totalCallsCount ? Math.round((aiCalls.length / totalCallsCount) * 100) : 0;
    const opPercent = totalCallsCount ? Math.round((opCalls.length / totalCallsCount) * 100) : 0;
    
    window.animateValue('stat-ai-calls', aiCalls.length, (val) => `${Math.floor(val)} <span style="font-size: 0.75em; margin-right: 5px;">${aiPercent}%</span>`);
    window.animateValue('stat-ai-calls-mobile', aiCalls.length, (val) => `${Math.floor(val)} <span style="font-size: 0.75em; margin-right: 5px;">${aiPercent}%</span>`);
    window.animateValue('stat-op-calls', opCalls.length, (val) => `${Math.floor(val)} <span style="font-size: 0.75em; margin-right: 5px;">${opPercent}%</span>`);
    window.animateValue('stat-op-calls-mobile', opCalls.length, (val) => `${Math.floor(val)} <span style="font-size: 0.75em; margin-right: 5px;">${opPercent}%</span>`);
    
    const laneCounts = { entries: {}, exits: {} };
    statsCalls.forEach(c => {
        const lane = c.lane_id;
        if (lane) {
            if (lane.toString().startsWith('1')) {
                laneCounts.entries[lane] = (laneCounts.entries[lane] || 0) + 1;
            } else {
                laneCounts.exits[lane] = (laneCounts.exits[lane] || 0) + 1;
            }
        }
    });

    const lanesContainer = document.getElementById('lanes-distribution-container');
    if (lanesContainer) {
        const entriesHtml = Object.entries(laneCounts.entries)
            .sort((a,b) => a[0].localeCompare(b[0]))
            .map(([lane, count]) => `<div style="margin-bottom: 4px;">כניסה ${lane} - ${count} שיחות</div>`)
            .join('');
            
        const exitsHtml = Object.entries(laneCounts.exits)
            .sort((a,b) => a[0].localeCompare(b[0]))
            .map(([lane, count]) => `<div style="margin-bottom: 4px;">יציאה ${lane} - ${count} שיחות</div>`)
            .join('');

        lanesContainer.innerHTML = `
            <div style="color: var(--color-desc); display: flex; flex-direction: column; flex: 1;">
                ${entriesHtml || '<div style="font-weight: normal; font-size: 0.8em; opacity: 0.7;">אין נתונים</div>'}
            </div>
            <div style="color: var(--color-desc); display: flex; flex-direction: column; text-align: left; flex: 1;">
                ${exitsHtml || '<div style="font-weight: normal; font-size: 0.8em; opacity: 0.7;">אין נתונים</div>'}
            </div>
        `;
    }

    function getExpectedPeakHours(allCallsArray, refDate) {
        const targetDay = refDate.getDay();
        const fourWeeksAgo = new Date(refDate.getTime() - 28 * 24 * 60 * 60 * 1000);
        
        const relevantCalls = allCallsArray.filter(c => {
            const d = new Date(c.created_at);
            return d >= fourWeeksAgo && d < refDate && d.getDay() === targetDay;
        });
        
        if (relevantCalls.length === 0) return '--:-- - --:--';
        
        const hours = {};
        relevantCalls.forEach(c => {
            const h = new Date(c.created_at).getHours();
            hours[h] = (hours[h] || 0) + 1;
        });
        
        let maxCount = -1;
        for (const count of Object.values(hours)) {
            if (count > maxCount) maxCount = count;
        }
        
        const peakHours = [];
        for (const [h, count] of Object.entries(hours)) {
            if (count >= Math.max(1, maxCount * 0.75)) {
                peakHours.push(parseInt(h));
            }
        }
        
        if (peakHours.length === 0) return '--:-- - --:--';
        
        peakHours.sort((a,b) => a - b);
        
        function formatHour(h) {
            if (h >= 24) return '00:00';
            return h.toString().padStart(2, '0') + ':00';
        }
        
        const ranges = [];
        let start = peakHours[0];
        let end = peakHours[0];
        
        for (let i = 1; i < peakHours.length; i++) {
            if (peakHours[i] === end + 1) {
                end = peakHours[i];
            } else {
                ranges.push(`${formatHour(start)} - ${formatHour(end+1)}`);
                start = peakHours[i];
                end = peakHours[i];
            }
        }
        ranges.push(`${formatHour(start)} - ${formatHour(end+1)}`);
        
        if (ranges.length > 2) {
            return ranges.slice(0, 2).join('<br>');
        }
        return ranges.join('<br>');
    }
    
    const peakPrevEl = document.getElementById('stat-peak-prev');
    if (peakPrevEl) {
        if (statsCalls.length > 0) {
            // Find max date in statsCalls to act as our reference
            let maxD = new Date(statsCalls[0].created_at);
            statsCalls.forEach(c => {
                const d = new Date(c.created_at);
                if (d > maxD) maxD = d;
            });
            peakPrevEl.innerHTML = getExpectedPeakHours(filteredCalls, maxD);
            // Adjust font size if string is very long
            if (peakPrevEl.innerHTML.length > 20) {
                peakPrevEl.style.fontSize = '1rem';
            } else {
                peakPrevEl.style.fontSize = '1.3rem';
            }
        } else {
            peakPrevEl.innerHTML = '--:-- - --:--';
        }
    }
    
    const avgDurationEl = document.getElementById('stat-avg-duration');
    if (avgDurationEl) {
        if (allCalls && allCalls.length > 0) {
            let allParkingCalls = allCalls;
            if (currentParkingId !== 'all') {
                allParkingCalls = allCalls.filter(c => String(c.parking_id) === String(currentParkingId));
            }
            
            const avgSeconds = getAverageStayTime(allParkingCalls);
            
            if (avgSeconds) {
                const m = Math.floor(avgSeconds / 60);
                const h = Math.floor(m / 60);
                const remM = m % 60;
                let timeStr = "";
                if (h > 0) {
                    timeStr = `${h} שעות ו-${remM} דק'`;
                } else {
                    timeStr = `${m} דק'`;
                }
                avgDurationEl.innerText = timeStr;
            } else {
                avgDurationEl.innerText = 'אין מספיק נתונים';
            }
        } else {
            avgDurationEl.innerText = '--';
        }
    }
    
    const aiTotalTime = aiCalls.reduce((acc, c) => acc + parseInt(c.call_duration || 0), 0);
    const opTotalTime = opCalls.reduce((acc, c) => acc + parseInt(c.call_duration || 0), 0);
    
    function formatTime(seconds) {
        if (!seconds || seconds < 0) seconds = 0;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }
    
    window.animateValue('stat-ai-avg', aiTotalTime, (val) => formatTime(Math.floor(val)));
    window.animateValue('stat-ai-avg-mobile', aiTotalTime, (val) => formatTime(Math.floor(val)));
    window.animateValue('stat-op-avg', opTotalTime, (val) => formatTime(Math.floor(val)));
    window.animateValue('stat-op-avg-mobile', opTotalTime, (val) => formatTime(Math.floor(val)));
}

function getParkingNameById(id) {
    if (!id) return id;
    
    // First, check the new global DB parking names dictionary
    if (window.dbParkingNames && window.dbParkingNames[String(id)]) {
        return window.dbParkingNames[String(id)];
    }
    
    // Second, check sessionStorage
    const allowedParkingsStr = sessionStorage.getItem('intercom_allowed_parkings');
    if (allowedParkingsStr) {
        try {
            const allowedParkings = JSON.parse(allowedParkingsStr);
            const matchingParking = allowedParkings.find(p => String(p.id || p) === String(id));
            if (matchingParking && matchingParking.name && matchingParking.name.trim() !== '') {
                return matchingParking.name.trim();
            }
        } catch(e) {}
    }
    
    // Second, look into the global allCalls array
    if (typeof allCalls !== 'undefined' && Array.isArray(allCalls)) {
        const matchingCall = allCalls.find(c => String(c.parking_id) === String(id) && c.parking_name && c.parking_name.trim() !== '');
        if (matchingCall) {
            return matchingCall.parking_name.trim();
        }
    }
    
    // Third, check the HTML select options inside #parking-selector
    const select = document.getElementById('parking-selector');
    if (select) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === String(id) && select.options[i].text && select.options[i].text !== String(id)) {
                return select.options[i].text;
            }
        }
    }
    
    // Fallback: raw id string
    return String(id);
}

function updateRecentCalls() {
    const statsCalls = typeof getStatsCalls === 'function' ? getStatsCalls() : filteredCalls;
    const aiCalls = statsCalls.filter(c => String(c.is_forwarded).toLowerCase() !== 'true' && c.is_forwarded !== true).slice(0, 50);
    const opCalls = statsCalls.filter(c => String(c.is_forwarded).toLowerCase() === 'true').slice(0, 50);
    
    const aiList = document.getElementById('recent-ai-list');
    const opList = document.getElementById('recent-op-list');
    
    if (aiList && aiCalls.length > 0) {
        
        aiList.innerHTML = '';
        aiCalls.forEach(c => {
            const date = new Date(c.created_at);
            const animClass = '';
            
            const timeStr = date.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = date.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
            
            const parkingName = c.parking_name || getParkingNameById(c.parking_id) || 'כללי';
            const laneStr = c.lane_id ? ` | נתיב: ${c.lane_id}` : '';
            const parkingInfo = ` | חניון: ${parkingName}` + laneStr;
            
            let req = c.request_summary || '-';
            req = req.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
            let act = c.actions_taken || '-';
            act = act.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
            const callTime = new Date(c.created_at).getTime();
            const blockedRecord = (window.cachedBlocked || []).find(b => String(b.plate).trim() === String(c.plate_number).trim() && (!b.parking_id || String(b.parking_id) === 'all' || String(b.parking_id) === String(c.parking_id)) && (!b.added_at || new Date(b.added_at).getTime() <= callTime));
            const authRecord = (window.cachedAuthorized || []).find(a => String(a.plate).trim() === String(c.plate_number).trim() && (!a.parking_id || String(a.parking_id) === 'all' || String(a.parking_id) === String(c.parking_id)) && (!a.added_at || new Date(a.added_at).getTime() <= callTime));
            
            let dName = c.driver_name || '';
            let dPhone = c.driver_phone || '';
            
            if (!dName && !dPhone) {
                if (authRecord) {
                    dName = authRecord.driver_name || '';
                    dPhone = authRecord.driver_phone || '';
                } else if (blockedRecord) {
                    dName = blockedRecord.driver_name || '';
                    dPhone = blockedRecord.driver_phone || '';
                }
            }

            const driverInfo = [];
            if (dName) driverInfo.push(`נהג: ${dName}`);
            if (dPhone) driverInfo.push(`טלפון: ${dPhone}`);
            const driverHtml = driverInfo.length > 0 ? ` <span style="font-size: 0.9em; color: var(--color-muted-text); font-weight: normal; margin-right: 8px;">(${driverInfo.join(' | ')})</span>` : '';
            
            let typeTag = '';
            if (!authRecord && !blockedRecord && c.plate_number) {
                const dbType = c.customer_type || c.vehicle_type || c.group_name || c.user_type || c.type;
                const finalType = dbType ? dbType : 'מזדמן';
                typeTag = ` <span style="font-size: 0.8em; background: var(--bg-panel); border: 1px solid var(--border-color); padding: 1px 5px; border-radius: 4px; color: var(--text-muted); font-weight: normal; margin-right: 6px; display: inline-block; vertical-align: middle;">${finalType}</span>`;
            }
            let alertHtml = '';
            if (req.includes('רכב חסום')) {
                let reason = req.replace('רכב חסום:', '').replace('רכב חסום', '').trim() || 'ללא סיבה';
                alertHtml = `<div style="margin-bottom: 6px; color: #ff3b30; font-weight: bold; font-size: 0.9em;">רכב חסום! סיבה: ${reason}</div>`;
            } else if (req.includes('רכב מורשה')) {
                let notes = req.replace('רכב מורשה:', '').replace('רכב מורשה', '').trim() || 'ללא סיבה';
                alertHtml = `<div style="margin-bottom: 6px; color: #34c759; font-weight: bold; font-size: 0.9em;">רכב מורשה סיבה (${notes})</div>`;
            } else if (blockedRecord) {
                let reason = (blockedRecord.reason || 'ללא סיבה').replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
                alertHtml = `<div style="margin-bottom: 6px; color: #ff3b30; font-weight: bold; font-size: 0.9em;">רכב חסום! סיבה: ${reason}</div>`;
            } else if (authRecord) {
                let notes = (authRecord.notes || 'ללא סיבה').replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
                alertHtml = `<div style="margin-bottom: 6px; color: #34c759; font-weight: bold; font-size: 0.9em;">רכב מורשה סיבה (${notes})</div>`;
            }
            const reasonHtml = ` <div class="call-item-reason">${alertHtml}<strong style="color: var(--color-req);">בקשה:</strong> <span style="color: var(--color-desc);">${req}</span><br><strong style="color: var(--color-act);">פעולה:</strong> <span style="color: var(--color-desc);">${act}</span></div>`;
            let plateDisplayCard = c.plate_number || 'לא ידוע';
            if (c.repaired_plate && c.repaired_plate !== c.plate_number) {
                plateDisplayCard += ` <span style="font-size:0.85em;color:var(--text-muted);font-weight:normal;" title="מספר שהוכתב ע״י הנהג">(הנהג תיקן ל-${c.repaired_plate})</span>`;
            }
            
            let plateCorrectionCount = 0;
            const currentCallTime = new Date(c.created_at).getTime();
            if (c.plate_number && typeof allCalls !== 'undefined') {
                allCalls.forEach(ac => {
                    if (String(ac.plate_number).trim() === String(c.plate_number).trim()) {
                        const acTime = new Date(ac.created_at).getTime();
                        if (acTime <= currentCallTime) {
                            if (String(ac.is_plate_corrected).toLowerCase() === 'true' || ac.is_plate_corrected === true) {
                                plateCorrectionCount++;
                            }
                        }
                    }
                });
            }
            if ((String(c.is_plate_corrected).toLowerCase() === 'true' || c.is_plate_corrected === true) && plateCorrectionCount >= 3) {
                plateDisplayCard += `<div style="font-size:0.85em;color:var(--accent-red);font-weight:bold;margin-top:2px;">⚠️ מצלמה כשלה בזיהוי ${plateCorrectionCount} פעמים</div>`;
            }
            
            aiList.innerHTML += `
                <li class="call-item call-item-container ${animClass}">
                    <div class="call-item-title">רכב: ${plateDisplayCard}${typeTag}${driverHtml}</div>
                    <div class="call-item-subtitle">${timeStr} | ${dateStr}${parkingInfo}</div>
                    ${reasonHtml}
                </li>
            `;
        });
    }
    
    if (opList && opCalls.length > 0) {
        
        opList.innerHTML = '';
        opCalls.forEach((c, index) => {
            const date = new Date(c.created_at);
            const hlClass = c.isNew ? 'highlight' : '';
            const animClass = c.isNew ? 'pulse-red-anim' : '';
            
            const timeStr = date.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = date.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
            
            const parkingName = c.parking_name || getParkingNameById(c.parking_id) || 'כללי';
            const laneStr = c.lane_id ? ` | נתיב: ${c.lane_id}` : '';
            const parkingInfo = ` | חניון: ${parkingName}` + laneStr;
            
            let req = c.request_summary || '-';
            req = req.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
            let act = c.actions_taken || '-';
            act = act.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
            const callTime = new Date(c.created_at).getTime();
            const blockedRecord = (window.cachedBlocked || []).find(b => String(b.plate).trim() === String(c.plate_number).trim() && (!b.parking_id || String(b.parking_id) === 'all' || String(b.parking_id) === String(c.parking_id)) && (!b.added_at || new Date(b.added_at).getTime() <= callTime));
            const authRecord = (window.cachedAuthorized || []).find(a => String(a.plate).trim() === String(c.plate_number).trim() && (!a.parking_id || String(a.parking_id) === 'all' || String(a.parking_id) === String(c.parking_id)) && (!a.added_at || new Date(a.added_at).getTime() <= callTime));
            
            let dName = c.driver_name || '';
            let dPhone = c.driver_phone || '';
            
            if (!dName && !dPhone) {
                if (authRecord) {
                    dName = authRecord.driver_name || '';
                    dPhone = authRecord.driver_phone || '';
                } else if (blockedRecord) {
                    dName = blockedRecord.driver_name || '';
                    dPhone = blockedRecord.driver_phone || '';
                }
            }

            const driverInfo = [];
            if (dName) driverInfo.push(`נהג: ${dName}`);
            if (dPhone) driverInfo.push(`טלפון: ${dPhone}`);
            const driverHtml = driverInfo.length > 0 ? ` <span style="font-size: 0.9em; color: var(--color-muted-text); font-weight: normal; margin-right: 8px;">(${driverInfo.join(' | ')})</span>` : '';
            
            let typeTag = '';
            if (!authRecord && !blockedRecord && c.plate_number) {
                const dbType = c.customer_type || c.vehicle_type || c.group_name || c.user_type || c.type;
                const finalType = dbType ? dbType : 'מזדמן';
                typeTag = ` <span style="font-size: 0.8em; background: var(--bg-panel); border: 1px solid var(--border-color); padding: 1px 5px; border-radius: 4px; color: var(--text-muted); font-weight: normal; margin-right: 6px; display: inline-block; vertical-align: middle;">${finalType}</span>`;
            }
            let alertHtml = '';
            if (req.includes('רכב חסום')) {
                let reason = req.replace('רכב חסום:', '').replace('רכב חסום', '').trim() || 'ללא סיבה';
                alertHtml = `<div style="margin-bottom: 6px; color: #ff3b30; font-weight: bold; font-size: 0.95em;">רכב חסום! סיבה: ${reason}</div>`;
            } else if (req.includes('רכב מורשה')) {
                let notes = req.replace('רכב מורשה:', '').replace('רכב מורשה', '').trim() || 'ללא סיבה';
                alertHtml = `<div style="margin-bottom: 6px; color: #34c759; font-weight: bold; font-size: 0.95em;">רכב מורשה סיבה (${notes})</div>`;
            } else if (blockedRecord) {
                let reason = (blockedRecord.reason || 'ללא סיבה').replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
                alertHtml = `<div style="margin-bottom: 6px; color: #ff3b30; font-weight: bold; font-size: 0.95em;">רכב חסום! סיבה: ${reason}</div>`;
            } else if (authRecord) {
                let notes = (authRecord.notes || 'ללא סיבה').replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
                alertHtml = `<div style="margin-bottom: 6px; color: #34c759; font-weight: bold; font-size: 0.95em;">רכב מורשה סיבה (${notes})</div>`;
            }
            const reasonHtml = ` <div class="call-item-reason">${alertHtml}<strong style="color: var(--color-req);">בקשה:</strong> <span style="color: var(--color-desc);">${req}</span><br><strong style="color: var(--color-act);">פעולה:</strong> <span style="color: var(--color-desc);">${act}</span></div>`;
            let plateDisplayCard = c.plate_number || 'לא ידוע';
            if (c.repaired_plate && c.repaired_plate !== c.plate_number) {
                plateDisplayCard += ` <span style="font-size:0.85em;color:var(--text-muted);font-weight:normal;" title="מספר שהוכתב ע״י הנהג">(הנהג תיקן ל-${c.repaired_plate})</span>`;
            }
            
            let plateCorrectionCount = 0;
            const currentCallTime = new Date(c.created_at).getTime();
            if (c.plate_number && typeof allCalls !== 'undefined') {
                allCalls.forEach(ac => {
                    if (String(ac.plate_number).trim() === String(c.plate_number).trim()) {
                        const acTime = new Date(ac.created_at).getTime();
                        if (acTime <= currentCallTime) {
                            if (String(ac.is_plate_corrected).toLowerCase() === 'true' || ac.is_plate_corrected === true) {
                                plateCorrectionCount++;
                            }
                        }
                    }
                });
            }
            if ((String(c.is_plate_corrected).toLowerCase() === 'true' || c.is_plate_corrected === true) && plateCorrectionCount >= 3) {
                plateDisplayCard += `<div style="font-size:0.85em;color:var(--accent-red);font-weight:bold;margin-top:2px;">⚠️ מצלמה כשלה בזיהוי ${plateCorrectionCount} פעמים</div>`;
            }
            
            opList.innerHTML += `
                <li class="call-item call-item-container ${hlClass} ${animClass}">
                    <div class="call-item-title">רכב: ${plateDisplayCard}${typeTag}${driverHtml}</div>
                    <div class="call-item-subtitle">${timeStr} | ${dateStr}${parkingInfo}</div>
                    ${reasonHtml}
                </li>
            `;
        });
    }
}

// ----------------------------------------------------
// Table & Search
// ----------------------------------------------------
const toggleAllCallsBtn = document.getElementById('toggle-all-calls');
const allCallsContainer = document.getElementById('all-calls-container');
const tableWrapper = allCallsContainer ? allCallsContainer.querySelector('.table-wrapper') : null;
let isTableVisible = false;

// Default hide main table
if (tableWrapper) tableWrapper.style.display = 'none';

if (toggleAllCallsBtn) {
    toggleAllCallsBtn.addEventListener('click', () => {
        isTableVisible = !isTableVisible;
        if (isTableVisible) {
            if (tableWrapper) tableWrapper.style.display = 'block';
        } else {
            if (tableWrapper) tableWrapper.style.display = 'none';
        }
    });
}

const toggleAdvBtn = document.getElementById('toggle-adv-search');
const advContainer = document.getElementById('adv-search-container');
if (toggleAdvBtn && advContainer) {
    toggleAdvBtn.addEventListener('click', () => {
        if (advContainer.style.display === 'none') {
            advContainer.style.display = 'block';
            toggleAdvBtn.style.background = 'var(--accent-blue)';
            toggleAdvBtn.style.color = 'white';
        } else {
            advContainer.style.display = 'none';
            toggleAdvBtn.style.background = 'var(--bg-panel)';
            toggleAdvBtn.style.color = 'var(--text-main)';
        }
    });
}

const searchInputs = [
    document.getElementById('search-date'),
    document.getElementById('search-start-date'),
    document.getElementById('search-end-date'),
    document.getElementById('search-time'),
    document.getElementById('search-plate'),
    document.getElementById('search-lane'),
    document.getElementById('search-reason'),
    document.getElementById('search-action-db'),
    document.getElementById('search-handled-by')
];

function triggerSearch() {
    if (!isTableVisible && tableWrapper) {
        isTableVisible = true;
        tableWrapper.style.display = 'block';
    }
    updateTable();
}

searchInputs.forEach(input => {
    if(input) {
        input.addEventListener('input', triggerSearch);
        input.addEventListener('change', triggerSearch);
    }
});

function updateTable() {
    const tbody = document.getElementById('calls-table-body');
    tbody.innerHTML = '';
    
    let callsToShow = filteredCalls;
    
    const qGlobal = document.getElementById('global-search') ? document.getElementById('global-search').value.trim().toLowerCase() : '';
    const qExactDate = document.getElementById('search-date') ? document.getElementById('search-date').value : '';
    const qStartDate = document.getElementById('search-start-date') ? document.getElementById('search-start-date').value : '';
    const qEndDate = document.getElementById('search-end-date') ? document.getElementById('search-end-date').value : '';
    const qTime = document.getElementById('search-time') ? document.getElementById('search-time').value.trim().toLowerCase() : '';
    const qParking = document.getElementById('search-parking') ? document.getElementById('search-parking').value.trim().toLowerCase() : '';
    const qLane = document.getElementById('search-lane') ? document.getElementById('search-lane').value.trim().toLowerCase() : '';
    const qPlate = document.getElementById('search-plate') ? document.getElementById('search-plate').value.trim().toLowerCase() : '';
    const qDriver = document.getElementById('search-driver') ? document.getElementById('search-driver').value.trim().toLowerCase() : '';
    const qDuration = document.getElementById('search-duration') ? document.getElementById('search-duration').value.trim().toLowerCase() : '';
    const qReason = document.getElementById('search-reason') ? document.getElementById('search-reason').value.trim().toLowerCase() : '';
    const qActionDb = document.getElementById('search-action-db') ? document.getElementById('search-action-db').value.trim().toLowerCase() : '';
    const qHandledBy = document.getElementById('search-handled-by') ? document.getElementById('search-handled-by').value : '';
    
    const isSearching = qGlobal || qExactDate || qStartDate || qEndDate || qTime || qParking || qLane || qPlate || qDriver || qDuration || qReason || qActionDb || qHandledBy;
    
    if (isSearching) {
        callsToShow = callsToShow.filter(c => {
            if (qGlobal) {
                const matchesGlobal = 
                    (c.plate_number && String(c.plate_number).toLowerCase().includes(qGlobal)) ||
                    (c.driver_name && c.driver_name.toLowerCase().includes(qGlobal)) ||
                    (c.driver_phone && String(c.driver_phone).includes(qGlobal)) ||
                    (c.parking_id && String(c.parking_id).toLowerCase().includes(qGlobal)) ||
                    (c.lane_id && String(c.lane_id).toLowerCase().includes(qGlobal));
                if (!matchesGlobal) return false;
            }
            const dateObj = new Date(c.created_at);
            
            // Format dd/mm/yyyy for display search logic if needed
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            
            // Format hh:mm:ss
            const HH = String(dateObj.getHours()).padStart(2, '0');
            const MM = String(dateObj.getMinutes()).padStart(2, '0');
            const SS = String(dateObj.getSeconds()).padStart(2, '0');
            const timeStr1 = `${HH}:${MM}:${SS}`;
            const timeStr2 = `${HH}:${MM}`;
            
            function parseDDMMYYYY(dateStr) {
                if (!dateStr || dateStr.length < 8) return null;
                const parts = dateStr.split(/[\/\.-]/);
                if (parts.length === 3) {
                    const d = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10) - 1;
                    const y = parseInt(parts[2], 10);
                    // Handle 2-digit years optionally, but expect 4
                    return new Date(y, m, d);
                }
                return null;
            }

            const skipDateFilters = !!(qReason || qActionDb);

            if (!skipDateFilters) {
                if (qExactDate || qStartDate || qEndDate) {
                    const dateOnly = new Date(dateObj);
                    dateOnly.setHours(0,0,0,0);
                    
                    if (qExactDate) {
                        const exactD = parseDDMMYYYY(qExactDate);
                        if (!exactD) return false;
                        exactD.setHours(0,0,0,0);
                        if (dateOnly.getTime() !== exactD.getTime()) return false;
                    } else {
                        if (qStartDate) {
                            const startD = parseDDMMYYYY(qStartDate);
                            if (startD) {
                                startD.setHours(0,0,0,0);
                                if (dateOnly < startD) return false;
                            }
                        }
                        if (qEndDate) {
                            const endD = parseDDMMYYYY(qEndDate);
                            if (endD) {
                                endD.setHours(23,59,59,999);
                                if (dateObj > endD) return false;
                            }
                        }
                    }
                }
                
                if (qTime && !timeStr1.includes(qTime) && !timeStr2.includes(qTime)) return false;
            }
            
            if (qParking && (!c.parking_id || !String(c.parking_id).includes(qParking))) return false;
            if (qLane && (!c.lane_id || !String(c.lane_id).includes(qLane))) return false;
            if (qPlate && (!c.plate_number || !String(c.plate_number).includes(qPlate))) return false;
            if (qDriver && (!c.driver_name || !c.driver_name.toLowerCase().includes(qDriver)) && (!c.driver_phone || !String(c.driver_phone).includes(qDriver))) return false;
            if (qDuration && (!c.call_duration || !String(c.call_duration).includes(qDuration))) return false;
            if (qReason && (!c.request_summary || !c.request_summary.toLowerCase().includes(qReason))) return false;
            if (qActionDb && (!c.actions_taken || !c.actions_taken.toLowerCase().includes(qActionDb))) return false;
            
            if (qHandledBy) {
                const isForwarded = String(c.is_forwarded).toLowerCase() === 'true';
                if (qHandledBy === 'ai' && isForwarded) return false;
                if (qHandledBy === 'operator' && !isForwarded) return false;
            }
            
            return true;
        });
    }
    
    currentCallsToShow = callsToShow;
    currentRenderCount = 25;
    renderTableRows();
}

let currentRenderCount = 25;
let currentCallsToShow = [];

function renderTableRows() {
    const tbody = document.getElementById('calls-table-body');
    const mobileList = document.getElementById('mobile-calls-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (mobileList) mobileList.innerHTML = '';
    
    const handledBySelect = document.getElementById('search-handled-by');
    const handledByVal = handledBySelect ? handledBySelect.value : '';

    currentCallsToShow.forEach(c => {
        const dateStr = new Date(c.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        let status = '-';
        
        if (handledByVal === '') {
            if (c.is_forwarded === 'true' || c.is_forwarded === true) {
                status = '<span style="color: var(--accent-blue); font-weight: bold; background: rgba(10,132,255,0.1); padding: 2px 6px; border-radius: 4px;">מוקד אנושי</span>';
            } else {
                status = '<span style="color: var(--accent-green); font-weight: bold; background: rgba(48,209,88,0.1); padding: 2px 6px; border-radius: 4px;">טיפול AI</span>';
            }
        }
        
        const tr = document.createElement('tr');
        if (c.isNew) tr.classList.add('new-row-flash');
        let plateDisplay = c.plate_number || '-';
        if (c.repaired_plate && c.repaired_plate !== c.plate_number) {
            plateDisplay += `<br><span style="font-size:0.85em;color:var(--text-muted);font-weight:normal;" title="מספר שהוכתב ע״י הנהג">(הנהג תיקן ל-${c.repaired_plate})</span>`;
        }
        
        let plateCorrectionCount = 0;
        const currentCallTime = new Date(c.created_at).getTime();
        if (c.plate_number && typeof allCalls !== 'undefined') {
            allCalls.forEach(ac => {
                if (String(ac.plate_number).trim() === String(c.plate_number).trim()) {
                    const acTime = new Date(ac.created_at).getTime();
                    if (acTime <= currentCallTime) {
                        if (String(ac.is_plate_corrected).toLowerCase() === 'true' || ac.is_plate_corrected === true) {
                            plateCorrectionCount++;
                        }
                    }
                }
            });
        }
        
        if ((String(c.is_plate_corrected).toLowerCase() === 'true' || c.is_plate_corrected === true) && plateCorrectionCount >= 3) {
            plateDisplay += `<br><span style="font-size:0.85em;color:var(--accent-red);font-weight:bold;">⚠️ מצלמה כשלה בזיהוי ${plateCorrectionCount} פעמים</span>`;
        }
        
        let req = c.request_summary || '-';
        req = req.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
        let act = c.actions_taken || '-';
        act = act.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
        
        const parkingName = c.parking_name || getParkingNameById(c.parking_id) || 'כללי';
        const laneStr = c.lane_id ? ` | נתיב: ${c.lane_id}` : '';
        const parkingInfo = ` | חניון: ${parkingName}` + laneStr;
        
        // Mobile layout mirroring recent-op-list
        const mobileHtml = `
            <div class="call-item-title">רכב: ${plateDisplay}</div>
            <div class="call-item-subtitle">${dateStr} | ${parkingInfo}</div>
            <div class="call-item-reason">
                <strong style="color: var(--color-req);">בקשה:</strong> <span style="color: var(--color-desc);">${req}</span><br>
                <strong style="color: var(--color-act);">פעולה:</strong> <span style="color: var(--color-desc);">${act}</span>
            </div>
        `;
        
        tr.innerHTML = `
            <td class="desktop-td">${dateStr}</td>
            <td class="desktop-td">${parkingName}</td>
            <td class="desktop-td">${c.lane_id}</td>
            <td class="desktop-td" style="direction: ltr; text-align: right;">${plateDisplay}</td>
            <td class="desktop-td">${c.driver_name || '-'}${c.driver_phone ? '<br><span style="font-size:0.85em;color:gray;">' + c.driver_phone + '</span>' : ''}</td>
            <td class="desktop-td">${c.call_duration}s</td>
            <td class="desktop-td">${c.request_summary || '-'}</td>
            <td class="desktop-td">${c.actions_taken || '-'}</td>
            <td class="desktop-td">${status}</td>
        `;
        tbody.appendChild(tr);

        if (mobileList) {
            const li = document.createElement('li');
            li.className = 'call-item call-item-container';
            if (c.isNew) li.classList.add('new-row-flash');
            li.innerHTML = mobileHtml;
            mobileList.appendChild(li);
        }
    });
    
    // Remove old load more container if it exists
    const loadMoreContainer = document.getElementById('load-more-container');
    if (loadMoreContainer) {
        loadMoreContainer.remove();
    }
}

// ----------------------------------------------------
// Graph
// ----------------------------------------------------
document.getElementById('graph-timeframe')?.addEventListener('change', (e) => {
    const customContainer = document.getElementById('custom-graph-date-range');
    if (customContainer) {
        if (e.target.value === 'custom') {
            customContainer.style.display = 'flex';
        } else {
            customContainer.style.display = 'none';
            updateGraph();
        }
    } else {
        updateGraph();
    }
});

document.getElementById('apply-custom-graph-date')?.addEventListener('click', () => {
    updateGraph();
});

// ----------------------------------------------------
// Popular Times Graph
// ----------------------------------------------------
let selectedPopularDay = new Date().getDay(); // 0 = Sunday

function renderPopularTimes() {
    const container = document.getElementById('pt-chart-container');
    const nav = document.getElementById('pt-days-nav');
    if (!container || !nav) return;

    const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    
    if (nav.innerHTML.trim() === '') {
        days.forEach((day, index) => {
            const btn = document.createElement('button');
            btn.className = `pt-day-btn ${index === selectedPopularDay ? 'active' : ''}`;
            btn.innerText = `יום ${day}'`;
            btn.onclick = () => {
                selectedPopularDay = index;
                document.querySelectorAll('.pt-day-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderPopularTimes();
            };
            nav.appendChild(btn);
        });
    }

    const callsPerDayHour = Array(24).fill(0);
    const statsCalls = getStatsCalls();
    
    statsCalls.forEach(c => {
        const date = new Date(c.created_at);
        if (date.getDay() === selectedPopularDay) {
            callsPerDayHour[date.getHours()]++;
        }
    });

    // Smooth the data to look more like a Google Maps load curve (moving average)
    const smoothedCalls = Array(24).fill(0);
    for (let i = 0; i < 24; i++) {
        const prev = callsPerDayHour[(i - 1 + 24) % 24];
        const curr = callsPerDayHour[i];
        const next = callsPerDayHour[(i + 1) % 24];
        smoothedCalls[i] = (prev + curr * 2 + next) / 4;
    }

    const maxCalls = Math.max(...smoothedCalls, 1);
    const currentHour = new Date().getHours();
    const isToday = new Date().getDay() === selectedPopularDay;

    container.innerHTML = `
        <div class="pt-guide-line" style="bottom: 25%;"></div>
        <div class="pt-guide-line" style="bottom: 50%;"></div>
        <div class="pt-guide-line" style="bottom: 75%;"></div>
    `;

    const displayOrder = [];
    for (let i = 1; i <= 23; i++) displayOrder.push(i);
    displayOrder.push(0);

    displayOrder.forEach(hour => {
        const count = smoothedCalls[hour];
        const heightPct = (count / maxCalls) * 100;
        const col = document.createElement('div');
        col.className = 'pt-bar-col';
        
        const fill = document.createElement('div');
        fill.className = `pt-bar-fill ${isToday && hour === currentHour ? 'active-hour' : ''}`;
        fill.style.height = `${Math.max(heightPct, 3)}%`;
        
        col.onmouseenter = () => updatePopularTimesInfo(hour, count, maxCalls);
        col.onmouseleave = () => updatePopularTimesInfo(isToday ? currentHour : -1, smoothedCalls[isToday ? currentHour : -1] || 0, maxCalls);
        
        const label = document.createElement('div');
        label.className = 'pt-x-axis-label';
        if (hour % 3 === 0) {
            label.innerText = `${hour.toString().padStart(2, '0')}:00`;
        }
        
        col.appendChild(fill);
        col.appendChild(label);
        container.appendChild(col);
    });

    updatePopularTimesInfo(isToday ? currentHour : -1, isToday ? smoothedCalls[currentHour] : 0, maxCalls);
}

function updatePopularTimesInfo(hour, count, maxCalls) {
    const infoText = document.getElementById('pt-info-text');
    const infoIcon = document.getElementById('pt-info-icon');
    if (!infoText) return;

    if (hour === -1) {
        infoText.innerText = "העבר עכבר על עמודה לראות עומס";
        infoIcon.innerHTML = '';
        return;
    }

    const ratio = count / maxCalls;
    let statusText = "בדרך כלל לא עמוס במיוחד";
    if (ratio > 0.75) statusText = "עמוס מאוד מהרגיל";
    else if (ratio > 0.4) statusText = "עמוס קלות";
    else if (count === 0) statusText = "אין כמעט פעילות";

    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
    infoText.innerText = `${hourStr} - ${statusText}`;
    infoIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path fill-rule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/><path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>`;
}

window.currentGraphType = window.currentGraphType || 'bar';
window.setGraphType = function(type) {
    window.currentGraphType = type;
    
    // Update active button styling if buttons exist (index/owner_dashboard)
    const btnBar = document.getElementById('btn-graph-type-bar');
    const btnLine = document.getElementById('btn-graph-type-line');
    if (btnBar && btnLine) {
        btnBar.style.background = type === 'bar' ? 'var(--bg-panel)' : 'transparent';
        btnBar.style.color = type === 'bar' ? 'var(--text-color)' : 'var(--text-muted)';
        btnBar.style.border = type === 'bar' ? '1px solid var(--border-color)' : '1px solid transparent';
        
        btnLine.style.background = type === 'line' ? 'var(--bg-panel)' : 'transparent';
        btnLine.style.color = type === 'line' ? 'var(--text-color)' : 'var(--text-muted)';
        btnLine.style.border = type === 'line' ? '1px solid var(--border-color)' : '1px solid transparent';
    }
    
    updateGraph();
};

function updateGraph() {
    const timeframe = document.getElementById('graph-timeframe').value; // 24h, 7d, 30d
    const container = document.getElementById('bar-chart-container');
    container.innerHTML = '';
    
    if (filteredCalls.length === 0) return;
    
    // Using the newest date in the dataset as baseline
    const latestDate = new Date(filteredCalls[0].created_at);
    
    let buckets = {}; // Label -> {ai: 0, op: 0}
    let orderedLabels = [];
    
    if (timeframe === '24h') {
        const currentDate = new Date();
        const currentHour = currentDate.getHours();
        
        for (let i = 0; i <= currentHour; i++) {
            const label = `${i}:00`;
            buckets[label] = {ai: 0, op: 0};
            orderedLabels.push(label);
        }
        
        filteredCalls.forEach(c => {
            const d = new Date(c.created_at);
            if (d.getDate() === latestDate.getDate() && 
                d.getMonth() === latestDate.getMonth() && 
                d.getFullYear() === latestDate.getFullYear()) {
                const label = `${d.getHours()}:00`;
                if (buckets[label]) {
                    if (String(c.is_forwarded).toLowerCase() === 'true') buckets[label].op++;
                    else buckets[label].ai++;
                }
            }
        });
    } else if (timeframe === '7d' || timeframe === '30d') {
        const daysCount = timeframe === '7d' ? 7 : 30;
        const currentDate = new Date();
        for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000);
            const label = `${d.getDate()}/${d.getMonth()+1}`;
            buckets[label] = {ai: 0, op: 0};
            orderedLabels.push(label);
        }
        
        filteredCalls.forEach(c => {
            const d = new Date(c.created_at);
            if (latestDate - d <= daysCount * 24 * 60 * 60 * 1000) {
                const label = `${d.getDate()}/${d.getMonth()+1}`;
                if (buckets[label]) {
                    if (c.is_forwarded === 'true') buckets[label].op++;
                    else buckets[label].ai++;
                }
            }
        });
    } else if (['monthly', 'all'].includes(timeframe)) {
        const monthsCount = timeframe === 'monthly' ? 24 : 9999;
        
        if (timeframe !== 'all') {
            for (let i = monthsCount - 1; i >= 0; i--) {
                const d = new Date(latestDate);
                d.setMonth(d.getMonth() - i);
                const label = `${d.getMonth()+1}/${d.getFullYear()}`;
                buckets[label] = {ai: 0, op: 0};
                orderedLabels.push(label);
            }
        }
        
        filteredCalls.forEach(c => {
            const d = new Date(c.created_at);
            const label = `${d.getMonth()+1}/${d.getFullYear()}`;
            
            if (timeframe === 'all') {
                if (!buckets[label]) {
                    buckets[label] = {ai: 0, op: 0};
                }
                if (c.is_forwarded === 'true') buckets[label].op++;
                else buckets[label].ai++;
            } else {
                if (buckets[label]) {
                    if (c.is_forwarded === 'true') buckets[label].op++;
                    else buckets[label].ai++;
                }
            }
        });
        
        if (timeframe === 'all') {
            orderedLabels = Object.keys(buckets).sort((a, b) => {
                const [mA, yA] = a.split('/');
                const [mB, yB] = b.split('/');
                if (yA !== yB) return parseInt(yA) - parseInt(yB);
                return parseInt(mA) - parseInt(mB);
            });
        }
    } else if (timeframe === 'custom') {
        let startVal = document.getElementById('custom-graph-start-date')?.value;
        let endVal = document.getElementById('custom-graph-end-date')?.value;
        
        // Allow user to enter just one date to see that specific day
        if (startVal && !endVal) endVal = startVal;
        if (!startVal && endVal) startVal = endVal;

        if (startVal && endVal) {
            function parseDDMMYYYY(dateStr) {
                if (!dateStr || dateStr.length < 8) return null;
                const parts = dateStr.split(/[\/\.-]/);
                if (parts.length === 3) {
                    const d = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10) - 1;
                    let y = parseInt(parts[2], 10);
                    if (y < 100) y += 2000;
                    return new Date(y, m, d);
                }
                return null;
            }
            
            let startD = parseDDMMYYYY(startVal);
            if (startD) startD.setHours(0, 0, 0, 0);
            let endD = parseDDMMYYYY(endVal);
            if (endD) endD.setHours(23, 59, 59, 999);
            
            if (startD && endD) {
                if (startD > endD) {
                    const temp = startD;
                    startD = endD;
                    endD = temp;
                    startD.setHours(0,0,0,0);
                    endD.setHours(23,59,59,999);
                }
                const daysCount = Math.ceil((endD - startD) / (24 * 60 * 60 * 1000));
            if (daysCount > 0 && daysCount <= 2000) {
                for (let i = 0; i < daysCount; i++) {
                    const d = new Date(startD.getTime() + i * 24 * 60 * 60 * 1000);
                    const label = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)}`;
                    buckets[label] = {ai: 0, op: 0};
                    orderedLabels.push(label);
                }
                
                filteredCalls.forEach(c => {
                    const d = new Date(c.created_at);
                    if (d >= startD && d <= endD) {
                        const label = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear().toString().slice(-2)}`;
                        if (buckets[label]) {
                            if (String(c.is_forwarded).toLowerCase() === 'true') buckets[label].op++;
                            else buckets[label].ai++;
                        }
                    }
                });
            }
            }
        }
    }

    // Find max value to scale heights
    const maxCount = Math.max(...Object.values(buckets).map(b => b.ai + b.op), 1);
    
    // Draw bars or lines
    const isLine = window.currentGraphType === 'line';
    
    orderedLabels.forEach((label, i) => {
        const counts = buckets[label];
        const total = counts.ai + counts.op;
        const totalHeightPercent = (total / maxCount) * 100;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        wrapper.style.position = 'relative'; // important for SVG absolute positioning
        
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.innerText = `${total} סה"כ\nAI: ${counts.ai}\nמוקד: ${counts.op}`;
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        
        if (isLine) {
            bar.style.height = '100%';
            bar.style.width = '100%';
            bar.style.background = 'transparent'; // Invisible hit area for hover
            
            if (total > 0) {
                const aiYPercent = 100 - ((counts.ai / maxCount) * 100);
                const opYPercent = 100 - ((counts.op / maxCount) * 100);
                
                const dotContainer = document.createElement('div');
                dotContainer.style.position = 'absolute';
                dotContainer.style.left = '0';
                dotContainer.style.top = '0';
                dotContainer.style.width = '100%';
                dotContainer.style.height = '100%'; // Full height, the flex alignment places this at bottom with labels
                dotContainer.style.pointerEvents = 'none';
                
                if (counts.ai > 0) {
                    const aiDot = document.createElement('div');
                    aiDot.style.position = 'absolute';
                    aiDot.style.left = '50%';
                    aiDot.style.top = `${aiYPercent}%`;
                    aiDot.style.transform = 'translate(-50%, -50%)';
                    aiDot.style.width = '8px';
                    aiDot.style.height = '8px';
                    aiDot.style.backgroundColor = 'var(--bg-panel)';
                    aiDot.style.border = '2px solid var(--accent-green)';
                    aiDot.style.borderRadius = '50%';
                    aiDot.style.zIndex = '2';
                    dotContainer.appendChild(aiDot);
                }
                
                if (counts.op > 0) {
                    const opDot = document.createElement('div');
                    opDot.style.position = 'absolute';
                    opDot.style.left = '50%';
                    opDot.style.top = `${opYPercent}%`;
                    opDot.style.transform = 'translate(-50%, -50%)';
                    opDot.style.width = '8px';
                    opDot.style.height = '8px';
                    opDot.style.backgroundColor = 'var(--bg-panel)';
                    opDot.style.border = '2px solid var(--accent-blue)';
                    opDot.style.borderRadius = '50%';
                    opDot.style.zIndex = '2';
                    dotContainer.appendChild(opDot);
                }
                
                // Draw connecting lines to the next column
                if (i < orderedLabels.length - 1) {
                    const nextCounts = buckets[orderedLabels[i+1]];
                    const nextAiYPercent = 100 - ((nextCounts.ai / maxCount) * 100);
                    const nextOpYPercent = 100 - ((nextCounts.op / maxCount) * 100);
                    
                    const svgNS = "http://www.w3.org/2000/svg";
                    const svg = document.createElementNS(svgNS, "svg");
                    svg.style.position = 'absolute';
                    svg.style.left = '50%';
                    svg.style.top = '0';
                    // The line goes from the center of this column to the center of the next column
                    // Width = 100% of this column + 10px gap
                    svg.style.width = 'calc(100% + 10px)'; 
                    svg.style.height = '100%';
                    svg.style.overflow = 'visible';
                    svg.style.zIndex = '1';
                    
                    const aiLine = document.createElementNS(svgNS, "line");
                    aiLine.setAttribute("x1", "0%");
                    aiLine.setAttribute("y1", `${aiYPercent}%`);
                    aiLine.setAttribute("x2", "100%");
                    aiLine.setAttribute("y2", `${nextAiYPercent}%`);
                    aiLine.setAttribute("stroke", "var(--accent-green)");
                    aiLine.setAttribute("stroke-width", "3");
                    svg.appendChild(aiLine);
                    
                    const opLine = document.createElementNS(svgNS, "line");
                    opLine.setAttribute("x1", "0%");
                    opLine.setAttribute("y1", `${opYPercent}%`);
                    opLine.setAttribute("x2", "100%");
                    opLine.setAttribute("y2", `${nextOpYPercent}%`);
                    opLine.setAttribute("stroke", "var(--accent-blue)");
                    opLine.setAttribute("stroke-width", "3");
                    svg.appendChild(opLine);
                    
                    dotContainer.appendChild(svg);
                }
                
                bar.appendChild(dotContainer);
            }
        } else {
            bar.style.height = `${totalHeightPercent}%`;
            bar.style.display = 'flex';
            bar.style.flexDirection = 'column-reverse'; // Stack from bottom
            bar.style.background = 'transparent'; // Remove default bg
            bar.style.overflow = 'hidden'; // Keep border radius clean
            
            if (total > 0) {
                const aiPercent = (counts.ai / total) * 100;
                const opPercent = (counts.op / total) * 100;
                
                // Bottom bar is AI, top is Operator
                bar.innerHTML = `
                    <div style="height: ${aiPercent}%; width: 100%; background-color: var(--accent-green);"></div>
                    <div style="height: ${opPercent}%; width: 100%; background-color: var(--accent-blue);"></div>
                `;
            }
        }
        
        const labelEl = document.createElement('div');
        labelEl.className = 'chart-label';
        labelEl.innerText = label;
        
        wrapper.appendChild(tooltip);
        wrapper.appendChild(bar);
        wrapper.appendChild(labelEl);
        container.appendChild(wrapper);
    });
    
    // Calculate and display average stay time
    let avgStaySeconds = getAverageStayTime(filteredCalls);
    let avgStayText = "זמן שהייה ממוצע: אין מספיק נתונים (נדרשות כניסות ויציאות של אותו רכב)";
    if (avgStaySeconds) {
        const m = Math.floor(avgStaySeconds / 60);
        const h = Math.floor(m / 60);
        const remM = m % 60;
        if (h > 0) {
             avgStayText = `זמן שהייה ממוצע (מבוסס נתונים): ${h} שעות ו-${remM} דקות`;
        } else {
             avgStayText = `זמן שהייה ממוצע (מבוסס נתונים): ${m} דקות`;
        }
    }
    const avgStayEl = document.getElementById('avg-stay-text-graph');
    if (avgStayEl) {
        avgStayEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="vertical-align: middle; margin-left: 5px;"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"/></svg>` + avgStayText;
    }
    
    // Scroll to right (LTR container) to show newest data
    requestAnimationFrame(() => {
        container.scrollLeft = 99999;
    });
}

function getAverageStayTime(calls) {
    const plates = {};
    calls.forEach(c => {
        const plate = c.plate_number;
        if (!plate || plate.trim() === '' || plate === '-' || plate.includes('לא זוהה')) return;
        
        const dt = new Date(c.created_at);
        const text = ((c.request_summary || '') + ' ' + (c.actions_taken || '')).toLowerCase();
        let dir = 'unknown';
        if (text.includes('כניס') || text.includes('נכנס')) dir = 'in';
        else if (text.includes('יציא') || text.includes('שיצא')) dir = 'out';
        
        if (dir !== 'unknown') {
            if (!plates[plate]) plates[plate] = [];
            plates[plate].push({dt, dir});
        }
    });
    
    let durations = [];
    for (const plate in plates) {
        const events = plates[plate];
        events.sort((a, b) => a.dt - b.dt);
        
        for (let i = 0; i < events.length - 1; i++) {
            if (events[i].dir === 'in') {
                for (let j = i + 1; j < events.length; j++) {
                    if (events[j].dir === 'out') {
                        const deltaS = (events[j].dt - events[i].dt) / 1000;
                        if (deltaS > 60 && deltaS < 24 * 3600) {
                            durations.push(deltaS);
                        }
                        break;
                    }
                }
            }
        }
    }
    
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
}

// ----------------------------------------------------
// AI Panel Tabs & Lists (Blocked/Authorized)
// ----------------------------------------------------
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.style.display = 'none');
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.style.display = targetId === 'tab-recent-ai' ? 'block' : 'flex';
            if (targetId === 'tab-blocked') fetchAndRenderActionList('blocked');
            if (targetId === 'tab-authorized') fetchAndRenderActionList('authorized');
        }
    });
});

let globalPollingInterval = null;
window.isListInteractionActive = false;

function startGlobalPolling() {
    if (globalPollingInterval) clearInterval(globalPollingInterval);
    
    globalPollingInterval = setInterval(() => {
        // 2. HOVER & SCROLL GUARD
        if (window.isListInteractionActive) return; // Skip entire polling tick silently
        
        // 3. MOKED PAGE - FREEZE ON TABS
        if (!document.getElementById('owner-dashboard-marker') && !document.getElementById('admin-dashboard-marker')) {
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                const targetId = activeTab.getAttribute('data-target');
                if (targetId === 'tab-blocked' || targetId === 'tab-authorized') {
                    return; // Pause completely
                }
            }
        }
        
        // Call all polling functions
        if (typeof fetchInitialCalls === 'function') fetchInitialCalls().catch(e => console.error(e));
        if (typeof pollOperatorCallsFast === 'function') pollOperatorCallsFast().catch(e => console.error(e));
    }, 60000); // SINGLE 60s TIMER
}

window.scrollGuardTimeout = null;

function attachGlobalGuards(container) {
    if (!container || container.dataset.guardAttached) return;
    container.dataset.guardAttached = 'true';
    
    container.addEventListener('mouseenter', () => { window.isListInteractionActive = true; });
    container.addEventListener('mouseleave', () => { window.isListInteractionActive = false; });
    
    container.addEventListener('scroll', () => {
        window.isListInteractionActive = true;
        if (window.scrollGuardTimeout) clearTimeout(window.scrollGuardTimeout);
        window.scrollGuardTimeout = setTimeout(() => {
            window.isListInteractionActive = false;
        }, 1500);
    }, { passive: true });
}

function setupGlobalListGuards() {
    // Find all list containers and table wrappers across all dashboards
    const containers = document.querySelectorAll('.action-list, .table-wrapper, .scroll-container, #owner-blocked-list, #owner-authorized-list, #blocked-list, #authorized-list, #op-calls-list, #ai-calls-list');
    containers.forEach(el => {
        const container = (el.tagName === 'UL' || el.tagName === 'TABLE') && el.parentElement ? el.parentElement : el;
        attachGlobalGuards(container);
    });
}

let cachedBlocked = [];
let cachedAuthorized = [];

async function fetchAndRenderActionList(type) {
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/${type}?v=` + Date.now());
        let data = await response.json();
        data = fixApiDates(data);
        
        // Filter by permissions and selected parking
        data = filterDataByAllowedParkings(data);
        
        if (currentParkingId !== 'all') {
            data = data.filter(item => String(item.parking_id) === String(currentParkingId));
        }
        
        if (type === 'blocked') { window.cachedBlocked = data; if (typeof renderOperatorCalls === 'function' && typeof opCalls !== 'undefined') renderOperatorCalls(); }
        if (type === 'authorized') { window.cachedAuthorized = data; }
        
        renderActionList(type, data);
        renderOwnerActionList(type, data); // For manager dashboard
    } catch (err) {
        console.error(`Error fetching ${type} list:`, err);
        // Do NOT wipe the existing list or render "אין רכבים להציג" if a polling response is loading or temporarily empty.
        // Keep existing DOM row items intact during polling failures!
    }
}

function renderActionList(type, data) {
    const listEl = document.getElementById(`${type}-list`);
    const searchInput = document.getElementById(`search-${type}`);
    if (!listEl) return;
    // Guard checks are now handled globally in startGlobalPolling and setupGlobalListGuards
    
    let filteredData = data;
    if (searchInput && searchInput.value) {
        const q = searchInput.value.toLowerCase();
        filteredData = data.filter(item => item.plate.toLowerCase().includes(q));
    }
    
    filteredData.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    
    // Prevent DOM redraw if data hasn't changed (prevents scroll jumps)
    const dataHash = JSON.stringify(filteredData);
    if (listEl.dataset.lastRender === dataHash) {
        return; // Nothing changed
    }
    
    const scrollContainer = listEl.parentElement;
    const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    
    // RULE 2: ONLY REFRESH WHEN AT TOP OF PAGE
    if (previousScrollTop > 0) {
        return; // SKIP the DOM update completely until the next cycle when they return to the top
    }
    
    listEl.dataset.lastRender = dataHash;
    
    if (filteredData.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; padding:10px; color:var(--text-muted);">אין רכבים מוגדרים</li>';
        return;
    }
    
    // Remove "no items" message if present
    if (listEl.children.length === 1 && listEl.children[0].innerText.includes('אין רכבים')) {
        listEl.innerHTML = '';
    }
    
    filteredData.forEach((item, i) => {
        const itemKey = item.plate + '_' + item.added_at;
        
        let existingNode = null;
        if (i < listEl.children.length && listEl.children[i].dataset.key === itemKey) {
            existingNode = listEl.children[i];
        } else {
            for (let j = i; j < listEl.children.length; j++) {
                if (listEl.children[j].dataset.key === itemKey) {
                    existingNode = listEl.children[j];
                    break;
                }
            }
        }
        
        if (existingNode) {
            if (listEl.children[i] !== existingNode) {
                listEl.insertBefore(existingNode, listEl.children[i]);
            }
            return; // Node exists and is correctly positioned
        }

        const li = document.createElement('li');
        li.dataset.key = itemKey;
        if (type === 'blocked') {
            li.style.background = 'rgba(255, 69, 58, 0.15)';
            li.style.border = '1px solid rgba(255, 69, 58, 0.3)';
        } else if (type === 'authorized') {
            li.style.background = 'rgba(48, 209, 88, 0.15)';
            li.style.border = '1px solid rgba(48, 209, 88, 0.3)';
        } else {
            li.style.background = 'var(--bg-card)';
        }
        li.style.padding = '10px';
        li.style.borderRadius = 'var(--border-radius)';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        
        const rightDiv = document.createElement('div');
        rightDiv.style.flex = '1';
        rightDiv.style.textAlign = 'right';
        const driverNameStr = item.driver_name ? ` - ${item.driver_name}${item.driver_phone ? ' (' + item.driver_phone + ')' : ''}` : (item.driver_phone ? ` - ${item.driver_phone}` : '');
        const parkingName = item.parking_name || getParkingNameById(item.parking_id) || 'כללי';
        rightDiv.innerHTML = `<strong>רכב: ${item.plate}</strong><span style="font-weight: normal; opacity: 0.9;">${driverNameStr}</span><div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 3px;">${parkingName}</div>`;
        
        const middleDiv = document.createElement('div');
        middleDiv.style.flex = '1';
        middleDiv.style.textAlign = 'center';
        const reasonText = item.reason || item.action || '';
        middleDiv.innerHTML = `<span style="opacity: 0.8; font-size: 0.9rem;">${reasonText}</span>`;
        
        const leftDiv = document.createElement('div');
        leftDiv.style.flex = '1';
        leftDiv.style.textAlign = 'left';
        const dateObj = new Date(item.added_at);
        const dateStr = dateObj.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const timeStr = dateObj.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        leftDiv.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">${timeStr} ${dateStr}</span>`;
        
        li.appendChild(rightDiv);
        li.appendChild(middleDiv);
        li.appendChild(leftDiv);
        
        if (i < listEl.children.length) {
            listEl.insertBefore(li, listEl.children[i]);
        } else {
            listEl.appendChild(li);
        }
    });
    
    while (listEl.children.length > filteredData.length) {
        listEl.removeChild(listEl.lastChild);
    }
}

// ----------------------------------------------------
// Manager Dashboard - List Logic
// ----------------------------------------------------
function renderOwnerActionList(type, data) {
    const listEl = document.getElementById(`owner-${type}-list`);
    if (!listEl) return;
    
    attachGlobalGuards(listEl.parentElement);
    
    // Sort descending by date
    let sortedData = [...data].sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    
    // Prevent DOM redraw if data hasn't changed
    const dataHash = JSON.stringify(sortedData);
    if (listEl.dataset.lastRender === dataHash) {
        return;
    }
    
    const scrollContainer = listEl.parentElement;
    const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    
    // RULE 2: ONLY REFRESH WHEN AT TOP OF PAGE
    if (previousScrollTop > 0) {
        return; // SKIP the DOM update completely until the next cycle when they return to the top
    }
    
    listEl.dataset.lastRender = dataHash;
    
    if (sortedData.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; padding:10px; color:var(--text-muted);">אין רכבים מוגדרים</li>';
        return;
    }
    
    // Remove "no items" message if present
    if (listEl.children.length === 1 && listEl.children[0].innerText.includes('אין רכבים')) {
        listEl.innerHTML = '';
    }
    
    sortedData.forEach((item, i) => {
        const itemKey = item.plate + '_' + item.added_at;
        
        let existingNode = null;
        if (i < listEl.children.length && listEl.children[i].dataset.key === itemKey) {
            existingNode = listEl.children[i];
        } else {
            for (let j = i; j < listEl.children.length; j++) {
                if (listEl.children[j].dataset.key === itemKey) {
                    existingNode = listEl.children[j];
                    break;
                }
            }
        }
        
        if (existingNode) {
            if (listEl.children[i] !== existingNode) {
                listEl.insertBefore(existingNode, listEl.children[i]);
            }
            return; // Node exists and is correctly positioned
        }

        const li = document.createElement('li');
        li.dataset.key = itemKey;
        li.style.background = 'var(--bg-panel)';
        li.style.padding = '12px';
        li.style.borderRadius = '8px';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.border = '1px solid var(--border-color)';
        
        const infoDiv = document.createElement('div');
        infoDiv.style.display = 'flex';
        infoDiv.style.flexDirection = 'column';
        infoDiv.style.gap = '4px';
        infoDiv.style.flex = '1';
        
        const parkingName = item.parking_name || getParkingNameById(item.parking_id) || 'כללי';
        const dateObj = new Date(item.added_at);
        const dateStr = dateObj.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }) + ' ' + dateObj.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let detailsStr = `<strong>רכב: ${item.plate}</strong> | ${parkingName}`;
        if (item.driver_name || item.driver_phone) detailsStr += ` | נהג: ${item.driver_name || ''} ${item.driver_phone || ''}`.trim();
        
        let notesStr = item.reason || item.action || item.notes || '';
        notesStr = notesStr.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
        if (notesStr) notesStr = `<span style="font-size: 0.85rem; color: var(--text-muted);">הערה: ${notesStr}</span>`;
        
        let plateCorrectionCount = 0;
        if (item.plate && typeof allCalls !== 'undefined') {
            allCalls.forEach(c => {
                if (String(c.plate_number).trim() === String(item.plate).trim()) {
                    if (String(c.is_plate_corrected).toLowerCase() === 'true' || c.is_plate_corrected === true) {
                        plateCorrectionCount++;
                    }
                }
            });
        }
        
        if (plateCorrectionCount >= 2) {
            notesStr += `<br><span style="font-size:0.85em;color:var(--accent-red);font-weight:bold;">⚠️ מצלמה כשלה בזיהוי ${plateCorrectionCount} פעמים</span>`;
        }
        
        let extraTimesStr = '';
        let dynamicEntry = null;
        let dynamicEntryLane = '';
        let dynamicExit = null;
        let dynamicExitLane = '';
        
        if (typeof allCalls !== 'undefined') {
            allCalls.forEach(c => {
                if (String(c.plate_number).trim() === String(item.plate).trim()) {
                    if (!item.parking_id || String(item.parking_id) === 'all' || String(item.parking_id) === String(c.parking_id)) {
                        const cTime = new Date(c.created_at).getTime();
                        const laneStr = String(c.lane_id || '');
                        const actStr = String(c.actions_taken || '');
                        const reqStr = String(c.request_summary || '');
                        
                        const isEntry = laneStr.startsWith('1') || actStr.includes('כניסה') || reqStr.includes('כניסה');
                        const isExit = laneStr.startsWith('2') || actStr.includes('יציאה') || reqStr.includes('יציאה');
                        
                        if (isEntry && (!dynamicEntry || cTime > dynamicEntry)) {
                            dynamicEntry = cTime;
                            dynamicEntryLane = laneStr;
                        }
                        if (isExit && (!dynamicExit || cTime > dynamicExit)) {
                            dynamicExit = cTime;
                            dynamicExitLane = laneStr;
                        }
                    }
                }
            });
        }
        
        let finalEntry = item.entry_time ? new Date(item.entry_time).getTime() : (item.entry_attempt ? new Date(item.entry_attempt).getTime() : 0);
        let finalExit = item.exit_time ? new Date(item.exit_time).getTime() : 0;
        
        if (dynamicEntry > finalEntry) finalEntry = dynamicEntry;
        if (dynamicExit > finalExit) finalExit = dynamicExit;

        extraTimesStr += `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 5px; font-size: 0.75rem; min-height: 18px;">`;
        
        extraTimesStr += `<div style="flex: 1;"></div>`; // Right spacer
        
        if (finalEntry > 0) {
            const et = new Date(finalEntry);
            const lText = (finalEntry === dynamicEntry && dynamicEntryLane) ? ` (${dynamicEntryLane})` : '';
            const dStr = et.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
            const tStr = et.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit' });
            extraTimesStr += `<div style="flex: 1; text-align: center; color: #FFFFFF; white-space: nowrap; cursor: pointer;" onclick="searchCallForVehicle('${item.plate}', '${dStr}', '${tStr}')" title="לחץ לחיפוש השיחה">כניסה אחרונה${lText}: ${tStr} ${dStr}</div>`;
        } else {
            extraTimesStr += `<div style="flex: 1;"></div>`;
        }
        
        if (finalExit > 0) {
            const ex = new Date(finalExit);
            const lText = (finalExit === dynamicExit && dynamicExitLane) ? ` (${dynamicExitLane})` : '';
            const dStr = ex.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
            const tStr = ex.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit' });
            extraTimesStr += `<div style="flex: 1; text-align: left; color: #FFFFFF; white-space: nowrap; cursor: pointer;" onclick="searchCallForVehicle('${item.plate}', '${dStr}', '${tStr}')" title="לחץ לחיפוש השיחה">יציאה אחרונה${lText}: ${tStr} ${dStr}</div>`;
        } else {
            extraTimesStr += `<div style="flex: 1;"></div>`;
        }
        
        extraTimesStr += `</div>`;
        
        infoDiv.innerHTML = `
            ${extraTimesStr}
            <span>${detailsStr}</span>
            ${notesStr}
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">נוסף ב- ${dateStr}</span>
        `;
        
        const actionDiv = document.createElement('div');
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-secondary';
        removeBtn.innerText = 'הסר';
        removeBtn.style.padding = '4px 10px';
        removeBtn.style.fontSize = '0.8rem';
        removeBtn.onclick = async () => {
            if (confirm(`האם אתה בטוח שברצונך להסיר את הרכב ${item.plate}?`)) {
                await fetch(`${API_BASE_URL}/api/${type}/remove`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ plate_number: item.plate, parking_id: item.parking_id })
                });
                fetchAndRenderActionList(type).catch(() => []); // Re-fetch
            }
        };
        
        actionDiv.appendChild(removeBtn);
        
        li.appendChild(infoDiv);
        li.appendChild(actionDiv);
        
        if (i < listEl.children.length) {
            listEl.insertBefore(li, listEl.children[i]);
        } else {
            listEl.appendChild(li);
        }
    });
    
    while (listEl.children.length > sortedData.length) {
        listEl.removeChild(listEl.lastChild);
    }
    
    if (scrollContainer && previousScrollTop > 0) {
        requestAnimationFrame(() => {
            scrollContainer.scrollTop = previousScrollTop;
            scrollContainer.style.minHeight = '';
        });
    }
}

function setupOwnerListForms() {
    ['blocked', 'authorized'].forEach(type => {
        const form = document.getElementById(`owner-add-${type}-form`);
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const payload = Object.fromEntries(formData.entries());
                
                const loggedUser = localStorage.getItem('intercom_remember_user') || '';
                
                try {
                    const res = await fetch(`${API_BASE_URL}/api/${type}/add`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    });
                    
                    if (res.ok) {
                        form.reset();
                        fetchAndRenderActionList(type).catch(() => []);
                    } else {
                        const err = await res.text();
                        alert("שגיאה בהוספה: " + err);
                    }
                } catch (err) {
                    console.error(err);
                    alert("שגיאת רשת");
                }
            });
        }
    });
}


// ----------------------------------------------------
// AI Cost Logic
// ----------------------------------------------------


window.currentOwnerListFilter = 'op';

window.setOwnerListFilter = function(filter, btn) {
    window.currentOwnerListFilter = filter;
    
    // Update active class on buttons
    const tabsContainer = document.getElementById('owner-ai-cost-tabs');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }
    
    if (window.renderAICostList) {
        window.renderAICostList(window.aiCallsInWindow || []);
    }
};

async function calculateAICosts(calls) {
    const displayEl = document.getElementById('ai-cost-display');
    const timeframeSelect = document.getElementById('ai-cost-timeframe') || { value: '30d' };
    
    if (!displayEl) return;
    if (!calls || calls.length === 0) {
        displayEl.innerHTML = '0.00&nbsp;₪';
        return;
    }
    
    // Sort all calls chronologically to calculate quota correctly
    const sortedCalls = [...calls].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const timeframe = timeframeSelect.value;
    let maxD = sortedCalls.length > 0 ? new Date(sortedCalls[sortedCalls.length-1].created_at) : new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Determine the selected time window (for UI and cost sum)
    let startWin = new Date(0);
    let endWin = maxD;
    
    if (timeframe === 'today') {
        startWin = new Date(maxD);
        startWin.setHours(0,0,0,0);
    }
    else if (timeframe === '24h') startWin = new Date(maxD.getTime() - dayMs);
    else if (timeframe === '7d') startWin = new Date(maxD.getTime() - 7 * dayMs);
    else if (timeframe === '30d') startWin = new Date(maxD.getTime() - 30 * dayMs);
    else if (timeframe === 'monthly') startWin = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
    else if (timeframe === '3m') startWin = new Date(maxD.getTime() - 90 * dayMs);
    else if (timeframe === '6m') startWin = new Date(maxD.getTime() - 180 * dayMs);
    else if (timeframe === '12m') startWin = new Date(maxD.getTime() - 365 * dayMs);
    else if (timeframe === 'all') startWin = new Date(0);
    else if (timeframe === 'custom') {
        const startVal = document.getElementById('custom-start-date')?.value;
        const endVal = document.getElementById('custom-end-date')?.value;
        if (startVal && endVal) {
            startWin = new Date(startVal);
            startWin.setHours(0, 0, 0, 0);
            endWin = new Date(endVal);
            endWin.setHours(23, 59, 59, 999);
        }
    }
    
    // Quota state: parking_id -> { monthKey (YYYY-MM): { usedCalls: 0 } }
    const usageState = {};
    let totalCostInWindow = 0;
    const aiCallsInWindow = [];
    
    // Data for graph: day string (YYYY-MM-DD) -> { freeMins: 0, paidCalls: 0 }
    const graphData = {};
    const isHourly = (timeframe === 'today' || timeframe === '24h');
    
    // Pre-fill graphData with empty slots to ensure they show up in the graph
    if (isHourly) {
        for (let h = 0; h < 24; h++) {
            const hKey = String(h).padStart(2, '0') + ':00';
            graphData[hKey] = { freeCalls: 0, paidCalls: 0, cost: 0 };
        }
    } else if (timeframe !== 'all' && startWin.getTime() > 0) {
        let currentDay = new Date(startWin);
        // Don't pre-fill dates beyond today
        const limitDay = new Date(Math.min(endWin.getTime(), new Date().getTime())); 
        limitDay.setHours(23, 59, 59, 999);
        
        let loopCount = 0;
        // Limit to max 365 days to prevent browser freezing just in case
        while (currentDay <= limitDay && loopCount < 366) {
            const dayKey = currentDay.getFullYear() + '-' + String(currentDay.getMonth() + 1).padStart(2, '0') + '-' + String(currentDay.getDate()).padStart(2, '0');
            graphData[dayKey] = { freeCalls: 0, paidCalls: 0, cost: 0 };
            currentDay.setDate(currentDay.getDate() + 1);
            loopCount++;
        }
    }

    const rateStr = sessionStorage.getItem('intercom_rate_per_minute');
    const ratePerMinute = rateStr ? parseFloat(rateStr) : 2.20;
    const ratePerSec = ratePerMinute / 60.0;
    
    sortedCalls.forEach(c => {
        // We do NOT filter by currentParkingId for quota counting. Quota is ALWAYS global per owner.
        // But for display in the graph and list, we will filter later or just track global.
        
        const d = new Date(c.created_at);
        const monthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const dayKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        
        const pid = 'global';
        if (!usageState[pid]) usageState[pid] = {};
        if (!usageState[pid][monthKey]) usageState[pid][monthKey] = { usedCalls: 0 };
        
        const isForwarded = (c.is_forwarded === 'true' || c.is_forwarded === true);
        const durationSec = parseInt(c.call_duration || 0);
        
        let callCost = 0;
        let consumedFreeCalls = 0;
        let isPaidCall = false;
        let currentQuotaCount = 0;
        
        if (!isForwarded) {
            // AI call (successful)
            const currentUsed = usageState[pid][monthKey].usedCalls;
            if (currentUsed >= 100) {
                // Quota exceeded: apply rate logic
                if (durationSec <= 60) {
                    callCost = ratePerMinute;
                } else {
                    const extraSecs = durationSec - 60;
                    callCost = ratePerMinute + (extraSecs * ratePerSec);
                }
                isPaidCall = true;
            } else {
                // Consume from quota (1 call)
                usageState[pid][monthKey].usedCalls += 1;
                consumedFreeCalls = 1;
                currentQuotaCount = usageState[pid][monthKey].usedCalls;
            }
        }
        
        // Filter by current parking lot if not 'all' for display purposes
        if (typeof currentParkingId !== 'undefined' && currentParkingId !== 'all' && c.parking_id !== currentParkingId) {
            return;
        }
        
        // Sum within selected time window
        if (d >= startWin && d <= endWin) {
            totalCostInWindow += callCost;
            
            aiCallsInWindow.push({
                call: c,
                isForwarded: isForwarded,
                cost: callCost,
                duration: durationSec,
                isPaidCall: isPaidCall,
                currentQuotaCount: currentQuotaCount
            });
            
            let plotKey = dayKey;
            if (isHourly) {
                plotKey = String(d.getHours()).padStart(2, '0') + ':00';
            }
            
            if (!graphData[plotKey]) graphData[plotKey] = { freeCalls: 0, paidCalls: 0, cost: 0 };
            graphData[plotKey].freeCalls += consumedFreeCalls;
            if (isPaidCall) graphData[plotKey].paidCalls += 1;
            graphData[plotKey].cost += callCost;
        }
    });
    
    if (window.animateValue) {
        window.animateValue('ai-cost-display', totalCostInWindow, (val) => val.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '&nbsp;₪');
    }
    if (displayEl) {
        displayEl.innerHTML = totalCostInWindow.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '&nbsp;₪';
    }
    
    // Update Quota Display based on the latest month in the window for the selected parking lot (or all)
    const quotaDisplay = document.getElementById('ai-quota-display');
    if (quotaDisplay) {
        let currentMonthKey = maxD.getFullYear() + '-' + String(maxD.getMonth() + 1).padStart(2, '0');
        let totalUsedInMonth = 0;
        
        if (usageState['global'] && usageState['global'][currentMonthKey]) {
            totalUsedInMonth = usageState['global'][currentMonthKey].usedCalls;
        }
        
        const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
        const mName = monthNames[maxD.getMonth()];
        const displayTotal = Math.min(totalUsedInMonth, 100);
        quotaDisplay.innerText = `${displayTotal} / 100 שיחות (${mName})`;
        if (totalUsedInMonth >= 100) {
            quotaDisplay.style.color = 'var(--accent-red)';
        } else {
            quotaDisplay.style.color = 'var(--accent-blue)';
        }
    }
    
    aiCallsInWindow.sort((a, b) => new Date(b.call.created_at) - new Date(a.call.created_at));
    
    window.aiCallsInWindow = aiCallsInWindow;
    renderAICostGraph(graphData);
    renderAICostList(aiCallsInWindow);
}

window.renderAICostList = function(callsList) {
    const listEl = document.getElementById('ai-cost-calls-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    const filterValue = window.currentOwnerListFilter || 'op';
    
    let filteredList = callsList;
    if (filterValue === 'op') {
        filteredList = callsList.filter(item => item.isForwarded);
    } else if (filterValue === 'ai') {
        filteredList = callsList.filter(item => !item.isForwarded);
    }
    
    if (filteredList.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 0.9rem;">אין שיחות לתקופה ולסינון זה</li>';
        return;
    }
    
    let htmlContent = '';
    
    filteredList.forEach(item => {
        const c = item.call;
        const d = new Date(c.created_at);
        const timeStr = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
        
        let statusHtml = '';
        if (item.isForwarded) {
            if (filterValue !== 'op') {
                statusHtml = '<span style="color: var(--accent-blue); font-size: 0.85rem; font-weight: bold; padding: 2px 8px; background: rgba(10,132,255,0.1); border-radius: 12px;">טופל ע"י מוקד אנושי</span>';
            }
        } else {
            const costText = item.cost > 0 ? `${item.cost.toFixed(2)} ₪` : '0 ₪';
            const chargedText = item.isPaidCall ? '(חויב)' : `(לא חויב ${item.currentQuotaCount}/100)`;
            if (filterValue === 'ai') {
                statusHtml = `<span style="color: var(--accent-green); font-size: 0.85rem; font-weight: bold; padding: 2px 8px; background: rgba(48,209,88,0.1); border-radius: 12px;">${chargedText} - ${item.duration} שנ' - ${costText}</span>`;
            } else {
                statusHtml = `<span style="color: var(--accent-green); font-size: 0.85rem; font-weight: bold; padding: 2px 8px; background: rgba(48,209,88,0.1); border-radius: 12px;">טופל ע"י AI ${chargedText} - ${item.duration} שנ' - ${costText}</span>`;
            }
        }
        
        const plate = c.plate_number || 'לא ידוע';
        const flashClass = c.isNew ? 'new-row-flash' : '';
        
        const parkingName = c.parking_name || getParkingNameById(c.parking_id) || 'כללי';
        const laneStr = c.lane_id ? ` | נתיב: ${c.lane_id}` : '';
        let act = c.actions_taken || '-';
        act = act.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
        
        const callTime = new Date(c.created_at).getTime();
        const blockedRecord = (window.cachedBlocked || []).find(b => String(b.plate).trim() === String(c.plate_number).trim() && (!b.parking_id || String(b.parking_id) === 'all' || String(b.parking_id) === String(c.parking_id)) && (!b.added_at || new Date(b.added_at).getTime() <= callTime));
        const authRecord = (window.cachedAuthorized || []).find(a => String(a.plate).trim() === String(c.plate_number).trim() && (!a.parking_id || String(a.parking_id) === 'all' || String(a.parking_id) === String(c.parking_id)) && (!a.added_at || new Date(a.added_at).getTime() <= callTime));
        
        let req = c.request_summary || '-';
        req = req.replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
        
        let alertHtml = '';
        if (req.includes('רכב חסום')) {
            let reason = req.replace('רכב חסום:', '').replace('רכב חסום', '').trim() || 'ללא סיבה';
            alertHtml = `<div style="margin-bottom: 6px; color: #ff3b30; font-weight: bold; font-size: 0.9em;">רכב חסום! סיבה: ${reason}</div>`;
        } else if (req.includes('רכב מורשה')) {
            let notes = req.replace('רכב מורשה:', '').replace('רכב מורשה', '').trim() || 'ללא סיבה';
            alertHtml = `<div style="margin-bottom: 6px; color: #34c759; font-weight: bold; font-size: 0.9em;">רכב מורשה סיבה (${notes})</div>`;
        } else if (blockedRecord) {
            let reason = (blockedRecord.reason || 'ללא סיבה').replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
            alertHtml = `<div style="margin-bottom: 6px; color: #ff3b30; font-weight: bold; font-size: 0.9em;">רכב חסום! סיבה: ${reason}</div>`;
        } else if (authRecord) {
            let notes = (authRecord.notes || 'ללא סיבה').replace(/\s*\(בוצע ע["'״]?י:.*?\)/g, '');
            alertHtml = `<div style="margin-bottom: 6px; color: #34c759; font-weight: bold; font-size: 0.9em;">רכב מורשה סיבה (${notes})</div>`;
        }
        
        let plateDisplayCard = plate;
        if (c.repaired_plate && c.repaired_plate !== plate) {
            plateDisplayCard += ` <span style="font-size:0.85em;color:var(--text-muted);font-weight:normal;" title="מספר שהוכתב ע״י הנהג">(הנהג תיקן ל-${c.repaired_plate})</span>`;
        }
        
        htmlContent += `
            <li class="${flashClass}" style="padding: 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); text-align: right; display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 1rem; margin-bottom: 4px;">רכב: ${plateDisplayCard}</div>
                    <div style="font-size: 0.8rem; color: var(--color-muted-text) !important; margin-bottom: 4px;">${timeStr} | ${dateStr} | חניון: ${parkingName}${laneStr}</div>
                    ${alertHtml}
                    <div style="font-size: 0.76rem; margin-top: 4px; line-height: 1.4;"><strong style="color: var(--color-req);">בקשה:</strong> <span style="color: var(--color-desc);">${req}</span><br><strong style="color: var(--color-act);">פעולה:</strong> <span style="color: var(--color-desc);">${act}</span></div>
                </div>
                <div style="flex-shrink: 0; margin-right: 15px;">${statusHtml}</div>
            </li>
        `;
    });
    
    listEl.innerHTML = htmlContent;
}

function renderAICostGraph(graphData) {
    const container = document.getElementById('ai-cost-chart-container');
    if (!container) return;
    
    const existingWrapper = container.querySelector('div');
    const isFirstRender = !existingWrapper;
    let oldScrollLeft = existingWrapper ? existingWrapper.scrollLeft : 0;
    
    const days = Object.keys(graphData).sort();
    if (days.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 0.9rem;">אין נתונים לתקופה זו</div>';
        return;
    }
    
    const maxFree = Math.max(...days.map(d => graphData[d].freeCalls), 10);
    const maxPaid = Math.max(...days.map(d => graphData[d].paidCalls), 5);
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.display = 'flex';
    chartWrapper.style.height = '100%';
    chartWrapper.style.alignItems = 'flex-end';
    chartWrapper.style.justifyContent = 'flex-start';
    chartWrapper.style.gap = '15px';
    chartWrapper.style.padding = '10px 10px 45px 10px';
    chartWrapper.style.overflowX = 'auto';
    chartWrapper.style.width = '100%';
    
    days.forEach(day => {
        const data = graphData[day];
        
        const col = document.createElement('div');
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.alignItems = 'center';
        col.style.flex = '0 0 auto';
        col.style.minWidth = '35px'; // slightly wider to ensure dates don't overlap
        col.style.height = '100%';
        col.style.justifyContent = 'flex-end';
        col.style.position = 'relative';
        
        const barsContainer = document.createElement('div');
        barsContainer.style.display = 'flex';
        barsContainer.style.alignItems = 'flex-end';
        barsContainer.style.justifyContent = 'center';
        barsContainer.style.gap = '3px';
        barsContainer.style.width = '100%';
        barsContainer.style.height = '100%';
        
        const freeH = (data.freeCalls / maxFree) * 100;
        const paidH = (data.paidCalls / maxPaid) * 100;
        
        const freeBar = document.createElement('div');
        freeBar.style.width = '14px';
        freeBar.style.background = 'var(--accent-blue)';
        freeBar.style.borderRadius = '3px 3px 0 0';
        freeBar.style.transition = 'height 0.5s ease';
        if (data.freeCalls === 0) freeBar.style.display = 'none';
        else freeBar.style.height = `${Math.max(freeH, 2)}%`;
        
        const paidBar = document.createElement('div');
        paidBar.style.width = '14px';
        paidBar.style.background = 'var(--accent-red)';
        paidBar.style.borderRadius = '3px 3px 0 0';
        paidBar.style.transition = 'height 0.5s ease';
        if (data.paidCalls === 0) paidBar.style.display = 'none';
        else paidBar.style.height = `${Math.max(paidH, 2)}%`;
        
        let labelDisplay = '';
        let titleDisplay = '';
        if (day.includes(':')) {
            labelDisplay = day;
            titleDisplay = `שעה ${day}`;
        } else {
            const [y, m, d_part] = day.split('-');
            labelDisplay = `${d_part}/${m}`;
            titleDisplay = labelDisplay;
        }
        
        const costStr = data.cost > 0 ? `<br/>עלות: ${data.cost.toFixed(2)} ₪` : '';
        const tooltip = document.createElement('div');
        tooltip.innerHTML = `<strong>${titleDisplay}</strong><br/>במכסה: ${data.freeCalls}<br/>שיחות AI: ${data.paidCalls}${costStr}`;
        tooltip.style.position = 'absolute';
        tooltip.style.top = '5px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.background = 'var(--bg-card)';
        tooltip.style.color = 'var(--text-color)';
        tooltip.style.padding = '6px 10px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.fontSize = '0.75rem';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.opacity = '0';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        tooltip.style.border = '1px solid var(--border-color)';
        tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        tooltip.style.zIndex = '10';
        tooltip.style.marginBottom = '8px';
        tooltip.style.textAlign = 'center';
        tooltip.style.lineHeight = '1.4';
        
        col.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
            col.style.background = 'rgba(255,255,255,0.03)';
            col.style.borderRadius = '4px 4px 0 0';
        });
        col.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
            col.style.background = 'transparent';
        });
        
        barsContainer.appendChild(freeBar);
        barsContainer.appendChild(paidBar);
        col.appendChild(tooltip);
        
        const label = document.createElement('div');
        label.innerText = labelDisplay;
        label.style.fontSize = '0.75rem';
        label.style.color = 'var(--text-muted)';
        label.style.position = 'absolute';
        label.style.bottom = '-22px';
        label.style.whiteSpace = 'nowrap';
        
        col.appendChild(barsContainer);
        col.appendChild(label);
        
        chartWrapper.appendChild(col);
    });
    
    container.innerHTML = '';
    container.appendChild(chartWrapper);
    
    // Manage scroll position without timeouts to avoid layout jumps
    if (isFirstRender) {
        chartWrapper.scrollLeft = 99999; // LTR container, scroll right for newest
    } else {
        chartWrapper.scrollLeft = oldScrollLeft;
    }
}

document.getElementById('search-blocked')?.addEventListener('input', () => {
    renderActionList('blocked', cachedBlocked);
});
document.getElementById('search-authorized')?.addEventListener('input', () => {
    renderActionList('authorized', cachedAuthorized);
});



// Auto-start dashboard
if (document.getElementById('owner-dashboard-marker')) {
    initDashboard();
} else if (document.getElementById('admin-dashboard-marker')) {
    fetchParkingNames().catch(e => console.warn(e)); // Ensure parking names are loaded for admin tables
} else {
    if (sessionStorage.getItem('intercom_session_token')) {
        showScreen('dashboard-screen');
        initDashboard();
    }
}

// Configure role-based navigation buttons with continuous check
setInterval(() => {
    let role = sessionStorage.getItem('intercom_user_role');
    const path = window.location.pathname;
    
    // Fallback if user didn't log in again
    if (!role) {
        // If they ever visit admin, they are an admin.
        if (path.includes('admin_dashboard')) {
            role = 'admin';
            sessionStorage.setItem('intercom_user_role', 'admin');
        } else if (path.includes('owner_dashboard')) {
            role = 'manager';
        }
    }

    let roleNavContainers = document.querySelectorAll('.role-nav-buttons, #role-nav-buttons');
    if (roleNavContainers.length > 0 && (role === 'owner' || role === 'manager' || role === 'admin')) {
        roleNavContainers.forEach(container => {
            container.style.display = 'flex';
            container.style.background = 'rgba(0,0,0,0.2)';
            container.style.padding = '4px 8px';
            container.style.borderRadius = '8px';
            container.style.border = '1px solid rgba(255,255,255,0.1)';
        });
        
        const isOwner = path.includes('owner_dashboard');
        const isAdmin = path.includes('admin_dashboard');
        const isOperator = (!isOwner && !isAdmin);

        const btnAdmins = document.querySelectorAll('.nav-admin-btn, #nav-admin-btn');
        const btnManagers = document.querySelectorAll('.nav-manager-btn, #nav-manager-btn');
        const btnOperators = document.querySelectorAll('.nav-operator-btn, #nav-operator-btn');

        btnAdmins.forEach(btnAdmin => {
            if (role === 'admin') {
                btnAdmin.style.display = 'inline-block';
                btnAdmin.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.location.href = 'admin_dashboard.html'; });
            }
            if (isAdmin) btnAdmin.classList.add('active');
        });
        btnManagers.forEach(btnManager => {
            if (role === 'admin' || role === 'manager' || role === 'owner') {
                btnManager.style.display = 'inline-block';
                btnManager.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.location.href = 'owner_dashboard.html'; });
            }
            if (isOwner) btnManager.classList.add('active');
        });
        btnOperators.forEach(btnOperator => {
            if (role === 'admin' || role === 'manager' || role === 'owner') {
                btnOperator.style.display = 'inline-block';
                btnOperator.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.location.href = 'index.html'; });
            }
            if (isOperator) btnOperator.classList.add('active');
        });
    }
}, 1000);

window.exportTableToCSV = function(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let csv = [];
    const rows = table.querySelectorAll("tr");
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, "").replace(/(\s\s)/gm, " ");
            data = data.replace(/"/g, '""');
            row.push('"' + data + '"');
        }
        csv.push(row.join(","));
    }
    const csvFile = new Blob(["\uFEFF"+csv.join("\n")], {type: "text/csv;charset=utf-8;"});
    const downloadLink = document.createElement("a");
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

window.printTable = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>הדפסה</title>');
    printWindow.document.write('<style>body { font-family: sans-serif; direction: rtl; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: right; } th { background-color: #f2f2f2; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>דוח מיוצא</h2>');
    printWindow.document.write(table.outerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};

window.printAICost = function() {
    const listEl = document.getElementById('ai-cost-calls-list');
    if (!listEl) return;
    const totalEl = document.getElementById('ai-cost-display');
    const quotaEl = document.getElementById('ai-quota-display');
    
    let html = '<html><head><title>דוח עלויות AI</title>';
    html += '<style>body { font-family: sans-serif; direction: rtl; padding: 20px; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: right; } th { background-color: #f2f2f2; } .summary { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; margin-bottom: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; } .summary-left { display: flex; flex-direction: column; } .summary-title { font-size: 1.2rem; color: #555; } .summary-quota { font-size: 1rem; color: #555; margin-top: 5px; } .summary-cost { font-size: 2.5rem; font-weight: bold; color: #28a745; direction: ltr; }</style>';
    html += '</head><body>';
    html += '<h2>דוח עלויות AI</h2>';
    html += '<div class="summary">';
    html += '  <div class="summary-left">';
    html += '    <span class="summary-title">סה"כ עלות לתקופה:</span>';
    html += '    <div class="summary-quota">מכסה חודשית מנוצלת: <strong style="color: #007bff;">' + (quotaEl ? quotaEl.innerText : '0') + '</strong></div>';
    html += '  </div>';
    html += '  <div class="summary-cost">' + (totalEl ? totalEl.innerText : '0') + '</div>';
    html += '</div>';
    
    html += '<table><thead><tr><th>תאריך ושעה</th><th>רכב</th><th>סטטוס ועלות</th></tr></thead><tbody>';
    
    const items = listEl.querySelectorAll('li');
    items.forEach(li => {
        const spans = li.querySelectorAll('span');
        if (spans.length >= 3) {
            const plateInfo = spans[0].innerText;
            const timeInfo = spans[1].innerText;
            const statusInfo = spans[2].innerText;
            html += `<tr><td>${timeInfo}</td><td>${plateInfo}</td><td>${statusInfo}</td></tr>`;
        } else if (spans.length === 0) {
            html += `<tr><td colspan="3" style="text-align:center;">${li.innerText}</td></tr>`;
        }
    });
    
    html += '</tbody></table></body></html>';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};

// ==========================================
// Legal & Policies Modal Logic
// ==========================================
document.body.addEventListener('click', (e) => {
    // Open Modal
    if (e.target && (e.target.id === 'open-legal-modal' || e.target.closest('#open-legal-modal'))) {
        e.preventDefault();
        const overlay = document.getElementById('legal-modal-overlay');
        if (overlay) overlay.style.display = 'flex';
    }
    
    // Close Modal via button
    if (e.target && (e.target.id === 'legal-close-btn' || e.target.closest('#legal-close-btn'))) {
        const overlay = document.getElementById('legal-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    }
    
    // Close Modal via overlay click
    if (e.target && e.target.id === 'legal-modal-overlay') {
        e.target.style.display = 'none';
    }

    // Tab Switching
    if (e.target && e.target.classList.contains('legal-nav-btn')) {
        const navBtns = document.querySelectorAll('.legal-nav-btn');
        const sections = document.querySelectorAll('.legal-section');
        
        // Remove active from all btns and sections
        navBtns.forEach(b => b.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        // Add active to clicked btn
        e.target.classList.add('active');
        
        // Show target section
        const targetId = e.target.getAttribute('data-target');
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }
});

// ==========================================
// Date Range Mode Toggling Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnDateToggle = document.getElementById('btn-date-toggle');
    
    if (btnDateToggle) {
        let isRangeMode = false;
        
        btnDateToggle.addEventListener('click', () => {
            isRangeMode = !isRangeMode;
            
            if (isRangeMode) {
                // Switch to Range Mode
                btnDateToggle.textContent = 'תקופתי';
                document.querySelectorAll('.date-exact-item').forEach(el => el.style.setProperty('display', 'none', 'important'));
                document.querySelectorAll('.date-range-item').forEach(el => el.style.setProperty('display', 'block', 'important'));
                document.getElementById('search-date').value = '';
            } else {
                // Switch to Exact Mode
                btnDateToggle.textContent = 'יומי';
                document.querySelectorAll('.date-range-item').forEach(el => el.style.setProperty('display', 'none', 'important'));
                document.querySelectorAll('.date-exact-item').forEach(el => el.style.setProperty('display', 'block', 'important'));
                document.getElementById('search-start-date').value = '';
                document.getElementById('search-end-date').value = '';
            }
            
            if (typeof triggerSearch === 'function') triggerSearch();
        });
    }
});

// ==========================================
// Date Input Mask (Auto-insert slashes)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const dateInputs = ['search-date', 'search-start-date', 'search-end-date', 'custom-graph-start-date', 'custom-graph-end-date'];
    
    dateInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function(e) {
                // Only allow numbers
                let val = e.target.value.replace(/[^0-9]/g, '');
                
                // Format as DD/MM/YYYY
                if (val.length >= 5) {
                    val = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4, 8);
                } else if (val.length >= 3) {
                    val = val.substring(0, 2) + '/' + val.substring(2, 4);
                }
                
                e.target.value = val;
            });
            
            // Prevent deleting the slash from getting stuck
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace') {
                    const val = e.target.value;
                    if (val.length === 3 && val.endsWith('/')) {
                        e.target.value = val.substring(0, 2);
                        e.preventDefault();
                    } else if (val.length === 6 && val.endsWith('/')) {
                        e.target.value = val.substring(0, 5);
                        e.preventDefault();
                    }
                }
            });
        }
    });
});

// ==========================================
// Time Input Mask (Auto-insert colons)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const timeInput = document.getElementById('search-time');
    if (timeInput) {
        timeInput.addEventListener('input', function(e) {
            // Only allow numbers
            let val = e.target.value.replace(/[^0-9]/g, '');
            
            // Format as hh:mm:ss
            if (val.length >= 5) {
                val = val.substring(0, 2) + ':' + val.substring(2, 4) + ':' + val.substring(4, 6);
            } else if (val.length >= 3) {
                val = val.substring(0, 2) + ':' + val.substring(2, 4);
            }
            
            e.target.value = val;
        });
        
        // Prevent deleting the colon from getting stuck
        timeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace') {
                const val = e.target.value;
                if (val.length === 3 && val.endsWith(':')) {
                    e.target.value = val.substring(0, 2);
                    e.preventDefault();
                } else if (val.length === 6 && val.endsWith(':')) {
                    e.target.value = val.substring(0, 5);
                    e.preventDefault();
                }
            }
        });
    }
});

// ==========================================
// Populate Actions Datalist
// ==========================================
function populateActionDbDropdown(calls) {
    const dataList = document.getElementById('actions-list');
    if (!dataList) return;
    
    // Some hardcoded common defaults
    let actions = [
        "פתיחת מחסום",
        "פתיחת מחסום כניסה",
        "פתיחת מחסום יציאה",
        "העברה למוקד אנושי"
    ];
    
    // Add dynamically from database
    const dbActions = calls.map(c => c.actions_taken).filter(Boolean);
    actions = [...new Set([...actions, ...dbActions])];
    
    dataList.innerHTML = '';
    
    actions.forEach(action => {
        const opt = document.createElement('option');
        opt.value = action;
        dataList.appendChild(opt);
    });
}


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
        'show-recent-calls',
        'show-ai-calls',
        'show-rules-white', 
        'show-rules-black', 
        'show-all-calls', 
        'show-load-graph',
        'show-print'
    );
    
    // Add the selected view class
    if (viewClass) {
        document.body.classList.add(viewClass);
    }
    
    // Update the button text if provided
    if (btnText) {
        const btnSpan = document.getElementById('mobile-dropdown-current');
        if (btnSpan) {
            let displayTxt = btnText;
            try {
                if (typeof getParkingNameById === 'function') {
                    const resolved = getParkingNameById(btnText);
                    if (resolved && resolved !== 'כללי') {
                        displayTxt = resolved;
                    }
                }
            } catch(e) {}
            btnSpan.textContent = displayTxt;
        }
    }
    
    // Refresh items within .mobile-dropdown-menu to show dynamic names
    if (typeof refreshMobileDropdownNames === 'function') {
        refreshMobileDropdownNames();
    }
    
    // Close the dropdown
    const container = document.getElementById('mobile-dropdown-container');
    if (container) {
        container.classList.remove('open');
    }
    
    // Trigger resize to fix any charts that were hidden
    setTimeout(() => { 
        window.dispatchEvent(new Event('resize')); 
        
        // Fix scroll positions for charts that might have been hidden
        const aiCostWrapper = document.querySelector('#ai-cost-chart-container > div');
        if (aiCostWrapper) {
            aiCostWrapper.scrollLeft = -99999;
            if (aiCostWrapper.scrollLeft === 0) aiCostWrapper.scrollLeft = 99999;
        }
        
        const barChartWrapper = document.getElementById('bar-chart-container');
        if (barChartWrapper) {
            barChartWrapper.scrollLeft = -99999;
            if (barChartWrapper.scrollLeft === 0) barChartWrapper.scrollLeft = 99999;
        }
        
        // Explicitly trigger applyFilters() to re-render dynamic text contents instantly and bypass cache
        if (typeof applyFilters === 'function') {
            applyFilters();
        }
    }, 50);
}

// Ensure mobile titles exist for AI panels
function injectMobileTitles() {
    const tabRecentAi = document.getElementById('tab-recent-ai');
    if (tabRecentAi && !tabRecentAi.querySelector('.mobile-view-title')) {
        const h2 = document.createElement('h2');
        h2.className = 'mobile-only mobile-view-title';
        h2.style.cssText = 'display: none; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;';
        h2.textContent = 'שיחות AI';
        tabRecentAi.insertBefore(h2, tabRecentAi.firstChild);
    }
    
    const tabBlocked = document.getElementById('tab-blocked');
    if (tabBlocked && !tabBlocked.querySelector('.mobile-view-title')) {
        const h2 = document.createElement('h2');
        h2.className = 'mobile-only mobile-view-title';
        h2.style.cssText = 'display: none; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;';
        h2.textContent = 'ניהול חסומים';
        tabBlocked.insertBefore(h2, tabBlocked.firstChild);
    }
    
    const tabAuthorized = document.getElementById('tab-authorized');
    if (tabAuthorized && !tabAuthorized.querySelector('.mobile-view-title')) {
        const h2 = document.createElement('h2');
        h2.className = 'mobile-only mobile-view-title';
        h2.style.cssText = 'display: none; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;';
        h2.textContent = 'ניהול מורשים';
        tabAuthorized.insertBefore(h2, tabAuthorized.firstChild);
    }
}
if(document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', injectMobileTitles); } else { injectMobileTitles(); }

function refreshMobileDropdownNames() {
    document.querySelectorAll('.mobile-dropdown-menu .mobile-dropdown-item').forEach(item => {
        const titleSpan = item.querySelector('.mobile-dropdown-item-title');
        if (titleSpan) {
            const onclickAttr = item.getAttribute('onclick') || '';
            const match = onclickAttr.match(/switchMobileView\('[^']*',\s*'([^']+)'\)/);
            if (match && match[1]) {
                const originalId = match[1];
                let resolvedName = originalId;
                try {
                    if (typeof getParkingNameById === 'function') {
                        const resolved = getParkingNameById(originalId);
                        if (resolved && resolved !== 'כללי') {
                            resolvedName = resolved;
                        }
                    }
                } catch(e) {}
                titleSpan.textContent = resolvedName;
            }
        }
    });
}

function updateLanesList() {
    const lanesList = document.getElementById('lanes-list');
    if (!lanesList) return;
    
    // Get unique lane_ids from filteredCalls
    const uniqueLanes = [...new Set(filteredCalls.map(c => c.lane_id).filter(l => l))];
    
    lanesList.innerHTML = '';
    uniqueLanes.sort().forEach(lane => {
        const option = document.createElement('option');
        option.value = lane;
        lanesList.appendChild(option);
    });
}

window.searchCallForVehicle = function(plate, dateStr, timeStr) {
    if (document.getElementById('search-plate')) {
        document.getElementById('search-plate').value = plate;
        document.getElementById('search-date').value = dateStr || '';
        document.getElementById('search-time').value = timeStr || '';
        
        const allTabBtn = document.querySelector('button[onclick*="setOwnerListFilter(\'all\'"]');
        if (allTabBtn) {
            setOwnerListFilter('all', allTabBtn);
        }
        if (typeof triggerSearch === 'function') triggerSearch();
        
        const container = document.getElementById('all-calls-container');
        if (container) container.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.location.href = `owner_dashboard.html?sp=${encodeURIComponent(plate)}&sd=${encodeURIComponent(dateStr)}&st=${encodeURIComponent(timeStr)}`;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('sp')) {
        setTimeout(() => {
            if (document.getElementById('search-plate')) {
                document.getElementById('search-plate').value = params.get('sp');
                document.getElementById('search-date').value = params.get('sd') || '';
                document.getElementById('search-time').value = params.get('st') || '';
                
                const allTabBtn = document.querySelector('button[onclick*="setOwnerListFilter(\'all\'"]');
                if (allTabBtn) {
                    setOwnerListFilter('all', allTabBtn);
                }
function startSessionMonitor() {
    if (window._sessionMonitorInterval) return;
    
    const checkSession = async () => {
        const username = sessionStorage.getItem('username');
        const authToken = sessionStorage.getItem('intercom_auth_token');
        
        if (username && authToken) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/check_session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username, auth_token: authToken })
                });
                
                if (res.status === 401) {
                    const data = await res.json();
                    alert(data.error || "החיבור נותק, אנא התחבר מחדש");
                    sessionStorage.clear();
                    if (window.location.pathname.includes('dashboard')) {
                        window.location.href = 'index.html';
                    } else {
                        location.reload();
                    }
                }
            } catch (err) {
                console.error("Session check error:", err);
            }
        }
    };

    checkSession();
    window._sessionMonitorInterval = setInterval(checkSession, 15000);
}

window.addEventListener('DOMContentLoaded', () => {
    startSessionMonitor();
});
