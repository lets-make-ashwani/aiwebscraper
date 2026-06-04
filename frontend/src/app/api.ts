const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("leadforge_token");
  }
  return null;
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("leadforge_token", token);
  }
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("leadforge_token");
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/register" && window.location.pathname !== "/") {
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = "An error occurred";
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.detail || errMsg;
    } catch {
      errMsg = errText || errMsg;
    }
    throw new Error(errMsg);
  }

  // Handle binary stream downloads (PDF, Excel, CSV)
  const contentType = response.headers.get("content-type");
  if (contentType && (contentType.includes("pdf") || contentType.includes("sheet") || contentType.includes("csv"))) {
    return response.blob();
  }

  return response.json();
}

export const api = {
  // Authentication
  login: async (form: FormData) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      body: form, // OAuth2 request uses form urlencoded
    });
    if (!res.ok) {
      const errText = await res.text();
      let errMsg = "Login failed";
      try {
        errMsg = JSON.parse(errText).detail || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
    return res.json();
  },
  
  register: (data: any) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  me: () => request("/auth/me"),
  updateSettings: (data: any) => request("/auth/settings", { method: "PUT", body: JSON.stringify(data) }),
  
  // Dashboard
  getStats: () => request("/dashboard/"),

  // Leads
  search: (data: any) => request("/leads/search", { method: "POST", body: JSON.stringify(data) }),
  getHistory: () => request("/leads/history"),
  rerunSearch: (id: number) => request(`/leads/history/${id}/rerun`, { method: "POST" }),
  getLeads: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        q.append(key, String(val));
      }
    });
    const queryStr = q.toString();
    return request(`/leads/${queryStr ? `?${queryStr}` : ""}`);
  },
  getLead: (id: number) => request(`/leads/${id}`),
  updateLeadCRM: (id: number, data: any) => request(`/leads/${id}/crm`, { method: "PUT", body: JSON.stringify(data) }),
  getOutreach: (id: number) => request(`/leads/${id}/outreach`),
  generateProposal: (id: number, format: string) => request(`/leads/${id}/proposal`, { method: "POST", body: JSON.stringify({ format }) }),
  analyzeVoice: (transcript: string) => request("/leads/analyze-voice", { method: "POST", body: JSON.stringify({ transcript }) }),

  // Settings
  validateKey: (apiKey: string) => request("/settings/validate-key", { method: "POST", body: JSON.stringify({ api_key: apiKey }) }),
  updateBranding: (data: any) => request("/settings/branding", { method: "PUT", body: JSON.stringify(data) }),

  // Exports
  exportCSV: async (historyId?: number) => {
    const blob = await request(`/export/csv${historyId ? `?search_history_id=${historyId}` : ""}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${historyId || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  exportExcel: async (historyId?: number) => {
    const blob = await request(`/export/excel${historyId ? `?search_history_id=${historyId}` : ""}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${historyId || "all"}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  exportPDF: async (leadId: number, leadName: string) => {
    const blob = await request(`/export/pdf/${leadId}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Audit_Report_${leadName.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
};
