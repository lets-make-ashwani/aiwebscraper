"use client";

import React, { useEffect, useState } from "react";
import { 
  Play, Download, FileSpreadsheet, Eye, History, CheckCircle, XCircle, Loader2, RefreshCw 
} from "lucide-react";
import Link from "next/link";
import SidebarLayout from "../components/SidebarLayout";
import { api } from "../api";

export default function SearchHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rerunningId, setRerunningId] = useState<number | null>(null);

  const fetchHistory = async () => {
    try {
      const data = await api.getHistory();
      setHistory(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load search history:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRerun = async (id: number) => {
    setRerunningId(id);
    try {
      await api.rerunSearch(id);
      alert("Search job successfully triggered in the background!");
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert("Failed to trigger scraper re-run.");
    } finally {
      setRerunningId(null);
    }
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Retrieving audit history logs...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Search History</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rerun maps search queries and download specific database exports.
            </p>
          </div>
          <button 
            onClick={fetchHistory}
            className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* History Table Container */}
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          {history.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              <History className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              No search logs recorded. Go to the Lead Finder to search!
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider font-bold">
                      <th className="px-6 py-3">Search Query</th>
                      <th className="px-6 py-3">Location</th>
                      <th className="px-6 py-3 text-center">Thresholds</th>
                      <th className="px-6 py-3 text-center">Results Found</th>
                      <th className="px-6 py-3">Scraper Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {history.map((search) => (
                      <tr key={search.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                          <Link 
                            href={`/history/${search.id}`}
                            className="hover:text-primary hover:underline transition-colors"
                          >
                            {search.query}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold">
                          {search.location || "Global"}
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-muted-foreground">
                          Rating: {search.min_rating}+ · Reviews: {search.min_reviews}+
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-xs">
                          {search.results_count} leads
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            search.status === "completed" 
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                              : search.status === "failed" 
                                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" 
                                : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse"
                          }`}>
                            {search.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/history/${search.id}`}
                              className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center justify-center cursor-pointer"
                              title="View Leads"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>

                            <button
                              onClick={() => api.exportCSV(search.id)}
                              disabled={search.status !== "completed" || search.results_count === 0}
                              className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-35 cursor-pointer"
                              title="Export CSV"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            
                            <button
                              onClick={() => api.exportExcel(search.id)}
                              disabled={search.status !== "completed" || search.results_count === 0}
                              className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-35 cursor-pointer"
                              title="Export Excel"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleRerun(search.id)}
                              disabled={rerunningId === search.id || search.status === "pending" || search.status === "scraping"}
                              className="p-2 rounded-lg border border-border hover:bg-indigo-500/10 hover:text-indigo-500 hover:border-indigo-500/25 disabled:opacity-35 cursor-pointer"
                              title="Rerun Scraper"
                            >
                              {rerunningId === search.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-border/60">
                {history.map((search) => (
                  <div key={search.id} className="p-4 space-y-3 hover:bg-secondary/10 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Link 
                          href={`/history/${search.id}`}
                          className="font-bold text-slate-800 dark:text-slate-200 text-sm hover:text-primary hover:underline transition-colors block truncate"
                        >
                          {search.query}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Location: {search.location || "Global"}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                        search.status === "completed" 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : search.status === "failed" 
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" 
                            : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse"
                      }`}>
                        {search.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Thresholds</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          Rating: {search.min_rating}+ · Reviews: {search.min_reviews}+
                        </p>
                      </div>
                      
                      <div className="space-y-0.5 text-right">
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Results</p>
                        <p className="font-bold text-indigo-500">{search.results_count} leads</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <Link
                        href={`/history/${search.id}`}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Leads
                      </Link>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => api.exportCSV(search.id)}
                          disabled={search.status !== "completed" || search.results_count === 0}
                          className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-35 cursor-pointer"
                          title="Export CSV"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        
                        <button
                          onClick={() => api.exportExcel(search.id)}
                          disabled={search.status !== "completed" || search.results_count === 0}
                          className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-35 cursor-pointer"
                          title="Export Excel"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </button>
                        
                        <button
                          onClick={() => handleRerun(search.id)}
                          disabled={rerunningId === search.id || search.status === "pending" || search.status === "scraping"}
                          className="p-1.5 rounded-lg border border-border hover:bg-indigo-500/10 hover:text-indigo-500 hover:border-indigo-500/25 disabled:opacity-35 cursor-pointer"
                          title="Rerun Scraper"
                        >
                          {rerunningId === search.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
