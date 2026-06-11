import { create } from "zustand";

export interface CartItem {
  menuItemId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  discountAmount?: number;
  taxCategory?: string;
}

export interface OrderDraft {
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "ONLINE";
  tableId?: string;
  tableName?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: CartItem[];
  discountAmount: number;
  discountPercent: number;
  applyServiceCharge: boolean;
  couponCode?: string;
}

interface OrderStore {
  draft: OrderDraft;
  setOrderType: (type: OrderDraft["orderType"]) => void;
  setTable: (id: string, name: string) => void;
  setCustomer: (id: string, name: string, phone: string) => void;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (menuItemId: string, variantId: string | undefined, delta: number) => void;
  removeItem: (menuItemId: string, variantId?: string) => void;
  updateItemNotes: (menuItemId: string, variantId: string | undefined, notes: string) => void;
  setDiscount: (amount: number, percent: number) => void;
  toggleServiceCharge: () => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
}

const defaultDraft: OrderDraft = {
  orderType: "DINE_IN",
  items: [],
  discountAmount: 0,
  discountPercent: 0,
  applyServiceCharge: false,
};

const TAX_RATES: Record<string, number> = {
  GST_5: 0.05,
  GST_12: 0.12,
  GST_18: 0.18,
  GST_28: 0.28,
  EXEMPT: 0,
};

export const useOrderStore = create<OrderStore>((set, get) => ({
  draft: { ...defaultDraft },

  setOrderType: (type) => set((s) => ({ draft: { ...s.draft, orderType: type, tableId: undefined, tableName: undefined } })),
  setTable: (id, name) => set((s) => ({ draft: { ...s.draft, tableId: id, tableName: name } })),
  setCustomer: (id, name, phone) => set((s) => ({ draft: { ...s.draft, customerId: id, customerName: name, customerPhone: phone } })),

  addItem: (item) =>
    set((s) => {
      const existing = s.draft.items.findIndex(
        (i) => i.menuItemId === item.menuItemId && i.variantId === item.variantId,
      );
      if (existing >= 0) {
        const items = [...s.draft.items];
        items[existing] = { ...items[existing], quantity: items[existing].quantity + (item.quantity || 1) };
        return { draft: { ...s.draft, items } };
      }
      return { draft: { ...s.draft, items: [...s.draft.items, { ...item, quantity: item.quantity || 1 }] } };
    }),

  updateQuantity: (menuItemId, variantId, delta) =>
    set((s) => {
      const items = s.draft.items
        .map((i) =>
          i.menuItemId === menuItemId && i.variantId === variantId
            ? { ...i, quantity: i.quantity + delta }
            : i,
        )
        .filter((i) => i.quantity > 0);
      return { draft: { ...s.draft, items } };
    }),

  removeItem: (menuItemId, variantId) =>
    set((s) => ({
      draft: {
        ...s.draft,
        items: s.draft.items.filter((i) => !(i.menuItemId === menuItemId && i.variantId === variantId)),
      },
    })),

  updateItemNotes: (menuItemId, variantId, notes) =>
    set((s) => ({
      draft: {
        ...s.draft,
        items: s.draft.items.map((i) =>
          i.menuItemId === menuItemId && i.variantId === variantId ? { ...i, notes } : i,
        ),
      },
    })),

  setDiscount: (amount, percent) =>
    set((s) => ({ draft: { ...s.draft, discountAmount: amount, discountPercent: percent } })),

  toggleServiceCharge: () =>
    set((s) => ({ draft: { ...s.draft, applyServiceCharge: !s.draft.applyServiceCharge } })),

  clearCart: () => set({ draft: { ...defaultDraft } }),

  getSubtotal: () => {
    const { items } = get().draft;
    return items.reduce((sum, i) => sum + i.unitPrice * i.quantity - (i.discountAmount || 0), 0);
  },

  getTaxAmount: () => {
    const { items } = get().draft;
    return items.reduce((sum, i) => {
      const rate = TAX_RATES[i.taxCategory || "GST_5"] || 0.05;
      const itemTotal = i.unitPrice * i.quantity - (i.discountAmount || 0);
      return sum + itemTotal * rate;
    }, 0);
  },

  getTotal: () => {
    const { draft } = get();
    const subtotal = get().getSubtotal();
    const tax = get().getTaxAmount();
    const discount = draft.discountPercent > 0 ? subtotal * (draft.discountPercent / 100) : draft.discountAmount;
    const serviceCharge = draft.applyServiceCharge ? (subtotal - discount) * 0.05 : 0;
    return subtotal - discount + tax + serviceCharge;
  },
}));
