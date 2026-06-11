"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { ChefHat, LayoutGrid, TableIcon, UtensilsCrossed, BarChart3, Package, LogOut, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/pos", icon: UtensilsCrossed, label: "POS" },
  { href: "/tables", icon: TableIcon, label: "Tables" },
  { href: "/kitchen", icon: ChefHat, label: "Kitchen" },
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/inventory", icon: Package, label: "Stock" },
];

export function PosHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center border-b border-border bg-card px-4 gap-2">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-4">
        <ChefHat className="h-5 w-5 text-primary" />
        <span className="font-bold text-sm">RestroGenie</span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {/* Clock */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono">{formatTime(time)}</span>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <span className="text-xs font-medium">{user?.name}</span>
          <span className="text-xs text-muted-foreground">· {user?.role}</span>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
