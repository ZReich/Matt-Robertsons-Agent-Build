"use client"

import type { TrafficSourcesType } from "../types"

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { PercentageChangeBadge } from "@/components/dashboards/percentage-change-badge"
import { DynamicIcon } from "@/components/dynamic-icon"

export function TrafficSourcesTable({
  data,
}: {
  data: TrafficSourcesType["sources"]
}) {
  return (
    <Table className="rounded-lg overflow-hidden">
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.name}>
            <TableCell className="w-6" aria-hidden>
              <DynamicIcon
                name={item.icon}
                style={{ color: item.fill }}
                className="h-3 w-3 stroke-[3]"
              />
            </TableCell>
            <TableCell className="font-semibold" aria-label="Name">
              {item.name}
            </TableCell>
            <TableCell aria-label="Visitors">
              <span>Visitors: </span>
              <span className="font-semibold">
                {item.visitors.toLocaleString()}
              </span>
            </TableCell>
            <TableCell className="text-end" aria-label="Percentage Change">
              <PercentageChangeBadge value={item.percentageChange} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
