import type { Metadata } from "next"
import { Building2 } from "lucide-react"

import { listNotes } from "@/lib/vault"
import type { ClientMeta, DealMeta } from "@/lib/vault"

import { ClientsTable, type ClientRow } from "./_components/clients-table"

export const metadata: Metadata = {
  title: "Clients",
}

export default async function ClientsPage() {
  const [clientNotes, dealNotes] = await Promise.all([
    listNotes<ClientMeta>("clients"),
    listNotes<DealMeta>("clients"),
  ])

  const clients = clientNotes.filter((n) => n.meta.type === "client")
  const deals = dealNotes.filter((n) => n.meta.type === "deal")

  const rows: ClientRow[] = clients.map((client) => {
    // Slug is the folder name: "clients/john-smith/..." → "john-smith"
    const slug = client.path.split("/")[1] ?? client.path

    const activeDeals = deals.filter((d) => {
      const dealClient = d.meta.client?.replace(/\[\[|\]\]/g, "") ?? ""
      return dealClient === client.meta.name && d.meta.stage !== "closed"
    }).length

    return {
      slug,
      name: client.meta.name,
      company: client.meta.company ?? "",
      email: client.meta.email ?? "",
      phone: client.meta.phone ?? "",
      role: client.meta.role ?? "",
      activeDeals,
      tags: client.meta.tags ?? [],
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
            {rows.length} business contact{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <ClientsTable clients={rows} />
    </section>
  )
}
