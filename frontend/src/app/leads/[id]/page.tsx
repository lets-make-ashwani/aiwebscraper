"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  Globe2, Phone, MapPin, Star, ShieldCheck, ShieldAlert, CheckCircle, XCircle, 
  Download, Send, Copy, Check, Sparkles, FileText, ChevronRight, MessageSquare 
} from "lucide-react";
import SidebarLayout from "../../components/SidebarLayout";
import { api } from "../../api";

export default function LeadDetails() {
  const { id } = useParams();
  const leadId = Number(id);

  // States
  const [lead, setLead] = useState<any>(null);
  const [outreach, setOutreach] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Proposal generator states
  const [selectedProposalFormat, setSelectedProposalFormat] = useState("short");
  const [proposalText, setProposalText] = useState("");
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [proposalCache, setProposalCache] = useState<Record<string, string>>({});

  // Active tab state
  const [activeTab, setActiveTab] = useState<"audit" | "proposals" | "outreach">("audit");
  
  // Copy to clipboard state
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeOutreachChannel, setActiveOutreachChannel] = useState<"email" | "linkedin" | "whatsapp" | "dm" | "call">("email");
  const [editedOutreachText, setEditedOutreachText] = useState<string>("");

  useEffect(() => {
    if (!outreach) return;
    let text = "";
    if (activeOutreachChannel === "email") text = outreach.email_text;
    if (activeOutreachChannel === "linkedin") text = outreach.linkedin_text;
    if (activeOutreachChannel === "whatsapp") text = outreach.whatsapp_text;
    if (activeOutreachChannel === "dm") text = outreach.cold_dm_text;
    if (activeOutreachChannel === "call") text = outreach.cold_call_script;
    setEditedOutreachText(text || "");
  }, [outreach, activeOutreachChannel]);

  useEffect(() => {
    if (!leadId) return;

    Promise.all([
      api.getLead(leadId),
      api.getOutreach(leadId).catch(() => null) // Outreach might not exist yet if no website
    ])
      .then(([leadData, outreachData]) => {
        setLead(leadData);
        setOutreach(outreachData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to retrieve lead details.");
        setLoading(false);
      });
  }, [leadId]);

  const handleGenerateProposal = async () => {
    if (proposalCache[selectedProposalFormat]) {
      setProposalText(proposalCache[selectedProposalFormat]);
      return;
    }

    setGeneratingProposal(true);
    try {
      const res = await api.generateProposal(leadId, selectedProposalFormat);
      setProposalText(res.proposal_text);
      setProposalCache(prev => ({
        ...prev,
        [selectedProposalFormat]: res.proposal_text
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI proposal. Please try again.");
    } finally {
      setGeneratingProposal(false);
    }
  };

  // Run on change of format if already loaded once
  useEffect(() => {
    if (proposalCache[selectedProposalFormat]) {
      setProposalText(proposalCache[selectedProposalFormat]);
    } else {
      setProposalText("");
    }
  }, [selectedProposalFormat, proposalCache]);

  const copyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadPDFReport = () => {
    if (!lead) return;
    api.exportPDF(lead.id, lead.name).catch(err => {
      console.error(err);
      alert("Error printing PDF report.");
    });
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Gathering business profiling data...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (error || !lead) {
    return (
      <SidebarLayout>
        <div className="p-6 max-w-xl mx-auto text-center mt-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
          <p className="font-semibold text-lg mb-2">Error Loading Lead</p>
          <p className="text-sm">{error || "Lead profile not found."}</p>
        </div>
      </SidebarLayout>
    );
  }

  const scoreBadgeColor = () => {
    const category = lead.lead_score_category || "";
    if (category.includes("Hot")) return "glow-badge-hot";
    if (category.includes("Warm")) return "glow-badge-warm";
    if (category.includes("Medium")) return "glow-badge-medium";
    return "glow-badge-low";
  };

  const audit = lead.audit;
  const socialLinks = audit?.social_media_links ? JSON.parse(audit.social_media_links) : [];

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Link href="/lead-finder" className="hover:text-primary">Lead Finder</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{lead.name}</span>
        </div>

        {/* Lead Profile Header */}
        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight">{lead.name}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${scoreBadgeColor()}`}>
                {lead.lead_score_category || "Unrated"}
              </span>
              <span className="text-sm font-bold text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                Score: {lead.lead_score || "N/A"}/100
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2 font-medium">
              <span className="bg-secondary px-2.5 py-1 rounded-lg font-bold uppercase">{lead.category || "General"}</span>
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-indigo-500" />
                  {lead.phone}
                </span>
              )}
              {lead.address && (
                <a
                  href={lead.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + lead.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 max-w-sm truncate text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
                  title={`Open location of ${lead.name} in Google Maps: ${lead.address}`}
                >
                  <MapPin className="h-3.5 w-3.5 text-indigo-500 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="hover:underline truncate">{lead.address}</span>
                </a>
              )}
              {lead.rating && (
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                  {lead.rating} ({lead.reviews_count} reviews)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            {lead.website ? (
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-secondary font-bold text-xs transition-colors cursor-pointer"
              >
                <Globe2 className="h-4 w-4 text-indigo-500" />
                Visit Website
              </a>
            ) : (
              <span className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-xs">
                No Website Found
              </span>
            )}
            
            <button
              onClick={downloadPDFReport}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-indigo-500 shadow-md shadow-indigo-600/15 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Download PDF Report
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-border">
          {[
            { id: "audit", label: "Audit & Analysis", icon: ShieldCheck },
            { id: "proposals", label: "AI Proposals", icon: FileText },
            { id: "outreach", label: "AI Cold Outreach", icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                  active 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content 1: Audit */}
        {activeTab === "audit" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tech Scorecard */}
            <div className="glass-card rounded-2xl p-6 border border-border lg:col-span-1 space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Technical Audit Checklist
              </h3>
              
              {audit ? (
                <div className="space-y-4">
                  {[
                    { label: "SSL Certificate Security", ok: audit.has_ssl, desc: audit.has_ssl ? "HTTPS Secure" : "Unsecure HTTP Connection" },
                    { label: "Mobile Responsiveness", ok: audit.is_mobile_responsive, desc: audit.is_mobile_responsive ? "Responsive Layout Viewport" : "Viewport Not Scaled for Mobile" },
                    { label: "Contact Form / Email Capture", ok: audit.has_contact_form, desc: audit.has_contact_form ? "Form/Email Capture Detected" : "No obvious Forms found" },
                    { label: "Call-To-Action (CTA) Presence", ok: audit.has_cta, desc: audit.has_cta ? "Action elements detected" : "Missing key CTA buttons" },
                    { label: "Online Scheduling / Booking", ok: audit.has_booking_system, desc: audit.has_booking_system ? "Integrated booking detected" : "No booking system detected" },
                    { label: "Accessibility Basics (Alt tags)", ok: audit.has_accessibility_basics, desc: audit.has_accessibility_basics ? "Image labels present" : "Images lack description labels" },
                    { label: "SEO Meta Tags Optimization", ok: !audit.missing_seo, desc: !audit.missing_seo ? "SEO Titles configured" : "Title/Description missing" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-start text-xs border-b border-border/40 pb-3">
                      {item.ok ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 pb-4 border-b border-border/40">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">Performance Speed Score</p>
                    <div className="flex flex-col items-center justify-center py-4 bg-slate-900/5 dark:bg-slate-950/20 rounded-2xl border border-border/40">
                      <div className="relative h-28 w-28">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            className="stroke-secondary"
                            strokeWidth="8"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            className={`${
                              audit.page_speed_score >= 80 
                                ? "stroke-emerald-500" 
                                : audit.page_speed_score >= 50 
                                  ? "stroke-amber-500" 
                                  : "stroke-rose-500"
                            } transition-all duration-1000 ease-out`}
                            strokeWidth="8"
                            strokeDasharray="251.2"
                            strokeDashoffset={251.2 - (251.2 * audit.page_speed_score) / 100}
                            strokeLinecap="round"
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-2xl font-extrabold tracking-tight">{audit.page_speed_score}</span>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Index</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-3 text-center">
                        {audit.page_speed_score >= 80 
                          ? "Fast loading speed" 
                          : audit.page_speed_score >= 50 
                            ? "Average performance - optimization recommended" 
                            : "Poor performance - immediate optimization required"}
                      </p>
                    </div>
                  </div>

                  {socialLinks.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-bold text-slate-400 mb-2">Connected Social Links</p>
                      <div className="flex flex-wrap gap-2">
                        {socialLinks.map((item: any, idx: number) => {
                          const link = typeof item === 'string' ? item : item.url;
                          const status = typeof item === 'string' ? 'active' : item.status;
                          
                          let label = "Social";
                          if (link.includes("facebook.com")) label = "Facebook";
                          if (link.includes("instagram.com")) label = "Instagram";
                          if (link.includes("linkedin.com")) label = "LinkedIn";
                          if (link.includes("twitter.com")) label = "Twitter";
                          if (link.includes("youtube.com")) label = "YouTube";
                          
                          return (
                            <div key={idx} className="flex items-center gap-1.5">
                              <a 
                                href={link} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-secondary text-muted-foreground hover:text-primary transition-colors border border-border"
                              >
                                {label}
                              </a>
                              <span 
                                className={`h-2 w-2 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                title={status === 'active' ? 'Profile link is active' : 'Profile link might be broken (404)'}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Emails & Additional Phones */}
                  {(audit.emails || audit.phones) && (
                    <div className="pt-3 border-t border-border/40 space-y-3">
                      <p className="text-xs font-bold text-slate-400">Enriched Website Contacts</p>
                      {audit.emails && (
                        <div className="text-xs space-y-1">
                          <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Emails Found</p>
                          <div className="flex flex-wrap gap-1.5">
                            {audit.emails.split(",").map((email: string, idx: number) => (
                              <span key={idx} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-semibold select-all">
                                {email.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {audit.phones && (
                        <div className="text-xs space-y-1 mt-2">
                          <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Phones Found</p>
                          <div className="flex flex-wrap gap-1.5">
                            {audit.phones.split(",").map((phone: string, idx: number) => (
                              <span key={idx} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold select-all">
                                {phone.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No website audit details compiled.
                </div>
              )}
            </div>
 
            {/* Right-column report and sentiment panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* AI Report Card */}
              <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span>Groq Llama-3 AI Strategic Analysis</span>
                </div>
 
                <div className="prose dark:prose-invert prose-indigo max-w-none text-sm leading-relaxed space-y-4">
                  {audit?.audit_report ? (
                    // Custom rendering of markdown headings for clean premium presentation
                    audit.audit_report.split("\n").map((line: string, i: number) => {
                      if (line.startsWith("### ")) {
                        return (
                          <h4 key={i} className="text-base font-extrabold text-indigo-500 dark:text-indigo-400 pt-3 border-b border-border/30 pb-1">
                            {line.replace("### ", "")}
                          </h4>
                        );
                      }
                      if (line.startsWith("* ") || line.startsWith("- ")) {
                        return (
                          <div key={i} className="flex gap-2 items-start pl-2">
                            <span className="text-primary mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-primary"></span>
                            <span className="text-slate-700 dark:text-slate-300">{line.substring(2)}</span>
                          </div>
                        );
                      }
                      if (line.trim() === "") return <div key={i} className="h-1"></div>;
                      return <p key={i} className="text-slate-600 dark:text-slate-300">{line}</p>;
                    })
                  ) : (
                    <p className="text-muted-foreground italic">No analysis compile report found. Scoring process might be incomplete.</p>
                  )}
                </div>
              </div>
 
              {/* Reviews Sentiment Card */}
              {lead.reviews_sentiment && (
                <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse" />
                    <span>Customer Reviews Sentiment (Google Maps)</span>
                  </div>
                  
                  {lead.reviews_sentiment.summary && (
                    <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-primary/40 pl-3">
                      &ldquo;{lead.reviews_sentiment.summary}&rdquo;
                    </p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Complaints */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold text-rose-500 tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                        Key Complaints
                      </p>
                      <div className="space-y-2">
                        {lead.reviews_sentiment.complaints && lead.reviews_sentiment.complaints.length > 0 ? (
                          lead.reviews_sentiment.complaints.map((item: string, i: number) => (
                            <div key={i} className="flex gap-2 items-start text-xs pl-1">
                              <span className="text-rose-500 font-bold shrink-0">&bull;</span>
                              <span className="text-slate-700 dark:text-slate-300">{item}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic pl-1">No significant complaints reported.</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Praises */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Key Praises
                      </p>
                      <div className="space-y-2">
                        {lead.reviews_sentiment.praises && lead.reviews_sentiment.praises.length > 0 ? (
                          lead.reviews_sentiment.praises.map((item: string, i: number) => (
                            <div key={i} className="flex gap-2 items-start text-xs pl-1">
                              <span className="text-emerald-500 font-bold shrink-0">&bull;</span>
                              <span className="text-slate-700 dark:text-slate-300">{item}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic pl-1">No feedback snippets found.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Proposal Generator */}
        {activeTab === "proposals" && (
          <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">AI proposal Workspace</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a template type to compile a customized proposal using Groq.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedProposalFormat}
                  onChange={(e) => setSelectedProposalFormat(e.target.value)}
                  className="rounded-xl border border-border bg-background py-2 px-3 text-xs font-bold outline-none focus:border-primary"
                >
                  <option value="short">Short Proposal</option>
                  <option value="detailed">Detailed Multi-Tier Proposal</option>
                  <option value="freelance">Agile Freelance Pitch</option>
                  <option value="agency">Full-Service Agency Scope</option>
                </select>
                
                <button
                  onClick={handleGenerateProposal}
                  disabled={generatingProposal}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {generatingProposal ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Compile Pitch
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Proposal display */}
            {proposalText ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => copyText(proposalText, "proposal")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-bold transition-all cursor-pointer"
                  >
                    {copiedField === "proposal" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Proposal
                      </>
                    )}
                  </button>
                </div>
                
                <div className="p-6 rounded-xl border border-border bg-slate-900/5 dark:bg-slate-950/40 prose dark:prose-invert prose-indigo max-w-none text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto font-mono">
                  {proposalText}
                </div>
              </div>
            ) : (
              <div className="py-12 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p>Click &quot;Compile Pitch&quot; to draft the proposal via Groq AI.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 3: Outreach */}
        {activeTab === "outreach" && (
          <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
            <div>
              <h3 className="text-lg font-bold">Multi-Channel Outreach Workbench</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Copy pre-formatted cold outreach scripts tailored for specific messaging platforms.
              </p>
            </div>

            {outreach ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Channels tabs */}
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4">
                  {[
                    { id: "email", label: "Cold Email" },
                    { id: "linkedin", label: "LinkedIn Connection" },
                    { id: "whatsapp", label: "WhatsApp Chat" },
                    { id: "dm", label: "Cold Social DM" },
                    { id: "call", label: "Cold Call Script" },
                  ].map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setActiveOutreachChannel(channel.id as any)}
                      className={`text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer truncate shrink-0 ${
                        activeOutreachChannel === channel.id
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {channel.label}
                    </button>
                  ))}
                </div>

                {/* Script Pane */}
                <div className="md:col-span-3 space-y-4">
                  <div className="flex justify-between items-center bg-secondary/20 p-2.5 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Interactive script editor (Customize before copying)
                    </span>
                    <button
                      onClick={() => copyText(editedOutreachText, activeOutreachChannel)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-indigo-500 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      {copiedField === activeOutreachChannel ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Template
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={editedOutreachText}
                    onChange={(e) => setEditedOutreachText(e.target.value)}
                    rows={12}
                    className="w-full p-4 rounded-xl border border-border bg-slate-900/5 dark:bg-slate-950/40 text-sm leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y font-mono"
                    placeholder="Outreach copy could not be drafted for this format."
                  />
                </div>
              </div>
            ) : (
              <div className="py-12 border border-dashed border-border rounded-xl text-center text-sm text-muted-foreground">
                <Send className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p>No outreach templates found. Ensure website audits run successfully.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

// React Loader2 helper
function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={`animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
