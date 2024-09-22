"use server";

export async function getCustomerInsightsData() {
  return {
    total_customers: 5120,
    new_customers: 45,
    returning_customers: 150,
    vip_customers: 320,
  };
}
