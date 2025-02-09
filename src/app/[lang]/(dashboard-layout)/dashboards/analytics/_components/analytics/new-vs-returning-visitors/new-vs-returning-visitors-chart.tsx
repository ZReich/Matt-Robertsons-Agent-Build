"use client";

import * as React from "react";
import { Undo2, User, UserPlus } from "lucide-react";
import { TbVs } from "react-icons/tb";

import { formatPercent } from "@/lib/utils";

import type { NewVsReturningVisitorsType } from "../../../types";

import { Badge } from "@/components/ui/badge";
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
    <>
      <div className="flex justify-between items-center">
        <div className="flex gap-x-2">
          <Badge
            style={{
              backgroundColor: newVisitors.fill,
            }}
            className="size-12 aspect-square p-2.5 shadow-none"
            aria-hidden
          >
            <UserPlus className="size-full" />
          </Badge>
          <div>
            <h4 className="text-xs">New Visitors</h4>
            <p className="text-2xl">{newVisitors.value.toLocaleString()}</p>
          </div>
        </div>

        <SeparatorWithText orientation="vertical" className="h-20">
          <TbVs
            className="size-4 stroke-border rotate-90 rtl:-rotate-90"
            aria-label="Versus"
          />
        </SeparatorWithText>

        <div className="flex text-end gap-x-2">
          <div>
            <h4 className="text-xs">Returning Visitors</h4>
            <p className="text-2xl">
              {returningVisitors.value.toLocaleString()}
            </p>
          </div>
          <Badge
            style={{
              backgroundColor: returningVisitors.fill,
            }}
            className="size-12 aspect-square p-2.5 shadow-none"
            aria-hidden
          >
            <div className="relative size-full">
              <User className="absolute top-0 right-[3.25px] size-full" />
              <Undo2 className="absolute top-[6.5px] right-0 size-2.5 stroke-[4.5]" />
            </div>
          </Badge>
        </div>
      </div>

      <div className="flex justify-between" aria-hidden>
        <p
          style={{
            color: newVisitors.fill,
          }}
          className="text-2xl"
        >
          {formatPercent(newVisitors.percentageChange)}
        </p>
        <p
          style={{
            color: returningVisitors.fill,
          }}
          className="text-2xl"
        >
          {formatPercent(returningVisitors.percentageChange)}
        </p>
      </div>
      <ProgressSegments segments={segments} />
    </>
  );
}
