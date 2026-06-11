"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChefHat, Loader2, Lock, Mail, Hash } from "lucide-react";

type LoginMode = "email" | "pin";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<LoginMode>("email");
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");

  // Email login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await authApi.login({ email, password });
      setAuth(res.accessToken, res.user);
      toast({ title: `Welcome back, ${res.user.name}!`, variant: "success" });
      router.push("/pos");
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message?.error || "Invalid credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handlePinLogin() {
    if (pin.length < 4) return;
    setLoading(true);
    try {
      const res: any = await authApi.pinLogin({ pin });
      setAuth(res.accessToken, res.user);
      toast({ title: `Welcome, ${res.user.name}!`, variant: "success" });
      router.push("/pos");
    } catch {
      toast({ title: "Invalid PIN", variant: "destructive" });
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function handlePinKey(digit: string) {
    if (digit === "del") {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length >= 4) {
        setTimeout(() => {
          if (newPin.length === newPin.length) handlePinLogin();
        }, 100);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">RestroGenie</h1>
            <p className="text-sm text-muted-foreground">AI-Powered Restaurant Management</p>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="mb-6 flex rounded-xl border border-border p-1">
          {(["email", "pin"] as LoginMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "email" ? "Email Login" : "PIN Login"}
            </button>
          ))}
        </div>

        {mode === "email" ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* PIN display */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-12 w-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                    i < pin.length
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {i < pin.length ? "●" : ""}
                </div>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {["1","2","3","4","5","6","7","8","9","","0","del"].map((k) => (
                <button
                  key={k}
                  onClick={() => k && handlePinKey(k)}
                  disabled={!k || loading}
                  className={`h-16 rounded-xl border border-border text-lg font-semibold transition-all active:scale-95 disabled:opacity-0 ${
                    k === "del"
                      ? "bg-secondary text-foreground hover:bg-secondary/80"
                      : "bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  {k === "del" ? "⌫" : k}
                </button>
              ))}
            </div>

            {loading && (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          First time?{" "}
          <a href="/setup" className="text-primary hover:underline">
            Set up your restaurant
          </a>
        </p>
      </div>
    </div>
  );
}
