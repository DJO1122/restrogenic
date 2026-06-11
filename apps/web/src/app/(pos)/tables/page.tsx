"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tablesApi } from "@/lib/api";
import { useOrderStore } from "@/store/orderStore";
import { PosHeader } from "@/components/pos/PosHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, getTableStatusColor } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Users, Clock, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function TablesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTable, setOrderType, draft } = useOrderStore();

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: tablesApi.list,
    refetchInterval: 10000,
  });

  const sections = Array.from(new Set(tables.map((t: any) => t.section || "Main"))).filter(Boolean);

  function handleTableClick(table: any) {
    if (table.status === "AVAILABLE") {
      setOrderType("DINE_IN");
      setTable(table.id, table.name);
      router.push("/pos");
    }
  }

  function getActiveOrder(table: any) {
    return table.orders?.[0];
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <PosHeader />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Table Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tables.filter((t: any) => t.status === "AVAILABLE").length} available ·{" "}
              {tables.filter((t: any) => t.status === "OCCUPIED").length} occupied ·{" "}
              {tables.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {[
                { status: "AVAILABLE", label: "Available", color: "bg-green-500" },
                { status: "OCCUPIED", label: "Occupied", color: "bg-red-500" },
                { status: "RESERVED", label: "Reserved", color: "bg-yellow-500" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {sections.length > 0 ? (
          sections.map((section) => (
            <div key={section} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section}</h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {tables
                  .filter((t: any) => (t.section || "Main") === section)
                  .map((table: any) => {
                    const activeOrder = getActiveOrder(table);
                    const total = activeOrder ? Number(activeOrder.total) : 0;
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={cn(
                          "relative flex flex-col rounded-2xl border-2 p-4 text-left transition-all hover:scale-105 active:scale-95",
                          getTableStatusColor(table.status),
                          table.status === "AVAILABLE" && "cursor-pointer",
                          table.status === "OCCUPIED" && "cursor-default",
                        )}
                      >
                        <span className="text-lg font-bold">{table.name}</span>
                        <div className="mt-1 flex items-center gap-1 text-xs opacity-70">
                          <Users className="h-3 w-3" />
                          {table.capacity} pax
                        </div>

                        {table.status === "OCCUPIED" && activeOrder && (
                          <div className="mt-2 space-y-1">
                            <p className="text-sm font-semibold">{formatCurrency(total)}</p>
                            {table.occupiedAt && (
                              <div className="flex items-center gap-1 text-xs opacity-70">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(table.occupiedAt))}
                              </div>
                            )}
                            <Button
                              size="sm"
                              className="mt-2 h-7 w-full text-xs"
                              onClick={(e) => { e.stopPropagation(); router.push(`/pos?orderId=${activeOrder.id}`); }}
                            >
                              View Order
                            </Button>
                          </div>
                        )}

                        {table.status === "AVAILABLE" && (
                          <div className="mt-3 flex items-center gap-1 text-xs opacity-60">
                            <Plus className="h-3 w-3" />
                            New Order
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {tables.map((table: any) => (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={cn(
                  "flex flex-col rounded-2xl border-2 p-4 text-left transition-all hover:scale-105",
                  getTableStatusColor(table.status),
                )}
              >
                <span className="text-lg font-bold">{table.name}</span>
                <div className="mt-1 flex items-center gap-1 text-xs opacity-70">
                  <Users className="h-3 w-3" />
                  {table.capacity}
                </div>
                <Badge className="mt-2 w-fit text-xs">{table.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
