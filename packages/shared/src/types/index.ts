export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "ONLINE";
export type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED" | "HELD";
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "WALLET" | "LOYALTY_POINTS" | "SPLIT";
export type UserRole = "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN" | "ACCOUNTANT";
export type TaxCategory = "GST_5" | "GST_12" | "GST_18" | "GST_28" | "EXEMPT";

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  taxCategory: TaxCategory;
  isVeg: boolean;
  isAvailable: boolean;
  variants?: ItemVariant[];
  addons?: ItemAddon[];
}

export interface ItemVariant {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface ItemAddon {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  tableId?: string;
  customerId?: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  total: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  isReady: boolean;
}

export interface DashboardStats {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  covers: number;
}
