"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

// Mock data (in a real application, this would come from your backend)
const mockData = {
  totalSales: 1234567,
  totalProfit: 345678,
  revenueGrowth: 12.5,
  newCustomers: 45,
  salesPipeline: [
    { name: "Lead", value: 30 },
    { name: "Proposal", value: 25 },
    { name: "Negotiation", value: 15 },
    { name: "Closed", value: 10 },
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

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function CRMDashboard() {
  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">CRM Dashboard</h1>

      {/* Overview/Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${mockData.totalSales.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${mockData.totalProfit.toLocaleString()}
            </div>
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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockData.salesPipeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockData.leadSources}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {mockData.leadSources.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockData.revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
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
