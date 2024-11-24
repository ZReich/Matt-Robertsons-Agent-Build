"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";

import type { EngagementByDeviceType } from "../../types";

export const columns: ColumnDef<EngagementByDeviceType>[] = [
  {
    id: "deviceType",
    accessorKey: "deviceType",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Device Type"
        className="ms-4"
      />
    ),
    cell: ({ row }) => {
      const deviceType = row.getValue("deviceType") as string;

      return <span className="ms-4 text-primary">{deviceType}</span>;
    },
  },
  {
    id: "sessionDuration",
    accessorKey: "sessionDuration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Session Duration (ms)" />
    ),
    cell: ({ row }) => {
      const sessionDuration = row.getValue("sessionDuration") as number;

      return <span>{sessionDuration.toLocaleString()} ms</span>;
    },
  },
  {
    id: "pagesPerSession",
    accessorKey: "pagesPerSession",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pages per Session" />
    ),
    cell: ({ row }) => {
      const pagesPerSession = row.getValue("pagesPerSession") as number;

      return <span>{pagesPerSession.toFixed(1)}</span>;
    },
  },
  {
    id: "bounceRate",
    accessorKey: "bounceRate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bounce Rate (%)" />
    ),
    cell: ({ row }) => {
      const bounceRate = row.getValue("bounceRate") as number;

      return <span>{(bounceRate * 100).toFixed(1)}%</span>;
    },
  },
  {
    id: "userPercentage",
    accessorKey: "userPercentage",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User Percentage (%)" />
    ),
    cell: ({ row }) => {
      const userPercentage = row.getValue("userPercentage") as number;

      return <span>{(userPercentage * 100).toFixed(1)}%</span>;
    },
  },
  {
    id: "conversionRate",
    accessorKey: "conversionRate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Conversion Rate (%)" />
    ),
    cell: ({ row }) => {
      const conversionRate = row.getValue("conversionRate") as number;

      return <span>{(conversionRate * 100).toFixed(1)}%</span>;
    },
  },
];
