"use client";

import * as React from "react";

import type { ConversionFunnelType } from "../../../../types";

import { ConversionFunnelList } from "./conversion-funnel-list";
import { ConversionFunnelChart } from "./conversion-funnel-chart";

export function ConversionFunnelWrapper({
  data,
}: {
  data: ConversionFunnelType["funnelSteps"];
}) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = React.useState(0);

  React.useEffect(() => {
    if (chartRef.current) {
      setChartHeight(chartRef.current.clientHeight);
    }
  }, []);

  const trapezoidHeight = chartHeight / data.length;

  return (
    <div className="relative h-56 w-full overflow-hidden">
      <ConversionFunnelList data={data} trapezoidHeight={trapezoidHeight} />
      <ConversionFunnelChart data={data} chartRef={chartRef} />
    </div>
  );
}
