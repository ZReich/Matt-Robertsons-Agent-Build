export interface MetricType {
  value: number;
  percentageChange: number;
}

export interface OverviewType {
  totalSales: MetricType;
  totalProfit: MetricType;
  revenueGrowth: MetricType;
  newCustomers: MetricType;
}

export interface SalesPipelineType {
  summary: {
    totalLead: number;
    totalProposal: number;
    totalNegotiation: number;
    totalClosed: number;
  };
  monthly: Array<{
    month: string;
    lead: number;
    proposal: number;
    negotiation: number;
    closed: number;
  }>;
}

export interface SalesRepresentativeType {
  name: string;
  avatar: string;
  email: string;
  sales: number;
}
