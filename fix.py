import re

with open('owner_dashboard.html', 'rb') as f:
    content = f.read().decode('utf-8', errors='ignore')

# Find where the corruption starts:
# It starts around: "נתונים אלו נשמרים תחת נהלי אבטחה קפדניים"
target_start = "נתונים אלו נשמרים תחת נהלי אבטחה קפדניים"

idx = content.find(target_start)
if idx != -1:
    good_content = content[:idx]
    
    rest = """נתונים אלו נשמרים תחת נהלי אבטחה קפדניים ומשמשים אך ורק לצורך תפעול ובקרת החניון, ניתוח נתונים סטטיסטיים, ושיפור השירות.</p>
                    </div>
                    <div id="legal-software" class="legal-section">
                        <h3>מדיניות התוכנה (Software & Security Policy)</h3>
                        <p>כל זכויות הקניין הרוחני במערכת, לרבות קוד המקור, העיצוב, והלוגיקה, שייכות במלואן ל-<strong>HINT LTD</strong>.</p>
                        <p>חל איסור מוחלט לבצע הנדסה לאחור (Reverse Engineering), להעתיק, לשכפל, או לעשות שימוש מסחרי בקוד המערכת או בחלקים ממנה ללא אישור מפורש בכתב מ-HINT LTD.</p>
                        <p><strong>אבטחת מידע ואיפוס סיסמאות:</strong> מטעמי אבטחת מידע קפדניים, פעולות רגישות כגון איפוס סיסמה או מחיקת משתמשים יכולות להתבצע אך ורק על ידי מנהלי מערכת מורשים מטעם HINT LTD.</p>
                    </div>
                    <div id="legal-accessibility" class="legal-section">
                        <h3>הצהרת נגישות (Accessibility Statement)</h3>
                        <p>אנו רואים חשיבות רבה במתן שירות שוויוני ונגיש לכלל המשתמשים. המערכת תוכננה מראש לספק חווית שימוש נוחה ומונגשת, וכוללת בין היתר את ההתאמות הבאות:</p>
                        <ul>
                            <li><strong>התאמת תצוגה:</strong> תמיכה בשינוי רקע המערכת מכהה לבהיר (Dark/Light mode) לפי העדפת המשתמש.</li>
                            <li><strong>קריאות וטקסט:</strong> תמיכה בהגדלה והקטנה של המלל בדפדפן ללא פגיעה במבנה האתר.</li>
                            <li><strong>ריבוי שפות:</strong> תמיכה מובנית בשפות שונות להתמצאות נוחה בממשק.</li>
                            <li><strong>חיווי קולי למוקד:</strong> צליל התראה בכניסת שיחה חדשה במוקד, המנגיש את חיווי השיחות גם ללא קשר עין רציף עם המסך.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="translations.js?v=1.1.23"></script>
    <script src="app.js?v=1.1.23"></script>
    <script>
        if (sessionStorage.getItem('intercom_user_role') === 'admin') {
            const adminBtn = document.getElementById('nav-admin-btn');
            if (adminBtn) adminBtn.style.display = 'inline-block';
        }
    </script>
</body>
</html>"""
    
    new_content = good_content + rest
    with open('owner_dashboard.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed owner_dashboard.html")
else:
    print("Could not find the target string.")

