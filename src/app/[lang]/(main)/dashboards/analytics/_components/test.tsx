"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

const data = {
  overview: {
    totalVisitors: 15000,
    uniqueVisitors: 12000,
    totalPageViews: 45000,
    averageSessionDuration: "3m 25s",
    bounceRate: "45%",
    totalConversions: 350,
    conversionRate: "2.33%",
    totalRevenue: "$14,500",
  },
  traffic: {
    sources: {
      direct: 5000,
      referral: 3000,
      socialMedia: 2000,
      searchEngine: 4000,
      email: 1000,
    },
    geographicLocation: [
      { country: "United States", visitors: 8000 },
      { country: "Canada", visitors: 2000 },
      { country: "United Kingdom", visitors: 1500 },
      { country: "Germany", visitors: 1000 },
      { country: "Australia", visitors: 500 },
    ],
  },
  engagement: {
    pageViews: {
      homepage: 12000,
      productPage: 8000,
      blogPage: 5000,
      contactPage: 3000,
    },
    averageSessionDuration: "3m 25s",
    bounceRate: "45%",
    topPages: [
      { page: "Homepage", views: 12000 },
      { page: "Product Page", views: 8000 },
      { page: "Blog Page", views: 5000 },
    ],
  },
  conversions: {
    conversionRate: "2.33%",
    totalConversions: 350,
    conversionFunnel: {
      visitedPage: 15000,
      addedToCart: 5000,
      initiatedCheckout: 1000,
      completedPurchase: 350,
    },
    revenue: "$14,500",
  },
  performanceOverTime: {
    monthlyData: [
      { month: "January", visitors: 1200, conversions: 30 },
      { month: "February", visitors: 1400, conversions: 40 },
      { month: "March", visitors: 1600, conversions: 50 },
      { month: "April", visitors: 1500, conversions: 45 },
      { month: "May", visitors: 1800, conversions: 60 },
    ],
  },
  customReports: [
    {
      reportName: "Weekly Traffic Overview",
      data: [
        { week: "Week 1", visitors: 3000, pageViews: 10000 },
        { week: "Week 2", visitors: 3500, pageViews: 12000 },
        { week: "Week 3", visitors: 3200, pageViews: 11000 },
        { week: "Week 4", visitors: 2800, pageViews: 9500 },
      ],
    },
    {
      reportName: "Monthly Conversion Summary",
      data: [
        { month: "January", conversions: 30, revenue: "$1200" },
        { month: "February", conversions: 40, revenue: "$1600" },
        { month: "March", conversions: 50, revenue: "$2000" },
      ],
    },
  ],
};

export function AnalyticsDashboard() {
  const trafficSourcesData = Object.entries(data.traffic.sources).map(
    ([name, value]) => ({ name, value })
  );
  const conversionFunnelData = Object.entries(
    data.conversions.conversionFunnel
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>

      {/* Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Object.entries(data.overview).map(([key, value]) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (str) => str.toUpperCase())}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Traffic Sources */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Traffic Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={trafficSourcesData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label
              >
                {trafficSourcesData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`hsl(${index * 45}, 70%, 60%)`}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Geographic Location */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Geographic Location</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.traffic.geographicLocation}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="country" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="visitors" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Engagement */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Top Pages</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.engagement.topPages.map((page, index) => (
                    <TableRow key={index}>
                      <TableCell>{page.page}</TableCell>
                      <TableCell>{page.views}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Metrics</h3>
              <p>
                Average Session Duration:{" "}
                {data.engagement.averageSessionDuration}
              </p>
              <p>Bounce Rate: {data.engagement.bounceRate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={conversionFunnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Bar dataKey="value" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Over Time */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.performanceOverTime.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="visitors"
                stroke="#8884d8"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="conversions"
                stroke="#82ca9d"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Custom Reports */}
      {data.customReports.map((report, index) => (
        <Card key={index} className="mb-8">
          <CardHeader>
            <CardTitle>{report.reportName}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(report.data[0]).map((key) => (
                    <TableHead key={key}>{key}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.map((item, itemIndex) => (
                  <TableRow key={itemIndex}>
                    {Object.values(item).map((value, valueIndex) => (
                      <TableCell key={valueIndex}>{value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
