"use client";

import { useState } from "react";
import { useOrderStore } from "@/store/orderStore";
import { customersApi } from "@/lib/api";
import { User, Phone, Star, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

export function CustomerLookup() {
  const { draft, setCustomer } = useOrderStore();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [customer, setCustomerResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [newName, setNewName] = useState("");

  async function lookup() {
    if (phone.length < 10) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res: any = await customersApi.lookup(phone);
      if (res) {
        setCustomerResult(res);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function createAndSelect() {
    setLoading(true);
    try {
      const res: any = await customersApi.findOrCreate({ phone, name: newName || phone });
      setCustomerResult(res);
    } finally {
      setLoading(false);
    }
  }

  function selectCustomer(c: any) {
    setCustomer(c.id, c.name, c.phone);
    setOpen(false);
    setCustomerResult(null);
    setPhone("");
  }

  function clearCustomer() {
    setCustomer("", "", "");
  }

  return (
    <>
      {draft.customerId ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">{draft.customerName}</span>
          <button onClick={clearCustomer} className="text-muted-foreground hover:text-destructive ml-1">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          <User className="h-3.5 w-3.5" />
          Customer
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Find Customer</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="pl-9"
                maxLength={10}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
              />
            </div>
            <Button onClick={lookup} disabled={phone.length < 10 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {customer && (
            <div
              className="cursor-pointer rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
              onClick={() => selectCustomer(customer)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  {customer.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="flex items-center gap-1 text-yellow-400 text-sm font-semibold">
                    <Star className="h-3.5 w-3.5 fill-yellow-400" />
                    {customer.loyaltyPoints}
                  </div>
                  <p className="text-xs text-muted-foreground">{customer.totalOrders} orders</p>
                </div>
              </div>
              {customer.totalSpent > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Total spent: {formatCurrency(customer.totalSpent)}
                </p>
              )}
            </div>
          )}

          {notFound && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Customer not found. Create new?</p>
              <Input
                placeholder="Customer name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button onClick={createAndSelect} disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create & Select
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
