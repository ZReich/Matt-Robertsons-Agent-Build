import { notFound, redirect } from "next/navigation"

import { db } from "@/lib/prisma"

// The legacy /pages/clients/[id] page used to render from vault markdown
// notes; the canonical contact entity now lives in Prisma and is rendered
// at /pages/contacts/[id]. This route exists only to forward old links.
//
// The incoming `id` segment can be either:
//   - a Contact UUID (new bookmarks from the migrated Clients tab)
//   - an old vault folder slug like "john-smith" (legacy bookmarks)
// We resolve the slug variant to a Contact by case-insensitive name match
// (the vault folders were created by slugifying the contact's name).

interface ClientDetailPageProps {
  params: Promise<{ id: string; lang: string }>
}

export const dynamic = "force-dynamic"

export default async function LegacyClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { id, lang } = await params

  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  if (looksLikeUuid) {
    const exists = await db.contact.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!exists) notFound()
    redirect(`/${lang}/pages/contacts/${id}`)
  }

  // Slug fallback: replace dashes with spaces and case-insensitive match.
  const expanded = id.replace(/-/g, " ")
  const contact = await db.contact.findFirst({
    where: {
      archivedAt: null,
      name: { equals: expanded, mode: "insensitive" },
    },
    select: { id: true },
  })
  if (!contact) notFound()
  redirect(`/${lang}/pages/contacts/${contact.id}`)
}
