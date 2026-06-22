#!/usr/bin/env python3
"""
Generate players.json for all 5 leagues from multiple FIFA datasets.

Data sources per era:
  2000-04: Transfermarkt (Kaggle davidcariboo/player-scores) — market value → rating
  05-16:  FIFA model repo (lbenz730/fifa_model) — native ratings
  17-23:  Kaggle BryanB (bryanb/fifa-player-stats-database) — native ratings
  2024:   Kaggle Rehan (rehandl23/fifa-24-player-stats-dataset) — native ratings
  2025:   Kaggle Aniss7 (aniss7/fifa-player-data-from-sofifa-2025-06-03) — native ratings
  2026:   Kaggle rovnez (rovnez/fc-26-fifa-26-player-data) — native ratings

Output: public/data/leagues/<leagueId>/players.json
"""

import json
import csv
import os
import sys
from collections import defaultdict

# ============================================================
# PATHS
# ============================================================
BASE = "/data/data/com.termux/files/home/Italian-League-simulator"
DATA_DIR = f"{BASE}/.migration-backup/sofifa_raw"
FIFA_MODEL_DIR = f"{BASE}/.migration-backup/fifa-model-repo"
OUT_DIR = f"{BASE}/artifacts/italian-league-simulator/public/data/leagues"

# ============================================================
# CLUB NAME → (league_id, club_id) mapping
# ============================================================
CLUB_NAME_MAP = {
    # --- Premier League ---
    "Manchester City": ("premier-league", "manchester-city"),
    "Arsenal": ("premier-league", "arsenal"),
    "Liverpool": ("premier-league", "liverpool"),
    "Chelsea": ("premier-league", "chelsea"),
    "Manchester United": ("premier-league", "manchester-united"),
    "Tottenham": ("premier-league", "tottenham"),
    "Tottenham Hotspur": ("premier-league", "tottenham"),
    "Newcastle": ("premier-league", "newcastle"),
    "Newcastle United": ("premier-league", "newcastle"),
    "Aston Villa": ("premier-league", "aston-villa"),
    "Brighton": ("premier-league", "brighton"),
    "Brighton & Hove Albion": ("premier-league", "brighton"),
    "Brighton Hove Albion": ("premier-league", "brighton"),
    "West Ham": ("premier-league", "west-ham"),
    "West Ham United": ("premier-league", "west-ham"),
    "Crystal Palace": ("premier-league", "crystal-palace"),
    "Fulham": ("premier-league", "fulham"),
    "Wolverhampton": ("premier-league", "wolverhampton"),
    "Wolverhampton Wanderers": ("premier-league", "wolverhampton"),
    "Bournemouth": ("premier-league", "bournemouth"),
    "AFC Bournemouth": ("premier-league", "bournemouth"),
    "Nottingham Forest": ("premier-league", "nottingham-forest"),
    "Everton": ("premier-league", "everton"),
    "Brentford": ("premier-league", "brentford"),
    "Southampton": ("premier-league", "southampton"),
    "Leicester": ("premier-league", "leicester"),
    "Leicester City": ("premier-league", "leicester"),
    "Ipswich": ("premier-league", "ipswich"),
    "Ipswich Town": ("premier-league", "ipswich"),
    "West Brom": ("premier-league", "west-ham"),
    "West Bromwich Albion": ("premier-league", "west-ham"),
    "Stoke": ("premier-league", "stoke-city"),
    "Stoke City": ("premier-league", "stoke-city"),
    "Swansea": ("premier-league", "swansea-city"),
    "Swansea City": ("premier-league", "swansea-city"),
    "Hull": ("premier-league", "hull-city"),
    "Hull City": ("premier-league", "hull-city"),
    "Burnley": ("premier-league", "burnley"),
    "Wigan": ("premier-league", "wigan-athletic"),
    "Wigan Athletic": ("premier-league", "wigan-athletic"),
    "Reading": ("premier-league", "reading"),
    "QPR": ("premier-league", "queens-park-rangers"),
    "Queens Park Rangers": ("premier-league", "queens-park-rangers"),
    "Norwich": ("premier-league", "norwich-city"),
    "Norwich City": ("premier-league", "norwich-city"),
    "Watford": ("premier-league", "watford"),
    "Cardiff": ("premier-league", "cardiff-city"),
    "Cardiff City": ("premier-league", "cardiff-city"),
    "Sheffield United": ("premier-league", "sheffield-united"),
    "Leeds": ("premier-league", "leeds-united"),
    "Leeds United": ("premier-league", "leeds-united"),
    "Middlesbrough": ("premier-league", "middlesbrough"),
    "Sunderland": ("premier-league", "sunderland"),
    "Derby": ("premier-league", "derby-county"),
    "Derby County": ("premier-league", "derby-county"),
    "Bolton": ("premier-league", "bolton-wanderers"),
    "Bolton Wanderers": ("premier-league", "bolton-wanderers"),
    "Portsmouth": ("premier-league", "portsmouth"),
    "Charlton": ("premier-league", "charlton-athletic"),
    "Charlton Athletic": ("premier-league", "charlton-athletic"),
    "Blackburn": ("premier-league", "blackburn-rovers"),
    "Blackburn Rovers": ("premier-league", "blackburn-rovers"),
    "Birmingham": ("premier-league", "birmingham-city"),
    "Birmingham City": ("premier-league", "birmingham-city"),
    "Wolves": ("premier-league", "wolverhampton"),
    "Arsenal FC": ("premier-league", "arsenal"),
    "Chelsea FC": ("premier-league", "chelsea"),
    "Liverpool Fútbol Club": ("premier-league", "liverpool"),
    "Newcastle United Jets FC": ("premier-league", "newcastle"),
    "Newcastle Jets": ("premier-league", "newcastle"),

    # --- La Liga ---
    "Real Madrid": ("la-liga", "real-madrid"),
    "Real Madrid CF": ("la-liga", "real-madrid"),
    "Real Madrid Club de Fútbol": ("la-liga", "real-madrid"),
    "Barcelona": ("la-liga", "barcelona"),
    "FC Barcelona": ("la-liga", "barcelona"),
    "F.C. Barcelona": ("la-liga", "barcelona"),
    "Atlético Madrid": ("la-liga", "atletico-madrid"),
    "Atletico Madrid": ("la-liga", "atletico-madrid"),
    "Atletico de Madrid": ("la-liga", "atletico-madrid"),
    "Real Sociedad": ("la-liga", "real-sociedad"),
    "Athletic Bilbao": ("la-liga", "athletic-bilbao"),
    "Athletic Club": ("la-liga", "athletic-bilbao"),
    "Athletic Club de Bilbao": ("la-liga", "athletic-bilbao"),
    "Athletic de Bilbao": ("la-liga", "athletic-bilbao"),
    "Villarreal": ("la-liga", "villarreal"),
    "Villarreal CF": ("la-liga", "villarreal"),
    "Villarreal C.F.": ("la-liga", "villarreal"),
    "Villarreal Club de Fútbol": ("la-liga", "villarreal"),
    "Real Betis": ("la-liga", "real-betis"),
    "Sevilla": ("la-liga", "sevilla"),
    "Sevilla FC": ("la-liga", "sevilla"),
    "Sevilla F.C.": ("la-liga", "sevilla"),
    "Sevilla Fútbol Club": ("la-liga", "sevilla"),
    "Valencia": ("la-liga", "valencia"),
    "Valencia CF": ("la-liga", "valencia"),
    "Valencia C.F.": ("la-liga", "valencia"),
    "Valencia Club de Fútbol": ("la-liga", "valencia"),
    "Celta Vigo": ("la-liga", "celta-vigo"),
    "Celta de Vigo": ("la-liga", "celta-vigo"),
    "R.C. Celta": ("la-liga", "celta-vigo"),
    "R.C. Celta Vigo": ("la-liga", "celta-vigo"),
    "RC Celta": ("la-liga", "celta-vigo"),
    "RC Celta Vigo": ("la-liga", "celta-vigo"),
    "RC Celta de Vigo": ("la-liga", "celta-vigo"),
    "Real Club Celta de Vigo": ("la-liga", "celta-vigo"),
    "Getafe": ("la-liga", "getafe"),
    "Osasuna": ("la-liga", "osasuna"),
    "Girona": ("la-liga", "girona"),
    "Girona FC": ("la-liga", "girona"),
    "Girona C.F.": ("la-liga", "girona"),
    "Girona Fútbol Club": ("la-liga", "girona"),
    "Mallorca": ("la-liga", "mallorca"),
    "R.C.D. Mallorca": ("la-liga", "mallorca"),
    "RCD Mallorca": ("la-liga", "mallorca"),
    "Real Club Deportivo Mallorca": ("la-liga", "mallorca"),
    "Rayo Vallecano": ("la-liga", "rayo-vallecano"),
    "Las Palmas": ("la-liga", "las-palmas"),
    "U.D. Las Palmas": ("la-liga", "las-palmas"),
    "UD Las Palmas": ("la-liga", "las-palmas"),
    "Ud Las Palmas": ("la-liga", "las-palmas"),
    "Unión Deportiva Las Palmas": ("la-liga", "las-palmas"),
    "Alavés": ("la-liga", "alaves"),
    "Deportivo Alavés": ("la-liga", "alaves"),
    "Cádiz": ("la-liga", "cadiz"),
    "Cádiz CF": ("la-liga", "cadiz"),
    "Granada": ("la-liga", "granada"),
    "Granada CF": ("la-liga", "granada"),
    "Granada Club de Fútbol": ("la-liga", "granada"),
    "Almería": ("la-liga", "almeria"),
    "UD Almería": ("la-liga", "almeria"),
    "Espanyol": ("la-liga", "espanyol"),
    "RCD Espanyol de Barcelona": ("la-liga", "espanyol"),
    "R.C.D. Espanyol de Barcelona S.A.D.": ("la-liga", "espanyol"),
    "Málaga": ("la-liga", "malaga"),
    "Málaga CF": ("la-liga", "malaga"),
    "Deportivo La Coruña": ("la-liga", "deportivo-la-coruna"),
    "Sporting Gijón": ("la-liga", "sporting-gijon"),
    "Real Valladolid": ("la-liga", "valladolid"),
    "Valladolid": ("la-liga", "valladolid"),
    "Real Zaragoza": ("la-liga", "zaragoza"),
    "Zaragoza": ("la-liga", "zaragoza"),
    "Levante": ("la-liga", "levante"),
    "Levante UD": ("la-liga", "levante"),
    "Elche": ("la-liga", "elche"),
    "Elche CF": ("la-liga", "elche"),
    "Huesca": ("la-liga", "huesca"),
    "SD Huesca": ("la-liga", "huesca"),
    "Leganés": ("la-liga", "leganes"),
    "CD Leganés": ("la-liga", "leganes"),
    "Albacete": ("la-liga", "albacete"),
    "Córdoba": ("la-liga", "cordoba"),
    "CD Tenerife": ("la-liga", "tenerife"),
    "Tenerife": ("la-liga", "tenerife"),
    "Real Oviedo": ("la-liga", "oviedo"),
    "Oviedo": ("la-liga", "oviedo"),
    "Racing Santander": ("la-liga", "racing-santander"),
    "Recreativo": ("la-liga", "recreativo"),
    "Recreativo de Huelva": ("la-liga", "recreativo"),
    "Real Murcia": ("la-liga", "murcia"),
    "Murcia": ("la-liga", "murcia"),
    "Xerez": ("la-liga", "xerez"),
    "Hércules": ("la-liga", "hercules"),
    "Hércules CF": ("la-liga", "hercules"),
    "Numancia": ("la-liga", "numancia"),
    "Rayo": ("la-liga", "rayo-vallecano"),
    "Betis": ("la-liga", "real-betis"),

    # --- Ligue 1 ---
    "Paris Saint-Germain": ("ligue-1", "psg"),
    "Paris SG": ("ligue-1", "psg"),
    "PSG": ("ligue-1", "psg"),
    "Paris Saint-Germain FC": ("ligue-1", "psg"),
    "Marseille": ("ligue-1", "marseille"),
    "Olympique Marseille": ("ligue-1", "marseille"),
    "Olympique de Marseille": ("ligue-1", "marseille"),
    "Lyon": ("ligue-1", "lyon"),
    "Olympique Lyonnais": ("ligue-1", "lyon"),
    "Monaco": ("ligue-1", "monaco"),
    "AS Monaco": ("ligue-1", "monaco"),
    "AS Monaco FC": ("ligue-1", "monaco"),
    "AS Monaco Football Club SA": ("ligue-1", "monaco"),
    "Lille": ("ligue-1", "lille"),
    "Lille OSC": ("ligue-1", "lille"),
    "LOSC Lille": ("ligue-1", "lille"),
    "LOSC Lille Métropole": ("ligue-1", "lille"),
    "Nice": ("ligue-1", "nice"),
    "OGC Nice": ("ligue-1", "nice"),
    "OGC Nice Côte D'azur": ("ligue-1", "nice"),
    "Rennes": ("ligue-1", "rennes"),
    "Stade Rennais": ("ligue-1", "rennes"),
    "Lens": ("ligue-1", "lens"),
    "RC Lens": ("ligue-1", "lens"),
    "Racing Club de Lens": ("ligue-1", "lens"),
    "Strasbourg": ("ligue-1", "strasbourg"),
    "RC Strasbourg": ("ligue-1", "strasbourg"),
    "RC Strasbourg Alsace": ("ligue-1", "strasbourg"),
    "Toulouse": ("ligue-1", "toulouse"),
    "Toulouse FC": ("ligue-1", "toulouse"),
    "Toulouse F.C.": ("ligue-1", "toulouse"),
    "Toulouse Football Club": ("ligue-1", "toulouse"),
    "Montpellier": ("ligue-1", "montpellier"),
    "Montpellier HSC": ("ligue-1", "montpellier"),
    "Montpellier Hérault SC": ("ligue-1", "montpellier"),
    "Montpellier Hérault Sport Club": ("ligue-1", "montpellier"),
    "Nantes": ("ligue-1", "nantes"),
    "FC Nantes": ("ligue-1", "nantes"),
    "Brest": ("ligue-1", "brest"),
    "Stade Brestois": ("ligue-1", "brest"),
    "Stade Brestois 29": ("ligue-1", "brest"),
    "Reims": ("ligue-1", "reims"),
    "Stade de Reims": ("ligue-1", "reims"),
    "Lorient": ("ligue-1", "lorient"),
    "FC Lorient": ("ligue-1", "lorient"),
    "FC Lorient Bretagne Sud": ("ligue-1", "lorient"),
    "Le Havre": ("ligue-1", "le-havre"),
    "Le Havre AC": ("ligue-1", "le-havre"),
    "Le Havre Athletic Club": ("ligue-1", "le-havre"),
    "Havre Athletic Club": ("ligue-1", "le-havre"),
    "Metz": ("ligue-1", "metz"),
    "FC Metz": ("ligue-1", "metz"),
    "Football Club de Metz": ("ligue-1", "metz"),
    "Clermont": ("ligue-1", "clermont"),
    "Clermont Foot": ("ligue-1", "clermont"),
    "Clermont Foot 63": ("ligue-1", "clermont"),
    "Clermont Foot Auvergne": ("ligue-1", "clermont"),
    "Clermont Foot Auvergne 63": ("ligue-1", "clermont"),
    "Bordeaux": ("ligue-1", "bordeaux"),
    "Girondins de Bordeaux": ("ligue-1", "bordeaux"),
    "Saint-Étienne": ("ligue-1", "saint-etienne"),
    "AS Saint-Étienne": ("ligue-1", "saint-etienne"),
    "A.S. Saint-Etienne": ("ligue-1", "saint-etienne"),
    "AS Saint-Etienne": ("ligue-1", "saint-etienne"),
    "Nîmes": ("ligue-1", "nimes"),
    "Nîmes Olympique": ("ligue-1", "nimes"),
    "Angers": ("ligue-1", "angers"),
    "Angers SCO": ("ligue-1", "angers"),
    "Dijon": ("ligue-1", "dijon"),
    "Dijon FCO": ("ligue-1", "dijon"),
    "Guingamp": ("ligue-1", "guingamp"),
    "EA Guingamp": ("ligue-1", "guingamp"),
    "Caen": ("ligue-1", "caen"),
    "SM Caen": ("ligue-1", "caen"),
    "Troyes": ("ligue-1", "troyes"),
    "ESTAC Troyes": ("ligue-1", "troyes"),
    "Auxerre": ("ligue-1", "auxerre"),
    "AJ Auxerre": ("ligue-1", "auxerre"),
    "Sochaux": ("ligue-1", "sochaux"),
    "FC Sochaux": ("ligue-1", "sochaux"),
    "Valenciennes": ("ligue-1", "valenciennes"),
    "Valenciennes FC": ("ligue-1", "valenciennes"),
    "Laval": ("ligue-1", "laval"),
    "Stade Lavallois": ("ligue-1", "laval"),
    "Bastia": ("ligue-1", "bastia"),
    "SC Bastia": ("ligue-1", "bastia"),
    "Ajaccio": ("ligue-1", "ajaccio"),
    "AC Ajaccio": ("ligue-1", "ajaccio"),
    "Paris FC": ("ligue-1", "psg"),

    # --- Bundesliga ---
    "Bayern Munich": ("bundesliga", "bayern-munich"),
    "Bayern München": ("bundesliga", "bayern-munich"),
    "FC Bayern Munich": ("bundesliga", "bayern-munich"),
    "FC Bayern München": ("bundesliga", "bayern-munich"),
    "Borussia Dortmund": ("bundesliga", "borussia-dortmund"),
    "BVB Dortmund": ("bundesliga", "borussia-dortmund"),
    "RB Leipzig": ("bundesliga", "rb-leipzig"),
    "Bayer Leverkusen": ("bundesliga", "bayer-leverkusen"),
    "Bayer 04 Leverkusen": ("bundesliga", "bayer-leverkusen"),
    "Eintracht Frankfurt": ("bundesliga", "eintracht-frankfurt"),
    "Wolfsburg": ("bundesliga", "wolfsburg"),
    "VfL Wolfsburg": ("bundesliga", "wolfsburg"),
    "Freiburg": ("bundesliga", "freiburg"),
    "SC Freiburg": ("bundesliga", "freiburg"),
    "Sport-Club Freiburg": ("bundesliga", "freiburg"),
    "Stuttgart": ("bundesliga", "stuttgart"),
    "VfB Stuttgart": ("bundesliga", "stuttgart"),
    "Hoffenheim": ("bundesliga", "hoffenheim"),
    "1899 Hoffenheim": ("bundesliga", "hoffenheim"),
    "TSG 1899 Hoffenheim": ("bundesliga", "hoffenheim"),
    "Werder Bremen": ("bundesliga", "werder-bremen"),
    "SV Werder Bremen": ("bundesliga", "werder-bremen"),
    "Mainz": ("bundesliga", "mainz"),
    "1. FSV Mainz 05": ("bundesliga", "mainz"),
    "Augsburg": ("bundesliga", "augsburg"),
    "FC Augsburg": ("bundesliga", "augsburg"),
    "Borussia M'gladbach": ("bundesliga", "borussia-mgladbach"),
    "Borussia Mönchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Borussia Monchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Gladbach": ("bundesliga", "borussia-mgladbach"),
    "Monchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Union Berlin": ("bundesliga", "union-berlin"),
    "1. FC Union Berlin": ("bundesliga", "union-berlin"),
    "Bochum": ("bundesliga", "bochum"),
    "VfL Bochum": ("bundesliga", "bochum"),
    "VfL Bochum 1848": ("bundesliga", "bochum"),
    "Heidenheim": ("bundesliga", "heidenheim"),
    "1. FC Heidenheim": ("bundesliga", "heidenheim"),
    "1. FC Heidenheim 1846": ("bundesliga", "heidenheim"),
    "Darmstadt": ("bundesliga", "darmstadt"),
    "SV Darmstadt 98": ("bundesliga", "darmstadt"),
    "Köln": ("bundesliga", "koln"),
    "1. FC Köln": ("bundesliga", "koln"),
    "FC Köln": ("bundesliga", "koln"),
    "1. FC Koln": ("bundesliga", "koln"),
    "FC Koln": ("bundesliga", "koln"),
    "Fortuna Köln": ("bundesliga", "koln"),
    "SC Fortuna Köln": ("bundesliga", "koln"),
    "Fußballclub Viktoria Köln 1904 e.V.": ("bundesliga", "koln"),
    "Hamburg": ("bundesliga", "hamburg"),
    "Hamburger SV": ("bundesliga", "hamburg"),
    "HSV": ("bundesliga", "hamburg"),
    "Schalke": ("bundesliga", "schalke"),
    "Schalke 04": ("bundesliga", "schalke"),
    "FC Schalke 04": ("bundesliga", "schalke"),
    "Hertha": ("bundesliga", "hertha"),
    "Hertha BSC": ("bundesliga", "hertha"),
    "Hertha Berlin": ("bundesliga", "hertha"),
    "Hannover": ("bundesliga", "hannover"),
    "Hannover 96": ("bundesliga", "hannover"),
    "Nürnberg": ("bundesliga", "nurnberg"),
    "1. FC Nürnberg": ("bundesliga", "nurnberg"),
    "1. FC Nuremberg": ("bundesliga", "nurnberg"),
    "Kaiserslautern": ("bundesliga", "kaiserslautern"),
    "1. FC Kaiserslautern": ("bundesliga", "kaiserslautern"),
    "Duisburg": ("bundesliga", "duisburg"),
    "MSV Duisburg": ("bundesliga", "duisburg"),
    "Aachen": ("bundesliga", "aachen"),
    "Alemannia Aachen": ("bundesliga", "aachen"),
    "Bielefeld": ("bundesliga", "bielefeld"),
    "Arminia Bielefeld": ("bundesliga", "bielefeld"),
    "Karlsruhe": ("bundesliga", "karlsruhe"),
    "Karlsruher SC": ("bundesliga", "karlsruhe"),
    "Dresden": ("bundesliga", "dresden"),
    "Dynamo Dresden": ("bundesliga", "dresden"),
    "St. Pauli": ("bundesliga", "st-pauli"),
    "FC St. Pauli": ("bundesliga", "st-pauli"),
    "Paderborn": ("bundesliga", "paderborn"),
    "SC Paderborn": ("bundesliga", "paderborn"),
    "Greuther Fürth": ("bundesliga", "greuther-furth"),
    "Fürth": ("bundesliga", "greuther-furth"),
    "Erzgebirge Aue": ("bundesliga", "erzgebirge-aue"),
    "Sandhausen": ("bundesliga", "sandhausen"),
    "SV Sandhausen": ("bundesliga", "sandhausen"),
    "Regensburg": ("bundesliga", "regensburg"),
    "Jahn Regensburg": ("bundesliga", "regensburg"),
    "Ingolstadt": ("bundesliga", "ingolstadt"),
    "FC Ingolstadt": ("bundesliga", "ingolstadt"),
    "Braunschweig": ("bundesliga", "braunschweig"),
    "Eintracht Braunschweig": ("bundesliga", "braunschweig"),
    "Rostock": ("bundesliga", "rostock"),
    "Hansa Rostock": ("bundesliga", "rostock"),
    "Wiesbaden": ("bundesliga", "wiesbaden"),
    "Wehen Wiesbaden": ("bundesliga", "wiesbaden"),
    "Osnabrück": ("bundesliga", "osnabruck"),
    "VfL Osnabrück": ("bundesliga", "osnabruck"),
    "Ulm": ("bundesliga", "ulm"),
    "SSV Ulm": ("bundesliga", "ulm"),
    "Unterhaching": ("bundesliga", "unterhaching"),
    "SpVgg Unterhaching": ("bundesliga", "unterhaching"),
    "Essen": ("bundesliga", "essen"),
    "Rot-Weiss Essen": ("bundesliga", "essen"),
    "Leverkusen": ("bundesliga", "bayer-leverkusen"),
    "M'gladbach": ("bundesliga", "borussia-mgladbach"),
    "Mönchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Bayern": ("bundesliga", "bayern-munich"),
    "Dortmund": ("bundesliga", "borussia-dortmund"),
    "Leipzig": ("bundesliga", "rb-leipzig"),
    "Frankfurt": ("bundesliga", "eintracht-frankfurt"),
    "1860 Munich": ("bundesliga", "bayern-munich"),
    "1860 München": ("bundesliga", "bayern-munich"),
}

# ============================================================
# POSITION MAPPING
# ============================================================
def clean_player_name(name):
    """Remove numeric prefixes and extra whitespace from player names."""
    if not name:
        return "Unknown"
    # Remove leading numbers and whitespace (e.g. "07 E. Howe" → "E. Howe")
    name = name.strip()
    # Split by whitespace and remove leading numeric tokens
    parts = name.split()
    while parts and parts[0].replace(".", "").replace(" ", "").strip().isdigit():
        parts.pop(0)
    # Also handle non-breaking space
    cleaned = " ".join(parts).strip()
    # Remove any remaining leading digits after special chars
    cleaned = cleaned.lstrip("0123456789  \t")
    return cleaned if cleaned else name


def map_position(pos_str):
    """Map FIFA position string to GK/DEF/MID/ATT category."""
    if not pos_str:
        return "MID"
    pos = pos_str.upper().strip()
    # GK
    if pos in ("GK",):
        return "GK"
    # DEF
    if pos in ("CB", "LB", "RB", "LWB", "RWB", "SW", "LCB", "RCB"):
        return "DEF"
    # MID
    if pos in ("CDM", "CM", "CAM", "LM", "RM", "LDM", "RDM", "LAM", "RAM"):
        return "MID"
    # ATT
    if pos in ("ST", "CF", "LW", "RW", "LF", "RF", "LS", "RS"):
        return "ATT"
    # Fallback: check substrings
    if "GK" in pos:
        return "GK"
    if any(p in pos for p in ["CB", "LB", "RB", "WB", "SW"]):
        return "DEF"
    if any(p in pos for p in ["ST", "CF", "LW", "RW", "LF"]):
        return "ATT"
    return "MID"


def map_preferred_positions(pos_str):
    """Map preferred_positions string like 'ST/CF' to list of categories."""
    if not pos_str:
        return ["MID"]
    positions = [p.strip() for p in pos_str.replace(",", "/").split("/")]
    categories = set()
    for p in positions:
        cat = map_position(p)
        categories.add(cat)
    return list(categories) if categories else ["MID"]


# ============================================================
# DATA STRUCTURES
# ============================================================
# league_data[league_id][club_id][player_name] = {seasons: [...]}
league_data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"seasons": []})))

# ============================================================
# SOURCE 1: FIFA Model Repo (lbenz730/fifa_model) — FIFA 05-20
# ============================================================
print("=" * 60)
print("SOURCE 1: FIFA Model Repo (FIFA 05-20)")
print("=" * 60)

fifa_model_count = 0
fifa_model_mapped = 0
with open(f"{FIFA_MODEL_DIR}/player_stats.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        fifa_model_count += 1
        club_name = row["club"].strip()
        if club_name not in CLUB_NAME_MAP:
            continue
        league_id, club_id = CLUB_NAME_MAP[club_name]
        fifa_model_mapped += 1

        name = clean_player_name(row["name"])
        if not name or name == "Unknown":
            continue
        season_code = row["season"].strip()  # "05", "06", etc.
        rating = row["rating"].strip()
        positions = row.get("preferred_positions", "").strip()

        # Convert season code "05" → "2004-2005", "16" → "2015-2016"
        year_int = int(season_code)
        if year_int >= 5:
            season_str = f"20{season_code:0>2}-20{season_code:0>2}"
            # Actually "05" means FIFA 05 which is season 2004-2005
            start_year = 2000 + year_int
            season_str = f"{start_year}-{start_year + 1}"
        else:
            # "00" → 2000-2001
            start_year = 2000 + year_int
            season_str = f"{start_year}-{start_year + 1}"

        try:
            rating_int = int(rating)
        except (ValueError, TypeError):
            continue

        pos_category = map_position(positions.split("/")[0] if positions else "")
        pos_categories = map_preferred_positions(positions)

        player = league_data[league_id][club_id][name]
        player["seasons"].append({
            "club": club_id,
            "season": season_str,
            "rating": rating_int,
            "positions": [pos_category],
            "categories": pos_categories,
        })

print(f"  Total rows: {fifa_model_count}")
print(f"  Mapped to leagues: {fifa_model_mapped}")

# ============================================================
# SOURCE 2: Kaggle BryanB (FIFA 17-23)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 2: Kaggle BryanB (FIFA 17-23)")
print("=" * 60)

bryanb_count = 0
bryanb_mapped = 0
for fifa_year in range(17, 24):
    filepath = f"{DATA_DIR}/FIFA{fifa_year}_official_data.csv"
    if not os.path.exists(filepath):
        print(f"  WARNING: {filepath} not found, skipping")
        continue

    season_str = f"20{fifa_year - 1}-{fifa_year}"
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            bryanb_count += 1
            club_name = row.get("Club", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            bryanb_mapped += 1

            name = clean_player_name(row.get("Name", ""))
            if not name or name == "Unknown":
                continue
            rating = row.get("Overall", "").strip()
            positions = row.get("Best Position", row.get("Position", "")).strip()

            try:
                rating_int = int(rating)
            except (ValueError, TypeError):
                continue

            pos_category = map_position(positions.split("/")[0] if positions else "")
            pos_categories = map_preferred_positions(positions)

            player = league_data[league_id][club_id][name]
            player["seasons"].append({
                "club": club_id,
                "season": season_str,
                "rating": rating_int,
                "positions": [pos_category],
                "categories": pos_categories,
            })

    print(f"  FIFA {fifa_year}: processed")

print(f"  Total rows: {bryanb_count}")
print(f"  Mapped to leagues: {bryanb_mapped}")

# ============================================================
# SOURCE 3: Kaggle Aniss7 (FIFA 25)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 3: Kaggle Aniss7 (FIFA 25)")
print("=" * 60)

aniss7_count = 0
aniss7_mapped = 0
filepath = f"{DATA_DIR}/player-data-full-2025-june.csv"
if os.path.exists(filepath):
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            aniss7_count += 1
            club_name = row.get("club_name", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            aniss7_mapped += 1

            name = clean_player_name(row.get("name", row.get("short_name", "")))
            if not name or name == "Unknown":
                continue
            rating = row.get("overall_rating", "").strip()
            positions = row.get("positions", "").strip()

            try:
                rating_int = int(rating)
            except (ValueError, TypeError):
                continue

            pos_category = map_position(positions.split(",")[0] if positions else "")
            pos_categories = map_preferred_positions(positions.replace(",", "/"))

            player = league_data[league_id][club_id][name]
            player["seasons"].append({
                "club": club_id,
                "season": "2024-2025",
                "rating": rating_int,
                "positions": [pos_category],
                "categories": pos_categories,
            })

print(f"  Total rows: {aniss7_count}")
print(f"  Mapped to leagues: {aniss7_mapped}")

# ============================================================
# SOURCE 4: Kaggle rovnez (FC 26)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 4: Kaggle rovnez (FC 26)")
print("=" * 60)

rovnez_count = 0
rovnez_mapped = 0
filepath = f"{DATA_DIR}/FC26_20250921.csv"
if os.path.exists(filepath):
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rovnez_count += 1
            club_name = row.get("club_name", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            rovnez_mapped += 1

            name = clean_player_name(row.get("short_name", row.get("long_name", "")))
            if not name or name == "Unknown":
                continue
            rating = row.get("overall", "").strip()
            positions = row.get("player_positions", "").strip()

            try:
                rating_int = int(rating)
            except (ValueError, TypeError):
                continue

            pos_category = map_position(positions.split(",")[0] if positions else "")
            pos_categories = map_preferred_positions(positions.replace(",", "/"))

            player = league_data[league_id][club_id][name]
            player["seasons"].append({
                "club": club_id,
                "season": "2025-2026",
                "rating": rating_int,
                "positions": [pos_category],
                "categories": pos_categories,
            })

print(f"  Total rows: {rovnez_count}")
print(f"  Mapped to leagues: {rovnez_mapped}")

# ============================================================
# SOURCE 5: Kaggle Rehan (FIFA 24)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 5: Kaggle Rehan (FIFA 24)")
print("=" * 60)

rehan_count = 0
rehan_mapped = 0
filepath = f"{DATA_DIR}/player_stats.csv"
if os.path.exists(filepath):
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rehan_count += 1
            club_name = row.get("club", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            rehan_mapped += 1

            name = clean_player_name(row.get("player", ""))
            if not name or name == "Unknown":
                continue
            # This dataset doesn't have overall rating directly — compute from stats
            # Use a weighted average of key stats as proxy
            stats_to_avg = [
                "ball_control", "dribbling", "short_pass", "long_pass",
                "acceleration", "sprint_speed", "strength", "agility",
                "shot_power", "finishing", "heading"
            ]
            vals = []
            for s in stats_to_avg:
                try:
                    vals.append(int(row.get(s, 0)))
                except (ValueError, TypeError):
                    pass
            if not vals:
                continue
            rating_int = round(sum(vals) / len(vals))

            # No position data in this dataset — default to MID
            pos_category = "MID"
            pos_categories = ["MID"]

            player = league_data[league_id][club_id][name]
            player["seasons"].append({
                "club": club_id,
                "season": "2023-2024",
                "rating": rating_int,
                "positions": [pos_category],
                "categories": pos_categories,
            })

print(f"  Total rows: {rehan_count}")
print(f"  Mapped to leagues: {rehan_mapped}")

# ============================================================
# OUTPUT: Generate players.json for each league
# ============================================================
print("\n" + "=" * 60)
print("OUTPUT: Generating players.json files")
print("=" * 60)

LEAGUE_ORDER = ["premier-league", "la-liga", "ligue-1", "bundesliga"]

for league_id in LEAGUE_ORDER:
    league_players = {}
    for club_id, players in league_data[league_id].items():
        for name, data in players.items():
            if name not in league_players:
                league_players[name] = {
                    "id": f"{name}__{data['seasons'][0]['positions'][0]}",
                    "name": name,
                    "position": data["seasons"][0]["positions"][0],
                    "position_category": data["seasons"][0]["positions"][0],
                    "seasons": [],
                }
            league_players[name]["seasons"].extend(data["seasons"])

    # Deduplicate seasons (same club+season → keep highest rating)
    for name, player in league_players.items():
        seen = {}
        for s in player["seasons"]:
            key = (s["club"], s["season"])
            if key not in seen or s["rating"] > seen[key]["rating"]:
                seen[key] = s
        player["seasons"] = sorted(seen.values(), key=lambda x: x["season"])

    # Sort players by name
    players_list = sorted(league_players.values(), key=lambda p: p["name"])

    output = {"players": players_list}
    out_path = f"{OUT_DIR}/{league_id}/players.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Stats
    total_seasons = sum(len(p["seasons"]) for p in players_list)
    ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    in_range = sum(1 for r in ratings if 70 <= r <= 85)
    pct_in_range = in_range / len(ratings) * 100 if ratings else 0

    print(f"\n  {league_id}:")
    print(f"    Players: {len(players_list)}")
    print(f"    Total seasons: {total_seasons}")
    print(f"    Avg rating: {avg_rating:.1f}")
    print(f"    Rating 70-85: {pct_in_range:.1f}%")
    print(f"    Output: {out_path}")

print("\n✅ Done!")
