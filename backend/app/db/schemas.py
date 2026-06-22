from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Auth Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    company_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    company_branding: Optional[str] = None

class UserSettingsUpdate(BaseModel):
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    company_name: Optional[str] = None
    company_branding: Optional[str] = None
    google_sheets_webhook_url: Optional[str] = None
    whatsapp_delay_min: Optional[int] = None
    whatsapp_delay_max: Optional[int] = None
    whatsapp_daily_limit: Optional[int] = None
    custom_system_prompt: Optional[str] = None

class UserResponse(UserBase):
    id: int
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    company_branding: Optional[str] = None
    google_sheets_webhook_url: Optional[str] = None
    whatsapp_delay_min: Optional[int] = None
    whatsapp_delay_max: Optional[int] = None
    whatsapp_daily_limit: Optional[int] = None
    custom_system_prompt: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Search History Schemas
class SearchHistoryCreate(BaseModel):
    query: str
    location: Optional[str] = ""
    min_rating: Optional[float] = 0.0
    min_reviews: Optional[int] = 0

class SearchHistoryResponse(BaseModel):
    id: int
    query: str
    location: Optional[str]
    min_rating: float
    min_reviews: int
    results_count: int
    status: str
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Audit Schema
class WebsiteAuditResponse(BaseModel):
    id: int
    lead_id: int
    is_mobile_responsive: bool
    has_ssl: bool
    has_contact_form: bool
    has_cta: bool
    seo_title: Optional[str]
    seo_description: Optional[str]
    missing_seo: bool
    page_speed_score: int
    has_accessibility_basics: bool
    social_media_links: Optional[str]
    has_booking_system: bool
    audit_report: Optional[str]
    emails: Optional[str] = None
    phones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Lead Schemas
class LeadResponse(BaseModel):
    id: int
    search_history_id: int
    name: str
    phone: Optional[str]
    website: Optional[str]
    address: Optional[str]
    rating: Optional[float]
    reviews_count: Optional[int]
    category: Optional[str]
    google_maps_url: Optional[str]
    website_type: str
    audit_status: str
    lead_score: Optional[int]
    lead_score_category: Optional[str]
    status: str
    notes: Optional[str]
    tags: Optional[str]
    follow_up_date: Optional[datetime]
    reviews_sentiment: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LeadCRMUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    follow_up_date: Optional[datetime] = None

class LeadDetailResponse(LeadResponse):
    audit: Optional[WebsiteAuditResponse] = None

# AI Outreach / Proposal Schemas
class ProposalGenerateRequest(BaseModel):
    format: str # short, detailed, freelance, agency

class ProposalResponse(BaseModel):
    id: int
    lead_id: int
    format: str
    proposal_text: str
    created_at: datetime

    class Config:
        from_attributes = True

class OutreachResponse(BaseModel):
    id: int
    lead_id: int
    email_text: Optional[str]
    linkedin_text: Optional[str]
    whatsapp_text: Optional[str]
    cold_dm_text: Optional[str]
    cold_call_script: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Dashboard Stats Schemas
class DashboardStats(BaseModel):
    total_leads: int
    qualified_leads: int
    unqualified_leads: int
    websites_audited: int
    outreach_generated: int
    recent_searches: List[SearchHistoryResponse]
    leads_per_day: List[dict] # [{"date": "2026-05-28", "count": 12}]
    leads_by_industry: List[dict] # [{"industry": "Dentist", "count": 15}]
    score_distribution: List[dict] # [{"category": "Hot", "count": 5}]

# Campaign Schemas
class CampaignCreate(BaseModel):
    name: str
    outreach_channel: str = "whatsapp" # whatsapp, email
    lead_ids: List[int]

class CampaignResponse(BaseModel):
    id: int
    name: str
    user_id: int
    status: str
    outreach_channel: str
    leads_count: int
    sent_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CampaignQueueResponse(BaseModel):
    id: int
    campaign_id: int
    lead_id: int
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
