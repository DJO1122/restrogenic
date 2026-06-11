"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChefHat, Loader2, ArrowRight } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    restaurantName: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
  });

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await authApi.setup(form);
      setAuth(res.accessToken, res.user);
      toast({ title: `Welcome to RestroGenie, ${form.ownerName}!`, variant: "success" });
      router.push("/pos");
    } catch (err: any) {
      toast({ title: "Setup failed", description: err?.message?.error || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold">Welcome to RestroGenie</h1>
            <p className="mt-1 text-sm text-muted-foreground">Set up your restaurant in 60 seconds</p>
          </div>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Restaurant Name</label>
            <Input placeholder="e.g. Spice Garden" value={form.restaurantName} onChange={(e) => update("restaurantName", e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Your Name (Owner)</label>
            <Input placeholder="e.g. Rahul Kumar" value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone Number</label>
            <Input type="tel" placeholder="+91-9999999999" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email Address</label>
            <Input type="email" placeholder="owner@restaurant.com" value={form.email} onChange={(e) => update("email", e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
            <Input type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={8} />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Set Up Restaurant
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already set up?{" "}
          <a href="/login" className="text-primary hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
