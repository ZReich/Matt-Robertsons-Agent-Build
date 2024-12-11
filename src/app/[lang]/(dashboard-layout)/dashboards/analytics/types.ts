import type { DynamicIconNameType } from "@/types";

export interface GeographicLocationType {
  country: string;
  countryCode: string;
  visitors: number;
  percentageChange: number;
}

export interface MetricType {
  period: string;
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
  period: string;
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

export type ConversionFunnelType = {
  period: string;
  funnelSteps: Array<{
    name: string;
    value: number;
    fill: string;
    iconName: DynamicIconNameType;
  }>;
};

export interface PerformanceOverTimeType {
  summary: {
    totalVisitors: number;
    totalConversions: number;
  };
  performance: Array<{
    month: string;
    visitors: number;
    conversions: number;
  }>;
}

export interface TopPagesType {
  period: string;
  pages: Array<{
    page: string;
    views: number;
    avgTimeOnPage: number;
    bounceRate: number;
  }>;
}
