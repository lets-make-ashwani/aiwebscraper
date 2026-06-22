"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Plus, Calendar, Tag, FileEdit, ArrowLeft, ArrowRight, UserPlus, Star, Save, X, MapPin
} from "lucide-react";
import SidebarLayout from "../components/SidebarLayout";
import { api } from "../api";

const PIPELINE_COLUMNS = [
  "New",
  "Qualified",
  "Contacted",
  "Meeting Scheduled",
  "Proposal Sent",
  "Won",
  "Lost"
];

export default function CRMPipeline() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterParam, setFilterParam] = useState<string | null>(null);
  const [categoryParam, setCategoryParam] = useState<string | null>(null);
  const [searchParam, setSearchParam] = useState<string | null>(null);
  const [activeMobileCol, setActiveMobileCol] = useState("New");

  // Checklist mode for campaign creation
  const [checklistMode, setChecklistMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignChannel, setCampaignChannel] = useState("whatsapp");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const toggleSelectLead = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName) return;
    setCreatingCampaign(true);
    try {
      await api.createCampaign({
        name: campaignName,
        outreach_channel: campaignChannel,
        lead_ids: selectedLeads
      });
      window.location.href = "/campaigns";
    } catch (err) {
      console.error(err);
      alert("Failed to launch campaign.");
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleCardClick = (lead: any) => {
    if (checklistMode) {
      toggleSelectLead(lead.id);
    } else {
      openEditDrawer(lead);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setFilterParam(params.get("filter"));
      setCategoryParam(params.get("category"));
      setSearchParam(params.get("search"));
    }
  }, []);
  
  // Drawer editor state
  const [editingLead, setEditingLead] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [crmStatus, setCrmStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchLeads = async () => {
    try {
      const data = await api.getLeads();
      setLeads(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch leads for CRM:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleShiftStatus = async (leadId: number, currentStatus: string, direction: "left" | "right") => {
    const currentIndex = PIPELINE_COLUMNS.indexOf(currentStatus);
    let newIndex = currentIndex;
    
    if (direction === "left" && currentIndex > 0) newIndex--;
    if (direction === "right" && currentIndex < PIPELINE_COLUMNS.length - 1) newIndex++;
    
    if (newIndex === currentIndex) return;
    const nextStatus = PIPELINE_COLUMNS[newIndex];

    // Optimistic UI update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: nextStatus } : l));

    try {
      await api.updateLeadCRM(leadId, { status: nextStatus });
    } catch (err) {
      console.error(err);
      alert("Failed to update status. Reverting changes.");
      fetchLeads(); // roll back
    }
  };

  const openEditDrawer = (lead: any) => {
    setEditingLead(lead);
    setNotes(lead.notes || "");
    setTags(lead.tags || "");
    setFollowUpDate(lead.follow_up_date ? new Date(lead.follow_up_date).toISOString().substring(0, 10) : "");
    setCrmStatus(lead.status);
  };

  const closeEditDrawer = () => {
    setEditingLead(null);
  };

  const handleSaveCRMDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    setSaving(true);

    try {
      const updated = await api.updateLeadCRM(editingLead.id, {
        status: crmStatus,
        notes: notes,
        tags: tags,
        follow_up_date: followUpDate ? new Date(followUpDate) : null
      });

      // Update local state
      setLeads(prev => prev.map(l => l.id === editingLead.id ? updated : l));
      closeEditDrawer();
    } catch (err) {
      console.error(err);
      alert("Failed to save CRM updates.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Opening pipeline drawer...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Group leads by status, taking filters into account
  const getFilteredLeads = () => {
    let result = leads;

    if (categoryParam) {
      const catLower = categoryParam.toLowerCase();
      result = result.filter(l => l.category && l.category.toLowerCase().includes(catLower));
    }

    if (searchParam) {
      const qLower = searchParam.toLowerCase();
      result = result.filter(l => 
        (l.name && l.name.toLowerCase().includes(qLower)) ||
        (l.category && l.category.toLowerCase().includes(qLower)) ||
        (l.address && l.address.toLowerCase().includes(qLower))
      );
    }

    if (filterParam) {
      if (filterParam === "qualified") {
        result = result.filter(l => 
          ["Qualified", "Contacted", "Meeting Scheduled", "Proposal Sent", "Won"].includes(l.status) ||
          ["Hot", "Warm"].includes(l.lead_score_category)
        );
      } else if (filterParam === "unqualified") {
        result = result.filter(l => 
          l.status === "Lost" ||
          (l.status === "New" && (!l.lead_score_category || ["Medium", "Low Priority"].includes(l.lead_score_category)))
        );
      } else if (filterParam === "audited") {
        result = result.filter(l => l.audit_status === "audited");
      } else if (filterParam === "outreach") {
        result = result.filter(l => l.website_type !== "no_website");
      } else if (filterParam === "hot") {
        result = result.filter(l => l.lead_score_category?.toLowerCase().startsWith("hot"));
      } else if (filterParam === "warm") {
        result = result.filter(l => l.lead_score_category?.toLowerCase().startsWith("warm"));
      } else if (filterParam === "medium") {
        result = result.filter(l => l.lead_score_category?.toLowerCase().startsWith("medium"));
      } else if (filterParam === "low") {
        result = result.filter(l => 
          l.lead_score_category?.toLowerCase().startsWith("low") || 
          !l.lead_score_category
        );
      }
    }
    
    return result;
  };

  const filteredLeads = getFilteredLeads();
  const leadsByStatus = PIPELINE_COLUMNS.reduce((acc, col) => {
    acc[col] = filteredLeads.filter(l => l.status === col);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <SidebarLayout>
      <div className="space-y-8 h-full flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">CRM Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Drag-and-manage local leads. Update statuses, track call notes, and schedule follow-ups.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setChecklistMode(!checklistMode);
                setSelectedLeads([]);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer \${
                checklistMode
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-secondary/60 hover:bg-secondary border-border text-foreground"
              }`}
            >
              {checklistMode ? "Disable Campaign Mode" : "Bulk Campaign Mode"}
            </button>
            <Link
              href="/campaigns"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary/60 hover:bg-secondary border border-border text-foreground flex items-center gap-1.5"
            >
              View Campaigns
            </Link>
          </div>
        </div>

        {(filterParam || categoryParam || searchParam) && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span>
                Showing filtered view:{" "}
                <strong className="uppercase">
                  {filterParam 
                    ? filterParam.replace("_", " ") 
                    : categoryParam 
                      ? `Category: ${categoryParam}` 
                      : `Search: ${searchParam}`}
                </strong>{" "}
                leads
              </span>
            </div>
            <Link 
              href="/crm" 
              onClick={() => {
                setFilterParam(null);
                setCategoryParam(null);
                setSearchParam(null);
              }}
              className="text-primary hover:text-indigo-400 font-bold underline transition-colors"
            >
              Clear Filter
            </Link>
          </div>
        )}

        {/* Mobile Column Selector (Pills) */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-3 scrollbar-none shrink-0">
          {PIPELINE_COLUMNS.map((col) => {
            const count = leadsByStatus[col]?.length || 0;
            const active = activeMobileCol === col;
            return (
              <button
                key={col}
                type="button"
                onClick={() => setActiveMobileCol(col)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  active
                    ? "bg-primary border-primary text-primary-foreground shadow-md shadow-indigo-600/10 scale-105"
                    : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {col} ({count})
              </button>
            );
          })}
        </div>

        {/* Mobile Kanban Column View */}
        <div className="md:hidden flex-1 overflow-y-auto pb-6">
          <div className="rounded-2xl bg-secondary/10 border border-border/40 p-4 min-h-[40vh] flex flex-col">
            {/* Column Header */}
            <div className="flex justify-between items-center mb-4 shrink-0 pb-2 border-b border-border/40">
              <span className="font-extrabold text-sm uppercase tracking-wider text-primary">
                {activeMobileCol}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-secondary text-foreground">
                {(leadsByStatus[activeMobileCol] || []).length} leads
              </span>
            </div>

            {/* Leads list */}
            <div className="space-y-3 flex-1">
              {(leadsByStatus[activeMobileCol] || []).length === 0 ? (
                <div className="h-40 border border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <p>No leads in {activeMobileCol}</p>
                </div>
              ) : (
                (leadsByStatus[activeMobileCol] || []).map((lead) => (
                  <div 
                    key={lead.id}
                    className={`glass-card rounded-xl p-4 border transition-all cursor-pointer relative group \${
                      selectedLeads.includes(lead.id) ? "border-indigo-500 bg-indigo-500/5" : "border-border"
                    } hover:shadow-md`}
                    onClick={() => handleCardClick(lead)}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 max-w-[80%]">
                          {checklistMode && (
                            <input
                              type="checkbox"
                              checked={selectedLeads.includes(lead.id)}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                            />
                          )}
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1 truncate group-hover:text-primary">
                            {lead.name}
                          </h4>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                          lead.lead_score_category?.startsWith("Hot") 
                            ? "glow-badge-hot" 
                            : lead.lead_score_category?.startsWith("Warm") 
                              ? "glow-badge-warm" 
                              : lead.lead_score_category?.startsWith("Medium")
                                ? "glow-badge-medium"
                                : "glow-badge-low"
                        }`}>
                          {lead.lead_score || "N/A"}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-muted-foreground truncate uppercase font-bold tracking-wider">
                        {lead.category || "General"}
                      </p>

                      {lead.address && (
                        <div 
                          className="flex items-center gap-1 text-[11px] text-muted-foreground max-w-full truncate"
                          onClick={(e) => {
                            e.stopPropagation();
                            const mapUrl = lead.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + lead.address)}`;
                            window.open(mapUrl, "_blank");
                          }}
                        >
                          <MapPin className="h-3 w-3 text-indigo-500 shrink-0" />
                          <span className="hover:text-primary hover:underline cursor-pointer truncate" title={lead.address}>
                            {lead.address}
                          </span>
                        </div>
                      )}

                      {/* Small lead score progress bar */}
                      {lead.lead_score !== null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                            <span>Health Index</span>
                            <span>{lead.lead_score}/100</span>
                          </div>
                          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                lead.lead_score >= 90 
                                  ? "bg-emerald-500" 
                                  : lead.lead_score >= 70 
                                    ? "bg-amber-500" 
                                    : lead.lead_score >= 50
                                      ? "bg-blue-500"
                                      : "bg-slate-400"
                              }`}
                              style={{ width: `${lead.lead_score}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Tags list */}
                      {lead.tags && (
                        <div className="flex flex-wrap gap-1">
                          {lead.tags.split(",").slice(0, 2).map((t: string, i: number) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded font-semibold border border-border/40">
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Follow-up Indicator */}
                      {lead.follow_up_date && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                          <Calendar className="h-3 w-3" />
                          {new Date(lead.follow_up_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Quick movement controls */}
                    <div className="flex items-center justify-between border-t border-border/40 mt-3 pt-2 text-[10px] text-muted-foreground" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleShiftStatus(lead.id, lead.status, "left")}
                        disabled={activeMobileCol === "New"}
                        className="p-1 rounded hover:bg-secondary disabled:opacity-30 cursor-pointer"
                        title="Move Left"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <Link 
                        href={`/leads/${lead.id}`}
                        className="font-bold hover:text-primary transition-colors text-[10px] tracking-tight uppercase"
                      >
                        View Audit
                      </Link>
                      <button
                        onClick={() => handleShiftStatus(lead.id, lead.status, "right")}
                        disabled={activeMobileCol === "Lost"}
                        className="p-1 rounded hover:bg-secondary disabled:opacity-30 cursor-pointer"
                        title="Move Right"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kanban Board Area (Desktop) */}
        <div className="flex-1 overflow-x-auto pb-6 hidden md:block">
          <div className="flex gap-4 min-w-[1200px] h-[calc(100vh-230px)]">
            {PIPELINE_COLUMNS.map((col) => {
              const columnLeads = leadsByStatus[col] || [];
              return (
                <div 
                  key={col}
                  className="w-80 rounded-2xl bg-secondary/30 border border-border/50 p-4 flex flex-col h-full shrink-0"
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      {col}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-secondary text-foreground">
                      {columnLeads.length}
                    </span>
                  </div>

                  {/* Column Leads Scroll Container */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {columnLeads.length === 0 ? (
                      <div className="h-24 border border-dashed border-border/60 rounded-xl flex items-center justify-center text-xs text-muted-foreground">
                        No leads in {col}
                      </div>
                    ) : (
                      columnLeads.map((lead) => (
                        <div 
                          key={lead.id}
                          className={`glass-card rounded-xl p-4 border transition-all cursor-pointer relative group \${
                            selectedLeads.includes(lead.id) ? "border-indigo-500 bg-indigo-500/5" : "border-border"
                          } hover:shadow-md`}
                          onClick={() => handleCardClick(lead)}
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2 max-w-[80%]">
                                {checklistMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedLeads.includes(lead.id)}
                                    onChange={() => {}}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                                  />
                                )}
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1 truncate group-hover:text-primary">
                                  {lead.name}
                                </h4>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                                lead.lead_score_category?.startsWith("Hot") 
                                  ? "glow-badge-hot" 
                                  : lead.lead_score_category?.startsWith("Warm") 
                                    ? "glow-badge-warm" 
                                    : lead.lead_score_category?.startsWith("Medium")
                                      ? "glow-badge-medium"
                                      : "glow-badge-low"
                              }`}>
                                {lead.lead_score || "N/A"}
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-muted-foreground truncate uppercase font-bold tracking-wider">
                              {lead.category || "General"}
                            </p>

                            {lead.address && (
                              <div 
                                className="flex items-center gap-1 text-[11px] text-muted-foreground max-w-full truncate"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const mapUrl = lead.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + lead.address)}`;
                                  window.open(mapUrl, "_blank");
                                }}
                              >
                                <MapPin className="h-3 w-3 text-indigo-500 shrink-0" />
                                <span className="hover:text-primary hover:underline cursor-pointer truncate" title={lead.address}>
                                  {lead.address}
                                </span>
                              </div>
                            )}

                            {/* Small lead score progress bar */}
                            {lead.lead_score !== null && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                                  <span>Health Index</span>
                                  <span>{lead.lead_score}/100</span>
                                </div>
                                <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${
                                      lead.lead_score >= 90 
                                        ? "bg-emerald-500" 
                                        : lead.lead_score >= 70 
                                          ? "bg-amber-500" 
                                          : lead.lead_score >= 50
                                            ? "bg-blue-500"
                                            : "bg-slate-400"
                                    }`}
                                    style={{ width: `${lead.lead_score}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}

                            {/* Tags list */}
                            {lead.tags && (
                              <div className="flex flex-wrap gap-1">
                                {lead.tags.split(",").slice(0, 2).map((t: string, i: number) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded font-semibold border border-border/40">
                                    {t.trim()}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Follow-up Indicator */}
                            {lead.follow_up_date && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                                <Calendar className="h-3 w-3" />
                                {new Date(lead.follow_up_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {/* Quick movement controls */}
                          <div className="flex items-center justify-between border-t border-border/40 mt-3 pt-2 text-[10px] text-muted-foreground" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleShiftStatus(lead.id, lead.status, "left")}
                              disabled={col === "New"}
                              className="p-1 rounded hover:bg-secondary disabled:opacity-30 cursor-pointer"
                              title="Move Left"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                            <Link 
                              href={`/leads/${lead.id}`}
                              className="font-bold hover:text-primary transition-colors text-[10px] tracking-tight uppercase"
                            >
                              View Audit
                            </Link>
                            <button
                              onClick={() => handleShiftStatus(lead.id, lead.status, "right")}
                              disabled={col === "Lost"}
                              className="p-1 rounded hover:bg-secondary disabled:opacity-30 cursor-pointer"
                              title="Move Right"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Drawer Modal */}
        {editingLead && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Drawer Overlay */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEditDrawer}></div>

            {/* Drawer Panel */}
            <div className="relative w-full max-w-md bg-background border-l border-border h-full flex flex-col p-6 shadow-2xl z-50">
              <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">
                    Lead CRM Manager
                  </h3>
                  <p className="text-xs text-muted-foreground">{editingLead.name}</p>
                </div>
                <button 
                  onClick={closeEditDrawer}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveCRMDetails} className="flex-1 overflow-y-auto py-6 space-y-6">
                {/* Lead Profiling info card */}
                <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-muted-foreground">Lead Profiling</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 uppercase">
                      {editingLead.category || "General"}
                    </span>
                  </div>
                  
                  {editingLead.rating && (
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                      <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                      <span>{editingLead.rating} ({editingLead.reviews_count} reviews)</span>
                    </div>
                  )}

                  {editingLead.phone && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                      <span className="text-muted-foreground font-medium text-[10px] uppercase">Phone:</span>
                      <span>{editingLead.phone}</span>
                    </div>
                  )}

                  {editingLead.address && (
                    <div className="space-y-1.5 pt-1.5 border-t border-border/40">
                      <span className="text-muted-foreground font-medium text-[10px] uppercase block">Location:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 leading-normal">{editingLead.address}</p>
                      
                      <a
                        href={editingLead.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editingLead.name + ' ' + editingLead.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-indigo-500 hover:text-indigo-400 font-bold mt-1.5 hover:underline cursor-pointer"
                      >
                        <MapPin className="h-4 w-4" />
                        View Exact Location on Google Maps
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Pipeline Stage
                  </label>
                  <select
                    value={crmStatus}
                    onChange={(e) => setCrmStatus(e.target.value)}
                    className="block w-full rounded-xl border border-border bg-background py-2.5 px-3 text-sm outline-none focus:border-primary"
                  >
                    {PIPELINE_COLUMNS.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Custom Tags (Comma Separated)
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Tag className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="e.g. Redesign, SEO Campaign, Hot Call"
                      className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Follow-Up Date
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Conversation Notes
                  </label>
                  <textarea
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter phone conversation logs, pricing discussions, or custom deal information..."
                    className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-3 px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {saving ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save CRM Settings
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Floating Campaign Bar */}
        {checklistMode && selectedLeads.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900 border border-indigo-500/30 text-white py-3.5 px-6 rounded-2xl flex items-center gap-6 shadow-2xl shadow-indigo-500/10 animate-in fade-in slide-in-from-bottom-4">
            <span className="text-xs font-bold text-slate-300">
              <strong className="text-indigo-400">{selectedLeads.length}</strong> leads selected for campaign
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCampaignModalOpen(true)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                Create Campaign
              </button>
              <button
                type="button"
                onClick={() => setSelectedLeads([])}
                className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Campaign Settings Launch Modal */}
        {campaignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCampaignModalOpen(false)}></div>
            <div className="relative w-full max-w-md bg-background border border-border rounded-2xl p-6 shadow-2xl z-50 space-y-6">
              <div>
                <h3 className="font-extrabold text-lg">Create Outreach Campaign</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Launch a messaging campaign for the {selectedLeads.length} selected leads.
                </p>
              </div>

              <form onSubmit={handleLaunchCampaign} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. WhatsApp Pitch for CA Locals"
                    className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Outreach Channel
                  </label>
                  <select
                    value={campaignChannel}
                    onChange={(e) => setCampaignChannel(e.target.value)}
                    className="block w-full rounded-xl border border-border bg-background py-2.5 px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="whatsapp">WhatsApp Outreach (Playwright Session)</option>
                    <option value="email">Email Outreach (Simulated SMTP)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setCampaignModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-secondary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingCampaign || !campaignName}
                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {creatingCampaign ? "Launching..." : "Launch Campaign"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
