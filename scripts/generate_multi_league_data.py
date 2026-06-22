#!/usr/bin/env python3
"""
Generate players.json for all 5 leagues from multiple FIFA datasets.
Preserves specific positions (ST, CB, CM, etc.) and generates all_positions/all_categories.
"""

import json, csv, os, re
from collections import defaultdict

BASE = "/data/data/com.termux/files/home/Italian-League-simulator"
DATA_DIR = f"{BASE}/.migration-backup/sofifa_raw"
FIFA_MODEL_DIR = f"{BASE}/.migration-backup/fifa-model-repo"
OUT_DIR = f"{BASE}/artifacts/italian-league-simulator/public/data/leagues"
os.makedirs(OUT_DIR, exist_ok=True)

# ============================================================
# POSITION MAPPING
# ============================================================

def clean_position(pos):
    """Clean position string from HTML tags and whitespace."""
    if not pos:
        return ""
    # Remove HTML tags like <span class="pos pos0">
    pos = re.sub(r'<[^>]+>', '', pos).strip()
    if pos.lower() == 'nan' or not pos:
        return ""
    return pos

def pos_to_category(pos):
    """Map specific position to category."""
    if not pos:
        return "MID"
    pos = pos.upper().strip()
    if pos == "GK":
        return "GK"
    if pos in ("CB", "LB", "RB", "LWB", "RWB", "SW", "LCB", "RCB"):
        return "DEF"
    if pos in ("CDM", "CM", "CAM", "LM", "RM", "LDM", "RDM", "LCM", "RCM", "LAM", "RAM", "LCAM", "RCAM", "LCDM", "RCDM", "LWM", "RWM"):
        return "MID"
    if pos in ("ST", "CF", "LW", "RW", "LF", "RF", "LS", "RS"):
        return "ATT"
    return "MID"  # fallback

# ============================================================
# CLUB NAME → (league_id, club_id) mapping
# ============================================================

CLUB_NAME_MAP = {
    # Premier League
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
    "West Brom": ("premier-league", "west-brom"),
    "West Bromwich Albion": ("premier-league", "west-brom"),
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
    "Liverpool FC": ("premier-league", "liverpool"),
    "Liverpool Fútbol Club": ("premier-league", "liverpool"),
    "Newcastle United Jets FC": ("premier-league", "newcastle"),
    "Newcastle Jets": ("premier-league", "newcastle"),
    "Everton FC": ("premier-league", "everton"),
    "Fulham FC": ("premier-league", "fulham"),
    "Brentford FC": ("premier-league", "brentford"),
    "Leeds United Association Football Club": ("premier-league", "leeds-united"),
    "Middlesbrough FC": ("premier-league", "middlesbrough"),
    "Sunderland AFC": ("premier-league", "sunderland"),
    "Sunderland Association Football Club": ("premier-league", "sunderland"),
    "West Bromwich Albion": ("premier-league", "west-brom"),
    "Tottenham Hotspur Football Club": ("premier-league", "tottenham"),
    "Manchester United Football Club": ("premier-league", "manchester-united"),
    "Manchester City Football Club": ("premier-league", "manchester-city"),
    "Liverpool Football Club": ("premier-league", "liverpool"),
    "Chelsea Football Club": ("premier-league", "chelsea"),
    "Arsenal Football Club": ("premier-league", "arsenal"),
    "Aston Villa Football Club": ("premier-league", "aston-villa"),
    "Newcastle United Football Club": ("premier-league", "newcastle"),
    "Everton Football Club": ("premier-league", "everton"),
    "Fulham Football Club": ("premier-league", "fulham"),
    "Crystal Palace Football Club": ("premier-league", "crystal-palace"),
    "West Ham United Football Club": ("premier-league", "west-ham"),
    "Wolverhampton Wanderers Football Club": ("premier-league", "wolverhampton"),
    "Leicester City": ("premier-league", "leicester"),
    "Southampton FC": ("premier-league", "southampton"),
    "Brighton and Hove Albion Football Club": ("premier-league", "brighton"),
    "Burnley Football Club": ("premier-league", "burnley"),
    "Sheffield United": ("premier-league", "sheffield-united"),
    "Ipswich Town": ("premier-league", "ipswich"),
    "Nottingham Forest Football Club": ("premier-league", "nottingham-forest"),
    "Huddersfield Town": ("premier-league", "huddersfield-town"),
    "Cardiff City": ("premier-league", "cardiff-city"),
    "Swansea City": ("premier-league", "swansea-city"),
    "Stoke City": ("premier-league", "stoke-city"),
    "Hull City": ("premier-league", "hull-city"),
    "Wigan Athletic": ("premier-league", "wigan-athletic"),
    "Reading FC": ("premier-league", "reading"),
    "Queens Park Rangers": ("premier-league", "queens-park-rangers"),
    "Norwich City": ("premier-league", "norwich-city"),
    "Watford FC": ("premier-league", "watford"),
    "Portsmouth FC": ("premier-league", "portsmouth"),
    "Derby County": ("premier-league", "derby-county"),
    "Bolton Wanderers": ("premier-league", "bolton-wanderers"),
    "Charlton Athletic": ("premier-league", "charlton-athletic"),
    "Blackburn Rovers": ("premier-league", "blackburn-rovers"),
    "Birmingham City": ("premier-league", "birmingham-city"),
    "Bournemouth": ("premier-league", "bournemouth"),
    "Association Football Club Bournemouth": ("premier-league", "bournemouth"),
    "Leeds United": ("premier-league", "leeds-united"),
    "Luton Town": ("premier-league", "luton-town"),
    "Nottingham Forest": ("premier-league", "nottingham-forest"),

    # La Liga
    "Real Madrid": ("la-liga", "real-madrid"),
    "Real Madrid CF": ("la-liga", "real-madrid"),
    "Real Madrid Club de Fútbol": ("la-liga", "real-madrid"),
    "Barcelona": ("la-liga", "barcelona"),
    "FC Barcelona": ("la-liga", "barcelona"),
    "F.C. Barcelona": ("la-liga", "barcelona"),
    "Futbol Club Barcelona": ("la-liga", "barcelona"),
    "Atlético Madrid": ("la-liga", "atletico-madrid"),
    "Atletico Madrid": ("la-liga", "atletico-madrid"),
    "Atletico de Madrid": ("la-liga", "atletico-madrid"),
    "Club Atlético de Madrid S.A.D.": ("la-liga", "atletico-madrid"),
    "Real Sociedad": ("la-liga", "real-sociedad"),
    "Real Sociedad de Fútbol S.A.D.": ("la-liga", "real-sociedad"),
    "Athletic Bilbao": ("la-liga", "athletic-bilbao"),
    "Athletic Club": ("la-liga", "athletic-bilbao"),
    "Athletic Club Bilbao": ("la-liga", "athletic-bilbao"),
    "Athletic Club de Bilbao": ("la-liga", "athletic-bilbao"),
    "Athletic de Bilbao": ("la-liga", "athletic-bilbao"),
    "Villarreal": ("la-liga", "villarreal"),
    "Villarreal CF": ("la-liga", "villarreal"),
    "Villarreal C.F.": ("la-liga", "villarreal"),
    "Villarreal Club de Fútbol": ("la-liga", "villarreal"),
    "Villarreal Club de Fútbol S.A.D.": ("la-liga", "villarreal"),
    "Real Betis": ("la-liga", "real-betis"),
    "Real Betis Balompié": ("la-liga", "real-betis"),
    "Real Betis Balompié S.A.D.": ("la-liga", "real-betis"),
    "Sevilla": ("la-liga", "sevilla"),
    "Sevilla FC": ("la-liga", "sevilla"),
    "Sevilla F.C.": ("la-liga", "sevilla"),
    "Sevilla Fútbol Club": ("la-liga", "sevilla"),
    "Sevilla Fútbol Club S.A.D.": ("la-liga", "sevilla"),
    "Valencia": ("la-liga", "valencia"),
    "Valencia CF": ("la-liga", "valencia"),
    "Valencia C.F.": ("la-liga", "valencia"),
    "Valencia Club de Fútbol": ("la-liga", "valencia"),
    "Valencia Club de Fútbol S.A.D.": ("la-liga", "valencia"),
    "Celta Vigo": ("la-liga", "celta-vigo"),
    "Celta de Vigo": ("la-liga", "celta-vigo"),
    "R.C. Celta": ("la-liga", "celta-vigo"),
    "R.C. Celta Vigo": ("la-liga", "celta-vigo"),
    "RC Celta": ("la-liga", "celta-vigo"),
    "RC Celta Vigo": ("la-liga", "celta-vigo"),
    "RC Celta de Vigo": ("la-liga", "celta-vigo"),
    "Real Club Celta de Vigo": ("la-liga", "celta-vigo"),
    "Real Club Celta de Vigo S. A. D.": ("la-liga", "celta-vigo"),
    "Getafe": ("la-liga", "getafe"),
    "Getafe CF": ("la-liga", "getafe"),
    "Getafe Club de Fútbol S. A. D. Team Dubai": ("la-liga", "getafe"),
    "Osasuna": ("la-liga", "osasuna"),
    "Club Atlético Osasuna": ("la-liga", "osasuna"),
    "Girona": ("la-liga", "girona"),
    "Girona FC": ("la-liga", "girona"),
    "Girona C.F.": ("la-liga", "girona"),
    "Girona Fútbol Club": ("la-liga", "girona"),
    "Girona Fútbol Club S. A. D.": ("la-liga", "girona"),
    "Mallorca": ("la-liga", "mallorca"),
    "R.C.D. Mallorca": ("la-liga", "mallorca"),
    "RCD Mallorca": ("la-liga", "mallorca"),
    "Real Club Deportivo Mallorca": ("la-liga", "mallorca"),
    "Real Club Deportivo Mallorca S.A.D.": ("la-liga", "mallorca"),
    "Rayo Vallecano": ("la-liga", "rayo-vallecano"),
    "Rayo Vallecano de Madrid S. A. D.": ("la-liga", "rayo-vallecano"),
    "Las Palmas": ("la-liga", "las-palmas"),
    "U.D. Las Palmas": ("la-liga", "las-palmas"),
    "UD Las Palmas": ("la-liga", "las-palmas"),
    "Ud Las Palmas": ("la-liga", "las-palmas"),
    "Unión Deportiva Las Palmas": ("la-liga", "las-palmas"),
    "Unión Deportiva Las Palmas S.A.D.": ("la-liga", "las-palmas"),
    "Alavés": ("la-liga", "alaves"),
    "Deportivo Alavés": ("la-liga", "alaves"),
    "Deportivo Alavés S. A. D.": ("la-liga", "alaves"),
    "Cádiz": ("la-liga", "cadiz"),
    "Cádiz CF": ("la-liga", "cadiz"),
    "Granada": ("la-liga", "granada"),
    "Granada CF": ("la-liga", "granada"),
    "Granada Club de Fútbol": ("la-liga", "granada"),
    "Almería": ("la-liga", "almeria"),
    "UD Almería": ("la-liga", "almeria"),
    "RCD Espanyol": ("la-liga", "espanyol"),
    "RCD Espanyol de Barcelona": ("la-liga", "espanyol"),
    "RCD Espanyol de Barcelona S.A.D.": ("la-liga", "espanyol"),
    "R.C.D. Espanyol de Barcelona S.A.D.": ("la-liga", "espanyol"),
    "Reial Club Deportiu Espanyol de Barcelona S.A.D.": ("la-liga", "espanyol"),
    "Espanyol": ("la-liga", "espanyol"),
    "Málaga": ("la-liga", "malaga"),
    "Málaga CF": ("la-liga", "malaga"),
    "Deportivo La Coruña": ("la-liga", "deportivo-la-coruna"),
    "Deportivo de La Coruña": ("la-liga", "deportivo-la-coruna"),
    "Sporting Gijón": ("la-liga", "sporting-gijon"),
    "Real Valladolid": ("la-liga", "valladolid"),
    "Real Valladolid CF": ("la-liga", "valladolid"),
    "Valladolid": ("la-liga", "valladolid"),
    "Real Zaragoza": ("la-liga", "zaragoza"),
    "Zaragoza": ("la-liga", "zaragoza"),
    "Levante": ("la-liga", "levante"),
    "Levante UD": ("la-liga", "levante"),
    "Levante Unión Deportiva S.A.D.": ("la-liga", "levante"),
    "Elche": ("la-liga", "elche"),
    "Elche CF": ("la-liga", "elche"),
    "Elche Club de Fútbol S.A.D.": ("la-liga", "elche"),
    "Huesca": ("la-liga", "huesca"),
    "SD Huesca": ("la-liga", "huesca"),
    "Leganés": ("la-liga", "leganes"),
    "CD Leganés": ("la-liga", "leganes"),
    "Albacete": ("la-liga", "albacete"),
    "Albacete Balompié": ("la-liga", "albacete"),
    "Córdoba": ("la-liga", "cordoba"),
    "Córdoba CF": ("la-liga", "cordoba"),
    "Real Oviedo": ("la-liga", "oviedo"),
    "Real Oviedo S.A.D.": ("la-liga", "oviedo"),
    "Racing Santander": ("la-liga", "racing-santander"),
    "SD Eibar": ("la-liga", "eibar"),
    "Eibar": ("la-liga", "eibar"),
    "Rayo": ("la-liga", "rayo-vallecano"),
    "Betis": ("la-liga", "real-betis"),
    "Sevilla Atlético": ("la-liga", "sevilla"),
    "Sevilla Atlético F.C.": ("la-liga", "sevilla"),
    "Sevilla Fútbol Club S.A.D.": ("la-liga", "sevilla"),
    "Valencia Club de Fútbol S.A.D.": ("la-liga", "valencia"),
    "Villarreal Club de Fútbol S.A.D.": ("la-liga", "villarreal"),
    "Real Madrid CF": ("la-liga", "real-madrid"),
    "FC Barcelona": ("la-liga", "barcelona"),
    "Atlético de Madrid": ("la-liga", "atletico-madrid"),

    # Ligue 1
    "Paris Saint-Germain": ("ligue-1", "psg"),
    "Paris SG": ("ligue-1", "psg"),
    "PSG": ("ligue-1", "psg"),
    "Paris Saint-Germain FC": ("ligue-1", "psg"),
    "Paris Saint-Germain Football Club": ("ligue-1", "psg"),
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
    "Stade Rennais FC": ("ligue-1", "rennes"),
    "Stade Rennais Football Club": ("ligue-1", "rennes"),
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
    "Stade brestois 29": ("ligue-1", "brest"),
    "Reims": ("ligue-1", "reims"),
    "Stade de Reims": ("ligue-1", "reims"),
    "Stade Reims": ("ligue-1", "reims"),
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
    "FC Girondins Bordeaux": ("ligue-1", "bordeaux"),
    "Girondins de Bordeaux": ("ligue-1", "bordeaux"),
    "FC Girondins de Bordeaux": ("ligue-1", "bordeaux"),
    "Saint-Étienne": ("ligue-1", "saint-etienne"),
    "AS Saint-Étienne": ("ligue-1", "saint-etienne"),
    "A.S. Saint-Etienne": ("ligue-1", "saint-etienne"),
    "AS Saint-Etienne": ("ligue-1", "saint-etienne"),
    "Nîmes": ("ligue-1", "nimes"),
    "Nîmes Olympique": ("ligue-1", "nimes"),
    "Angers": ("ligue-1", "angers"),
    "Angers SCO": ("ligue-1", "angers"),
    "Angers Sporting Club de l'Ouest": ("ligue-1", "angers"),
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
    "Association de la Jeunesse auxerroise": ("ligue-1", "auxerre"),
    "Sochaux": ("ligue-1", "sochaux"),
    "FC Sochaux-Montbéliard": ("ligue-1", "sochaux"),
    "Bastia": ("ligue-1", "bastia"),
    "SC Bastia": ("ligue-1", "bastia"),
    "Ajaccio": ("ligue-1", "ajaccio"),
    "AC Ajaccio": ("ligue-1", "ajaccio"),
    "GFC Ajaccio": ("ligue-1", "ajaccio"),
    "Nancy": ("ligue-1", "nancy"),
    "AS Nancy-Lorraine": ("ligue-1", "nancy"),
    "AS Nancy-Lorraine": ("ligue-1", "nancy"),
    "Valenciennes": ("ligue-1", "valenciennes"),
    "Valenciennes FC": ("ligue-1", "valenciennes"),
    "Laval": ("ligue-1", "laval"),
    "Stade Lavallois": ("ligue-1", "laval"),
    "Paris FC": ("ligue-1", "paris-fc"),
    "Paris Football Club": ("ligue-1", "paris-fc"),
    "Olympique Lyon": ("ligue-1", "lyon"),
    "Olympique Marseille": ("ligue-1", "marseille"),
    "AS Monaco": ("ligue-1", "monaco"),
    "LOSC Lille": ("ligue-1", "lille"),
    "FC Nantes": ("ligue-1", "nantes"),
    "Stade Rennais FC": ("ligue-1", "rennes"),
    "Stade Rennais": ("ligue-1", "rennes"),
    "OGC Nice": ("ligue-1", "nice"),
    "FC Girondins Bordeaux": ("ligue-1", "bordeaux"),
    "AS Saint-Étienne": ("ligue-1", "saint-etienne"),
    "RC Lens": ("ligue-1", "lens"),
    "RC Strasbourg": ("ligue-1", "strasbourg"),
    "RC Strasbourg Alsace": ("ligue-1", "strasbourg"),
    "Toulouse FC": ("ligue-1", "toulouse"),
    "Montpellier HSC": ("ligue-1", "montpellier"),
    "Stade Brestois 29": ("ligue-1", "brest"),
    "Stade de Reims": ("ligue-1", "reims"),
    "FC Lorient": ("ligue-1", "lorient"),
    "Le Havre AC": ("ligue-1", "le-havre"),
    "Le Havre": ("ligue-1", "le-havre"),
    "FC Metz": ("ligue-1", "metz"),
    "Clermont Foot 63": ("ligue-1", "clermont"),
    "Clermont Foot": ("ligue-1", "clermont"),
    "AJ Auxerre": ("ligue-1", "auxerre"),
    "EA Guingamp": ("ligue-1", "guingamp"),
    "SM Caen": ("ligue-1", "caen"),
    "SC Bastia": ("ligue-1", "bastia"),
    "AC Ajaccio": ("ligue-1", "ajaccio"),
    "Nîmes Olympique": ("ligue-1", "nimes"),
    "Angers SCO": ("ligue-1", "angers"),
    "Dijon FCO": ("ligue-1", "dijon"),
    "ESTAC Troyes": ("ligue-1", "troyes"),
    "Valenciennes FC": ("ligue-1", "valenciennes"),
    "AS Nancy-Lorraine": ("ligue-1", "nancy"),

    # Bundesliga
    "Bayern Munich": ("bundesliga", "bayern-munich"),
    "Bayern München": ("bundesliga", "bayern-munich"),
    "FC Bayern Munich": ("bundesliga", "bayern-munich"),
    "FC Bayern München": ("bundesliga", "bayern-munich"),
    "Borussia Dortmund": ("bundesliga", "borussia-dortmund"),
    "BVB Dortmund": ("bundesliga", "borussia-dortmund"),
    "RB Leipzig": ("bundesliga", "rb-leipzig"),
    "RasenBallsport Leipzig": ("bundesliga", "rb-leipzig"),
    "Bayer Leverkusen": ("bundesliga", "bayer-leverkusen"),
    "Bayer 04 Leverkusen": ("bundesliga", "bayer-leverkusen"),
    "Bayer 04 Leverkusen Fußball": ("bundesliga", "bayer-leverkusen"),
    "Eintracht Frankfurt": ("bundesliga", "eintracht-frankfurt"),
    "Eintracht Frankfurt Fußball AG": ("bundesliga", "eintracht-frankfurt"),
    "Wolfsburg": ("bundesliga", "wolfsburg"),
    "VfL Wolfsburg": ("bundesliga", "wolfsburg"),
    "Verein für Leibesübungen Wolfsburg": ("bundesliga", "wolfsburg"),
    "Freiburg": ("bundesliga", "freiburg"),
    "SC Freiburg": ("bundesliga", "freiburg"),
    "Sport-Club Freiburg": ("bundesliga", "freiburg"),
    "Stuttgart": ("bundesliga", "stuttgart"),
    "VfB Stuttgart": ("bundesliga", "stuttgart"),
    "Verein für Bewegungsspiele Stuttgart 1893": ("bundesliga", "stuttgart"),
    "Hoffenheim": ("bundesliga", "hoffenheim"),
    "1899 Hoffenheim": ("bundesliga", "hoffenheim"),
    "TSG 1899 Hoffenheim": ("bundesliga", "hoffenheim"),
    "Turn- und Sportgemeinschaft 1899 Hoffenheim Fußball-Spielbetriebs": ("bundesliga", "hoffenheim"),
    "Werder Bremen": ("bundesliga", "werder-bremen"),
    "SV Werder Bremen": ("bundesliga", "werder-bremen"),
    "Sportverein Werder Bremen von 1899": ("bundesliga", "werder-bremen"),
    "Mainz": ("bundesliga", "mainz"),
    "1. FSV Mainz 05": ("bundesliga", "mainz"),
    "1. Fußball- und Sportverein Mainz 05": ("bundesliga", "mainz"),
    "1.FSV Mainz 05": ("bundesliga", "mainz"),
    "Augsburg": ("bundesliga", "augsburg"),
    "FC Augsburg": ("bundesliga", "augsburg"),
    "Fußball-Club Augsburg 1907": ("bundesliga", "augsburg"),
    "Borussia M'gladbach": ("bundesliga", "borussia-mgladbach"),
    "Borussia Mönchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Borussia Monchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Borussia Verein für Leibesübungen 1900 Mönchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Gladbach": ("bundesliga", "borussia-mgladbach"),
    "Monchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Union Berlin": ("bundesliga", "union-berlin"),
    "1. FC Union Berlin": ("bundesliga", "union-berlin"),
    "1. Fußballclub Union Berlin": ("bundesliga", "union-berlin"),
    "Bochum": ("bundesliga", "bochum"),
    "VfL Bochum": ("bundesliga", "bochum"),
    "VfL Bochum 1848": ("bundesliga", "bochum"),
    "Heidenheim": ("bundesliga", "heidenheim"),
    "1. FC Heidenheim": ("bundesliga", "heidenheim"),
    "1. FC Heidenheim 1846": ("bundesliga", "heidenheim"),
    "1. Fußballclub Heidenheim 1846": ("bundesliga", "heidenheim"),
    "Darmstadt": ("bundesliga", "darmstadt"),
    "SV Darmstadt 98": ("bundesliga", "darmstadt"),
    "Köln": ("bundesliga", "koln"),
    "1. FC Köln": ("bundesliga", "koln"),
    "FC Köln": ("bundesliga", "koln"),
    "1. FC Koln": ("bundesliga", "koln"),
    "FC Koln": ("bundesliga", "koln"),
    "1. Fußball-Club Köln": ("bundesliga", "koln"),
    "Fortuna Köln": ("bundesliga", "koln"),
    "SC Fortuna Köln": ("bundesliga", "koln"),
    "Hamburg": ("bundesliga", "hamburg"),
    "Hamburger SV": ("bundesliga", "hamburg"),
    "Hamburger Sport Verein": ("bundesliga", "hamburg"),
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
    "1.FC Nuremberg": ("bundesliga", "nurnberg"),
    "Kaiserslautern": ("bundesliga", "kaiserslautern"),
    "1. FC Kaiserslautern": ("bundesliga", "kaiserslautern"),
    "1.FC Kaiserslautern": ("bundesliga", "kaiserslautern"),
    "Duisburg": ("bundesliga", "duisburg"),
    "MSV Duisburg": ("bundesliga", "duisburg"),
    "Aachen": ("bundesliga", "aachen"),
    "Alemannia Aachen": ("bundesliga", "aachen"),
    "Bielefeld": ("bundesliga", "bielefeld"),
    "Arminia Bielefeld": ("bundesliga", "bielefeld"),
    "Arminia Bielefeld": ("bundesliga", "bielefeld"),
    "Karlsruhe": ("bundesliga", "karlsruhe"),
    "Karlsruher SC": ("bundesliga", "karlsruhe"),
    "Dresden": ("bundesliga", "dresden"),
    "Dynamo Dresden": ("bundesliga", "dresden"),
    "St. Pauli": ("bundesliga", "st-pauli"),
    "FC St. Pauli": ("bundesliga", "st-pauli"),
    "Fußball-Club St. Pauli von 1910": ("bundesliga", "st-pauli"),
    "Paderborn": ("bundesliga", "paderborn"),
    "SC Paderborn 07": ("bundesliga", "paderborn"),
    "SC Paderborn": ("bundesliga", "paderborn"),
    "Greuther Fürth": ("bundesliga", "greuther-furth"),
    "SpVgg Greuther Fürth": ("bundesliga", "greuther-furth"),
    "Fürth": ("bundesliga", "greuther-furth"),
    "Erzgebirge Aue": ("bundesliga", "erzgebirge-aue"),
    "Sandhausen": ("bundesliga", "sandhausen"),
    "SV Sandhausen": ("bundesliga", "sandhausen"),
    "Regensburg": ("bundesliga", "regensburg"),
    "Jahn Regensburg": ("bundesliga", "regensburg"),
    "Ingolstadt": ("bundesliga", "ingolstadt"),
    "FC Ingolstadt 04": ("bundesliga", "ingolstadt"),
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
    "1860 Munich": ("bundesliga", "tsv-1860"),
    "TSV 1860 Munich": ("bundesliga", "tsv-1860"),
    "TSV 1860 München": ("bundesliga", "tsv-1860"),
}

# ============================================================
# DATA STRUCTURES
# ============================================================
# league_data[league_id][club_id][player_name] = {positions: set(), categories: set(), seasons: [...]}
league_data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {
    "positions": set(), "categories": set(), "seasons": []
})))

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_player_name(name):
    """Remove numeric prefixes and extra whitespace from player names."""
    if not name:
        return "Unknown"
    name = name.strip()
    parts = name.split()
    while parts and parts[0].replace(".", "").replace("\xa0", "").strip().isdigit():
        parts.pop(0)
    cleaned = " ".join(parts).strip()
    cleaned = cleaned.lstrip("0123456789 \xa0\t")
    return cleaned if cleaned else name

def extract_positions(pos_str):
    """Extract list of specific positions from a position string like 'ST/CF' or 'CB,RB'."""
    if not pos_str:
        return []
    positions = []
    for p in pos_str.replace(",", "/").split("/"):
        p = clean_position(p.strip())
        if p and p.upper() not in ("SUB", "RES", ""):
            positions.append(p)
    return positions

# ============================================================
# SOURCE 1: FIFA Model Repo (lbenz730/fifa_model) — FIFA 05-20
# ============================================================
print("=" * 60)
print("SOURCE 1: FIFA Model Repo (FIFA 05-20)")
print("=" * 60)

count = 0
mapped = 0
with open(f"{FIFA_MODEL_DIR}/player_stats.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        count += 1
        club_name = row["club"].strip()
        if club_name not in CLUB_NAME_MAP:
            continue
        league_id, club_id = CLUB_NAME_MAP[club_name]
        mapped += 1

        name = clean_player_name(row["name"])
        if not name or name == "Unknown":
            continue
        season_code = row["season"].strip()
        rating = row["rating"].strip()
        pos_str = row.get("preferred_positions", "").strip()

        # Convert season code "05" → "2004-2005"
        year_int = int(season_code)
        if year_int >= 5:
            start_year = 2000 + year_int
            season_str = f"{start_year}-{start_year + 1}"
        else:
            start_year = 2000 + year_int
            season_str = f"{start_year}-{start_year + 1}"

        try:
            rating_int = int(rating)
        except (ValueError, TypeError):
            continue

        specific_positions = extract_positions(pos_str)
        if not specific_positions:
            specific_positions = ["MID"]  # fallback

        categories = set()
        for pos in specific_positions:
            categories.add(pos_to_category(pos))

        player = league_data[league_id][club_id][name]
        player["positions"].update(specific_positions)
        player["categories"].update(categories)
        player["seasons"].append({
            "club": club_id,
            "season": season_str,
            "rating": rating_int,
            "positions": specific_positions,
            "categories": list(categories),
        })

print(f"  Total rows: {count}, Mapped: {mapped}")

# ============================================================
# SOURCE 2: Kaggle BryanB (FIFA 17-23)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 2: Kaggle BryanB (FIFA 17-23)")
print("=" * 60)

count = 0
mapped = 0
for fifa_year in range(17, 24):
    filepath = f"{DATA_DIR}/FIFA{fifa_year}_official_data.csv"
    if not os.path.exists(filepath):
        print(f"  WARNING: {filepath} not found")
        continue

    season_str = f"20{fifa_year - 1}-{fifa_year}"
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            count += 1
            club_name = row.get("Club", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            mapped += 1

            name = clean_player_name(row.get("Name", ""))
            if not name or name == "Unknown":
                continue
            rating = row.get("Overall", "").strip()
            pos_str = row.get("Best Position", row.get("Position", "")).strip()

            try:
                rating_int = int(rating)
            except (ValueError, TypeError):
                continue

            specific_positions = extract_positions(pos_str)
            if not specific_positions:
                specific_positions = ["MID"]

            categories = set()
            for pos in specific_positions:
                categories.add(pos_to_category(pos))

            player = league_data[league_id][club_id][name]
            player["positions"].update(specific_positions)
            player["categories"].update(categories)
            player["seasons"].append({
                "club": club_id,
                "season": season_str,
                "rating": rating_int,
                "positions": specific_positions,
                "categories": list(categories),
            })

    print(f"  FIFA {fifa_year}: processed")
print(f"  Total rows: {count}, Mapped: {mapped}")

# ============================================================
# SOURCE 3: Kaggle Aniss7 (FIFA 25)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 3: Kaggle Aniss7 (FIFA 25)")
print("=" * 60)

count = 0
mapped = 0
filepath = f"{DATA_DIR}/player-data-full-2025-june.csv"
if os.path.exists(filepath):
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            count += 1
            club_name = row.get("club_name", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            mapped += 1

            name = clean_player_name(row.get("name", row.get("short_name", "")))
            if not name or name == "Unknown":
                continue
            rating = row.get("overall_rating", "").strip()
            pos_str = row.get("positions", "").strip()

            try:
                rating_int = int(rating)
            except (ValueError, TypeError):
                continue

            specific_positions = extract_positions(pos_str)
            if not specific_positions:
                specific_positions = ["MID"]

            categories = set()
            for pos in specific_positions:
                categories.add(pos_to_category(pos))

            player = league_data[league_id][club_id][name]
            player["positions"].update(specific_positions)
            player["categories"].update(categories)
            player["seasons"].append({
                "club": club_id,
                "season": "2024-2025",
                "rating": rating_int,
                "positions": specific_positions,
                "categories": list(categories),
            })

print(f"  Total rows: {count}, Mapped: {mapped}")

# ============================================================
# SOURCE 4: Kaggle rovnez (FC 26)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 4: Kaggle rovnez (FC 26)")
print("=" * 60)

count = 0
mapped = 0
filepath = f"{DATA_DIR}/FC26_20250921.csv"
if os.path.exists(filepath):
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            count += 1
            club_name = row.get("club_name", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            mapped += 1

            name = clean_player_name(row.get("short_name", row.get("long_name", "")))
            if not name or name == "Unknown":
                continue
            rating = row.get("overall", "").strip()
            pos_str = row.get("player_positions", "").strip()

            try:
                rating_int = int(rating)
            except (ValueError, TypeError):
                continue

            specific_positions = extract_positions(pos_str)
            if not specific_positions:
                specific_positions = ["MID"]

            categories = set()
            for pos in specific_positions:
                categories.add(pos_to_category(pos))

            player = league_data[league_id][club_id][name]
            player["positions"].update(specific_positions)
            player["categories"].update(categories)
            player["seasons"].append({
                "club": club_id,
                "season": "2025-2026",
                "rating": rating_int,
                "positions": specific_positions,
                "categories": list(categories),
            })

print(f"  Total rows: {count}, Mapped: {mapped}")

# ============================================================
# SOURCE 5: Kaggle Rehan (FIFA 24)
# ============================================================
print("\n" + "=" * 60)
print("SOURCE 5: Kaggle Rehan (FIFA 24)")
print("=" * 60)

count = 0
mapped = 0
filepath = f"{DATA_DIR}/player_stats.csv"
if os.path.exists(filepath):
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            count += 1
            club_name = row.get("club", "").strip()
            if not club_name or club_name not in CLUB_NAME_MAP:
                continue
            league_id, club_id = CLUB_NAME_MAP[club_name]
            mapped += 1

            name = clean_player_name(row.get("player", ""))
            if not name or name == "Unknown":
                continue

            # Compute rating from stats
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

            # No position data — use category based on stats
            specific_positions = ["MID"]  # default
            categories = {"MID"}

            player = league_data[league_id][club_id][name]
            player["positions"].update(specific_positions)
            player["categories"].update(categories)
            player["seasons"].append({
                "club": club_id,
                "season": "2023-2024",
                "rating": rating_int,
                "positions": specific_positions,
                "categories": list(categories),
            })

print(f"  Total rows: {count}, Mapped: {mapped}")

# ============================================================
# OUTPUT: Generate players.json for each league
# ============================================================
print("\n" + "=" * 60)
print("OUTPUT: Generating players.json files")
print("=" * 60)

LEAGUE_ORDER = ["premier-league", "la-liga", "ligue-1", "bundesliga"]

for league_id in LEAGUE_ORDER:
    players_list = []
    for club_id, players in league_data[league_id].items():
        for name, data in players.items():
            # Deduplicate seasons (same club+season → keep highest rating)
            seen = {}
            for s in data["seasons"]:
                key = (s["club"], s["season"])
                if key not in seen or s["rating"] > seen[key]["rating"]:
                    seen[key] = s

            # Collect all positions and categories across all seasons
            all_positions = set()
            all_categories = set()
            for s in seen.values():
                all_positions.update(s["positions"])
                all_categories.update(s["categories"])

            # Primary position: most specific (not a category)
            specific_pos = [p for p in all_positions if p not in ("GK", "DEF", "MID", "ATT")]
            if not specific_pos:
                specific_pos = list(all_positions)
            primary_position = specific_pos[0] if specific_pos else "MID"

            # Primary category
            primary_category = pos_to_category(primary_position)

            seasons_sorted = sorted(seen.values(), key=lambda x: x["season"])

            players_list.append({
                "id": f"{name}__{primary_position}",
                "name": name,
                "position": primary_position,
                "position_category": primary_category,
                "all_positions": sorted(all_positions),
                "all_categories": sorted(all_categories),
                "seasons": seasons_sorted,
            })

    players_list.sort(key=lambda p: p["name"])
    output = {"players": players_list}

    out_path = f"{OUT_DIR}/{league_id}/players.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Also create data.json
    meta = json.load(open(f"{OUT_DIR}/{league_id}/meta.json"))
    clubs = json.load(open(f"{OUT_DIR}/{league_id}/clubs.json"))
    data_out = {"meta": meta, "clubs": clubs, "players": players_list}
    with open(f"{OUT_DIR}/{league_id}/data.json", "w", encoding="utf-8") as f:
        json.dump(data_out, f, ensure_ascii=False, indent=2)

    # Stats
    total_seasons = sum(len(p["seasons"]) for p in players_list)
    ratings = [s["rating"] for p in players_list for s in p["seasons"]]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    in_range = sum(1 for r in ratings if 70 <= r <= 85)
    pct_in_range = in_range / len(ratings) * 100 if ratings else 0

    # Position distribution
    pos_dist = {}
    for p in players_list:
        pos = p["position"]
        pos_dist[pos] = pos_dist.get(pos, 0) + 1

    print(f"\n  {league_id}:")
    print(f"    Players: {len(players_list)}")
    print(f"    Total seasons: {total_seasons}")
    print(f"    Avg rating: {avg_rating:.1f}")
    print(f"    Rating 70-85: {pct_in_range:.1f}%")
    print(f"    Position distribution: {dict(sorted(pos_dist.items(), key=lambda x: -x[1]))}")

print("\n✅ Done!")
