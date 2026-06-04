"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Search, MapPin, Star, ThumbsUp, Map, Globe2, AlertTriangle, ArrowRight, Loader2, Mic, MicOff
} from "lucide-react";
import SidebarLayout from "../components/SidebarLayout";
import { api } from "../api";

export default function LeadFinder() {
  // Form states
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [minReviews, setMinReviews] = useState("0");
  
  // Scraper status tracking
  const [activeSearch, setActiveSearch] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  
  // Voice states
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load search history and check if any search is active on load
  const loadSearchState = async () => {
    try {
      const searchHistory = await api.getHistory();
      setHistory(searchHistory);
      
      const running = searchHistory.find((s: any) => s.status === "pending" || s.status === "scraping");
      if (running) {
        setActiveSearch(running);
        setSearching(true);
        startPolling(running.id);
      }
    } catch (err: any) {
      console.error("Failed to load search state:", err);
    }
  };

  useEffect(() => {
    loadSearchState();
    return () => stopPolling();
  }, []);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser. Please try Google Chrome, Microsoft Edge, or Apple Safari.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setListening(true);
    };

    rec.onerror = (e: any) => {
      console.error("Speech recognition error", e);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    rec.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      
      try {
        setSearching(true);
        const parsed = await api.analyzeVoice(transcript);
        
        if (parsed.query) setQuery(parsed.query);
        if (parsed.location) setLocation(parsed.location);
        if (parsed.min_rating !== undefined) setMinRating(String(parsed.min_rating));
        if (parsed.min_reviews !== undefined) setMinReviews(String(parsed.min_reviews));
      } catch (err) {
        console.error("Failed to analyze voice:", err);
        setQuery(transcript);
      } finally {
        setSearching(false);
      }
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  const toggleVoiceListen = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startPolling = (searchId: number) => {
    stopPolling();
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const histList = await api.getHistory();
        setHistory(histList);
        
        const currentJob = histList.find((s: any) => s.id === searchId);
        if (currentJob) {
          setActiveSearch(currentJob);
          
          if (currentJob.status === "completed" || currentJob.status === "failed") {
            stopPolling();
            setSearching(false);
            
            if (currentJob.status === "completed") {
              // Load leads for this search
              const foundLeads = await api.getLeads({ search_history_id: searchId });
              setLeads(foundLeads);
            } else {
              setError(currentJob.error_message || "Google Maps scraper failed.");
            }
          }
        }
      } catch (err) {
        console.error("Error polling scraper status:", err);
      }
    }, 2500);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || !location) {
      setError("Please fill out both Category and Location fields.");
      return;
    }

    setSearching(true);
    setError("");
    setLeads([]);
    setActiveSearch(null);

    try {
      const job = await api.search({
        query,
        location,
        min_rating: parseFloat(minRating),
        min_reviews: parseInt(minReviews)
      });
      
      setActiveSearch(job);
      startPolling(job.id);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initiate maps scraper.");
      setSearching(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Lead Finder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search Google Maps to extract business locations, ratings, and websites.
          </p>
        </div>

        {/* Input Panel */}
        <div className="glass-card rounded-2xl p-6 border border-border">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Industry Category / Keyword
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Dentist, Gym, Restaurant"
                  disabled={searching}
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 pl-10 pr-10 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={toggleVoiceListen}
                  disabled={searching}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                  title="Voice Search"
                >
                  {listening ? <MicOff className="h-4 w-4 text-rose-500 animate-pulse" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. City / Location
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <MapPin className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Delhi, Kanpur"
                  disabled={searching}
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                  Min Rating
                </label>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                  disabled={searching}
                  className="block w-full rounded-xl border border-border bg-background py-2.5 px-3 text-sm outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="0">Any</option>
                  <option value="3.5">3.5+</option>
                  <option value="4.0">4.0+</option>
                  <option value="4.5">4.5+</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                  Min Reviews
                </label>
                <select
                  value={minReviews}
                  onChange={(e) => setMinReviews(e.target.value)}
                  disabled={searching}
                  className="block w-full rounded-xl border border-border bg-background py-2.5 px-3 text-sm outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="0">Any</option>
                  <option value="10">10+</option>
                  <option value="50">50+</option>
                  <option value="100">100+</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={searching}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                "Launch Scraper"
              )}
            </button>
          </form>
        </div>

        {/* Progress Tracker */}
        {searching && activeSearch && (
          <div className="glass-card rounded-2xl p-6 border border-border bg-indigo-500/5 relative overflow-hidden pulse-glow">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold">Scraping Google Maps in Background</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Searching for &quot;{activeSearch.query}&quot; in {activeSearch.location || "Global"}...
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 uppercase animate-pulse">
                  {activeSearch.status}
                </span>
              </div>
            </div>
            {/* Simulated progress bar */}
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-4">
              <div className="h-full bg-primary animate-pulse" style={{ width: "65%" }}></div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Scraping Job Interrupted</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Results List */}
        {leads.length > 0 && (
          <div className="glass-card rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Leads Found ({leads.length})
              </h3>
              {activeSearch && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => api.exportCSV(activeSearch.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary font-bold transition-colors cursor-pointer"
                  >
                    CSV
                  </button>
                  <button 
                    onClick={() => api.exportExcel(activeSearch.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary font-bold transition-colors cursor-pointer"
                  >
                    Excel
                  </button>
                </div>
              )}
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
        )}
        {/* Voice Listening Dialog Overlay */}
        {listening && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-card max-w-sm w-full mx-4 p-8 rounded-3xl border border-primary/20 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-indigo-500 animate-pulse"></div>
              
              <div className="flex flex-col items-center space-y-4">
                <div className="relative h-20 w-20 flex items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500">
                  <span className="absolute inset-0 rounded-full bg-rose-500/10 animate-ping"></span>
                  <Mic className="h-8 w-8 text-rose-500 animate-pulse" />
                </div>
                
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">
                    Listening for voice command...
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 px-4">
                    Try speaking: &quot;Find schools in Delhi with rating 4.0 and 50 reviews&quot;
                  </p>
                </div>
              </div>

              <div className="h-10 flex items-center justify-center">
                <div className="flex gap-1.5 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-bounce delay-75"></span>
                  <span className="h-3.5 w-2 rounded-full bg-rose-500 animate-bounce delay-150"></span>
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-bounce delay-300"></span>
                </div>
              </div>

              <button
                type="button"
                onClick={stopListening}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer border border-border"
              >
                Cancel Voice Search
              </button>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
