"use client";

import { useOrderStore } from "@/store/orderStore";
import { UtensilsCrossed, ShoppingBag, Bike, Globe, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ORDER_TYPES = [
  { type: "DINE_IN" as const, label: "Dine-In", icon: UtensilsCrossed, color: "text-blue-400" },
  { type: "TAKEAWAY" as const, label: "Takeaway", icon: ShoppingBag, color: "text-green-400" },
  { type: "DELIVERY" as const, label: "Delivery", icon: Bike, color: "text-orange-400" },
  { type: "ONLINE" as const, label: "Online", icon: Globe, color: "text-purple-400" },
];

export function OrderTypeSelector({ tables }: { tables: any[] }) {
  const { draft, setOrderType, setTable } = useOrderStore();
  const [tableOpen, setTableOpen] = useState(false);

  const availableTables = tables.filter((t) => t.status === "AVAILABLE" || t.id === draft.tableId);
  const selectedTable = tables.find((t) => t.id === draft.tableId);

  return (
    <div className="flex items-center gap-2">
      {/* Order type buttons */}
      <div className="flex gap-1">
        {ORDER_TYPES.map(({ type, label, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              draft.orderType === type
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", draft.orderType === type ? "text-primary" : color)} />
            {label}
          </button>
        ))}
      </div>

      {/* Table selector (only for dine-in) */}
      {draft.orderType === "DINE_IN" && (
        <div className="relative ml-2">
          <button
            onClick={() => setTableOpen(!tableOpen)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              draft.tableId
                ? "border-primary bg-primary/10 text-primary"
                : "border-dashed border-muted-foreground text-muted-foreground hover:border-primary/50",
            )}
          >
            <span>{selectedTable ? selectedTable.name : "Select Table"}</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {tableOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-48 overflow-auto rounded-xl border border-border bg-card shadow-xl">
              <div className="p-1">
                {availableTables.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No available tables</p>
                ) : (
                  availableTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTable(t.id, t.name); setTableOpen(false); }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors hover:bg-accent",
                        t.id === draft.tableId && "bg-primary/10 text-primary",
                      )}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground">{t.capacity} pax</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table indicator */}
      {draft.orderType === "DINE_IN" && draft.tableName && (
        <span className="ml-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {draft.tableName}
        </span>
      )}
    </div>
  );
}
