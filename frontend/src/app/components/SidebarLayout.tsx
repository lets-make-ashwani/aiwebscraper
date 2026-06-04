"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, Search, Layers, History, Settings, LogOut, Sun, Moon, Menu, X, Briefcase, User 
} from "lucide-react";
import { api, removeToken, getToken } from "../api";

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Auth checking and user info retrieval
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    api.me()
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        removeToken();
        router.push("/login");
      });
  }, [router]);

  // Load and apply theme
  useEffect(() => {
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

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Lead Finder", href: "/lead-finder", icon: Search },
    { name: "CRM Pipeline", href: "/crm", icon: Layers },
    { name: "Search History", href: "/history", icon: History },
    { name: "Branding & Keys", href: "/settings", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#07090e] text-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-400 font-medium">Securing session...</p>
        </div>
      </div>
    );
  }

  const companyBranding = user?.company_name || "LeadForge AI";

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-border shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-primary">
            <Briefcase className="h-6 w-6 stroke-[2.5]" />
            <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent font-extrabold tracking-tight">
              {companyBranding}
            </span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  active 
                    ? "bg-primary text-primary-foreground shadow-md shadow-indigo-600/10" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User profile & Bottom buttons */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-9 w-9 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/25">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{user?.full_name || "Account Profile"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center p-2 rounded-lg border border-border hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/25 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Navbar */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex h-16 items-center justify-between px-6 border-b border-border glass-panel shrink-0 z-50">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base text-primary">
            <Briefcase className="h-5 w-5 stroke-[2.5]" />
            <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent font-extrabold tracking-tight">
              {companyBranding}
            </span>
          </Link>
          <button 
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile Slide-out Drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
            
            {/* Sidebar content */}
            <aside className="relative flex flex-col w-64 max-w-xs bg-background border-r border-border h-full p-4 z-50">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base text-primary" onClick={() => setMobileOpen(false)}>
                  <Briefcase className="h-5 w-5" />
                  <span className="font-extrabold tracking-tight">{companyBranding}</span>
                </Link>
                <button 
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        active 
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="h-8 w-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{user?.full_name || "Profile"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={toggleTheme}
                    className="flex-1 flex items-center justify-center p-2 rounded-lg border border-border hover:bg-secondary"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 flex items-center justify-center p-2 rounded-lg border border-border hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Page Content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
