from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.app.db.session import get_db, SessionLocal
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
    db: Session = Depends(get_db)
):
    # Log the search in history
    history = SearchHistory(
        query=search_in.query,
        location=search_in.location,
        min_rating=search_in.min_rating,
        min_reviews=search_in.min_reviews,
        user_id=current_user.id,
        status="pending",
        results_count=0
    )
    db.add(history)
    db.commit()
    db.refresh(history)

    # Launch Playwright search task in FastAPI BackgroundTasks
    background_tasks.add_task(
        scrape_google_maps,
        query=search_in.query,
        location=search_in.location,
        min_rating=search_in.min_rating,
        min_reviews=search_in.min_reviews,
        search_history_id=history.id,
        db_session_maker=SessionLocal
    )

    return history

@router.get("/history", response_model=List[SearchHistoryResponse])
def get_search_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(SearchHistory).filter(SearchHistory.user_id == current_user.id).order_by(SearchHistory.created_at.desc()).all()

@router.post("/history/{id}/rerun", response_model=SearchHistoryResponse)
def rerun_search(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    old_search = db.query(SearchHistory).filter(
        SearchHistory.id == id,
        SearchHistory.user_id == current_user.id
    ).first()
    
    if not old_search:
        raise HTTPException(status_code=404, detail="Search history not found")

    new_search = SearchHistory(
        query=old_search.query,
        location=old_search.location,
        min_rating=old_search.min_rating,
        min_reviews=old_search.min_reviews,
        user_id=current_user.id,
        status="pending",
        results_count=0
    )
    db.add(new_search)
    db.commit()
    db.refresh(new_search)

    background_tasks.add_task(
        scrape_google_maps,
        query=new_search.query,
        location=new_search.location,
        min_rating=new_search.min_rating,
        min_reviews=new_search.min_reviews,
        search_history_id=new_search.id,
        db_session_maker=SessionLocal
    )

    return new_search

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
    db: Session = Depends(get_db)
):
    # Query leads belonging to the current user's search histories
    query = db.query(Lead).join(SearchHistory).filter(SearchHistory.user_id == current_user.id)
    
    if search_history_id is not None:
        query = query.filter(Lead.search_history_id == search_history_id)
    if status is not None:
        query = query.filter(Lead.status == status)
    if rating is not None:
        query = query.filter(Lead.rating >= rating)
    if lead_score_category is not None:
        query = query.filter(Lead.lead_score_category == lead_score_category)
    if search is not None and search != "":
        query = query.filter(Lead.name.ilike(f"%{search}%"))

    return query.order_by(Lead.created_at.desc()).offset(offset).limit(limit).all()

@router.get("/{id}", response_model=LeadDetailResponse)
def get_lead_details(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lead = db.query(Lead).join(SearchHistory).filter(
        Lead.id == id,
        SearchHistory.user_id == current_user.id
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@router.put("/{id}/crm", response_model=LeadResponse)
def update_lead_crm(
    id: int,
    crm_in: LeadCRMUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lead = db.query(Lead).join(SearchHistory).filter(
        Lead.id == id,
        SearchHistory.user_id == current_user.id
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if crm_in.status is not None:
        lead.status = crm_in.status
    if crm_in.notes is not None:
        lead.notes = crm_in.notes
    if crm_in.tags is not None:
        lead.tags = crm_in.tags
    if crm_in.follow_up_date is not None:
        lead.follow_up_date = crm_in.follow_up_date

    db.commit()
    db.refresh(lead)
    return lead

@router.get("/{id}/outreach", response_model=OutreachResponse)
def get_lead_outreach(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lead = db.query(Lead).join(SearchHistory).filter(
        Lead.id == id,
        SearchHistory.user_id == current_user.id
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    outreach = db.query(Outreach).filter(Outreach.lead_id == id).first()
    if not outreach:
        raise HTTPException(status_code=404, detail="Outreach templates not found for this lead")
        
    return outreach

@router.post("/{id}/proposal", response_model=ProposalResponse)
async def get_or_generate_proposal(
    id: int,
    req: ProposalGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lead = db.query(Lead).join(SearchHistory).filter(
        Lead.id == id,
        SearchHistory.user_id == current_user.id
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # This will check cache or call Groq to compile a proposal in chosen format
    proposal_text = await generate_specific_proposal(id, req.format, db)
    
    # Retrieve the saved proposal
    proposal = db.query(Proposal).filter(
        Proposal.lead_id == id,
        Proposal.format == req.format
    ).first()
    
    return proposal


@router.post("/analyze-voice")
async def analyze_voice_query(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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

