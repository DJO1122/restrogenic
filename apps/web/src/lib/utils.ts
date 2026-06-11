import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "INR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    CONFIRMED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PREPARING: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    READY: "bg-green-500/20 text-green-400 border-green-500/30",
    SERVED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    COMPLETED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
    HELD: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return colors[status] || "bg-gray-500/20 text-gray-400";
}

export function getTableStatusColor(status: string): string {
  const colors: Record<string, string> = {
    AVAILABLE: "border-green-500 bg-green-500/10 text-green-400",
    OCCUPIED: "border-red-500 bg-red-500/10 text-red-400",
    RESERVED: "border-yellow-500 bg-yellow-500/10 text-yellow-400",
    CLEANING: "border-blue-500 bg-blue-500/10 text-blue-400",
  };
  return colors[status] || "";
}

export function calculateGST(amount: number, rate: number, isIntraState = true) {
  const taxAmount = amount * rate;
  if (isIntraState) {
    return { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: taxAmount };
}

export function playSound(type: "order" | "payment" | "alert") {
  if (typeof window === "undefined") return;
  const sounds: Record<string, number[]> = {
    order: [440, 550],
    payment: [523, 659, 784],
    alert: [220, 180],
  };
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  sounds[type].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.2);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.2);
  });
}
