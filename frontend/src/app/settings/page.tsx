"use client";

import React, { useState, useEffect } from "react";
import { 
  Key, Briefcase, FileSignature, CheckCircle2, ShieldAlert, Sparkles, Loader2, Save, FileSpreadsheet, Clock, Sliders, Smartphone, RefreshCw 
} from "lucide-react";
import SidebarLayout from "../components/SidebarLayout";
import { api } from "../api";

export default function Settings() {
  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brandingText, setBrandingText] = useState("");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [whatsappMinDelay, setWhatsappMinDelay] = useState<number>(15);
  const [whatsappMaxDelay, setWhatsappMaxDelay] = useState<number>(45);
  const [whatsappDailyLimit, setWhatsappDailyLimit] = useState<number>(50);
  const [customPrompt, setCustomPrompt] = useState("");
  
  // WhatsApp pairing status
  const [waStatus, setWaStatus] = useState("disconnected");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [connectingWa, setConnectingWa] = useState(false);
  
  // Validation status
  const [validating, setValidating] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  
  const [geminiValidating, setGeminiValidating] = useState(false);
  const [geminiKeyValid, setGeminiKeyValid] = useState<boolean | null>(null);
  
  // Save states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Load current profile settings
    api.me()
      .then((user) => {
        setGroqKey(user.groq_api_key || "");
        setGeminiKey(user.gemini_api_key || "");
        setCompanyName(user.company_name || "");
        setBrandingText(user.company_branding || "");
        setSheetsUrl(user.google_sheets_webhook_url || "");
        setWhatsappMinDelay(user.whatsapp_delay_min !== undefined ? user.whatsapp_delay_min : 15);
        setWhatsappMaxDelay(user.whatsapp_delay_max !== undefined ? user.whatsapp_delay_max : 45);
        setWhatsappDailyLimit(user.whatsapp_daily_limit !== undefined ? user.whatsapp_daily_limit : 50);
        setCustomPrompt(user.custom_system_prompt || "");
        if (user.groq_api_key) {
          setKeyValid(true);
        }
        if (user.gemini_api_key) {
          setGeminiKeyValid(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load user info:", err);
      });

    // Check WhatsApp status
    api.getWhatsAppStatus()
      .then((res) => {
        setWaStatus(res.status);
        setWaQr(res.qr_code);
        if (res.status === "connecting") {
          setPolling(true);
        }
      })
      .catch((err) => console.error("Error loading WhatsApp status:", err));
  }, []);

  // Poll WhatsApp pairing status
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => {
      api.getWhatsAppStatus()
        .then((res) => {
          setWaStatus(res.status);
          setWaQr(res.qr_code);
          if (res.status === "connected") {
            setPolling(false);
          }
        })
        .catch((err) => {
          console.error("Error polling WhatsApp status:", err);
          setPolling(false);
        });
    }, 3000);
    return () => clearInterval(interval);
  }, [polling]);

  const handleConnectWhatsApp = async () => {
    setConnectingWa(true);
    setWaStatus("connecting");
    setWaQr(null);
    try {
      const res = await api.pairWhatsApp();
      if (res.qr_code) {
        setWaQr(res.qr_code);
      }
      setPolling(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initiate WhatsApp pairing.");
      setWaStatus("disconnected");
    } finally {
      setConnectingWa(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      await api.disconnectWhatsApp();
      setWaStatus("disconnected");
      setWaQr(null);
      setPolling(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to disconnect WhatsApp.");
    }
  };

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

  const handleValidateGeminiKey = async () => {
    if (!geminiKey) {
      setError("Please input a Gemini API Key first.");
      return;
    }

    setGeminiValidating(true);
    setGeminiKeyValid(null);
    setError("");

    try {
      const res = await api.validateGeminiKey(geminiKey);
      if (res.valid) {
        setGeminiKeyValid(true);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (err: any) {
      console.error(err);
      setGeminiKeyValid(false);
      setError(err.message || "Failed to validate Gemini key. Ensure the key is correct and active.");
    } finally {
      setGeminiValidating(false);
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
        gemini_api_key: geminiKey || null,
        company_name: companyName || null,
        company_branding: brandingText || null,
        google_sheets_webhook_url: sheetsUrl || null,
        whatsapp_delay_min: Number(whatsappMinDelay),
        whatsapp_delay_max: Number(whatsappMaxDelay),
        whatsapp_daily_limit: Number(whatsappDailyLimit),
        custom_system_prompt: customPrompt || null
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

          {/* Gemini API Config */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <Key className="h-4 w-4" />
              <span>Google Gemini AI Integration</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Gemini API Key (Free Tier supported)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      setGeminiKeyValid(null);
                    }}
                    placeholder="AIzaSy••••••••••••••••••••"
                    className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleValidateGeminiKey}
                  disabled={geminiValidating || !geminiKey}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-secondary font-bold text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {geminiValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Validate Key"
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Enter your Google Gemini API key to run analysis, score leads, and generate outreach pitches. If both Gemini and Groq keys are configured, Gemini will be used as primary.
              </p>
            </div>

            {geminiKeyValid !== null && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-semibold ${
                geminiKeyValid 
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" 
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-500"
              }`}>
                {geminiKeyValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Gemini connection active. API Key verified successfully!</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" />
                    <span>Gemini API Key validation failed. Please check the key.</span>
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

          {/* Google Sheets Sync Config */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Google Sheets Live Synchronization</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Apps Script Web App Webhook URL
                </label>
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/••••/exec"
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/40 border border-border text-xs space-y-2 leading-relaxed">
                <p className="font-bold text-indigo-400">💡 Quick Setup Guide:</p>
                <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                  <li>Create a new Google Sheet.</li>
                  <li>Go to <b>Extensions &gt; Apps Script</b>.</li>
                  <li>Paste the following code snippet and save:
                    <pre className="p-2 bg-slate-900 rounded-lg overflow-x-auto text-[10px] font-mono mt-1 text-slate-300 select-all">
{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "Name", "Phone", "Website", "Address", "Rating", "Reviews", "Category", "Website Type", "Score", "Category Score", "Status", "Date"]);
    }
    sheet.appendRow([data.id, data.name, data.phone, data.website, data.address, data.rating, data.reviews_count, data.category, data.website_type, data.lead_score, data.lead_score_category, data.status, data.created_at]);
    return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:"error",message:err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                    </pre>
                  </li>
                  <li>Click <b>Deploy &gt; New Deployment</b>. Select type: <b>Web App</b>.</li>
                  <li>Configure: Execute as <b>Me</b>, Who has access: <b>Anyone</b>.</li>
                  <li>Deploy, authorize Google permissions, copy the <b>Web App URL</b> and paste it above!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* WhatsApp Outreach Delays & Limits */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <Clock className="h-4 w-4" />
              <span>WhatsApp Safety & Campaign Delays</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Min Delay (seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={whatsappMinDelay}
                  onChange={(e) => setWhatsappMinDelay(Number(e.target.value))}
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Max Delay (seconds)
                </label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={whatsappMaxDelay}
                  onChange={(e) => setWhatsappMaxDelay(Number(e.target.value))}
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Daily Outreach Limit
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={whatsappDailyLimit}
                  onChange={(e) => setWhatsappDailyLimit(Number(e.target.value))}
                  className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-2.5 px-4 text-sm outline-none transition-all focus:border-primary"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
              ⚠️ Highly recommended to use randomized delays of at least 15-45 seconds between messages and keeping the daily limits low to protect your WhatsApp account from being suspended for automated cold outreach.
            </p>
          </div>

          {/* AI Custom System Prompt Settings */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
            <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <Sliders className="h-4 w-4" />
              <span>AI Outreach Copy System Prompt (Override)</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Custom Outreach Prompt Guidelines
              </label>
              <textarea
                rows={6}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Leave blank to use default system prompts. If set, this custom instructions string will guide the AI on how to format, write, and focus your cold email, WhatsApp, and social media DMs."
                className="block w-full rounded-xl border border-border bg-slate-900/10 dark:bg-slate-950/60 py-3 px-4 text-sm outline-none transition-all focus:border-primary font-mono text-xs"
              ></textarea>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Provide custom guidelines like: <i>&quot;Focus heavily on their mobile responsiveness issue. Keep WhatsApp messages under 100 words. Start with a direct question and offer a free mockup.&quot;</i>
              </p>
            </div>
          </div>

          {/* WhatsApp Automation Web Session */}
          <div className="glass-card rounded-2xl p-6 border border-border space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
                <Smartphone className="h-4 w-4" />
                <span>WhatsApp Automation Pairing</span>
              </div>
              
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  waStatus === "connected" ? "bg-emerald-500 animate-pulse" : waStatus === "connecting" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                }`} />
                <span className={
                  waStatus === "connected" ? "text-emerald-500" : waStatus === "connecting" ? "text-amber-500" : "text-muted-foreground"
                }>
                  {waStatus}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {waStatus === "disconnected" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    To send WhatsApp messages directly from this app in the background, you must connect your personal WhatsApp account by scanning the pairing QR code.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectWhatsApp}
                    disabled={connectingWa}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                  >
                    {connectingWa ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Initiating session...
                      </>
                    ) : (
                      "Connect WhatsApp Web"
                    )}
                  </button>
                </div>
              )}

              {waStatus === "connecting" && (
                <div className="flex flex-col items-center justify-center p-6 bg-slate-900/20 border border-border/40 rounded-2xl">
                  {waQr ? (
                    <div className="space-y-4 text-center">
                      <p className="text-xs font-bold text-slate-300">Scan this QR Code with WhatsApp on your phone:</p>
                      <div className="bg-white p-4 rounded-2xl inline-block shadow-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={waQr} alt="WhatsApp Web QR Code" className="w-56 h-56 mx-auto" />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Open WhatsApp &gt; Linked Devices &gt; Link a Device.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                      <p className="text-xs text-muted-foreground mt-3 font-semibold">
                        Booting background browser session. Loading QR code...
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleDisconnectWhatsApp}
                    className="mt-6 text-xs text-rose-500 font-bold hover:underline cursor-pointer"
                  >
                    Cancel Connection
                  </button>
                </div>
              )}

              {waStatus === "connected" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>WhatsApp Web session is connected and ready to send outreach messages!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectWhatsApp}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    Disconnect Session
                  </button>
                </div>
              )}
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
