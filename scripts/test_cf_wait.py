#!/usr/bin/env python3
"""Test: wait for Cloudflare to resolve in Playwright."""

import asyncio
import re
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox'],
        )
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )
        page = await ctx.new_page()
        
        url = "https://fbref.com/en/comps/11/2023-2024/2023-2024-Serie-A-Stats"
        print(f"Navigating to {url}")
        
        await page.goto(url, wait_until="commit", timeout=30000)
        
        # Wait for title to change from "Just a moment..."
        print("Waiting for page to load...")
        for i in range(30):
            title = await page.title()
            html_len = await page.evaluate("document.body.innerHTML.length")
            has_table = await page.evaluate("document.querySelectorAll('table').length")
            print(f"  [{i}s] title='{title}', html={html_len}, tables={has_table}")
            
            if "just a moment" not in title.lower() and "checking" not in title.lower():
                print(f"✅ Page loaded! Title: {title}")
                break
            
            await asyncio.sleep(2)
        
        html = await page.content()
        tables = re.findall(r'<table[^>]*id="([^"]+)"', html)
        comment_tables = []
        for m in re.finditer(r'<!--(.*?)-->', html, re.DOTALL):
            inner = re.findall(r'<table[^>]*id="([^"]+)"', m.group(1))
            comment_tables.extend(inner)
        
        all_tables = sorted(set(tables + comment_tables))
        players = len(re.findall(r'data-stat="player"', html))
        
        print(f"\nAll tables: {all_tables}")
        print(f"Player cells: {players}")
        
        if players == 0:
            # Save HTML for inspection
            with open("/tmp/fbref_loaded.html", "w") as f:
                f.write(html)
            print("Saved HTML to /tmp/fbref_loaded.html")
            
            # Check what's in the page
            body_text = await page.evaluate("document.body.innerText.substring(0, 500)")
            print(f"\nBody text: {body_text}")
        
        await browser.close()

asyncio.run(main())
