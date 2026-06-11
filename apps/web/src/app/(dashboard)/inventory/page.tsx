"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { PosHeader } from "@/components/pos/PosHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { Package, AlertTriangle, Plus, Search, TrendingDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "", unit: "kg", currentQty: "", reorderLevel: "", costPerUnit: "",
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["inventory-stock"],
    queryFn: inventoryApi.getStock,
    refetchInterval: 30000,
  });

  const addStock = useMutation({
    mutationFn: inventoryApi.addStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
      toast({ title: "Item added to inventory", variant: "success" });
      setAddOpen(false);
      setNewItem({ name: "", unit: "kg", currentQty: "", reorderLevel: "", costPerUnit: "" });
    },
  });

  const lowStock = stock.filter((i: any) => i.isLow);
  const filtered = stock.filter((i: any) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <PosHeader />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inventory & Stock</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {stock.length} items · {lowStock.length} low stock alerts
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>

        {/* Low stock alerts */}
        {lowStock.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Low Stock Alerts ({lowStock.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStock.map((item: any) => (
                  <Badge key={item.id} variant="warning" className="text-xs">
                    {item.name}: {item.currentQty} {item.unit} remaining
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stock items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stock table */}
        <Card>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Item", "Unit", "Current Qty", "Reorder Level", "Cost/Unit", "Stock Value", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                    <td className={cn(
                      "px-4 py-3 font-semibold",
                      item.isLow ? "text-red-400" : "text-green-400",
                    )}>
                      {Number(item.currentQty).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{Number(item.reorderLevel).toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.costPerUnit)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(Number(item.currentQty) * Number(item.costPerUnit))}
                    </td>
                    <td className="px-4 py-3">
                      {item.isLow ? (
                        <Badge variant="warning" className="text-xs">
                          <TrendingDown className="mr-1 h-2.5 w-2.5" />
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-xs">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {search ? "No items match your search" : "No inventory items yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Stock value footer */}
          {stock.length > 0 && (
            <div className="border-t border-border px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Inventory Value</span>
              <span className="font-bold">
                {formatCurrency(
                  stock.reduce((sum: number, i: any) => sum + Number(i.currentQty) * Number(i.costPerUnit), 0),
                )}
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Stock Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Item name (e.g. Chicken Breast)"
              value={newItem.name}
              onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-12 rounded-lg border border-input bg-transparent px-3 text-sm"
                value={newItem.unit}
                onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
              >
                {["kg", "g", "litre", "ml", "piece", "dozen", "box"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Current qty"
                value={newItem.currentQty}
                onChange={(e) => setNewItem((p) => ({ ...p, currentQty: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Reorder level"
                value={newItem.reorderLevel}
                onChange={(e) => setNewItem((p) => ({ ...p, reorderLevel: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Cost per unit (₹)"
                value={newItem.costPerUnit}
                onChange={(e) => setNewItem((p) => ({ ...p, costPerUnit: e.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={!newItem.name || addStock.isPending}
              onClick={() => addStock.mutate({
                name: newItem.name,
                unit: newItem.unit,
                currentQty: parseFloat(newItem.currentQty) || 0,
                reorderLevel: parseFloat(newItem.reorderLevel) || 0,
                costPerUnit: parseFloat(newItem.costPerUnit) || 0,
              })}
            >
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
