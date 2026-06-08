#!/usr/bin/env python3
"""
Test Browserless connection and fetch one FBref page.
Run this FIRST to verify Browserless works before the full scrape.

Usage:
    # Local Docker
    python test_browserless.py

    # Cloud (with token)
    python test_browserless.py --token YOUR_TOKEN

    # Custom URL
    python test_browserless.py --url http://192.168.1.100:3000
"""

import argparse
import json
import sys
import time
import requests

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:3000", help="Browserless URL")
    parser.add_argument("--token", default=None, help="Browserless cloud token")
    args = parser.parse_args()

    base = args.url.rstrip("/")
    test_url = "https://fbref.com/en/comps/11/2023-2024/2023-2024-Serie-A-Stats"

    print(f"🔍 Testing Browserless at {base}")
    print(f"   Target: {test_url}")
    print()

    # 1. Check health
    print("1️⃣  Health check...")
    try:
        params = {}
        if args.token:
            params["token"] = args.token
        resp = requests.get(f"{base}/version", params=params, timeout=10)
        print(f"   /version: {resp.status_code} — {resp.text[:200]}")
    except Exception as e:
        print(f"   ❌ Cannot reach Browserless: {e}")
        print(f"   Make sure Docker is running:")
        print(f"   docker run -p 3000:3000 browserless/chrome")
        sys.exit(1)

    # 2. Fetch FBref page
    print("\n2️⃣  Fetching FBref page via /content...")
    params = {}
    if args.token:
        params["token"] = args.token

    try:
        resp = requests.post(
            f"{base}/content",
            json={"url": test_url, "options": {"waitUntil": "networkidle0"}},
            params=params,
            timeout=60,
        )
        print(f"   Status: {resp.status_code}")
        print(f"   Content-Type: {resp.headers.get('content-type', '?')}")
        print(f"   Body length: {len(resp.text)}")
    except Exception as e:
        print(f"   ❌ Fetch failed: {e}")
        sys.exit(1)

    if resp.status_code != 200:
        print(f"   ❌ Unexpected status: {resp.status_code}")
        print(f"   Body: {resp.text[:500]}")
        sys.exit(1)

    # 3. Analyze HTML
    html = resp.text
    import re
    table_ids = re.findall(r'<table[^>]*id="([^"]+)"', html)
    player_cells = re.findall(r'data-stat="player"[^>]*>([^<]+)<', html)
    squad_cells = re.findall(r'data-stat="squad"[^>]*>([^<]+)<', html)
    comment_count = len(re.findall(r'<!--', html))

    # Tables in comments
    comment_table_ids = []
    for m in re.finditer(r'<!--(.*?)-->', html, re.DOTALL):
        inner_ids = re.findall(r'<table[^>]*id="([^"]+)"', m.group(1))
        comment_table_ids.extend(inner_ids)

    all_ids = sorted(set(table_ids + comment_table_ids))

    print(f"\n3️⃣  Analysis:")
    print(f"   HTML length: {len(html):,}")
    print(f"   Comments: {comment_count}")
    print(f"   Table IDs in DOM: {len(table_ids)}")
    print(f"   Table IDs in comments: {len(comment_table_ids)}")
    print(f"   All table IDs: {len(all_ids)}")
    print()
    
    for tid in all_ids:
        marker = "⭐ STATS" if tid.startswith("stats") else ("📊 RESULTS" if tid.startswith("results") else "")
        print(f"   {tid}  {marker}")

    print(f"\n   Player cells: {len(player_cells)} — first 10: {player_cells[:10]}")
    print(f"   Squad cells: {len(squad_cells)} — first 10: {squad_cells[:10]}")

    # 4. Verdict
    stats_tables = [t for t in all_ids if t.startswith("stats_")]
    if stats_tables:
        print(f"\n✅ SUCCESS! Found {len(stats_tables)} stats tables. Browserless works!")
        print(f"   Run the full scraper:")
        print(f"   python scrape_serie_a_v5.py --browserless")
    else:
        print(f"\n⚠️  No stats tables found. The page might not have fully loaded.")
        print(f"   Try saving HTML for inspection:")
        with open("data/debug_test.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"   Saved to data/debug_test.html")


if __name__ == "__main__":
    main()
