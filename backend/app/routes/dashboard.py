from fastapi import APIRouter, Depends
from datetime import datetime, timedelta, time
from typing import List

from backend.app.db.session import get_db
from backend.app.db.models import Lead, SearchHistory, User
from backend.app.db.schemas import DashboardStats
from backend.app.routes.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/", response_model=DashboardStats)
def get_dashboard_statistics(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    # Find all search histories for current user to filter leads
    histories = list(db.search_histories.find({"user_id": current_user.id}))
    history_ids = [h["_id"] for h in histories]

    filters = {"search_history_id": {"$in": history_ids}}

    # Total user leads count
    total_leads = db.leads.count_documents(filters) if history_ids else 0

    # CRM pipeline breakdowns
    qualified_leads = 0
    unqualified_leads = 0
    websites_audited = 0
    outreach_generated = 0
    recent_searches = []
    leads_per_day = []
    leads_by_industry = []
    hot_count = 0
    warm_count = 0
    med_count = 0
    low_count = 0

    if history_ids:
        # Qualified leads: status in ["Qualified", "Contacted", "Meeting Scheduled", "Proposal Sent", "Won"] OR lead_score_category in ["Hot", "Warm"]
        qualified_leads = db.leads.count_documents({
            **filters,
            "$or": [
                {"status": {"$in": ["Qualified", "Contacted", "Meeting Scheduled", "Proposal Sent", "Won"]}},
                {"lead_score_category": {"$in": ["Hot", "Warm"]}}
            ]
        })

        # Unqualified leads: status == "Lost" OR (status == "New" AND (lead_score_category in ["Medium", "Low Priority"] OR lead_score_category is missing/None))
        unqualified_leads = db.leads.count_documents({
            **filters,
            "$or": [
                {"status": "Lost"},
                {
                    "$and": [
                        {"status": "New"},
                        {
                            "$or": [
                                {"lead_score_category": {"$in": ["Medium", "Low Priority"]}},
                                {"lead_score_category": {"$exists": False}},
                                {"lead_score_category": None}
                            ]
                        }
                    ]
                }
            ]
        })

        # Audited websites count
        websites_audited = db.leads.count_documents({
            **filters,
            "audit_status": "audited"
        })

        # Outreach items generated (outreach field exists and is not null in the lead document)
        outreach_generated = db.leads.count_documents({
            **filters,
            "outreach": {"$exists": True, "$ne": None}
        })

    # Recent Searches (limit 5)
    recent_searches_cursor = db.search_histories.find({"user_id": current_user.id}).sort("created_at", -1).limit(5)
    recent_searches = [SearchHistory(h) for h in recent_searches_cursor]

    # Chart 1: Leads per Day (last 7 days)
    today = datetime.utcnow().date()
    if history_ids:
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            start_dt = datetime.combine(day, time.min)
            end_dt = datetime.combine(day, time.max)
            
            count = db.leads.count_documents({
                **filters,
                "created_at": {"$gte": start_dt, "$lte": end_dt}
            })
            leads_per_day.append({"date": day_str, "count": count})
    else:
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            leads_per_day.append({"date": day.strftime("%Y-%m-%d"), "count": 0})

    # Chart 2: Leads by Industry (limit 5 top categories)
    if history_ids:
        pipeline = [
            {"$match": filters},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        industry_counts = list(db.leads.aggregate(pipeline))
        for item in industry_counts:
            leads_by_industry.append({
                "industry": item["_id"] or "Uncategorized",
                "count": item["count"]
            })
            
    if not leads_by_industry:
        leads_by_industry = [{"industry": "None", "count": 0}]

    # Chart 3: Lead Quality Score Distribution
    if history_ids:
        hot_count = db.leads.count_documents({**filters, "lead_score_category": "Hot"})
        warm_count = db.leads.count_documents({**filters, "lead_score_category": "Warm"})
        med_count = db.leads.count_documents({**filters, "lead_score_category": "Medium"})
        low_count = db.leads.count_documents({**filters, "lead_score_category": "Low Priority"})

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

