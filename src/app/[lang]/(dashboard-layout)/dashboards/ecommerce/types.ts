export interface MetricType {
  value: number;
  percentageChange: number;
}

export interface OverviewType {
  totalSales: MetricType;
  revenueSummary: MetricType;
  numberOfOrders: MetricType;
  averageOrderValue: MetricType;
}

export interface SalesTrendType {
  summary: {
    lowestSales: { date: number; sales: number };
    highestSales: { date: number; sales: number };
    avgSales: number;
    totalSales: number;
  };
  weekly: Array<{ date: number; sales: number }>;
}

export interface TopProductType {
  name: string;
  sales: {
    value: number;
    percentageChange: number;
  };
  revenue: {
    value: number;
    percentageChange: number;
  };
  inventoryLeft: number;
  image: string;
  sku: string;
}

export interface RecentOrderType {
  id: string;
  customerName: string;
  date: number;
  totalAmount: { value: number; percentageChange: number };
  status: string;
}

export interface CustomerInsightsType {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  vipCustomers: number;
}

export interface InvoiceType {
  invoiceId: string;
  customerName: string;
  orderDate: string;
  dueDate: string;
  totalAmount: number;
  deliveryStatus:
    | "Delivered"
    | "Shipped"
    | "In Transit"
    | "Processing"
    | "Pending";
}
