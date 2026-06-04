from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List

from backend.app.db.session import get_db
from backend.app.db.models import Lead, SearchHistory, User, WebsiteAudit, Outreach
from backend.app.db.schemas import DashboardStats, SearchHistoryResponse
from backend.app.routes.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/", response_model=DashboardStats)
def get_dashboard_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Total user leads query
    user_leads_q = db.query(Lead).join(SearchHistory).filter(SearchHistory.user_id == current_user.id)
    
    total_leads = user_leads_q.count()
    
    # CRM pipeline breakdowns (smarter business logic counting hot/warm leads as qualified)
    qualified_leads = user_leads_q.filter(
        (Lead.status.in_(["Qualified", "Contacted", "Meeting Scheduled", "Proposal Sent", "Won"])) |
        (Lead.lead_score_category.in_(["Hot", "Warm"]))
    ).count()
    
    unqualified_leads = user_leads_q.filter(
        (Lead.status == "Lost") |
        ((Lead.status == "New") & ((Lead.lead_score_category.in_(["Medium", "Low Priority"])) | (Lead.lead_score_category.is_(None))))
    ).count()
    
    # Audits count
    websites_audited = user_leads_q.filter(Lead.audit_status == "audited").count()
    
    # Outreach items generated
    outreach_generated = db.query(Outreach).join(Lead).join(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).count()

    # Recent Searches (limit 5)
    recent_searches = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).order_by(SearchHistory.created_at.desc()).limit(5).all()

    # Chart 1: Leads per Day (last 7 days)
    today = datetime.utcnow().date()
    leads_per_day = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        
        # Query count for this day
        count = user_leads_q.filter(
            func.date(Lead.created_at) == day
        ).count()
        leads_per_day.append({"date": day_str, "count": count})

    # Chart 2: Leads by Industry (limit 5 top categories)
    industry_counts = db.query(
        Lead.category, func.count(Lead.id)
    ).join(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).group_by(Lead.category).order_by(func.count(Lead.id).desc()).limit(5).all()
    
    leads_by_industry = []
    for ind, count in industry_counts:
        leads_by_industry.append({
            "industry": ind or "Uncategorized",
            "count": count
        })
        
    if not leads_by_industry:
        leads_by_industry = [{"industry": "None", "count": 0}]

    # Chart 3: Lead Quality Score Distribution
    hot_count = user_leads_q.filter(Lead.lead_score_category == "Hot").count()
    warm_count = user_leads_q.filter(Lead.lead_score_category == "Warm").count()
    med_count = user_leads_q.filter(Lead.lead_score_category == "Medium").count()
    low_count = user_leads_q.filter(Lead.lead_score_category == "Low Priority").count()

    score_distribution = [
        {"category": "Hot (90-100)", "count": hot_count},
        {"category": "Warm (70-89)", "count": warm_count},
        {"category": "Medium (50-69)", "count": med_count},
        {"category": "Low (< 50)", "count": low_count}
    ]

    return {
        "total_leads": total_leads,
        "qualified_leads": qualified_leads,
        "unqualified_leads": unqualified_leads,
        "websites_audited": websites_audited,
        "outreach_generated": outreach_generated,
        "recent_searches": recent_searches,
        "leads_per_day": leads_per_day,
        "leads_by_industry": leads_by_industry,
        "score_distribution": score_distribution
    }
