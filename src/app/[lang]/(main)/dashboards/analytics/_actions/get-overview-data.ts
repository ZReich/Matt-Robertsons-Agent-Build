"use server";

export async function getOverviewData() {
  return {
    total_visitors: {
      value: 15000,
      percentage_change: 0.05,
    },
    unique_visitors: {
      value: 12000,
      percentage_change: 0.03,
    },
    total_page_views: {
      value: 45000,
      percentage_change: 0.08,
    },
    average_session_duration: {
      value: 205000,
      percentage_change: -0.02,
    },
    bounce_rate: {
      value: 0.45,
      percentage_change: 0.1,
    },
    total_conversions: {
      value: 350,
      percentage_change: 0.04,
    },
    conversion_rate: {
      value: 0.0233,
      percentage_change: 0.005,
    },
    total_revenue: {
      value: 1450000,
      percentage_change: -0.015,
    },
  };
}
