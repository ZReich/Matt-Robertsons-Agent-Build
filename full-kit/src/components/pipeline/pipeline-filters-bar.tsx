import Link from "next/link"

import type { PipelineFilters } from "@/lib/pipeline/server/board"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function withQuery(
  base: string,
  params: Record<string, string | null | undefined>
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const query = search.toString()
  return query ? `${base}?${query}` : base
}

export function PipelineFiltersBar({
  basePath,
  view,
  filters,
  showPropertyType = false,
}: {
  basePath: string
  view: "list" | "kanban"
  filters: PipelineFilters
  showPropertyType?: boolean
}) {
  const shared = {
    search: filters.search || undefined,
    source: filters.source ?? undefined,
    propertyType: filters.propertyType ?? undefined,
    age: filters.age ?? undefined,
    showAll: filters.showAll ? "1" : undefined,
    needsFollowup: filters.needsFollowup ? "1" : undefined,
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          variant={view === "list" ? "default" : "outline"}
        >
          <Link href={withQuery(basePath, { ...shared, view: "list" })}>
            List
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={view === "kanban" ? "default" : "outline"}
        >
          <Link href={withQuery(basePath, { ...shared, view: "kanban" })}>
            Kanban
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={filters.showAll ? "default" : "outline"}
        >
          <Link
            href={withQuery(basePath, {
              ...shared,
              view,
              showAll: filters.showAll ? undefined : "1",
            })}
          >
            {filters.showAll ? "Hide old terminal" : "Show all terminal"}
          </Link>
        </Button>
      </div>
      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="view" value={view} />
        {filters.showAll ? (
          <input type="hidden" name="showAll" value="1" />
        ) : null}
        {filters.needsFollowup ? (
          <input type="hidden" name="needsFollowup" value="1" />
        ) : null}
        <Input
          name="search"
          defaultValue={filters.search}
          placeholder="Search pipeline..."
          className="h-9 w-64"
        />
        <select
          name="source"
          defaultValue={filters.source ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All sources</option>
          <option value="crexi">Crexi</option>
          <option value="loopnet">LoopNet</option>
          <option value="buildout">Buildout</option>
          <option value="email_cold">Email cold</option>
          <option value="referral">Referral</option>
        </select>
        {showPropertyType ? (
          <select
            name="propertyType"
            defaultValue={filters.propertyType ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All property types</option>
            <option value="office">Office</option>
            <option value="retail">Retail</option>
            <option value="industrial">Industrial</option>
            <option value="multifamily">Multifamily</option>
            <option value="land">Land</option>
            <option value="mixed_use">Mixed use</option>
            <option value="hospitality">Hospitality</option>
            <option value="medical">Medical</option>
            <option value="other">Other</option>
          </select>
        ) : null}
        <select
          name="age"
          defaultValue={filters.age ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Any age</option>
          <option value="lt7">&lt;7d</option>
          <option value="7_30">7-30d</option>
          <option value="30_90">30-90d</option>
          <option value="gt90">&gt;90d</option>
        </select>
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Button asChild type="button" size="sm" variant="ghost">
          <Link href={withQuery(basePath, { view })}>Reset</Link>
        </Button>
      </form>
    </div>
  )
}
