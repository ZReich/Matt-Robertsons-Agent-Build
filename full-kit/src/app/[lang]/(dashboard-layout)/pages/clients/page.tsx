import { Building2 } from "lucide-react"

import type { ClientType, DealType } from "@prisma/client"
import type { Metadata } from "next"
import type { ClientRow } from "./_components/clients-table"

import { db } from "@/lib/prisma"

import { ClientsTable } from "./_components/clients-table"

export const metadata: Metadata = {
  title: "Clients",
}

export const dynamic = "force-dynamic"

// "Clients" = people Matt actually represents. Cooperating brokers, service
// providers, and prospects are tracked via Contact.clientType but should not
// appear in this list — they have (or will have) their own views.
const REAL_CLIENT_TYPES: ClientType[] = [
  "active_listing_client",
  "active_buyer_rep_client",
  "past_client",
  "past_listing_client",
  "past_buyer_client",
]

// Map a clientType to the dealType(s) that legitimately count as that
// client's "active deals." Counting all deals where contactId === client.id
// would over-count when the contact is the inquirer side of a buyer-rep
// listing or the cooperating broker on a seller-rep deal.
function dealTypesForClient(clientType: ClientType): DealType[] {
  if (clientType === "active_listing_client") return ["seller_rep"]
  if (clientType === "active_buyer_rep_client") return ["buyer_rep"]
  if (clientType === "past_listing_client") return ["seller_rep"]
  if (clientType === "past_buyer_client") return ["buyer_rep", "tenant_rep"]
  // legacy past_client: could be either; allow both.
  return ["seller_rep", "buyer_rep"]
}

export default async function ClientsPage() {
  const contacts = await db.contact.findMany({
    where: {
      archivedAt: null,
      clientType: { in: REAL_CLIENT_TYPES },
    },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      role: true,
      tags: true,
      clientType: true,
      deals: {
        where: { archivedAt: null, stage: { not: "closed" } },
        select: { id: true, dealType: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const rows: ClientRow[] = contacts.map((contact) => {
    const allowedDealTypes = contact.clientType
      ? dealTypesForClient(contact.clientType)
      : []
    const activeDeals = contact.deals.filter((deal) =>
      allowedDealTypes.includes(deal.dealType)
    ).length

    return {
      id: contact.id,
      name: contact.name,
      company: contact.company ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      role: contact.role ?? "",
      activeDeals,
      tags: parseTagList(contact.tags),
      clientType: contact.clientType ?? null,
    }
  })

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "client" : "clients"}
          </p>
        </div>
      </div>

      <ClientsTable clients={rows} />
    </section>
  )
}

// Contact.tags is a JSON column defaulted to "[]". Most rows are arrays at
// rest, but legacy ingest paths have written stringified JSON in the past, so
// accept either shape and drop anything else.
function parseTagList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((t): t is string => typeof t === "string")
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === "string")
      }
    } catch {
      // Not JSON — fall through.
    }
  }
  return []
}
