import Link from "next/link"
import { Building2, FileUp, Plus } from "lucide-react"

import type { PropertyStatus, PropertyType } from "@prisma/client"
import type { Metadata } from "next"

import { db } from "@/lib/prisma"
import { cn, formatCurrency } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata: Metadata = {
  title: "Properties",
}

export const dynamic = "force-dynamic"

interface PropertiesPageProps {
  params: Promise<{ lang: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const STATUS_LABELS: Record<PropertyStatus, string> = {
  active: "Available",
  under_contract: "Under contract",
  leased: "Leased",
  closed: "Sold",
  archived: "Archived",
}

const STATUS_VARIANT: Record<
  PropertyStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  under_contract: "secondary",
  leased: "secondary",
  closed: "outline",
  archived: "outline",
}

function paramString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v
  return undefined
}

export default async function PropertiesPage({
  params,
  searchParams,
}: PropertiesPageProps) {
  const { lang } = await params
  const sp = (await searchParams) ?? {}
  const statusFilter = paramString(sp.status) as PropertyStatus | undefined
  const typeFilter = paramString(sp.type) as PropertyType | undefined
  const search = paramString(sp.search)
  const includeArchived = paramString(sp.archived) === "1"

  const properties = await db.property.findMany({
    where: {
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { propertyType: typeFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { deals: true, pendingReplies: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  })

  const counts = await db.property.groupBy({
    by: ["status"],
    where: { archivedAt: null },
    _count: { _all: true },
  })
  const countByStatus = new Map<PropertyStatus, number>()
  for (const c of counts) countByStatus.set(c.status, c._count._all)

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Properties</h1>
          <p className="text-sm text-muted-foreground">
            {properties.length}{" "}
            {properties.length === 1 ? "listing" : "listings"} · seed source for
            auto-replies and criteria matching
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${lang}/pages/properties/import`}>
              <FileUp className="mr-2 size-4" /> Import CSV
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/${lang}/pages/properties/new`}>
              <Plus className="mr-2 size-4" /> New property
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            "active",
            "leased",
            "under_contract",
            "closed",
            "archived",
          ] as PropertyStatus[]
        ).map((s) => {
          const isActive = statusFilter === s
          const params = new URLSearchParams()
          if (!isActive) params.set("status", s)
          if (search) params.set("search", search)
          if (typeFilter) params.set("type", typeFilter)
          if (includeArchived) params.set("archived", "1")
          const href = `?${params.toString()}`
          return (
            <Link
              key={s}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:border-primary/40"
              )}
            >
              {STATUS_LABELS[s]} ({countByStatus.get(s) ?? 0})
            </Link>
          )
        })}
        {statusFilter || typeFilter || search || includeArchived ? (
          <Link
            href="?"
            className="ml-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">SQFT</TableHead>
                <TableHead className="text-right">List Price</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Pending Replies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No properties yet. Add one manually or import from a CSV.
                  </TableCell>
                </TableRow>
              ) : (
                properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/${lang}/pages/properties/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name ? `${p.name} — ${p.address}` : p.address}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[p.city, p.state, p.zip].filter(Boolean).join(", ")}
                        {p.unit ? ` · Suite ${p.unit}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {p.propertyType ? p.propertyType.replace(/_/g, " ") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[p.status]}
                        className="capitalize"
                      >
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.squareFeet ? p.squareFeet.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.listPrice ? formatCurrency(Number(p.listPrice)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p._count.deals}
                    </TableCell>
                    <TableCell className="text-right">
                      {p._count.pendingReplies > 0 ? (
                        <Badge variant="default">
                          {p._count.pendingReplies}
                        </Badge>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}
