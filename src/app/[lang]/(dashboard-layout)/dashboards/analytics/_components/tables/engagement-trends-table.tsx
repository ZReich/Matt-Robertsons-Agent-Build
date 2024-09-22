"use client";

import { formatDuration } from "@/lib/date-formatters";

import type { EngagementByDeviceType } from "../engagement-by-device";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function EngagementByDeviceTable({
  data,
}: {
  data: EngagementByDeviceType[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Device Type</TableHead>
          <TableHead>Avg. Session Duration</TableHead>
          <TableHead>
            Pages/
            <wbr />
            Session
          </TableHead>
          <TableHead>Bounce Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((device) => (
          <TableRow key={device.device_type}>
            <TableCell className="font-medium">{device.device_type}</TableCell>
            <TableCell>{formatDuration(device.session_duration)}</TableCell>
            <TableCell>{device.pages_per_session}</TableCell>
            <TableCell>
              {new Intl.NumberFormat("en-US", {
                style: "percent",
                maximumFractionDigits: 2,
              }).format(device.bounce_rate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
