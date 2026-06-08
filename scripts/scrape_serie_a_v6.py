#!/usr/bin/env python3
"""
Scraping FBref per Serie A — VERSIONE 6 (SeleniumBase + fix estrazione commenti)

L'unico modo per bypassare FBref/Cloudflare è un browser reale che esegue JS.
SeleniumBase (undetected-chromedriver) funziona.

Il problema delle versioni precedenti: le tabelle `stats_standard_11`, `stats_defense_11`, etc.
sono nei COMMENTI HTML (`<!-- ... -->`). SeleniumBase scarica tutto correttamente,
ma BS4 non le estrae bene. La v6 usa un approccio ibrido BS4 + regex.

ESEGUIRE:
    pip install seleniumbase beautifulsoup4 html5lib lxml tqdm
    python scrape_serie_a_v6.py

    # Test 1 stagione
    python scrape_serie_a_v6.py --seasons 2023-2024

    # Tutte le stagioni
    python scrape_serie_a_v6.py
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

def classify_position(pos):
    if not pos: return "MID"
    p = pos.split(",")[0].strip().upper()
    if p in POSITION_MAP: return POSITION_MAP[p]
    if len(p) >= 2 and p[:2] in POSITION_MAP: return POSITION_MAP[p[:2]]
    if "GK" in p: return "GK"
    if any(x in p for x in ["CB","LB","RB","WB","DF"]): return "DEF"
    if any(x in p for x in ["MF","CM","DM","AM","LM","RM"]): return "MID"
    if any(x in p for x in ["FW","ST","CF","LW","RW","WF"]): return "ATT"
    return "MID"

def calculate_rating(cat, s):
    apps = s.get("apps", 0) or 0
    goals = s.get("goals", 0) or 0
    assists = s.get("assists", 0) or 0
    kp = s.get("key_passes", 0) or 0
    tw = s.get("tackles_won", 0) or 0
    cs = s.get("clean_sheets", 0) or 0
    err = s.get("errors", 0) or 0
    sp = s.get("save_pct", 0.0) or 0.0
    ga = s.get("goals_against", 0) or 0
    mins = s.get("minutes", 0) or 0
    mb = min(mins / 3420, 1.0) * 10 if mins else 0
    if cat == "ATT": raw, norm = goals*3 + assists*1.5 + apps*0.5, 1.05
    elif cat == "MID": raw, norm = goals*2 + assists*2 + apps*0.5 + kp*1, 1.455
    elif cat == "DEF": raw, norm = apps*1 + tw*0.5 + cs*1.5 - err*2, 0.875
    elif cat == "GK": raw, norm = cs*2 + sp*0.3 - ga*0.3, 0.435
    else: raw, norm = apps + goals + assists, 1.0
    norm = norm or 1.0
    return max(1.0, min(99.0, round((raw / norm) * 100 + mb, 1)))

# ===========================================================================
# SELENIUMBASE
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
        try: _DRIVER.quit()
        except: pass
        _DRIVER = None

atexit.register(close_driver)

def fetch_page(url):
    """Fetch page via SeleniumBase, wait for Cloudflare + content."""
    driver = get_driver()
    driver.get(url)
    
    # Wait for page to load (Cloudflare challenge + JS rendering)
    for i in range(60):  # up to 30s
        src = driver.page_source
        if "<table" in src and len(src) > 10000:
            return src
        lower = src.lower()
        if "just a moment" in lower or "checking" in lower:
            time.sleep(0.5); continue
        if "<body" in lower and len(src) > 5000:
            time.sleep(0.5); continue
        time.sleep(0.5)
    
    return driver.page_source

# ===========================================================================
# EXTRACT TABLES — the critical function
# ===========================================================================

def extract_all_tables(html, debug_label=None):
    """
    Extract ALL tables from DOM + HTML comments.
    Uses 3 methods: BS4 DOM → BS4 comments → regex fallback.
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = {}

    # Method 1: Visible DOM tables
    for t in soup.find_all("table"):
        tid = t.get("id", "")
        if tid: tables[tid] = t

    # Method 2: Tables in HTML comments (BS4)
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        ct = str(comment)
        if "<table" not in ct: continue
        try:
            cs = BeautifulSoup(ct, "html.parser")
            for t in cs.find_all("table"):
                tid = t.get("id", "")
                if tid and tid not in tables:
                    tables[tid] = t
                    log.debug(f"  BS4 comment: {tid}")
        except: pass

    # Method 3: Regex fallback from raw HTML
    if not any(tid.startswith("stats_") for tid in tables):
        log.info("  No stats tables via BS4! Trying regex extraction...")
        _regex_extract(html, tables)

    if debug_label:
        with open(OUT_DIR / f"debug_{debug_label}.html", "w", encoding="utf-8") as f:
            f.write(html)

    return tables

def _regex_extract(html, tables):
    """Extract tables from HTML comments using regex on raw HTML."""
    for m in re.finditer(r'<!--(.*?)-->', html, re.DOTALL):
        ct = m.group(1)
        if '<table' not in ct: continue
        
        # Find all table IDs in this comment
        for tid_m in re.finditer(r'<table[^>]*id="([^"]+)"', ct):
            tid = tid_m.group(1)
            if tid in tables: continue
            
            # Extract the full <table>...</table> block
            start = tid_m.start()
            ts = ct.rfind('<table', 0, start + 1)
            if ts == -1: ts = start
            
            depth, pos = 0, ts
            while pos < len(ct):
                if ct[pos:pos+6] == '<table':
                    depth += 1; pos += 6
                elif ct[pos:pos+8] == '</table>':
                    depth -= 1
                    if depth == 0:
                        cl = ct.find('>', pos)
                        if cl != -1:
                            try:
                                t = BeautifulSoup(ct[ts:cl+1], "html.parser").find("table")
                                if t:
                                    tables[tid] = t
                                    log.info(f"  Regex extracted: {tid}")
                            except: pass
                        break
                    pos += 8
                else:
                    pos += 1

# ===========================================================================
# SEASON DISCOVERY
# ===========================================================================

def get_all_seasons():
    url = f"{BASE_URL}/en/comps/11/history/Serie-A-Seasons"
    log.info(f"Discovering seasons: {url}")
    html = fetch_page(url)
    soup = BeautifulSoup(html, "html.parser")
    seasons = {}

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        m = re.match(r"/en/comps/11/(\d{4}-\d{4})/", href)
        if m:
            seasons[m.group(1)] = m.group(1)
            continue
        m = re.match(r"/en/comps/11/(\d+)/", href)
        if m:
            label = _label(text)
            if label and label not in seasons: seasons[label] = m.group(1)

    for sel in soup.find_all("select"):
        for opt in sel.find_all("option"):
            val = opt.get("value", "")
            m = re.search(r"/comps/11/(\d{4}-\d{4})/", val)
            if m: seasons[m.group(1)] = m.group(1)
            m = re.search(r"/comps/11/(\d+)/", val)
            if m:
                label = _label(opt.get_text(strip=True))
                if label and label not in seasons: seasons[label] = m.group(1)

    seasons = dict(sorted(seasons.items()))
    log.info(f"Discovered {len(seasons)} seasons")
    return seasons

def _label(text):
    m = re.search(r"(\d{4})-(\d{4})", text)
    if m: return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"(\d{4})", text)
    if m: y = int(m.group(1)); return f"{y}-{y+1}"
    return None

# ===========================================================================
# PARSE HELPERS
# ===========================================================================

def _si(val):
    if not val or val in ("","-","—","N/A","nan"): return 0
    try: return int(str(val).replace(",","").strip())
    except: return 0

def _sf(val):
    if not val or val in ("","-","—","N/A","nan"): return 0.0
    try: return float(str(val).replace(",","").replace("%","").strip())
    except: return 0.0

def parse_rows(table):
    rows = []
    tbody = table.find("tbody")
    if not tbody: return rows
    for row in tbody.find_all("tr"):
        cls = " ".join(row.get("class", []))
        if "over_header" in cls or "thead" in cls: continue
        data = {}
        for cell in row.find_all(["td","th"]):
            s = cell.get("data-stat", "")
            if s: data[s] = cell.get_text(strip=True)
        if data.get("player") or data.get("squad"): rows.append(data)
    return rows

# ===========================================================================
# SCRAPE SEASON
# ===========================================================================

def scrape_season(label, slug, debug=False):
    if re.match(r"\d{4}-\d{4}", slug):
        url = f"{BASE_URL}/en/comps/11/{slug}/{slug}-Serie-A-Stats"
    else:
        url = f"{BASE_URL}/en/comps/11/{slug}/stats/Serie-A-Stats"

    log.info(f"Scraping {label}: {url}")
    html = fetch_page(url)
    tables = extract_all_tables(html, debug_label=label if debug else None)

    stats_ids = sorted(t for t in tables if t.startswith("stats_"))
    results_ids = sorted(t for t in tables if t.startswith("results"))
    log.info(f"  {len(tables)} tables: {len(stats_ids)} stats, {len(results_ids)} results")
    for t in stats_ids: log.info(f"    📊 {t}")

    # CLUBS
    clubs = []
    for tid in results_ids:
        if "overall" in tid:
            for row in parse_rows(tables[tid]):
                team = (row.get("team","") or row.get("squad","")).strip()
                if team:
                    cid = team.lower().replace(" ","-").replace("'","")
                    if cid not in [c["id"] for c in clubs]:
                        clubs.append({"id": cid, "name": team})
            break

    # PLAYERS
    players = {}

    std = next((t for t in [f"stats_standard_{COMP_ID}","stats_standard"] if t in tables), None)
    if std:
        for row in parse_rows(tables[std]):
            name = row.get("player","").strip()
            club = (row.get("squad","") or row.get("team","")).strip()
            if not name or not club: continue
            apps = _si(row.get("games","0"))
            if apps == 0: continue
            key = f"{name}|{club}|{label}"
            players[key] = {
                "name": name, "position": classify_position(row.get("position","")),
                "club": club, "season": label, "apps": apps,
                "goals": _si(row.get("goals","0")), "assists": _si(row.get("assists","0")),
                "minutes": _si(row.get("minutes","0")), "clean_sheets": _si(row.get("clean_sheets","0")),
                "tackles_won": 0, "errors": 0, "key_passes": 0,
                "save_pct": 0.0, "goals_against": 0,
            }
        log.info(f"  Standard: {len(players)} players")
    else:
        log.warning(f"  ⚠ No standard stats! Available: {stats_ids}")

    # Defense
    d = next((t for t in [f"stats_defense_{COMP_ID}","stats_defense"] if t in tables and "keeper" not in t), None)
    if d:
        m = 0
        for row in parse_rows(tables[d]):
            key = f"{row.get('player','').strip()}|{(row.get('squad','') or row.get('team','')).strip()}|{label}"
            if key in players:
                players[key]["tackles_won"] = _si(row.get("tackles_won","0"))
                players[key]["errors"] = _si(row.get("errors","0"))
                m += 1
        log.info(f"  Defense: merged {m}")

    # Keeper
    gk = next((t for t in [f"stats_keeper_{COMP_ID}","stats_keeper"] if t in tables and "adv" not in t), None)
    if gk:
        m = 0
        for row in parse_rows(tables[gk]):
            key = f"{row.get('player','').strip()}|{(row.get('squad','') or row.get('team','')).strip()}|{label}"
            if key in players:
                players[key]["save_pct"] = _sf(row.get("save_pct","0"))
                players[key]["goals_against"] = _si(row.get("goals_against","0"))
                players[key]["clean_sheets"] = max(players[key]["clean_sheets"], _si(row.get("clean_sheets","0")))
                players[key]["position"] = "GK"
                m += 1
        log.info(f"  Keeper: merged {m}")

    # Passing
    p = next((t for t in [f"stats_passing_{COMP_ID}","stats_passing"] if t in tables and "types" not in t), None)
    if p:
        m = 0
        for row in parse_rows(tables[p]):
            key = f"{row.get('player','').strip()}|{(row.get('squad','') or row.get('team','')).strip()}|{label}"
            if key in players:
                kp = _si(row.get("assisted_shots","0")) or _si(row.get("progressive_passes","0"))
                players[key]["key_passes"] = kp
                m += 1
        log.info(f"  Passing: merged {m}")

    if not clubs:
        seen = set()
        for pl in players.values():
            cn = pl["club"]; cid = cn.lower().replace(" ","-").replace("'","")
            if cid not in seen: clubs.append({"id":cid,"name":cn}); seen.add(cid)

    log.info(f"  → {len(clubs)} clubs, {len(players)} players")
    return clubs, list(players.values())

# ===========================================================================
# MAIN
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(description="⚽ Scrape FBref Serie A v6")
    parser.add_argument("--seasons", nargs="+", help="Only these seasons")
    parser.add_argument("--debug", action="store_true", help="Save HTML for debugging")
    args = parser.parse_args()

    start = time.time()
    log.info("=" * 60)
    log.info("⚽ 38-0 Serie A — FBref Scraper v6 (SeleniumBase)")
    log.info("=" * 60)

    seasons = get_all_seasons()
    if not seasons: log.error("No seasons!"); sys.exit(1)

    target = {k: v for k, v in seasons.items() if k >= "1992-1993"}
    if args.seasons: target = {s: seasons.get(s, s) for s in args.seasons}

    log.info(f"\nScraping {len(target)} seasons: {list(target.keys())[0]} → {list(target.keys())[-1]}")

    all_clubs = {}
    all_ps = defaultdict(list)
    items = list(target.items())
    pbar = tqdm(items, desc="Seasons") if HAS_TQDM else items

    for i, (label, slug) in enumerate(pbar):
        if not HAS_TQDM: log.info(f"\n{'='*50}\n{i+1}/{len(items)}: {label}")
        try:
            clubs, players = scrape_season(label, slug, args.debug)
        except Exception as e:
            log.error(f"  ❌ {e}")
            import traceback; traceback.print_exc()
            continue

        for c in clubs:
            if c["id"] not in all_clubs: all_clubs[c["id"]] = c
        for pl in players:
            r = calculate_rating(pl["position"], pl)
            all_ps[pl["name"].strip()].append({
                "name": pl["name"], "position": pl["position"],
                "season_entry": {"club": pl["club"], "season": pl["season"], "rating": r,
                                 "apps": pl["apps"], "goals": pl["goals"], "assists": pl["assists"]}
            })

        if i < len(items) - 1:
            time.sleep(3)

    # Output
    clubs_list = sorted(all_clubs.values(), key=lambda x: x["name"])
    with open(OUT_DIR / "clubs.json", "w", encoding="utf-8") as f:
        json.dump(clubs_list, f, ensure_ascii=False, indent=2)

    players_list = []
    pid = 1
    for nk in sorted(all_ps.keys()):
        entries = all_ps[nk]
        pc = defaultdict(int)
        for e in entries: pc[e["position"]] += 1
        pp = max(pc, key=pc.get)
        sl = sorted([e["season_entry"] for e in entries], key=lambda x: x["season"])
        players_list.append({"id": f"p{pid:05d}", "name": entries[0]["name"], "position": pp, "seasons": sl})
        pid += 1

    with open(OUT_DIR / "players.json", "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)

    total = sum(len(p["seasons"]) for p in players_list)
    ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    elapsed = time.time() - start

    log.info(f"\n{'='*60}")
    log.info(f"✅ clubs.json: {len(clubs_list)} clubs")
    log.info(f"✅ players.json: {len(players_list)} players ({total} seasons)")
    if ratings:
        log.info(f"📊 Rating: {min(ratings):.1f}/{max(ratings):.1f}/{sum(ratings)/len(ratings):.1f}")
    log.info(f"⏱  {elapsed/60:.1f} min")
    log.info("🎉 FATTO!")
    close_driver()

if __name__ == "__main__":
    main()
