#!/usr/bin/env python3
"""
DEBUG: ispeziona la struttura HTML di una pagina FBref Serie A
per capire dove sono le tabelle player stats.

Esegui:
    python debug_fbref.py
    
Salva il page source in debug_page.html e stampa:
- Tutti i table ID trovati (visibili + nei commenti)
- Un sample di righe dalla tabella standard (se trovata)
- I primi 500 char di ogni commento che contiene <table
"""

import re
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup, Comment

try:
    from seleniumbase import Driver
    HAS_SB = True
except ImportError:
    HAS_SB = False

import requests

BASE_URL = "https://fbref.com"
COMP_ID = 11

def main():
    # Test URL: stagione 2023-2024
    url = f"{BASE_URL}/en/comps/11/2023-2024/2023-2024-Serie-A-Stats"
    
    if HAS_SB:
        print(f"🚀 Fetching with SeleniumBase: {url}")
        driver = Driver(uc=True, headless=True)
        driver.get(url)
        
        # Wait for page to load
        time.sleep(5)
        for _ in range(20):
            if "<table" in driver.page_source:
                break
            time.sleep(1)
        
        html_source = driver.page_source
        driver.quit()
    else:
        print(f"🚀 Fetching with requests: {url}")
        resp = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }, timeout=30)
        html_source = resp.text
    
    # Save raw HTML
    out_dir = Path(__file__).parent.parent / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with open(out_dir / "debug_page.html", "w", encoding="utf-8") as f:
        f.write(html_source)
    print(f"✅ Saved page source to data/debug_page.html ({len(html_source)} chars)")
    
    # Parse with BeautifulSoup
    soup = BeautifulSoup(html_source, "html.parser")
    
    # 1. VISIBLE tables
    print("\n" + "="*60)
    print("📋 VISIBLE TABLES (in live DOM)")
    print("="*60)
    for table in soup.find_all("table"):
        tid = table.get("id", "(no id)")
        nrows = len(table.find_all("tr"))
        # Get data-stat columns
        cols = set()
        for cell in table.find_all(["td", "th"]):
            stat = cell.get("data-stat", "")
            if stat:
                cols.add(stat)
        print(f"  ID: {tid}")
        print(f"    Rows: {nrows}, Cols: {sorted(cols)[:20]}")
    
    # 2. TABLES IN HTML COMMENTS
    print("\n" + "="*60)
    print("💬 TABLES IN HTML COMMENTS (hidden tabs)")
    print("="*60)
    comments = soup.find_all(string=lambda text: isinstance(text, Comment))
    print(f"  Found {len(comments)} HTML comments total")
    
    comment_table_count = 0
    for i, comment in enumerate(comments):
        comment_text = str(comment)
        if "<table" not in comment_text:
            continue
        comment_table_count += 1
        
        # Parse tables from this comment
        try:
            comment_soup = BeautifulSoup(comment_text, "html.parser")
            for table in comment_soup.find_all("table"):
                tid = table.get("id", "(no id)")
                nrows = len(table.find_all("tr"))
                cols = set()
                for cell in table.find_all(["td", "th"]):
                    stat = cell.get("data-stat", "")
                    if stat:
                        cols.add(stat)
                print(f"\n  Comment #{i}: Table ID: {tid}")
                print(f"    Rows: {nrows}")
                print(f"    Cols ({len(cols)}): {sorted(cols)[:30]}")
                
                # Show first 3 data rows for stats tables
                if "stats" in tid:
                    tbody = table.find("tbody")
                    if tbody:
                        data_rows = [r for r in tbody.find_all("tr") 
                                    if "over_header" not in " ".join(r.get("class", []))]
                        for j, row in enumerate(data_rows[:3]):
                            data = {}
                            for cell in row.find_all(["td", "th"]):
                                stat = cell.get("data-stat", "")
                                if stat:
                                    data[stat] = cell.get_text(strip=True)
                            print(f"    Row {j}: player={data.get('player','?')}, "
                                  f"squad={data.get('squad','?')}, "
                                  f"team={data.get('team','?')}, "
                                  f"pos={data.get('position','?')}, "
                                  f"games={data.get('games','?')}, "
                                  f"goals={data.get('goals','?')}")
        except Exception as e:
            print(f"  Comment #{i}: ERROR parsing: {e}")
    
    print(f"\n  Total comments with <table>: {comment_table_count}")
    
    # 3. Search raw source for table IDs (regex, bypasses BS4)
    print("\n" + "="*60)
    print("🔍 TABLE IDs IN RAW HTML (regex scan)")
    print("="*60)
    all_ids = set(re.findall(r'<table[^>]*id="([^"]+)"', html_source))
    for tid in sorted(all_ids):
        marker = "✓ STATS" if tid.startswith("stats") else ("✓ RESULTS" if tid.startswith("results") else "")
        print(f"  {tid}  {marker}")
    
    # 4. Check if stats tables exist but BS4 can't find them
    print("\n" + "="*60)
    print("🔎 REGEX: stats_standard rows in raw HTML")
    print("="*60)
    # Look for data-stat="player" near table id containing "stats_standard"
    player_matches = re.findall(
        r'data-stat="player"[^>]*>([^<]+)<', 
        html_source
    )
    print(f"  Found {len(player_matches)} data-stat='player' cells in raw HTML")
    if player_matches:
        print(f"  First 10: {player_matches[:10]}")
    
    # Also check for squad
    squad_matches = re.findall(
        r'data-stat="squad"[^>]*>([^<]+)<',
        html_source
    )
    print(f"  Found {len(squad_matches)} data-stat='squad' cells in raw HTML")
    if squad_matches:
        print(f"  First 10: {squad_matches[:10]}")
    
    # team
    team_matches = re.findall(
        r'data-stat="team"[^>]*>([^<]+)<',
        html_source
    )
    print(f"  Found {len(team_matches)} data-stat='team' cells in raw HTML")
    if team_matches:
        print(f"  First 10: {team_matches[:10]}")
    
    print("\n✅ Debug complete. Check data/debug_page.html for full source.")


if __name__ == "__main__":
    main()
