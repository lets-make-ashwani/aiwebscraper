"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  ChevronRight, ArrowRight, Star, Globe2, Map, ShieldAlert, 
  Download, FileSpreadsheet, History, Search, ArrowLeft 
} from "lucide-react";
import SidebarLayout from "../../components/SidebarLayout";
import { api } from "../../api";

export default function HistoryDetails() {
  const { id } = useParams();
  const historyId = Number(id);

  const [searchJob, setSearchJob] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!historyId) return;

    const fetchData = async () => {
      try {
        const historyList = await api.getHistory();
        const matchedJob = historyList.find((s: any) => s.id === historyId);
        
        if (!matchedJob) {
          setError("Search history log entry not found.");
          setLoading(false);
          return;
        }
        
        setSearchJob(matchedJob);

        if (matchedJob.status === "completed") {
          const foundLeads = await api.getLeads({ search_history_id: historyId });
          setLeads(foundLeads);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to load search details.");
        setLoading(false);
      }
    };

    fetchData();
  }, [historyId]);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Retrieving leads from database...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (error || !searchJob) {
    return (
      <SidebarLayout>
        <div className="p-6 max-w-xl mx-auto text-center mt-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
          <p className="font-semibold text-lg mb-2">Error Loading History</p>
          <p className="text-sm">{error || "Search history record not found."}</p>
          <Link href="/history" className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Search History
          </Link>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Link href="/history" className="hover:text-primary">Search History</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground truncate max-w-xs">{searchJob.query}</span>
        </div>

        {/* Search Job Profile Header */}
        <div className="glass-card rounded-2xl p-6 border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight">{searchJob.query}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                searchJob.status === "completed" 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                  : searchJob.status === "failed" 
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" 
                    : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse"
              }`}>
                {searchJob.status}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium">
              <span className="bg-secondary px-2.5 py-1 rounded-lg font-bold uppercase">
                Location: {searchJob.location || "Global"}
              </span>
              <span>Min Rating: {searchJob.min_rating}+</span>
              <span>Min Reviews: {searchJob.min_reviews}+</span>
              <span>Date: {new Date(searchJob.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => api.exportCSV(searchJob.id)}
              disabled={leads.length === 0}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-secondary font-bold text-xs transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-4 w-4 text-indigo-500" />
              Download CSV
            </button>
            <button 
              onClick={() => api.exportExcel(searchJob.id)}
              disabled={leads.length === 0}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-secondary font-bold text-xs transition-colors disabled:opacity-40 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Download Excel
            </button>
          </div>
        </div>

        {/* Results List */}
        {leads.length > 0 ? (
          <div className="glass-card rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Leads Found ({leads.length})
              </h3>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-3">Business Details</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3 text-center">Reviews</th>
                    <th className="px-6 py-3">Website Check</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {lead.name}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-xs truncate">
                          {lead.address || "No address listed"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {lead.phone || "No phone number"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                          <span className="font-bold text-xs">{lead.rating || "N/A"}</span>
                          <span className="text-[10px] text-muted-foreground">({lead.reviews_count || 0})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            lead.website_type === "modern"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : lead.website_type === "basic"
                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          }`}>
                            {lead.website_type === "no_website" ? "No Site" : lead.website_type}
                          </span>
                          {lead.website && (
                            <a 
                              href={lead.website} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Globe2 className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(lead.google_maps_url || lead.address) && (
                            <a
                              href={lead.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + (lead.address || ''))}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                              title="View on Google Maps"
                            >
                              <Map className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-all"
                          >
                            Audit
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-border/60">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 space-y-3 hover:bg-secondary/10 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{lead.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.address || "No address listed"}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-lg text-xs font-bold">
                      <Star className="h-3 w-3 fill-amber-500 stroke-amber-500" />
                      <span>{lead.rating || "N/A"}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">({lead.reviews_count || 0})</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Contact</p>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{lead.phone || "No phone number"}</p>
                    </div>
                    
                    <div className="space-y-0.5 text-right">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Website Check</p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                          lead.website_type === "modern"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : lead.website_type === "basic"
                              ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                              : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        }`}>
                          {lead.website_type === "no_website" ? "No Site" : lead.website_type}
                        </span>
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                            <Globe2 className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    {(lead.google_maps_url || lead.address) ? (
                      <a
                        href={lead.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + (lead.address || ''))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold"
                      >
                        <Map className="h-3.5 w-3.5 text-indigo-500" />
                        View Maps
                      </a>
                    ) : (
                      <div></div>
                    )}

                    <Link
                      href={`/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600 hover:text-white font-bold text-xs transition-all"
                    >
                      Audit
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-16 border border-dashed border-border rounded-2xl text-center text-sm text-muted-foreground max-w-xl mx-auto space-y-3">
            <Search className="h-8 w-8 mx-auto text-slate-400" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">No Leads Extracted</h3>
            <p className="text-xs max-w-xs mx-auto">
              {searchJob.status === "failed" 
                ? `Scraper job failed: ${searchJob.error_message || "Unknown error"}` 
                : "This query produced no results matching your minimum rating/review filters."}
            </p>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
