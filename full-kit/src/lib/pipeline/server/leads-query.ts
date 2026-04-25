import type { Prisma } from "@prisma/client"
import type { PipelineFilters } from "./board"

import { db } from "@/lib/prisma"

import { getAgeBucketForDate } from "../age-buckets"
import { getMissedFollowupCutoff, hasMissedFollowup } from "./followups"

const LEAD_WITH_COMMUNICATIONS = {
  communications: {
    orderBy: { date: "desc" },
    select: {
      id: true,
      subject: true,
      body: true,
      date: true,
      direction: true,
      metadata: true,
    },
  },
} satisfies Prisma.ContactInclude

export type LeadContactWithCommunications = Prisma.ContactGetPayload<{
  include: typeof LEAD_WITH_COMMUNICATIONS
}>

export function getTerminalLeadWhere(
  filters: Pick<PipelineFilters, "showAll" | "needsFollowup">,
  terminalCutoff: Date
): Prisma.ContactWhereInput {
  if (filters.needsFollowup) {
    return {
      OR: [
        { leadStatus: { notIn: ["converted", "dropped"] } },
        { leadStatus: null },
      ],
    }
  }

  if (filters.showAll) return {}

  return {
    OR: [
      { leadStatus: { notIn: ["converted", "dropped"] } },
      { leadStatus: null },
      { leadAt: { gte: terminalCutoff } },
      { leadAt: null, updatedAt: { gte: terminalCutoff } },
    ],
  }
}

export function buildLeadContactWhere(
  filters: PipelineFilters,
  terminalCutoff: Date,
  followupCutoff = getMissedFollowupCutoff()
): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [
    { archivedAt: null },
    filters.source
      ? { leadSource: filters.source }
      : { leadSource: { not: null } },
    getTerminalLeadWhere(filters, terminalCutoff),
  ]

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { company: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        {
          communications: {
            some: {
              subject: { contains: filters.search, mode: "insensitive" },
            },
          },
        },
        {
          communications: {
            some: { body: { contains: filters.search, mode: "insensitive" } },
          },
        },
      ],
    })
  }

  if (filters.needsFollowup) {
    and.push({
      communications: {
        some: { direction: "inbound", date: { lt: followupCutoff } },
      },
    })
  }

  return { AND: and }
}

export function filterLeadContactsForPipeline(
  contacts: LeadContactWithCommunications[],
  filters: PipelineFilters,
  now = new Date()
) {
  const followupCutoff = getMissedFollowupCutoff(now)

  return contacts
    .filter((contact) =>
      filters.needsFollowup
        ? hasMissedFollowup(contact.communications, followupCutoff)
        : true
    )
    .filter((contact) =>
      filters.age
        ? getAgeBucketForDate(contact.leadAt ?? contact.updatedAt, now) ===
          filters.age
        : true
    )
}

export async function getLeadContactsForPipeline(
  filters: PipelineFilters,
  now = new Date()
) {
  const terminalCutoff = new Date(now.getTime() - 30 * 86_400_000)
  const contacts = await db.contact.findMany({
    where: buildLeadContactWhere(
      filters,
      terminalCutoff,
      getMissedFollowupCutoff(now)
    ),
    include: LEAD_WITH_COMMUNICATIONS,
    orderBy: [{ leadAt: "desc" }, { updatedAt: "desc" }],
  })

  return filterLeadContactsForPipeline(contacts, filters, now)
}
