"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Briefcase, Search, Globe, Sparkles, Layers, History, Shield, ArrowRight, Sun, Moon 
} from "lucide-react";
import { getToken } from "./api";

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    // Check if token exists
    setIsAuth(!!getToken());
    
    // Load default theme
    const savedTheme = localStorage.getItem("leadforge_theme") as "dark" | "light";
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("leadforge_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const features = [
    { title: "Google Maps Scraper", desc: "Automate leads extraction. Retrieve names, phone numbers, ratings, reviews, and websites from local map listings.", icon: Search },
    { title: "Website Audit Crawler", desc: "Crawl target business domains instantly to analyze SSL certificates, mobile responsiveness, CTAs, forms, and page speed.", icon: Globe },
    { title: "Groq AI Lead Scoring", desc: "Calculate a programmatically balanced health score (0-100) and priority category (Hot, Warm, Cold) using Llama-3.", icon: Sparkles },
    { title: "CRM Pipeline Board", desc: "Organize prospects through New, Qualified, Contacted, and Closed stages. Update call notes and set follow-up targets.", icon: Layers },
    { title: "AI Proposals & Outreach", desc: "Draft high-converting proposals (4 formats) and multi-channel outreach campaigns (Email, LinkedIn, WhatsApp) on demand.", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative overflow-hidden font-sans">
      {/* Background radial overlays */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-rose-500/5 dark:bg-rose-500/5 blur-[150px] pointer-events-none"></div>

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-border glass-panel relative z-10">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <Briefcase className="h-6 w-6 stroke-[2.5]" />
          <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent font-extrabold tracking-tight">
            LeadForge AI
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>

          {isAuth ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-indigo-500 shadow-md shadow-indigo-600/15 transition-all"
            >
              Go to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl border border-border hover:bg-secondary font-bold text-xs transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-indigo-500 font-bold text-xs shadow-md shadow-indigo-600/15 transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 md:px-12 py-20 text-center max-w-4xl mx-auto relative z-10 space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-primary text-xs font-bold pulse-glow">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          Groq AI-Powered Lead Generator & Auditor
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
          Automate Lead Finding & <br />
          <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
            Convert Local Businesses
          </span>
        </h1>
        
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Scan Google Maps for high-quality leads, automatically inspect their website speed & SEO, compute lead health scores, and write personalized cold outreach copy in seconds.
        </p>

        <div className="pt-4 flex justify-center gap-4">
          <Link
            href={isAuth ? "/dashboard" : "/register"}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 active:translate-y-0.5 transition-all duration-200"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto relative z-10 border-t border-border/60">
        <h3 className="text-center font-extrabold text-2xl mb-12">
          Everything You Need to Scale Your Outreach
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx}
                className="glass-card rounded-2xl p-6 border border-border space-y-4"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
                    {feat.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-muted-foreground border-t border-border/40 relative z-10">
        <p>&copy; {new Date().getFullYear()} LeadForge AI. Built for Freelancers, Agencies & Sales Consultants.</p>
      </footer>
    </div>
  );
}
