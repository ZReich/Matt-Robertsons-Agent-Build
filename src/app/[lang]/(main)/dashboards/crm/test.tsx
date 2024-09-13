"use client";

import React from "react";
import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const mockData = {
  totalSales: 1234567,
  sales: [
    { month: "January", total_sales: 45000 },
    { month: "February", total_sales: 38000 },
    { month: "March", total_sales: 52000 },
    { month: "April", total_sales: 48000 },
    { month: "May", total_sales: 61000 },
    { month: "June", total_sales: 54000 },
    { month: "July", total_sales: 58000 },
    { month: "August", total_sales: 49000 },
    { month: "September", total_sales: 52000 },
    { month: "October", total_sales: 62000 },
    { month: "November", total_sales: 68000 },
    { month: "December", total_sales: 72000 },
  ],
  totalProfit: 345678,
  profit: [
    { month: "January", total_profit: 12000 },
    { month: "February", total_profit: 9500 },
    { month: "March", total_profit: 16000 },
    { month: "April", total_profit: 14500 },
    { month: "May", total_profit: 18500 },
    { month: "June", total_profit: 17000 },
    { month: "July", total_profit: 19000 },
    { month: "August", total_profit: 14000 },
    { month: "September", total_profit: 15500 },
    { month: "October", total_profit: 21000 },
    { month: "November", total_profit: 23000 },
    { month: "December", total_profit: 25000 },
  ],
  revenueGrowth: 12.5,
  newCustomers: 45,
  salesPipeline: [
    { label: "Lead", value: 30, fill: "hsl(var(--chart-1))" },
    { label: "Proposal", value: 25, fill: "hsl(var(--chart-2))" },
    { label: "Negotiation", value: 15, fill: "hsl(var(--chart-3))" },
    { label: "Closed", value: 10, fill: "hsl(var(--chart-4))" },
  ],
  topSalesReps: [
    { name: "John Doe", sales: 50000 },
    { name: "Jane Smith", sales: 45000 },
    { name: "Bob Johnson", sales: 40000 },
  ],
  leadSources: [
    { name: "Social Media", value: 30 },
    { name: "Email Campaigns", value: 25 },
    { name: "Referrals", value: 20 },
    { name: "Website", value: 15 },
    { name: "Other", value: 10 },
  ],
  customerSatisfaction: 4.2,
  upcomingTasks: [
    { task: "Follow up with Client A", deadline: "2023-07-15" },
    { task: "Prepare proposal for Client B", deadline: "2023-07-18" },
    { task: "Team meeting", deadline: "2023-07-20" },
  ],
  activeProjects: [
    { name: "Project X", progress: 75 },
    { name: "Project Y", progress: 30 },
    { name: "Project Z", progress: 50 },
  ],
  revenueData: [
    { month: "Jan", revenue: 4000 },
    { month: "Feb", revenue: 3000 },
    { month: "Mar", revenue: 5000 },
    { month: "Apr", revenue: 4500 },
    { month: "May", revenue: 6000 },
    { month: "Jun", revenue: 5500 },
  ],
};

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
  total_sales: {
    label: "Total Sales",
  },
  total_profit: {
    label: "Total Sales",
  },
} satisfies ChartConfig;

export function Test() {
  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">CRM Dashboard</h1>

      {/* Overview/Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Sales</CardTitle>
            <CardDescription>Last Year</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ChartContainer
              config={chartConfig}
              className="min-h-[200px] w-full"
            >
              <AreaChart accessibilityLayer data={mockData.sales}>
                <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" hide />
                <defs>
                  <linearGradient id="fillChart" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="total_sales"
                  fillOpacity={0.4}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#fillChart)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Profit</CardTitle>
            <CardDescription>Last Year</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ChartContainer
              config={chartConfig}
              className="min-h-[200px] w-full"
            >
              <AreaChart accessibilityLayer data={mockData.profit}>
                <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" hide />

                <defs>
                  <linearGradient id="fillChart2" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-2))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="total_profit"
                  fillOpacity={0.4}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  fill="url(#fillChart2)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              {mockData.revenueGrowth}%
              {mockData.revenueGrowth > 0 ? (
                <ArrowUpIcon className="h-4 w-4 text-green-500 ml-2" />
              ) : (
                <ArrowDownIcon className="h-4 w-4 text-red-500 ml-2" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.newCustomers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[200px] w-full"
            >
              <BarChart accessibilityLayer data={mockData.salesPipeline}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis tickLine={false} tickMargin={10} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Sales Representatives</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockData.topSalesReps.map((rep, index) => (
                  <TableRow key={index}>
                    <TableCell>{rep.name}</TableCell>
                    <TableCell>${rep.sales.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Leads and Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[200px] w-full"
            >
              <PieChart accessibilityLayer>
                <Pie
                  data={mockData.leadSources}
                  labelLine={false}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {mockData.leadSources.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(var(--chart-${index + 1}))`}
                    />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Customer Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-center mb-4">
              {mockData.customerSatisfaction} / 5
            </div>
            <Progress
              value={mockData.customerSatisfaction * 20}
              className="w-full"
            />
          </CardContent>
        </Card>
      </div>

      {/* Tasks and Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {mockData.upcomingTasks.map((task, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span>{task.task}</span>
                  <span className="text-sm text-gray-500">{task.deadline}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {mockData.activeProjects.map((project, index) => (
              <div key={index} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span>{project.name}</span>
                  <span>{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
            <LineChart accessibilityLayer data={mockData.revenueData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
              />
              <YAxis tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-center">
              <BellIcon className="h-4 w-4 mr-2 text-blue-500" />
              <span>New lead assigned to you</span>
            </li>
            <li className="flex items-center">
              <CheckCircleIcon className="h-4 w-4 mr-2 text-green-500" />
              <span>Project X completed successfully</span>
            </li>
            <li className="flex items-center">
              <XCircleIcon className="h-4 w-4 mr-2 text-red-500" />
              <span>Missed follow-up with Client C</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
