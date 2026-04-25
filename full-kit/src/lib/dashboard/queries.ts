import { unstable_cache } from "next/cache"
import { isBefore, startOfDay } from "date-fns"

import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  MeetingMeta,
  TodoMeta,
  VaultNote,
} from "@/lib/vault"
import type { TodoResolvedContext } from "@/lib/vault/resolve-context"
import type {
  CommunicationChannel,
  Direction,
  LeadSource,
} from "@prisma/client"

import {
  getMissedFollowupCutoff,
  selectMissedFollowupReference,
} from "@/lib/pipeline/server/followups"
import { db } from "@/lib/prisma"
import { listNotes } from "@/lib/vault"
import { resolveAllTodoContexts } from "@/lib/vault/resolve-context"

export const DASHBOARD_DATA_TAG = "dashboard-data"

const PRIORITY_ORDER: Record<NonNullable<TodoMeta["priority"]>, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

type TodoNote = VaultNote<TodoMeta>

export interface PipelineSnapshot {
  activeDeals: VaultNote<DealMeta>[]
  totalValue: number
  stageCounts: Record<string, number>
  closingThisMonth: VaultNote<DealMeta>[]
}

export interface LeadPreview {
  id: string
  name: string
  company: string | null
  leadSource: LeadSource | null
  createdAt: Date
}

export interface NewLeadsSummary {
  total: number
  top: LeadPreview[]
}

export interface RecentCommunication {
  id: string
  channel: CommunicationChannel
  subject: string | null
  body: string | null
  date: Date
  direction: Direction | null
  contact: { id: string; name: string } | null
}

export interface MissedFollowup {
  contactId: string
  contactName: string
  company: string | null
  referenceCommunicationId: string
  subject: string | null
  body: string | null
  date: Date
}

interface ContactWithCommunications {
  id: string
  name: string
  company: string | null
  communications: Array<{
    id: string
    subject: string | null
    body: string | null
    date: Date
    direction: Direction | null
  }>
}

export interface MissedFollowupsSummary {
  total: number
  top: MissedFollowup[]
}

export interface DashboardData {
  pipeline: PipelineSnapshot
  todayMeetings: VaultNote<MeetingMeta>[]
  todayTodos: TodoNote[]
  proposedTodos: TodoNote[]
  urgentTodos: TodoNote[]
  todoContexts: Record<string, TodoResolvedContext>
  recentComms: RecentCommunication[]
  newLeads: NewLeadsSummary
  missedFollowups: MissedFollowupsSummary
}

export function isTodoPendingLike(status: TodoMeta["status"] | undefined) {
  return status == null || status === "pending"
}

export function isTodoInProgressLike(status: TodoMeta["status"] | undefined) {
  return status === "in_progress" || status === "in-progress"
}

export function isTodoActiveStatus(status: TodoMeta["status"] | undefined) {
  return isTodoPendingLike(status) || isTodoInProgressLike(status)
}

export function selectProposedTodos(todoNotes: TodoNote[]) {
  return todoNotes
    .filter((todo) => todo.meta.status === "proposed")
    .sort((a, b) => getCreatedTime(b) - getCreatedTime(a))
}

export function selectTodayTodos(todoNotes: TodoNote[], now: Date) {
  return todoNotes
    .filter((todo) => {
      if (!todo.meta.due_date || !isTodoActiveStatus(todo.meta.status)) {
        return false
      }

      return getDateKey(todo.meta.due_date) === getDateKey(now)
    })
    .sort((a, b) => getDueTime(a) - getDueTime(b))
}

export function selectUrgentTodos(
  todoNotes: TodoNote[],
  now: Date,
  limit = 5
): TodoNote[] {
  const todayStart = startOfDay(now)

  return todoNotes
    .filter((todo) => {
      if (!isTodoActiveStatus(todo.meta.status)) return false

      const due = todo.meta.due_date ? parseVaultDate(todo.meta.due_date) : null
      return (
        todo.meta.priority === "urgent" ||
        todo.meta.priority === "high" ||
        (due != null && isBefore(due, todayStart))
      )
    })
    .sort((a, b) => {
      const priorityDiff = getPriorityRank(a) - getPriorityRank(b)
      if (priorityDiff !== 0) return priorityDiff
      return getDueTime(a) - getDueTime(b)
    })
    .slice(0, limit)
}

export function buildPipelineSnapshot(
  dealNotes: VaultNote<DealMeta>[],
  now: Date
): PipelineSnapshot {
  const activeDeals = dealNotes.filter(
    (note) => note.meta.type === "deal" && note.meta.stage !== "closed"
  )
  const totalValue = activeDeals.reduce(
    (sum, deal) => sum + (deal.meta.value ?? 0),
    0
  )
  const stageCounts = activeDeals.reduce<Record<string, number>>(
    (acc, deal) => {
      acc[deal.meta.stage] = (acc[deal.meta.stage] ?? 0) + 1
      return acc
    },
    {}
  )
  const closingThisMonth = activeDeals.filter((deal) => {
    if (!deal.meta.closing_date) return false
    const closing = new Date(deal.meta.closing_date)
    return (
      closing.getMonth() === now.getMonth() &&
      closing.getFullYear() === now.getFullYear()
    )
  })

  return { activeDeals, totalValue, stageCounts, closingThisMonth }
}

export function selectMissedFollowupsFromContacts(
  contacts: ContactWithCommunications[],
  cutoff: Date
): MissedFollowup[] {
  return contacts
    .map((contact) => {
      const reference = selectMissedFollowupReference(
        contact.communications,
        cutoff
      )
      if (!reference) return null

      return {
        contactId: contact.id,
        contactName: contact.name,
        company: contact.company,
        referenceCommunicationId: reference.id,
        subject: reference.subject,
        body: reference.body,
        date: reference.date,
      } satisfies MissedFollowup
    })
    .filter((item): item is MissedFollowup => item != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

const getRecentCommunications = unstable_cache(
  async (): Promise<RecentCommunication[]> =>
    db.communication.findMany({
      orderBy: { date: "desc" },
      take: 5,
      select: {
        id: true,
        channel: true,
        subject: true,
        body: true,
        date: true,
        direction: true,
        contact: { select: { id: true, name: true } },
      },
    }),
  ["dashboard-recent-communications"],
  { tags: [DASHBOARD_DATA_TAG] }
)

const getNewLeads = unstable_cache(
  async (): Promise<NewLeadsSummary> => {
    const where = { leadStatus: "new" as const, archivedAt: null }
    const [total, top] = await Promise.all([
      db.contact.count({ where }),
      db.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          company: true,
          leadSource: true,
          createdAt: true,
        },
      }),
    ])

    return { total, top }
  },
  ["dashboard-new-leads"],
  { tags: [DASHBOARD_DATA_TAG] }
)

const getMissedFollowupContacts = unstable_cache(
  async (cutoff: Date): Promise<ContactWithCommunications[]> =>
    db.contact.findMany({
      where: {
        archivedAt: null,
        leadSource: { not: null },
        OR: [
          { leadStatus: { notIn: ["dropped", "converted"] } },
          { leadStatus: null },
        ],
        communications: {
          some: {
            direction: "inbound",
            date: { lt: cutoff },
          },
        },
      },
      select: {
        id: true,
        name: true,
        company: true,
        communications: {
          where: { direction: { not: null } },
          orderBy: { date: "asc" },
          select: {
            id: true,
            subject: true,
            body: true,
            date: true,
            direction: true,
          },
        },
      },
    }),
  ["dashboard-missed-followups"],
  { tags: [DASHBOARD_DATA_TAG] }
)

export async function getMissedFollowups(now = new Date()) {
  const cutoff = getMissedFollowupCutoff(now)
  const all = selectMissedFollowupsFromContacts(
    await getMissedFollowupContacts(cutoff),
    cutoff
  )

  return { total: all.length, top: all.slice(0, 5) }
}

export async function getDashboardData(
  now = new Date()
): Promise<DashboardData> {
  const [
    dealNotes,
    todoNotes,
    meetingNotes,
    commNotes,
    clientNotes,
    contactNotes,
    recentComms,
    newLeads,
    missedFollowups,
  ] = await Promise.all([
    listNotes<DealMeta>("clients"),
    listNotes<TodoMeta>("todos"),
    listNotes<MeetingMeta>("meetings"),
    listNotes<CommunicationMeta>("communications"),
    listNotes<ClientMeta>("clients"),
    listNotes<ContactMeta>("contacts"),
    getRecentCommunications(),
    getNewLeads(),
    getMissedFollowups(now),
  ])

  const todayMeetings = meetingNotes.filter((meeting) => {
    const date = new Date(meeting.meta.date)
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    )
  })
  const proposedTodos = selectProposedTodos(todoNotes)
  const todayTodos = selectTodayTodos(todoNotes, now)
  const urgentTodos = selectUrgentTodos(todoNotes, now)
  const todoContexts = resolveAllTodoContexts(
    todoNotes,
    clientNotes,
    contactNotes,
    dealNotes,
    commNotes
  )

  return {
    pipeline: buildPipelineSnapshot(dealNotes, now),
    todayMeetings,
    todayTodos,
    proposedTodos,
    urgentTodos,
    todoContexts,
    recentComms,
    newLeads,
    missedFollowups,
  }
}

function getPriorityRank(todo: TodoNote) {
  return PRIORITY_ORDER[todo.meta.priority ?? "medium"] ?? 2
}

function getDueTime(todo: TodoNote) {
  return todo.meta.due_date
    ? parseVaultDate(todo.meta.due_date).getTime()
    : Infinity
}

function getCreatedTime(todo: TodoNote) {
  const raw = todo.meta.created ?? todo.meta.updated
  return raw ? new Date(raw).getTime() : 0
}

function parseVaultDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    )
  }

  return new Date(value)
}

function getDateKey(value: string | Date) {
  if (typeof value === "string") {
    const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(value)
    if (dateOnly) return dateOnly[1]
  }

  const date = typeof value === "string" ? new Date(value) : value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
