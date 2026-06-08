import json
from pathlib import Path

data_dir = Path("d:/ita_sim/Italian-League-simulator/data")
players_path = data_dir / "players.json"

with open(players_path, "r", encoding="utf-8") as f:
    players_list = json.load(f)

# Collect all raw ratings
raw_ratings = [s["rating"] for p in players_list for s in p["seasons"]]

if raw_ratings:
    r_min = min(raw_ratings)
    r_max = max(raw_ratings)
    r_range = r_max - r_min if r_max != r_min else 1.0
    
    print(f"Normalizing ratings from raw [{r_min:.2f}, {r_max:.2f}] -> [60, 99]")
    
    for p in players_list:
        for s in p["seasons"]:
            normalized = 60.0 + (s["rating"] - r_min) / r_range * 39.0
            s["rating"] = round(max(60.0, min(99.0, normalized)), 1)
            
    with open(players_path, "w", encoding="utf-8") as f:
        json.dump(players_list, f, ensure_ascii=False, indent=2)
        
    print("players.json updated with normalized ratings!")
else:
    print("No ratings found.")
