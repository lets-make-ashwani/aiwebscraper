"use client";

import React, { useState, useEffect } from "react";
import { 
  Key, Briefcase, FileSignature, CheckCircle2, ShieldAlert, Sparkles, Loader2, Save 
} from "lucide-react";
import SidebarLayout from "../components/SidebarLayout";
import { api } from "../api";

export default function Settings() {
  const [groqKey, setGroqKey] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brandingText, setBrandingText] = useState("");
  
  // Validation status
  const [validating, setValidating] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  
  // Save states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Load current profile settings
    api.me()
      .then((user) => {
        setGroqKey(user.groq_api_key || "");
        setCompanyName(user.company_name || "");
        setBrandingText(user.company_branding || "");
        if (user.groq_api_key) {
          setKeyValid(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load user info:", err);
      });
  }, []);

  const handleValidateKey = async () => {
    if (!groqKey) {
      setError("Please input a Groq API Key first.");
      return;
    }

    setValidating(true);
    setKeyValid(null);
    setError("");

    try {
      const res = await api.validateKey(groqKey);
      if (res.valid) {
        setKeyValid(true);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (err: any) {
      console.error(err);
      setKeyValid(false);
      setError(err.message || "Failed to validate key. Ensure the key is correct and not expired.");
    } finally {
      setValidating(false);
    }
  };

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      // 1. Update API Key settings
      await api.updateSettings({
        groq_api_key: groqKey || null,
        company_name: companyName || null,
        company_branding: brandingText || null
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        // Page reload to apply new settings globally (like Sidebar branding)
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update profile settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure integrations and personalize outreach proposals.
          </p>
        </div>

        {/* Status Messages */}
        {success && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Settings saved successfully! Updating profile...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfileSettings} className="space-y-6">
          {/* Groq API Config */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <Key className="h-4 w-4" />
              <span>Groq AI Integration</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Groq API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => {
                      setGroqKey(e.target.value);
                      setKeyValid(null);
                    }}
                    placeholder="gsk_••••••••••••••••••••"
                    className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleValidateKey}
                  disabled={validating || !groqKey}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-secondary font-bold text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {validating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Validate Key"
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Enter your Groq API key to power AI scoring, website analysis, and cold outreach.
              </p>
            </div>

            {keyValid !== null && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-semibold ${
                keyValid 
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" 
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-500"
              }`}>
                {keyValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Groq connection active. API Key verified successfully!</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" />
                    <span>API Key validation failed. Please check the key.</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Branding Profile Config */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <Briefcase className="h-4 w-4" />
              <span>Branding & Proposal Personalization</span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Consultancy / Agency Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Marketing Solutions"
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Branding voice / Custom Pitch Instructions
                </label>
                <textarea
                  rows={4}
                  value={brandingText}
                  onChange={(e) => setBrandingText(e.target.value)}
                  placeholder="e.g. We focus on launching modern 1-page sites and SEO optimization for dentists. We pitch direct ROI-focused pricing: $1,250 setup, $299 maintenance."
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-3 px-4 text-sm outline-none transition-all focus:border-primary"
                ></textarea>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Specify details about your team and pricing model to personalize AI proposal generation.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-indigo-500 transition-all duration-200 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save System Settings
              </>
            )}
          </button>
        </form>
      </div>
    </SidebarLayout>
  );
}
