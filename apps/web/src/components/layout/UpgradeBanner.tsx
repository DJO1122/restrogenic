"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import { Sparkles, X, Loader2, AlertTriangle } from "lucide-react";

/**
 * Trial / billing banner shown at the top of the POS for shop owners.
 * - Trial: "N days left · Upgrade now"
 * - Suspended (lapsed trial / failed payment): blocking upgrade prompt
 * - Active: nothing
 * Clicking Upgrade hits POST /billing/subscribe and opens the Razorpay
 * authorize URL (UPI-autopay / card mandate).
 */
export function UpgradeBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["billing-status"],
    queryFn: billingApi.status,
    staleTime: 60_000,
    retry: false,
  });

  const subscribe = useMutation({
    mutationFn: (planId?: string) => billingApi.subscribe(planId),
    onSuccess: (res: any) => {
      if (res?.authorizeUrl) window.open(res.authorizeUrl, "_blank");
    },
  });

  if (!status) return null;
  const { status: s, trialDaysLeft, plan } = status as any;

  // Active & paying — no banner
  if (s === "Active") return null;

  const suspended = s === "Suspended" || s === "Cancelled";
  if (!suspended && dismissed) return null;

  const planName = plan?.name && plan.name !== "Free Trial" ? plan.name : "Pro";

  return (
    <div
      className={
        "flex items-center gap-3 px-4 py-2.5 text-sm " +
        (suspended
          ? "bg-red-600 text-white"
          : "bg-gradient-to-r from-primary/90 to-purple-600/90 text-white")
      }
    >
      {suspended ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Sparkles className="h-4 w-4 shrink-0" />}

      <span className="flex-1 font-medium">
        {suspended ? (
          <>Your subscription is inactive — reactivate to keep billing your customers.</>
        ) : (
          <>
            You're on a free trial —{" "}
            <strong>{trialDaysLeft ?? 0} day{trialDaysLeft === 1 ? "" : "s"} left</strong>. Upgrade to keep all features.
          </>
        )}
      </span>

      <button
        onClick={() => subscribe.mutate(undefined)}
        disabled={subscribe.isPending}
        className="flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-white disabled:opacity-70"
      >
        {subscribe.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Upgrade to {planName}
      </button>

      {!suspended && (
        <button onClick={() => setDismissed(true)} className="text-white/80 hover:text-white" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
