"use client";

import * as React from "react";
import { Funnel, FunnelChart } from "recharts";

import type { ConversionFunnelType } from "../../../types";

import { ChartContainer } from "@/components/ui/chart";

export function ConversionFunnelChart({
  data,
}: {
  data: ConversionFunnelType["funnelSteps"];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = React.useState(0);

  React.useEffect(() => {
    if (containerRef.current) {
      setChartHeight(containerRef.current.clientHeight);
    }
  }, []);

  const trapezoidHeight = chartHeight / data.length;

  return (
    <div className="relative h-56 w-full rounded-lg overflow-hidden">
      <ul
        style={{
          gridTemplateRows: `repeat(${data.length}, ${trapezoidHeight}px)`,
        }}
        className="absolute inset-0 grid divide-y"
      >
        {data.map((stage) => (
          <li key={stage.name} className="flex flex-col justify-center">
            <h4 className="text-xs">{stage.name}</h4>
            <p className="text-2xl">{stage.value.toLocaleString()}</p>
          </li>
        ))}
      </ul>
      <ChartContainer
        ref={containerRef}
        config={{}}
        className="absolute inset-y-0 -end-1/2 h-full w-full"
      >
        <FunnelChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive
            strokeWidth={0}
            className="[clip-path:_inset(0_50%_0_0)] rtl:[clip-path:_inset(0_0_0_50%)]"
          />
        </FunnelChart>
      </ChartContainer>
    </div>
  );
}
