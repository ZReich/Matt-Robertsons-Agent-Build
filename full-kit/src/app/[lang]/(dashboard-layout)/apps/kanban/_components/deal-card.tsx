"use client"

import { useParams, useRouter } from "next/navigation"
import { differenceInDays } from "date-fns"
import { Clock, DollarSign, GripVertical } from "lucide-react"

import type { DraggableProvided } from "@hello-pangea/dnd"
import type { TaskType } from "../types"

import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  office:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-0",
  retail:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-0",
  industrial:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 border-0",
  multifamily:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 border-0",
  land: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-0",
  "mixed-use":
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border-0",
  hospitality:
    "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200 border-0",
  medical:
    "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-0",
  other:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0",
}

function formatValue(value?: number): string {
  if (!value) return "—"
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value.toLocaleString()}`
}

function daysInStage(listedDate?: string): string {
  if (!listedDate) return "—"
  const days = differenceInDays(new Date(), new Date(listedDate))
  return `${days}d`
}

interface DealCardProps {
  task: TaskType
  provided: DraggableProvided
}

export function DealCard({ task, provided }: DealCardProps) {
  const params = useParams()
  const router = useRouter()
  const lang = (params?.lang as string) ?? "en"

  const dealSlug = task.id

  const propertyTypeColor =
    PROPERTY_TYPE_COLORS[task.dealPropertyType ?? "other"]

  return (
    <Card
      ref={provided.innerRef}
      {...provided.draggableProps}
      className="my-2 w-64 md:w-72 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() =>
        dealSlug && router.push(`/${lang}/pages/deals/${dealSlug}`)
      }
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-x-1.5">
          <div
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-7 text-muted-foreground/50 cursor-grab shrink-0"
            )}
            {...provided.dragHandleProps}
            aria-label="Move deal"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-4" />
          </div>
          <Badge className={cn("text-xs capitalize", propertyTypeColor)}>
            {(task.dealPropertyType ?? task.label).replace("-", " ")}
          </Badge>
        </div>

        <div className="px-1">
          <p className="font-semibold text-sm leading-snug line-clamp-2">
            {task.title}
          </p>
          {task.dealClientName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {task.dealClientName}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-1 pt-1.5 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <DollarSign className="size-3 shrink-0" />
            {formatValue(task.dealValue)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            {daysInStage(task.dealListedDate)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
