#!/usr/bin/env python3
"""
Scraping FBref per Serie A — VERSIONE 3 (FIX)
Genera clubs.json + players.json per il gioco 38-0 Serie A.

FIX vs v2:
- Table IDs esatti: stats_standard_11, stats_defense_11, stats_keeper_11, stats_passing_11
- data-stat "squad" (non "team") per le tabelle player
- Estrazione corretta tabelle nei commenti HTML
- Defense: data-stat="errors" (non errors_leading_to_goal)
- Passing: assisted_shots come key_passes, fallback progressive_passes
- Aggiunto data-stat "nation" skip per righe header ripetute

ESEGUIRE DAL PROPRIO PC/MAC:
    pip install requests beautifulsoup4 lxml tqdm
    python scrape_serie_a_v3.py

Per bypassare Cloudflare, usare SeleniumBase:
    pip install seleniumbase
    python scrape_serie_a_v3.py --selenium

Output:
    data/clubs.json    → [{id, name}]
    data/players.json  → [{id, name, position, seasons: [{club, season, rating, apps, goals, assists}]}]
"""

import json
import os
import re
import sys
import time
import logging
import argparse
import atexit
from collections import defaultdict
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Comment

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scrape.log", encoding="utf-8"),
    ]
)
log = logging.getLogger(__name__)

OUT_DIR = Path(__file__).parent.parent / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://fbref.com"
COMP_ID = 11  # Serie A

# ===========================================================================
# POSITION CLASSIFICATION
# ===========================================================================

POSITION_MAP = {
    "GK": "GK", "GKMF": "GK",
    "CB": "DEF", "DF": "DEF", "FB": "DEF",
    "LB": "DEF", "RB": "DEF", "WB": "DEF",
    "LWB": "DEF", "RWB": "DEF", "SW": "DEF",
    "DMF": "MID", "MF": "MID", "CM": "MID",
    "CDM": "MID", "CAM": "MID", "AMF": "MID",
    "LM": "MID", "RM": "MID",
    "LW": "ATT", "RW": "ATT",
    "FW": "ATT", "ST": "ATT", "CF": "ATT",
    "LF": "ATT", "RF": "ATT",
    "LMF": "MID", "RMF": "MID",
}


def classify_position(pos: str) -> str:
    if not pos:
        return "MID"
    primary = pos.split(",")[0].strip().upper()
    if primary in POSITION_MAP:
        return POSITION_MAP[primary]
    if len(primary) >= 2 and primary[:2] in POSITION_MAP:
        return POSITION_MAP[primary[:2]]
    if "GK" in primary:
        return "GK"
    if any(x in primary for x in ["CB", "LB", "RB", "WB", "DF"]):
        return "DEF"
    if any(x in primary for x in ["MF", "CM", "DM", "AM", "LM", "RM"]):
        return "MID"
    if any(x in primary for x in ["FW", "ST", "CF", "LW", "RW", "WF"]):
        return "ATT"
    return "MID"


# ===========================================================================
# RATING CALCULATION
# ===========================================================================

def calculate_rating(pos_cat: str, stats: dict) -> float:
    """Position-specific rating, normalized ~1-99."""
    apps = stats.get("apps", 0) or 0
    goals = stats.get("goals", 0) or 0
    assists = stats.get("assists", 0) or 0
    key_passes = stats.get("key_passes", 0) or 0
    tackles_won = stats.get("tackles_won", 0) or 0
    clean_sheets = stats.get("clean_sheets", 0) or 0
    errors = stats.get("errors", 0) or 0
    save_pct = stats.get("save_pct", 0.0) or 0.0
    goals_against = stats.get("goals_against", 0) or 0
    minutes = stats.get("minutes", 0) or 0

    min_bonus = min(minutes / 3420, 1.0) * 10 if minutes else 0

    if pos_cat == "ATT":
        raw = goals * 3 + assists * 1.5 + apps * 0.5
        norm = 1.05
    elif pos_cat == "MID":
        raw = goals * 2 + assists * 2 + apps * 0.5 + key_passes * 1
        norm = 1.455
    elif pos_cat == "DEF":
        raw = apps * 1 + tackles_won * 0.5 + clean_sheets * 1.5 - errors * 2
        norm = 0.875
    elif pos_cat == "GK":
        raw = clean_sheets * 2 + save_pct * 0.3 - goals_against * 0.3
        norm = 0.435
    else:
        raw = apps + goals + assists
        norm = 1.0

    if norm == 0:
        norm = 1.0

    rating = (raw / norm) * 100 + min_bonus
    return max(1.0, min(99.0, round(rating, 1)))


# ===========================================================================
# HTTP FETCHING — requests or SeleniumBase
# ===========================================================================

USE_SELENIUM = False
_DRIVER = None


def get_driver():
    global _DRIVER
    if _DRIVER is None:
        try:
            from seleniumbase import Driver
            log.info("Initializing SeleniumBase Driver (uc=True, headless=True)...")
            _DRIVER = Driver(uc=True, headless=True)
        except ImportError:
            log.error("seleniumbase not installed! Run: pip install seleniumbase")
            sys.exit(1)
    return _DRIVER


def close_driver():
    global _DRIVER
    if _DRIVER is not None:
        try:
            _DRIVER.quit()
        except Exception:
            pass
        _DRIVER = None


atexit.register(close_driver)


class Response:
    def __init__(self, content: bytes, status_code: int = 200):
        self.content = content
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code != 200:
            raise requests.exceptions.HTTPError(f"HTTP {self.status_code}")


SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
})


def _fetch_requests(url: str, max_retries: int = 3) -> Response:
    for attempt in range(max_retries):
        try:
            resp = SESSION.get(url, timeout=30)
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                log.warning(f"Rate limited (429). Waiting {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return Response(resp.content, resp.status_code)
        except requests.exceptions.ConnectionError as e:
            wait = 10 * (attempt + 1)
            log.warning(f"Connection error: {e}. Retry in {wait}s...")
            time.sleep(wait)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code >= 500:
                wait = 15 * (attempt + 1)
                log.warning(f"Server error {e.response.status_code}. Retry in {wait}s...")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Failed to fetch {url} after {max_retries} attempts")


def _fetch_selenium(url: str, max_retries: int = 3) -> Response:
    driver = get_driver()
    for attempt in range(max_retries):
        try:
            driver.get(url)
            # Wait for content to load (bypass Cloudflare)
            start = time.time()
            found_table = False
            while time.time() - start < 20:
                src = driver.page_source
                if "<table" in src:
                    found_table = True
                    break
                lower = src.lower()
                if "just a moment" in lower or "ci siamo quasi" in lower:
                    time.sleep(1)
                    continue
                if "<body" in lower and len(src) > 5000:
                    found_table = True
                    break
                time.sleep(0.5)

            if not found_table:
                title = driver.title.lower()
                if "429" in title or "too many" in title:
                    wait = 30 * (attempt + 1)
                    log.warning(f"Rate limited. Waiting {wait}s...")
                    time.sleep(wait)
                    close_driver()
                    driver = get_driver()
                    continue
                # Still return whatever we have — might be useful for debugging
                log.warning(f"Page loaded but no table found. Title: {driver.title}")

            content = driver.page_source.encode("utf-8")
            return Response(content, 200)

        except Exception as e:
            wait = 10 * (attempt + 1)
            log.warning(f"Selenium error: {e}. Retry in {wait}s...")
            time.sleep(wait)
            close_driver()
            driver = get_driver()

    raise RuntimeError(f"Failed to fetch {url} after {max_retries} attempts")


def _get(url: str) -> Response:
    if USE_SELENIUM:
        return _fetch_selenium(url)
    return _fetch_requests(url)


# ===========================================================================
# EXTRACT TABLES (including hidden in HTML comments)
# ===========================================================================

def extract_all_tables(soup: BeautifulSoup) -> dict:
    """Extract ALL tables from visible HTML AND from HTML comments."""
    tables = {}

    # 1. Visible tables
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if tid:
            tables[tid] = table

    # 2. Tables hidden in comments
    # FBref wraps non-visible tab content in <!-- ... -->
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment_text = str(comment)
        # Only parse comments that actually contain table markup
        if "<table" not in comment_text:
            continue
        try:
            comment_soup = BeautifulSoup(comment_text, "html.parser")
            for table in comment_soup.find_all("table"):
                tid = table.get("id", "")
                if tid and tid not in tables:
                    tables[tid] = table
        except Exception as e:
            log.debug(f"Error parsing comment table: {e}")

    return tables


# ===========================================================================
# SEASON DISCOVERY
# ===========================================================================

def get_all_seasons() -> dict:
    """
    Discover all Serie A seasons from FBref.
    Returns { "1992-1993": "1992-1993", ..., "2024-2025": "2024-2025" }
    (FBref now uses YYYY-YYYY slugs in URLs)
    """
    seasons = {}

    # Try history page first (more complete)
    for url_path in [
        "/en/comps/11/history/Serie-A-Seasons",
        "/en/comps/11/Serie-A-Stats",
    ]:
        url = f"{BASE_URL}{url_path}"
        log.info(f"Discovering seasons from {url}")
        try:
            resp = _get(url)
            soup = BeautifulSoup(resp.content, "html.parser")

            for a in soup.find_all("a", href=True):
                href = a["href"]
                text = a.get_text(strip=True)

                # Match /en/comps/11/YYYY-YYYY/... (new URL format)
                m = re.match(r"/en/comps/11/(\d{4}-\d{4})/", href)
                if m:
                    slug = m.group(1)
                    seasons[slug] = slug
                    continue

                # Match /en/comps/11/NNNN/... (old numeric ID format)
                m = re.match(r"/en/comps/11/(\d+)/", href)
                if m:
                    season_id = m.group(1)
                    label = _extract_season_label(text)
                    if label and label not in seasons:
                        seasons[label] = season_id

            # Also check <select> dropdowns
            for select in soup.find_all("select"):
                for option in select.find_all("option"):
                    val = option.get("value", "")
                    m = re.search(r"/comps/11/(\d{4}-\d{4})/", val)
                    if m:
                        slug = m.group(1)
                        seasons[slug] = slug
                    m = re.search(r"/comps/11/(\d+)/", val)
                    if m:
                        label = _extract_season_label(option.get_text(strip=True))
                        if label and label not in seasons:
                            seasons[label] = m.group(1)

        except Exception as e:
            log.warning(f"Failed to get seasons from {url}: {e}")

        if len(seasons) >= 5:
            break

    seasons = dict(sorted(seasons.items()))
    log.info(f"Discovered {len(seasons)} seasons")
    if seasons:
        keys = list(seasons.keys())
        log.info(f"  First: {keys[0]}, Last: {keys[-1]}")
    return seasons


def _extract_season_label(text: str) -> str | None:
    m = re.search(r"(\d{4})-(\d{4})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"(\d{4})-(\d{2})", text)
    if m:
        return f"{m.group(1)}-{m.group(1)[:2]}{m.group(2)}"
    m = re.search(r"(\d{4})", text)
    if m:
        y = int(m.group(1))
        return f"{y}-{y+1}"
    return None


# ===========================================================================
# PARSE TABLE ROWS
# ===========================================================================

def _safe_int(val) -> int:
    if not val or val in ("", "-", "—", "N/A", "nan"):
        return 0
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def _safe_float(val) -> float:
    if not val or val in ("", "-", "—", "N/A", "nan"):
        return 0.0
    try:
        return float(str(val).replace(",", "").replace("%", "").strip())
    except (ValueError, TypeError):
        return 0.0


def parse_table_rows(table) -> list[dict]:
    """Parse FBref table rows into list of {data_stat: value} dicts."""
    rows_data = []
    tbody = table.find("tbody")
    if not tbody:
        return rows_data

    for row in tbody.find_all("tr"):
        # Skip header repeat rows
        row_classes = " ".join(row.get("class", []))
        if "over_header" in row_classes or "thead" in row_classes:
            continue

        data = {}
        for cell in row.find_all(["td", "th"]):
            stat = cell.get("data-stat", "")
            if stat:
                data[stat] = cell.get_text(strip=True)

        # Skip rows without player name (squad totals, etc.)
        # A valid player row has 'player' stat or at least 'squad'
        if data.get("player") or data.get("squad"):
            rows_data.append(data)

    return rows_data


# ===========================================================================
# SCRAPE SINGLE SEASON
# ===========================================================================

def scrape_season(season_label: str, season_slug: str) -> tuple:
    """
    Scrape one Serie A season page.
    Returns (clubs, player_records)
    """
    # Build URL
    if season_slug == "current" or season_slug == str(COMP_ID):
        url = f"{BASE_URL}/en/comps/11/Serie-A-Stats"
    elif re.match(r"\d{4}-\d{4}", season_slug):
        url = f"{BASE_URL}/en/comps/11/{season_slug}/{season_slug}-Serie-A-Stats"
    else:
        # Old numeric ID format
        url = f"{BASE_URL}/en/comps/11/{season_slug}/stats/Serie-A-Stats"

    log.info(f"Scraping {season_label}: {url}")

    resp = _get(url)
    soup = BeautifulSoup(resp.content, "html.parser")

    # Extract ALL tables
    all_tables = extract_all_tables(soup)
    table_ids = sorted(all_tables.keys())
    log.info(f"  Found {len(all_tables)} tables")
    log.debug(f"  Table IDs: {table_ids}")

    # Log which stats tables we found
    for prefix in ["stats_standard", "stats_keeper", "stats_defense", "stats_passing", "results"]:
        found = [t for t in table_ids if t.startswith(prefix)]
        if found:
            log.info(f"  ✓ {prefix}: {found}")

    # --- CLUBS from standings/results table ---
    clubs = []
    for tid in table_ids:
        if tid.startswith("results") and "overall" in tid:
            table = all_tables[tid]
            rows = parse_table_rows(table)
            for row in rows:
                # Standings table uses 'team' (with link) or 'squad'
                team = row.get("team", "") or row.get("squad", "")
                if team:
                    club_id = team.lower().replace(" ", "-").replace("'", "")
                    if club_id not in [c["id"] for c in clubs]:
                        clubs.append({"id": club_id, "name": team})
            if clubs:
                break

    # --- PLAYER STATS ---
    player_data = {}  # keyed by "name|club|season"

    # === STANDARD STATS ===
    # Table ID: stats_standard_{COMP_ID} or stats_standard
    std_table = None
    for tid in [f"stats_standard_{COMP_ID}", "stats_standard",
                f"stats_summary_{COMP_ID}", "stats_summary"]:
        if tid in all_tables:
            std_table = all_tables[tid]
            log.info(f"  Using standard stats table: {tid}")
            break

    if std_table:
        rows = parse_table_rows(std_table)
        count = 0
        for row in rows:
            name = row.get("player", "")
            # KEY FIX: use 'squad' not 'team' for player tables
            club = row.get("squad", "") or row.get("team", "")
            if not name or not club:
                continue
            pos = row.get("position", "")
            apps = _safe_int(row.get("games", "0"))
            if apps == 0:
                continue

            key = f"{name}|{club}|{season_label}"
            player_data[key] = {
                "name": name,
                "position": classify_position(pos),
                "club": club,
                "season": season_label,
                "apps": apps,
                "goals": _safe_int(row.get("goals", "0")),
                "assists": _safe_int(row.get("assists", "0")),
                "minutes": _safe_int(row.get("minutes", "0")),
                "clean_sheets": _safe_int(row.get("clean_sheets", "0")),
                "tackles_won": 0,
                "errors": 0,
                "key_passes": 0,
                "save_pct": 0.0,
                "goals_against": 0,
            }
            count += 1
        log.info(f"  Standard stats: {count} player records")

    if not player_data:
        log.warning(f"  ⚠ No player data found for {season_label}!")
        # Debug: show what data-stat values exist in the rows we found
        if std_table:
            rows = parse_table_rows(std_table)
            if rows:
                log.warning(f"    Sample row keys: {list(rows[0].keys())}")
                log.warning(f"    Sample row: {rows[0]}")

    # === DEFENSIVE STATS ===
    def_table = None
    for tid in [f"stats_defense_{COMP_ID}", "stats_defense"]:
        if tid in all_tables:
            def_table = all_tables[tid]
            log.info(f"  Using defense table: {tid}")
            break

    if def_table:
        rows = parse_table_rows(def_table)
        merged = 0
        for row in rows:
            name = row.get("player", "")
            club = row.get("squad", "") or row.get("team", "")
            key = f"{name}|{club}|{season_label}"
            if key in player_data:
                # KEY FIX: data-stat is "tackles_won" and "errors"
                player_data[key]["tackles_won"] = _safe_int(row.get("tackles_won", "0"))
                # FBref uses "errors" for errors leading to goal
                player_data[key]["errors"] = _safe_int(row.get("errors", "0"))
                merged += 1
        log.info(f"  Defense stats: merged {merged} records")

    # === KEEPER STATS ===
    gk_table = None
    for tid in [f"stats_keeper_{COMP_ID}", "stats_keeper"]:
        if tid in all_tables and "adv" not in tid:
            gk_table = all_tables[tid]
            log.info(f"  Using keeper table: {tid}")
            break

    if gk_table:
        rows = parse_table_rows(gk_table)
        merged = 0
        for row in rows:
            name = row.get("player", "")
            club = row.get("squad", "") or row.get("team", "")
            key = f"{name}|{club}|{season_label}"
            if key in player_data:
                player_data[key]["save_pct"] = _safe_float(row.get("save_pct", "0"))
                player_data[key]["goals_against"] = _safe_int(row.get("goals_against", "0"))
                cs = _safe_int(row.get("clean_sheets", "0"))
                player_data[key]["clean_sheets"] = max(player_data[key]["clean_sheets"], cs)
                player_data[key]["position"] = "GK"
                merged += 1
        log.info(f"  Keeper stats: merged {merged} records")

    # === PASSING STATS ===
    pass_table = None
    for tid in [f"stats_passing_{COMP_ID}", "stats_passing"]:
        if tid in all_tables and "types" not in tid:
            pass_table = all_tables[tid]
            log.info(f"  Using passing table: {tid}")
            break

    if pass_table:
        rows = parse_table_rows(pass_table)
        merged = 0
        for row in rows:
            name = row.get("player", "")
            club = row.get("squad", "") or row.get("team", "")
            key = f"{name}|{club}|{season_label}"
            if key in player_data:
                # KEY FIX: assisted_shots = key passes (shot-creating passes)
                kp = _safe_int(row.get("assisted_shots", "0"))
                if kp == 0:
                    # Fallback: progressive_passes
                    kp = _safe_int(row.get("progressive_passes", "0"))
                player_data[key]["key_passes"] = kp
                merged += 1
        log.info(f"  Passing stats: merged {merged} records")

    # Also extract clubs from player data if standings table was missing
    if not clubs:
        seen = set()
        for p in player_data.values():
            club_name = p["club"]
            club_id = club_name.lower().replace(" ", "-").replace("'", "")
            if club_id not in seen:
                clubs.append({"id": club_id, "name": club_name})
                seen.add(club_id)

    log.info(f"  → {len(clubs)} clubs, {len(player_data)} players")
    return clubs, list(player_data.values())


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(description="Scrape FBref Serie A data")
    parser.add_argument("--selenium", action="store_true", help="Use SeleniumBase to bypass Cloudflare")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--seasons", nargs="+", help="Scrape only specific seasons (e.g. 2023-2024)")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    global USE_SELENIUM
    USE_SELENIUM = args.selenium

    start_time = time.time()
    log.info("=" * 60)
    log.info("⚽ 38-0 Serie A — FBref Scraper v3")
    log.info(f"   Mode: {'SeleniumBase' if USE_SELENIUM else 'requests'}")
    log.info("=" * 60)

    # Step 1: Discover seasons
    seasons = get_all_seasons()

    if not seasons:
        log.error("No seasons discovered! Try --selenium flag to bypass Cloudflare.")
        sys.exit(1)

    # Filter to desired range
    target = {k: v for k, v in seasons.items() if k >= "1992-1993"}

    # Override if --seasons specified
    if args.seasons:
        target = {s: seasons.get(s, s) for s in args.seasons if s in seasons or True}

    log.info(f"\nScraping {len(target)} seasons: {list(target.keys())[0]} → {list(target.keys())[-1]}")

    # Step 2: Scrape each season
    all_clubs = {}
    all_player_seasons = defaultdict(list)

    season_items = list(target.items())
    pbar = tqdm(season_items, desc="Seasons", unit="s") if HAS_TQDM else season_items

    for i, (season_label, season_slug) in enumerate(pbar):
        if not HAS_TQDM:
            log.info(f"\n{'='*50}")
            log.info(f"Season {i+1}/{len(season_items)}: {season_label}")

        try:
            clubs, players = scrape_season(season_label, season_slug)
        except Exception as e:
            log.error(f"  ❌ FAILED: {e}")
            import traceback
            traceback.print_exc()
            continue

        # Collect clubs
        for c in clubs:
            if c["id"] not in all_clubs:
                all_clubs[c["id"]] = c

        # Process players
        for p in players:
            rating = calculate_rating(p["position"], p)
            season_entry = {
                "club": p["club"],
                "season": p["season"],
                "rating": rating,
                "apps": p["apps"],
                "goals": p["goals"],
                "assists": p["assists"],
            }
            name_key = p["name"].strip()
            all_player_seasons[name_key].append({
                "name": p["name"],
                "position": p["position"],
                "season_entry": season_entry,
            })

        # Rate limit
        if i < len(season_items) - 1:
            time.sleep(4 + (2 if i % 5 == 4 else 0))

    # Step 3: Build output files
    clubs_list = sorted(all_clubs.values(), key=lambda x: x["name"])
    clubs_path = OUT_DIR / "clubs.json"
    with open(clubs_path, "w", encoding="utf-8") as f:
        json.dump(clubs_list, f, ensure_ascii=False, indent=2)
    log.info(f"\n✅ clubs.json: {len(clubs_list)} clubs → {clubs_path}")

    # players.json
    players_list = []
    pid = 1
    for name_key in sorted(all_player_seasons.keys()):
        entries = all_player_seasons[name_key]

        # Primary position = most frequent
        pos_counts = defaultdict(int)
        for e in entries:
            pos_counts[e["position"]] += 1
        primary_pos = max(pos_counts, key=pos_counts.get)

        seasons_list = sorted([e["season_entry"] for e in entries], key=lambda x: x["season"])
        name = entries[0]["name"]

        players_list.append({
            "id": f"p{pid:05d}",
            "name": name,
            "position": primary_pos,
            "seasons": seasons_list,
        })
        pid += 1

    players_path = OUT_DIR / "players.json"
    with open(players_path, "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)

    total_seasons = sum(len(p["seasons"]) for p in players_list)
    all_ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    elapsed = time.time() - start_time

    log.info(f"\n{'='*60}")
    log.info(f"✅ players.json: {len(players_list)} players ({total_seasons} season records)")
    log.info(f"📊 RIEPILOGO:")
    log.info(f"   Club: {len(clubs_list)}")
    log.info(f"   Giocatori: {len(players_list)}")
    log.info(f"   Stagioni giocatore: {total_seasons}")
    if all_ratings:
        log.info(f"   Rating min/max/mean: {min(all_ratings):.1f} / {max(all_ratings):.1f} / {sum(all_ratings)/len(all_ratings):.1f}")
    log.info(f"   Tempo: {elapsed:.0f}s ({elapsed/60:.1f}min)")
    log.info(f"{'='*60}")
    log.info("🎉 FATTO!")


if __name__ == "__main__":
    main()
