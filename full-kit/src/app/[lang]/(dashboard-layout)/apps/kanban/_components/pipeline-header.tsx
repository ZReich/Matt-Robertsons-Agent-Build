"use client"

import { ChevronDown, Search, X } from "lucide-react"

import { useKanbanContext } from "../_hooks/use-kanban-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

const PROPERTY_TYPES = [
  { value: "office", label: "Office" },
  { value: "retail", label: "Retail" },
  { value: "industrial", label: "Industrial" },
  { value: "multifamily", label: "Multifamily" },
  { value: "land", label: "Land" },
  { value: "mixed-use", label: "Mixed Use" },
  { value: "hospitality", label: "Hospitality" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
]

export function PipelineHeader() {
  const {
    searchQuery,
    setSearchQuery,
    filterPropertyType,
    setFilterPropertyType,
  } = useKanbanContext()

  const activeLabel =
    PROPERTY_TYPES.find((t) => t.value === filterPropertyType)?.label ??
    "Property Type"

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
      <h1 className="text-base font-semibold shrink-0">Deal Pipeline</h1>

      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by address or client…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
            onClick={() => setSearchQuery("")}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
            <span
              className={
                filterPropertyType ? "text-foreground" : "text-muted-foreground"
              }
            >
              {activeLabel}
            </span>
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setFilterPropertyType(null)}>
            All Types
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {PROPERTY_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.value}
              onClick={() => setFilterPropertyType(type.value)}
            >
              {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {filterPropertyType && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilterPropertyType(null)}
          className="h-9 gap-1 text-muted-foreground px-2"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
