#!/usr/bin/env python3
"""
Merge Transfermarkt 2000-2004 data into existing players.json files.
"""

import csv, json, os
from collections import defaultdict

BASE = "/data/data/com.termux/files/home/Italian-League-simulator"
DATA_DIR = f"{BASE}/.migration-backup/sofifa_raw"
OUT_DIR = f"{BASE}/artifacts/italian-league-simulator/public/data/leagues"

# Transfermarkt club name → (league_id, club_id)
TM_MAP = {
    # Premier League
    "Arsenal Football Club": ("premier-league", "arsenal"),
    "Aston Villa Football Club": ("premier-league", "aston-villa"),
    "Association Football Club Bournemouth": ("premier-league", "bournemouth"),
    "Brentford Football Club": ("premier-league", "brentford"),
    "Brighton and Hove Albion Football Club": ("premier-league", "brighton"),
    "Burnley Football Club": ("premier-league", "burnley"),
    "Chelsea Football Club": ("premier-league", "chelsea"),
    "Crystal Palace Football Club": ("premier-league", "crystal-palace"),
    "Everton Football Club": ("premier-league", "everton"),
    "Fulham Football Club": ("premier-league", "fulham"),
    "Huddersfield Town": ("premier-league", "huddersfield-town"),
    "Hull City": ("premier-league", "hull-city"),
    "Ipswich Town": ("premier-league", "ipswich"),
    "Leeds United Association Football Club": ("premier-league", "leeds-united"),
    "Leicester City": ("premier-league", "leicester"),
    "Liverpool Football Club": ("premier-league", "liverpool"),
    "Luton Town": ("premier-league", "luton-town"),
    "Manchester City Football Club": ("premier-league", "manchester-city"),
    "Manchester United Football Club": ("premier-league", "manchester-united"),
    "Middlesbrough FC": ("premier-league", "middlesbrough"),
    "Newcastle United Football Club": ("premier-league", "newcastle"),
    "Norwich City": ("premier-league", "norwich-city"),
    "Nottingham Forest Football Club": ("premier-league", "nottingham-forest"),
    "Queens Park Rangers": ("premier-league", "queens-park-rangers"),
    "Reading FC": ("premier-league", "reading"),
    "Sheffield United": ("premier-league", "sheffield-united"),
    "Southampton FC": ("premier-league", "southampton"),
    "Stoke City": ("premier-league", "stoke-city"),
    "Sunderland Association Football Club": ("premier-league", "sunderland"),
    "Swansea City": ("premier-league", "swansea-city"),
    "Tottenham Hotspur Football Club": ("premier-league", "tottenham"),
    "Watford FC": ("premier-league", "watford"),
    "West Bromwich Albion": ("premier-league", "west-brom"),
    "West Ham United Football Club": ("premier-league", "west-ham"),
    "Wigan Athletic": ("premier-league", "wigan-athletic"),
    "Wolverhampton Wanderers Football Club": ("premier-league", "wolverhampton"),
    # PL variants from valuations
    "Chelsea FC": ("premier-league", "chelsea"),
    "Manchester United": ("premier-league", "manchester-united"),
    "Newcastle United": ("premier-league", "newcastle"),
    "Tottenham Hotspur": ("premier-league", "tottenham"),
    "Crystal Palace": ("premier-league", "crystal-palace"),
    "Wolverhampton Wanderers": ("premier-league", "wolverhampton"),
    "Aston Villa": ("premier-league", "aston-villa"),
    "Everton FC": ("premier-league", "everton"),
    "Liverpool FC": ("premier-league", "liverpool"),
    "Arsenal FC": ("premier-league", "arsenal"),
    "Southampton FC": ("premier-league", "southampton"),
    "Stoke City": ("premier-league", "stoke-city"),
    "Norwich City": ("premier-league", "norwich-city"),
    "Swansea City": ("premier-league", "swansea-city"),
    "West Bromwich Albion": ("premier-league", "west-brom"),
    "Hull City": ("premier-league", "hull-city"),
    "Burnley FC": ("premier-league", "burnley"),
    "Brighton & Hove Albion": ("premier-league", "brighton"),
    "Fulham FC": ("premier-league", "fulham"),
    "Brentford FC": ("premier-league", "brentford"),
    "Leeds United": ("premier-league", "leeds-united"),
    "Middlesbrough FC": ("premier-league", "middlesbrough"),
    "Sunderland AFC": ("premier-league", "sunderland"),
    "Wigan Athletic": ("premier-league", "wigan-athletic"),
    "Reading FC": ("premier-league", "reading"),
    "QPR": ("premier-league", "queens-park-rangers"),
    "Cardiff City": ("premier-league", "cardiff-city"),
    "Bournemouth": ("premier-league", "bournemouth"),
    "Watford FC": ("premier-league", "watford"),
    "Nottingham Forest": ("premier-league", "nottingham-forest"),
    "Luton Town": ("premier-league", "luton-town"),
    "Ipswich Town": ("premier-league", "ipswich"),
    "Sheffield United": ("premier-league", "sheffield-united"),

    # La Liga
    "Athletic Club Bilbao": ("la-liga", "athletic-bilbao"),
    "CD Leganés": ("la-liga", "leganes"),
    "Club Atlético Osasuna": ("la-liga", "osasuna"),
    "Club Atlético de Madrid S.A.D.": ("la-liga", "atletico-madrid"),
    "Cádiz CF": ("la-liga", "cadiz"),
    "Córdoba CF": ("la-liga", "cordoba"),
    "Deportivo Alavés S. A. D.": ("la-liga", "alaves"),
    "Deportivo de La Coruña": ("la-liga", "deportivo-la-coruna"),
    "Elche Club de Fútbol S.A.D.": ("la-liga", "elche"),
    "Futbol Club Barcelona": ("la-liga", "barcelona"),
    "Getafe Club de Fútbol S. A. D. Team Dubai": ("la-liga", "getafe"),
    "Girona Fútbol Club S. A. D.": ("la-liga", "girona"),
    "Granada CF": ("la-liga", "granada"),
    "Levante Unión Deportiva S.A.D.": ("la-liga", "levante"),
    "Málaga CF": ("la-liga", "malaga"),
    "Rayo Vallecano de Madrid S. A. D.": ("la-liga", "rayo-vallecano"),
    "Real Betis Balompié S.A.D.": ("la-liga", "real-betis"),
    "Real Club Celta de Vigo S. A. D.": ("la-liga", "celta-vigo"),
    "Real Club Deportivo Mallorca S.A.D.": ("la-liga", "mallorca"),
    "Real Madrid Club de Fútbol": ("la-liga", "real-madrid"),
    "Real Oviedo S.A.D.": ("la-liga", "oviedo"),
    "Real Sociedad de Fútbol S.A.D.": ("la-liga", "real-sociedad"),
    "Real Valladolid CF": ("la-liga", "valladolid"),
    "Real Zaragoza": ("la-liga", "zaragoza"),
    "Reial Club Deportiu Espanyol de Barcelona S.A.D.": ("la-liga", "espanyol"),
    "SD Eibar": ("la-liga", "eibar"),
    "SD Huesca": ("la-liga", "huesca"),
    "Sevilla Fútbol Club S.A.D.": ("la-liga", "sevilla"),
    "Sporting Gijón": ("la-liga", "sporting-gijon"),
    "UD Almería": ("la-liga", "almeria"),
    "UD Las Palmas": ("la-liga", "las-palmas"),
    "Valencia Club de Fútbol S. A. D.": ("la-liga", "valencia"),
    "Villarreal Club de Fútbol S.A.D.": ("la-liga", "villarreal"),
    # La Liga variants
    "FC Barcelona": ("la-liga", "barcelona"),
    "Real Madrid": ("la-liga", "real-madrid"),
    "Valencia CF": ("la-liga", "valencia"),
    "Sevilla FC": ("la-liga", "sevilla"),
    "Atletico Madrid": ("la-liga", "atletico-madrid"),
    "Athletic Bilbao": ("la-liga", "athletic-bilbao"),
    "Real Sociedad": ("la-liga", "real-sociedad"),
    "Real Betis": ("la-liga", "real-betis"),
    "Villarreal CF": ("la-liga", "villarreal"),
    "Celta de Vigo": ("la-liga", "celta-vigo"),
    "Celta Vigo": ("la-liga", "celta-vigo"),
    "Deportivo La Coruna": ("la-liga", "deportivo-la-coruna"),
    "Malaga CF": ("la-liga", "malaga"),
    "Osasuna": ("la-liga", "osasuna"),
    "Getafe CF": ("la-liga", "getafe"),
    "Rayo Vallecano": ("la-liga", "rayo-vallecano"),
    "RCD Mallorca": ("la-liga", "mallorca"),
    "Mallorca": ("la-liga", "mallorca"),
    "UD Las Palmas": ("la-liga", "las-palmas"),
    "Las Palmas": ("la-liga", "las-palmas"),
    "Deportivo Alavés": ("la-liga", "alaves"),
    "Alavés": ("la-liga", "alaves"),
    "CD Leganés": ("la-liga", "leganes"),
    "Leganés": ("la-liga", "leganes"),
    "Girona FC": ("la-liga", "girona"),
    "Girona": ("la-liga", "girona"),
    "Granada CF": ("la-liga", "granada"),
    "Granada": ("la-liga", "granada"),
    "Cádiz CF": ("la-liga", "cadiz"),
    "Cádiz": ("la-liga", "cadiz"),
    "UD Almería": ("la-liga", "almeria"),
    "Almería": ("la-liga", "almeria"),
    "RCD Espanyol": ("la-liga", "espanyol"),
    "Espanyol": ("la-liga", "espanyol"),
    "Real Zaragoza": ("la-liga", "zaragoza"),
    "Zaragoza": ("la-liga", "zaragoza"),
    "Real Valladolid": ("la-liga", "valladolid"),
    "Valladolid": ("la-liga", "valladolid"),
    "Levante UD": ("la-liga", "levante"),
    "Levante": ("la-liga", "levante"),
    "Elche CF": ("la-liga", "elche"),
    "Elche": ("la-liga", "elche"),
    "SD Eibar": ("la-liga", "eibar"),
    "Eibar": ("la-liga", "eibar"),
    "SD Huesca": ("la-liga", "huesca"),
    "Huesca": ("la-liga", "huesca"),
    "Sporting Gijón": ("la-liga", "sporting-gijon"),
    "Córdoba CF": ("la-liga", "cordoba"),
    "Córdoba": ("la-liga", "cordoba"),
    "Real Oviedo": ("la-liga", "oviedo"),
    "Albacete": ("la-liga", "albacete"),

    # Ligue 1
    "AC Ajaccio": ("ligue-1", "ajaccio"),
    "AS Nancy-Lorraine": ("ligue-1", "nancy"),
    "AS Saint-Étienne": ("ligue-1", "saint-etienne"),
    "Amiens SC": ("ligue-1", "amiens"),
    "Angers Sporting Club de l'Ouest": ("ligue-1", "angers"),
    "Association de la Jeunesse auxerroise": ("ligue-1", "auxerre"),
    "Association sportive de Monaco Football Club": ("ligue-1", "monaco"),
    "Clermont Foot 63": ("ligue-1", "clermont"),
    "Dijon FCO": ("ligue-1", "dijon"),
    "EA Guingamp": ("ligue-1", "guingamp"),
    "ESTAC Troyes": ("ligue-1", "troyes"),
    "FC Girondins Bordeaux": ("ligue-1", "bordeaux"),
    "FC Sochaux-Montbéliard": ("ligue-1", "sochaux"),
    "Football Club Lorient-Bretagne Sud": ("ligue-1", "lorient"),
    "Football Club de Metz": ("ligue-1", "metz"),
    "Football Club de Nantes": ("ligue-1", "nantes"),
    "GFC Ajaccio": ("ligue-1", "ajaccio"),
    "Le Havre Athletic Club": ("ligue-1", "le-havre"),
    "Lille Olympique Sporting Club": ("ligue-1", "lille"),
    "Montpellier HSC": ("ligue-1", "montpellier"),
    "Nîmes Olympique": ("ligue-1", "nimes"),
    "Olympique Gymnaste Club Nice Côte d'Azur": ("ligue-1", "nice"),
    "Olympique Lyonnais": ("ligue-1", "lyon"),
    "Olympique de Marseille": ("ligue-1", "marseille"),
    "Paris Football Club": ("ligue-1", "paris-fc"),
    "Paris Saint-Germain Football Club": ("ligue-1", "psg"),
    "Racing Club de Lens": ("ligue-1", "lens"),
    "Racing Club de Strasbourg Alsace": ("ligue-1", "strasbourg"),
    "SC Bastia": ("ligue-1", "bastia"),
    "SM Caen": ("ligue-1", "caen"),
    "Stade Reims": ("ligue-1", "reims"),
    "Stade Rennais Football Club": ("ligue-1", "rennes"),
    "Stade brestois 29": ("ligue-1", "brest"),
    "Thonon Évian Grand Genève FC": ("ligue-1", "evian"),
    "Toulouse Football Club": ("ligue-1", "toulouse"),
    "Valenciennes FC": ("ligue-1", "valenciennes"),
    # Ligue 1 variants
    "Paris Saint-Germain": ("ligue-1", "psg"),
    "Olympique Lyon": ("ligue-1", "lyon"),
    "AS Monaco": ("ligue-1", "monaco"),
    "LOSC Lille": ("ligue-1", "lille"),
    "Lille OSC": ("ligue-1", "lille"),
    "FC Nantes": ("ligue-1", "nantes"),
    "Stade Rennais FC": ("ligue-1", "rennes"),
    "Stade Rennais": ("ligue-1", "rennes"),
    "OGC Nice": ("ligue-1", "nice"),
    "FC Girondins Bordeaux": ("ligue-1", "bordeaux"),
    "AS Saint-Étienne": ("ligue-1", "saint-etienne"),
    "RC Lens": ("ligue-1", "lens"),
    "RC Strasbourg": ("ligue-1", "strasbourg"),
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
    "Nîmes Olympique": ("ligue-1", "nimes"),
    "Angers SCO": ("ligue-1", "angers"),
    "Dijon FCO": ("ligue-1", "dijon"),
    "ESTAC Troyes": ("ligue-1", "troyes"),
    "Valenciennes FC": ("ligue-1", "valenciennes"),
    "AS Nancy-Lorraine": ("ligue-1", "nancy"),
    "Paris FC": ("ligue-1", "paris-fc"),

    # Bundesliga
    "1. Fußball- und Sportverein Mainz 05": ("bundesliga", "mainz"),
    "1. Fußball-Club Köln": ("bundesliga", "koln"),
    "1. Fußballclub Heidenheim 1846": ("bundesliga", "heidenheim"),
    "1. Fußballclub Union Berlin": ("bundesliga", "union-berlin"),
    "1.FC Nuremberg": ("bundesliga", "nurnberg"),
    "Arminia Bielefeld": ("bundesliga", "bielefeld"),
    "Bayer 04 Leverkusen Fußball": ("bundesliga", "bayer-leverkusen"),
    "Borussia Dortmund": ("bundesliga", "borussia-dortmund"),
    "Borussia Verein für Leibesübungen 1900 Mönchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Eintracht Braunschweig": ("bundesliga", "braunschweig"),
    "Eintracht Frankfurt Fußball AG": ("bundesliga", "eintracht-frankfurt"),
    "FC Bayern München": ("bundesliga", "bayern-munich"),
    "FC Ingolstadt 04": ("bundesliga", "ingolstadt"),
    "FC Schalke 04": ("bundesliga", "schalke"),
    "Fortuna Düsseldorf": ("bundesliga", "dusseldorf"),
    "Fußball-Club Augsburg 1907": ("bundesliga", "augsburg"),
    "Fußball-Club St. Pauli von 1910": ("bundesliga", "st-pauli"),
    "Hamburger Sport Verein": ("bundesliga", "hamburg"),
    "Hannover 96": ("bundesliga", "hannover"),
    "Hertha BSC": ("bundesliga", "hertha"),
    "Holstein Kiel": ("bundesliga", "kiel"),
    "RasenBallsport Leipzig": ("bundesliga", "rb-leipzig"),
    "SC Paderborn 07": ("bundesliga", "paderborn"),
    "SV Darmstadt 98": ("bundesliga", "darmstadt"),
    "SpVgg Greuther Fürth": ("bundesliga", "greuther-furth"),
    "Sport-Club Freiburg": ("bundesliga", "freiburg"),
    "Sportverein Werder Bremen von 1899": ("bundesliga", "werder-bremen"),
    "Turn- und Sportgemeinschaft 1899 Hoffenheim Fußball-Spielbetriebs": ("bundesliga", "hoffenheim"),
    "Verein für Bewegungsspiele Stuttgart 1893": ("bundesliga", "stuttgart"),
    "Verein für Leibesübungen Wolfsburg": ("bundesliga", "wolfsburg"),
    "VfL Bochum": ("bundesliga", "bochum"),
    # Bundesliga variants
    "FC Bayern München": ("bundesliga", "bayern-munich"),
    "Bayern Munich": ("bundesliga", "bayern-munich"),
    "Borussia Dortmund": ("bundesliga", "borussia-dortmund"),
    "Borussia Mönchengladbach": ("bundesliga", "borussia-mgladbach"),
    "Bayer 04 Leverkusen": ("bundesliga", "bayer-leverkusen"),
    "Bayer Leverkusen": ("bundesliga", "bayer-leverkusen"),
    "Eintracht Frankfurt": ("bundesliga", "eintracht-frankfurt"),
    "VfL Wolfsburg": ("bundesliga", "wolfsburg"),
    "VfB Stuttgart": ("bundesliga", "stuttgart"),
    "Hertha BSC": ("bundesliga", "hertha"),
    "Hamburger SV": ("bundesliga", "hamburg"),
    "Hamburg": ("bundesliga", "hamburg"),
    "FC Schalke 04": ("bundesliga", "schalke"),
    "1. FC Köln": ("bundesliga", "koln"),
    "1. FC Nürnberg": ("bundesliga", "nurnberg"),
    "1. FC Kaiserslautern": ("bundesliga", "kaiserslautern"),
    "1. FSV Mainz 05": ("bundesliga", "mainz"),
    "1. FC Union Berlin": ("bundesliga", "union-berlin"),
    "1. FC Heidenheim": ("bundesliga", "heidenheim"),
    "SC Freiburg": ("bundesliga", "freiburg"),
    "SC Paderborn 07": ("bundesliga", "paderborn"),
    "SC Paderborn": ("bundesliga", "paderborn"),
    "VfL Bochum": ("bundesliga", "bochum"),
    "SV Darmstadt 98": ("bundesliga", "darmstadt"),
    "TSG 1899 Hoffenheim": ("bundesliga", "hoffenheim"),
    "TSG Hoffenheim": ("bundesliga", "hoffenheim"),
    "SV Werder Bremen": ("bundesliga", "werder-bremen"),
    "Werder Bremen": ("bundesliga", "werder-bremen"),
    "RB Leipzig": ("bundesliga", "rb-leipzig"),
    "RasenBallsport Leipzig": ("bundesliga", "rb-leipzig"),
    "FC Augsburg": ("bundesliga", "augsburg"),
    "FC Ingolstadt 04": ("bundesliga", "ingolstadt"),
    "FC Ingolstadt": ("bundesliga", "ingolstadt"),
    "MSV Duisburg": ("bundesliga", "duisburg"),
    "Arminia Bielefeld": ("bundesliga", "bielefeld"),
    "Hannover 96": ("bundesliga", "hannover"),
    "Eintracht Braunschweig": ("bundesliga", "braunschweig"),
    "SpVgg Greuther Fürth": ("bundesliga", "greuther-furth"),
    "Greuther Fürth": ("bundesliga", "greuther-furth"),
    "Holstein Kiel": ("bundesliga", "kiel"),
    "Fortuna Düsseldorf": ("bundesliga", "dusseldorf"),
    "1. FC Heidenheim 1846": ("bundesliga", "heidenheim"),
    "1.FC Kaiserslautern": ("bundesliga", "kaiserslautern"),
    "1.FC Köln": ("bundesliga", "koln"),
    "1.FSV Mainz 05": ("bundesliga", "mainz"),
    # Serie A variants (from valuations)
    "Parma FC": ("serie-a", "parma"),
    "Udinese Calcio": ("serie-a", "udinese"),
    "US Palermo": ("serie-a", "palermo"),
    "AS Roma": ("serie-a", "roma"),
    "FC Internazionale": ("serie-a", "inter"),
    "Chievo Verona": ("serie-a", "chievo"),
    "Brescia Calcio": ("serie-a", "brescia"),
    "AC Milan": ("serie-a", "milan"),
    "Juventus FC": ("serie-a", "juventus"),
    "SS Lazio": ("serie-a", "lazio"),
    "ACF Fiorentina": ("serie-a", "fiorentina"),
    "Atalanta BC": ("serie-a", "atalanta"),
    "Bologna FC 1909": ("serie-a", "bologna"),
    "Bologna FC": ("serie-a", "bologna"),
    "Genoa CFC": ("serie-a", "genoa"),
    "Genoa Cricket and Football Club": ("serie-a", "genoa"),
    "UC Sampdoria": ("serie-a", "sampdoria"),
    "Torino Calcio": ("serie-a", "torino"),
    "US Lecce": ("serie-a", "lecce"),
    "US Salernitana": ("serie-a", "salernitana"),
    "Cagliari Calcio": ("serie-a", "cagliari"),
    "FC Empoli": ("serie-a", "empoli"),
    "AC Siena": ("serie-a", "siena"),
    "AC Perugia": ("serie-a", "perugia"),
    "AC Cesena": ("serie-a", "cesena"),
    "FC Crotone": ("serie-a", "crotone"),
    "AS Livorno": ("serie-a", "livorno"),
    "Calcio Catania": ("serie-a", "catania"),
    "Hellas Verona": ("serie-a", "verona"),
    "Reggina Calcio": ("serie-a", "reggina"),
    "Modena FC": ("serie-a", "modena"),
    "Treviso FBC 1993": ("serie-a", "treviso"),
    "Piacenza FC": ("serie-a", "piacenza"),
    "Ascoli Calcio 1898": ("serie-a", "ascoli"),
    "Ternana Calcio": ("serie-a", "ternana"),
    "FC Messina Peloro": ("serie-a", "messina"),
    "Napoli Soccer": ("serie-a", "napoli"),
    "Pisa Sporting Club": ("serie-a", "pisa"),
    "SPAL": ("serie-a", "spal"),
    "Spezia Calcio": ("serie-a", "spezia"),
    "Unione Sportiva Sassuolo Calcio": ("serie-a", "sassuolo"),
    "Unione Sportiva Cremonese S.A.D.": ("serie-a", "cremonese"),
    "AC Monza": ("serie-a", "monza"),
    "Frosinone Calcio": ("serie-a", "frosinone"),
    "Benevento Calcio": ("serie-a", "benevento"),
    "Carpi": ("serie-a", "carpi"),
    "AC Carpi": ("serie-a", "carpi"),
    # Additional PL variants
    "Charlton Athletic": ("premier-league", "charlton-athletic"),
    "Tottenham Hotspur": ("premier-league", "tottenham"),
    "Aston Villa": ("premier-league", "aston-villa"),
    "Liverpool FC": ("premier-league", "liverpool"),
    "Arsenal FC": ("premier-league", "arsenal"),
    "Chelsea FC": ("premier-league", "chelsea"),
    "Manchester United": ("premier-league", "manchester-united"),
    "Newcastle United": ("premier-league", "newcastle"),
    "Everton FC": ("premier-league", "everton"),
    "Fulham FC": ("premier-league", "fulham"),
    "Brentford FC": ("premier-league", "brentford"),
    "Leeds United": ("premier-league", "leeds-united"),
    "Middlesbrough FC": ("premier-league", "middlesbrough"),
    "Sunderland AFC": ("premier-league", "sunderland"),
    "Derby County": ("premier-league", "derby-county"),
    "Bolton Wanderers": ("premier-league", "bolton-wanderers"),
    "Portsmouth FC": ("premier-league", "portsmouth"),
    "Stoke City": ("premier-league", "stoke-city"),
    "Swansea City": ("premier-league", "swansea-city"),
    "Burnley FC": ("premier-league", "burnley"),
    "Wolverhampton Wanderers": ("premier-league", "wolverhampton"),
    "Crystal Palace": ("premier-league", "crystal-palace"),
    "West Ham United": ("premier-league", "west-ham"),
    "Norwich City": ("premier-league", "norwich-city"),
    "Leicester City": ("premier-league", "leicester"),
    # Additional La Liga
    "RCD Espanyol Barcelona": ("la-liga", "espanyol"),
    "RCD Mallorca": ("la-liga", "mallorca"),
    "Racing Santander": ("la-liga", "racing-santander"),
    "Athletic Bilbao": ("la-liga", "athletic-bilbao"),
    "Real Betis Balompié": ("la-liga", "real-betis"),
    "Atlético de Madrid": ("la-liga", "atletico-madrid"),
    "RCD Espanyol de Barcelona": ("la-liga", "espanyol"),
    # Additional Ligue 1
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
    "Nîmes Olympique": ("ligue-1", "nimes"),
    "Angers SCO": ("ligue-1", "angers"),
    "Dijon FCO": ("ligue-1", "dijon"),
    "ESTAC Troyes": ("ligue-1", "troyes"),
    "Valenciennes FC": ("ligue-1", "valenciennes"),
    "AS Nancy-Lorraine": ("ligue-1", "nancy"),
    "Paris FC": ("ligue-1", "paris-fc"),
    "Paris Saint-Germain": ("ligue-1", "psg"),
    "Stade brestois 29": ("ligue-1", "brest"),
}

def market_value_to_rating(mv):
    if mv <= 0:
        return 45
    c = 1_280_000
    r = 55 + (38 * mv) / (mv + c)
    return max(50, min(95, round(r)))

# Load player names
player_names = {}
with open(f"{DATA_DIR}/players.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        player_names[row['player_id']] = row['name']

# Load valuations for 2000-2004
player_data = defaultdict(lambda: defaultdict(dict))
with open(f"{DATA_DIR}/player_valuations.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        date = row['date']
        if not date:
            continue
        year = int(date[:4])
        if year < 2000 or year > 2004:
            continue
        comp = row['player_club_domestic_competition_id']
        if comp not in ('GB1', 'ES1', 'FR1', 'L1', 'IT1'):
            continue
        val = row['market_value_in_eur']
        if not val or int(val) <= 0:
            continue
        pid = row['player_id']
        club = row['current_club_name']
        season = f"{year}-{year+1}"
        if season not in player_data[pid] or int(val) > int(player_data[pid][season].get('value', 0)):
            player_data[pid][season] = {'value': val, 'club': club, 'competition': comp}

# Convert to league data
league_data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"seasons": []})))
mapped_count = 0
unmapped = defaultdict(int)

for pid, seasons in player_data.items():
    name = player_names.get(pid, f"Unknown_{pid}")
    for season, data in seasons.items():
        club_name = data['club']
        value = int(data['value'])
        if club_name in TM_MAP:
            league_id, club_id = TM_MAP[club_name]
            mapped_count += 1
        else:
            unmapped[club_name] += 1
            continue
        rating = market_value_to_rating(value)
        player = league_data[league_id][club_id][name]
        player["seasons"].append({
            "club": club_id, "season": season, "rating": rating,
            "positions": ["MID"], "categories": ["MID"],
        })

print(f"Mapped: {mapped_count}, Unmapped clubs: {len(unmapped)}")
for c, cnt in sorted(unmapped.items(), key=lambda x: -x[1])[:10]:
    print(f"  {cnt}x {c}")

# Merge with existing players.json
for league_id in ["premier-league", "la-liga", "ligue-1", "bundesliga"]:
    path = f"{OUT_DIR}/{league_id}/players.json"
    with open(path) as f:
        existing = json.load(f)
    existing_players = {p['name']: p for p in existing['players']}
    
    for club_id, players in league_data[league_id].items():
        for name, data in players.items():
            if name in existing_players:
                existing_seasons = {(s['club'], s['season']) for s in existing_players[name]['seasons']}
                for s in data['seasons']:
                    if (s['club'], s['season']) not in existing_seasons:
                        existing_players[name]['seasons'].append(s)
            else:
                existing_players[name] = {
                    "id": f"{name}__MID", "name": name,
                    "position": "MID", "position_category": "MID",
                    "seasons": data['seasons'],
                }
    
    for name, player in existing_players.items():
        player['seasons'] = sorted(player['seasons'], key=lambda s: s['season'])
    
    players_list = sorted(existing_players.values(), key=lambda p: p['name'])
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"players": players_list}, f, ensure_ascii=False, indent=2)
    
    tm = sum(1 for p in players_list for s in p['seasons'] if s['season'] < '2005')
    print(f"{league_id}: {len(players_list)} players, {tm} TM seasons")

print("\n✅ Done!")
