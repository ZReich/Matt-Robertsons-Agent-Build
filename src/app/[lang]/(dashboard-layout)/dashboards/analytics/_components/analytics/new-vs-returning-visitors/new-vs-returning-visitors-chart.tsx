import { TbVs } from "react-icons/tb";

import { formatPercent } from "@/lib/utils";

import type { NewVsReturningVisitorsType } from "../../../types";

import { SeparatorWithText } from "@/components/ui/separator";
import { ProgressSegments } from "@/components/ui/progress";

export function NewVsReturningVisitorsChart({
  data,
}: {
  data: NewVsReturningVisitorsType["visitors"];
}) {
  const segments = Object.entries(data).map(([_, value]) => ({
    value: value.percentageChange * 100,
    color: value.fill,
  }));

  const { new: newVisitors, returning: returningVisitors } = data;

  return (
    <div className="grid items-between gap-6">
      <ProgressSegments segments={segments} />
      <div className="flex justify-between items-center gap-x-0.5">
        <div className="grid place-items-start">
          <h4 className="inline-flex items-center gap-x-1 text-xs">
            <div
              style={{
                backgroundColor: newVisitors.fill,
              }}
              className="h-4 w-2 rounded-md"
            />
            <span>New</span>
          </h4>
          <p className="text-2xl">{newVisitors.value.toLocaleString()}</p>
          <p
            style={{
              color: newVisitors.fill,
            }}
            className="text-4xl"
          >
            {formatPercent(newVisitors.percentageChange)}
          </p>
        </div>
        <SeparatorWithText orientation="vertical" className="h-full">
          <TbVs
            className="size-4 stroke-border rotate-90 rtl:-rotate-90"
            aria-label="Versus"
          />
        </SeparatorWithText>
        <div className="grid place-items-end">
          <h4 className="inline-flex items-center gap-x-1 text-xs">
            <span>Returning</span>
            <div
              style={{
                backgroundColor: returningVisitors.fill,
              }}
              className="h-4 w-2 rounded-md"
            />
          </h4>
          <p className="text-2xl">{returningVisitors.value.toLocaleString()}</p>
          <p
            style={{
              color: returningVisitors.fill,
            }}
            className="text-4xl"
          >
            {formatPercent(returningVisitors.percentageChange)}
          </p>
        </div>
      </div>
    </div>
  );
}
