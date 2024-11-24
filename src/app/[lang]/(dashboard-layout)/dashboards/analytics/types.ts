export interface GeographicLocationType {
  country: string;
  countryCode: string;
  visitors: number;
  percentageChange: number;
}

export interface MetricType {
  value: number;
  percentageChange: number;
}

export interface OverviewType {
  totalVisitors: MetricType;
  uniqueVisitors: MetricType;
  totalPageViews: MetricType;
  averageSessionDuration: MetricType;
  bounceRate: MetricType;
  totalConversions: MetricType;
  conversionRate: MetricType;
  totalRevenue: MetricType;
}

export interface TrafficSourcesType {
  summary: { totalVisitors: number; totalPercentageChange: number };
  sources: {
    name: string;
    visitors: number;
    fill: string;
    percentageChange: number;
  }[];
}

export interface EngagementByDeviceType {
  deviceType: string;
  sessionDuration: number;
  pagesPerSession: number;
  bounceRate: number;
  userPercentage: number;
  conversionRate: number;
}

export interface FunnelStageType {
  name: string;
  value: number;
  fill: string;
}

export type ConversionFunnelType = Array<FunnelStageType>;

export interface MonthlyType {
  month: string;
  visitors: number;
  conversions: number;
}

export interface PerformanceOverTimeType {
  summary: {
    totalVisitors: number;
    totalConversions: number;
  };
  monthly: MonthlyType[];
}

export interface TopPagesType {
  page: string;
  views: number;
  avgTimeOnPage: number;
  bounceRate: number;
}
