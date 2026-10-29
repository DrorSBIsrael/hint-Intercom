import io
import os
import re
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# =====================================================================
# Font Registration (Windows + Linux/Render + Fallback)
# =====================================================================
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
_FONTS_INITIALIZED = False


def ensure_hebrew_fonts():
    global FONT_REGULAR, FONT_BOLD, _FONTS_INITIALIZED
    if _FONTS_INITIALIZED:
        return FONT_REGULAR, FONT_BOLD

    candidates = [
        # Windows
        ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
        ("C:/Windows/Fonts/tahoma.ttf", "C:/Windows/Fonts/tahomabd.ttf"),
        # Linux (Debian/Ubuntu on Render)
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
        (
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        ),
        (
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ),
    ]

    for reg_path, bold_path in candidates:
        if os.path.exists(reg_path):
            try:
                pdfmetrics.registerFont(TTFont("HebFont", reg_path))
                if os.path.exists(bold_path):
                    pdfmetrics.registerFont(TTFont("HebFont-Bold", bold_path))
                else:
                    pdfmetrics.registerFont(TTFont("HebFont-Bold", reg_path))
                FONT_REGULAR = "HebFont"
                FONT_BOLD = "HebFont-Bold"
                _FONTS_INITIALIZED = True
                return FONT_REGULAR, FONT_BOLD
            except Exception as e:
                print(f"⚠️ Failed registering font {reg_path}: {e}")

    # Fallback: download Rubik TTF into /tmp if no system Hebrew font exists
    try:
        import urllib.request

        tmp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_fonts")
        os.makedirs(tmp_dir, exist_ok=True)
        reg_file = os.path.join(tmp_dir, "DejaVuSans.ttf")
        if not os.path.exists(reg_file):
            url = "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf"
            urllib.request.urlretrieve(url, reg_file)
        pdfmetrics.registerFont(TTFont("HebFont", reg_file))
        pdfmetrics.registerFont(TTFont("HebFont-Bold", reg_file))
        FONT_REGULAR = "HebFont"
        FONT_BOLD = "HebFont-Bold"
        _FONTS_INITIALIZED = True
    except Exception as e:
        print(f"⚠️ Could not load fallback Hebrew font: {e}")

    return FONT_REGULAR, FONT_BOLD


# =====================================================================
# Pure-Python Hebrew BiDi Visual Ordering Helper for ReportLab
# =====================================================================
_HEB_RANGE = re.compile(r"[\u0590-\u05FF]")
_NIQQUD_RE = re.compile(r"[\u0591-\u05C7]")
_MIRROR_MAP = str.maketrans("()[]{}", ")(][}{")


def strip_niqqud(text: str) -> str:
    return _NIQQUD_RE.sub("", text)


def bidi_visual(text: str) -> str:
    """
    Converts logical RTL Hebrew strings (mixed with numbers/English/punctuation)
    into visual LTR order suitable for ReportLab rendering.
    """
    if text is None:
        return ""
    s = strip_niqqud(str(text)).strip()
    if not s or not _HEB_RANGE.search(s):
        return s

    # Try python-bidi if available
    try:
        from bidi.algorithm import get_display

        return get_display(s)
    except ImportError:
        pass

    # Pure-Python RTL visual converter for mixed Hebrew + LTR tokens
    lines = s.split("\n")
    visual_lines = []
    # Tokenize into runs: Hebrew words, LTR runs (numbers/Latin/dates/currencies), or spaces/punctuation
    token_re = re.compile(
        r"([\u0590-\u05FF]+(?:[\"'״׳][\u0590-\u05FF]+)*|[A-Za-z0-9]+(?:[./:\-_][A-Za-z0-9]+)*|\s+|[^\s\u0590-\u05FFA-Za-z0-9]+)"
    )

    swap_brackets = str.maketrans("()[]{}", ")(][}{")

    for line in lines:
        if not _HEB_RANGE.search(line):
            visual_lines.append(line)
            continue

        tokens = token_re.findall(line)
        processed_tokens = []
        for tok in tokens:
            if _HEB_RANGE.search(tok):
                # Reverse characters inside a Hebrew word
                processed_tokens.append(tok[::-1])
            elif tok.isspace():
                processed_tokens.append(tok)
            elif re.match(r"^[A-Za-z0-9]", tok):
                # Keep LTR numbers / Latin words intact
                processed_tokens.append(tok)
            else:
                # Mirror parentheses/brackets in RTL context
                processed_tokens.append(tok[::-1].translate(swap_brackets))

        # Reverse token order for RTL line direction
        visual_lines.append("".join(reversed(processed_tokens)))

    return "\n".join(visual_lines)


def get_israel_now():
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("Asia/Jerusalem")
    except ImportError:
        import pytz

        tz = pytz.timezone("Asia/Jerusalem")
    return datetime.now(tz)


def parse_call_israel_dt(dt_str):
    """
    Parses created_at from calls_log into Israel local datetime (naive for easy date/time math).
    """
    if not dt_str:
        return None
    s = str(dt_str).strip()
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            # Note: some records in calls_log are stored with +00:00 even though they were generated in Israel time or UTC.
            # Let's check offset: if tzinfo is UTC, convert or strip consistently with frontend new Date(c.created_at)
            try:
                from zoneinfo import ZoneInfo

                tz = ZoneInfo("Asia/Jerusalem")
            except ImportError:
                import pytz

                tz = pytz.timezone("Asia/Jerusalem")
            dt = dt.astimezone(tz).replace(tzinfo=None)
        return dt
    except Exception:
        try:
            return datetime.strptime(s[:19].replace("T", " "), "%Y-%m-%d %H:%M:%S")
        except Exception:
            return None


def classify_lane_group(lane_id) -> str:
    """
    1XX -> 'entry' (כניסות ראשיות)
    2XX -> 'exit' (יציאות ראשיות)
    3XX -> 'internal' (חניון פנימי)
    """
    s = str(lane_id or "").strip()
    if s.startswith("1"):
        return "entry"
    elif s.startswith("2"):
        return "exit"
    elif s.startswith("3"):
        return "internal"
    return "other"


def classify_operator_call(call_row) -> str:
    req = strip_niqqud(str(call_row.get("request_summary") or "")).strip()
    act = strip_niqqud(str(call_row.get("actions_taken") or "")).strip()
    combined = f"{req} | {act}"

    if "20 שניות" in combined or "שיחה חוזרת" in combined:
        return "לחיצה חוזרת תוך 20 שניות (לקוח בלחץ)"
    if "לחיצות מרובות" in combined:
        return "לחיצות מרובות באינטרקום (לקוח בלחץ)"
    if (
        "כשל בקבלת מספר רכב" in combined
        or "נכשל זיהוי" in combined
        or "2201" in combined
        or "אין זיהוי LPR" in combined
        or "לא היה זיהוי" in combined
    ):
        return "לא היה זיהוי / כשל בקבלת מספר רכב"
    if "חשד לרמאות" in combined or "אי התאמה למצלמה" in combined:
        return "חשד לרמאות - אי התאמה למצלמה"
    if "בקשת מוקד אנושי מפורשת" in combined:
        return "בקשת מוקד אנושי מפורשת ע\"י נהג"
    if "2011" in combined or "יציאה כפולה" in combined:
        return "סירוב (2011) - יציאה כפולה"
    if "3017" in combined or "2004" in combined or "חסר הרשאות" in combined:
        return "חסר הרשאות כניסה/יציאה (2004/3017)"
    if "אורח מסעדה" in combined:
        return "תרחיש אורח מסעדה שהועבר למוקד"
    if "רכב חליפי" in combined:
        return "תרחיש רכב חליפי שהועבר למוקד"
    if "לא זמינה" in combined or "שגיאה מהחניון" in combined:
        return "מערכת חניון לא זמינה / שגיאת תקשורת"
    if req:
        # Clean out plate/name details in parentheses for grouping
        cleaned = re.sub(r"\s*\(לוחית:.*?\)", "", req).strip()
        return cleaned[:45] if cleaned else "העברה למוקד אנושי (כללי)"
    return "העברה למוקד אנושי (כללי)"


def classify_ai_call(call_row) -> str:
    req = strip_niqqud(str(call_row.get("request_summary") or "")).strip()
    act = strip_niqqud(str(call_row.get("actions_taken") or "")).strip()
    combined = f"{req} | {act}"

    if (
        "חיוב תשלום" in combined
        or "נשלח לחשבון" in combined
        or "נשלח לתשלום" in combined
        or "2002" in combined
    ):
        return "נשלח מחיר / חיוב תשלום ביציאה"
    if "אורח מסעדה" in combined:
        return "טופל תרחיש אורח מסעדה"
    if "כניסה כפולה" in combined:
        return "זיהוי כניסה כפולה - רכב כבר בחניון"
    if "נפתח מחסום" in combined or "פתיחת מחסום" in combined:
        return "נפתח מחסום"
    if (
        "חניון מלא" in combined
        or "מעבר לא מורשה" in combined
        or "מנוי לא מורשה" in combined
        or "מנוי לא בתוקף" in combined
    ):
        return "חניון מלא / מנוי או מעבר לא מורשה"
    if "רכב לא מוכר במערכת" in combined:
        return "רכב לא מוכר במערכת"
    if req:
        cleaned = re.sub(r"\s*\(לוחית:.*?\)", "", req).strip()
        return cleaned[:45] if cleaned else "טופל ע\"י AI (כללי)"
    return "טופל ע\"י AI (כללי)"


def is_plate_corrected_in_call(call_row) -> bool:
    val = call_row.get("is_plate_corrected")
    if val is True or str(val).lower() == "true":
        return True
    act = str(call_row.get("actions_taken") or "")
    if "לקוח הכתיב מספר רכב" in act:
        return True
    return False


# =====================================================================
# Billing & Aggregation Logic
# =====================================================================
def compute_calls_with_costs(calls, rate_per_minute: float):
    """
    Applies the exact 5-minute vehicle grouping and per-second billing rules:
    - AI call (!is_forwarded): cost = duration_sec * (rate_per_minute / 60)
    - Operator call (is_forwarded):
      - If grouped within 5 minutes with an AI call for the same plate: 0 NIS
      - If standalone (no AI call in 5-min group): first call is 50% (duration_sec * rate_per_sec * 0.5), repeat within 5m is 0 NIS
    """
    rate_per_sec = float(rate_per_minute or 2.20) / 60.0

    # Parse datetimes and sort chronologically
    parsed_calls = []
    for c in calls:
        dt = parse_call_israel_dt(c.get("created_at"))
        if dt is not None:
            c_copy = dict(c)
            c_copy["_dt"] = dt
            parsed_calls.append(c_copy)

    parsed_calls.sort(key=lambda x: x["_dt"])

    vehicle_groups = []
    plate_group_map = {}

    for c in parsed_calls:
        plate = str(c.get("plate_number") or "").strip()
        # Treat "לא ידוע" or empty plate as ungrouped individual call
        has_valid_plate = bool(plate and plate != "לא ידוע")
        call_ts = c["_dt"].timestamp()
        duration_sec = int(c.get("call_duration") or 0)
        is_fwd = str(c.get("is_forwarded", "")).lower() == "true" or c.get("is_forwarded") is True

        found_idx = None
        if has_valid_plate and plate in plate_group_map:
            gi = plate_group_map[plate]
            if (call_ts - vehicle_groups[gi]["last_ts"]) <= 5 * 60:
                found_idx = gi

        if found_idx is not None:
            vg = vehicle_groups[found_idx]
            vg["calls"].append(c)
            vg["last_ts"] = max(vg["last_ts"], call_ts)
            if not is_fwd:
                vg["has_ai"] = True
            else:
                vg["has_fwd"] = True
        else:
            idx = len(vehicle_groups)
            vehicle_groups.append(
                {
                    "plate": plate,
                    "calls": [c],
                    "last_ts": call_ts,
                    "has_ai": not is_fwd,
                    "has_fwd": is_fwd,
                }
            )
            if has_valid_plate:
                plate_group_map[plate] = idx

    enriched_calls = []
    for vg in vehicle_groups:
        only_forwarded = vg["has_fwd"] and not vg["has_ai"]
        first_fwd_charged = False
        for c in vg["calls"]:
            is_fwd = str(c.get("is_forwarded", "")).lower() == "true" or c.get("is_forwarded") is True
            duration_sec = int(c.get("call_duration") or 0)
            if not is_fwd:
                cost = duration_sec * rate_per_sec
            elif only_forwarded and not first_fwd_charged:
                cost = duration_sec * rate_per_sec * 0.5
                first_fwd_charged = True
            else:
                cost = 0.0

            c["_is_fwd"] = is_fwd
            c["_duration_sec"] = duration_sec
            c["_cost"] = cost
            enriched_calls.append(c)

    enriched_calls.sort(key=lambda x: x["_dt"])
    return enriched_calls


def summarize_breakdown(enriched_calls):
    """
    Builds detailed breakdown dictionaries for Operator calls and AI calls,
    split by lane category (1XX entry, 2XX exit, 3XX internal).
    """
    op_rows = {}
    ai_rows = {}

    total_op = 0
    total_ai = 0
    ai_plate_corrected = {"entry": 0, "exit": 0, "internal": 0, "other": 0, "total": 0}

    for c in enriched_calls:
        lane_grp = classify_lane_group(c.get("lane_id"))
        if c["_is_fwd"]:
            total_op += 1
            cat = classify_operator_call(c)
            if cat not in op_rows:
                op_rows[cat] = {"entry": 0, "exit": 0, "internal": 0, "other": 0, "total": 0}
            op_rows[cat][lane_grp] += 1
            op_rows[cat]["total"] += 1
        else:
            total_ai += 1
            cat = classify_ai_call(c)
            if cat not in ai_rows:
                ai_rows[cat] = {"entry": 0, "exit": 0, "internal": 0, "other": 0, "total": 0}
            ai_rows[cat][lane_grp] += 1
            ai_rows[cat]["total"] += 1

            if is_plate_corrected_in_call(c):
                ai_plate_corrected[lane_grp] += 1
                ai_plate_corrected["total"] += 1

    return {
        "total_op": total_op,
        "total_ai": total_ai,
        "op_rows": op_rows,
        "ai_rows": ai_rows,
        "ai_plate_corrected": ai_plate_corrected,
    }


def format_sec_short(sec: int) -> str:
    sec = int(sec or 0)
    m = sec // 60
    s = sec % 60
    if m == 0:
        return f"{s} שנ'"
    return f"{m}:{s:02d} דק'"


# =====================================================================
# PDF Builder (2 Pages)
# =====================================================================
def generate_parking_report_pdf(
    parking_id: str,
    parking_name: str,
    rate_per_minute: float,
    calls_in_month: list,
    report_date: datetime,
    is_monthly_summary: bool = False,
) -> bytes:
    """
    Generates the 2-page PDF report:
    - Page 1: Header + Cumulative daily table from the 1st of the target month up to yesterday (or full previous month on the 1st).
    - Page 2: Detailed Manager Summary for Yesterday (and full month summary if is_monthly_summary=True),
      with breakdown of Operator calls and AI calls separated by 1XX (Entries), 2XX (Exits), and 3XX (Internal).
    """
    font_reg, font_bold = ensure_hebrew_fonts()

    # Determine target month range and "yesterday" date
    yesterday_date = (report_date - timedelta(days=1)).date()
    if is_monthly_summary:
        # Summarize the entire month of yesterday_date
        month_start_date = yesterday_date.replace(day=1)
        month_end_date = yesterday_date
    else:
        month_start_date = yesterday_date.replace(day=1)
        month_end_date = yesterday_date

    enriched = compute_calls_with_costs(calls_in_month, rate_per_minute)

    # Filter calls within [month_start_date, month_end_date]
    month_calls = [
        c for c in enriched if month_start_date <= c["_dt"].date() <= month_end_date
    ]
    yesterday_calls = [c for c in month_calls if c["_dt"].date() == yesterday_date]

    # Group by day for Page 1
    daily_stats = {}
    curr_d = month_start_date
    while curr_d <= month_end_date:
        daily_stats[curr_d] = {
            "ai_count": 0,
            "ai_sec": 0,
            "ai_cost": 0.0,
            "op_count": 0,
            "op_sec": 0,
            "op_cost": 0.0,
        }
        curr_d += timedelta(days=1)

    for c in month_calls:
        d_key = c["_dt"].date()
        if d_key not in daily_stats:
            continue
        st = daily_stats[d_key]
        if c["_is_fwd"]:
            st["op_count"] += 1
            st["op_sec"] += c["_duration_sec"]
            st["op_cost"] += c["_cost"]
        else:
            st["ai_count"] += 1
            st["ai_sec"] += c["_duration_sec"]
            st["ai_cost"] += c["_cost"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=28,
        leftMargin=28,
        topMargin=28,
        bottomMargin=28,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "HebTitle",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=15,
        leading=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "HebSubtitle",
        parent=styles["Normal"],
        fontName=font_reg,
        fontSize=11,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#334155"),
    )
    section_style = ParagraphStyle(
        "HebSection",
        parent=styles["Normal"],
        fontName=font_bold,
        fontSize=12,
        leading=16,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#1e3a8a"),
    )
    body_right_style = ParagraphStyle(
        "HebBodyRight",
        parent=styles["Normal"],
        fontName=font_reg,
        fontSize=9.5,
        leading=13,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#1e293b"),
    )

    story = []

    # =================================================================
    # PAGE 1: Cumulative Daily Cost & Calls Table
    # =================================================================
    report_date_str = report_date.strftime("%d/%m/%Y")
    yesterday_str = yesterday_date.strftime("%d/%m/%Y")
    month_label = yesterday_date.strftime("%m/%Y")

    header_title = (
        f"דוח סיכום חודשי למערכת אינטרקום מבית הינט - לחניון {parking_name}"
        if is_monthly_summary
        else f"דוח פעולות יומי למערכת אינטרקום מבית הינט - לחניון {parking_name}"
    )

    story.append(Paragraph(bidi_visual(header_title), title_style))
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            bidi_visual(
                f"תאריך הדוח: {report_date_str} | קוד חניון: {parking_id} | חודש פעילות: {month_label} | תעריף דקה: {rate_per_minute:.2f} ₪"
            ),
            subtitle_style,
        )
    )
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1")))
    story.append(Spacer(1, 10))

    page1_sec_title = (
        f"ריכוז יומי מצטבר לחודש {month_label} (מיום 01/{month_label} ועד {yesterday_str})"
    )
    story.append(Paragraph(bidi_visual(page1_sec_title), section_style))
    story.append(Spacer(1, 8))

    # RTL Table columns (Right-to-Left means column 0 is leftmost, last column is rightmost!)
    # So from Left to Right:
    # [סה"כ עלות (₪), סה"כ שיחות, עלות מוקד (₪), שיחות מוקד, עלות AI (₪), שיחות AI, תאריך]
    p1_headers = [
        bidi_visual('סה"כ עלות (₪)'),
        bidi_visual('סה"כ שיחות'),
        bidi_visual("עלות מוקד (₪)"),
        bidi_visual("שיחות מוקד"),
        bidi_visual("עלות AI (₪)"),
        bidi_visual("שיחות AI"),
        bidi_visual("תאריך"),
    ]
    p1_data = [p1_headers]

    tot_ai_calls = 0
    tot_ai_sec = 0
    tot_ai_cost = 0.0
    tot_op_calls = 0
    tot_op_sec = 0
    tot_op_cost = 0.0

    for d_key in sorted(daily_stats.keys()):
        st = daily_stats[d_key]
        day_total_calls = st["ai_count"] + st["op_count"]
        day_total_cost = st["ai_cost"] + st["op_cost"]

        tot_ai_calls += st["ai_count"]
        tot_ai_sec += st["ai_sec"]
        tot_ai_cost += st["ai_cost"]
        tot_op_calls += st["op_count"]
        tot_op_sec += st["op_sec"]
        tot_op_cost += st["op_cost"]

        p1_data.append(
            [
                f"{day_total_cost:.2f} ₪",
                str(day_total_calls),
                f"{st['op_cost']:.2f} ₪",
                bidi_visual(f"{st['op_count']} ({format_sec_short(st['op_sec'])})"),
                f"{st['ai_cost']:.2f} ₪",
                bidi_visual(f"{st['ai_count']} ({format_sec_short(st['ai_sec'])})"),
                d_key.strftime("%d/%m/%Y"),
            ]
        )

    grand_total_calls = tot_ai_calls + tot_op_calls
    grand_total_cost = tot_ai_cost + tot_op_cost

    p1_data.append(
        [
            f"{grand_total_cost:.2f} ₪",
            str(grand_total_calls),
            f"{tot_op_cost:.2f} ₪",
            bidi_visual(f"{tot_op_calls} ({format_sec_short(tot_op_sec)})"),
            f"{tot_ai_cost:.2f} ₪",
            bidi_visual(f"{tot_ai_calls} ({format_sec_short(tot_ai_sec)})"),
            bidi_visual('סה"כ מצטבר'),
        ]
    )

    row_pad = 2.8 if len(daily_stats) >= 27 else 4
    font_sz_p1 = 8.0 if len(daily_stats) >= 27 else 8.5
    col_widths_p1 = [72, 55, 72, 95, 72, 95, 75]
    t1 = Table(p1_data, colWidths=col_widths_p1, repeatRows=1)
    t1_style = [
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("FONTNAME", (0, 1), (-1, -2), font_reg),
        ("FONTNAME", (0, -1), (-1, -1), font_bold),
        ("FONTSIZE", (0, 0), (-1, -1), font_sz_p1),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbeafe")),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#0f172a")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), row_pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), row_pad),
    ]
    for r_idx in range(1, len(p1_data) - 1):
        if r_idx % 2 == 0:
            t1_style.append(
                ("BACKGROUND", (0, r_idx), (-1, r_idx), colors.HexColor("#f8fafc"))
            )
    t1.setStyle(TableStyle(t1_style))
    story.append(t1)

    # =================================================================
    # PAGE 2: Manager Daily Summary (Yesterday) + Optional Monthly Summary
    # =================================================================
    story.append(PageBreak())

    story.append(Paragraph(bidi_visual(header_title), title_style))
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            bidi_visual(
                f"סיכום מנהלים מפורט - חניון {parking_name} ({parking_id}) | תאריך הדוח: {report_date_str}"
            ),
            subtitle_style,
        )
    )
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1")))
    story.append(Spacer(1, 8))

    def build_summary_section(section_label: str, calls_subset: list):
        bd = summarize_breakdown(calls_subset)
        total_calls_sub = bd["total_op"] + bd["total_ai"]

        story.append(Paragraph(bidi_visual(section_label), section_style))
        story.append(Spacer(1, 4))
        story.append(
            Paragraph(
                bidi_visual(
                    f'סה"כ שיחות בתקופה זו: {total_calls_sub} | שיחות שטופלו ע"י AI: {bd["total_ai"]} | שיחות שעברו למוקד: {bd["total_op"]}'
                ),
                body_right_style,
            )
        )
        story.append(Spacer(1, 6))

        # --- Table A: Operator Calls Breakdown ---
        # Columns LTR: [סה"כ, חניון פנימי (3XX), יציאות ראשיות (2XX), כניסות ראשיות (1XX), פירוט שיחות שעברו למוקד אנושי]
        op_headers = [
            bidi_visual('סה"כ'),
            bidi_visual("חניון פנימי (3XX)"),
            bidi_visual("יציאות (2XX)"),
            bidi_visual("כניסות (1XX)"),
            bidi_visual("סיווג שיחות שעברו למוקד אנושי"),
        ]
        op_table_data = [op_headers]

        sorted_op = sorted(
            bd["op_rows"].items(), key=lambda kv: kv[1]["total"], reverse=True
        )
        if not sorted_op:
            op_table_data.append(
                [
                    "0",
                    "0",
                    "0",
                    "0",
                    bidi_visual("אין שיחות שעברו למוקד בתקופה זו"),
                ]
            )
        else:
            sum_e = sum_x = sum_i = 0
            for cat_name, counts in sorted_op:
                sum_e += counts["entry"]
                sum_x += counts["exit"]
                sum_i += counts["internal"]
                op_table_data.append(
                    [
                        str(counts["total"]),
                        str(counts["internal"]),
                        str(counts["exit"]),
                        str(counts["entry"]),
                        bidi_visual(cat_name),
                    ]
                )
            op_table_data.append(
                [
                    str(bd["total_op"]),
                    str(sum_i),
                    str(sum_x),
                    str(sum_e),
                    bidi_visual('סה"כ שיחות שעברו למוקד'),
                ]
            )

        t_op = Table(op_table_data, colWidths=[55, 85, 80, 80, 236], repeatRows=1)
        t_op_style = [
            ("FONTNAME", (0, 0), (-1, 0), font_bold),
            ("FONTNAME", (0, 1), (-1, -1), font_reg),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1d4ed8")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-2, -1), "CENTER"),
            ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if sorted_op:
            t_op_style.append(("FONTNAME", (0, -1), (-1, -1), font_bold))
            t_op_style.append(
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eff6ff"))
            )
        t_op.setStyle(TableStyle(t_op_style))
        story.append(t_op)
        story.append(Spacer(1, 10))

        # --- Table B: AI Calls Breakdown ---
        ai_headers = [
            bidi_visual('סה"כ'),
            bidi_visual("חניון פנימי (3XX)"),
            bidi_visual("יציאות (2XX)"),
            bidi_visual("כניסות (1XX)"),
            bidi_visual("סיווג עבודת ה-AI (שיחות שטופלו ע\"י AI)"),
        ]
        ai_table_data = [ai_headers]

        sorted_ai = sorted(
            bd["ai_rows"].items(), key=lambda kv: kv[1]["total"], reverse=True
        )
        if not sorted_ai:
            ai_table_data.append(
                [
                    "0",
                    "0",
                    "0",
                    "0",
                    bidi_visual("אין שיחות AI בתקופה זו"),
                ]
            )
        else:
            sum_e = sum_x = sum_i = 0
            for cat_name, counts in sorted_ai:
                sum_e += counts["entry"]
                sum_x += counts["exit"]
                sum_i += counts["internal"]
                ai_table_data.append(
                    [
                        str(counts["total"]),
                        str(counts["internal"]),
                        str(counts["exit"]),
                        str(counts["entry"]),
                        bidi_visual(cat_name),
                    ]
                )
            # Add special row highlighting plate corrections performed by AI
            pc = bd["ai_plate_corrected"]
            ai_table_data.append(
                [
                    str(pc["total"]),
                    str(pc["internal"]),
                    str(pc["exit"]),
                    str(pc["entry"]),
                    bidi_visual("* מתוכן: שיחות שבהן תוקן מספר לוחית ע\"י ה-AI"),
                ]
            )
            ai_table_data.append(
                [
                    str(bd["total_ai"]),
                    str(sum_i),
                    str(sum_x),
                    str(sum_e),
                    bidi_visual('סה"כ שיחות שטופלו ע"י AI'),
                ]
            )

        t_ai = Table(ai_table_data, colWidths=[55, 85, 80, 80, 236], repeatRows=1)
        t_ai_style = [
            ("FONTNAME", (0, 0), (-1, 0), font_bold),
            ("FONTNAME", (0, 1), (-1, -1), font_reg),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#15803d")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-2, -1), "CENTER"),
            ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if sorted_ai:
            # Highlight plate correction row in soft amber/green and total row in bold green
            t_ai_style.append(
                ("BACKGROUND", (0, -2), (-1, -2), colors.HexColor("#fefce8"))
            )
            t_ai_style.append(("FONTNAME", (0, -1), (-1, -1), font_bold))
            t_ai_style.append(
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dcfce7"))
            )
        t_ai.setStyle(TableStyle(t_ai_style))
        story.append(t_ai)

    # 1. Always render Yesterday's summary on Page 2
    build_summary_section(
        f"סיכום מנהלים יומי - אתמול ({yesterday_str})", yesterday_calls
    )

    # 2. If 1st of the month (is_monthly_summary), also render the Full Month Summary below it on Page 2
    if is_monthly_summary:
        story.append(Spacer(1, 14))
        story.append(
            HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"))
        )
        story.append(Spacer(1, 10))
        build_summary_section(
            f"סיכום מנהלים חודשי מצטבר - כל חודש {month_label}", month_calls
        )

    doc.build(story)
    return buf.getvalue()


# =====================================================================
# Email Dispatcher & Supabase Data Fetcher
# =====================================================================
def send_pdf_email(
    recipients: list,
    subject: str,
    body_text: str,
    pdf_bytes: bytes,
    filename: str,
):
    email_user = os.getenv("EMAIL_HOST_USER", "").strip()
    email_pass = os.getenv("EMAIL_HOST_PASSWORD", "").strip()
    email_host = os.getenv("EMAIL_HOST", "smtp.gmail.com").strip()
    email_port = int(os.getenv("EMAIL_PORT", "587"))

    if not email_user or not email_pass:
        raise RuntimeError(
            "חסרים משתני סביבה EMAIL_HOST_USER או EMAIL_HOST_PASSWORD בשרת."
        )

    clean_recipients = [r.strip() for r in recipients if r and "@" in str(r)]
    if not clean_recipients:
        raise RuntimeError("לא נמצאו כתובות מייל תקינות לשליחה.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = email_user
    msg["To"] = ", ".join(clean_recipients)
    msg.set_content(body_text)
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=filename,
    )

    try:
        with smtplib.SMTP(email_host, email_port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(email_user, email_pass)
            server.send_message(msg)
    except Exception:
        # Fallback to SSL on port 465
        with smtplib.SMTP_SSL(email_host, 465, timeout=30) as server:
            server.login(email_user, email_pass)
            server.send_message(msg)


def fetch_calls_for_parking_month(supabase_client, parking_id: str, start_dt: datetime, end_dt: datetime):
    start_iso = start_dt.strftime("%Y-%m-%dT00:00:00")
    end_iso = (end_dt + timedelta(days=1)).strftime("%Y-%m-%dT23:59:59")

    all_rows = []
    offset = 0
    step = 1000
    while True:
        res = (
            supabase_client.table("calls_log")
            .select("*")
            .eq("parking_id", str(parking_id))
            .gte("created_at", start_iso)
            .lte("created_at", end_iso)
            .order("created_at", desc=False)
            .range(offset, offset + step - 1)
            .execute()
        )
        rows = res.data or []
        all_rows.extend(rows)
        if len(rows) < step:
            break
        offset += step
    return all_rows


def generate_and_send_reports(
    supabase_client,
    target_parking_id: str = None,
    override_email: str = None,
    force_monthly: bool = None,
    send_email: bool = True,
):
    """
    Fetches users and parking configurations from Supabase, builds the 2-page PDF report
    for each parking_id that has an email (or target_parking_id if specified),
    and sends it via SMTP.
    Returns a list of result dicts (including pdf_bytes when requested).
    """
    if not supabase_client:
        raise RuntimeError("Supabase client is not initialized")

    now_il = get_israel_now()
    is_first_of_month = (now_il.day == 1) if force_monthly is None else bool(force_monthly)
    yesterday_date = (now_il - timedelta(days=1)).date()
    month_start_date = yesterday_date.replace(day=1)

    users_res = supabase_client.table("users").select("*").execute()
    users = users_res.data or []

    # Group by parking_id
    parkings_info = {}
    for u in users:
        status = str(u.get("account_status") or "active").lower()
        if status in ["disabled", "blocked", "inactive", "לא פעיל", "חסום"]:
            continue
        pid = str(u.get("parking_id") or "").strip()
        if not pid or pid.lower() == "all":
            continue
        if target_parking_id and pid != str(target_parking_id).strip():
            continue

        if pid not in parkings_info:
            parkings_info[pid] = {
                "parking_id": pid,
                "parking_name": u.get("parking_name") or pid,
                "rate_per_minute": 2.20,
                "emails": set(),
            }

        if u.get("parking_name") and str(u.get("parking_name")).strip():
            parkings_info[pid]["parking_name"] = str(u.get("parking_name")).strip()

        role = str(u.get("user_type") or "").lower()
        if role in ["manager", "admin", "owner", "מנהל"] and u.get("rate_per_minute"):
            parkings_info[pid]["rate_per_minute"] = float(u.get("rate_per_minute"))

        email_addr = str(u.get("email") or "").strip()
        if email_addr and "@" in email_addr:
            parkings_info[pid]["emails"].add(email_addr)

    # If target_parking_id was requested but had no user record, still allow generating PDF
    if target_parking_id and str(target_parking_id).strip() not in parkings_info:
        pid = str(target_parking_id).strip()
        parkings_info[pid] = {
            "parking_id": pid,
            "parking_name": pid,
            "rate_per_minute": 2.20,
            "emails": set(),
        }

    results = []
    for pid, pinfo in parkings_info.items():
        emails = list(pinfo["emails"])
        if override_email and "@" in override_email:
            emails = [override_email.strip()]

        if send_email and not emails:
            continue

        start_dt = datetime(
            month_start_date.year, month_start_date.month, month_start_date.day
        )
        end_dt = datetime(
            yesterday_date.year, yesterday_date.month, yesterday_date.day, 23, 59, 59
        )
        calls = fetch_calls_for_parking_month(supabase_client, pid, start_dt, end_dt)

        pdf_bytes = generate_parking_report_pdf(
            parking_id=pid,
            parking_name=pinfo["parking_name"],
            rate_per_minute=pinfo["rate_per_minute"],
            calls_in_month=calls,
            report_date=now_il,
            is_monthly_summary=is_first_of_month,
        )

        report_date_str = now_il.strftime("%d/%m/%Y")
        filename = f"Hint_Intercom_Report_{pid}_{now_il.strftime('%Y_%m_%d')}.pdf"
        if is_first_of_month:
            subject = f"דוח סיכום חודשי למערכת אינטרקום מבית הינט - חניון {pinfo['parking_name']} ({report_date_str})"
        else:
            subject = f"דוח פעולות יומי למערכת אינטרקום מבית הינט - חניון {pinfo['parking_name']} ({report_date_str})"

        body_text = (
            f"שלום רב,\n\n"
            f"מצורף קובץ PDF של {subject}.\n"
            f"חניון: {pinfo['parking_name']} ({pid})\n"
            f"תאריך הפקת הדוח: {report_date_str}\n\n"
            f"בברכה,\nמערכת אינטרקום חכמה מבית הינט (HINT AI)"
        )

        if send_email:
            send_pdf_email(
                recipients=emails,
                subject=subject,
                body_text=body_text,
                pdf_bytes=pdf_bytes,
                filename=filename,
            )

        results.append(
            {
                "parking_id": pid,
                "parking_name": pinfo["parking_name"],
                "emails": emails,
                "calls_count": len(calls),
                "filename": filename,
                "pdf_bytes": pdf_bytes,
            }
        )

    return results
