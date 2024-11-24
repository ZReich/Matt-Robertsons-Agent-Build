"use client";

import { Users, FileText, MessageSquare, CheckCircle } from "lucide-react";

import type { SalesPipelineType } from "../types";

import { SalesPipelineItem } from "./sales-pipeline-item";

export function SalesPipelinetList({
  data,
}: {
  data: SalesPipelineType["summary"];
}) {
  return (
    <ul className="grid grid-cols-2 gap-4">
      <SalesPipelineItem
        title="Total Lead"
        value={data.totalLead}
        icon={Users}
      />
      <SalesPipelineItem
        title="Total Proposal"
        value={data.totalProposal}
        icon={FileText}
      />
      <SalesPipelineItem
        title="Total Negotiation"
        value={data.totalNegotiation}
        icon={MessageSquare}
      />
      <SalesPipelineItem
        title="Total Closed"
        value={data.totalClosed}
        icon={CheckCircle}
      />
    </ul>
  );
}
