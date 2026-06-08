#!/usr/bin/env python3
"""
Scraping FBref per Serie A — GitHub Actions version (requests-based)

Uses requests (not Playwright) — lighter, faster, works on GH Actions.
Key insight: we use 'domcontentloaded' equivalent by not waiting for networkidle.
We just need the HTML with tables (even if in comments).

Usage:
    python scrape_gh_actions.py
    python scrape_gh_actions.py --seasons 2023-2024
"""

import json
import re
import sys
import time
import logging
import argparse
import random
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
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger(__name__)

OUT_DIR = Path(__file__).parent.parent / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://fbref.com"
COMP_ID = 11

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
]

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

# ===========================================================================
# RATING
# ===========================================================================

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
# HTTP SESSION
# ===========================================================================

SESSION = requests.Session()

def fetch_page(url):
    """Fetch page with rotating UAs and retry logic."""
    for attempt in range(5):
        ua = random.choice(USER_AGENTS)
        try:
            resp = SESSION.get(url, headers={
                "User-Agent": ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
            }, timeout=20, allow_redirects=True)

            if resp.status_code == 200:
                return resp.text
            elif resp.status_code == 429:
                wait = 10 + random.randint(5, 15)
                log.warning(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            elif resp.status_code == 403:
                log.warning(f"  403 (attempt {attempt+1}), retrying...")
                time.sleep(3 + attempt * 2)
            else:
                log.warning(f"  HTTP {resp.status_code} (attempt {attempt+1})")
                time.sleep(2)
        except requests.exceptions.Timeout:
            log.warning(f"  Timeout (attempt {attempt+1})")
            time.sleep(3)
        except Exception as e:
            log.warning(f"  Error: {e} (attempt {attempt+1})")
            time.sleep(3)

    raise RuntimeError(f"Failed to fetch {url}")

# ===========================================================================
# EXTRACT TABLES
# ===========================================================================

def extract_all_tables(html):
    """Extract all tables from DOM + HTML comments + regex fallback."""
    soup = BeautifulSoup(html, "html.parser")
    tables = {}

    # 1. Visible DOM
    for t in soup.find_all("table"):
        tid = t.get("id", "")
        if tid: tables[tid] = t

    # 2. HTML comments
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        ct = str(comment)
        if "<table" not in ct: continue
        try:
            cs = BeautifulSoup(ct, "html.parser")
            for t in cs.find_all("table"):
                tid = t.get("id", "")
                if tid and tid not in tables: tables[tid] = t
        except: pass

    # 3. Regex fallback
    if not any(tid.startswith("stats_") for tid in tables):
        _regex_extract(html, tables)

    return tables

def _regex_extract(html, tables):
    for m in re.finditer(r'<!--(.*?)-->', html, re.DOTALL):
        ct = m.group(1)
        if '<table' not in ct: continue
        for tid_m in re.finditer(r'<table[^>]*id="([^"]+)"', ct):
            tid = tid_m.group(1)
            if tid in tables: continue
            ts = ct.rfind('<table', 0, tid_m.start() + 1)
            if ts == -1: ts = tid_m.start()
            depth, pos = 0, ts
            while pos < len(ct):
                if ct[pos:pos+6] == '<table': depth += 1; pos += 6
                elif ct[pos:pos+7] == '</table':
                    depth -= 1
                    if depth == 0:
                        cl = ct.find('>', pos)
                        if cl != -1:
                            try:
                                t = BeautifulSoup(ct[ts:cl+1], "html.parser").find("table")
                                if t: tables[tid] = t; log.info(f"  Regex: {tid}")
                            except: pass
                        break
                    pos += 7
                else: pos += 1

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

def scrape_season(label, slug):
    if re.match(r"\d{4}-\d{4}", slug):
        url = f"{BASE_URL}/en/comps/11/{slug}/{slug}-Serie-A-Stats"
    else:
        url = f"{BASE_URL}/en/comps/11/{slug}/stats/Serie-A-Stats"

    log.info(f"Scraping {label}: {url}")
    html = fetch_page(url)
    tables = extract_all_tables(html)

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
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+")
    args = parser.parse_args()

    start = time.time()
    log.info("=" * 60)
    log.info("⚽ 38-0 Serie A — FBref Scraper (GH Actions / requests)")
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
            clubs, players = scrape_season(label, slug)
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
            time.sleep(random.uniform(3, 6))

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

if __name__ == "__main__":
    main()
