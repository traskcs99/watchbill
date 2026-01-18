import requests
import socket
from datetime import datetime, timedelta

# --- 1. THE FIX: Force IPv4 for macOS ---
import requests.packages.urllib3.util.connection as urllib3_cn


def allowed_gai_family():
    """Forces IPv4 to prevent the macOS 'hang' during DNS resolution."""
    return socket.AF_INET


urllib3_cn.allowed_gai_family = allowed_gai_family

# --- 2. LOGIC FUNCTIONS ---


def get_mothers_day(year: int):
    """Return Mother's Day (2nd Sunday in May)."""
    may_1 = datetime(year, 5, 1).date()
    first_sunday = may_1 + timedelta(days=(6 - may_1.weekday()) % 7)
    return first_sunday + timedelta(days=7)


def get_holidays_with_breaks(start_date_str: str, end_date_str: str):
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    start_year = start_date.year
    end_year = end_date.year

    print(f"Starting fetch for {start_date} to {end_date}...")

    results = []
    holiday_by_date = {}

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    # Federal Holiday Filter
    FEDERAL_NAMES = {
        "New Year's Day",
        "Martin Luther King, Jr. Day",
        "Washington's Birthday",
        "Memorial Day",
        "Juneteenth National Independence Day",
        "Independence Day",
        "Labor Day",
        "Columbus Day",
        "Veterans Day",
        "Thanksgiving Day",
        "Christmas Day",
    }

    for year in range(start_year, end_year + 1):
        # --- API CALL 1: Public Holidays & Easter Logic ---
        url_pub = f"https://date.nager.at/api/v3/PublicHolidays/{year}/US"
        try:
            print(f"Fetching Public Holidays for {year}...")
            response = requests.get(url_pub, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                for h in data:
                    h_date = datetime.strptime(h["date"], "%Y-%m-%d").date()
                    if start_date <= h_date <= end_date:
                        holiday_by_date[h_date] = h["localName"]
                        if h["localName"] in FEDERAL_NAMES:
                            results.append({"date": h["date"], "name": h["localName"]})

                    # Calculate Easter Sunday if Good Friday is found
                    if "Good Friday" in h["localName"]:
                        easter = h_date + timedelta(days=2)
                        if start_date <= easter <= end_date:
                            results.append(
                                {
                                    "date": easter.strftime("%Y-%m-%d"),
                                    "name": "Easter Sunday",
                                }
                            )
        except Exception as e:
            print(f"Error fetching holidays for {year}: {e}")

        # --- API CALL 2: Long Weekends (Breaks) ---
        url_lw = f"https://date.nager.at/api/v3/LongWeekend/{year}/US"
        try:
            print(f"Fetching Long Weekends for {year}...")
            response = requests.get(url_lw, headers=headers, timeout=5)
            if response.status_code == 200:
                for lw in response.json():
                    lw_start = datetime.strptime(lw["startDate"], "%Y-%m-%d").date()
                    lw_end = datetime.strptime(lw["endDate"], "%Y-%m-%d").date()

                    current = lw_start
                    while current <= lw_end:
                        if start_date <= current <= end_date:
                            # If it's not the holiday itself, it's a "Break"
                            if current not in holiday_by_date:
                                # Find nearest holiday name for labeling
                                nearest = min(
                                    holiday_by_date.keys(),
                                    key=lambda d: abs((current - d).days),
                                )
                                results.append(
                                    {
                                        "date": current.strftime("%Y-%m-%d"),
                                        "name": f"{holiday_by_date[nearest]} Break",
                                    }
                                )
                        current += timedelta(days=1)
        except Exception as e:
            print(f"Error fetching long weekends for {year}: {e}")

        # --- Add Mother's Day ---
        m_day = get_mothers_day(year)
        if start_date <= m_day <= end_date:
            results.append({"date": m_day.strftime("%Y-%m-%d"), "name": "Mother's Day"})

    # --- Add Cultural Holidays (Static Dates) ---
    CULTURAL = {
        "02-14": "Valentine's Day",
        "03-17": "St. Patrick's Day",
        "05-05": "Cinco de Mayo",
        "10-31": "Halloween",
    }
    curr = start_date
    while curr <= end_date:
        mmdd = curr.strftime("%m-%d")
        if mmdd in CULTURAL:
            results.append({"date": curr.strftime("%Y-%m-%d"), "name": CULTURAL[mmdd]})
        curr += timedelta(days=1)

    # Sort and remove duplicates
    results.sort(key=lambda x: x["date"])
    unique_results = []
    seen_dates = set()
    for item in results:
        if item["date"] not in seen_dates:
            unique_results.append(item)
            seen_dates.add(item["date"])

    return unique_results


if __name__ == "__main__":
    import json

    # This should now run instantly
    holidays = get_holidays_with_breaks("2026-01-01", "2027-12-31")
    print(json.dumps(holidays, indent=2))
