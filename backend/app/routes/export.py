import io
import csv
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fpdf import FPDF
from typing import Optional

from backend.app.db.session import get_db
from backend.app.db.models import Lead, User
from backend.app.routes.auth import get_current_user

router = APIRouter(prefix="/export", tags=["export"])

def clean_string_for_pdf(text: str) -> str:
    """Replaces Unicode smart quotes and bullet points with PDF-safe equivalents."""
    if not text:
        return ""
    text = text.replace('\u201c', '"').replace('\u201d', '"')
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    text = text.replace('\u2014', "-").replace('\u2013', "-")
    text = text.replace('\u2022', "*")
    return text.encode('latin-1', 'replace').decode('latin-1')

@router.get("/csv")
def export_leads_csv(
    search_history_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    # Get user search history ids
    histories = list(db.search_histories.find({"user_id": current_user.id}))
    history_ids = [h["_id"] for h in histories]

    if not history_ids:
        leads = []
    else:
        filters = {"search_history_id": {"$in": history_ids}}
        if search_history_id is not None:
            if search_history_id not in history_ids:
                return StreamingResponse(io.BytesIO(b""), media_type="text/csv")
            filters["search_history_id"] = search_history_id
        
        leads_cursor = db.leads.find(filters)
        leads = [Lead(l) for l in leads_cursor]
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Name", "Phone", "Website", "Address", "Rating", 
        "Reviews Count", "Category", "Website Type", "Lead Score", 
        "Score Category", "CRM Status", "Notes", "Tags", "Created At"
    ])
    
    for l in leads:
        created_at_str = l.created_at.strftime("%Y-%m-%d") if isinstance(l.created_at, datetime) else str(l.created_at)[:10]
        writer.writerow([
            l.id, l.name, l.phone or "", l.website or "", l.address or "",
            l.rating or 0.0, l.reviews_count or 0, l.category or "",
            l.website_type, l.lead_score or "", l.lead_score_category or "",
            l.status, l.notes or "", l.tags or "", created_at_str
        ])
        
    output.seek(0)
    
    headers = {"Content-Disposition": "attachment; filename=leads_export.csv"}
    return StreamingResponse(io.BytesIO(output.getvalue().encode("utf-8")), media_type="text/csv", headers=headers)

@router.get("/excel")
def export_leads_excel(
    search_history_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    # Get user search history ids
    histories = list(db.search_histories.find({"user_id": current_user.id}))
    history_ids = [h["_id"] for h in histories]

    if not history_ids:
        leads = []
    else:
        filters = {"search_history_id": {"$in": history_ids}}
        if search_history_id is not None:
            if search_history_id not in history_ids:
                return StreamingResponse(io.BytesIO(b""), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            filters["search_history_id"] = search_history_id
            
        leads_cursor = db.leads.find(filters)
        leads = [Lead(l) for l in leads_cursor]
    
    data = []
    for l in leads:
        created_at_str = l.created_at.strftime("%Y-%m-%d") if hasattr(l.created_at, "strftime") else str(l.created_at)[:10]
        data.append({
            "ID": l.id,
            "Name": l.name,
            "Phone": l.phone or "",
            "Website": l.website or "",
            "Address": l.address or "",
            "Rating": l.rating or 0.0,
            "Reviews Count": l.reviews_count or 0,
            "Category": l.category or "",
            "Website Type": l.website_type,
            "Lead Score": l.lead_score or 0,
            "Score Category": l.lead_score_category or "Unscored",
            "CRM Status": l.status,
            "Notes": l.notes or "",
            "Tags": l.tags or "",
            "Created At": created_at_str
        })
        
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Leads", index=False)
        
    output.seek(0)
    
    headers = {"Content-Disposition": "attachment; filename=leads_export.xlsx"}
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers=headers
    )

@router.get("/pdf/{lead_id}")
def export_lead_pdf(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    lead_data = db.leads.find_one({"_id": lead_id})
    if not lead_data:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    history = db.search_histories.find_one({"_id": lead_data["search_history_id"], "user_id": current_user.id})
    if not history:
        raise HTTPException(status_code=403, detail="Not authorized to access this lead")
        
    lead = Lead(lead_data)
    # The WebsiteAudit document is stored directly inside the Lead document under the "audit" key!
    audit = lead.audit
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Theme primary colors
    # Navy primary, charcoal body
    
    # Title Block
    company_name = current_user.company_name or "LEADFORGE AI"
    pdf.set_font("helvetica", "B", 24)
    pdf.set_text_color(17, 24, 39) # Tailwind Gray 900
    pdf.cell(0, 15, clean_string_for_pdf(company_name.upper()), new_x="LMARGIN", new_y="NEXT", align="C")
    
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(99, 102, 241) # Indigo-500
    pdf.cell(0, 10, clean_string_for_pdf("Website Audit & Strategic Growth Report"), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(5)
    
    # Separator
    pdf.set_draw_color(229, 231, 235) # Gray 200
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(10)
    
    # Business Details Section
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 8, clean_string_for_pdf("1. Target Business Profile"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(55, 65, 81) # Gray 700
    
    details = [
        ("Business Name:", lead.name),
        ("Industry Category:", lead.category or "N/A"),
        ("Phone Number:", lead.phone or "N/A"),
        ("Website URL:", lead.website or "No Website"),
        ("Google Maps rating:", f"{lead.rating or 0.0} ({lead.reviews_count or 0} reviews)"),
        ("Lead Priority Status:", f"{lead.lead_score_category or 'Unscored'} (Health Index: {lead.lead_score or 'N/A'}/100)")
    ]
    
    for label, val in details:
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(45, 6, clean_string_for_pdf(label))
        pdf.set_font("helvetica", "", 10)
        pdf.cell(0, 6, clean_string_for_pdf(str(val)), new_x="LMARGIN", new_y="NEXT")
        
    pdf.ln(8)
    
    # Audit Metrics Table
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 8, clean_string_for_pdf("2. Technical SEO Checklist"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    if audit:
        checklist = [
            ("Mobile Responsiveness Check", "Pass (Mobile-Ready)" if audit.is_mobile_responsive else "Fail (Responsive Required)"),
            ("SSL Certificate Security", "Pass (HTTPS Secure)" if audit.has_ssl else "Fail (HTTP Insecure)"),
            ("Contact Form & Lead Capture", "Available" if audit.has_contact_form else "Missing / None Detected"),
            ("Clear Call-To-Action (CTA)", "Available" if audit.has_cta else "Missing / None Detected"),
            ("SEO Optimization Indicators", "Available" if not audit.missing_seo else "Action Required (Bad Metadata)"),
            ("Page Performance Speed Rating", f"{audit.page_speed_score}/100"),
            ("Basic Accessibility Alt Tags", "Compliant" if audit.has_accessibility_basics else "Non-Compliant"),
            ("Online Booking Integrations", "Available" if audit.has_booking_system else "Missing / None Detected")
        ]
        
        pdf.set_font("helvetica", "B", 10)
        pdf.set_fill_color(243, 244, 246) # Gray 100
        pdf.cell(100, 8, "Metric Checked", border=1, fill=True)
        pdf.cell(0, 8, "Technical Status", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")
        
        pdf.set_font("helvetica", "", 10)
        for metric, status in checklist:
            pdf.cell(100, 7, clean_string_for_pdf(metric), border=1)
            
            if "Fail" in status or "Missing" in status or "Non-Compliant" in status:
                pdf.set_text_color(220, 38, 38) # Red
            elif "Pass" in status or "Available" in status or "Compliant" in status:
                pdf.set_text_color(22, 163, 74) # Green
            else:
                pdf.set_text_color(55, 65, 81)
                
            pdf.cell(0, 7, clean_string_for_pdf(status), border=1, new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(55, 65, 81) # reset
    else:
        pdf.set_font("helvetica", "I", 10)
        pdf.cell(0, 6, "No website audit history available for this lead.", new_x="LMARGIN", new_y="NEXT")
        
    pdf.ln(8)
    
    # Audit Report Text (Markdown-based)
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 8, clean_string_for_pdf("3. Strategic Action Plan (AI Analysis)"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(55, 65, 81)
    
    report_text = audit.audit_report if (audit and audit.audit_report) else "No strategic analysis available."
    report_text = clean_string_for_pdf(report_text)
    
    # Parse Markdown headings/lists slightly for printing
    lines = report_text.split("\n")
    for line in lines:
        if line.startswith("### "):
            pdf.ln(2)
            pdf.set_font("helvetica", "B", 11)
            pdf.set_text_color(99, 102, 241) # Indigo
            pdf.cell(0, 6, line.replace("### ", "").strip(), new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("helvetica", "", 10)
            pdf.set_text_color(55, 65, 81)
        elif line.startswith("* ") or line.startswith("- "):
            pdf.cell(5, 5, "* ")
            pdf.multi_cell(0, 5, line[2:].strip(), new_x="LMARGIN", new_y="NEXT")
        elif line.strip() == "":
            pdf.ln(2)
        else:
            pdf.multi_cell(0, 5, line.strip(), new_x="LMARGIN", new_y="NEXT")
            
    pdf_bytes = pdf.output()
    
    headers = {"Content-Disposition": f"attachment; filename=lead_audit_{lead_id}.pdf"}
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers
    )

