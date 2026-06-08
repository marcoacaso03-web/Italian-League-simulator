#!/usr/bin/env python3
"""Test FBref access from GitHub Actions — Playwright + curl comparison."""

import asyncio
import re
import subprocess
import sys

async def test_playwright():
    from playwright.async_api import async_playwright
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        
        url = "https://fbref.com/en/comps/11/2023-2024/2023-2024-Serie-A-Stats"
        print(f"\n=== Playwright: {url}")
        
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        title = await page.title()
        print(f"Title: {title}")
        
        # Wait a bit for JS
        await asyncio.sleep(5)
        html = await page.content()
        print(f"HTML length: {len(html):,}")
        
        # Check for CF
        lower = html.lower()
        if "just a moment" in lower or "checking" in lower:
            print("⚠️  Cloudflare challenge detected, waiting...")
            await asyncio.sleep(10)
            html = await page.content()
            print(f"After CF wait: {len(html):,}")
        
        # Analyze
        tables = re.findall(r'<table[^>]*id="([^"]+)"', html)
        comment_tables = []
        for m in re.finditer(r'<!--(.*?)-->', html, re.DOTALL):
            inner = re.findall(r'<table[^>]*id="([^"]+)"', m.group(1))
            comment_tables.extend(inner)
        
        all_tables = sorted(set(tables + comment_tables))
        players = len(re.findall(r'data-stat="player"', html))
        squads = len(re.findall(r'data-stat="squad"', html))
        
        print(f"\nTables in DOM: {len(tables)}")
        for t in tables:
            print(f"  {t}")
        print(f"Tables in comments: {len(comment_tables)}")
        for t in comment_tables:
            print(f"  {t}")
        print(f"\nPlayer cells: {players}")
        print(f"Squad cells: {squads}")
        
        await browser.close()
        return all_tables, players

def test_curl():
    url = "https://fbref.com/en/comps/11/2023-2024/2023-2024-Serie-A-Stats"
    print(f"\n=== curl: {url}")
    
    result = subprocess.run([
        "curl", "-s", "-o", "/tmp/fbref_curl.html", "-w", "%{http_code}\n%{size_download}",
        "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        url, "--max-time", "20"
    ], capture_output=True, text=True)
    
    print(result.stdout.strip())
    
    with open("/tmp/fbref_curl.html", "r") as f:
        html = f.read()
    
    tables = re.findall(r'<table[^>]*id="([^"]+)"', html)
    players = len(re.findall(r'data-stat="player"', html))
    print(f"Tables: {tables}")
    print(f"Players: {players}")

if __name__ == "__main__":
    print("=" * 60)
    print("Testing FBref access from GitHub Actions")
    print("=" * 60)
    
    test_curl()
    tables, players = asyncio.run(test_playwright())
    
    if players > 0:
        print("\n✅ FBref accessible with Playwright! Ready to scrape.")
    else:
        print("\n⚠️  No player data found. May need different approach.")
