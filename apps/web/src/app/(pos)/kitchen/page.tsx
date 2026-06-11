"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/lib/api";
import { PosHeader } from "@/components/pos/PosHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ChefHat } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

export default function KitchenPage() {
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: ordersApi.kitchen,
    refetchInterval: 5000,
  });

  const markReady = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      ordersApi.markItemReady(orderId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] }),
  });

  function getWaitMinutes(createdAt: string) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  function getUrgencyColor(createdAt: string) {
    const mins = getWaitMinutes(createdAt);
    if (mins >= 20) return "border-red-500 bg-red-500/5";
    if (mins >= 10) return "border-yellow-500 bg-yellow-500/5";
    return "border-green-500/50 bg-green-500/5";
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <PosHeader />

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Kitchen Display</h1>
          <Badge variant="secondary">{orders.length} active</Badge>
          <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
            {[
              { color: "bg-green-500", label: "< 10 min" },
              { color: "bg-yellow-500", label: "10-20 min" },
              { color: "bg-red-500", label: "> 20 min" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <ChefHat className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No active orders</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orders.map((order: any) => {
              const mins = getWaitMinutes(order.createdAt);
              return (
                <div
                  key={order.id}
                  className={cn("rounded-2xl border-2 p-4 transition-colors", getUrgencyColor(order.createdAt))}
                >
                  {/* Order header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-bold text-lg">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.table?.name || order.orderType.replace("_", "-")}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "flex items-center gap-1 text-sm font-semibold",
                        mins >= 20 ? "text-red-400" : mins >= 10 ? "text-yellow-400" : "text-green-400",
                      )}>
                        <Clock className="h-3.5 w-3.5" />
                        {mins}m
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {order.items?.map((item: any) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-2 rounded-xl p-2.5 transition-colors",
                          item.isReady ? "opacity-40 bg-muted/30" : "bg-card/60",
                        )}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {item.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-semibold truncate", item.isReady && "line-through")}>
                            {item.name}
                          </p>
                          {item.variantName && (
                            <p className="text-xs text-muted-foreground">{item.variantName}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-orange-400">⚠ {item.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => markReady.mutate({ orderId: order.id, itemId: item.id })}
                          disabled={item.isReady}
                          className={cn(
                            "rounded-lg p-1.5 transition-colors",
                            item.isReady
                              ? "text-green-400 cursor-default"
                              : "text-muted-foreground hover:bg-green-500/20 hover:text-green-400",
                          )}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Order notes */}
                  {order.notes && (
                    <p className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-400">
                      {order.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
