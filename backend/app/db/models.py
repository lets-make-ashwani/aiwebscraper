from datetime import datetime
from typing import Optional

class User:
    def __init__(self, data: dict = None, **kwargs):
        self._data = data or {}
        self._data.update(kwargs)
        
        self.id = self._data.get("id") or self._data.get("_id")
        self.email = self._data.get("email")
        self.hashed_password = self._data.get("hashed_password")
        self.full_name = self._data.get("full_name")
        self.company_name = self._data.get("company_name")
        self.groq_api_key = self._data.get("groq_api_key")
        self.company_branding = self._data.get("company_branding")
        self.created_at = self._data.get("created_at") or datetime.utcnow()
        self.updated_at = self._data.get("updated_at") or datetime.utcnow()

    def to_dict(self):
        d = {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        if "id" in d:
            if d["id"] is not None:
                d["_id"] = d.pop("id")
            else:
                d.pop("id")
        return d

class SearchHistory:
    def __init__(self, data: dict = None, **kwargs):
        self._data = data or {}
        self._data.update(kwargs)
        
        self.id = self._data.get("id") or self._data.get("_id")
        self.query = self._data.get("query")
        self.location = self._data.get("location")
        self.min_rating = self._data.get("min_rating", 0.0)
        self.min_reviews = self._data.get("min_reviews", 0)
        self.user_id = self._data.get("user_id")
        self.results_count = self._data.get("results_count", 0)
        self.status = self._data.get("status", "pending")
        self.error_message = self._data.get("error_message")
        self.created_at = self._data.get("created_at") or datetime.utcnow()

    def to_dict(self):
        d = {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        if "id" in d:
            if d["id"] is not None:
                d["_id"] = d.pop("id")
            else:
                d.pop("id")
        return d

class WebsiteAudit:
    def __init__(self, data: dict = None, **kwargs):
        self._data = data or {}
        self._data.update(kwargs)
        
        self.id = self._data.get("id") or self._data.get("_id")
        self.lead_id = self._data.get("lead_id")
        self.is_mobile_responsive = self._data.get("is_mobile_responsive", False)
        self.has_ssl = self._data.get("has_ssl", False)
        self.has_contact_form = self._data.get("has_contact_form", False)
        self.has_cta = self._data.get("has_cta", False)
        self.seo_title = self._data.get("seo_title")
        self.seo_description = self._data.get("seo_description")
        self.missing_seo = self._data.get("missing_seo", True)
        self.page_speed_score = self._data.get("page_speed_score", 50)
        self.has_accessibility_basics = self._data.get("has_accessibility_basics", False)
        self.social_media_links = self._data.get("social_media_links")
        self.has_booking_system = self._data.get("has_booking_system", False)
        self.audit_report = self._data.get("audit_report")
        self.created_at = self._data.get("created_at") or datetime.utcnow()

    def to_dict(self):
        d = {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        if "id" in d:
            if d["id"] is not None:
                d["_id"] = d.pop("id")
            else:
                d.pop("id")
        return d

class Outreach:
    def __init__(self, data: dict = None, **kwargs):
        self._data = data or {}
        self._data.update(kwargs)
        
        self.id = self._data.get("id") or self._data.get("_id")
        self.lead_id = self._data.get("lead_id")
        self.email_text = self._data.get("email_text")
        self.linkedin_text = self._data.get("linkedin_text")
        self.whatsapp_text = self._data.get("whatsapp_text")
        self.cold_dm_text = self._data.get("cold_dm_text")
        self.cold_call_script = self._data.get("cold_call_script")
        self.created_at = self._data.get("created_at") or datetime.utcnow()

    def to_dict(self):
        d = {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        if "id" in d:
            if d["id"] is not None:
                d["_id"] = d.pop("id")
            else:
                d.pop("id")
        return d

class Lead:
    def __init__(self, data: dict = None, **kwargs):
        self._data = data or {}
        self._data.update(kwargs)
        
        self.id = self._data.get("id") or self._data.get("_id")
        self.search_history_id = self._data.get("search_history_id")
        self.name = self._data.get("name")
        self.phone = self._data.get("phone")
        self.website = self._data.get("website")
        self.address = self._data.get("address")
        self.rating = self._data.get("rating")
        self.reviews_count = self._data.get("reviews_count")
        self.category = self._data.get("category")
        self.google_maps_url = self._data.get("google_maps_url")
        self.website_type = self._data.get("website_type", "no_website")
        self.audit_status = self._data.get("audit_status", "pending")
        self.lead_score = self._data.get("lead_score")
        self.lead_score_category = self._data.get("lead_score_category")
        self.status = self._data.get("status", "New")
        self.notes = self._data.get("notes")
        self.tags = self._data.get("tags")
        
        self.follow_up_date = self._data.get("follow_up_date")
        if isinstance(self.follow_up_date, str):
            try:
                self.follow_up_date = datetime.fromisoformat(self.follow_up_date)
            except Exception:
                pass
                
        self.created_at = self._data.get("created_at") or datetime.utcnow()
        if isinstance(self.created_at, str):
            try:
                self.created_at = datetime.fromisoformat(self.created_at)
            except Exception:
                pass
                
        self._audit_data = self._data.get("audit")
        self._outreach_data = self._data.get("outreach")

    @property
    def audit(self):
        if self._audit_data:
            return WebsiteAudit(self._audit_data)
        return None

    @property
    def outreach(self):
        if self._outreach_data:
            return Outreach(self._outreach_data)
        return None

    def to_dict(self):
        d = {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        if "id" in d:
            if d["id"] is not None:
                d["_id"] = d.pop("id")
            else:
                d.pop("id")
        return d

class Proposal:
    def __init__(self, data: dict = None, **kwargs):
        self._data = data or {}
        self._data.update(kwargs)
        
        self.id = self._data.get("id") or self._data.get("_id")
        self.lead_id = self._data.get("lead_id")
        self.format = self._data.get("format")
        self.proposal_text = self._data.get("proposal_text")
        self.created_at = self._data.get("created_at") or datetime.utcnow()

    def to_dict(self):
        d = {k: v for k, v in self.__dict__.items() if not k.startswith("_")}
        if "id" in d:
            if d["id"] is not None:
                d["_id"] = d.pop("id")
            else:
                d.pop("id")
        return d
