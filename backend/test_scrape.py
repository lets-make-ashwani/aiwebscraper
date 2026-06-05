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
                        
                        # Click on the card title to open the detail panel
                        await title_el.click()
                        # Wait for the detail panel/pane to load
                        await page.wait_for_timeout(3000)
                        
                        print("Inspecting detail panel elements...")
                        
                        # Find all links (a tags) on the page that might be in the detail pane
                        # The detail pane container often has a role="main" or is div.bJz19 or similar.
                        # Let's search all links on the page that look like website links or authority links
                        links = await page.query_selector_all('a')
                        website_links = []
                        for link in links:
                            href = await link.get_attribute("href")
                            if href:
                                # We want to find the website link. Usually it has data-item-id="authority" or contains the website domain
                                data_item_id = await link.get_attribute("data-item-id")
                                aria_label = await link.get_attribute("aria-label")
                                text = await link.inner_text()
                                if data_item_id == "authority" or (aria_label and "Website" in aria_label):
                                    website_links.append((text, href, data_item_id, aria_label))
                                elif "maps/place" not in href and "google.com" not in href and len(href) > 5:
                                    # potential website
                                    website_links.append((text, href, data_item_id, aria_label))
                        
                        print(f"Potential Website Links found: {len(website_links)}")
                        for wl in website_links:
                            print(f"  Web Link: text='{wl[0]}', href='{wl[1]}', data-item-id='{wl[2]}', aria-label='{wl[3]}'")
                            
                        # Let's inspect buttons for phone number
                        buttons = await page.query_selector_all('button')
                        phone_buttons = []
                        for btn in buttons:
                            aria_label = await btn.get_attribute("aria-label")
                            data_item_id = await btn.get_attribute("data-item-id")
                            text = await btn.inner_text()
                            if data_item_id and "phone" in data_item_id:
                                phone_buttons.append((text, aria_label, data_item_id))
                            elif aria_label and ("Phone" in aria_label or "phone" in aria_label or "Call" in aria_label):
                                phone_buttons.append((text, aria_label, data_item_id))
                                
                        print(f"Potential Phone Buttons found: {len(phone_buttons)}")
                        for pb in phone_buttons:
                            print(f"  Phone Button: text='{pb[0]}', aria-label='{pb[1]}', data-item-id='{pb[2]}'")
                            
                        # Also check if we can find any elements with data-item-id="phone:tel:"
                        phone_links = await page.query_selector_all('a[href^="tel:"]')
                        print(f"Phone links (tel:): {len(phone_links)}")
                        for pl in phone_links:
                            href = await pl.get_attribute("href")
                            text = await pl.inner_text()
                            print(f"  Tel Link: text='{text}', href='{href}'")
                            
                        # Save a screenshot of the details pane
                        await page.screenshot(path=f"detail_pane_{count}.png")
                        print(f"Saved screenshot detail_pane_{count}.png")
                        
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
