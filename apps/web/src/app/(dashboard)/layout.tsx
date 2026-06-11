"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { UpgradeBanner } from "@/components/layout/UpgradeBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token) return null;
  return (
    <div className="flex h-screen flex-col">
      <UpgradeBanner />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
