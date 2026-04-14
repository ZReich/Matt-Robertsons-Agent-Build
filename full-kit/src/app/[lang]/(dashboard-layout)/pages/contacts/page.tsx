import { Users } from "lucide-react"

import type { ContactMeta } from "@/lib/vault"
import type { Metadata } from "next"
import type { ContactRow } from "./_components/contacts-table"

import { listNotes } from "@/lib/vault"

import { ContactsTable } from "./_components/contacts-table"

export const metadata: Metadata = {
  title: "Contacts",
}

export default async function ContactsPage() {
  const notes = await listNotes<ContactMeta>("contacts")
  const contacts = notes.filter((n) => n.meta.type === "contact")

  const rows: ContactRow[] = contacts.map((contact) => {
    // Slug from the file name: "contacts/Dr Wilson.md" → "dr-wilson"
    const filename = contact.path.split("/").pop() ?? contact.path
    const slug = filename
      .replace(/\.md$/, "")
      .replace(/\s+/g, "-")
      .toLowerCase()

    return {
      slug,
      name: contact.meta.name,
      role: contact.meta.role ?? "",
      company: contact.meta.company ?? "",
      phone: contact.meta.phone ?? "",
      email: contact.meta.email ?? "",
      address: contact.meta.address ?? "",
    }
  })

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Users className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Personal Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} contact{rows.length !== 1 ? "s" : ""} — doctor,
            family, accountant, and more
          </p>
        </div>
      </div>

      <ContactsTable contacts={rows} />
    </section>
  )
}
