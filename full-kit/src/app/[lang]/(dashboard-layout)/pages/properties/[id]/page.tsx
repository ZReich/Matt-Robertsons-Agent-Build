import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react"

import type { Metadata } from "next"
import type { PropertyStatus } from "@prisma/client"

import { findMatchesForProperty } from "@/lib/matching/queries"
import { db } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const STATUS_LABELS: Record<PropertyStatus, string> = {
  active: "Available",
  under_contract: "Under contract",
  leased: "Leased",
  closed: "Sold",
  archived: "Archived",
}

interface PropertyDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export async function generateMetadata({
  params,
}: PropertyDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const property = await db.property.findUnique({
    where: { id },
    select: { name: true, address: true },
  })
  return {
    title: property
      ? property.name
        ? `${property.name} — ${property.address}`
        : property.address
      : "Property",
  }
}

export const dynamic = "force-dynamic"

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const { id, lang } = await params
  const property = await db.property.findUnique({
    where: { id },
    include: {
      deals: {
        where: { archivedAt: null },
        include: {
          contact: { select: { id: true, name: true, company: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      pendingReplies: {
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!property) notFound()

  const matches = await findMatchesForProperty(property.id, { limit: 12 })

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${lang}/pages/properties`}>
            <ArrowLeft className="mr-1 size-4" /> Properties
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {property.name ?? property.address}
            </h1>
            <Badge variant="secondary" className="capitalize">
              {STATUS_LABELS[property.status]}
            </Badge>
          </div>
          {property.name ? (
            <p className="text-sm text-muted-foreground">{property.address}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {[property.city, property.state, property.zip]
              .filter(Boolean)
              .join(", ")}
            {property.unit ? ` · Suite ${property.unit}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {property.listingUrl ? (
            <Button asChild variant="outline" size="sm">
              <Link href={property.listingUrl} target="_blank" rel="noreferrer">
                Listing <ExternalLink className="ml-1 size-3.5" />
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href={`/${lang}/pages/properties/${property.id}/edit`}>
              <Pencil className="mr-1 size-4" /> Edit
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Stat label="Property type" value={property.propertyType ? property.propertyType.replace(/_/g, " ") : "—"} />
            <Stat label="Status" value={STATUS_LABELS[property.status]} />
            <Stat
              label="Square feet"
              value={property.squareFeet ? property.squareFeet.toLocaleString() : "—"}
            />
            <Stat
              label="Occupied SQFT"
              value={
                property.occupiedSquareFeet
                  ? property.occupiedSquareFeet.toLocaleString()
                  : "—"
              }
            />
            <Stat
              label="List price"
              value={
                property.listPrice
                  ? formatCurrency(Number(property.listPrice))
                  : "—"
              }
            />
            <Stat
              label="Cap rate"
              value={
                property.capRate ? `${(Number(property.capRate) * 1).toFixed(2)}%` : "—"
              }
            />
            {property.description ? (
              <div className="md:col-span-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-sm">{property.description}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Catalog metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Source:</span>{" "}
                {property.source ?? "—"}
              </div>
              <div>
                <span className="font-medium text-foreground">Property key:</span>{" "}
                <code className="text-[11px]">{property.propertyKey}</code>
              </div>
              <div>
                <span className="font-medium text-foreground">Created:</span>{" "}
                {property.createdAt.toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium text-foreground">Updated:</span>{" "}
                {property.updatedAt.toLocaleDateString()}
              </div>
              {property.listedAt ? (
                <div>
                  <span className="font-medium text-foreground">Listed:</span>{" "}
                  {property.listedAt.toLocaleDateString()}
                </div>
              ) : null}
              {property.closedAt ? (
                <div>
                  <span className="font-medium text-foreground">Closed:</span>{" "}
                  {property.closedAt.toLocaleDateString()}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked deals ({property.deals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {property.deals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No deals are linked to this property yet. Deals get linked
              automatically when a lead inquiry resolves to this address.
            </p>
          ) : (
            <ul className="grid gap-2">
              {property.deals.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/${lang}/pages/deals/${d.id}`}
                      className="font-medium hover:underline"
                    >
                      {d.contact.name ?? "Unnamed contact"}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {d.contact.company ?? ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {d.stage.replace(/_/g, " ")}
                    </Badge>
                    {d.value ? (
                      <span className="text-xs font-medium">
                        {formatCurrency(Number(d.value))}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matching contacts ({matches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No contacts have search criteria that match this property yet.
              Tag contacts as <strong>buyer</strong> /{" "}
              <strong>tenant</strong> / <strong>investor</strong> and fill in
              their criteria to populate this list.
            </p>
          ) : (
            <ul className="grid gap-2">
              {matches.map((m) => (
                <li
                  key={m.contact.id}
                  className="flex flex-col gap-1 rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/${lang}/pages/contacts/${m.contact.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.contact.name}
                      {m.contact.company ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {m.contact.company}
                        </span>
                      ) : null}
                    </Link>
                    <Badge
                      variant={m.score >= 80 ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {m.score}%
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.reasons.slice(0, 4).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Pending auto-reply drafts ({property.pendingReplies.filter((r) => r.status === "pending").length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {property.pendingReplies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending replies. Drafts are generated automatically when a
              lead inquiry on this property arrives.
            </p>
          ) : (
            <ul className="grid gap-2">
              {property.pendingReplies.slice(0, 5).map((r) => (
                <li key={r.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.draftSubject}</span>
                    <Badge
                      variant={r.status === "pending" ? "default" : "outline"}
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {r.draftBody}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}
