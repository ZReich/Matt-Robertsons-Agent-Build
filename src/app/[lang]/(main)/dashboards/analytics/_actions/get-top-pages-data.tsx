"use server";

export async function getTopPagesData() {
  return [
    {
      page: "Home",
      views: 15000,
      avg_time_on_page: 90000,
      bounce_rate: 0.35,
    },
    {
      page: "Products",
      views: 12000,
      avg_time_on_page: 135000,
      bounce_rate: 0.4,
    },
    {
      page: "About",
      views: 8000,
      avg_time_on_page: 105000,
      bounce_rate: 0.45,
    },
    {
      page: "Contact",
      views: 6000,
      avg_time_on_page: 70000,
      bounce_rate: 0.5,
    },
    {
      page: "Blog",
      views: 5000,
      avg_time_on_page: 180000,
      bounce_rate: 0.3,
    },
  ];
}
