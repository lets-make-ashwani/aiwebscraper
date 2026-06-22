import logging
import httpx
from datetime import datetime

logger = logging.getLogger("SheetsSync")

async def sync_lead_to_sheets(lead_id: int, db) -> bool:
    """
    Sends lead information to the user's Google Sheet webhook if configured.
    """
    try:
        lead_data = db.leads.find_one({"_id": lead_id})
        if not lead_data:
            logger.warning(f"Could not sync lead {lead_id}: lead not found.")
            return False

        # Find search history to get user
        history = db.search_histories.find_one({"_id": lead_data["search_history_id"]})
        if not history:
            logger.warning(f"Could not sync lead {lead_id}: search history not found.")
            return False

        user = db.users.find_one({"_id": history["user_id"]})
        if not user or not user.get("google_sheets_webhook_url"):
            # Webhook not configured, skip sync
            return False

        webhook_url = user["google_sheets_webhook_url"]
        logger.info(f"Syncing lead {lead_id} ('{lead_data.get('name')}') to Google Sheets...")

        # Format payload
        payload = {
            "id": lead_data.get("_id"),
            "name": lead_data.get("name"),
            "phone": lead_data.get("phone") or "",
            "website": lead_data.get("website") or "",
            "address": lead_data.get("address") or "",
            "rating": lead_data.get("rating") or 0.0,
            "reviews_count": lead_data.get("reviews_count") or 0,
            "category": lead_data.get("category") or "",
            "website_type": lead_data.get("website_type") or "no_website",
            "lead_score": lead_data.get("lead_score") or "",
            "lead_score_category": lead_data.get("lead_score_category") or "Unscored",
            "status": lead_data.get("status") or "New",
            "created_at": lead_data.get("created_at").isoformat() if isinstance(lead_data.get("created_at"), datetime) else str(lead_data.get("created_at"))
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, json=payload)
            if response.status_code in [200, 201]:
                logger.info(f"Successfully synced lead {lead_id} to Google Sheets.")
                return True
            else:
                logger.error(f"Google Sheet webhook returned status {response.status_code}: {response.text}")
                return False

    except Exception as e:
        logger.error(f"Error syncing lead {lead_id} to Google Sheets: {e}")
        return False
