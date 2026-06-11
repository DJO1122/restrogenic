"use client";

import { useState, useMemo } from "react";
import { useOrderStore } from "@/store/orderStore";
import { Search, Leaf, Flame, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface MenuGridProps {
  categories: any[];
}

export function MenuGrid({ categories }: MenuGridProps) {
  const { addItem } = useOrderStore();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allItems = useMemo(() => categories.flatMap((c) => c.items || []), [categories]);

  const displayItems = useMemo(() => {
    const items = activeCategory === "all" ? allItems : categories.find((c) => c.id === activeCategory)?.items || [];
    if (!search) return items;
    return items.filter((i: any) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [activeCategory, allItems, categories, search]);

  function handleAddItem(item: any, variant?: any) {
    if (!item.isAvailable) {
      toast({ title: "Item unavailable", description: `${item.name} is currently out of stock`, variant: "destructive" });
      return;
    }

    addItem({
      menuItemId: item.id,
      variantId: variant?.id,
      name: item.name,
      variantName: variant?.name,
      unitPrice: variant ? Number(variant.price) : Number(item.basePrice),
      taxCategory: item.taxCategory,
    });

    toast({ title: `${item.name} added`, variant: "success" });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="p-3 pb-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search menu... (or press /)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto px-3 py-2 scrollbar-none">
        <button
          onClick={() => { setActiveCategory("all"); setSearch(""); }}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            activeCategory === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:text-foreground border border-border",
          )}
        >
          All ({allItems.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setSearch(""); }}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground border border-border",
            )}
          >
            {cat.name} ({cat.items?.length || 0})
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-3 pt-0">
        {displayItems.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {search ? `No results for "${search}"` : "No items in this category"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3 2xl:grid-cols-4">
            {displayItems.map((item: any) => (
              <MenuItemCard key={item.id} item={item} onAdd={handleAddItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItemCard({ item, onAdd }: { item: any; onAdd: (item: any, variant?: any) => void }) {
  const [showVariants, setShowVariants] = useState(false);
  const hasVariants = item.variants && item.variants.length > 0;

  return (
    <div
      className={cn(
        "menu-item-card relative",
        !item.isAvailable && "out-of-stock",
      )}
      onClick={() => {
        if (!item.isAvailable) return;
        if (hasVariants) {
          setShowVariants(!showVariants);
        } else {
          onAdd(item);
        }
      }}
    >
      {/* Veg/Non-veg indicator */}
      <div className="mb-2 flex items-start justify-between">
        <div
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border",
            item.isVeg ? "border-green-500" : "border-red-500",
          )}
        >
          <div className={cn("h-2 w-2 rounded-full", item.isVeg ? "bg-green-500" : "bg-red-500")} />
        </div>

        {!item.isAvailable && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0">SOLD OUT</Badge>
        )}
      </div>

      {/* Item details */}
      <p className="text-sm font-medium leading-tight">{item.name}</p>
      {item.description && (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">
          {formatCurrency(item.basePrice)}
        </span>
        {hasVariants ? (
          <span className="text-xs text-muted-foreground">{item.variants.length} options</span>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plus className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {/* Variants dropdown */}
      {showVariants && hasVariants && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-xl border border-border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            Select size
          </p>
          {item.variants.map((v: any) => (
            <button
              key={v.id}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              onClick={() => { onAdd(item, v); setShowVariants(false); }}
            >
              <span>{v.name}</span>
              <span className="font-semibold text-primary">{formatCurrency(v.price)}</span>
            </button>
          ))}
          <button
            className="w-full border-t border-border px-3 py-2 text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowVariants(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
