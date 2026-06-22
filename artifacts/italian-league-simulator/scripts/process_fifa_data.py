#!/usr/bin/env python3
"""
Processa i CSV FIFA/EA FC scaricati da Kaggle e genera data.json per ogni lega.

Uso:
  python scripts/process_fifa_data.py                    # Tutte le leghe
  python scripts/process_fifa_data.py --league la-liga   # Solo una lega
  python scripts/process_fifa_data.py --season 2024-2025  # Solo una stagione

Output:
  public/data/leagues/<leagueId>/data.json per ogni lega
"""

import csv
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RAW_DIR = BASE / ".migration-backup" / "sofifa_raw"
OUT_DIR = BASE / "artifacts" / "italian-league-simulator" / "public" / "data" / "leagues"
FIFA_CSVS = BASE / ".migration-backup"  # Vecchi CSV FIFA 05-16

# League keywords per filtro
LEAGUE_FILTERS = {
    "premier-league": {
        "keywords": ["premier league", "england", "english", "eng"],
        "clubs": [
            "manchester city", "arsenal", "liverpool", "chelsea", "manchester united",
            "tottenham", "newcastle", "aston villa", "brighton", "west ham",
            "crystal palace", "fulham", "wolverhampton", "bournemouth", "nottingham forest",
            "everton", "brentford", "leicester", "ipswich", "southampton",
        ],
        "meta": {"id": "premier-league", "name": "Premier League", "country": "Inghilterra", "countryCode": "gb", "numTeams": 20, "numMatchdays": 38, "season": "2025-2026", "colors": {"primary": "#034694", "secondary": "#E8003E", "accent": "#FFFFFF"}},
    },
    "la-liga": {
        "keywords": ["la liga", "spain", "spanish", "esp"],
        "clubs": [
            "real madrid", "barcelona", "atletico", "atlético", "real sociedad",
            "athletic", "athletic club", "villarreal", "real betis", "sevilla",
            "valencia", "celta", "celta vigo", "osasuna", "getafe", "mallorca",
            "girona", "las palmas", "rayo vallecano", "alaves", "alavés",
            "granada", "cadiz", "cádiz", "almeria", "almería",
        ],
        "meta": {"id": "la-liga", "name": "La Liga", "country": "Spagna", "countryCode": "es", "numTeams": 20, "numMatchdays": 38, "season": "2025-2026", "colors": {"primary": "#D91A20", "secondary": "#FFD700", "accent": "#003DA5"}},
    },
    "ligue-1": {
        "keywords": ["ligue 1", "france", "french", "fra"],
        "clubs": [
            "paris saint-germain", "psg", "marseille", "lyon", "monaco", "lille",
            "nice", "rennes", "lens", "strasbourg", "toulouse", "montpellier",
            "nantes", "brest", "reims", "lorient", "metz", "le havre", "clermont",
            "auxerre", "aj auxerre",
        ],
        "meta": {"id": "ligue-1", "name": "Ligue 1", "country": "Francia", "countryCode": "fr", "numTeams": 18, "numMatchdays": 34, "season": "2025-2026", "colors": {"primary": "#004170", "secondary": "#E5293A", "accent": "#FFFFFF"}},
    },
    "bundesliga": {
        "keywords": ["bundesliga", "germany", "german", "deu"],
        "clubs": [
            "bayern", "bayern munich", "münchen", "borussia dortmund", "bvb",
            "dortmund", "rb leipzig", "leipzig", "leverkusen", "bayer leverkusen",
            "eintracht frankfurt", "frankfurt", "wolfsburg", "vfl wolfsburg",
            "freiburg", "stuttgart", "vfb stuttgart", "hoffenheim", "tsg hoffenheim",
            "werder bremen", "bremen", "mainz", "augsburg", "borussia mönchengladbach",
            "mönchengladbach", "union berlin", "bochum", "vfl bochum",
            "holstein kiel", "fc st. pauli", "st. pauli", "heidenheim",
        ],
        "meta": {"id": "bundesliga", "name": "Bundesliga", "country": "Germania", "countryCode": "de", "numTeams": 18, "numMatchdays": 34, "season": "2025-2026", "colors": {"primary": "#DC052D", "secondary": "#FFFFFF", "accent": "#000000"}},
    },
}

POSITION_CATEGORY = {
    "GK": "GK",
    "CB": "DEF", "LB": "DEF", "RB": "DEF", "LWB": "DEF", "RWB": "DEF", "WB": "DEF",
    "CDM": "MID", "CM": "MID", "CAM": "MID", "LM": "MID", "RM": "MID",
    "LW": "ATT", "RW": "ATT", "ST": "ATT", "CF": "ATT", "SS": "ATT",
}


def nrm(name):
    return name.lower().strip()


LEAGUE_CLUB_SETS = {lid: {nrm(c) for c in lf["clubs"]} for lid, lf in LEAGUE_FILTERS.items()}
LEAGUE_KEYWORD_SETS = {lid: set(lf["keywords"]) for lid, lf in LEAGUE_FILTERS.items()}


def is_league_club(league_id, club_name):
    return nrm(club_name) in LEAGUE_CLUB_SETS[league_id]


def is_league_row(league_id, league_field):
    lf = nrm(league_field)
    return any(kw in lf for kw in LEAGUE_KEYWORD_SETS[league_id])


def parse_row(row, version_to_season):
    """Estrae dati da un row CSV FIFA. Restituisce dict normalizzato."""
    sofifa_id = row.get("sofifa_id", row.get("player_id", "")).strip()
    name = (row.get("short_name", "") or row.get("name", "")).strip()
    if not name:
        name = (row.get("long_name", "") or row.get("full_name", "")).strip()
    if not name:
        return None

    positions_str = (row.get("player_positions", "") or row.get("positions", "")).strip()
    pos_parts = [p.strip().upper() for p in positions_str.split(",")]
    primary = pos_parts[0] if pos_parts else "CM"

    try:
        overall = int(row.get("overall", row.get("overall_rating", 60)).strip())
    except (ValueError, TypeError):
        overall = 60

    club_name = (row.get("club_name", "") or row.get("club", "")).strip()
    if not club_name:
        return None

    league_name = (row.get("league_name", "") or row.get("club_league_name", "") or row.get("league", "")).strip()
    season = version_to_season  # Determinato dal filename

    category = POSITION_CATEGORY.get(primary, "MID")
    return {
        "sofifa_id": sofifa_id, "name": name, "position": primary, "position_category": category,
        "overall": overall, "club_name": club_name, "league": league_name, "season": season,
    }


def process_csv(path, version_to_season, league_filter=None):
    """Legge un CSV FIFA e restituisce dict {league_id: [rows]}"""
    rows_by_league = defaultdict(list)
    try:
        with open(path, encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                data = parse_row(row, version_to_season)
                if not data:
                    continue
                club = data["club_name"]
                league_field = data["league"]
                for league_id, lf in LEAGUE_FILTERS.items():
                    if league_filter and league_id != league_filter:
                        continue
                    if is_league_club(league_id, club) or is_league_row(league_id, league_field):
                        rows_by_league[league_id].append(data)
                        break  # Un club per lega
    except FileNotFoundError:
        return rows_by_league
    return rows_by_league


def verify_distribution(ratings):
    """Verifica che almeno il 40% dei rating sia tra 70-85."""
    if not ratings:
        return 0, 0, 0
    in_range = sum(1 for r in ratings if 70 <= r <= 85)
    pct = in_range / len(ratings) * 100
    return in_range, len(ratings), pct


def build_league_data(league_id, all_rows, meta):
    """Costruisce output data.json per una lega."""
    # Raggruppa per giocatore
    players = defaultdict(lambda: {"seasons": [], "name": "", "position": "", "position_category": "MID"})
    for row in all_rows:
        key = row["name"].strip()
        p = players[key]
        p["name"] = row["name"]
        p["position"] = row["position"]
        p["position_category"] = row["position_category"]
        club_nrm = row["club_name"].lower().strip()
        season = row["season"]
        if not any(s["club"] == club_nrm and s["season"] == season for s in p["seasons"]):
            p["seasons"].append({"club": club_nrm, "season": season, "rating": row["overall"]})

    # Assegna ID e ordina
    players_list = []
    for i, (name, p) in enumerate(sorted(players.items()), 1):
        if not p["seasons"]:
            continue
        players_list.append({
            "id": f"p{i:05d}", "name": p["name"], "position": p["position"],
            "position_category": p["position_category"],
            "seasons": sorted(p["seasons"], key=lambda s: s["season"]),
        })

    # Estrai club unici
    clubs_set = {}
    for p in players_list:
        for s in p["seasons"]:
            if s["club"] not in clubs_set:
                clubs_set[s["club"]] = {"id": s["club"], "name": s["club"].title()}
    clubs_list = sorted(clubs_set.values(), key=lambda c: c["name"])

    return {"meta": meta, "clubs": clubs_list, "players": players_list}


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--league", help="Processa solo questa lega")
    parser.add_argument("--season", help="Processa solo questa stagione (es. 2024-2025)")
    args = parser.parse_args()

    leagues_to_process = [args.league] if args.league else list(LEAGUE_FILTERS.keys())
    version_to_season = {}

    # Mappa versione FIFA → stagione per tutti i CSV FIFA 05-26
    # Vecchi CSV (FIFA 05-16)
    for i in range(5, 17):
        version_to_season[f"fifa-{i}"] = f"200{i-4:02d}-200{i-3:02d}"

    # Nuovi dataset Kaggle (stefanoleone992)
    for i in range(15, 26):
        version_to_season[f"players_{i}"] = f"20{i-4:02d}-20{i-3:02d}"

    # Raggruppa tutte le rows per lega
    all_rows = defaultdict(list)

    # Leggi vecchi CSV FIFA 05-16
    for i in range(5, 17):
        csv_path = FIFA_CSVS / f"FIFA {i:02d}.csv"
        if csv_path.exists():
            vkey = f"fifa-{i}"
            season = version_to_season[vkey]
            if args.season and season != args.season:
                continue
            print(f"  {csv_path.name} -> {season}")
            rows = process_csv(csv_path, season, args.league)
            for lid, rrows in rows.items():
                all_rows[lid].extend(rrows)

    # Leggi nuovi CSV Kaggle
    if RAW_DIR.exists():
        for csv_path in sorted(RAW_DIR.glob("*.csv")):
            fname = csv_path.stem.lower()
            if fname.startswith("players_"):
                vkey = fname
            else:
                vkey = fname.replace(" ", "_")
            season = version_to_season.get(vkey)
            if not season:
                # Prova pattern alternativo
                m = re.search(r"fifa_(\d+)", fname)
                if m:
                    ver = m.group(1)
                    if len(ver) == 1:
                        ver = f"0{ver}"
                    season = version_to_season.get(f"fifa-{ver}")
            if not season:
                print(f"  SKIP {csv_path.name} — stagione non mappata")
                continue
            if args.season and season != args.season:
                continue
            print(f"  {csv_path.name} -> {season}")
            rows = process_csv(csv_path, season, args.league)
            for lid, rrows in rows.items():
                all_rows[lid].extend(rrows)

    # Costruisci output
    for league_id in leagues_to_process:
        if league_id not in all_rows or not all_rows[league_id]:
            print(f"\n⚠️  Nessun dato per {league_id}")
            continue

        meta = LEAGUE_FILTERS[league_id]["meta"]
        data = build_league_data(league_id, all_rows[league_id], meta)
        league_dir = OUT_DIR / league_id
        league_dir.mkdir(parents=True, exist_ok=True)
        out_path = league_dir / "data.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Verifica
        ratings = [s["rating"] for p in data["players"] for s in p["seasons"]]
        in_range, total, pct = verify_distribution(ratings)
        status = "✅" if pct >= 40 else "⚠️"
        print(f"\n✅ {league_id}: {len(data['players'])} giocatori, {len(data['clubs'])} club")
        print(f"   Rating 70-85: {in_range}/{total} ({pct:.1f}%) {status}")
        if ratings:
            print(f"   Rating range: {min(ratings)}-{max(ratings)}, media: {sum(ratings)/len(ratings):.0f}")


if __name__ == "__main__":
    main()
