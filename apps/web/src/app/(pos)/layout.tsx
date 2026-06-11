"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { connectSocket } from "@/lib/socket";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user?.branchId) {
      connectSocket(user.branchId);
    }
  }, [token, user, router]);

  if (!token) return null;
  return <>{children}</>;
}
