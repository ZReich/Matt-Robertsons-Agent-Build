import type { EngagementByDeviceType } from "../types";

export const engagementByDeviceData: EngagementByDeviceType[] = [
  {
    deviceType: "Windows",
    sessionDuration: 300000,
    pagesPerSession: 6.8,
    bounceRate: 0.35,
  },
  {
    deviceType: "macOS",
    sessionDuration: 290000,
    pagesPerSession: 6.5,
    bounceRate: 0.3,
  },
  {
    deviceType: "iOS",
    sessionDuration: 180000,
    pagesPerSession: 4.2,
    bounceRate: 0.45,
  },
  {
    deviceType: "Android",
    sessionDuration: 200000,
    pagesPerSession: 4.0,
    bounceRate: 0.4,
  },
  {
    deviceType: "ChromeOS",
    sessionDuration: 250000,
    pagesPerSession: 5.5,
    bounceRate: 0.38,
  },
  {
    deviceType: "Linux",
    sessionDuration: 270000,
    pagesPerSession: 5.8,
    bounceRate: 0.37,
  },
  {
    deviceType: "Other",
    sessionDuration: 150000,
    pagesPerSession: 3.7,
    bounceRate: 0.5,
  },
];
