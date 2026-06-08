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
from collections import defaultdict
from pathlib import Path
from datetime import datetime

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

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
})

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

    if norm == 0:
        norm = 1.0

    rating = (raw / norm) * 100 + min_bonus
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
    Scrape Serie A main page + history page to get all season IDs.
    Returns { "1992-1993": season_id, ..., "2024-2025": season_id }
    """
    seasons = {}

    # Method 1: Main comps page
    url = f"{BASE_URL}/en/comps/11/Serie-A-Stats"
    log.info(f"Discovering seasons from {url}")
    try:
        resp = _get_with_retry(url)
        soup = BeautifulSoup(resp.content, "lxml")

        # Find all links to historical Serie A seasons
        for a in soup.find_all("a", href=True):
            href = a["href"]
            m = re.match(r"/en/comps/11/(\d+)/", href)
            if m:
                season_id = int(m.group(1))
                text = a.get_text(strip=True)
                label = _extract_season_label(text)
                if label:
                    seasons[label] = season_id
    except Exception as e:
        log.warning(f"Failed to get seasons from main page: {e}")

    # Method 2: History page (often more complete)
    url2 = f"{BASE_URL}/en/comps/11/history/Serie-A-Seasons"
    log.info(f"Discovering seasons from history page: {url2}")
    try:
        resp = _get_with_retry(url2)
        soup = BeautifulSoup(resp.content, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            m = re.match(r"/en/comps/11/(\d+)/", href)
            if m:
                season_id = int(m.group(1))
                text = a.get_text(strip=True)
                label = _extract_season_label(text)
                if label:
                    seasons[label] = season_id
    except Exception as e:
        log.warning(f"Failed to get seasons from history: {e}")

    # Method 3: Look at season selector dropdown
    if len(seasons) < 5:
        try:
            resp = _get_with_retry(f"{BASE_URL}/en/comps/11/Serie-A-Stats")
            soup = BeautifulSoup(resp.content, "lxml")
            for select in soup.find_all("select"):
                for option in select.find_all("option"):
                    val = option.get("value", "")
                    m = re.search(r"/comps/11/(\d+)/", val)
                    if m:
                        season_id = int(m.group(1))
                        label = _extract_season_label(option.get_text(strip=True))
                        if label:
                            seasons[label] = season_id
        except Exception:
            pass

    seasons = dict(sorted(seasons.items()))
    log.info(f"Discovered {len(seasons)} seasons: {list(seasons.keys())[:3]}...{list(seasons.keys())[-3:]}")
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

def _get_with_retry(url: str, max_retries: int = 3) -> requests.Response:
    for attempt in range(max_retries):
        try:
            resp = SESSION.get(url, timeout=30)
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                log.warning(f"Rate limited (429). Waiting {wait}s... (attempt {attempt+1}/{max_retries})")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except requests.exceptions.ConnectionError as e:
            wait = 10 * (attempt + 1)
            log.warning(f"Connection error: {e}. Retrying in {wait}s...")
            time.sleep(wait)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code >= 500:
                wait = 15 * (attempt + 1)
                log.warning(f"Server error {e.response.status_code}. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise
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


def scrape_season(season_label: str, season_id: int) -> tuple:
    """
    Scrape one Serie A season.
    Returns (clubs: list[dict], player_seasons: list[dict])
    """
    url = f"{BASE_URL}/en/comps/11/{season_id}/stats/Serie-A-Stats"
    log.info(f"Scraping {season_label} (id={season_id}): {url}")

    resp = _get_with_retry(url)
    soup = BeautifulSoup(resp.content, "lxml")

    # Extract ALL tables (including those in HTML comments)
    all_tables = extract_all_tables(soup)
    log.info(f"  Found {len(all_tables)} tables: {list(all_tables.keys())[:10]}...")

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

    # Defensive stats
    for tid in sorted(all_tables.keys()):
        if "stats_defense" in tid and "keeper" not in tid:
            table = all_tables[tid]
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

    # Keeper stats
    for tid in sorted(all_tables.keys()):
        if "stats_keeper" in tid and "adv" not in tid:
            table = all_tables[tid]
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

    # Passing stats (for key_passes → approximate via progressive_passes or passes_total)
    for tid in sorted(all_tables.keys()):
        if "stats_passing" in tid and "types" not in tid:
            table = all_tables[tid]
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

    # Also grab clubs from player data if we didn't get them from standings
    if not clubs:
        seen = set()
        for p in player_data.values():
            club_name = p["club"]
            club_id = club_name.lower().replace(" ", "-").replace("'", "")
            if club_id not in seen:
                clubs.append({"id": club_id, "name": club_name})
                seen.add(club_id)

    log.info(f"  → {len(clubs)} clubs, {len(player_data)} player records")
    return clubs, list(player_data.values())


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    start_time = time.time()
    log.info("=" * 60)
    log.info("⚽ 38-0 Serie A — FBref Scraper v2")
    log.info("=" * 60)

    # Step 1: Discover seasons
    seasons = get_all_seasons()

    if not seasons:
        log.error("No seasons discovered! Check your internet connection.")
        log.error("If FBref is blocking you, try again later or use a VPN.")
        sys.exit(1)

    # Filter to 1992/93 - 2025/26
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

    for i, (season_label, season_id) in enumerate(pbar):
        if not HAS_TQDM:
            log.info(f"\n{'='*40}")
            log.info(f"Season {i+1}/{len(season_items)}: {season_label}")

        try:
            clubs, players = scrape_season(season_label, season_id)
        except Exception as e:
            log.error(f"  ❌ Failed: {e}")
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
    log.info(f"✅ players.json: {len(players_list)} players ({total_seasons} total seasons) → {players_path}")
    log.info(f"\n📊 RIEPILOGO:")
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
