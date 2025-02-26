import type { VisitorsByCountryDataType } from "../../../../types";

import { VisitorsByCountryItem } from "./visitors-by-country-item";

export function VisitorsByCountryList({
  data,
}: {
  data: VisitorsByCountryDataType;
}) {
  return (
    <ul className="space-y-4">
      {data.countries.map((country) => (
        <VisitorsByCountryItem
          key={country.countryName}
          data={country}
          totalVisitors={data.summary.totalVisitors}
        />
      ))}
    </ul>
  );
}
