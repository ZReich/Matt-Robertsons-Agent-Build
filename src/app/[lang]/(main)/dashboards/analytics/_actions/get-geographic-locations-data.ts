"use server";

export async function getGeographicLocationsData() {
  return [
    { country: "United States", country_code: "US", visitors: 8000 },
    { country: "Canada", country_code: "CA", visitors: 2000 },
    { country: "United Kingdom", country_code: "GB", visitors: 1500 },
    { country: "Germany", country_code: "DE", visitors: 1000 },
    { country: "Australia", country_code: "AU", visitors: 500 },
  ];
}
