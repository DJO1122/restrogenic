"use client";

import { useState } from "react";
import { useOrderStore } from "@/store/orderStore";
import { Minus, Plus, Trash2, Tag, ChevronDown, CreditCard, ShoppingCart, Loader2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";

interface OrderCartProps {
  onPay: () => void;
  onPlaceOrder: () => void;
  isPlacing: boolean;
}

export function OrderCart({ onPay, onPlaceOrder, isPlacing }: OrderCartProps) {
  const {
    draft, updateQuantity, removeItem, updateItemNotes,
    setDiscount, toggleServiceCharge, clearCart,
    getSubtotal, getTaxAmount, getTotal,
  } = useOrderStore();

  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState<"flat" | "percent">("percent");
  const [editingNote, setEditingNote] = useState<string | null>(null);

  const subtotal = getSubtotal();
  const taxAmount = getTaxAmount();
  const discount = draft.discountPercent > 0 ? subtotal * (draft.discountPercent / 100) : draft.discountAmount;
  const serviceCharge = draft.applyServiceCharge ? (subtotal - discount) * 0.05 : 0;
  const total = getTotal();

  function applyDiscount() {
    const val = parseFloat(discountInput) || 0;
    if (discountType === "percent") {
      setDiscount(0, Math.min(val, 100));
    } else {
      setDiscount(Math.min(val, subtotal), 0);
    }
    setShowDiscount(false);
  }

  if (draft.items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <ShoppingCart className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Cart is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Tap items from the menu to add them</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {draft.items.map((item) => (
          <div key={`${item.menuItemId}-${item.variantId}`} className="rounded-xl border border-border bg-card/50 p-3">
            <div className="flex items-start gap-2">
              {/* Qty controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQuantity(item.menuItemId, item.variantId, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary transition-colors hover:bg-destructive/20 hover:text-destructive"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.menuItemId, item.variantId, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary transition-colors hover:bg-primary/20 hover:text-primary"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {item.variantName && (
                  <p className="text-xs text-muted-foreground">{item.variantName}</p>
                )}
                {/* Notes inline edit */}
                {editingNote === `${item.menuItemId}-${item.variantId}` ? (
                  <input
                    autoFocus
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. no onion, extra spicy"
                    defaultValue={item.notes}
                    onBlur={(e) => {
                      updateItemNotes(item.menuItemId, item.variantId, e.target.value);
                      setEditingNote(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingNote(null);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingNote(`${item.menuItemId}-${item.variantId}`)}
                    className="mt-0.5 text-left text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.notes || "+ Add note"}
                  </button>
                )}
              </div>

              {/* Price */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
                <button
                  onClick={() => removeItem(item.menuItemId, item.variantId)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals & Actions */}
      <div className="border-t border-border p-3 space-y-3">
        {/* Discount toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiscount(!showDiscount)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Tag className="h-3.5 w-3.5" />
            {discount > 0 ? `Discount (${formatCurrency(discount)})` : "Add Discount"}
          </button>

          <button
            onClick={toggleServiceCharge}
            className={cn(
              "ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
              draft.applyServiceCharge
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30",
            )}
          >
            Svc. Charge {draft.applyServiceCharge ? "5% ✓" : ""}
          </button>
        </div>

        {/* Discount input */}
        {showDiscount && (
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setDiscountType("percent")}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  discountType === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                <Percent className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDiscountType("flat")}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  discountType === "flat" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                ₹
              </button>
            </div>
            <Input
              type="number"
              placeholder={discountType === "percent" ? "0-100%" : "Amount"}
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              className="h-9 flex-1 text-sm"
              onKeyDown={(e) => e.key === "Enter" && applyDiscount()}
            />
            <Button size="sm" onClick={applyDiscount} className="h-9">Apply</Button>
          </div>
        )}

        {/* Totals breakdown */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount {draft.discountPercent > 0 ? `(${draft.discountPercent}%)` : ""}</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>GST</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          {serviceCharge > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Service Charge (5%)</span>
              <span>{formatCurrency(serviceCharge)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={clearCart}
            className="text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={onPlaceOrder}
            disabled={isPlacing}
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            {isPlacing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            KOT
          </Button>
        </div>

        <Button
          size="lg"
          className="w-full text-base"
          onClick={onPay}
          disabled={draft.items.length === 0}
        >
          <CreditCard className="mr-2 h-5 w-5" />
          Pay {formatCurrency(total)} [P]
        </Button>
      </div>
    </div>
  );
}
