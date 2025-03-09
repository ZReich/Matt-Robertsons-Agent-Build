"use client"

import { Area, AreaChart, Line, LineChart } from "recharts"
import {
  BadgePercent,
  CreditCard,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"

// Sample data for charts
const areaData = [
  { value: 30 },
  { value: 40 },
  { value: 35 },
  { value: 45 },
  { value: 35 },
  { value: 50 },
]

const lineData = [
  { value: 20 },
  { value: 40 },
  { value: 30 },
  { value: 50 },
  { value: 35 },
  { value: 45 },
]

export default function StatsCards() {
  return (
    <div className="col-span-full grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Simple Metric Card */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="p-2 bg-violet-100 rounded-lg dark:bg-violet-900">
            <ShoppingCart className="w-6 h-6 text-violet-600 dark:text-violet-100" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Sales</p>
            <p className="text-2xl font-bold">230k</p>
          </div>
        </CardContent>
      </Card>

      {/* Card with Line Chart */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Customers
              </p>
              <p className="text-2xl font-bold">8,549k</p>
            </div>
            <div className="p-2 bg-cyan-100 rounded-lg dark:bg-cyan-900">
              <Users className="w-6 h-6 text-cyan-600 dark:text-cyan-100" />
            </div>
          </div>
          <div className="h-[50px]">
            <ChartContainer config={{}}>
              <LineChart data={lineData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Card with Area Chart */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Products
              </p>
              <p className="text-2xl font-bold">1,423k</p>
            </div>
            <div className="p-2 bg-rose-100 rounded-lg dark:bg-rose-900">
              <Package className="w-6 h-6 text-rose-600 dark:text-rose-100" />
            </div>
          </div>
          <div className="h-[50px]">
            <ChartContainer config={{}}>
              <AreaChart data={areaData}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Card with Percentage */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Revenue
              </p>
              <p className="text-2xl font-bold">$9,745</p>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900">
              <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-100" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-emerald-500">
              +12.6% from last month
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
