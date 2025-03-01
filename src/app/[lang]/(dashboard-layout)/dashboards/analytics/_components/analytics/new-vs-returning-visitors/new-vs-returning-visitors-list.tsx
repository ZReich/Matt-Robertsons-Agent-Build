"use client";

import { TbVs } from "react-icons/tb";

import { formatPercent } from "@/lib/utils";

import type { NewVsReturningVisitorsType } from "../../../types";

import { SeparatorWithText } from "@/components/ui/separator";

export function NewVsReturningVisitorsList({
  data,
}: {
  data: NewVsReturningVisitorsType["visitors"];
}) {
  const { new: newVisitors, returning: returningVisitors } = data;

  return (
    <ul className="flex justify-between items-center gap-x-0.5">
      <li className="grid place-items-start">
        <h3 className="inline-flex items-center gap-x-1 text-xs">
          <div
            style={{
              backgroundColor: newVisitors.fill,
            }}
            className="h-2.5 w-2.5 rounded-sm"
          />
          <span>New</span>
        </h3>
        <p className="text-2xl">{newVisitors.value.toLocaleString()}</p>
        <p
          style={{
            color: newVisitors.fill,
          }}
          className="text-4xl"
        >
          {formatPercent(newVisitors.percentageChange)}
        </p>
      </li>
      <SeparatorWithText orientation="vertical" className="h-full">
        <TbVs
          className="size-4 stroke-border rotate-90 rtl:-rotate-90"
          aria-label="Versus"
        />
      </SeparatorWithText>
      <li className="grid place-items-end">
        <h3 className="inline-flex items-center gap-x-1 text-xs">
          <span>Returning</span>
          <div
            style={{
              backgroundColor: returningVisitors.fill,
            }}
            className="h-2.5 w-2.5 rounded-sm"
          />
        </h3>
        <p className="text-2xl">{returningVisitors.value.toLocaleString()}</p>
        <p
          style={{
            color: returningVisitors.fill,
          }}
          className="text-4xl"
        >
          {formatPercent(returningVisitors.percentageChange)}
        </p>
      </li>
    </ul>
  );
}
