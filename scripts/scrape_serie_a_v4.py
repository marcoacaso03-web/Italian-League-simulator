#!/usr/bin/env python3
"""
Scraping FBref per Serie A — VERSIONE 4 (Puppeteer proxy)

Problema: Cloudflare blocca sia requests che le Vercel serverless functions.
Soluzione: usare un server locale Puppeteer che gira sul PC di Marco,
oppure usare SeleniumBase (che già funzionava per le history/standings).

Questa versione usa SeleniumBase solo per fetchare l'HTML,
poi lo parsifica con BeautifulSoup come prima.

FIX PRINCIPALI vs v3:
1. SeleniumBase fetcha l'HTML grezzo
2. BS4 parsifica estraendo tabelle dai commenti HTML
3. Table IDs specifici per Serie A (stats_standard_11, etc.)
4. data-stat="squad" per le tabelle player (non "team")
5. Defensive: data-stat="errors" non errors_leading_to_goal
6. Passing: assisted_shots come key_passes

ESEGUIRE DAL PROPRIO PC/MAC:
    pip install requests beautifulsoup4 html5lib tqdm seleniumbase
    python scrape_serie_a_v4.py

    # Solo alcune stagioni (per test rapido)
    python scrape_serie_a_v4.py --seasons 2023-2024 2024-2025

    # Con debug (salva HTML per ispezione)
    python scrape_serie_a_v4.py --debug --seasons 2024-2025
"""

import json
import re
import sys
import time
import logging
import argparse
import atexit
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup, Comment

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

try:
    from seleniumbase import Driver
    HAS_SB = True
except ImportError:
    HAS_SB = False

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
COMP_ID = 11

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
# SELENIUMBASE DRIVER
# ===========================================================================

_DRIVER = None


def get_driver():
    global _DRIVER
    if _DRIVER is None:
        if not HAS_SB:
            log.error("seleniumbase not installed! pip install seleniumbase")
            sys.exit(1)
        log.info("Starting SeleniumBase (uc=True, headless=True)...")
        _DRIVER = Driver(uc=True, headless=True)
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


def fetch_page(url: str) -> str:
    """Fetch page HTML via SeleniumBase, wait for Cloudflare to resolve."""
    driver = get_driver()
    driver.get(url)

    # Wait for content to load
    for _ in range(40):  # wait up to 20s
        src = driver.page_source
        if "<table" in src and len(src) > 10000:
            return src
        # Still on CF challenge page
        lower = src.lower()
        if "just a moment" in lower or "checking" in lower:
            time.sleep(0.5)
            continue
        # Some content loaded but no tables yet
        if "<body" in lower and len(src) > 5000:
            time.sleep(0.5)
            continue
        time.sleep(0.5)

    # Return whatever we have
    return driver.page_source


# ===========================================================================
# EXTRACT TABLES (visible + hidden in HTML comments)
# ===========================================================================

def extract_all_tables(html: str, debug_path: Path = None) -> dict:
    """
    Extract ALL tables from both visible DOM and HTML comments.
    This is the critical function — FBref hides stats tables in <!-- ... -->.
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = {}

    # 1. Visible tables in the DOM
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if tid:
            tables[tid] = table

    # 2. Tables hidden in HTML comments
    # FBref wraps non-active tab content in comments like:
    # <!-- <div class="table_wrapper tab_wrapper ..."> <table id="stats_standard_11"> ... </table> </div> -->
    comments = soup.find_all(string=lambda text: isinstance(text, Comment))
    log.debug(f"  Found {len(comments)} HTML comments")

    for i, comment in enumerate(comments):
        comment_text = str(comment)
        if "<table" not in comment_text:
            continue
        try:
            # Use html.parser (lxml can drop comments)
            comment_soup = BeautifulSoup(comment_text, "html.parser")
            for table in comment_soup.find_all("table"):
                tid = table.get("id", "")
                if tid and tid not in tables:
                    tables[tid] = table
                    log.debug(f"    Comment #{i}: found table {tid}")
        except Exception as e:
            log.debug(f"    Comment #{i}: parse error: {e}")

    # 3. LAST RESORT: regex extraction from raw HTML
    # Sometimes BS4 doesn't find comments that are adjacent to other elements
    if not any(t.startswith("stats_") for t in tables):
        log.info("  No stats tables found via BS4! Trying regex extraction...")
        _extract_tables_regex(html, tables)

    if debug_path:
        with open(debug_path, "w", encoding="utf-8") as f:
            f.write(html)
        log.info(f"  Saved debug HTML to {debug_path}")

    return tables


def _extract_tables_regex(html: str, tables: dict):
    """
    Extract tables from raw HTML using regex pattern matching.
    This is a fallback when BS4 fails to parse comments.
    """
    # Find all comments in raw HTML
    comment_pattern = re.compile(r'<!--(.*?)-->', re.DOTALL)
    for m in comment_pattern.finditer(html):
        comment_text = m.group(1)
        if '<table' not in comment_text:
            continue

        # Find table IDs in this comment
        for tid_match in re.finditer(r'<table[^>]*id="([^"]+)"', comment_text):
            tid = tid_match.group(1)
            if tid in tables:
                continue

            # Extract the table HTML: from <table id="..."> to matching </table>
            start = tid_match.start()
            # Find matching closing tag (simple nesting-aware search)
            table_start = comment_text.rfind('<table', 0, start + 1)
            if table_start == -1:
                table_start = start

            # Extract table HTML up to </table>
            depth = 0
            pos = table_start
            table_html = ""
            while pos < len(comment_text):
                if comment_text[pos:].startswith('<table'):
                    depth += 1
                    pos += 6
                elif comment_text[pos:].startswith('</table'):
                    depth -= 1
                    if depth == 0:
                        # Find the > of </table>
                        close = comment_text.find('>', pos)
                        if close != -1:
                            table_html = comment_text[table_start:close + 1]
                        break
                    pos += 7
                else:
                    pos += 1

            if not table_html:
                continue

            # Parse this table HTML
            try:
                table_soup = BeautifulSoup(table_html, "html.parser")
                if table_soup.find("table"):
                    tables[tid] = table_soup.find("table")
                    log.info(f"    Regex found table: {tid}")
            except Exception as e:
                log.debug(f"    Regex parse error for {tid}: {e}")


# ===========================================================================
# SEASON DISCOVERY
# ===========================================================================

def get_all_seasons() -> dict:
    """Discover all Serie A seasons from FBref."""
    seasons = {}

    url = f"{BASE_URL}/en/comps/11/history/Serie-A-Seasons"
    log.info(f"Discovering seasons: {url}")
    html = fetch_page(url)
    soup = BeautifulSoup(html, "html.parser")

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        # YYYY-YYYY slug format
        m = re.match(r"/en/comps/11/(\d{4}-\d{4})/", href)
        if m:
            slug = m.group(1)
            seasons[slug] = slug
            continue
        # Numeric ID format
        m = re.match(r"/en/comps/11/(\d+)/", href)
        if m:
            label = _extract_season_label(text)
            if label and label not in seasons:
                seasons[label] = m.group(1)

    # Also check dropdown selectors
    for select in soup.find_all("select"):
        for option in select.find_all("option"):
            val = option.get("value", "")
            m = re.search(r"/comps/11/(\d{4}-\d{4})/", val)
            if m:
                seasons[m.group(1)] = m.group(1)
            m = re.search(r"/comps/11/(\d+)/", val)
            if m:
                label = _extract_season_label(option.get_text(strip=True))
                if label and label not in seasons:
                    seasons[label] = m.group(1)

    seasons = dict(sorted(seasons.items()))
    log.info(f"Discovered {len(seasons)} seasons")
    if seasons:
        log.info(f"  {list(seasons.keys())[0]} → {list(seasons.keys())[-1]}")
    return seasons


def _extract_season_label(text: str) -> str | None:
    m = re.search(r"(\d{4})-(\d{4})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
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
    rows_data = []
    tbody = table.find("tbody")
    if not tbody:
        return rows_data

    for row in tbody.find_all("tr"):
        row_classes = " ".join(row.get("class", []))
        if "over_header" in row_classes or "thead" in row_classes:
            continue

        data = {}
        for cell in row.find_all(["td", "th"]):
            stat = cell.get("data-stat", "")
            if stat:
                data[stat] = cell.get_text(strip=True)

        if data.get("player") or data.get("squad"):
            rows_data.append(data)

    return rows_data


# ===========================================================================
# SCRAPE SINGLE SEASON
# ===========================================================================

def scrape_season(season_label: str, season_slug: str, debug: bool = False) -> tuple:
    if season_slug == "current":
        url = f"{BASE_URL}/en/comps/11/Serie-A-Stats"
    elif re.match(r"\d{4}-\d{4}", season_slug):
        url = f"{BASE_URL}/en/comps/11/{season_slug}/{season_slug}-Serie-A-Stats"
    else:
        url = f"{BASE_URL}/en/comps/11/{season_slug}/stats/Serie-A-Stats"

    log.info(f"Scraping {season_label}: {url}")

    html = fetch_page(url)

    # Debug: save HTML
    debug_path = OUT_DIR / f"debug_{season_label}.html" if debug else None
    all_tables = extract_all_tables(html, debug_path)

    table_ids = sorted(all_tables.keys())
    stats_tables = [t for t in table_ids if t.startswith("stats_")]
    results_tables = [t for t in table_ids if t.startswith("results")]
    log.info(f"  Found {len(all_tables)} tables ({len(stats_tables)} stats, {len(results_tables)} results)")

    for t in stats_tables:
        log.info(f"    📊 {t}")

    # --- CLUBS ---
    clubs = []
    for tid in results_tables:
        if "overall" in tid:
            table = all_tables[tid]
            rows = parse_table_rows(table)
            for row in rows:
                # Standings table: "team" has the linked name, "squad" has the text
                team = row.get("team", "") or row.get("squad", "")
                if team:
                    # Remove any leading/trailing whitespace from team name
                    team = team.strip()
                    club_id = team.lower().replace(" ", "-").replace("'", "")
                    if club_id not in [c["id"] for c in clubs]:
                        clubs.append({"id": club_id, "name": team})
            break

    # --- PLAYER STATS ---
    player_data = {}

    # === STANDARD STATS ===
    # Try multiple possible table IDs
    std_tid = None
    for candidate in [f"stats_standard_{COMP_ID}", "stats_standard",
                      f"stats_summary_{COMP_ID}", "stats_summary"]:
        if candidate in all_tables:
            std_tid = candidate
            break

    if std_tid:
        log.info(f"  Parsing standard stats: {std_tid}")
        rows = parse_table_rows(all_tables[std_tid])
        count = 0
        for row in rows:
            name = row.get("player", "").strip()
            # CRITICAL: player tables use "squad", not "team"
            club = row.get("squad", "") or row.get("team", "")
            club = club.strip()
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
    else:
        log.warning(f"  ⚠ No standard stats table found!")
        log.warning(f"    Available stats tables: {stats_tables}")

    # === DEFENSIVE STATS ===
    def_tid = None
    for candidate in [f"stats_defense_{COMP_ID}", "stats_defense"]:
        if candidate in all_tables and "keeper" not in candidate:
            def_tid = candidate
            break

    if def_tid:
        rows = parse_table_rows(all_tables[def_tid])
        merged = 0
        for row in rows:
            name = row.get("player", "").strip()
            club = row.get("squad", "") or row.get("team", "")
            key = f"{name}|{club}|{season_label}"
            if key in player_data:
                player_data[key]["tackles_won"] = _safe_int(row.get("tackles_won", "0"))
                player_data[key]["errors"] = _safe_int(row.get("errors", "0"))
                merged += 1
        log.info(f"  Defense: merged {merged}")

    # === KEEPER STATS ===
    gk_tid = None
    for candidate in [f"stats_keeper_{COMP_ID}", "stats_keeper"]:
        if candidate in all_tables and "adv" not in candidate:
            gk_tid = candidate
            break

    if gk_tid:
        rows = parse_table_rows(all_tables[gk_tid])
        merged = 0
        for row in rows:
            name = row.get("player", "").strip()
            club = row.get("squad", "") or row.get("team", "")
            key = f"{name}|{club}|{season_label}"
            if key in player_data:
                player_data[key]["save_pct"] = _safe_float(row.get("save_pct", "0"))
                player_data[key]["goals_against"] = _safe_int(row.get("goals_against", "0"))
                cs = _safe_int(row.get("clean_sheets", "0"))
                player_data[key]["clean_sheets"] = max(player_data[key]["clean_sheets"], cs)
                player_data[key]["position"] = "GK"
                merged += 1
        log.info(f"  Keeper: merged {merged}")

    # === PASSING STATS ===
    pass_tid = None
    for candidate in [f"stats_passing_{COMP_ID}", "stats_passing"]:
        if candidate in all_tables and "types" not in candidate:
            pass_tid = candidate
            break

    if pass_tid:
        rows = parse_table_rows(all_tables[pass_tid])
        merged = 0
        for row in rows:
            name = row.get("player", "").strip()
            club = row.get("squad", "") or row.get("team", "")
            key = f"{name}|{club}|{season_label}"
            if key in player_data:
                kp = _safe_int(row.get("assisted_shots", "0"))
                if kp == 0:
                    kp = _safe_int(row.get("progressive_passes", "0"))
                player_data[key]["key_passes"] = kp
                merged += 1
        log.info(f"  Passing: merged {merged}")

    # Extract clubs from player data if standings table missing
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
    parser = argparse.ArgumentParser(description="Scrape FBref Serie A (v4)")
    parser.add_argument("--seasons", nargs="+", help="Only scrape these seasons (e.g. 2023-2024)")
    parser.add_argument("--debug", action="store_true", help="Save HTML pages for debugging")
    args = parser.parse_args()

    start_time = time.time()
    log.info("=" * 60)
    log.info("⚽ 38-0 Serie A — FBref Scraper v4 (SeleniumBase)")
    log.info("=" * 60)

    seasons = get_all_seasons()
    if not seasons:
        log.error("No seasons discovered!")
        sys.exit(1)

    target = {k: v for k, v in seasons.items() if k >= "1992-1993"}
    if args.seasons:
        target = {s: seasons.get(s, s) for s in args.seasons}

    log.info(f"\nScraping {len(target)} seasons: {list(target.keys())[0]} → {list(target.keys())[-1]}")

    all_clubs = {}
    all_player_seasons = defaultdict(list)

    season_items = list(target.items())
    pbar = tqdm(season_items, desc="Seasons", unit="s") if HAS_TQDM else season_items

    for i, (season_label, season_slug) in enumerate(pbar):
        if not HAS_TQDM:
            log.info(f"\n{'='*50}")
            log.info(f"Season {i+1}/{len(season_items)}: {season_label}")

        try:
            clubs, players = scrape_season(season_label, season_slug, args.debug)
        except Exception as e:
            log.error(f"  ❌ FAILED: {e}")
            import traceback
            traceback.print_exc()
            continue

        for c in clubs:
            if c["id"] not in all_clubs:
                all_clubs[c["id"]] = c

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

        if i < len(season_items) - 1:
            time.sleep(3)

    # Build output
    clubs_list = sorted(all_clubs.values(), key=lambda x: x["name"])
    with open(OUT_DIR / "clubs.json", "w", encoding="utf-8") as f:
        json.dump(clubs_list, f, ensure_ascii=False, indent=2)
    log.info(f"\n✅ clubs.json: {len(clubs_list)} clubs")

    players_list = []
    pid = 1
    for name_key in sorted(all_player_seasons.keys()):
        entries = all_player_seasons[name_key]
        pos_counts = defaultdict(int)
        for e in entries:
            pos_counts[e["position"]] += 1
        primary_pos = max(pos_counts, key=pos_counts.get)
        seasons_list = sorted([e["season_entry"] for e in entries], key=lambda x: x["season"])
        players_list.append({
            "id": f"p{pid:05d}",
            "name": entries[0]["name"],
            "position": primary_pos,
            "seasons": seasons_list,
        })
        pid += 1

    with open(OUT_DIR / "players.json", "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)

    total = sum(len(p["seasons"]) for p in players_list)
    ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    elapsed = time.time() - start_time

    log.info(f"✅ players.json: {len(players_list)} players ({total} seasons)")
    log.info(f"📊 Club: {len(clubs_list)} | Giocatori: {len(players_list)} | Stagioni: {total}")
    if ratings:
        log.info(f"   Rating min/max/avg: {min(ratings):.1f}/{max(ratings):.1f}/{sum(ratings)/len(ratings):.1f}")
    log.info(f"⏱  Tempo: {elapsed/60:.1f} min")
    log.info("🎉 FATTO!")

    close_driver()


if __name__ == "__main__":
    main()
