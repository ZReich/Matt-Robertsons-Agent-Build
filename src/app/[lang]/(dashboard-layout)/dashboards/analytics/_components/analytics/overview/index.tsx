import { overviewData } from "../../../_data/overview";

import { UniqueVisitors } from "./unique-visitors";
import { AverageSessionDuration } from "./average-session-duration";
import { BounceRate } from "./bounce-rate";
import { ConversionRate } from "./conversion-rate";

export async function Overview() {
  return (
    <div className="grid grid-cols-1 gap-4 md:col-span-full md:grid-cols-4">
      <UniqueVisitors data={overviewData.uniqueVisitors} />
      <AverageSessionDuration data={overviewData.averageSessionDuration} />
      <BounceRate data={overviewData.bounceRate} />
      <ConversionRate data={overviewData.conversionRate} />
    </div>
  );
}
