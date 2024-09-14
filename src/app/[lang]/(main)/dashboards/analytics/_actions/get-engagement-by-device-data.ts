"use server";

export async function getEngagementByDeviceData() {
  return [
    {
      device_type: "Windows",
      session_duration: 300000,
      pages_per_session: 6.8,
      bounce_rate: 0.35,
    },
    {
      device_type: "macOS",
      session_duration: 290000,
      pages_per_session: 6.5,
      bounce_rate: 0.3,
    },
    {
      device_type: "iOS",
      session_duration: 180000,
      pages_per_session: 4.2,
      bounce_rate: 0.45,
    },
    {
      device_type: "Android",
      session_duration: 200000,
      pages_per_session: 4.0,
      bounce_rate: 0.4,
    },
    {
      device_type: "ChromeOS",
      session_duration: 250000,
      pages_per_session: 5.5,
      bounce_rate: 0.38,
    },
    {
      device_type: "Linux",
      session_duration: 270000,
      pages_per_session: 5.8,
      bounce_rate: 0.37,
    },
    {
      device_type: "Other",
      session_duration: 150000,
      pages_per_session: 3.7,
      bounce_rate: 0.5,
    },
  ];
}
