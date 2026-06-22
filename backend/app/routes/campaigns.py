from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional
from datetime import datetime
import random
import asyncio
import logging

from backend.app.db.session import get_db, get_next_sequence_value, SessionLocal
from backend.app.db.models import User, Campaign, CampaignQueue, Lead
from backend.app.db.schemas import CampaignCreate, CampaignResponse, CampaignQueueResponse
from backend.app.routes.auth import get_current_user
from backend.app.services.whatsapp_worker import WhatsAppWorker

logger = logging.getLogger("CampaignsRouter")
router = APIRouter(prefix="/campaigns", tags=["campaigns"])

# Active tasks tracking: { campaign_id: asyncio.Task }
active_campaign_tasks = {}

async def run_campaign_worker(campaign_id: int):
    """
    Background worker loop that processes campaign queue items sequentially with safety delays.
    """
    db = SessionLocal()
    try:
        while True:
            # 1. Fetch current campaign status
            campaign_data = db.campaigns.find_one({"_id": campaign_id})
            if not campaign_data:
                logger.error(f"Campaign {campaign_id} not found in worker. Exiting.")
                break
                
            campaign = Campaign(campaign_data)
            if campaign.status != "running":
                logger.info(f"Campaign {campaign_id} is in status '{campaign.status}'. Exiting worker.")
                break

            # 2. Get next pending queue item
            item_data = db.campaign_queues.find_one({
                "campaign_id": campaign_id,
                "status": "pending"
            })
            if not item_data:
                logger.info(f"No pending items left for Campaign {campaign_id}. Completing campaign.")
                db.campaigns.update_one(
                    {"_id": campaign_id},
                    {"$set": {"status": "completed", "updated_at": datetime.utcnow()}}
                )
                break

            queue_item = CampaignQueue(item_data)
            
            # Update status of item to sending
            db.campaign_queues.update_one(
                {"_id": queue_item.id},
                {"$set": {"status": "sending"}}
            )

            # Get Lead details
            lead_data = db.leads.find_one({"_id": queue_item.lead_id})
            if not lead_data:
                db.campaign_queues.update_one(
                    {"_id": queue_item.id},
                    {"$set": {"status": "failed", "error_message": "Lead not found in database"}}
                )
                db.campaigns.update_one(
                    {"_id": campaign_id},
                    {"$inc": {"failed_count": 1}, "$set": {"updated_at": datetime.utcnow()}}
                )
                continue

            lead = Lead(lead_data)
            user = db.users.find_one({"_id": campaign.user_id})

            min_delay = user.get("whatsapp_delay_min", 15) if user else 15
            max_delay = user.get("whatsapp_delay_max", 45) if user else 45
            
            # Send message based on channel
            success = False
            error_msg = ""
            
            if campaign.outreach_channel == "whatsapp":
                phone = lead.phone
                outreach = lead.outreach
                whatsapp_text = outreach.whatsapp_text if outreach else None
                
                if not phone:
                    success = False
                    error_msg = "Lead has no phone number"
                elif not whatsapp_text:
                    success = False
                    error_msg = "No WhatsApp template copy generated for lead"
                else:
                    try:
                        success = await WhatsAppWorker.send_outreach_message(campaign.user_id, phone, whatsapp_text)
                        if not success:
                            error_msg = "WhatsApp delivery failed"
                    except Exception as e:
                        success = False
                        error_msg = f"Automation error: {str(e)}"
            else:
                # Fallback for email / other channels (simulated)
                await asyncio.sleep(2)
                success = True

            # 3. Update queue item status
            if success:
                db.campaign_queues.update_one(
                    {"_id": queue_item.id},
                    {"$set": {"status": "sent", "sent_at": datetime.utcnow()}}
                )
                db.campaigns.update_one(
                    {"_id": campaign_id},
                    {"$inc": {"sent_count": 1}, "$set": {"updated_at": datetime.utcnow()}}
                )
            else:
                db.campaign_queues.update_one(
                    {"_id": queue_item.id},
                    {"$set": {"status": "failed", "error_message": error_msg}}
                )
                db.campaigns.update_one(
                    {"_id": campaign_id},
                    {"$inc": {"failed_count": 1}, "$set": {"updated_at": datetime.utcnow()}}
                )

            # 4. Safety delay between messages
            delay = random.randint(min_delay, max_delay)
            logger.info(f"Campaign {campaign_id}: message processed. Sleeping for {delay}s...")
            await asyncio.sleep(delay)

    except Exception as worker_err:
        logger.error(f"Error in campaign worker {campaign_id}: {worker_err}")
        db.campaigns.update_one(
            {"_id": campaign_id},
            {"$set": {"status": "failed", "updated_at": datetime.utcnow()}}
        )
    finally:
        db.close()
        active_campaign_tasks.pop(campaign_id, None)

@router.post("/", response_model=CampaignResponse)
def create_campaign(
    campaign_in: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Creates a new campaign, adds the selected leads to the outreach queue, and starts processing.
    """
    campaign_id = get_next_sequence_value(db, "campaigns")
    
    # 1. Create Campaign document
    campaign_dict = {
        "_id": campaign_id,
        "name": campaign_in.name,
        "user_id": current_user.id,
        "status": "running",  # start running immediately
        "outreach_channel": campaign_in.outreach_channel,
        "leads_count": len(campaign_in.lead_ids),
        "sent_count": 0,
        "failed_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    db.campaigns.insert_one(campaign_dict)

    # 2. Add selected leads to Queue
    for lead_id in campaign_in.lead_ids:
        queue_id = get_next_sequence_value(db, "campaign_queues")
        queue_dict = {
            "_id": queue_id,
            "campaign_id": campaign_id,
            "lead_id": lead_id,
            "status": "pending",
            "error_message": None,
            "sent_at": None,
            "created_at": datetime.utcnow()
        }
        db.campaign_queues.insert_one(queue_dict)

    # 3. Start background runner
    task = asyncio.create_task(run_campaign_worker(campaign_id))
    active_campaign_tasks[campaign_id] = task

    return Campaign(campaign_dict)

@router.get("/", response_model=List[CampaignResponse])
def get_campaigns(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    List all campaigns owned by the current user.
    """
    cursor = db.campaigns.find({"user_id": current_user.id}).sort("created_at", -1)
    return [Campaign(c) for c in cursor]

@router.get("/{id}", response_model=CampaignResponse)
def get_campaign_detail(
    id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Retrieve details of a specific campaign.
    """
    campaign_data = db.campaigns.find_one({"_id": id, "user_id": current_user.id})
    if not campaign_data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return Campaign(campaign_data)

@router.get("/{id}/queue")
def get_campaign_queue(
    id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Fetch the list of queue items along with lead name & details for a specific campaign.
    """
    campaign_data = db.campaigns.find_one({"_id": id, "user_id": current_user.id})
    if not campaign_data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    cursor = db.campaign_queues.find({"campaign_id": id})
    items = []
    for doc in cursor:
        lead_doc = db.leads.find_one({"_id": doc["lead_id"]})
        items.append({
            "id": doc["_id"],
            "campaign_id": doc["campaign_id"],
            "lead_id": doc["lead_id"],
            "lead_name": lead_doc["name"] if lead_doc else "Unknown Lead",
            "phone": lead_doc["phone"] if lead_doc else "",
            "status": doc["status"],
            "error_message": doc["error_message"],
            "sent_at": doc["sent_at"],
            "created_at": doc["created_at"]
        })
    return items

@router.post("/{id}/pause", response_model=CampaignResponse)
def pause_campaign(
    id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Pauses a running outreach campaign.
    """
    campaign_data = db.campaigns.find_one({"_id": id, "user_id": current_user.id})
    if not campaign_data:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    db.campaigns.update_one(
        {"_id": id},
        {"$set": {"status": "paused", "updated_at": datetime.utcnow()}}
    )
    
    # Cancel task in background
    task = active_campaign_tasks.pop(id, None)
    if task:
        task.cancel()

    campaign_data = db.campaigns.find_one({"_id": id})
    return Campaign(campaign_data)

@router.post("/{id}/resume", response_model=CampaignResponse)
def resume_campaign(
    id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Resumes a paused outreach campaign.
    """
    campaign_data = db.campaigns.find_one({"_id": id, "user_id": current_user.id})
    if not campaign_data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db.campaigns.update_one(
        {"_id": id},
        {"$set": {"status": "running", "updated_at": datetime.utcnow()}}
    )

    # Launch background worker
    if id not in active_campaign_tasks:
        task = asyncio.create_task(run_campaign_worker(id))
        active_campaign_tasks[id] = task

    campaign_data = db.campaigns.find_one({"_id": id})
    return Campaign(campaign_data)

@router.delete("/{id}")
def delete_campaign(
    id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Deletes a campaign and cleans up its queue records.
    """
    campaign_data = db.campaigns.find_one({"_id": id, "user_id": current_user.id})
    if not campaign_data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Cancel active task
    task = active_campaign_tasks.pop(id, None)
    if task:
        task.cancel()

    # Clear from DB
    db.campaigns.delete_one({"_id": id})
    db.campaign_queues.delete_many({"campaign_id": id})
    return {"message": f"Campaign {id} deleted successfully."}


# WHATSAPP WEB SESSION CONTROLS

@router.get("/whatsapp/status")
async def get_whatsapp_status(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Gets the user's active WhatsApp Web pairing status and QR code base64 if disconnected.
    """
    status_info = await WhatsAppWorker.get_status(current_user.id, db)
    return status_info

@router.post("/whatsapp/pair")
async def pair_whatsapp(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Starts pairing flow: loads WhatsApp Web and returns pairing QR code.
    """
    qr_code = await WhatsAppWorker.start_pairing(current_user.id, db)
    return {"qr_code": qr_code}

@router.post("/whatsapp/disconnect")
async def disconnect_whatsapp(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Disconnects the active Playwright WhatsApp browser context.
    """
    await WhatsAppWorker.stop_session(current_user.id)
    return {"message": "WhatsApp session disconnected successfully."}
