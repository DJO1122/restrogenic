"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi, ordersApi } from "@/lib/api";
import { useOrderStore } from "@/store/orderStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, playSound } from "@/lib/utils";
import { Banknote, CreditCard, Smartphone, Loader2, CheckCircle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentEntry {
  method: "CASH" | "CARD" | "UPI" | "WALLET";
  amount: string;
  cashTendered?: string;
  reference?: string;
}

const PAYMENT_METHODS = [
  { method: "CASH" as const, label: "Cash", icon: Banknote, color: "text-green-400" },
  { method: "CARD" as const, label: "Card", icon: CreditCard, color: "text-blue-400" },
  { method: "UPI" as const, label: "UPI / QR", icon: Smartphone, color: "text-purple-400" },
];

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  existingOrderId?: string; // for paying an existing held/active order
}

export function PaymentModal({ open, onClose, existingOrderId }: PaymentModalProps) {
  const queryClient = useQueryClient();
  const { draft, getTotal, clearCart } = useOrderStore();
  const total = getTotal();

  const [entries, setEntries] = useState<PaymentEntry[]>([{ method: "CASH", amount: total.toFixed(2) }]);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(existingOrderId || null);

  const totalPaid = entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const change = Math.max(0, totalPaid - total);
  const remaining = Math.max(0, total - totalPaid);

  const createAndPay = useMutation({
    mutationFn: async () => {
      let oid = orderId;

      if (!oid) {
        // Create order first if not already created
        const order: any = await ordersApi.create({
          orderType: draft.orderType,
          tableId: draft.tableId,
          customerId: draft.customerId,
          customerName: draft.customerName,
          customerPhone: draft.customerPhone,
          notes: draft.notes,
          items: draft.items.map((i) => ({
            menuItemId: i.menuItemId,
            variantId: i.variantId,
            name: i.name,
            variantName: i.variantName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            notes: i.notes,
            discountAmount: i.discountAmount,
          })),
          discountAmount: draft.discountAmount,
          discountPercent: draft.discountPercent,
          applyServiceCharge: draft.applyServiceCharge,
        });
        oid = order.id;
        setOrderId(oid);
      }

      return paymentsApi.process(
        oid!,
        entries.map((e) => ({
          method: e.method,
          amount: parseFloat(e.amount),
          cashTendered: e.cashTendered ? parseFloat(e.cashTendered) : undefined,
          reference: e.reference,
        })),
      );
    },
    onSuccess: (completedOrder: any) => {
      playSound("payment");
      setSuccess(true);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => {
        setSuccess(false);
        setEntries([{ method: "CASH", amount: "" }]);
        setOrderId(null);
        onClose();
      }, 2000);
    },
    onError: (err: any) => {
      toast({ title: "Payment failed", description: err?.message, variant: "destructive" });
    },
  });

  function updateEntry(i: number, field: keyof PaymentEntry, value: string) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  function addEntry() {
    setEntries((prev) => [...prev, { method: "CASH", amount: remaining.toFixed(2) }]);
  }

  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  function quickAmount(amount: number) {
    setEntries([{ method: "CASH", amount: amount.toFixed(2), cashTendered: amount.toFixed(2) }]);
  }

  const QUICK_AMOUNTS = [
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
  ].filter((a, i, arr) => a > total && arr.indexOf(a) === i).slice(0, 4);

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-green-400">Payment Successful!</h3>
              <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(total)} received</p>
              {change > 0 && (
                <p className="mt-2 text-lg font-bold">Change: {formatCurrency(change)}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
        </DialogHeader>

        {/* Total due */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Amount Due</p>
          <p className="mt-1 text-3xl font-bold text-primary">{formatCurrency(total)}</p>
        </div>

        {/* Quick cash amounts */}
        {entries.length === 1 && entries[0].method === "CASH" && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Quick amounts</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => quickAmount(total)}
                className="rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium hover:border-primary/50 hover:text-primary transition-colors"
              >
                Exact
              </button>
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => quickAmount(a)}
                  className="rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {formatCurrency(a)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment entries */}
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                {/* Method selector */}
                <div className="flex gap-1">
                  {PAYMENT_METHODS.map(({ method, label, icon: Icon, color }) => (
                    <button
                      key={method}
                      onClick={() => updateEntry(i, "method", method)}
                      className={cn(
                        "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                        entry.method === method
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", entry.method === method ? "text-primary" : color)} />
                      {label}
                    </button>
                  ))}
                </div>
                {entries.length > 1 && (
                  <button onClick={() => removeEntry(i)} className="ml-auto text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={entry.amount}
                  onChange={(e) => updateEntry(i, "amount", e.target.value)}
                  className="h-10"
                />
                {entry.method === "CASH" && (
                  <Input
                    type="number"
                    placeholder="Cash tendered"
                    value={entry.cashTendered || ""}
                    onChange={(e) => updateEntry(i, "cashTendered", e.target.value)}
                    className="h-10"
                  />
                )}
                {(entry.method === "CARD" || entry.method === "UPI") && (
                  <Input
                    placeholder="Ref. no."
                    value={entry.reference || ""}
                    onChange={(e) => updateEntry(i, "reference", e.target.value)}
                    className="h-10"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Split payment button */}
        <button
          onClick={addEntry}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add payment method (split)
        </button>

        {/* Summary */}
        <div className="rounded-xl bg-secondary/50 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total paid</span>
            <span className={totalPaid >= total ? "text-green-400 font-semibold" : "text-foreground"}>
              {formatCurrency(totalPaid)}
            </span>
          </div>
          {remaining > 0.01 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className="text-destructive font-semibold">{formatCurrency(remaining)}</span>
            </div>
          )}
          {change > 0.01 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Change to return</span>
              <span className="text-green-400 font-bold text-base">{formatCurrency(change)}</span>
            </div>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => createAndPay.mutate()}
          disabled={createAndPay.isPending || remaining > 0.01}
        >
          {createAndPay.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Confirm Payment
        </Button>
      </DialogContent>
    </Dialog>
  );
}
