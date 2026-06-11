#!/usr/bin/env python3
"""
SoFIFA → players.json + clubs.json
Sostituisce il vecchio scraper FBref.

FONTE DATI: Dataset Kaggle "EA Sports FC 24 Complete Player Dataset"
  di stefanoleone992
  → https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset
  → https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-25-complete-player-dataset

STEP 1: Scarica i CSV da Kaggle e mettili in data/sofifa_raw/
  I file si chiamano: players_15.csv, players_16.csv, ..., players_24.csv, players_25.csv

  Opzione A (Kaggle CLI):
    kaggle datasets download -d stefanoleone992/ea-sports-fc-24-complete-player-dataset
    unzip ea-sports-fc-24-complete-player-dataset.zip -d data/sofifa_raw/

  Opzione B: download manuale da Kaggle → estrai in data/sofifa_raw/

STEP 2: Esegui questo script:
    python scripts/scrape_sofifa.py

Output:
    data/players.json  — [{id, name, position, position_category, nationality,
                            seasons: [{club, season, rating}]}]
    data/clubs.json    — [{id, name}]

NOTE:
  - Vengono tenuti SOLO i giocatori con almeno una stagione in Serie A
  - Il rating è l'overall FIFA/EA FC (nessuna formula, valore diretto EA Sports)
  - Stagioni coperte: 2014-2015 → 2024-2025 (FIFA 15 → FC 25)
  - I campi apps/goals/assists sono stati rimossi (non presenti nel dataset Kaggle)
"""

import csv
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

# ─── CONFIG ──────────────────────────────────────────────────────────────────────────────

RAW_DIR = Path(__file__).parent.parent / "data" / "sofifa_raw"
OUT_DIR = Path(__file__).parent.parent / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Mappa numero versione FIFA (dal filename) → stagione reale
FIFA_VERSION_TO_SEASON = {
    "15": "2014-2015",
    "16": "2015-2016",
    "17": "2016-2017",
    "18": "2017-2018",
    "19": "2018-2019",
    "20": "2019-2020",
    "21": "2020-2021",
    "22": "2021-2022",
    "23": "2022-2023",
    "24": "2023-2024",
    "25": "2024-2025",
}

# Nomi lega usati da SoFIFA/Kaggle per la Serie A
SERIE_A_LEAGUE_NAMES = {
    "Serie A",
    "Italy Serie A",
    "IT1",
}

# ─── POSITION MAPPING ────────────────────────────────────────────────────────────────────

POSITION_CATEGORY = {
    "GK":  "GK",
    "CB":  "DEF", "LB":  "DEF", "RB":  "DEF",
    "LWB": "DEF", "RWB": "DEF", "WB":  "DEF",
    "CDM": "MID", "CM":  "MID", "CAM": "MID",
    "LM":  "MID", "RM":  "MID",
    "LW":  "ATT", "RW":  "ATT",
    "ST":  "ATT", "CF":  "ATT",
}


def get_primary_position(positions_str: str) -> tuple[str, str]:
    """
    Prende la stringa posizioni FIFA (es. "ST, LW, CF") e restituisce
    (posizione_primaria, categoria).
    """
    if not positions_str:
        return ("CM", "MID")
    parts = [p.strip().upper() for p in positions_str.split(",")]
    primary = parts[0] if parts else "CM"
    category = POSITION_CATEGORY.get(primary, "MID")
    return (primary, category)


def normalize_club_id(name: str) -> str:
    return name.lower().replace(" ", "-").replace("'", "").replace(".", "")


def safe_int(val, default: int = 0) -> int:
    try:
        return int(str(val).strip())
    except (ValueError, TypeError):
        return default


# ─── MAIN ────────────────────────────────────────────────────────────────────────────────

def main():
    if not RAW_DIR.exists():
        print(f"ERRORE: cartella non trovata: {RAW_DIR}")
        print("Crea la cartella e mettici i CSV Kaggle (players_15.csv, ..., players_25.csv)")
        print("Vedi README.md per le istruzioni di download.")
        sys.exit(1)

    csv_files = sorted(RAW_DIR.glob("players_*.csv"))
    if not csv_files:
        print(f"ERRORE: nessun file players_XX.csv trovato in {RAW_DIR}")
        print("Scarica il dataset da:")
        print("  https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset")
        sys.exit(1)

    print(f"Trovati {len(csv_files)} file CSV: {[f.name for f in csv_files]}")

    all_clubs: dict[str, dict] = {}
    # { sofifa_id → { meta, seasons: [] } }
    players_by_id: dict[str, dict] = {}

    for csv_path in csv_files:
        # Estrai versione dal nome file (players_15.csv → "15")
        version = csv_path.stem.replace("players_", "")
        season = FIFA_VERSION_TO_SEASON.get(version)
        if not season:
            print(f"  SKIP {csv_path.name} — versione '{version}' non mappata")
            continue

        print(f"  {csv_path.name} → stagione {season} ...", end=" ", flush=True)

        rows_total = 0
        rows_serie_a = 0

        with open(csv_path, encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)

            for row in reader:
                rows_total += 1

                # ── Filtra per Serie A ───────────────────────────────────────
                league = (
                    row.get("league_name", "")
                    or row.get("club_league_name", "")
                ).strip()
                if league not in SERIE_A_LEAGUE_NAMES:
                    continue
                rows_serie_a += 1

                # ── Dati giocatore ────────────────────────────────────────
                sofifa_id   = (row.get("sofifa_id", "") or row.get("player_id", "")).strip()
                short_name  = (row.get("short_name", "") or row.get("name", "")).strip()
                long_name   = (row.get("long_name", "") or row.get("full_name", "") or short_name).strip()
                nationality = (row.get("nationality_name", "") or row.get("country_name", "")).strip()
                positions_str = (row.get("player_positions", "") or row.get("positions", "")).strip()
                overall     = safe_int(row.get("overall", row.get("overall_rating", 60)))
                club_name   = row.get("club_name", "").strip()

                if not short_name or not club_name:
                    continue

                position, category = get_primary_position(positions_str)

                # ── Club ───────────────────────────────────────────────────
                club_id = normalize_club_id(club_name)
                if club_id not in all_clubs:
                    all_clubs[club_id] = {"id": club_id, "name": club_name}

                # ── Player key (sofifa_id è stabile tra versioni) ────────────
                pkey = sofifa_id if sofifa_id else f"{short_name}__{position}"

                if pkey not in players_by_id:
                    players_by_id[pkey] = {
                        "name": long_name or short_name,
                        "position": position,
                        "position_category": category,
                        "nationality": nationality,
                        "seasons": [],
                    }

                p = players_by_id[pkey]

                # Aggiorna nazionalità e nome se mancanti
                if not p["nationality"] and nationality:
                    p["nationality"] = nationality

                # Aggiorna posizione all'ultima versione disponibile
                p["position"] = position
                p["position_category"] = category

                # ── Stagione (evita duplicati) ───────────────────────────
                if not any(s["season"] == season for s in p["seasons"]):
                    p["seasons"].append({
                        "club":   club_name,
                        "season": season,
                        "rating": float(overall),
                    })

        print(f"{rows_serie_a} giocatori Serie A (su {rows_total} totali)")

    # ── Costruisci output ───────────────────────────────────────────────────────
    print(f"\nTotale giocatori unici Serie A: {len(players_by_id)}")
    print(f"Totale club: {len(all_clubs)}")

    players_list = []
    pid = 1
    for p in sorted(players_by_id.values(), key=lambda x: x["name"]):
        seasons_sorted = sorted(p["seasons"], key=lambda s: s["season"])
        players_list.append({
            "id":                f"p{pid:05d}",
            "name":              p["name"],
            "position":          p["position"],
            "position_category": p["position_category"],
            "nationality":       p["nationality"],
            "seasons":           seasons_sorted,
        })
        pid += 1

    clubs_list = sorted(all_clubs.values(), key=lambda c: c["name"])

    # ── Salva ───────────────────────────────────────────────────────────────────────────
    players_path = OUT_DIR / "players.json"
    clubs_path   = OUT_DIR / "clubs.json"

    with open(players_path, "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)
    print(f"\n✅ players.json: {len(players_list)} giocatori → {players_path}")

    with open(clubs_path, "w", encoding="utf-8") as f:
        json.dump(clubs_list, f, ensure_ascii=False, indent=2)
    print(f"✅ clubs.json:   {len(clubs_list)} club → {clubs_path}")

    # Riepilogo
    all_seasons_set = {s["season"] for p in players_list for s in p["seasons"]}
    total_records   = sum(len(p["seasons"]) for p in players_list)
    all_ratings     = [s["rating"] for p in players_list for s in p["seasons"]]

    print(f"\nStagioni coperte: {sorted(all_seasons_set)}")
    print(f"Record stagione-giocatore: {total_records}")
    if all_ratings:
        print(f"Rating min/max/media: {min(all_ratings):.0f} / {max(all_ratings):.0f} / {sum(all_ratings)/len(all_ratings):.1f}")


if __name__ == "__main__":
    main()
