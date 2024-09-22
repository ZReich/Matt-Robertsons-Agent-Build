"use server";

export async function getConversionFunnelData() {
  return {
    visited_page: 15000,
    added_to_cart: 5000,
    initiated_checkout: 1000,
    completed_purchase: 350,
  };
}
