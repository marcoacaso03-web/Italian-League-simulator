#!/usr/bin/env python3
"""
Scraping FBref per Serie A — genera clubs.json + players.json
da usare nel gioco 38-0 Serie A.

ESEGUIRE DAL PROPRIO PC/MAC:
    pip install requests beautifulsoup4 lxml
    python scrape_serie_a.py

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
from collections import defaultdict
from pathlib import Path

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

OUT_DIR = Path(__file__).parent.parent / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
})

# ---------------------------------------------------------------------------
# Mappatura stagioni Serie A su FBref
# FBref usa ID numerici per le stagioni storiche.
# URL: https://fbref.com/en/comps/11/{season_id}/Serie-A-Stats
# ---------------------------------------------------------------------------

# Generiamo la mappatura dinamicamente dalla pagina principale
SERIE_A_COMP_ID = 11
BASE_URL = "https://fbref.com"

# --- Position mapping from FBref positions to our 4 categories ---
POSITION_MAP = {
    "GK": "GK",
    "GKMF": "GK",
    "CB": "DEF",
    "DF": "DEF",
    "FB": "DEF",
    "LB": "DEF",
    "RB": "DEF",
    "WB": "DEF",
    "LWB": "DEF",
    "RWB": "DEF",
    "SW": "DEF",
    "DMF": "MID",
    "MF": "MID",
    "CM": "MID",
    "CDM": "MID",
    "CAM": "MID",
    "AMF": "MID",
    "LM": "MID",
    "RM": "MID",
    "LW": "MID",
    "RW": "MID",
    "FW": "ATT",
    "ST": "ATT",
    "CF": "ATT",
    "LF": "ATT",
    "RF": "ATT",
    "LMF": "MID",
    "RMF": "MID",
}


def classify_position(pos: str) -> str:
    """Classify FBref position string into GK/DEF/MID/ATT."""
    if not pos:
        return "MID"
    # FBref positions are comma-separated, take the primary one
    primary = pos.split(",")[0].strip()
    # Try exact match first
    if primary in POSITION_MAP:
        return POSITION_MAP[primary]
    # Try 2-char prefix
    if len(primary) >= 2 and primary[:2] in POSITION_MAP:
        return POSITION_MAP[primary[:2]]
    # Heuristic: ends in B → defender, ends in M → mid, ends in F/W → attacker
    upper = primary.upper()
    if "GK" in upper:
        return "GK"
    if any(x in upper for x in ["CB", "LB", "RB", "WB", "DF"]):
        return "DEF"
    if any(x in upper for x in ["MF", "CM", "DM", "AM", "LM", "RM"]):
        return "MID"
    if any(x in upper for x in ["FW", "ST", "CF", "LW", "RW", "WF"]):
        return "ATT"
    return "MID"


# ---------------------------------------------------------------------------
# Rating calculation per position
# All ratings normalized to 1-100 scale
# ---------------------------------------------------------------------------

def normalize_rating(raw: float, pos_cat: str, season_data: dict) -> float:
    """
    Position-specific rating formulas, then normalize to 1-100.

    ATT:  (goals × 3 + assists × 1.5 + apps × 0.5) / norm
    MID:  (goals × 2 + assists × 2 + apps × 0.5 + key_passes × 1) / norm
    DEF:  (apps × 1 + tackles_won × 0.5 + clean_sheets × 1.5 - errors × 2) / norm
    GK:   (clean_sheets × 2 + save_pct × 0.3 - goals_against × 0.3) / norm
    """
    apps = season_data.get("apps", 0) or 0
    goals = season_data.get("goals", 0) or 0
    assists = season_data.get("assists", 0) or 0
    # Advanced stats (may be None)
    key_passes = season_data.get("key_passes", 0) or 0
    tackles_won = season_data.get("tackles_won", 0) or 0
    clean_sheets = season_data.get("clean_sheets", 0) or 0
    errors = season_data.get("errors_leading_to_goal", 0) or 0
    save_pct = season_data.get("save_pct", 0) or 0  # 0-100
    goals_against = season_data.get("goals_against", 0) or 0
    minutes = season_data.get("minutes", 0) or 0

    # Minutes-based bonus (players who play more are better)
    min_bonus = min(minutes / 3420, 1.0) * 10 if minutes else 0  # 3420 = 38×90

    if pos_cat == "ATT":
        raw = goals * 3 + assists * 1.5 + apps * 0.5
        # Typical top striker: 25 goals, 8 assists, 35 apps → 75+12.5+17.5 = 105
        # Typical average: 8 goals, 3 assists, 25 apps → 24+4.5+12.5 = 41
        norm = 1.05  # divide by this to get ~100 for top
    elif pos_cat == "MID":
        raw = goals * 2 + assists * 2 + apps * 0.5 + key_passes * 1
        # Typical top mid: 12 goals, 12 assists, 35 apps, 80 kp → 24+24+17.5+80 = 145.5
        norm = 1.455
    elif pos_cat == "DEF":
        raw = apps * 1 + tackles_won * 0.5 + clean_sheets * 1.5 - errors * 2
        # Typical top CB: 35 apps, 60 tackles, 15 cs, 0 errors → 35+30+22.5 = 87.5
        norm = 0.875
    elif pos_cat == "GK":
        raw = clean_sheets * 2 + save_pct * 0.3 - goals_against * 0.3
        # Typical top GK: 15 cs, 75 save%, 30 ga → 30+22.5-9 = 43.5
        norm = 0.435
    else:
        raw = apps + goals + assists
        norm = 1.0

    if norm == 0:
        norm = 1.0

    rating = (raw / norm) * 100 + min_bonus

    # Clamp to 1-99 (reserve 100 for truly legendary outlier)
    rating = max(1.0, min(99.0, rating))

    return round(rating, 1)


# ---------------------------------------------------------------------------
# 1. Discover all Serie A seasons from FBref
# ---------------------------------------------------------------------------

def get_seasons_map() -> dict:
    """
    Scrape the Serie A history page to get all season IDs.
    Returns { "1992-1993": season_id, ... }
    """
    url = f"{BASE_URL}/en/comps/11/Serie-A-Stats"
    log.info(f"Fetching season map from {url}")
    resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "lxml")

    seasons = {}
    # FBref has a season selector dropdown or a table of historical seasons
    # Look for links like /en/comps/11/{season_id}/Serie-A-Stats
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.match(r"/en/comps/11/(\d+)/", href)
        if m:
            season_id = int(m.group(1))
            # The link text is usually like "2023-2024 Serie A"
            text = a.get_text(strip=True)
            # Extract year range
            year_match = re.search(r"(\d{4})-(\d{4})", text)
            if year_match:
                season_label = f"{year_match.group(1)}-{year_match.group(2)}"
            else:
                # FBref sometimes uses single year like "2024"
                year_match2 = re.search(r"(\d{4})", text)
                if year_match2:
                    y = int(year_match2.group(1))
                    season_label = f"{y}-{y+1}"
                else:
                    continue
            seasons[season_label] = season_id

    # Also try the current season from the page
    # FBref season dropdown is in a <select> or <div class="season_picker">
    if not seasons:
        # Fallback: try parsing from table headers
        log.warning("Could not find seasons from links, trying alternative method")

    log.info(f"Found {len(seasons)} seasons: {list(seasons.keys())[:5]}...{list(seasons.keys())[-3:]}")
    return seasons


def get_seasons_from_history() -> dict:
    """
    Alternative: scrape the Serie A seasons history page.
    URL: https://fbref.com/en/comps/11/history/Serie-A-Seasons
    """
    url = f"{BASE_URL}/en/comps/11/history/Serie-A-Seasons"
    log.info(f"Fetching season history from {url}")
    resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "lxml")

    seasons = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.match(r"/en/comps/11/(\d+)/", href)
        if m:
            season_id = int(m.group(1))
            text = a.get_text(strip=True)
            year_match = re.search(r"(\d{4})-(\d{2,4})", text)
            if year_match:
                y1 = year_match.group(1)
                y2 = year_match.group(2)
                if len(y2) == 2:
                    y2 = y1[:2] + y2
                season_label = f"{y1}-{y2}"
            else:
                year_match2 = re.search(r"(\d{4})", text)
                if year_match2:
                    y = int(year_match2.group(1))
                    season_label = f"{y}-{y+1}"
                else:
                    continue
            seasons[season_label] = season_id

    log.info(f"Found {len(seasons)} seasons from history page")
    return seasons


# ---------------------------------------------------------------------------
# 2. Scrape clubs and player stats for a single season
# ---------------------------------------------------------------------------

def scrape_season(season_label: str, season_id: int) -> tuple:
    """
    Scrape one Serie A season page.
    Returns (clubs_list, players_list) for that season.

    clubs_list: [{id, name}]
    players_list: [{name, position, club, season, rating, apps, goals, assists, ...advanced}]
    """
    url = f"{BASE_URL}/en/comps/11/{season_id}/stats/Serie-A-Stats"
    log.info(f"Scraping season {season_label} (id={season_id}) from {url}")

    resp = SESSION.get(url, timeout=30)
    if resp.status_code == 429:
        log.warning("Rate limited! Sleeping 30s...")
        time.sleep(30)
        resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "lxml")

    # --- Squad standings table (to get clubs) ---
    clubs = []
    squads_table = soup.find("table", {"id": re.compile(r"results\d+")})
    if not squads_table:
        squads_table = soup.find("table", {"id": "results2024-2025111overalls"})
    # Try finding by caption
    if not squads_table:
        for table in soup.find_all("table"):
            caption = table.find("caption")
            if caption and "Squad" in caption.get_text():
                squads_table = table
                break

    if squads_table:
        for row in squads_table.find_all("tr")[1:]:  # skip header
            td = row.find("td", {"data-stat": "team"})
            if td:
                a = td.find("a")
                club_name = a.get_text(strip=True) if a else td.get_text(strip=True)
                if club_name and club_name not in [c["name"] for c in clubs]:
                    clubs.append({"id": club_name.lower().replace(" ", "-"), "name": club_name})
    else:
        log.warning(f"  Could not find squads table for {season_label}")

    # --- Player stats tables ---
    # FBref has multiple stats tables: standard, shooting, passing, defense, etc.
    # Primary: table id like "stats_standard_11" or "stats_standard"
    players = []
    player_data = {}  # keyed by player name for merging

    # --- Standard stats ---
    std_table = None
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if "stats_standard" in tid or "stats_players_standard" in tid:
            std_table = table
            break

    if not std_table:
        # Try the div-based layout
        for table in soup.find_all("table"):
            caption = table.find("caption")
            if caption and "Standard Stats" in caption.get_text():
                std_table = table
                break

    if std_table:
        _parse_standard_stats(std_table, season_label, player_data)
    else:
        log.warning(f"  No standard stats table found for {season_label}")

    # --- Shooting stats (for key_passes) ---
    # We'll attempt to get extra stats from the same page or sub-pages

    # --- Defensive stats ---
    def_table = None
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if "stats_defense" in tid:
            def_table = table
            break
    if def_table:
        _parse_defense_stats(def_table, season_label, player_data)

    # --- Goalkeeper stats ---
    gk_table = None
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if "stats_keeper" in tid:
            gk_table = table
            break
    if gk_table:
        _parse_keeper_stats(gk_table, season_label, player_data)

    # --- Passing stats (for key_passes) ---
    pass_table = None
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if "stats_passing" in tid:
            pass_table = table
            break
    if pass_table:
        _parse_passing_stats(pass_table, season_label, player_data)

    # Convert to list
    players = list(player_data.values())
    log.info(f"  Season {season_label}: {len(clubs)} clubs, {len(players)} players")

    return clubs, players


def _safe_int(val) -> int:
    """Convert table cell text to int, handling empty/comma-formatted numbers."""
    if not val or val in ("", "-", "—", "N/A"):
        return 0
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def _safe_float(val) -> float:
    """Convert table cell text to float."""
    if not val or val in ("", "-", "—", "N/A"):
        return 0.0
    try:
        return float(str(val).replace(",", "").replace("%", "").strip())
    except (ValueError, TypeError):
        return 0.0


def _parse_standard_stats(table, season_label: str, player_data: dict):
    """Parse the standard stats table."""
    cols = [th.get("data-stat", "") for th in table.find("thead").find_all("th")]
    # Remove duplicate header rows (FBref has a second header row)
    rows = table.find("tbody").find_all("tr")
    # Skip rows that are thead repeats (class="over_header" or similar)
    rows = [r for r in rows if not r.get("class") or "over_header" not in " ".join(r.get("class", []))]

    for row in rows:
        cells = row.find_all(["td", "th"])
        if len(cells) < 5:
            continue

        data = {}
        for cell in cells:
            stat = cell.get("data-stat", "")
            data[stat] = cell.get_text(strip=True)

        name = data.get("player", "")
        if not name:
            continue

        # Skip if this is a team summary row
        if data.get("team", "") == "" and "squad" not in data:
            continue

        club = data.get("team", "") or data.get("squad", "")
        pos = data.get("position", "")
        apps = _safe_int(data.get("games", "0"))
        goals = _safe_int(data.get("goals", "0"))
        assists = _safe_int(data.get("assists", "0"))
        minutes = _safe_int(data.get("minutes", "0"))
        clean_sheets = _safe_int(data.get("clean_sheets", "0"))

        # Skip players with 0 appearances (unused subs)
        if apps == 0:
            continue

        pos_cat = classify_position(pos)

        key = f"{name}|{club}|{season_label}"
        player_data[key] = {
            "name": name,
            "position": pos_cat,
            "pos_detail": pos,
            "club": club,
            "season": season_label,
            "apps": apps,
            "goals": goals,
            "assists": assists,
            "minutes": minutes,
            "clean_sheets": clean_sheets,
            "tackles_won": 0,
            "errors_leading_to_goal": 0,
            "key_passes": 0,
            "save_pct": 0.0,
            "goals_against": 0,
        }


def _parse_defense_stats(table, season_label: str, player_data: dict):
    """Merge defensive stats into existing player_data."""
    rows = table.find("tbody").find_all("tr")
    rows = [r for r in rows if not r.get("class") or "over_header" not in " ".join(r.get("class", []))]

    for row in rows:
        data = {}
        for cell in row.find_all(["td", "th"]):
            stat = cell.get("data-stat", "")
            data[stat] = cell.get_text(strip=True)

        name = data.get("player", "")
        club = data.get("team", "") or data.get("squad", "")
        if not name:
            continue

        key = f"{name}|{club}|{season_label}"
        if key in player_data:
            player_data[key]["tackles_won"] = _safe_int(data.get("tackles_won", "0"))
            player_data[key]["errors_leading_to_goal"] = _safe_int(data.get("errors_leading_to_goal", "0"))


def _parse_keeper_stats(table, season_label: str, player_data: dict):
    """Merge goalkeeper stats into existing player_data."""
    rows = table.find("tbody").find_all("tr")
    rows = [r for r in rows if not r.get("class") or "over_header" not in " ".join(r.get("class", []))]

    for row in rows:
        data = {}
        for cell in row.find_all(["td", "th"]):
            stat = cell.get("data-stat", "")
            data[stat] = cell.get_text(strip=True)

        name = data.get("player", "")
        club = data.get("team", "") or data.get("squad", "")
        if not name:
            continue

        key = f"{name}|{club}|{season_label}"
        if key in player_data:
            player_data[key]["save_pct"] = _safe_float(data.get("save_pct", "0"))
            player_data[key]["goals_against"] = _safe_int(data.get("goals_against", "0"))
            player_data[key]["clean_sheets"] = _safe_int(data.get("clean_sheets", "0"))


def _parse_passing_stats(table, season_label: str, player_data: dict):
    """Merge passing stats (key_passes) into existing player_data."""
    rows = table.find("tbody").find_all("tr")
    rows = [r for r in rows if not r.get("class") or "over_header" not in " ".join(r.get("class", []))]

    for row in rows:
        data = {}
        for cell in row.find_all(["td", "th"]):
            stat = cell.get("data-stat", "")
            data[stat] = cell.get_text(strip=True)

        name = data.get("player", "")
        club = data.get("team", "") or data.get("squad", "")
        if not name:
            continue

        key = f"{name}|{club}|{season_label}"
        if key in player_data:
            player_data[key]["key_passes"] = _safe_int(data.get("passes_live", "0"))


# ---------------------------------------------------------------------------
# 3. Main orchestration
# ---------------------------------------------------------------------------

def main():
    log.info("=" * 60)
    log.info("38-0 Serie A — FBref Scraper")
    log.info("=" * 60)

    # --- Step 1: Get all season IDs ---
    seasons = {}
    try:
        seasons = get_seasons_map()
    except Exception as e:
        log.error(f"Failed to get seasons from main page: {e}")

    if len(seasons) < 5:
        log.info("Trying history page as fallback...")
        try:
            seasons = get_seasons_from_history()
        except Exception as e:
            log.error(f"Failed to get seasons from history page: {e}")

    if not seasons:
        # Hardcoded fallback for common Serie A seasons on FBref
        log.warning("Using hardcoded season fallback!")
        seasons = {
            "2024-2025": 2024,
            "2023-2024": 2023,
            "2022-2023": 2022,
            "2021-2022": 2021,
            "2020-2021": 2020,
            "2019-2020": 2019,
            "2018-2019": 2018,
            "2017-2018": 2017,
            "2016-2017": 2016,
            "2015-2016": 2015,
        }
        # NOTE: FBref season IDs are NOT always just the year.
        # The actual IDs are like 2024 for 2024-25 but they vary.
        # If scraping the season map works, we'll have the real IDs.

    # Filter to desired era: 1992/93 - 2025/26
    # (FBref Serie A coverage starts from 1992-93)
    target_seasons = {k: v for k, v in sorted(seasons.items())}

    log.info(f"Will scrape {len(target_seasons)} seasons: {list(target_seasons.keys())}")

    # --- Step 2: Scrape each season ---
    all_clubs = {}  # keyed by id
    all_player_seasons = defaultdict(list)  # keyed by player name

    for i, (season_label, season_id) in enumerate(target_seasons.items()):
        log.info(f"\n--- Season {i+1}/{len(target_seasons)}: {season_label} ---")
        try:
            clubs, players = scrape_season(season_label, season_id)
        except Exception as e:
            log.error(f"Failed to scrape {season_label}: {e}")
            continue

        # Collect clubs
        for c in clubs:
            if c["id"] not in all_clubs:
                all_clubs[c["id"]] = c

        # Process players: calculate ratings
        for p in players:
            rating = normalize_rating(0, p["position"], p)
            season_entry = {
                "club": p["club"],
                "season": p["season"],
                "rating": rating,
                "apps": p["apps"],
                "goals": p["goals"],
                "assists": p["assists"],
            }
            # Key by normalized name (case-insensitive)
            name_key = p["name"].strip()
            all_player_seasons[name_key].append({
                "name": p["name"],
                "position": p["position"],
                "season_entry": season_entry,
            })

        # Rate limiting: be nice to FBref
        if i < len(target_seasons) - 1:
            sleep_time = 4 + (1 if i % 5 == 0 else 0)  # 4-5 seconds between requests
            log.info(f"  Sleeping {sleep_time}s...")
            time.sleep(sleep_time)

    # --- Step 3: Build output files ---

    # clubs.json
    clubs_list = sorted(all_clubs.values(), key=lambda x: x["name"])
    clubs_path = OUT_DIR / "clubs.json"
    with open(clubs_path, "w", encoding="utf-8") as f:
        json.dump(clubs_list, f, ensure_ascii=False, indent=2)
    log.info(f"\n✅ clubs.json: {len(clubs_list)} clubs → {clubs_path}")

    # players.json — merge seasons per player
    players_list = []
    player_id_counter = 1
    seen_names = {}

    for name_key, entries in sorted(all_player_seasons.items()):
        # Determine primary position (most common across seasons)
        pos_counts = defaultdict(int)
        for e in entries:
            pos_counts[e["position"]] += 1
        primary_pos = max(pos_counts, key=pos_counts.get)

        seasons_list = sorted([e["season_entry"] for e in entries], key=lambda x: x["season"])

        # Use the most common name variant
        name = entries[0]["name"]

        player = {
            "id": f"p{player_id_counter:05d}",
            "name": name,
            "position": primary_pos,
            "seasons": seasons_list,
        }
        players_list.append(player)
        player_id_counter += 1

    players_path = OUT_DIR / "players.json"
    with open(players_path, "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)
    log.info(f"✅ players.json: {len(players_list)} players ({sum(len(p['seasons']) for p in players_list)} total seasons) → {players_path}")

    # --- Summary ---
    log.info("\n" + "=" * 60)
    log.info("RIEPILOGO")
    log.info(f"  Club Serie A: {len(clubs_list)}")
    log.info(f"  Giocatori: {len(players_list)}")
    log.info(f"  Tot stagioni giocatore: {sum(len(p['seasons']) for p in players_list)}")

    # Rating distribution
    all_ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    if all_ratings:
        log.info(f"  Rating min: {min(all_ratings):.1f}")
        log.info(f"  Rating max: {max(all_ratings):.1f}")
        log.info(f"  Rating mean: {sum(all_ratings)/len(all_ratings):.1f}")

    log.info("=" * 60)
    log.info("FATTO! 🎉")


if __name__ == "__main__":
    main()
