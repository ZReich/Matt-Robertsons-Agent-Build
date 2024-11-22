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

export interface LeadSourceType {
  name: string;
  percentage: number;
  fill: string;
}

export interface CustomerSatisfactionType {
  summary: {
    name: string;
    value: number;
  };
  feedbacks: Array<{
    name: string;
    email: string;
    avatar: string;
    rating: number;
    feedbackMessage: string;
    createdAt: Date;
  }>;
}

export interface ActiveProjectType {
  name: string;
  progress: number;
  startDate: Date;
  dueDate: Date;
  status: "On Track" | "At Risk" | "On Hold";
}

export interface SalesByCountryType {
  country: string;
  countryCode: string;
  sales: number;
}

export interface RevenueTrendType {
  month: string;
  value: number;
}
