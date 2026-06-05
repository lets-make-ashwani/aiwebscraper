import asyncio
import sys
from playwright.async_api import async_playwright

async def main():
    query = "schools in delhi"
    url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
    print(f"Testing URL: {url}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        try:
            print("Navigating...")
            response = await page.goto(url, timeout=30000)
            print(f"Status code: {response.status if response else 'No response'}")
            print(f"Current page URL: {page.url}")
            print(f"Page title: {await page.title()}")
            
            # Save screenshot
            screenshot_path = "google_maps_screenshot.png"
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")
            
            # Check for consent screen
            content = await page.content()
            if "consent.google.com" in page.url or "Before you continue" in content or "Accept all" in content:
                print("Detected Google consent screen! Trying to accept...")
                # Try clicking the accept button if it exists
                buttons = await page.query_selector_all("button")
                for btn in buttons:
                    text = await btn.inner_text()
                    if "Accept all" in text or "I agree" in text or "Agree" in text:
                        print(f"Clicking agreement button: {text}")
                        await btn.click()
                        await page.wait_for_load_state("networkidle")
                        print(f"URL after clicking accept: {page.url}")
                        await page.screenshot(path="after_accept_screenshot.png")
                        break
            
            # Configure stdout to use utf-8 to avoid encoding errors on Windows
            if hasattr(sys.stdout, 'reconfigure'):
                sys.stdout.reconfigure(encoding='utf-8')
            
            # Check if feed selector exists
            feed = await page.query_selector('div[role="feed"]')
            if feed:
                print("SUCCESS: Feed selector div[role='feed'] found!")
                
                # Get the child divs (cards)
                cards = await page.query_selector_all('div[role="feed"] > div')
                print(f"Found {len(cards)} card div elements under the feed.")
                
                count = 0
                for i, card in enumerate(cards):
                    # Check if this card looks like a business card (has a title or header)
                    title_el = await card.query_selector('div.fontHeadlineSmall')
                    if title_el:
                        count += 1
                        name = await title_el.inner_text()
                        print(f"\n--- Clicking Card {i+1}: {name} ---")
                        
                        # Click on the card to open the detail panel
                        card_link_el = await card.query_selector('a.hfpxzc')
                        if card_link_el:
                            try:
                                await card_link_el.scroll_into_view_if_needed()
                                print("Performing direct JavaScript click...")
                                await page.evaluate("el => el.click()", card_link_el)
                                
                                # Wait for detail panel to load
                                print("Waiting for detail panel h1 to load...")
                                loaded = False
                                for _ in range(15):
                                    h1_el = await page.query_selector('h1')
                                    if h1_el:
                                        h1_text = await h1_el.inner_text()
                                        if name.lower() in h1_text.lower() or h1_text.lower() in name.lower():
                                            loaded = True
                                            print(f"Detail panel loaded for: {h1_text}")
                                            break
                                    await page.wait_for_timeout(200)
                                    
                                if not loaded:
                                    print("Detail panel h1 did not match/load, waiting fallback 2s...")
                                    await page.wait_for_timeout(2000)
                                    
                                # Inspect detail panel content
                                print("Detail panel content dump:")
                                # Print all elements with data-item-id
                                elements = await page.query_selector_all('[data-item-id]')
                                print(f"Found {len(elements)} elements with data-item-id in the page:")
                                for el in elements:
                                    item_id = await el.get_attribute("data-item-id")
                                    text = await el.inner_text()
                                    print(f"  - data-item-id='{item_id}': '{text.strip()}'")
                                    
                            except Exception as inner_e:
                                print(f"Error clicking/inspecting details: {inner_e}")
                        
                        if count >= 2:
                            break
            else:
                print("WARNING: div[role='feed'] not found.")
                
        except Exception as e:
            print(f"Error occurred: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
