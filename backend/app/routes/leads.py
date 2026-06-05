from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from typing import List, Optional
from datetime import datetime

from backend.app.db.session import get_db, get_next_sequence_value, SessionLocal
from backend.app.db.models import Lead, SearchHistory, User, WebsiteAudit, Outreach, Proposal
from backend.app.db.schemas import (
    SearchHistoryResponse, SearchHistoryCreate,
    LeadResponse, LeadCRMUpdate, LeadDetailResponse,
    ProposalResponse, ProposalGenerateRequest, OutreachResponse
)
from backend.app.routes.auth import get_current_user
from backend.app.scraper.maps_scraper import scrape_google_maps
from backend.app.services.ai_service import generate_specific_proposal

router = APIRouter(prefix="/leads", tags=["leads"])

@router.post("/search", response_model=SearchHistoryResponse)
def trigger_lead_search(
    search_in: SearchHistoryCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    # Log the search in history
    new_id = get_next_sequence_value(db, "search_histories")
    history_dict = {
        "_id": new_id,
        "query": search_in.query,
        "location": search_in.location,
        "min_rating": search_in.min_rating,
        "min_reviews": search_in.min_reviews,
        "user_id": current_user.id,
        "status": "pending",
        "results_count": 0,
        "created_at": datetime.utcnow()
    }
    db.search_histories.insert_one(history_dict)

    # Launch Playwright search task in FastAPI BackgroundTasks
    background_tasks.add_task(
        scrape_google_maps,
        query=search_in.query,
        location=search_in.location,
        min_rating=search_in.min_rating,
        min_reviews=search_in.min_reviews,
        search_history_id=new_id,
        db_session_maker=SessionLocal
    )

    return SearchHistory(history_dict)

@router.get("/history", response_model=List[SearchHistoryResponse])
def get_search_history(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    histories_cursor = db.search_histories.find({"user_id": current_user.id}).sort("created_at", -1)
    return [SearchHistory(h) for h in histories_cursor]

@router.post("/history/{id}/rerun", response_model=SearchHistoryResponse)
def rerun_search(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    old_search = db.search_histories.find_one({
        "_id": id,
        "user_id": current_user.id
    })
    
    if not old_search:
        raise HTTPException(status_code=404, detail="Search history not found")

    new_id = get_next_sequence_value(db, "search_histories")
    new_search_dict = {
        "_id": new_id,
        "query": old_search["query"],
        "location": old_search["location"],
        "min_rating": old_search["min_rating"],
        "min_reviews": old_search["min_reviews"],
        "user_id": current_user.id,
        "status": "pending",
        "results_count": 0,
        "created_at": datetime.utcnow()
    }
    db.search_histories.insert_one(new_search_dict)

    background_tasks.add_task(
        scrape_google_maps,
        query=new_search_dict["query"],
        location=new_search_dict["location"],
        min_rating=new_search_dict["min_rating"],
        min_reviews=new_search_dict["min_reviews"],
        search_history_id=new_id,
        db_session_maker=SessionLocal
    )

    return SearchHistory(new_search_dict)

@router.get("/", response_model=List[LeadResponse])
def list_leads(
    search_history_id: Optional[int] = None,
    status: Optional[str] = None,
    rating: Optional[float] = None,
    lead_score_category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    # Get user search history ids
    histories = list(db.search_histories.find({"user_id": current_user.id}))
    history_ids = [h["_id"] for h in histories]

    filters = {"search_history_id": {"$in": history_ids}}
    
    if search_history_id is not None:
        if search_history_id not in history_ids:
            return []
        filters["search_history_id"] = search_history_id
    if status is not None:
        filters["status"] = status
    if rating is not None:
        filters["rating"] = {"$gte": rating}
    if lead_score_category is not None:
        filters["lead_score_category"] = lead_score_category
    if search is not None and search != "":
        filters["name"] = {"$regex": search, "$options": "i"}

    leads_cursor = db.leads.find(filters).sort("created_at", -1).skip(offset).limit(limit)
    return [Lead(l) for l in leads_cursor]

@router.get("/{id}", response_model=LeadDetailResponse)
def get_lead_details(
    id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    lead_data = db.leads.find_one({"_id": id})
    if not lead_data:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    history = db.search_histories.find_one({"_id": lead_data["search_history_id"], "user_id": current_user.id})
    if not history:
        raise HTTPException(status_code=403, detail="Not authorized to access this lead")
        
    return Lead(lead_data)

@router.put("/{id}/crm", response_model=LeadResponse)
def update_lead_crm(
    id: int,
    crm_in: LeadCRMUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    lead_data = db.leads.find_one({"_id": id})
    if not lead_data:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    history = db.search_histories.find_one({"_id": lead_data["search_history_id"], "user_id": current_user.id})
    if not history:
        raise HTTPException(status_code=403, detail="Not authorized to access this lead")

    updates = {}
    if crm_in.status is not None:
        updates["status"] = crm_in.status
    if crm_in.notes is not None:
        updates["notes"] = crm_in.notes
    if crm_in.tags is not None:
        updates["tags"] = crm_in.tags
    if crm_in.follow_up_date is not None:
        updates["follow_up_date"] = crm_in.follow_up_date

    if updates:
        db.leads.update_one({"_id": id}, {"$set": updates})
        lead_data = db.leads.find_one({"_id": id})

    return Lead(lead_data)

@router.get("/{id}/outreach", response_model=OutreachResponse)
def get_lead_outreach(
    id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    lead_data = db.leads.find_one({"_id": id})
    if not lead_data:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    history = db.search_histories.find_one({"_id": lead_data["search_history_id"], "user_id": current_user.id})
    if not history:
        raise HTTPException(status_code=403, detail="Not authorized to access this lead")

    outreach_data = lead_data.get("outreach")
    if not outreach_data:
        raise HTTPException(status_code=404, detail="Outreach templates not found for this lead")
        
    # Format subdocument dictionary to match schema response requirements
    outreach_dict = dict(outreach_data)
    outreach_dict["lead_id"] = id
    outreach_dict["id"] = outreach_dict.get("id") or id
    return Outreach(outreach_dict)

@router.post("/{id}/proposal", response_model=ProposalResponse)
async def get_or_generate_proposal(
    id: int,
    req: ProposalGenerateRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    lead_data = db.leads.find_one({"_id": id})
    if not lead_data:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    history = db.search_histories.find_one({"_id": lead_data["search_history_id"], "user_id": current_user.id})
    if not history:
        raise HTTPException(status_code=403, detail="Not authorized to access this lead")

    # This will check cache or call Groq to compile a proposal in chosen format
    proposal_text = await generate_specific_proposal(id, req.format, db)
    
    # Retrieve the saved proposal
    proposal_data = db.proposals.find_one({
        "lead_id": id,
        "format": req.format
    })
    
    return Proposal(proposal_data)

@router.post("/analyze-voice")
async def analyze_voice_query(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    import json
    from backend.app.config import settings
    from backend.app.services.ai_service import call_groq_llm
    
    transcript = payload.get("transcript", "")
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required")
        
    api_key = current_user.groq_api_key or settings.GROQ_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="Groq API key not configured")
        
    system_prompt = "You are a professional B2B lead generation query parsing assistant. Analyze the user's spoken voice command and extract structured parameters in JSON."
    
    user_prompt = f"""
    Analyze this spoken voice search command: "{transcript}"
    Extract the following search parameters:
    1. "query": The business category / industry keyword to search for (e.g. dentist, school, cafe). If not mentioned, set to "".
    2. "location": The city / location to search in. If not mentioned, set to "".
    3. "min_rating": The minimum rating requested (float like 3.5, 4.0, 4.5). If not mentioned or "any", set to 0.0.
    4. "min_reviews": The minimum review count requested (int like 10, 50, 100). If not mentioned or "any", set to 0.
    
    Provide the response strictly in JSON format matching this structure:
    {{
      "query": "extracted category",
      "location": "extracted location",
      "min_rating": 3.5,
      "min_reviews": 50
    }}
    Ensure the JSON is completely valid. Do not wrap the JSON in markdown code blocks.
    """
    
    try:
        res_json = await call_groq_llm(api_key, system_prompt, user_prompt)
        cleaned = res_json.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return json.loads(cleaned.strip())
    except Exception as e:
        return {
            "query": transcript,
            "location": "",
            "min_rating": 0.0,
            "min_reviews": 0
        }

