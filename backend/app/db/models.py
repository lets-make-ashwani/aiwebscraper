from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    groq_api_key = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    company_branding = Column(String, nullable=True) # JSON or descriptive string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    searches = relationship("SearchHistory", back_populates="user", cascade="all, delete-orphan")

class SearchHistory(Base):
    __tablename__ = "search_histories"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, index=True, nullable=False)
    location = Column(String, nullable=True)
    min_rating = Column(Float, default=0.0)
    min_reviews = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    results_count = Column(Integer, default=0)
    status = Column(String, default="pending") # pending, scraping, completed, failed
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="searches")
    leads = relationship("Lead", back_populates="search_history", cascade="all, delete-orphan")

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    search_history_id = Column(Integer, ForeignKey("search_histories.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)
    address = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    reviews_count = Column(Integer, nullable=True)
    category = Column(String, nullable=True)
    google_maps_url = Column(String, nullable=True)
    
    # Website classification
    website_type = Column(String, default="no_website") # no_website, basic, modern
    
    # Audit status
    audit_status = Column(String, default="pending") # pending, auditing, audited, failed
    
    # Scoring
    lead_score = Column(Integer, nullable=True)
    lead_score_category = Column(String, nullable=True) # Hot, Warm, Medium, Low
    
    # CRM Status
    status = Column(String, default="New") # New, Qualified, Contacted, Meeting Scheduled, Proposal Sent, Won, Lost
    notes = Column(Text, nullable=True)
    tags = Column(String, nullable=True) # comma separated
    follow_up_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    search_history = relationship("SearchHistory", back_populates="leads")
    audit = relationship("WebsiteAudit", back_populates="lead", uselist=False, cascade="all, delete-orphan")
    proposals = relationship("Proposal", back_populates="lead", cascade="all, delete-orphan")
    outreach = relationship("Outreach", back_populates="lead", uselist=False, cascade="all, delete-orphan")

class WebsiteAudit(Base):
    __tablename__ = "website_audits"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Technical checks
    is_mobile_responsive = Column(Boolean, default=False)
    has_ssl = Column(Boolean, default=False)
    has_contact_form = Column(Boolean, default=False)
    has_cta = Column(Boolean, default=False)
    seo_title = Column(String, nullable=True)
    seo_description = Column(String, nullable=True)
    missing_seo = Column(Boolean, default=True)
    page_speed_score = Column(Integer, default=50) # 0-100 score estimated
    has_accessibility_basics = Column(Boolean, default=False)
    social_media_links = Column(String, nullable=True) # JSON list
    has_booking_system = Column(Boolean, default=False)
    
    # Output reports
    audit_report = Column(Text, nullable=True) # JSON or markdown business overview
    
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="audit")

class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    format = Column(String, nullable=False) # short, detailed, freelance, agency
    proposal_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="proposals")

class Outreach(Base):
    __tablename__ = "outreaches"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    email_text = Column(Text, nullable=True)
    linkedin_text = Column(Text, nullable=True)
    whatsapp_text = Column(Text, nullable=True)
    cold_dm_text = Column(Text, nullable=True)
    cold_call_script = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="outreach")
