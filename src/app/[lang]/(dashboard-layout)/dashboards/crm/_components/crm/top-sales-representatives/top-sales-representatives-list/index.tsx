import type { SalesRepresentativeType } from "../../../../types";

import { TopSalesRepresentativesTop3Item } from "./top-sales-representatives-top-3-item";
import { TopSalesRepresentativesOthersItem } from "./top-sales-representatives-others-item";

export function TopSalesRepresentativesList({
  data,
}: {
  data: SalesRepresentativeType["representatives"];
}) {
  const top3 = data.slice(0, 3);
  const others = data.slice(3);

  return (
    <ul className="space-y-3">
      {top3.map((rep, index) => (
        <TopSalesRepresentativesTop3Item
          key={rep.name + index}
          representative={rep}
          index={index}
        />
      ))}

      {others.map((rep, index) => (
        <TopSalesRepresentativesOthersItem
          key={rep.name}
          representative={rep}
          index={index}
        />
      ))}
    </ul>
  );
}
