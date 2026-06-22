"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Play, Pause, Trash2, ArrowLeft, Send, CheckCircle2, XCircle, Loader2, MessageSquare, Mail, RefreshCw, ChevronRight, Clock
} from "lucide-react";
import SidebarLayout from "../components/SidebarLayout";
import { api } from "../api";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected campaign details
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [pollingLogs, setPollingLogs] = useState(false);

  const fetchCampaigns = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      setLoading(false);
    }
  };

  const fetchQueueItems = async (campaignId: number, quiet = false) => {
    if (!quiet) setLoadingQueue(true);
    try {
      const data = await api.getCampaignQueue(campaignId);
      setQueueItems(data);
      setLoadingQueue(false);
    } catch (err) {
      console.error("Failed to fetch queue items:", err);
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Poll active running campaigns for real-time progress updates
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === "running");
    if (!hasRunning) return;

    const interval = setInterval(() => {
      fetchCampaigns(true);
      if (selectedCampaign && selectedCampaign.status === "running") {
        fetchQueueItems(selectedCampaign.id, true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns, selectedCampaign]);

  const handleSelectCampaign = (c: any) => {
    setSelectedCampaign(c);
    fetchQueueItems(c.id);
  };

  const handlePause = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.pauseCampaign(id);
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c));
      if (selectedCampaign && selectedCampaign.id === id) {
        setSelectedCampaign(updated);
      }
    } catch (err) {
      alert("Failed to pause campaign.");
    }
  };

  const handleResume = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.resumeCampaign(id);
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c));
      if (selectedCampaign && selectedCampaign.id === id) {
        setSelectedCampaign(updated);
      }
    } catch (err) {
      alert("Failed to resume campaign.");
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this campaign? This will remove all queue records.")) return;
    try {
      await api.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      if (selectedCampaign && selectedCampaign.id === id) {
        setSelectedCampaign(null);
        setQueueItems([]);
      }
    } catch (err) {
      alert("Failed to delete campaign.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return "bg-indigo-500/10 border-indigo-500/20 text-indigo-500 font-bold uppercase animate-pulse";
      case "paused":
        return "bg-amber-500/10 border-amber-500/20 text-amber-500 font-bold uppercase";
      case "completed":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold uppercase";
      case "failed":
        return "bg-rose-500/10 border-rose-500/20 text-rose-500 font-bold uppercase";
      default:
        return "bg-secondary text-muted-foreground font-bold uppercase";
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-8 max-w-6xl">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Link href="/crm" className="hover:text-primary">CRM Pipeline</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Outreach Campaigns</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Outreach Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor active WhatsApp & Email automation campaigns, pause operations, and check delivery logs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchCampaigns()}
            className="px-4 py-2 bg-secondary/60 hover:bg-secondary border border-border text-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh List
          </button>
        </div>

        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-24 border border-dashed border-border rounded-2xl text-center space-y-4 max-w-md mx-auto">
            <Send className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-base font-bold">No outreach campaigns created</h3>
            <p className="text-xs text-muted-foreground">
              To launch an automated campaign, navigate to the CRM Pipeline, enable <b>Bulk Campaign Mode</b>, select your target leads, and click create campaign.
            </p>
            <Link
              href="/crm"
              className="inline-flex py-2 px-4 bg-primary text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors"
            >
              Go to CRM Pipeline
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left side: Campaigns list */}
            <div className="lg:col-span-3 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Campaigns</h3>
              <div className="space-y-3">
                {campaigns.map((c) => {
                  const percent = c.leads_count > 0 ? Math.round(((c.sent_count + c.failed_count) / c.leads_count) * 100) : 0;
                  const isSelected = selectedCampaign?.id === c.id;
                  
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCampaign(c)}
                      className={`glass-card rounded-2xl p-5 border transition-all cursor-pointer hover:shadow-md relative overflow-hidden ${
                        isSelected ? "border-primary/80 ring-1 ring-primary/20" : "border-border"
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-primary">
                              {c.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1.5">
                              {c.outreach_channel === "whatsapp" ? (
                                <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                  <MessageSquare className="h-3 w-3" />
                                  WhatsApp
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-blue-500 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                  <Mail className="h-3 w-3" />
                                  Email
                                </span>
                              )}
                              <span>• Created {new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${getStatusBadge(c.status)}`}>
                              {c.status}
                            </span>
                            
                            {c.status === "running" && (
                              <button
                                onClick={(e) => handlePause(c.id, e)}
                                className="p-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Pause Campaign"
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {c.status === "paused" && (
                              <button
                                onClick={(e) => handleResume(c.id, e)}
                                className="p-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Resume Campaign"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(c.id, e)}
                              className="p-1.5 rounded-lg border border-border bg-background hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 cursor-pointer"
                              title="Delete Campaign"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar & statistics */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>Campaign Dispatch Progress</span>
                            <span>{c.sent_count + c.failed_count} / {c.leads_count} ({percent}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                c.status === "failed" ? "bg-rose-500" : percent === 100 ? "bg-emerald-500" : "bg-indigo-500"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex gap-4 text-[10px] font-semibold text-muted-foreground pt-1">
                            <span className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {c.sent_count} Sent
                            </span>
                            <span className="flex items-center gap-1 text-rose-500">
                              <XCircle className="h-3.5 w-3.5" />
                              {c.failed_count} Failed
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Clock className="h-3.5 w-3.5" />
                              {c.leads_count - (c.sent_count + c.failed_count)} Pending
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right side: Detailed queue logs */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Outreach Queue Logs</h3>
              
              {selectedCampaign ? (
                <div className="glass-card rounded-2xl p-5 border border-border h-[calc(100vh-270px)] flex flex-col space-y-4">
                  <div className="border-b border-border/60 pb-3 shrink-0">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{selectedCampaign.name}</h4>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">Campaign ID: #{selectedCampaign.id}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {loadingQueue ? (
                      <div className="flex h-32 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      </div>
                    ) : queueItems.length === 0 ? (
                      <div className="text-center py-12 text-xs text-muted-foreground italic">No items queued in this campaign.</div>
                    ) : (
                      queueItems.map((item) => (
                        <div key={item.id} className="p-3 bg-secondary/25 border border-border/40 rounded-xl space-y-2 text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">{item.lead_name}</p>
                              {item.phone && <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{item.phone}</p>}
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              item.status === "sent" 
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                                : item.status === "failed" 
                                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" 
                                  : item.status === "sending"
                                    ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse"
                                    : "bg-slate-500/10 text-muted-foreground border border-slate-500/20"
                            }`}>
                              {item.status}
                            </span>
                          </div>

                          {item.error_message && (
                            <p className="text-[10px] text-rose-400 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 font-mono">
                              Error: {item.error_message}
                            </p>
                          )}

                          {item.sent_at && (
                            <p className="text-[9px] text-muted-foreground text-right">
                              Delivered: {new Date(item.sent_at).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-2xl h-[calc(100vh-270px)] flex flex-col items-center justify-center text-center p-6 text-xs text-muted-foreground">
                  <Clock className="h-8 w-8 text-slate-400 mb-2" />
                  <p>Select a campaign from the list to display delivery queue timelines and debug logs.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
