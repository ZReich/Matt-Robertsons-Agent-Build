"use client";

import { useMedia } from "react-use";

import type { SalesPipelineType } from "../types";

import { Separator } from "@/components/ui/separator";

export function SalesPipelineSummary({
  data,
}: {
  data: SalesPipelineType["summary"];
}) {
  return (
    <ul className="flex flex-col justify-around gap-4 sm:flex-row">
      <div className="flex flex-wrap justify-around gap-4 md:flex-col">
        <li>
          <h4 className="text-sm">Total Lead</h4>
          <p className="text-2xl font-semibold">{data.totalLead}</p>
        </li>
        <li>
          <h4 className="text-sm">Total Proposal</h4>
          <p className="text-2xl font-semibold">{data.totalProposal}</p>
        </li>
      </div>
      <div className="flex flex-wrap justify-around gap-4 md:flex-col">
        <li>
          <h4 className="text-sm">Total Negotiation</h4>
          <p className="text-2xl font-semibold">{data.totalNegotiation}</p>
        </li>
        <li>
          <h4 className="text-sm">Total Closed</h4>
          <p className="text-2xl font-semibold">{data.totalClosed}</p>
        </li>
      </div>
    </ul>
  );
}
