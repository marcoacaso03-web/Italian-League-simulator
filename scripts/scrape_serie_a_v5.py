#!/usr/bin/env python3
"""
Scraping FBref per Serie A — VERSIONE 5 (Browserless/Playwright)

Supporta 3 backend browser:
  1. Browserless (locale Docker o cloud) — il migliore
  2. SeleniumBase (UC mode) — alternativa
  3. Requests — fallback senza browser (funziona solo senza Cloudflare)

SETUP BROWSERLESS (consigliato):
  Opzione A - Docker locale:
    docker run -p 3000:3000 browserless/chrome
  Opzione B - Cloud gratuito (6h/mese):
    1. Registrati su https://www.browserless.io/
    2. Copia il token dal dashboard
    3. python scrape_serie_a_v5.py --browserless-token TUO_TOKEN

ESEGUIRE:
  # Con Browserless locale (Docker)
  python scrape_serie_a_v5.py --browserless
  
  # Con Browserless cloud
  python scrape_serie_a_v5.py --browserless --browserless-token abc123
  
  # Con SeleniumBase
  python scrape_serie_a_v5.py --seleniumbase
  
  # Test 1 stagione con debug
  python scrape_serie_a_v5.py --browserless --seasons 2023-2024 --debug

Output:
  data/clubs.json    → [{id, name}]
  data/players.json  → [{id, name, position, seasons: [{club, season, rating, apps, goals, assists}]}]
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

import requests as req_lib
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
COMP_ID = 11

# Browser settings
BROWSERLESS_URL = "http://localhost:3000"
BROWSERLESS_TOKEN = None

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
        raw = goals * 3 + assists * 1.5 + apps * 0.5; norm = 1.05
    elif pos_cat == "MID":
        raw = goals * 2 + assists * 2 + apps * 0.5 + key_passes * 1; norm = 1.455
    elif pos_cat == "DEF":
        raw = apps * 1 + tackles_won * 0.5 + clean_sheets * 1.5 - errors * 2; norm = 0.875
    elif pos_cat == "GK":
        raw = clean_sheets * 2 + save_pct * 0.3 - goals_against * 0.3; norm = 0.435
    else:
        raw = apps + goals + assists; norm = 1.0

    norm = norm or 1.0
    rating = (raw / norm) * 100 + min_bonus
    return max(1.0, min(99.0, round(rating, 1)))


# ===========================================================================
# BROWSER BACKENDS
# ===========================================================================

class BrowserBackend:
    """Base class for browser backends."""
    def fetch(self, url: str) -> str:
        raise NotImplementedError


class RequestsBackend(BrowserBackend):
    """Plain requests — no Cloudflare bypass."""
    def __init__(self):
        self.session = req_lib.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        })

    def fetch(self, url: str) -> str:
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text


class BrowserlessBackend(BrowserBackend):
    """
    Browserless.io — real Chromium in Docker or cloud.
    
    APIs used:
      /content  — returns rendered HTML after JS execution
      /pdf     — not needed
      /screenshot — not needed
    
    Usage:
      Local Docker:  docker run -p 3000:3000 browserless/chrome
      Cloud:         use --browserless-token
    """
    def __init__(self, base_url: str, token: str = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def fetch(self, url: str) -> str:
        """Fetch fully rendered HTML via Browserless /content endpoint."""
        api_url = f"{self.base_url}/content"
        params = {"url": url}
        if self.token:
            params["token"] = self.token

        log.info(f"  Browserless: fetching {url[:60]}...")
        
        # /content returns raw HTML in response body
        resp = req_lib.post(
            api_url,
            json={
                "url": url,
                "options": {
                    "waitUntil": "networkidle0",
                },
            },
            params=params,
            timeout=45,
        )

        if resp.status_code == 429:
            log.warning("Rate limited! Sleeping 30s...")
            time.sleep(30)
            resp = req_lib.post(api_url, json={"url": url}, params=params, timeout=45)

        resp.raise_for_status()
        
        # Browserless /content returns JSON with "data" field (base64) or raw HTML
        content_type = resp.headers.get("content-type", "")
        if "json" in content_type:
            data = resp.json()
            if "data" in data:
                import base64
                return base64.b64decode(data["data"]).decode("utf-8", errors="replace")
            elif "html" in data:
                return data["html"]
        # Sometimes returns raw HTML directly
        return resp.text


class SeleniumBaseBackend(BrowserBackend):
    """SeleniumBase with undetected-chromedriver mode."""
    def __init__(self):
        from seleniumbase import Driver
        log.info("Starting SeleniumBase (uc=True, headless=True)...")
        self.driver = Driver(uc=True, headless=True)

    def fetch(self, url: str) -> str:
        self.driver.get(url)
        # Wait for page to load (Cloudflare challenge + JS rendering)
        for _ in range(40):
            src = self.driver.page_source
            if "<table" in src and len(src) > 10000:
                return src
            lower = src.lower()
            if "just a moment" in lower or "checking" in lower:
                time.sleep(0.5)
                continue
            if "<body" in lower and len(src) > 5000:
                time.sleep(0.5)
                continue
            time.sleep(0.5)
        return self.driver.page_source

    def close(self):
        try:
            self.driver.quit()
        except Exception:
            pass


# ===========================================================================
# EXTRACT TABLES (visible + hidden in HTML comments + regex fallback)
# ===========================================================================

def extract_all_tables(html: str) -> dict:
    """Extract ALL tables from DOM + HTML comments + regex fallback."""
    soup = BeautifulSoup(html, "html.parser")
    tables = {}

    # 1. Visible DOM tables
    for table in soup.find_all("table"):
        tid = table.get("id", "")
        if tid:
            tables[tid] = table

    # 2. Tables in HTML comments (FBref hides non-active tabs in <!-- ... -->)
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment_text = str(comment)
        if "<table" not in comment_text:
            continue
        try:
            comment_soup = BeautifulSoup(comment_text, "html.parser")
            for table in comment_soup.find_all("table"):
                tid = table.get("id", "")
                if tid and tid not in tables:
                    tables[tid] = table
        except Exception:
            pass

    # 3. Regex fallback: if no stats_ tables found, extract from raw HTML
    if not any(t.startswith("stats_") for t in tables):
        log.info("  No stats tables via BS4! Trying regex extraction from comments...")
        _extract_tables_regex(html, tables)

    return tables


def _extract_tables_regex(html: str, tables: dict):
    """Fallback: extract tables from raw HTML comments using regex."""
    for m in re.finditer(r'<!--(.*?)-->', html, re.DOTALL):
        comment_text = m.group(1)
        if '<table' not in comment_text:
            continue
        # Find each table in this comment
        for tid_match in re.finditer(r'<table[^>]*id="([^"]+)"', comment_text):
            tid = tid_match.group(1)
            if tid in tables:
                continue
            # Extract the full <table>...</table> block
            start_pos = tid_match.start()
            table_start = comment_text.rfind('<table', 0, start_pos + 1)
            if table_start == -1:
                table_start = start_pos

            # Walk to matching </table>
            depth = 0
            pos = table_start
            end_pos = len(comment_text)
            while pos < end_pos:
                if comment_text[pos:pos+6] == '<table':
                    depth += 1
                    pos += 6
                elif comment_text[pos:pos+7] == '</table':
                    depth -= 1
                    if depth == 0:
                        close = comment_text.find('>', pos)
                        if close != -1:
                            table_html = comment_text[table_start:close + 1]
                            try:
                                t_soup = BeautifulSoup(table_html, "html.parser")
                                t = t_soup.find("table")
                                if t:
                                    tables[tid] = t
                                    log.info(f"    Regex extracted: {tid}")
                            except Exception:
                                pass
                        break
                    pos += 7
                else:
                    pos += 1


# ===========================================================================
# SEASON DISCOVERY
# ===========================================================================

def get_all_seasons(browser: BrowserBackend) -> dict:
    """Discover Serie A seasons from FBref history page."""
    url = f"{BASE_URL}/en/comps/11/history/Serie-A-Seasons"
    log.info(f"Discovering seasons: {url}")
    html = browser.fetch(url)
    soup = BeautifulSoup(html, "html.parser")

    seasons = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        # YYYY-YYYY slug
        m = re.match(r"/en/comps/11/(\d{4}-\d{4})/", href)
        if m:
            seasons[m.group(1)] = m.group(1)
            continue
        # Numeric ID
        m = re.match(r"/en/comps/11/(\d+)/", href)
        if m:
            label = _extract_season_label(text)
            if label and label not in seasons:
                seasons[label] = m.group(1)

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
    log.info(f"Discovered {len(seasons)} seasons ({list(seasons.keys())[0]} → {list(seasons.keys())[-1]})")
    return seasons


def _extract_season_label(text: str) -> str | None:
    m = re.search(r"(\d{4})-(\d{4})", text)
    if m: return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"(\d{4})", text)
    if m: y = int(m.group(1)); return f"{y}-{y+1}"
    return None


# ===========================================================================
# PARSE HELPERS
# ===========================================================================

def _si(val) -> int:
    if not val or val in ("", "-", "—", "N/A", "nan"): return 0
    try: return int(str(val).replace(",", "").strip())
    except: return 0

def _sf(val) -> float:
    if not val or val in ("", "-", "—", "N/A", "nan"): return 0.0
    try: return float(str(val).replace(",", "").replace("%", "").strip())
    except: return 0.0

def parse_table_rows(table) -> list[dict]:
    rows_data = []
    tbody = table.find("tbody")
    if not tbody: return rows_data
    for row in tbody.find_all("tr"):
        cls = " ".join(row.get("class", []))
        if "over_header" in cls or "thead" in cls: continue
        data = {}
        for cell in row.find_all(["td", "th"]):
            stat = cell.get("data-stat", "")
            if stat: data[stat] = cell.get_text(strip=True)
        if data.get("player") or data.get("squad"):
            rows_data.append(data)
    return rows_data


# ===========================================================================
# SCRAPE SINGLE SEASON
# ===========================================================================

def scrape_season(season_label: str, season_slug: str, browser: BrowserBackend, debug: bool = False) -> tuple:
    if season_slug == "current":
        url = f"{BASE_URL}/en/comps/11/Serie-A-Stats"
    elif re.match(r"\d{4}-\d{4}", season_slug):
        url = f"{BASE_URL}/en/comps/11/{season_slug}/{season_slug}-Serie-A-Stats"
    else:
        url = f"{BASE_URL}/en/comps/11/{season_slug}/stats/Serie-A-Stats"

    log.info(f"Scraping {season_label}: {url}")
    html = browser.fetch(url)

    if debug:
        debug_path = OUT_DIR / f"debug_{season_label}.html"
        with open(debug_path, "w", encoding="utf-8") as f:
            f.write(html)
        log.info(f"  Saved debug HTML to {debug_path}")

    all_tables = extract_all_tables(html)
    stats_tbls = [t for t in sorted(all_tables) if t.startswith("stats_")]
    results_tbls = [t for t in sorted(all_tables) if t.startswith("results")]
    log.info(f"  {len(all_tables)} tables ({len(stats_tbls)} stats, {len(results_tbls)} results)")
    for t in stats_tbls:
        log.info(f"    📊 {t}")

    # --- CLUBS ---
    clubs = []
    for tid in results_tbls:
        if "overall" in tid:
            rows = parse_table_rows(all_tables[tid])
            for row in rows:
                team = (row.get("team", "") or row.get("squad", "")).strip()
                if team:
                    cid = team.lower().replace(" ", "-").replace("'", "")
                    if cid not in [c["id"] for c in clubs]:
                        clubs.append({"id": cid, "name": team})
            break

    # --- PLAYERS ---
    player_data = {}

    # Standard stats
    std_tid = next((t for t in [f"stats_standard_{COMP_ID}", "stats_standard"] if t in all_tables), None)
    if std_tid:
        for row in parse_table_rows(all_tables[std_tid]):
            name = row.get("player", "").strip()
            club = (row.get("squad", "") or row.get("team", "")).strip()
            if not name or not club: continue
            apps = _si(row.get("games", "0"))
            if apps == 0: continue
            key = f"{name}|{club}|{season_label}"
            player_data[key] = {
                "name": name, "position": classify_position(row.get("position", "")),
                "club": club, "season": season_label,
                "apps": apps, "goals": _si(row.get("goals", "0")),
                "assists": _si(row.get("assists", "0")), "minutes": _si(row.get("minutes", "0")),
                "clean_sheets": _si(row.get("clean_sheets", "0")),
                "tackles_won": 0, "errors": 0, "key_passes": 0,
                "save_pct": 0.0, "goals_against": 0,
            }
        log.info(f"  Standard: {len(player_data)} players")
    else:
        log.warning(f"  ⚠ No standard stats table! Available: {stats_tbls}")

    # Defense
    def_tid = next((t for t in [f"stats_defense_{COMP_ID}", "stats_defense"] if t in all_tables and "keeper" not in t), None)
    if def_tid:
        m = 0
        for row in parse_table_rows(all_tables[def_tid]):
            key = f"{row.get('player','').strip()}|{(row.get('squad','') or row.get('team','')).strip()}|{season_label}"
            if key in player_data:
                player_data[key]["tackles_won"] = _si(row.get("tackles_won", "0"))
                player_data[key]["errors"] = _si(row.get("errors", "0"))
                m += 1
        log.info(f"  Defense: merged {m}")

    # Keeper
    gk_tid = next((t for t in [f"stats_keeper_{COMP_ID}", "stats_keeper"] if t in all_tables and "adv" not in t), None)
    if gk_tid:
        m = 0
        for row in parse_table_rows(all_tables[gk_tid]):
            key = f"{row.get('player','').strip()}|{(row.get('squad','') or row.get('team','')).strip()}|{season_label}"
            if key in player_data:
                player_data[key]["save_pct"] = _sf(row.get("save_pct", "0"))
                player_data[key]["goals_against"] = _si(row.get("goals_against", "0"))
                player_data[key]["clean_sheets"] = max(player_data[key]["clean_sheets"], _si(row.get("clean_sheets", "0")))
                player_data[key]["position"] = "GK"
                m += 1
        log.info(f"  Keeper: merged {m}")

    # Passing
    pass_tid = next((t for t in [f"stats_passing_{COMP_ID}", "stats_passing"] if t in all_tables and "types" not in t), None)
    if pass_tid:
        m = 0
        for row in parse_table_rows(all_tables[pass_tid]):
            key = f"{row.get('player','').strip()}|{(row.get('squad','') or row.get('team','')).strip()}|{season_label}"
            if key in player_data:
                kp = _si(row.get("assisted_shots", "0")) or _si(row.get("progressive_passes", "0"))
                player_data[key]["key_passes"] = kp
                m += 1
        log.info(f"  Passing: merged {m}")

    # Fallback clubs from player data
    if not clubs:
        seen = set()
        for p in player_data.values():
            cn = p["club"]
            cid = cn.lower().replace(" ", "-").replace("'", "")
            if cid not in seen:
                clubs.append({"id": cid, "name": cn})
                seen.add(cid)

    log.info(f"  → {len(clubs)} clubs, {len(player_data)} players")
    return clubs, list(player_data.values())


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(description="⚽ Scrape FBref Serie A v5")
    parser.add_argument("--browserless", action="store_true", help="Use Browserless (Docker or cloud)")
    parser.add_argument("--browserless-url", default="http://localhost:3000", help="Browserless URL")
    parser.add_argument("--browserless-token", default=None, help="Browserless cloud token")
    parser.add_argument("--seleniumbase", action="store_true", help="Use SeleniumBase (UC mode)")
    parser.add_argument("--seasons", nargs="+", help="Only scrape these seasons")
    parser.add_argument("--debug", action="store_true", help="Save HTML pages for debugging")
    args = parser.parse_args()

    # Select backend
    if args.browserless:
        browser = BrowserlessBackend(args.browserless_url, args.browserless_token)
        mode = f"Browserless ({args.browserless_url})"
    elif args.seleniumbase:
        browser = SeleniumBaseBackend()
        atexit.register(browser.close)
        mode = "SeleniumBase"
    else:
        browser = RequestsBackend()
        mode = "Requests (no Cloudflare bypass!)"

    start_time = time.time()
    log.info("=" * 60)
    log.info(f"⚽ 38-0 Serie A — FBref Scraper v5")
    log.info(f"   Browser: {mode}")
    log.info("=" * 60)

    # Discover seasons
    seasons = get_all_seasons(browser)
    if not seasons:
        log.error("No seasons! Try --browserless or --seleniumbase")
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
            log.info(f"\n{'='*50}\nSeason {i+1}/{len(season_items)}: {season_label}")

        try:
            clubs, players = scrape_season(season_label, season_slug, browser, args.debug)
        except Exception as e:
            log.error(f"  ❌ FAILED: {e}")
            import traceback; traceback.print_exc()
            continue

        for c in clubs:
            if c["id"] not in all_clubs:
                all_clubs[c["id"]] = c

        for p in players:
            rating = calculate_rating(p["position"], p)
            season_entry = {
                "club": p["club"], "season": p["season"], "rating": rating,
                "apps": p["apps"], "goals": p["goals"], "assists": p["assists"],
            }
            all_player_seasons[p["name"].strip()].append({
                "name": p["name"], "position": p["position"], "season_entry": season_entry,
            })

        if i < len(season_items) - 1:
            time.sleep(3)

    # Build output
    clubs_list = sorted(all_clubs.values(), key=lambda x: x["name"])
    with open(OUT_DIR / "clubs.json", "w", encoding="utf-8") as f:
        json.dump(clubs_list, f, ensure_ascii=False, indent=2)

    players_list = []
    pid = 1
    for nk in sorted(all_player_seasons.keys()):
        entries = all_player_seasons[nk]
        pos_counts = defaultdict(int)
        for e in entries: pos_counts[e["position"]] += 1
        primary_pos = max(pos_counts, key=pos_counts.get)
        seasons_list = sorted([e["season_entry"] for e in entries], key=lambda x: x["season"])
        players_list.append({
            "id": f"p{pid:05d}", "name": entries[0]["name"],
            "position": primary_pos, "seasons": seasons_list,
        })
        pid += 1

    with open(OUT_DIR / "players.json", "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)

    total = sum(len(p["seasons"]) for p in players_list)
    ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    elapsed = time.time() - start_time

    log.info(f"\n{'='*60}")
    log.info(f"✅ clubs.json: {len(clubs_list)} clubs")
    log.info(f"✅ players.json: {len(players_list)} players ({total} seasons)")
    if ratings:
        log.info(f"📊 Rating min/max/avg: {min(ratings):.1f}/{max(ratings):.1f}/{sum(ratings)/len(ratings):.1f}")
    log.info(f"⏱  {elapsed/60:.1f} min")
    log.info("🎉 FATTO!")


if __name__ == "__main__":
    main()
