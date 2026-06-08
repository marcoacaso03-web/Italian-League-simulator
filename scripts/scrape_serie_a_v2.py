#!/usr/bin/env python3
"""
Scraping FBref per Serie A — VERSIONE MIGLIORATA
Genera clubs.json + players.json per il gioco 38-0 Serie A.

MIGLIORAMENTI vs v1:
- Gestisce le tabelle FBref nascoste nei commenti HTML
- Usa pandas per parsing più robusto delle tabelle
- Rate limiting intelligente (backoff su 429)
- Progress bar
- Resume da punto di interruzione

ESEGUIRE DAL PROPRIO PC/MAC:
    pip install requests beautifulsoup4 lxml pandas tqdm
    python scrape_serie_a_v2.py

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
import html
import atexit
from collections import defaultdict
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup, Comment
from seleniumbase import Driver

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
    """
    Position-specific rating, normalized to approximately 1-99.

    ATT:  (goals×3 + assists×1.5 + apps×0.5) / norm  + min_bonus
    MID:  (goals×2 + assists×2 + apps×0.5 + key_passes×1) / norm  + min_bonus
    DEF:  (apps×1 + tackles_won×0.5 + clean_sheets×1.5 - errors×2) / norm  + min_bonus
    GK:   (clean_sheets×2 + save_pct×0.3 - goals_against×0.3) / norm  + min_bonus
    """
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

    # Minutes-based bonus: more minutes = higher floor
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

    rating = (raw / norm) + min_bonus
    return max(1.0, min(99.0, round(rating, 1)))


# ===========================================================================
# HELPER: extract FBref tables (including those hidden in HTML comments)
# ===========================================================================

def extract_all_tables(soup: BeautifulSoup) -> dict:
    """
    FBref hides some stats tables in HTML comments.
    This extracts ALL tables from both visible HTML and comments.
    Returns {table_id: table_soup}
    """
    tables = {}

    # Visible tables
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if tid:
            tables[tid] = table

    # Tables inside comments (FBref's lazy-loading pattern)
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        try:
            comment_soup = BeautifulSoup(comment, "lxml")
            for table in comment_soup.find_all("table"):
                tid = table.get("id", "")
                if tid and tid not in tables:
                    tables[tid] = table
        except Exception:
            pass

    return tables


# ===========================================================================
# SEASON DISCOVERY
# ===========================================================================

def get_all_seasons() -> dict:
    """
    Scrape the Serie A history page to get all season slugs.
    FBref now uses YYYY-YYYY slugs in URLs instead of numeric IDs.
    Returns { "2003-2004": "2003-2004", ..., "2025-2026": "current" }
    """
    seasons = {}

    url = f"{BASE_URL}/en/comps/11/history/Serie-A-Seasons"
    log.info(f"Discovering seasons from {url}")
    try:
        resp = _get_with_retry(url)
        soup = BeautifulSoup(resp.content, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True)
            # Match YYYY-YYYY season URLs: /en/comps/11/2024-2025/2024-2025-Serie-A-Stats
            m = re.match(r"/en/comps/11/(\d{4}-\d{4})/", href)
            if m:
                slug = m.group(1)
                seasons[slug] = slug
            # Match current season link: /en/comps/11/Serie-A-Stats with a year label
            elif href == "/en/comps/11/Serie-A-Stats":
                label = _extract_season_label(text)
                if label and label not in seasons:
                    seasons[label] = "current"
    except Exception as e:
        log.warning(f"Failed to get seasons from history page: {e}")

    seasons = dict(sorted(seasons.items()))
    if seasons:
        keys = list(seasons.keys())
        log.info(f"Discovered {len(seasons)} seasons: {keys[:3]}...{keys[-3:]}")
    else:
        log.info("Discovered 0 seasons")
    return seasons


def _extract_season_label(text: str) -> str | None:
    """Extract a 'YYYY-YYYY' season label from text like '2023-2024 Serie A'."""
    m = re.search(r"(\d{4})-(\d{4})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"(\d{4})-(\d{2})\s", text)
    if m:
        y1 = m.group(1)
        y2 = y1[:2] + m.group(2)
        return f"{y1}-{y2}"
    m = re.search(r"(\d{4})", text)
    if m:
        y = int(m.group(1))
        return f"{y}-{y+1}"
    return None


# ===========================================================================
# ROBUST HTTP GET WITH RETRY
# ===========================================================================

_DRIVER = None

def get_driver():
    global _DRIVER
    if _DRIVER is None:
        log.info("Initializing SeleniumBase Driver in UC mode...")
        _DRIVER = Driver(uc=True, headless=True)
    return _DRIVER

def close_driver():
    global _DRIVER
    if _DRIVER is not None:
        log.info("Closing SeleniumBase Driver...")
        try:
            _DRIVER.quit()
        except Exception:
            pass
        _DRIVER = None

atexit.register(close_driver)

class SeleniumResponse:
    def __init__(self, content: bytes, text: str, status_code: int = 200):
        self.content = content
        self.text = text
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code != 200:
            raise requests.exceptions.HTTPError(f"HTTP Error {self.status_code}")

def _get_with_retry(url: str, max_retries: int = 3):
    driver = get_driver()
    for attempt in range(max_retries):
        try:
            log.info(f"Fetching URL via SeleniumBase: {url} (attempt {attempt+1}/{max_retries})")
            driver.get(url)
            
            # Wait up to 15 seconds for a table to load, or until Cloudflare challenge passes
            start = time.time()
            success = False
            while time.time() - start < 15:
                source = driver.page_source
                if "<table" in source:
                    success = True
                    break
                if "just a moment" not in source.lower() and "ci siamo quasi" not in source.lower() and "<body" in source.lower():
                    success = True
                    break
                time.sleep(0.5)
            
            if not success:
                title = driver.title.lower()
                if "404" in title or "not found" in title:
                    raise requests.exceptions.HTTPError("404 Not Found")
                elif "429" in title or "too many requests" in title or "ci siamo quasi" in title or "just a moment" in title:
                    wait = 30 * (attempt + 1)
                    log.warning(f"Rate limited or challenged. Waiting {wait}s...")
                    time.sleep(wait)
                    close_driver()
                    driver = get_driver()
                    continue
                else:
                    raise RuntimeError(f"Failed to load content. Title: {driver.title}")
            
            source_utf8 = driver.page_source
            content = source_utf8.encode("utf-8")
            return SeleniumResponse(content, source_utf8, 200)
            
        except Exception as e:
            wait = 10 * (attempt + 1)
            log.warning(f"Error fetching {url}: {e}. Retrying in {wait}s...")
            time.sleep(wait)
            close_driver()
            driver = get_driver()
            
    raise RuntimeError(f"Failed to fetch {url} after {max_retries} attempts")


# ===========================================================================
# SCRAPE SINGLE SEASON
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
    """
    Parse an FBref table into list of {data_stat: value} dicts.
    Handles the common FBref pattern: thead + tbody with data-stat attributes.
    """
    rows_data = []
    tbody = table.find("tbody")
    if not tbody:
        return rows_data

    for row in tbody.find_all("tr"):
        # Skip header/summary rows
        row_classes = " ".join(row.get("class", []))
        if "over_header" in row_classes or "thead" in row_classes:
            continue

        cells = row.find_all(["td", "th"])
        data = {}
        for cell in cells:
            stat = cell.get("data-stat", "")
            if stat:
                data[stat] = cell.get_text(strip=True)
        if data:
            rows_data.append(data)

    return rows_data


def scrape_season(season_label: str, season_slug: str) -> tuple:
    """
    Scrape one Serie A season.
    season_slug is either 'YYYY-YYYY' or 'current' for the ongoing season.
    Returns (clubs: list[dict], player_seasons: list[dict])
    """
    if season_slug == "current":
        url = f"{BASE_URL}/en/comps/11/stats/Serie-A-Stats"
        fallback_url = f"{BASE_URL}/en/comps/11/Serie-A-Stats"
    else:
        url = f"{BASE_URL}/en/comps/11/{season_slug}/stats/{season_slug}-Serie-A-Stats"
        fallback_url = f"{BASE_URL}/en/comps/11/{season_slug}/{season_slug}-Serie-A-Stats"

    log.info(f"Scraping {season_label} (slug={season_slug}): {url}")

    fetched_fallback = False
    try:
        resp = _get_with_retry(url)
        soup = BeautifulSoup(resp.content, "lxml")
        all_tables = extract_all_tables(soup)
        log.info(f"  Found {len(all_tables)} tables on stats page: {list(all_tables.keys())[:10]}...")
        
        has_players = any("stats_standard" in tid or "stats_players_standard" in tid or "stats_summary" in tid for tid in all_tables)
        if not has_players:
            log.info("  No player stats tables found on stats page. Fetching fallback squad page.")
            resp = _get_with_retry(fallback_url)
            soup = BeautifulSoup(resp.content, "lxml")
            all_tables = extract_all_tables(soup)
            fetched_fallback = True
            log.info(f"  Found {len(all_tables)} tables on fallback page: {list(all_tables.keys())[:10]}...")
    except Exception as e:
        log.warning(f"  Failed to fetch player stats page {url}: {e}. Trying fallback squad page: {fallback_url}")
        resp = _get_with_retry(fallback_url)
        soup = BeautifulSoup(resp.content, "lxml")
        all_tables = extract_all_tables(soup)
        fetched_fallback = True
        log.info(f"  Found {len(all_tables)} tables on fallback page: {list(all_tables.keys())[:10]}...")

    # --- CLUBS from standings table ---
    clubs = []
    for tid, table in all_tables.items():
        if "results" in tid and "overall" in tid:
            rows = parse_table_rows(table)
            for row in rows:
                team = row.get("team", "") or row.get("squad", "")
                if team:
                    club_id = team.lower().replace(" ", "-").replace("'", "")
                    if club_id not in [c["id"] for c in clubs]:
                        clubs.append({"id": club_id, "name": team})
            break

    if not clubs:
        # Fallback: get clubs from player data
        log.info("  No standings table found, will extract clubs from player data")

    # --- PLAYER STATS ---
    # Build a dict keyed by "name|club|season" to merge across tables
    player_data = {}

    # Standard stats table
    std_table = None
    for tid in sorted(all_tables.keys()):
        if "stats_standard" in tid or "stats_players_standard" in tid:
            std_table = all_tables[tid]
            break
    # Also try "summary" table
    if not std_table:
        for tid in sorted(all_tables.keys()):
            if "stats_summary" in tid:
                std_table = all_tables[tid]
                break

    if std_table:
        rows = parse_table_rows(std_table)
        for row in rows:
            name = row.get("player", "")
            club = row.get("team", "") or row.get("squad", "")
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
                "pos_detail": pos,
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
        log.info(f"  Standard stats: {len(player_data)} player-club-seasons")

    # Fetch and merge defensive, keeper, and passing stats if players were found
    if player_data:
        # 1. Defensive stats page
        if season_slug == "current":
            def_url = f"{BASE_URL}/en/comps/11/defense/Serie-A-Stats"
        else:
            def_url = f"{BASE_URL}/en/comps/11/{season_slug}/defense/{season_slug}-Serie-A-Stats"
        
        log.info(f"Scraping defense stats for {season_label}: {def_url}")
        time.sleep(2)  # Polite delay
        try:
            def_resp = _get_with_retry(def_url)
            def_soup = BeautifulSoup(def_resp.content, "lxml")
            def_tables = extract_all_tables(def_soup)
            
            # Defense merge
            for tid in sorted(def_tables.keys()):
                if "stats_defense" in tid and "keeper" not in tid:
                    table = def_tables[tid]
                    rows = parse_table_rows(table)
                    merged = 0
                    for row in rows:
                        name = row.get("player", "")
                        club = row.get("team", "") or row.get("squad", "")
                        key = f"{name}|{club}|{season_label}"
                        if key in player_data:
                            player_data[key]["tackles_won"] = _safe_int(row.get("tackles_won", "0"))
                            player_data[key]["errors"] = _safe_int(row.get("errors_leading_to_goal", "0"))
                            merged += 1
                    log.info(f"  Defense stats: merged {merged} rows")
                    break
        except Exception as e:
            log.warning(f"  Failed to fetch/merge defense stats: {e}")

        # 2. Keeper stats page
        if season_slug == "current":
            keeper_url = f"{BASE_URL}/en/comps/11/keepers/Serie-A-Stats"
        else:
            keeper_url = f"{BASE_URL}/en/comps/11/{season_slug}/keepers/{season_slug}-Serie-A-Stats"
            
        log.info(f"Scraping keeper stats for {season_label}: {keeper_url}")
        time.sleep(2)  # Polite delay
        try:
            keeper_resp = _get_with_retry(keeper_url)
            keeper_soup = BeautifulSoup(keeper_resp.content, "lxml")
            keeper_tables = extract_all_tables(keeper_soup)
            
            # Keeper merge
            for tid in sorted(keeper_tables.keys()):
                if "stats_keeper" in tid and "adv" not in tid:
                    table = keeper_tables[tid]
                    rows = parse_table_rows(table)
                    merged = 0
                    for row in rows:
                        name = row.get("player", "")
                        club = row.get("team", "") or row.get("squad", "")
                        key = f"{name}|{club}|{season_label}"
                        if key in player_data:
                            player_data[key]["save_pct"] = _safe_float(row.get("save_pct", "0"))
                            player_data[key]["goals_against"] = _safe_int(row.get("goals_against", "0"))
                            player_data[key]["clean_sheets"] = max(
                                player_data[key]["clean_sheets"],
                                _safe_int(row.get("clean_sheets", "0"))
                            )
                            player_data[key]["position"] = "GK"  # Override
                            merged += 1
                    log.info(f"  Keeper stats: merged {merged} rows")
                    break
        except Exception as e:
            log.warning(f"  Failed to fetch/merge keeper stats: {e}")

        # 3. Passing stats page
        if season_slug == "current":
            passing_url = f"{BASE_URL}/en/comps/11/passing/Serie-A-Stats"
        else:
            passing_url = f"{BASE_URL}/en/comps/11/{season_slug}/passing/{season_slug}-Serie-A-Stats"
            
        log.info(f"Scraping passing stats for {season_label}: {passing_url}")
        time.sleep(2)  # Polite delay
        try:
            passing_resp = _get_with_retry(passing_url)
            passing_soup = BeautifulSoup(passing_resp.content, "lxml")
            passing_tables = extract_all_tables(passing_soup)
            
            # Passing merge
            for tid in sorted(passing_tables.keys()):
                if "stats_passing" in tid and "types" not in tid:
                    table = passing_tables[tid]
                    rows = parse_table_rows(table)
                    merged = 0
                    for row in rows:
                        name = row.get("player", "")
                        club = row.get("team", "") or row.get("squad", "")
                        key = f"{name}|{club}|{season_label}"
                        if key in player_data:
                            # FBref passing: 'assisted_shots' is actually key_passes
                            kp = _safe_int(row.get("assisted_shots", "0"))
                            if kp == 0:
                                kp = _safe_int(row.get("passes_live", "0"))
                            player_data[key]["key_passes"] = kp
                            merged += 1
                    log.info(f"  Passing stats: merged {merged} rows")
                    break
        except Exception as e:
            log.warning(f"  Failed to fetch/merge passing stats: {e}")

    # Also grab clubs from player data if we didn't get them from standings
    if not clubs:
        seen = set()
        for p in player_data.values():
            club_name = p["club"]
            club_id = club_name.lower().replace(" ", "-").replace("'", "")
            if club_id not in seen:
                clubs.append({"id": club_id, "name": club_name})
                seen.add(club_id)

    log.info(f"  -> {len(clubs)} clubs, {len(player_data)} player records")
    return clubs, list(player_data.values())


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+", help="Specifica le stagioni da scaricare (es. 2024-2025)")
    args = parser.parse_args()

    start_time = time.time()
    log.info("=" * 60)
    log.info("38-0 Serie A -- FBref Scraper v2")
    log.info("=" * 60)

    # Step 1: Discover seasons
    seasons = get_all_seasons()

    if not seasons:
        log.error("No seasons discovered! Check your internet connection.")
        log.error("If FBref is blocking you, try again later or use a VPN.")
        sys.exit(1)

    # Filter to 1992/93 - 2025/26
    if args.seasons:
        target = {s: seasons.get(s, s) for s in args.seasons}
    else:
        target = {k: v for k, v in seasons.items() if k >= "1992-1993"}
    log.info(f"\nScraping {len(target)} seasons from {list(target.keys())[0]} to {list(target.keys())[-1]}")

    # Step 2: Scrape each season
    all_clubs = {}
    all_player_seasons = defaultdict(list)

    season_items = list(target.items())
    if HAS_TQDM:
        pbar = tqdm(season_items, desc="Seasons", unit="s")
    else:
        pbar = season_items

    for i, (season_label, season_slug) in enumerate(pbar):
        if not HAS_TQDM:
            log.info(f"\n{'='*40}")
            log.info(f"Season {i+1}/{len(season_items)}: {season_label}")

        try:
            clubs, players = scrape_season(season_label, season_slug)
        except Exception as e:
            log.error(f"  FAILED: {e}")
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

        # Rate limit: 4s base, extra pause every 5 requests
        if i < len(season_items) - 1:
            sleep = 4 + (2 if i % 5 == 4 else 0)
            time.sleep(sleep)

    # Step 3: Build output
    clubs_list = sorted(all_clubs.values(), key=lambda x: x["name"])
    clubs_path = OUT_DIR / "clubs.json"
    with open(clubs_path, "w", encoding="utf-8") as f:
        json.dump(clubs_list, f, ensure_ascii=False, indent=2)
    log.info(f"\nOK clubs.json: {len(clubs_list)} clubs -> {clubs_path}")

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

    # --- Normalize ratings globally to [60, 99] ---
    # Collect all raw ratings across every player-season
    raw_ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    if raw_ratings:
        r_min = min(raw_ratings)
        r_max = max(raw_ratings)
        r_range = r_max - r_min if r_max != r_min else 1.0
        log.info(f"  Normalizing ratings from raw [{r_min:.2f}, {r_max:.2f}] -> [60, 99]")
        for p in players_list:
            for s in p["seasons"]:
                normalized = 60.0 + (s["rating"] - r_min) / r_range * 39.0
                s["rating"] = round(max(60.0, min(99.0, normalized)), 1)

    players_path = OUT_DIR / "players.json"
    with open(players_path, "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)

    total_seasons = sum(len(p["seasons"]) for p in players_list)
    all_ratings = [s["rating"] for p in players_list for s in p["seasons"]]

    elapsed = time.time() - start_time

    log.info(f"\n{'='*60}")
    log.info(f"OK players.json: {len(players_list)} players ({total_seasons} total seasons) -> {players_path}")
    log.info(f"\nRIEPILOGO:")
    log.info(f"   Club: {len(clubs_list)}")
    log.info(f"   Giocatori: {len(players_list)}")
    log.info(f"   Stagioni giocatore: {total_seasons}")
    if all_ratings:
        log.info(f"   Rating min/max/mean: {min(all_ratings):.1f} / {max(all_ratings):.1f} / {sum(all_ratings)/len(all_ratings):.1f}")
    log.info(f"   Tempo: {elapsed:.0f}s ({elapsed/60:.1f}min)")
    log.info(f"{'='*60}")
    log.info("FATTO!")


if __name__ == "__main__":
    main()
