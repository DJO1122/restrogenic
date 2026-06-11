"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { PosHeader } from "@/components/pos/PosHeader";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Users, BarChart3, RefreshCw } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COLORS = ["#f97316", "#3b82f6", "#a855f7", "#22c55e", "#ec4899"];

export default function DashboardPage() {
  const { data: today, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: dashboardApi.today,
    refetchInterval: 30000,
  });

  const { data: trend = [] } = useQuery({
    queryKey: ["dashboard", "trend"],
    queryFn: dashboardApi.trend,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <PosHeader />
        <div className="flex flex-1 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const stats = today?.today;
  const comp = today?.comparison;

  const statCards = [
    {
      title: "Today's Revenue",
      value: formatCurrency(stats?.revenue || 0),
      change: comp?.revenueChange,
      icon: DollarSign,
      color: "text-green-400",
    },
    {
      title: "Total Orders",
      value: stats?.orders || 0,
      change: comp?.ordersChange,
      icon: ShoppingBag,
      color: "text-blue-400",
    },
    {
      title: "Avg Order Value",
      value: formatCurrency(stats?.averageOrderValue || 0),
      icon: BarChart3,
      color: "text-purple-400",
    },
    {
      title: "Covers",
      value: stats?.covers || 0,
      icon: Users,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      <PosHeader />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map(({ title, value, change, icon: Icon, color }) => (
            <Card key={title}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{title}</p>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <p className="mt-2 text-2xl font-bold">{value}</p>
                {change !== undefined && (
                  <div className={cn(
                    "mt-1 flex items-center gap-1 text-xs font-medium",
                    Number(change) >= 0 ? "text-green-400" : "text-red-400",
                  )}>
                    {Number(change) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(Number(change))}% vs yesterday
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Hourly sales chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Hourly Sales Today</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={today?.hourlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${h}:00`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: any) => [formatCurrency(v), "Revenue"]}
                    labelFormatter={(h) => `${h}:00`}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payment breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              {today?.paymentBreakdown?.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={today.paymentBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="amount"
                      nameKey="method"
                    >
                      {today.paymentBreakdown.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: any) => formatCurrency(v)}
                    />
                    <Legend
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                  No payments today
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 30-day trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">30-Day Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).getDate().toString()}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    interval={4}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: any) => [formatCurrency(v), "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Items Today</CardTitle>
            </CardHeader>
            <CardContent>
              {today?.topItems?.length > 0 ? (
                <div className="space-y-2">
                  {today.topItems.slice(0, 7).map((item: any, i: number) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted-foreground">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <div className="mt-0.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${(Number(item.revenue) / Number(today.topItems[0].revenue)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-semibold">{formatCurrency(item.revenue)}</p>
                        <p className="text-muted-foreground">{item.quantity} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                  No sales data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
