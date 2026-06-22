import asyncio
import logging
import os
import re
import urllib.parse
import base64
from playwright.async_api import async_playwright
from datetime import datetime

logger = logging.getLogger("WhatsAppWorker")

# Global session store
# sessions = { user_id: { "browser": browser_context, "page": QR_page, "status": "disconnected/connecting/connected" } }
sessions = {}
playwright_instance = None

async def init_playwright():
    global playwright_instance
    if playwright_instance is None:
        playwright_instance = await async_playwright().start()

async def get_user_session_dir(user_id: int) -> str:
    # Save sessions in user data folder outside the backend directory to prevent uvicorn reload loops
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    base_dir = os.path.dirname(backend_dir)
    session_dir = os.path.join(base_dir, "whatsapp_sessions", f"user_{user_id}")
    os.makedirs(session_dir, exist_ok=True)
    return session_dir

class WhatsAppWorker:
    @staticmethod
    async def get_status(user_id: int, db) -> dict:
        """
        Returns the current WhatsApp login status, and the QR code if waiting for login.
        """
        global sessions
        await init_playwright()

        session = sessions.get(user_id)
        if not session:
            # Check if we have a saved session profile directory
            session_dir = await get_user_session_dir(user_id)
            # If directories exist, we can try to spin up chromium to see if it is logged in
            return {"status": "disconnected", "qr_code": None}
        
        return {
            "status": session.get("status", "disconnected"),
            "qr_code": session.get("qr_code")
        }

    @staticmethod
    async def start_pairing(user_id: int, db) -> str:
        """
        Launches Playwright for WhatsApp Web, navigates to it, and waits to retrieve a QR code.
        """
        global sessions, playwright_instance
        await init_playwright()

        # If already running/connected, return current state
        if user_id in sessions:
            status = sessions[user_id]["status"]
            if status in ["connecting", "connected"]:
                return sessions[user_id].get("qr_code")

        session_dir = await get_user_session_dir(user_id)
        logger.info(f"Starting WhatsApp browser pairing session for user {user_id} in {session_dir}")

        # Launch persistent browser context
        try:
            browser_context = await playwright_instance.chromium.launch_persistent_context(
                user_data_dir=session_dir,
                headless=True, # Headless by default for backend execution
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox"
                ]
            )
        except Exception as launch_err:
            logger.error(f"Failed to launch persistent context: {launch_err}")
            # If locked, try deleting the singleton lock file
            lock_file = os.path.join(session_dir, "SingletonLock")
            if os.path.exists(lock_file):
                try:
                    os.remove(lock_file)
                    browser_context = await playwright_instance.chromium.launch_persistent_context(
                        user_data_dir=session_dir,
                        headless=True,
                        viewport={"width": 1280, "height": 800},
                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
                    )
                except Exception as retry_err:
                    raise Exception(f"Failed to launch context on retry: {retry_err}")
            else:
                raise launch_err

        page = await browser_context.new_page()
        sessions[user_id] = {
            "context": browser_context,
            "page": page,
            "status": "connecting",
            "qr_code": None
        }

        # Navigate to WhatsApp Web
        await page.goto("https://web.whatsapp.com", timeout=60000)

        # Background task to monitor authentication / fetch QR
        asyncio.create_task(WhatsAppWorker._monitor_pairing(user_id))

        # Wait a few seconds for QR code generation
        for _ in range(15):
            await asyncio.sleep(1)
            if sessions[user_id]["qr_code"] or sessions[user_id]["status"] == "connected":
                break

        return sessions[user_id]["qr_code"]

    @staticmethod
    async def _monitor_pairing(user_id: int):
        global sessions
        session = sessions.get(user_id)
        if not session:
            return

        page = session["page"]
        
        try:
            # Loop to check status or capture QR
            while user_id in sessions:
                # 1. Check if logged in (pane-side represents chat list)
                chat_pane = await page.query_selector('div[id="pane-side"]')
                if chat_pane:
                    logger.info(f"WhatsApp Web authenticated successfully for user {user_id}!")
                    sessions[user_id]["status"] = "connected"
                    sessions[user_id]["qr_code"] = None
                    break

                # 2. Check if waiting for QR Code scan
                qr_canvas = await page.query_selector('canvas')
                if qr_canvas:
                    # Capture canvas screenshot to Base64
                    try:
                        qr_bytes = await qr_canvas.screenshot()
                        b64_qr = base64.b64encode(qr_bytes).decode("utf-8")
                        sessions[user_id]["qr_code"] = f"data:image/png;base64,{b64_qr}"
                        sessions[user_id]["status"] = "connecting"
                    except Exception as e:
                        logger.warning(f"Error capturing QR canvas screenshot: {e}")
                
                await asyncio.sleep(2)
        except Exception as err:
            logger.error(f"Error in monitor pairing loop for user {user_id}: {err}")
            sessions[user_id]["status"] = "disconnected"

    @staticmethod
    async def stop_session(user_id: int):
        global sessions
        session = sessions.pop(user_id, None)
        if session:
            logger.info(f"Stopping WhatsApp session for user {user_id}")
            try:
                await session["context"].close()
            except Exception as e:
                logger.error(f"Error closing context: {e}")

    @staticmethod
    async def send_outreach_message(user_id: int, phone: str, text: str) -> bool:
        """
        Sends a single WhatsApp message using the user's active session.
        """
        global sessions
        await init_playwright()

        # Check if connected, if not try to boot session quietly
        session = sessions.get(user_id)
        if not session or session["status"] != "connected":
            # Try to start pairing (this boots up browser context with user session)
            await WhatsAppWorker.start_pairing(user_id, None)
            
            # Wait up to 15 seconds to see if session auto-connects using saved cookies
            connected = False
            for _ in range(15):
                session = sessions.get(user_id)
                if session and session["status"] == "connected":
                    connected = True
                    break
                await asyncio.sleep(1)
            
            if not connected:
                logger.warning(f"Unable to send message: WhatsApp session is not authenticated for user {user_id}")
                return False

        page = session["page"]
        
        # Clean phone number (keep only digits)
        clean_phone = re.sub(r"\D", "", phone)
        # Ensure country code is present (default to India +91 if length is 10 digits)
        if len(clean_phone) == 10:
            clean_phone = "91" + clean_phone

        encoded_text = urllib.parse.quote(text)
        send_url = f"https://web.whatsapp.com/send?phone={clean_phone}&text={encoded_text}"
        logger.info(f"Navigating to WhatsApp Web send link for {clean_phone}")

        try:
            # We open a new page or use the main page. Let's use a new page to not disturb QR page
            outreach_page = await session["context"].new_page()
            await outreach_page.goto(send_url, timeout=45000)

            # Wait for send button (sometimes it takes a bit to load the chat pane)
            # span[data-icon="send"] is the official icon container inside send button
            send_btn = await outreach_page.wait_for_selector('span[data-icon="send"]', timeout=30000)
            if not send_btn:
                # try alternative button selectors
                send_btn = await outreach_page.wait_for_selector('button:has(span[data-icon="send"])', timeout=5000)

            if send_btn:
                # Click the button parent or direct button container
                button = await outreach_page.query_selector('button:has(span[data-icon="send"])')
                if button:
                    await button.click()
                else:
                    await send_btn.click()
                
                # Wait 5 seconds to ensure message is transmitted
                await asyncio.sleep(5)
                await outreach_page.close()
                logger.info(f"WhatsApp message successfully sent to {clean_phone}")
                return True
            else:
                await outreach_page.close()
                logger.error(f"WhatsApp send button not found for contact {clean_phone}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send automated WhatsApp message: {e}")
            try:
                await outreach_page.close()
            except Exception:
                pass
            return False
