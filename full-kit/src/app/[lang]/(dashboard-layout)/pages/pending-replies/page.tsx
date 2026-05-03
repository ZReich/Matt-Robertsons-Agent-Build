import Link from "next/link"
import { Reply } from "lucide-react"

import type { Metadata } from "next"
import type { PendingReplyStatus } from "@prisma/client"

import { db } from "@/lib/prisma"
import { cn } from "@/lib/utils"

import { Card, CardContent } from "@/components/ui/card"

import { PendingReplyCard } from "./_components/pending-reply-card"
import { ProcessDailyListingsButton } from "./_components/process-daily-listings-button"

export const metadata: Metadata = {
  title: "Pending Replies",
}

export const dynamic = "force-dynamic"

const STATUSES: PendingReplyStatus[] = ["pending", "approved", "dismissed"]

interface Props {
  params: Promise<{ lang: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function paramString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined
}

export default async function PendingRepliesPage({ params, searchParams }: Props) {
  const { lang } = await params
  const sp = (await searchParams) ?? {}
  const status = (paramString(sp.status) as PendingReplyStatus | undefined) ?? "pending"

  const [replies, counts] = await Promise.all([
    db.pendingReply.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: {
        property: {
          select: { id: true, name: true, address: true, listingUrl: true },
        },
      },
    }),
    db.pendingReply.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ])

  const countByStatus = new Map<string, number>()
  for (const c of counts) countByStatus.set(c.status, c._count._all)

  // Hydrate inquirer/contact info in one batch query.
  const contactIds = replies
    .map((r) => r.contactId)
    .filter((id): id is string => Boolean(id))
  const contactsArr = contactIds.length
    ? await db.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, name: true, company: true, email: true, phone: true },
      })
    : []
  const contactMap = new Map(contactsArr.map((c) => [c.id, c]))

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Reply className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Pending Replies</h1>
          <p className="text-sm text-muted-foreground">
            AI-drafted responses to inbound lead inquiries and daily-listings
            matches. Review, edit, then send via Matt&apos;s mailbox.
          </p>
        </div>
        <ProcessDailyListingsButton />
      </div>

      <div className="flex items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize",
              status === s
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:border-primary/40"
            )}
          >
            {s} ({countByStatus.get(s) ?? 0})
          </Link>
        ))}
      </div>

      {replies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No {status} replies right now. Drafts appear here when an inbound
            lead inquiry matches a property in the catalog.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {replies.map((r) => (
            <PendingReplyCard
              key={r.id}
              lang={lang}
              reply={{
                id: r.id,
                status: r.status,
                draftSubject: r.draftSubject,
                draftBody: r.draftBody,
                reasoning: r.reasoning,
                modelUsed: r.modelUsed,
                createdAt: r.createdAt.toISOString(),
                approvedAt: r.approvedAt?.toISOString() ?? null,
                dismissedAt: r.dismissedAt?.toISOString() ?? null,
                dismissReason: r.dismissReason,
                property: r.property,
                contact: r.contactId ? contactMap.get(r.contactId) ?? null : null,
                triggerCommunicationId: r.triggerCommunicationId,
                suggestedProperties: parseSuggested(r.suggestedProperties),
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function parseSuggested(value: unknown): Array<{
  propertyId: string
  address: string
  name: string | null
  score: number
}> {
  if (!Array.isArray(value)) return []
  const out: Array<{ propertyId: string; address: string; name: string | null; score: number }> = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const r = item as Record<string, unknown>
    if (
      typeof r.propertyId === "string" &&
      typeof r.address === "string" &&
      typeof r.score === "number"
    ) {
      out.push({
        propertyId: r.propertyId,
        address: r.address,
        name: typeof r.name === "string" ? r.name : null,
        score: r.score,
      })
    }
  }
  return out
}
