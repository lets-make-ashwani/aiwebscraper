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
            
            # Check if feed selector exists
            feed = await page.query_selector('div[role="feed"]')
            if feed:
                print("SUCCESS: Feed selector div[role='feed'] found!")
            else:
                print("WARNING: div[role='feed'] not found.")
                # Print some element classes to debug
                divs = await page.query_selector_all("div")
                print(f"Total div elements on page: {len(divs)}")
                
        except Exception as e:
            print(f"Error occurred: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
