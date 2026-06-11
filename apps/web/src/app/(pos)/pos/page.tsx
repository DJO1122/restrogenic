"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menuApi, ordersApi, tablesApi } from "@/lib/api";
import { useOrderStore } from "@/store/orderStore";
import { useAuthStore } from "@/store/authStore";
import { MenuGrid } from "@/components/pos/MenuGrid";
import { OrderCart } from "@/components/pos/OrderCart";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { CustomerLookup } from "@/components/pos/CustomerLookup";
import { OrderTypeSelector } from "@/components/pos/OrderTypeSelector";
import { PosHeader } from "@/components/pos/PosHeader";
import { toast } from "@/components/ui/toaster";
import { playSound } from "@/lib/utils";

export default function PosPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { draft, clearCart } = useOrderStore();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState<any[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: menuApi.getCategories,
    staleTime: 60000,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["tables"],
    queryFn: tablesApi.list,
    refetchInterval: 15000,
  });

  const createOrder = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (order: any) => {
      playSound("order");
      toast({ title: `Order ${order.orderNumber} created!`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      clearCart();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create order", description: err?.message, variant: "destructive" });
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "p" || e.key === "P") setPaymentOpen(true);
      if (e.key === "Escape") setPaymentOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function handlePlaceOrder() {
    if (draft.items.length === 0) {
      toast({ title: "Cart is empty", description: "Add items before placing order", variant: "destructive" });
      return;
    }
    if (draft.orderType === "DINE_IN" && !draft.tableId) {
      toast({ title: "Select a table", description: "Choose a table for dine-in orders", variant: "destructive" });
      return;
    }

    createOrder.mutate({
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
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <PosHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Menu */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-border">
          <div className="border-b border-border p-3">
            <OrderTypeSelector tables={tables} />
          </div>

          <div className="flex-1 overflow-hidden">
            <MenuGrid categories={categories} />
          </div>
        </div>

        {/* Right: Cart */}
        <div className="flex w-[400px] flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Current Order</h2>
            <CustomerLookup />
          </div>

          <OrderCart
            onPay={() => setPaymentOpen(true)}
            onPlaceOrder={handlePlaceOrder}
            isPlacing={createOrder.isPending}
          />
        </div>
      </div>

      <PaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </div>
  );
}
