"use client"

import type { IconType } from "@/types"

import { Badge } from "@/components/ui/badge"

export function CustomerInsightItem({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number
  icon: IconType
  color: string
}) {
  return (
    <li className="flex gap-x-2">
      <Badge
        style={{
          backgroundColor: color,
        }}
        className="size-12 aspect-square shadow-none"
        aria-hidden
      >
        <Icon className="size-full" />
      </Badge>
      <div className="overflow-hidden">
        <h4 className="text-xs break-all truncate">{title}</h4>
        <p className="text-2xl">{value.toLocaleString()}</p>
      </div>
    </li>
  )
}
