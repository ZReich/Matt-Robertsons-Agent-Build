import { Users } from "lucide-react"

import type { Metadata } from "next"
import type { ContactRow } from "./_components/contacts-table"

import { db } from "@/lib/prisma"

import { ContactsTable } from "./_components/contacts-table"

export const metadata: Metadata = {
  title: "Contacts",
}

// Always render from the live DB; never try to statically pre-render.
export const dynamic = "force-dynamic"

export default async function ContactsPage() {
  const contacts = await db.contact.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
  })

  const rows: ContactRow[] = contacts.map((c) => ({
    // Use the Contact UUID as the routing slug; the [id] detail page
    // looks this up directly via Prisma.
    slug: c.id,
    name: c.name,
    role: c.role ?? "",
    company: c.company ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
  }))

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Users className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} contact{rows.length !== 1 ? "s" : ""} from Outlook
          </p>
        </div>
      </div>

      <ContactsTable contacts={rows} />
    </section>
  )
}
