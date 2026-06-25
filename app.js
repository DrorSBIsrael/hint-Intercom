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
        if (currentLang === 'he') currentLangBtn.innerText = '🇮🇱 HE ▾';
        else if (currentLang === 'ar') currentLangBtn.innerText = '🇦🇪 AR ▾';
        else if (currentLang === 'en') currentLangBtn.innerText = '🇺🇸 EN ▾';
        else if (currentLang === 'ru') currentLangBtn.innerText = '🇷🇺 RU ▾';
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
            if (btn.getAttribute('data-lang') === currentLang) {
                btn.style.opacity = '1';
                btn.style.borderBottom = '2px solid var(--accent-blue)';
            } else {
                btn.style.opacity = '0.5';
                btn.style.borderBottom = 'none';
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
    
    // Attempt to resume if suspended (may fail if no interaction yet, but we tried)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }
    
    function playTone(freq, duration, type='sine', vol=0.2) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    const soundType = document.getElementById('sound-select')?.value || '1';
    
    if (soundType === '1') {
        // צפצוף כפול (קלאסי)
        playTone(784, 0.4, 'sine', 0.2);
        setTimeout(() => playTone(659, 0.6, 'sine', 0.2), 400);
    } else if (soundType === '2') {
        // נקישה עדינה (עמום)
        playTone(300, 0.15, 'triangle', 0.4);
        setTimeout(() => playTone(300, 0.15, 'triangle', 0.4), 150);
    } else if (soundType === '3') {
        // פעמון טיסה (נעים)
        playTone(600, 0.8, 'sine', 0.3);
    } else if (soundType === '4') {
        // התראת רטרו (מכני)
        playTone(440, 0.1, 'square', 0.1);
        setTimeout(() => playTone(440, 0.1, 'square', 0.1), 150);
        setTimeout(() => playTone(440, 0.1, 'square', 0.1), 300);
    }
}

document.getElementById('sound-toggle-btn')?.addEventListener('click', (e) => {
    isSoundEnabled = !isSoundEnabled;
    e.target.innerText = isSoundEnabled ? '🔊' : '🔇';
    e.target.style.opacity = isSoundEnabled ? '1' : '0.7';
    
    const soundSelect = document.getElementById('sound-select');
    if (soundSelect) {
        soundSelect.style.display = isSoundEnabled ? 'block' : 'none';
    }
    
    if (isSoundEnabled) playNotificationSound();
});

document.getElementById('sound-select')?.addEventListener('change', () => {
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
    const timeStr = now.toLocaleTimeString('he-IL'); // HH:MM:SS
    const dateStr = now.toLocaleDateString('he-IL'); // DD.MM.YYYY
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
    const greetingEl = document.getElementById('greeting-container');
    if (greetingEl) {
        const hour = now.getHours();
        let transKey = 'good_morning';
        if (hour >= 12 && hour < 18) transKey = 'good_afternoon';
        else if (hour >= 18) transKey = 'good_evening';
        
        const rawUsername = sessionStorage.getItem('username') || '';
        // Extract only the first word (Hebrew or English), ignoring symbols and subsequent words
        const username = rawUsername.split(/[^a-zA-Zא-ת]/)[0] || rawUsername;
        
        const parkingSelect = document.getElementById('parking-selector');
        let parkingName = '';
        if (parkingSelect && parkingSelect.options.length > 0 && parkingSelect.value !== 'all') {
            parkingName = parkingSelect.options[parkingSelect.selectedIndex].text;
        }
        
        // As requested: instead of "All Parkings" (כל החניות), write the username.
        // We will stack them: [Greeting] over [Username]
        let htmlStr = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; white-space: nowrap;">`;
        
        // Parking name is now displayed next to the theme toggle
        
        htmlStr += `<span style="font-size: 1.6em; font-weight: 700; color: var(--text-highlight); line-height: 1;">${t(transKey)}</span>`;
        
        if (username) {
            htmlStr += `<span style="font-size: 1.2em; opacity: 0.85; line-height: 1;">${username}</span>`;
        }
        
        htmlStr += `</div>`;
        
        greetingEl.innerHTML = htmlStr;
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
                if (data.role) sessionStorage.setItem('intercom_user_role', data.role);
                if (data.allowed_parkings) sessionStorage.setItem('intercom_allowed_parkings', JSON.stringify(data.allowed_parkings));
                if (data.rate_per_minute) sessionStorage.setItem('intercom_rate_per_minute', data.rate_per_minute);
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
const fontIncrease = document.getElementById('font-increase');
const fontDecrease = document.getElementById('font-decrease');
const appBody = document.getElementById('app-body');

let baseFontSize = 16;

themeToggle.addEventListener('click', () => {
    if (appBody.classList.contains('dark-mode')) {
        appBody.classList.remove('dark-mode');
        appBody.classList.add('light-mode');
    } else {
        appBody.classList.remove('light-mode');
        appBody.classList.add('dark-mode');
    }
});

fontIncrease.addEventListener('click', () => {
    if (baseFontSize < 24) {
        baseFontSize += 2;
        appBody.style.setProperty('--base-font-size', `${baseFontSize}px`);
    }
});

fontDecrease.addEventListener('click', () => {
    if (baseFontSize > 12) {
        baseFontSize -= 2;
        appBody.style.setProperty('--base-font-size', `${baseFontSize}px`);
    }
});

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


function filterDataByAllowedParkings(dataArray) {
    const role = sessionStorage.getItem('intercom_user_role');
    if (role === 'admin') return dataArray;
    
    const allowedParkingsStr = sessionStorage.getItem('intercom_allowed_parkings');
    let allowedParkings = [];
    if (allowedParkingsStr) {
        try { allowedParkings = JSON.parse(allowedParkingsStr); } catch(e) {}
    }
    
    if (allowedParkings.length === 0) return dataArray; // Originally, empty meant show all
    
    const allowedStr = allowedParkings.map(p => String(p.id || p));
    return dataArray.filter(item => allowedStr.includes(String(item.parking_id)));
}

async function fetchInitialCalls() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/calls?t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch calls");
        let newCalls = await res.json();
        newCalls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        newCalls = filterDataByAllowedParkings(newCalls);

            if (allCalls.length === 0 || newCalls.length !== allCalls.length || newCalls[0].id !== allCalls[0].id) {
                const hasNewCall = allCalls.length > 0 && newCalls.length > 0 && newCalls[0].id !== allCalls[0].id;
                const latestCall = newCalls[0];
                
                if (hasNewCall) {
                    const oldLatestId = allCalls[0].id;
                    for (let i = 0; i < newCalls.length; i++) {
                        if (newCalls[i].id === oldLatestId) break;
                        newCalls[i].isNew = true;
                    }
                }
                
                allCalls = newCalls;
                
                const role = sessionStorage.getItem('intercom_user_role');
                const allowedParkingsStr = sessionStorage.getItem('intercom_allowed_parkings');
                let allowedParkings = [];
                if (allowedParkingsStr) {
                    try { allowedParkings = JSON.parse(allowedParkingsStr); } catch(e) {}
                }
                const allowedStr = allowedParkings.map(p => String(p.id || p));
                
                const parkingSelect = document.getElementById('parking-selector');
                if (parkingSelect && parkingSelect.options.length <= 1) {
                    // Include both allowed parkings and lots from calls to ensure we show all options
                    let lots = [...new Set(allCalls.map(c => c.parking_id))].filter(Boolean);
                    if (role !== 'admin' && allowedParkings.length > 0) {
                        lots = [...new Set([...lots, ...allowedStr])].filter(Boolean);
                    }
                    
                    parkingSelect.innerHTML = '';
                    if (lots.length > 1 || role === 'admin') {
                        parkingSelect.innerHTML = '<option value="all">כל החניונים</option>';
                    }
                    
                    lots.forEach(lot => {
                        const opt = document.createElement('option');
                        opt.value = lot;
                        
                        let lotName = "";
                        const matchingParking = allowedParkings.find(p => String(p.id || p) === String(lot));
                        if (matchingParking && matchingParking.name) {
                            lotName = ` - ${matchingParking.name}`;
                        }
                        
                        opt.innerText = `חניון ${lot}${lotName}`;
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
                        let lotName = "";
                        const matchingParking = allowedParkings.find(p => String(p.id || p) === String(lot));
                        if (matchingParking && matchingParking.name) {
                            lotName = ` - ${matchingParking.name}`;
                        }
                        opt.innerText = `חניון ${lot}${lotName}`;
                        sel.appendChild(opt);
                    });
                });
            }
            
            applyFilters();
            calculateAICosts(allCalls);
            
            // Play notification sound if there is a new call, BUT ONLY IF forwarded to operator
            if (hasNewCall && latestCall.is_forwarded === 'true') {
                playNotificationSound();
            }
        }
    } catch (e) {
        console.error("Failed to poll CSV", e);
    }
}

async function initDashboard() {
    await fetchInitialCalls();
    
    try {
        const configRes = await fetch(`${API_BASE_URL}/api/config`);
        const config = await configRes.json();
        
        if (config.SUPABASE_URL && config.SUPABASE_KEY && window.supabase) {
            const supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
            
            supabaseClient
              .channel('realtime-calls')
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls_log' }, payload => {
                const newCall = payload.new;
                newCall.isNew = true;
                
                // Convert booleans to strings to match existing logic if needed
                if (typeof newCall.is_forwarded === 'boolean') {
                    newCall.is_forwarded = newCall.is_forwarded ? 'true' : 'false';
                }
                
                // Check permissions before adding
                if (filterDataByAllowedParkings([newCall]).length === 0) return;

                // Add to start of array
                allCalls.unshift(newCall);
                
                // Apply filters & update UI
                applyFilters();
                calculateAICosts(allCalls);
                
                // Play notification sound ONLY if it's forwarded to the operator
                if (newCall.is_forwarded === 'true') {
                    playNotificationSound();
                }
              })
              .subscribe();
              
            console.log("Supabase Realtime connected!");
        }
    } catch(e) {
        console.error("Failed to setup realtime", e);
    }
    
    // Always fallback to polling to guarantee updates even if realtime drops
    setInterval(fetchInitialCalls, 3000);
    
    // Setup owner forms and polling
    setupOwnerListForms();
    if (document.getElementById('owner-blocked-list')) {
        setInterval(() => {
            fetchAndRenderActionList('blocked');
            fetchAndRenderActionList('authorized');
        }, 5000);
        
        // Initial fetch
        fetchAndRenderActionList('blocked');
        fetchAndRenderActionList('authorized');
    }
}

document.getElementById('parking-selector').addEventListener('change', (e) => {
    currentParkingId = e.target.value;
    applyFilters();
});

function applyFilters() {
    if (currentParkingId === 'all') {
        filteredCalls = allCalls;
    } else {
        filteredCalls = allCalls.filter(c => c.parking_id === currentParkingId);
    }
    
    updateStatistics();
    updateRecentCalls();
    renderPopularTimes();
    const searchEl = document.getElementById('global-search');
    if (searchEl) {
        updateTable(searchEl.value.trim());
    }
    if (typeof updateGraph === 'function') {
        try { updateGraph(); } catch(e){}
    }
    
    // Also re-render the action lists based on the newly selected parking
    if (typeof fetchAndRenderActionList === 'function') {
        fetchAndRenderActionList('blocked');
        fetchAndRenderActionList('authorized');
    }
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
    
    const aiCalls = statsCalls.filter(c => c.is_forwarded === 'false');
    const opCalls = statsCalls.filter(c => c.is_forwarded === 'true');
    
    const totalCallsCount = statsCalls.length;
    const aiPercent = totalCallsCount ? Math.round((aiCalls.length / totalCallsCount) * 100) : 0;
    const opPercent = totalCallsCount ? Math.round((opCalls.length / totalCallsCount) * 100) : 0;
    
    window.animateValue('stat-ai-calls', aiCalls.length, (val) => `${Math.floor(val)} <span style="font-size: 0.75em; margin-right: 5px;">${aiPercent}%</span>`);
    window.animateValue('stat-op-calls', opCalls.length, (val) => `${Math.floor(val)} <span style="font-size: 0.75em; margin-right: 5px;">${opPercent}%</span>`);
    
    let entranceCount = 0;
    let exitCount = 0;
    statsCalls.forEach(c => {
        const text = ((c.request_summary || '') + ' ' + (c.actions_taken || '')).toLowerCase();
        if (text.includes('כניס') || text.includes('נכנס')) {
            entranceCount++;
        } else if (text.includes('יציא') || text.includes('שיצא')) {
            exitCount++;
        }
    });
    const entPercent = totalCallsCount ? Math.round((entranceCount / totalCallsCount) * 100) : 0;
    const exitPercent = totalCallsCount ? Math.round((exitCount / totalCallsCount) * 100) : 0;
    
    const entEl = document.getElementById('stat-entrance-calls');
    const exitEl = document.getElementById('stat-exit-calls');
    if (entEl && exitEl) {
        window.animateValue('stat-entrance-calls', entranceCount, (val) => `${Math.floor(val)} (${entPercent}%)`);
        window.animateValue('stat-exit-calls', exitCount, (val) => `${Math.floor(val)} (${exitPercent}%)`);
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
    
    const aiTotalTime = aiCalls.reduce((acc, c) => acc + parseInt(c.call_duration || 0), 0);
    const opTotalTime = opCalls.reduce((acc, c) => acc + parseInt(c.call_duration || 0), 0);
    
    function formatTime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    }
    
    window.animateValue('stat-ai-avg', aiTotalTime, (val) => formatTime(Math.floor(val)));
    window.animateValue('stat-op-avg', opTotalTime, (val) => formatTime(Math.floor(val)));
}

function getParkingNameById(id) {
    if (!id) return id;
    const select = document.getElementById('parking-selector');
    if (!select) return id;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === String(id)) {
            return select.options[i].text;
        }
    }
    return id;
}

function updateRecentCalls() {
    const aiCalls = filteredCalls.filter(c => c.is_forwarded === 'false').slice(0, 5);
    const opCalls = filteredCalls.filter(c => c.is_forwarded === 'true').slice(0, 5);
    
    const aiList = document.getElementById('recent-ai-list');
    const opList = document.getElementById('recent-op-list');
    
    if (aiList && aiCalls.length > 0) {
        
        aiList.innerHTML = '';
        aiCalls.forEach(c => {
            const date = new Date(c.created_at);
            const animClass = c.isNew ? 'pulse-green-anim' : '';
            
            const timeStr = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const dateStr = date.toLocaleDateString('he-IL');
            
            const parkingNameStr = (currentParkingId === 'all') ? `<span style="font-size:0.85rem; color:var(--accent-blue);">התקשר מ${getParkingNameById(c.parking_id)}</span>` : '';
            const reason = c.request_summary || c.actions_taken || '';
            const reasonHtml = reason ? ` <span style="font-weight: normal; font-size: 0.9em;">(${reason})</span>` : '';
            
            aiList.innerHTML += `
                <li class="call-item ${animClass}">
                    <span class="time">${timeStr} ,${dateStr}</span>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; width: 100%;">
                        <span class="plate" style="margin: 0;">רכב: ${c.plate_number || 'לא ידוע'}${reasonHtml}</span>
                        <div style="flex: 1; text-align: left;">${parkingNameStr}</div>
                    </div>
                </li>
            `;
            // Remove the flag so it only pulses once
            c.isNew = false;
        });
    }
    
    if (opList && opCalls.length > 0) {
        
        opList.innerHTML = '';
        opCalls.forEach((c, index) => {
            const date = new Date(c.created_at);
            const hlClass = c.isNew ? 'highlight' : '';
            const animClass = c.isNew ? 'pulse-red-anim' : '';
            
            const timeStr = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const dateStr = date.toLocaleDateString('he-IL');
            
            const parkingNameStr = (currentParkingId === 'all') ? `<span style="font-size:0.85rem; color:var(--accent-blue);">התקשר מ${getParkingNameById(c.parking_id)}</span>` : '';
            const reason = c.request_summary || c.actions_taken || '';
            const reasonHtml = reason ? ` <span style="font-weight: normal; font-size: 0.9em; color: var(--accent-red);">(${reason})</span>` : ` <span style="font-weight: normal; font-size: 0.9em; color: var(--accent-red);">(הועבר למוקד)</span>`;
            
            opList.innerHTML += `
                <li class="call-item ${hlClass} ${animClass}">
                    <span class="time">${timeStr} ,${dateStr}</span>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; width: 100%;">
                        <span class="plate" style="margin: 0;">רכב: ${c.plate_number || 'לא ידוע'}${reasonHtml}</span>
                        <div style="flex: 1; text-align: left;">${parkingNameStr}</div>
                    </div>
                </li>
            `;
            c.isNew = false;
        });
    }
    
    // Clear the isNew flag globally so that calls don't highlight retroactively 
    // if the user switches to a different parking filter later.
    allCalls.forEach(c => { c.isNew = false; });
}

// ----------------------------------------------------
// Table & Search
// ----------------------------------------------------
const toggleAllCallsBtn = document.getElementById('toggle-all-calls');
const allCallsContainer = document.getElementById('all-calls-container');
let isTableVisible = false;

if (toggleAllCallsBtn) {
    toggleAllCallsBtn.addEventListener('click', () => {
        isTableVisible = !isTableVisible;
        if (isTableVisible) {
            if (allCallsContainer) allCallsContainer.style.display = 'block';
        } else {
            if (allCallsContainer) allCallsContainer.style.display = 'none';
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
    document.getElementById('global-search'),
    document.getElementById('search-start-date'),
    document.getElementById('search-end-date'),
    document.getElementById('search-time'),
    document.getElementById('search-parking'),
    document.getElementById('search-lane'),
    document.getElementById('search-plate'),
    document.getElementById('search-driver'),
    document.getElementById('search-duration'),
    document.getElementById('search-reason'),
    document.getElementById('search-handled-by')
];

function triggerSearch() {
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
    const qTime = document.getElementById('search-time').value.trim().toLowerCase();
    const qParking = document.getElementById('search-parking').value.trim().toLowerCase();
    const qLane = document.getElementById('search-lane').value.trim().toLowerCase();
    const qPlate = document.getElementById('search-plate').value.trim().toLowerCase();
    const qDriver = document.getElementById('search-driver').value.trim().toLowerCase();
    const qDuration = document.getElementById('search-duration').value.trim().toLowerCase();
    const qReason = document.getElementById('search-reason').value.trim().toLowerCase();
    const qHandledBy = document.getElementById('search-handled-by').value;
    
    const isSearching = qGlobal || qExactDate || qStartDate || qEndDate || qTime || qParking || qLane || qPlate || qDriver || qDuration || qReason || qHandledBy;
    
    if (isSearching) {
        callsToShow = callsToShow.filter(c => {
            if (qGlobal) {
                const matchesGlobal = 
                    (c.plate_number && String(c.plate_number).toLowerCase().includes(qGlobal)) ||
                    (c.driver_name && c.driver_name.toLowerCase().includes(qGlobal)) ||
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
            
            if (qExactDate || qStartDate || qEndDate) {
                const dateOnly = new Date(dateObj);
                dateOnly.setHours(0,0,0,0);
                
                if (qExactDate) {
                    const exactD = new Date(qExactDate);
                    exactD.setHours(0,0,0,0);
                    if (dateOnly.getTime() !== exactD.getTime()) return false;
                } else {
                    if (qStartDate) {
                        const startD = new Date(qStartDate);
                        startD.setHours(0,0,0,0);
                        if (dateOnly < startD) return false;
                    }
                    if (qEndDate) {
                        const endD = new Date(qEndDate);
                        endD.setHours(23,59,59,999);
                        if (dateObj > endD) return false;
                    }
                }
            }
            
            if (qTime && !timeStr1.includes(qTime) && !timeStr2.includes(qTime)) return false;
            if (qParking && (!c.parking_id || !String(c.parking_id).includes(qParking))) return false;
            if (qLane && (!c.lane_id || !String(c.lane_id).includes(qLane))) return false;
            if (qPlate && (!c.plate_number || !String(c.plate_number).includes(qPlate))) return false;
            if (qDriver && (!c.driver_name || !c.driver_name.toLowerCase().includes(qDriver))) return false;
            if (qDuration && (!c.call_duration || !String(c.call_duration).includes(qDuration))) return false;
            if (qReason && (!c.request_summary || !c.request_summary.toLowerCase().includes(qReason))) return false;
            
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
    if (!tbody) return;
    tbody.innerHTML = '';
    
    currentCallsToShow.slice(0, currentRenderCount).forEach(c => {
        const dateStr = new Date(c.created_at).toLocaleString('he-IL');
        const status = c.is_forwarded === 'true' ? t('transferred_to_op') : t('handled_by_ai');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${getParkingNameById(c.parking_id)}</td>
            <td>${c.lane_id}</td>
            <td>${c.plate_number}</td>
            <td>${c.driver_name || '-'}</td>
            <td>${c.call_duration}s</td>
            <td>${c.request_summary}</td>
            <td>${status}</td>
        `;
        tbody.appendChild(tr);
    });
    
    let loadMoreContainer = document.getElementById('load-more-container');
    if (!loadMoreContainer) {
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.id = 'load-more-container';
        loadMoreContainer.style.textAlign = 'center';
        loadMoreContainer.style.padding = '15px';
        loadMoreContainer.style.display = 'flex';
        loadMoreContainer.style.justifyContent = 'center';
        loadMoreContainer.style.gap = '10px';
        
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.className = 'btn-secondary';
        loadMoreBtn.innerText = t('load_more') || 'הצג יותר';
        loadMoreBtn.onclick = () => {
            currentRenderCount += 20;
            renderTableRows();
        };
        
        const loadLessBtn = document.createElement('button');
        loadLessBtn.id = 'load-less-btn';
        loadLessBtn.className = 'btn-secondary';
        loadLessBtn.innerText = t('load_less') || 'הצג פחות';
        loadLessBtn.onclick = () => {
            currentRenderCount = Math.max(25, currentRenderCount - 20);
            renderTableRows();
        };
        
        loadMoreContainer.appendChild(loadMoreBtn);
        loadMoreContainer.appendChild(loadLessBtn);
        
        const tableWrapper = tbody.closest('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.appendChild(loadMoreContainer);
        }
    }
    
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadLessBtn = document.getElementById('load-less-btn');
    
    if (loadMoreBtn) {
        loadMoreBtn.style.display = currentRenderCount < currentCallsToShow.length ? 'inline-block' : 'none';
    }
    if (loadLessBtn) {
        loadLessBtn.style.display = currentRenderCount > 25 ? 'inline-block' : 'none';
    }
    
    if (loadMoreContainer) {
        if (currentRenderCount < currentCallsToShow.length || currentRenderCount > 25) {
            loadMoreContainer.style.display = 'flex';
        } else {
            loadMoreContainer.style.display = 'none';
        }
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

    smoothedCalls.forEach((count, hour) => {
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
        for (let i = 23; i >= 0; i--) {
            const d = new Date(latestDate.getTime() - i * 60 * 60 * 1000);
            const label = `${d.getHours()}:00`;
            buckets[label] = {ai: 0, op: 0};
            orderedLabels.push(label);
        }
        
        filteredCalls.forEach(c => {
            const d = new Date(c.created_at);
            if (latestDate - d <= 24 * 60 * 60 * 1000) {
                const label = `${d.getHours()}:00`;
                if (buckets[label]) {
                    if (c.is_forwarded === 'true') buckets[label].op++;
                    else buckets[label].ai++;
                }
            }
        });
    } else if (timeframe === '7d' || timeframe === '30d') {
        const daysCount = timeframe === '7d' ? 7 : 30;
        for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date(latestDate.getTime() - i * 24 * 60 * 60 * 1000);
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
        const monthsCount = timeframe === 'monthly' ? 12 : 9999;
        
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
        const startVal = document.getElementById('custom-graph-start-date')?.value;
        const endVal = document.getElementById('custom-graph-end-date')?.value;
        if (startVal && endVal) {
            const startD = new Date(startVal);
            startD.setHours(0, 0, 0, 0);
            const endD = new Date(endVal);
            endD.setHours(23, 59, 59, 999);
            
            const daysCount = Math.ceil((endD - startD) / (24 * 60 * 60 * 1000));
            if (daysCount > 0 && daysCount <= 100) {
                for (let i = 0; i < daysCount; i++) {
                    const d = new Date(startD.getTime() + i * 24 * 60 * 60 * 1000);
                    const label = `${d.getDate()}/${d.getMonth()+1}`;
                    buckets[label] = {ai: 0, op: 0};
                    orderedLabels.push(label);
                }
                
                filteredCalls.forEach(c => {
                    const d = new Date(c.created_at);
                    if (d >= startD && d <= endD) {
                        const label = `${d.getDate()}/${d.getMonth()+1}`;
                        if (buckets[label]) {
                            if (c.is_forwarded === 'true') buckets[label].op++;
                            else buckets[label].ai++;
                        }
                    }
                });
            }
        }
    }

    // Find max value to scale heights
    const maxCount = Math.max(...Object.values(buckets).map(b => b.ai + b.op), 1);
    
    // Draw bars
    orderedLabels.forEach(label => {
        const counts = buckets[label];
        const total = counts.ai + counts.op;
        const totalHeightPercent = (total / maxCount) * 100;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.innerText = `${total} סה"כ\nAI: ${counts.ai}\nמוקד: ${counts.op}`;
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
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

setInterval(() => {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const targetId = activeTab.getAttribute('data-target');
        if (targetId === 'tab-blocked') fetchAndRenderActionList('blocked');
        if (targetId === 'tab-authorized') fetchAndRenderActionList('authorized');
    }
}, 3000);

let cachedBlocked = [];
let cachedAuthorized = [];

async function fetchAndRenderActionList(type) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/${type}?v=` + Date.now());
        let data = await response.json();
        
        // Filter by permissions and selected parking
        data = filterDataByAllowedParkings(data);
        
        if (currentParkingId !== 'all') {
            data = data.filter(item => String(item.parking_id) === String(currentParkingId));
        }
        
        if (type === 'blocked') cachedBlocked = data;
        if (type === 'authorized') cachedAuthorized = data;
        
        renderActionList(type, data);
        renderOwnerActionList(type, data); // For manager dashboard
    } catch (err) {
        console.error(`Error fetching ${type} list:`, err);
    }
}

function renderActionList(type, data) {
    const listEl = document.getElementById(`${type}-list`);
    const searchInput = document.getElementById(`search-${type}`);
    if (!listEl) return;
    
    let filteredData = data;
    if (searchInput && searchInput.value) {
        const q = searchInput.value.toLowerCase();
        filteredData = data.filter(item => item.plate.toLowerCase().includes(q));
    }
    
    filteredData.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    
    listEl.innerHTML = '';
    filteredData.forEach(item => {
        const li = document.createElement('li');
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
        
        // Right side: Plate & Driver Name
        const rightDiv = document.createElement('div');
        rightDiv.style.flex = '1';
        rightDiv.style.textAlign = 'right';
        const driverNameStr = item.driver_name ? ` - ${item.driver_name}` : '';
        rightDiv.innerHTML = `<strong>${item.plate}</strong><span style="font-weight: normal; opacity: 0.9;">${driverNameStr}</span>`;
        
        // Middle side: Reason
        const middleDiv = document.createElement('div');
        middleDiv.style.flex = '1';
        middleDiv.style.textAlign = 'center';
        const reasonText = item.reason || item.action || '';
        middleDiv.innerHTML = `<span style="opacity: 0.8; font-size: 0.9rem;">${reasonText}</span>`;
        
        // Left side: Date & Time
        const leftDiv = document.createElement('div');
        leftDiv.style.flex = '1';
        leftDiv.style.textAlign = 'left';
        const dateObj = new Date(item.added_at);
        const dateStr = dateObj.toLocaleDateString('he-IL');
        const timeStr = dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
        leftDiv.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">${timeStr} ${dateStr}</span>`;
        
        li.appendChild(rightDiv);
        li.appendChild(middleDiv);
        li.appendChild(leftDiv);
        listEl.appendChild(li);
    });
}

// ----------------------------------------------------
// Manager Dashboard - List Logic
// ----------------------------------------------------
function renderOwnerActionList(type, data) {
    const listEl = document.getElementById(`owner-${type}-list`);
    if (!listEl) return;
    
    // Sort descending by date
    let sortedData = [...data].sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    
    listEl.innerHTML = '';
    if (sortedData.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; padding:10px; color:var(--text-muted);">אין רכבים מוגדרים</li>';
        return;
    }
    
    sortedData.forEach(item => {
        const li = document.createElement('li');
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
        
        const parkingName = getParkingNameById(item.parking_id) || 'כללי';
        const dateObj = new Date(item.added_at);
        const dateStr = dateObj.toLocaleDateString('he-IL') + ' ' + dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        
        let detailsStr = `<strong>${item.plate}</strong> | חניון: ${parkingName}`;
        if (item.driver_name) detailsStr += ` | נהג: ${item.driver_name}`;
        
        let notesStr = item.reason || item.action || '';
        if (notesStr) notesStr = `<span style="font-size: 0.85rem; color: var(--text-muted);">הערה: ${notesStr}</span>`;
        
        infoDiv.innerHTML = `
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
                    body: JSON.stringify({ plate_number: item.plate })
                });
                fetchAndRenderActionList(type); // Re-fetch
            }
        };
        
        actionDiv.appendChild(removeBtn);
        
        li.appendChild(infoDiv);
        li.appendChild(actionDiv);
        listEl.appendChild(li);
    });
}

function setupOwnerListForms() {
    ['blocked', 'authorized'].forEach(type => {
        const form = document.getElementById(`owner-add-${type}-form`);
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const payload = Object.fromEntries(formData.entries());
                
                try {
                    const res = await fetch(`${API_BASE_URL}/api/${type}/add`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    });
                    
                    if (res.ok) {
                        form.reset();
                        fetchAndRenderActionList(type);
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


function calculateAICosts(calls) {
    const displayEl = document.getElementById('ai-cost-display');
    const timeframeSelect = document.getElementById('stats-timeframe');
    
    if (!displayEl || !timeframeSelect) return;
    if (!calls || calls.length === 0) {
        displayEl.innerText = '0.00 ₪';
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
            
            if (!graphData[dayKey]) graphData[dayKey] = { freeCalls: 0, paidCalls: 0 };
            graphData[dayKey].freeCalls += consumedFreeCalls;
            if (isPaidCall) graphData[dayKey].paidCalls += 1;
        }
    });
    
    if (window.animateValue) {
        window.animateValue('ai-cost-display', totalCostInWindow, (val) => val.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' ₪');
    }
    if (displayEl) {
        displayEl.innerText = totalCostInWindow.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' ₪';
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
    
    renderAICostGraph(graphData);
    renderAICostList(aiCallsInWindow);
}

function renderAICostList(callsList) {
    const listEl = document.getElementById('ai-cost-calls-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    if (callsList.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 0.9rem;">אין שיחות לתקופה זו</li>';
        return;
    }
    
    callsList.forEach(item => {
        const c = item.call;
        const d = new Date(c.created_at);
        const timeStr = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('he-IL');
        
        let statusHtml = '';
        if (item.isForwarded) {
            statusHtml = '<span style="color: var(--accent-red); font-size: 0.85rem; font-weight: bold; padding: 2px 8px; background: rgba(242,54,69,0.1); border-radius: 12px;">נכשל (לקוח לא חויב)</span>';
        } else {
            const costText = item.cost > 0 ? `${item.cost.toFixed(2)} ₪` : '0 ₪';
            const chargedText = item.isPaidCall ? '(חויב)' : `(לא חויב ${item.currentQuotaCount}/100)`;
            statusHtml = `<span style="color: var(--accent-green); font-size: 0.85rem; font-weight: bold; padding: 2px 8px; background: rgba(48,209,88,0.1); border-radius: 12px;">שיחה הוצלחה ${chargedText} - ${item.duration} שנ' - ${costText}</span>`;
        }
        
        const plate = c.plate_number || 'לא ידוע';
        
        listEl.innerHTML += `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                    <span style="font-weight: bold; font-size: 1rem;">רכב: ${plate}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${timeStr} | ${dateStr}</span>
                </div>
                <div style="flex-shrink: 0; margin-right: 15px;">${statusHtml}</div>
            </li>
        `;
    });
}

function renderAICostGraph(graphData) {
    const container = document.getElementById('ai-cost-chart-container');
    if (!container) return;
    
    container.innerHTML = '';
    
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
    chartWrapper.style.padding = '10px 10px 25px 10px';
    chartWrapper.style.overflowX = 'auto';
    chartWrapper.style.width = '100%';
    
    days.forEach(day => {
        const data = graphData[day];
        
        const col = document.createElement('div');
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.alignItems = 'center';
        col.style.flex = '0 0 auto';
        col.style.minWidth = '30px';
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
        
        const [y, m, d] = day.split('-');
        
        const tooltip = document.createElement('div');
        tooltip.innerHTML = `<strong>${d}/${m}</strong><br/>במכסה: ${data.freeCalls}<br/>שיחות AI: ${data.paidCalls}`;
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
        label.innerText = `${d}/${m}`;
        label.style.fontSize = '0.75rem';
        label.style.color = 'var(--text-muted)';
        label.style.position = 'absolute';
        label.style.bottom = '-22px';
        label.style.whiteSpace = 'nowrap';
        
        col.appendChild(barsContainer);
        col.appendChild(label);
        
        chartWrapper.appendChild(col);
    });
    
    container.appendChild(chartWrapper);
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
} else if (!document.getElementById('admin-dashboard-marker')) {
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

    let roleNavContainer = document.getElementById('role-nav-buttons');
    if (roleNavContainer && (role === 'owner' || role === 'manager' || role === 'admin')) {
        roleNavContainer.style.display = 'flex';
        roleNavContainer.style.background = 'rgba(0,0,0,0.2)';
        roleNavContainer.style.padding = '4px 8px';
        roleNavContainer.style.borderRadius = '8px';
        roleNavContainer.style.border = '1px solid rgba(255,255,255,0.1)';
        
        const isOwner = path.includes('owner_dashboard');
        const isAdmin = path.includes('admin_dashboard');
        const isOperator = (!isOwner && !isAdmin);

        const btnAdmin = document.getElementById('nav-admin-btn');
        const btnManager = document.getElementById('nav-manager-btn');
        const btnOperator = document.getElementById('nav-operator-btn');

        if (role === 'admin') {
            if (!isAdmin && btnAdmin) { btnAdmin.style.display = 'inline-block'; btnAdmin.style.background = 'var(--accent-blue)'; }
            if (!isOwner && btnManager) { btnManager.style.display = 'inline-block'; btnManager.style.background = 'var(--accent-blue)'; }
            if (!isOperator && btnOperator) { btnOperator.style.display = 'inline-block'; btnOperator.style.background = 'var(--accent-blue)'; }
        } else if (role === 'manager' || role === 'owner') {
            if (!isOwner && btnManager) { btnManager.style.display = 'inline-block'; btnManager.style.background = 'var(--accent-blue)'; }
            if (!isOperator && btnOperator) { btnOperator.style.display = 'inline-block'; btnOperator.style.background = 'var(--accent-blue)'; }
        }
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
        // Simple extraction based on the rendered HTML structure
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

