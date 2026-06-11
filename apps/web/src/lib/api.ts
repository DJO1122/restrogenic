import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// The response interceptor unwraps to res.data, so callers receive the payload
// directly. Type the exported client so methods resolve to that payload (any),
// not AxiosResponse.
type ApiClient = {
  get: (url: string, config?: any) => Promise<any>;
  post: (url: string, data?: any, config?: any) => Promise<any>;
  put: (url: string, data?: any, config?: any) => Promise<any>;
  patch: (url: string, data?: any, config?: any) => Promise<any>;
  delete: (url: string, config?: any) => Promise<any>;
};

const client = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

client.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("auth-store");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch {}
    }
  }
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("auth-store");
      window.location.href = "/login";
    }
    return Promise.reject(err.response?.data || err);
  },
);

export const api = client as unknown as ApiClient;

// Auth
export const authApi = {
  login: (data: any) => api.post("/auth/login", data),
  pinLogin: (data: any) => api.post("/auth/pin-login", data),
  me: () => api.get("/auth/me"),
  setup: (data: any) => api.post("/auth/setup", data),
};

// Menu
export const menuApi = {
  getCategories: () => api.get("/menu/categories"),
  getItems: (params?: any) => api.get("/menu/items", { params }),
  createCategory: (data: any) => api.post("/menu/categories", data),
  updateCategory: (id: string, data: any) => api.put(`/menu/categories/${id}`, data),
  createItem: (data: any) => api.post("/menu/items", data),
  updateItem: (id: string, data: any) => api.put(`/menu/items/${id}`, data),
  toggleItem: (id: string) => api.patch(`/menu/items/${id}/toggle`),
  deleteItem: (id: string) => api.delete(`/menu/items/${id}`),
};

// Orders
export const ordersApi = {
  create: (data: any) => api.post("/orders", data),
  list: (params?: any) => api.get("/orders", { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string) => api.put(`/orders/${id}/status`, { status }),
  hold: (id: string) => api.patch(`/orders/${id}/hold`),
  addItems: (id: string, items: any[]) => api.post(`/orders/${id}/items`, { items }),
  cancelItem: (orderId: string, itemId: string) => api.delete(`/orders/${orderId}/items/${itemId}`),
  kitchen: () => api.get("/orders/kitchen"),
  markItemReady: (orderId: string, itemId: string) => api.patch(`/orders/${orderId}/items/${itemId}/ready`),
};

// Payments
export const paymentsApi = {
  process: (orderId: string, payments: any[]) => api.post(`/payments/orders/${orderId}/pay`, { payments }),
  refund: (orderId: string, reason: string, amount?: number) =>
    api.post(`/payments/orders/${orderId}/refund`, { reason, amount }),
};

// Tables
export const tablesApi = {
  list: () => api.get("/tables"),
  create: (data: any) => api.post("/tables", data),
  update: (id: string, data: any) => api.put(`/tables/${id}`, data),
  updateLayout: (tables: any[]) => api.put("/tables/layout", { tables }),
};

// Dashboard
export const dashboardApi = {
  today: () => api.get("/dashboard/today"),
  trend: () => api.get("/dashboard/trend"),
  sales: (from: string, to: string) => api.get("/dashboard/sales", { params: { from, to } }),
};

// Customers
export const customersApi = {
  lookup: (phone: string) => api.get("/customers/lookup", { params: { phone } }),
  findOrCreate: (data: any) => api.post("/customers", data),
  list: (search?: string) => api.get("/customers", { params: { search } }),
};

// Inventory
export const inventoryApi = {
  getStock: () => api.get("/inventory/stock"),
  getLowStock: () => api.get("/inventory/stock/low"),
  addStock: (data: any) => api.post("/inventory/stock", data),
  updateStock: (id: string, data: any) => api.put(`/inventory/stock/${id}`, data),
  getSuppliers: () => api.get("/inventory/suppliers"),
};

// Billing (owner-facing: trial status + upgrade)
export const billingApi = {
  status: () => api.get("/billing/status"),
  subscribe: (planId?: string) => api.post("/billing/subscribe", { planId }),
  plans: () => api.get("/auth/plans"),
};
