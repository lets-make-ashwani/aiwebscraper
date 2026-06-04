import httpx
import logging
import json
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.db.models import Lead, WebsiteAudit, Proposal, Outreach, User, SearchHistory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AIService")

def get_groq_key_for_lead(db: Session, lead: Lead) -> str:
    """Resolves the Groq API Key, checking user's custom settings first, then falling back to env."""
    try:
        search = db.query(SearchHistory).filter(SearchHistory.id == lead.search_history_id).first()
        if search:
            user = db.query(User).filter(User.id == search.user_id).first()
            if user and user.groq_api_key:
                return user.groq_api_key
    except Exception as e:
        logger.warning(f"Failed to fetch custom user Groq key: {e}")
    return settings.GROQ_API_KEY

async def call_groq_llm(api_key: str, system_prompt: str, user_prompt: str) -> str:
    """Performs HTTP POST completion request to the Groq API endpoint."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    # Using Llama 3.3 70B as primary, fallback to Llama 3 8B if rate limited
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 1500
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                res_data = response.json()
                return res_data["choices"][0]["message"]["content"]
            else:
                logger.warning(f"Groq API returned status {response.status_code}: {response.text}")
                # Try fallback model
                payload["model"] = "llama3-8b-8192"
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    res_data = response.json()
                    return res_data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Error making Groq API call: {e}")
        
    raise Exception("Groq API Call Failed")

# Fallback generators for offline/key failure states
def generate_offline_analysis(lead_name: str, category: str, score: int, has_website: bool) -> str:
    if not has_website:
        return f"""### Business Summary
{lead_name} is a local {category or "business"} looking to grow its customer base. Currently, they have no web presence, which means they are losing significant traffic to competitors who are searchable online.

### Online Presence Analysis
* **Website**: Missing.
* **Local SEO**: Low visibility. Searchers cannot find services, hours, or credentials.
* **Customer Journey**: Broken. Customers cannot book appointments online or verify phone numbers easily.

### Improvement Opportunities
1. **Redesign/Launch**: Build a fast, mobile-friendly landing page.
2. **Google Business Profile**: Connect a website link to improve Map pack rankings.
3. **Booking Integration**: Setup direct reservation/appointment links.

### Recommended Services
* Custom Website Development ($1,500 - $2,500)
* Local SEO Optimization ($500/month)
* Online Booking/Form Integration ($300)"""
    else:
        return f"""### Business Summary
{lead_name} is an active local {category or "business"} with an operational website. While they have established a base-level online presence, there are critical deficiencies in user experience and optimization.

### Online Presence Analysis
* **Performance**: Sub-optimal loading speed (Score: {score}).
* **Technical**: Missing core call-to-actions, and potential SEO keyword tags are weak or missing.
* **Mobile Layout**: Standard, but elements could be better aligned for touch interactions.

### Improvement Opportunities
1. **Conversion Rate Optimization**: Place a prominent "Book Appointment" button in the header.
2. **SEO Refactor**: Re-write meta titles and meta descriptions for local search targets.
3. **Speed Polish**: Optimize heavy elements to raise page score above 90.

### Recommended Services
* Website Speed & Performance Optimization ($600)
* Local SEO Campaign ($400/month)
* Lead Capture & CRM Setup ($500)"""

def generate_offline_proposal(lead_name: str, category: str, format_type: str) -> str:
    return f"""# Proposal for {lead_name}
**Prepared by**: LeadForge AI Consultant
**Format**: {format_type.capitalize()} Proposal

## Project Goal
To design and deploy high-performance digital systems that capture active search traffic, improve conversion rates, and automate online scheduling for your {category or "business"}.

## Proposed Scope of Work
1. **Custom Conversion Website**: Responsive, modern, speed-optimized website.
2. **On-Page SEO Refactor**: Tag alignments, meta descriptions, and Google local schema setup.
3. **Booking and Form Capture**: Interactive client booking forms (Acuity/Calendly style).
4. **Branding Package**: High-definition asset optimization.

## Pricing Options
* **One-time Setup**: $1,250
* **Monthly SEO & Maintenance**: $299 / month

*Thank you for the opportunity to partner together!*"""

def generate_offline_outreach(lead_name: str, category: str) -> dict:
    return {
        "email": f"Subject: Quick question about your website at {lead_name}\n\nHi team,\n\nI was looking for a {category or 'service'} in your area and noticed {lead_name} on Google Maps, but couldn't find an easy way to book an appointment directly from your listing.\n\nI specialize in helping local businesses set up automated scheduling pages and modern websites that double their lead count. \n\nAre you open to a quick 5-minute call this Thursday to see some examples of what we can do for you?\n\nBest,\n[Your Name]",
        "linkedin": f"Hi team at {lead_name}, loved your reviews on Google Maps! I noticed a few technical items on your web presence that could be holding back local search rankings. I've compiled a quick audit, would you mind if I sent it over here?",
        "whatsapp": f"Hello! Is this the manager at {lead_name}? I found your listing on Google Maps and wanted to inquire if you are accepting new clients. I noticed your website is currently missing a mobile booking link. We build local booking tools. Let me know if you'd like to see a demo!",
        "dm": f"Hey! Love the work you guys do at {lead_name}. Checked out your page and noticed your website booking is offline. Sent a quick recommendation to your inbox, hope it helps!",
        "call_script": f"Intro: 'Hi, is this the owner of {lead_name}?'\nHook: 'I found you on Google Maps while looking for local {category or 'services'} and noticed you have great reviews! I wanted to check if you're currently accepting new customers.'\nValue: 'I noticed your website isn't mobile-responsive yet, which means you might be losing customers who look you up on phones. I build simple 1-page mobile sites.'\nCTA: 'Could I send you a free mock-up of what your mobile site would look like tomorrow?'"
    }

async def generate_ai_analysis_and_score(lead_id: int, db_session_maker):
    """Calculates audit metrics and builds custom business analyses and scoring categories using Groq."""
    db: Session = db_session_maker()
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        db.close()
        return

    audit = db.query(WebsiteAudit).filter(WebsiteAudit.lead_id == lead_id).first()
    api_key = get_groq_key_for_lead(db, lead)

    # 1. Programmatic Scoring Logic
    # Baseline score is 100. Apply deductions for deficiencies
    score = 100
    deductions = []

    if lead.website_type == "no_website":
        score -= 45
        deductions.append("No Website")
    else:
        if audit:
            if not audit.has_ssl:
                score -= 15
                deductions.append("Missing SSL")
            if not audit.is_mobile_responsive:
                score -= 15
                deductions.append("Not Mobile Responsive")
            if audit.missing_seo:
                score -= 15
                deductions.append("Missing SEO Meta Tags")
            if audit.page_speed_score < 70:
                score -= 10
                deductions.append("Poor Page Speed")
            if not audit.has_contact_form:
                score -= 10
                deductions.append("Missing Contact Form")
            if not audit.has_booking_system:
                score -= 10
                deductions.append("Missing Online Booking")
        else:
            score -= 20
            deductions.append("Audit Incomplete")

    # Reviews-based adjustment
    if lead.reviews_count is not None:
        if lead.reviews_count < 10:
            score -= 10
            deductions.append("Low Reviews (< 10)")
        elif lead.reviews_count < 30:
            score -= 5
            deductions.append("Moderate Reviews (< 30)")
            
    if lead.rating is not None and lead.rating < 4.0:
        score -= 10
        deductions.append("Low rating (< 4.0)")

    # Ensure score falls within 10-100 range
    score = max(10, min(100, score))
    lead.lead_score = score

    # Classify Lead Priority
    if score >= 90:
        lead.lead_score_category = "Hot"
    elif score >= 70:
        lead.lead_score_category = "Warm"
    elif score >= 50:
        lead.lead_score_category = "Medium"
    else:
        lead.lead_score_category = "Low Priority"

    # 2. Call Groq for Business Analysis
    system_prompt = "You are a professional local business growth consultant and website audit expert. Generate concise, actionable reports."
    user_prompt = f"""
Analyze this local business:
Name: {lead.name}
Category: {lead.category}
Rating: {lead.rating} ({lead.reviews_count} reviews)
Has Website: {lead.website_type != 'no_website'}
Website URL: {lead.website or 'N/A'}
Audit Checklist:
- SSL Secure: {audit.has_ssl if audit else False}
- Mobile Responsive: {audit.is_mobile_responsive if audit else False}
- SEO Metas Configured: {not audit.missing_seo if audit else False}
- Speed Score: {audit.page_speed_score if audit else 0}/100
- Has Contact Form: {audit.has_contact_form if audit else False}
- Has Booking Engine: {audit.has_booking_system if audit else False}

Provide a concise response strictly in markdown with these exact headings:
### Business Summary
[Short overview of the business and its local standing]

### Online Presence Analysis
[Key flaws in their website and map visibility]

### Improvement Opportunities
[Numbered list of what to fix]

### Recommended Services
[Services a freelancer/agency can upsell, with estimated project prices]
"""

    analysis_report = ""
    try:
        analysis_report = await call_groq_llm(api_key, system_prompt, user_prompt)
    except Exception:
        # Fallback to local template
        analysis_report = generate_offline_analysis(
            lead.name, lead.category, score, lead.website_type != "no_website"
        )

    if audit:
        audit.audit_report = analysis_report

    # 3. Pre-generate Default Proposal and Outreach
    # Generate outreach templates
    outreach_system = "You are an expert sales copywriter. Write highly personalized local cold outreach copy."
    outreach_user = f"""
Write outreach copy for {lead.name} ({lead.category or 'business'}).
Problems identified: {', '.join(deductions) if deductions else 'minor performance tweaks'}.
Recommended solution: Custom high-converting landing page, local SEO optimization, booking system integration.

Generate the templates and format the output EXACTLY in this JSON structure:
{{
  "email": "write the email content...",
  "linkedin": "write the linkedin message...",
  "whatsapp": "write the whatsapp text...",
  "dm": "write the social media cold dm...",
  "call_script": "write a short cold calling script..."
}}
Ensure the JSON is valid. Do not wrap the JSON in markdown code blocks.
"""
    
    outreach_texts = None
    try:
        outreach_json = await call_groq_llm(api_key, outreach_system, outreach_user)
        # Parse json
        # Clean potential markdown wraps
        cleaned_json = outreach_json.strip()
        if cleaned_json.startswith("```json"):
            cleaned_json = cleaned_json[7:]
        if cleaned_json.endswith("```"):
            cleaned_json = cleaned_json[:-3]
        outreach_texts = json.loads(cleaned_json.strip())
    except Exception:
        outreach_texts = generate_offline_outreach(lead.name, lead.category)

    # Save Outreach
    existing_outreach = db.query(Outreach).filter(Outreach.lead_id == lead.id).first()
    if existing_outreach:
        db.delete(existing_outreach)
        
    outreach_obj = Outreach(
        lead_id=lead.id,
        email_text=outreach_texts.get("email"),
        linkedin_text=outreach_texts.get("linkedin"),
        whatsapp_text=outreach_texts.get("whatsapp"),
        cold_dm_text=outreach_texts.get("dm"),
        cold_call_script=outreach_texts.get("call_script")
    )
    db.add(outreach_obj)

    # Pre-generate Short Proposal
    proposal_system = "You are a professional B2B agency sales representative writing persuasive client proposals."
    proposal_user = f"""
Generate a proposal for {lead.name} ({lead.category or 'business'}).
Core deficiencies: {', '.join(deductions) if deductions else 'performance improvements'}.
Generate a short 1-page proposal. Include project scope, goals, and pricing structure in markdown.
"""
    
    proposal_text = ""
    try:
        proposal_text = await call_groq_llm(api_key, proposal_system, proposal_user)
    except Exception:
        proposal_text = generate_offline_proposal(lead.name, lead.category, "short")

    existing_proposal = db.query(Proposal).filter(
        Proposal.lead_id == lead.id,
        Proposal.format == "short"
    ).first()
    if existing_proposal:
        db.delete(existing_proposal)

    proposal_obj = Proposal(
        lead_id=lead.id,
        format="short",
        proposal_text=proposal_text
    )
    db.add(proposal_obj)

    db.commit()
    db.close()

async def generate_specific_proposal(lead_id: int, format_type: str, db: Session) -> str:
    """Generates on-demand custom proposals based on formats: short, detailed, freelance, agency."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return "Lead not found"

    # Check if already generated
    existing = db.query(Proposal).filter(
        Proposal.lead_id == lead_id,
        Proposal.format == format_type
    ).first()
    if existing:
        return existing.proposal_text

    api_key = get_groq_key_for_lead(db, lead)
    audit = db.query(WebsiteAudit).filter(WebsiteAudit.lead_id == lead_id).first()
    
    system_prompt = f"You are an expert sales writer. Generate a comprehensive {format_type} B2B proposal in markdown."
    user_prompt = f"""
Write a {format_type} proposal for:
Client: {lead.name}
Category: {lead.category}
Website URL: {lead.website or 'No Website'}
Website Score: {lead.lead_score}/100

Format specifics:
- 'short': 1-page high impact summary, scope, and price.
- 'detailed': Full table of contents, technical audits, timeline, credentials, terms, and detailed service tiers.
- 'freelance': Focus on speed, personal relationship, direct line, agility, and competitive pricing.
- 'agency': Focus on a team of specialists, full-service strategy (content, SEO, development), dedicated project managers, and robust service legal agreements.

Ensure the proposal is detailed, beautifully formatted in markdown, and customized for their local industry.
"""

    try:
        proposal_text = await call_groq_llm(api_key, system_prompt, user_prompt)
    except Exception:
        proposal_text = generate_offline_proposal(lead.name, lead.category, format_type)

    new_prop = Proposal(
        lead_id=lead_id,
        format=format_type,
        proposal_text=proposal_text
    )
    db.add(new_prop)
    db.commit()
    return proposal_text
