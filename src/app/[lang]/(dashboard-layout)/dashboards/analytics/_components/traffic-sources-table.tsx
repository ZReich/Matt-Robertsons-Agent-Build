"use client"

import { Ellipsis } from "lucide-react"

import type { TrafficSourcesType } from "../types"

import { formatPercent } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
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
            <TableCell className="font-semibold" aria-label="Visitors">
              <span>{item.visitors.toLocaleString()}</span>
            </TableCell>
            <TableCell aria-label="Percentage Change">
              <span>{formatPercent(item.percentageChange)}</span>
            </TableCell>
            <TableCell aria-label="Actions">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
