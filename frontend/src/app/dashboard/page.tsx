"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Users, CheckCircle2, ShieldX, Globe2, Send, History, Search, ArrowRight, Award 
} from "lucide-react";
import SidebarLayout from "../components/SidebarLayout";
import { api } from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getStats()
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not retrieve dashboard statistics. Ensure the backend server is running.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground font-medium">Assembling statistics...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="p-6 max-w-xl mx-auto text-center mt-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
          <p className="font-semibold text-lg mb-2">Connection Offline</p>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </SidebarLayout>
    );
  }

  const kpis = [
    { title: "Total Leads Found", value: stats.total_leads, icon: Users, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", href: "/crm" },
    { title: "Qualified Leads", value: stats.qualified_leads, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", href: "/crm?filter=qualified" },
    { title: "Unqualified Leads", value: stats.unqualified_leads, icon: ShieldX, color: "text-rose-500 bg-rose-500/10 border-rose-500/20", href: "/crm?filter=unqualified" },
    { title: "Websites Audited", value: stats.websites_audited, icon: Globe2, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20", href: "/crm?filter=audited" },
    { title: "Outreach Generated", value: stats.outreach_generated, icon: Send, color: "text-purple-500 bg-purple-500/10 border-purple-500/20", href: "/crm?filter=outreach" },
  ];

  // Logic for custom SVG Area/Line Chart: Leads Per Day
  const maxDayCount = Math.max(...stats.leads_per_day.map((d: any) => d.count), 5);
  const chartHeight = 150;
  const chartWidth = 500;
  const points = stats.leads_per_day.map((d: any, i: number) => {
    const x = (i / (stats.leads_per_day.length - 1)) * chartWidth;
    const y = chartHeight - (d.count / maxDayCount) * (chartHeight - 20) - 10;
    return { x, y, date: d.date, count: d.count };
  });
  
  const pathData = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(" ")
    : "";
    
  const fillData = points.length > 0
    ? `${pathData} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
    : "";

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-slate-100 dark:to-indigo-300 bg-clip-text text-transparent">
              Agency Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time summary of lead campaigns and website optimization opportunities.
            </p>
          </div>
          <Link 
            href="/lead-finder"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 active:translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            <Search className="h-4 w-4" />
            Find New Leads
          </Link>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <Link 
                key={idx}
                href={kpi.href}
                className="glass-card rounded-2xl p-5 border border-border flex flex-col justify-between hover:border-primary/50 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-none">
                    {kpi.title}
                  </span>
                  <div className={`p-2 rounded-xl border shrink-0 ${kpi.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {kpi.value}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Charts & Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Leads per Day Area Chart */}
          <div className="glass-card rounded-2xl p-6 border border-border lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Acquisition Timeline (Leads Per Day)
              </h3>
              <Link 
                href="/history" 
                className="text-xs font-bold text-primary hover:text-indigo-400 inline-flex items-center gap-1 transition-colors"
              >
                View Logs
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="relative pt-4">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48 overflow-visible">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = 10 + ratio * (chartHeight - 30);
                  return (
                    <line 
                      key={i} 
                      x1="0" 
                      y1={y} 
                      x2={chartWidth} 
                      y2={y} 
                      stroke="currentColor" 
                      className="text-slate-200 dark:text-slate-800/60" 
                      strokeDasharray="4 4" 
                    />
                  );
                })}
                {/* Area Fill */}
                {fillData && <path d={fillData} fill="url(#areaGradient)" />}
                {/* Line Path */}
                {pathData && <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />}
                {/* Interactive Points */}
                {points.map((p: any, i: number) => (
                  <g key={i} className="group cursor-pointer">
                    <circle cx={p.x} cy={p.y} r="5" fill="#6366f1" stroke="#ffffff" strokeWidth="2" className="dark:stroke-slate-950" />
                    <circle cx={p.x} cy={p.y} r="10" fill="#6366f1" opacity="0" className="hover:opacity-20 transition-opacity" />
                    <text 
                      x={p.x} 
                      y={p.y - 12} 
                      textAnchor="middle" 
                      fill="currentColor" 
                      className="text-[10px] font-bold fill-current text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      {p.count}
                    </text>
                  </g>
                ))}
              </svg>
              {/* Date Labels */}
              <div className="flex justify-between mt-2 px-1">
                {stats.leads_per_day.map((d: any, i: number) => {
                  // Format short date (e.g. 29 May)
                  const parts = d.date.split("-");
                  const shortDate = parts.length === 3 ? `${parts[2]}` : d.date;
                  return (
                    <span key={i} className="text-[10px] font-bold text-muted-foreground">
                      {shortDate}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart 2: Score Distribution Circle */}
          <div className="glass-card rounded-2xl p-6 border border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Lead Health Distribution
            </h3>
            <div className="space-y-4 pt-2">
              {stats.score_distribution.map((item: any, idx: number) => {
                const total = stats.total_leads || 1;
                const percent = Math.round((item.count / total) * 100);
                const barColors = [
                  "bg-rose-500",      // Hot (normally Red for Hot Lead)
                  "bg-amber-500",     // Warm
                  "bg-blue-500",      // Medium
                  "bg-slate-400"      // Low Priority
                ];
                const badgeStyle = [
                  "glow-badge-hot",
                  "glow-badge-warm",
                  "glow-badge-medium",
                  "glow-badge-low"
                ];
                
                const filterCategory = item.category.split(" ")[0].toLowerCase();
                
                return (
                  <Link 
                    key={idx} 
                    href={`/crm?filter=${filterCategory}`}
                    className="block space-y-1 hover:bg-secondary/35 p-2 -mx-2 rounded-xl transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${badgeStyle[idx % 4]}`}>
                        {item.category.split(" ")[0]}
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        {item.count} leads ({percent}%)
                      </span>
                    </div>
                    {/* Visual Bar progress */}
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${barColors[idx % 4]} transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Section: Industry Top + Recent Searches */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 3: Top Industries */}
          <div className="glass-card rounded-2xl p-6 border border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Top Scraped Categories
            </h3>
            <div className="space-y-4">
              {stats.leads_by_industry.map((item: any, idx: number) => {
                const maxCount = Math.max(...stats.leads_by_industry.map((d: any) => d.count), 1);
                const percent = (item.count / maxCount) * 100;
                return (
                  <Link 
                    key={idx} 
                    href={`/crm?category=${encodeURIComponent(item.industry)}`}
                    className="block space-y-1 hover:bg-secondary/35 p-2 -mx-2 rounded-xl transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="truncate">{item.industry}</span>
                      <span className="text-muted-foreground">{item.count} leads</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Searches */}
          <div className="glass-card rounded-2xl p-6 border border-border lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Recent Map Searches
              </h3>
              <Link 
                href="/history" 
                className="text-xs font-bold text-primary hover:text-indigo-400 inline-flex items-center gap-1 transition-colors"
              >
                View History
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            
            <div className="divide-y divide-border/60">
              {stats.recent_searches.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No searches run yet. Go to Lead Finder to start!
                </div>
              ) : (
                stats.recent_searches.map((search: any) => (
                  <Link 
                    key={search.id} 
                    href={`/history/${search.id}`}
                    className="py-3 flex items-center justify-between gap-4 text-sm hover:bg-secondary/35 px-3.5 -mx-3.5 rounded-xl transition-all duration-200 cursor-pointer block"
                  >
                    <div>
                      <p className="font-bold truncate text-slate-800 dark:text-slate-200">
                        {search.query}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {search.location || "Global"} · {new Date(search.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {search.results_count} results
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        search.status === "completed" 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : search.status === "failed" 
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" 
                            : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse"
                      }`}>
                        {search.status}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
