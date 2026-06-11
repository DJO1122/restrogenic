"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menuApi } from "@/lib/api";
import { PosHeader } from "@/components/pos/PosHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { Plus, Pencil, ToggleLeft, ToggleRight, Trash2, Search } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", description: "" });
  const [newItem, setNewItem] = useState({
    name: "", description: "", basePrice: "", categoryId: "", isVeg: true, taxCategory: "GST_5",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: menuApi.getCategories,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => menuApi.getItems(),
  });

  const toggleItem = useMutation({
    mutationFn: menuApi.toggleItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: menuApi.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast({ title: "Item deleted", variant: "success" });
    },
  });

  const createCategory = useMutation({
    mutationFn: menuApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
      toast({ title: "Category created", variant: "success" });
      setAddCatOpen(false);
      setNewCat({ name: "", description: "" });
    },
  });

  const createItem = useMutation({
    mutationFn: menuApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast({ title: "Menu item added", variant: "success" });
      setAddItemOpen(false);
      setNewItem({ name: "", description: "", basePrice: "", categoryId: "", isVeg: true, taxCategory: "GST_5" });
    },
  });

  const displayItems = (allItems as any[]).filter((item: any) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || item.categoryId === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <PosHeader />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Menu Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {(allItems as any[]).length} items across {categories.length} categories
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddCatOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Category
            </Button>
            <Button onClick={() => setAddItemOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Menu Item
            </Button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                activeCategory === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              All
            </button>
            {(categories as any[]).map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                  activeCategory === cat.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Items grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayItems.map((item: any) => (
            <Card key={item.id} className={cn(!item.isAvailable && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={cn(
                        "h-3.5 w-3.5 rounded border flex items-center justify-center",
                        item.isVeg ? "border-green-500" : "border-red-500",
                      )}>
                        <div className={cn("h-2 w-2 rounded-full", item.isVeg ? "bg-green-500" : "bg-red-500")} />
                      </div>
                      <p className="font-medium text-sm truncate">{item.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.category?.name}</p>
                    {item.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    <p className="mt-2 text-sm font-bold text-primary">{formatCurrency(item.basePrice)}</p>
                    {item.variants?.length > 0 && (
                      <p className="text-xs text-muted-foreground">{item.variants.length} variants</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1">
                  <button
                    onClick={() => toggleItem.mutate(item.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                      item.isAvailable
                        ? "text-green-400 hover:bg-green-500/10"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {item.isAvailable ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                    {item.isAvailable ? "Available" : "Unavailable"}
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete "${item.name}"?`)) deleteItem.mutate(item.id);
                    }}
                    className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          {displayItems.length === 0 && (
            <div className="col-span-full flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
              {search ? `No items matching "${search}"` : "No menu items yet"}
            </div>
          )}
        </div>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Category name" value={newCat.name} onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Description (optional)" value={newCat.description} onChange={(e) => setNewCat((p) => ({ ...p, description: e.target.value }))} />
            <Button className="w-full" disabled={!newCat.name || createCategory.isPending} onClick={() => createCategory.mutate(newCat)}>
              Create Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Menu Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Description (optional)" value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Base price (₹)" value={newItem.basePrice} onChange={(e) => setNewItem((p) => ({ ...p, basePrice: e.target.value }))} />
              <select
                className="h-12 rounded-lg border border-input bg-transparent px-3 text-sm"
                value={newItem.categoryId}
                onChange={(e) => setNewItem((p) => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">Select category</option>
                {(categories as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-12 rounded-lg border border-input bg-transparent px-3 text-sm"
                value={newItem.taxCategory}
                onChange={(e) => setNewItem((p) => ({ ...p, taxCategory: e.target.value }))}
              >
                <option value="GST_5">GST 5%</option>
                <option value="GST_12">GST 12%</option>
                <option value="GST_18">GST 18%</option>
                <option value="EXEMPT">Tax Exempt</option>
              </select>
              <div className="flex items-center gap-3 rounded-lg border border-input px-3">
                <button onClick={() => setNewItem((p) => ({ ...p, isVeg: true }))} className={cn("text-xs font-medium px-2 py-1 rounded", newItem.isVeg ? "text-green-400" : "text-muted-foreground")}>Veg</button>
                <button onClick={() => setNewItem((p) => ({ ...p, isVeg: false }))} className={cn("text-xs font-medium px-2 py-1 rounded", !newItem.isVeg ? "text-red-400" : "text-muted-foreground")}>Non-Veg</button>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!newItem.name || !newItem.basePrice || !newItem.categoryId || createItem.isPending}
              onClick={() => createItem.mutate({ ...newItem, basePrice: parseFloat(newItem.basePrice) })}
            >
              Add to Menu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
