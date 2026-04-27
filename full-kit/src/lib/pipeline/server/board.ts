import type {
  DealStage,
  LeadSource,
  LeadStatus,
  PropertyType,
} from "@prisma/client"
import type { PipelineAgeBucket } from "../age-buckets"
import type { Decimalish } from "../weighted-commission"

import { extractLeadInquiryFacts } from "@/lib/leads/inquiry-facts"
import { cleanLeadMessageText } from "@/lib/leads/message-text"

import { daysSince, getAgeBucketForDate } from "../age-buckets"
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  getStageProbability,
} from "../stage-probability"
import {
  computeWeightedCommission,
  decimalishToNumber,
} from "../weighted-commission"

export const LEAD_STATUSES = [
  "new",
  "vetted",
  "contacted",
  "converted",
  "dropped",
] as const satisfies readonly LeadStatus[]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  vetted: "Vetted",
  contacted: "Contacted",
  converted: "Converted",
  dropped: "Dropped",
}

export type PipelineFilters = {
  search: string
  source: LeadSource | null
  propertyType: PropertyType | null
  age: PipelineAgeBucket | null
  showAll: boolean
  needsFollowup: boolean
}

const LEAD_SOURCE_VALUES = new Set([
  "crexi",
  "loopnet",
  "buildout",
  "email_cold",
  "referral",
])
const PROPERTY_TYPE_VALUES = new Set([
  "office",
  "retail",
  "industrial",
  "multifamily",
  "land",
  "mixed_use",
  "hospitality",
  "medical",
  "other",
])
const AGE_VALUES = new Set(["lt7", "7_30", "30_90", "gt90"])

export function parsePipelineFilters(
  searchParams: URLSearchParams
): PipelineFilters {
  const source = searchParams.get("source")
  const propertyType =
    searchParams.get("propertyType") ?? searchParams.get("type")
  const age = searchParams.get("age")

  return {
    search: searchParams.get("search")?.trim() ?? "",
    source:
      source && LEAD_SOURCE_VALUES.has(source) ? (source as LeadSource) : null,
    propertyType:
      propertyType && PROPERTY_TYPE_VALUES.has(propertyType)
        ? (propertyType as PropertyType)
        : null,
    age: age && AGE_VALUES.has(age) ? (age as PipelineAgeBucket) : null,
    showAll:
      searchParams.get("showAll") === "1" ||
      searchParams.get("showAll") === "true",
    needsFollowup:
      searchParams.get("needsFollowup") === "1" ||
      searchParams.get("needsFollowup") === "true",
  }
}

type CommunicationInput = {
  id?: string
  subject: string | null
  body: string | null
  date: Date
  direction: "inbound" | "outbound" | null
  metadata?: unknown
}

export type DealBoardInput = {
  id: string
  stage: DealStage
  propertyAddress: string
  propertyType: PropertyType
  value: Decimalish
  commissionRate?: Decimalish
  probability?: number | null
  listedDate: Date | null
  stageChangedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  contact?: {
    id: string
    name: string
    company: string | null
    leadSource: LeadSource | null
  } | null
}

export type LeadBoardInput = {
  id: string
  name: string
  company: string | null
  email: string | null
  role?: string | null
  leadSource: LeadSource | null
  leadStatus: LeadStatus | null
  leadAt: Date | null
  estimatedValue?: Decimalish
  updatedAt: Date
  communications?: CommunicationInput[]
}

export type DealCard = {
  id: string
  stage: DealStage
  propertyAddress: string
  propertyType: PropertyType
  clientName: string | null
  clientCompany: string | null
  leadSource: LeadSource | null
  value: number | null
  commissionRate: number
  probability: number
  probabilityOverride: number | null
  weightedCommission: number | null
  ageInStageDays: number | null
  href: string
}

export type LeadCard = {
  id: string
  status: LeadStatus
  name: string
  company: string | null
  email: string | null
  role: string | null
  leadSource: LeadSource
  leadAt: string | null
  estimatedValue: number | null
  snippet: string | null
  propertyName: string | null
  market: string | null
  signal: string | null
  lastTouchAt: string | null
  ageDays: number | null
  href: string
}

export type BoardColumn<TCard, TKey extends string> = {
  id: TKey
  title: string
  cards: TCard[]
  aggregate: {
    count: number
    grossValue?: number
    weightedValue?: number
    estimatedValue?: number
  }
}

function includesText(value: string | null | undefined, query: string) {
  return value?.toLowerCase().includes(query) ?? false
}

export function extractLeadInquiryMessage(
  metadata: unknown,
  fallback: string | null
): string | null {
  if (
    metadata &&
    typeof metadata === "object" &&
    "extracted" in metadata &&
    (metadata as { extracted?: unknown }).extracted &&
    typeof (metadata as { extracted: unknown }).extracted === "object"
  ) {
    const extracted = (metadata as { extracted: Record<string, unknown> })
      .extracted
    const inquirer = extracted.inquirer
    if (
      inquirer &&
      typeof inquirer === "object" &&
      "message" in inquirer &&
      typeof (inquirer as { message?: unknown }).message === "string"
    ) {
      return cleanLeadMessageText((inquirer as { message: string }).message)
    }
  }

  return cleanLeadMessageText(fallback)
}

export function serializeDealBoard(
  deals: DealBoardInput[],
  filters: Partial<PipelineFilters> = {},
  now = new Date()
) {
  const query = filters.search?.toLowerCase() ?? ""
  const cards = deals
    .filter((deal) =>
      filters.source ? deal.contact?.leadSource === filters.source : true
    )
    .filter((deal) =>
      filters.propertyType ? deal.propertyType === filters.propertyType : true
    )
    .filter((deal) => {
      if (!query) return true
      return (
        includesText(deal.propertyAddress, query) ||
        includesText(deal.contact?.name, query) ||
        includesText(deal.contact?.company, query)
      )
    })
    .filter((deal) => {
      const ageDate = deal.stageChangedAt ?? deal.listedDate ?? deal.createdAt
      return filters.age
        ? getAgeBucketForDate(ageDate, now) === filters.age
        : true
    })
    .map<DealCard>((deal) => {
      const value = decimalishToNumber(deal.value)
      const commissionRate = decimalishToNumber(deal.commissionRate) ?? 0.03
      const weightedCommission = computeWeightedCommission({
        stage: deal.stage,
        value,
        commissionRate,
        probability: deal.probability,
      })
      const ageDate = deal.stageChangedAt ?? deal.listedDate ?? deal.createdAt
      const probability = getStageProbability(deal.stage, deal.probability)

      return {
        id: deal.id,
        stage: deal.stage,
        propertyAddress: deal.propertyAddress,
        propertyType: deal.propertyType,
        clientName: deal.contact?.name ?? null,
        clientCompany: deal.contact?.company ?? null,
        leadSource: deal.contact?.leadSource ?? null,
        value,
        commissionRate,
        probability,
        probabilityOverride: deal.probability ?? null,
        weightedCommission,
        ageInStageDays: daysSince(ageDate, now),
        href: `/pages/deals/${deal.id}`,
      }
    })

  const columns = DEAL_STAGES.map<BoardColumn<DealCard, DealStage>>((stage) => {
    const stageCards = cards.filter((card) => card.stage === stage)
    return {
      id: stage,
      title: DEAL_STAGE_LABELS[stage],
      cards: stageCards,
      aggregate: {
        count: stageCards.length,
        grossValue: stageCards.reduce(
          (sum, card) => sum + (card.value ?? 0),
          0
        ),
        weightedValue: stageCards.reduce(
          (sum, card) => sum + (card.weightedCommission ?? 0),
          0
        ),
      },
    }
  })

  return { columns, aggregates: aggregateColumns(columns) }
}

export function serializeLeadBoard(
  leads: LeadBoardInput[],
  filters: Partial<PipelineFilters> = {},
  now = new Date()
) {
  const query = filters.search?.toLowerCase() ?? ""
  const cards = leads
    .filter((lead) => lead.leadSource !== null)
    .filter((lead) =>
      filters.source ? lead.leadSource === filters.source : true
    )
    .filter((lead) => {
      if (!query) return true
      return (
        includesText(lead.name, query) ||
        includesText(lead.company, query) ||
        includesText(lead.email, query) ||
        (lead.communications ?? []).some((comm) =>
          includesText(comm.subject ?? comm.body, query)
        )
      )
    })
    .filter((lead) =>
      filters.age
        ? getAgeBucketForDate(lead.leadAt ?? lead.updatedAt, now) ===
          filters.age
        : true
    )
    .map<LeadCard>((lead) => {
      const inbound = [...(lead.communications ?? [])]
        .filter((communication) => communication.direction === "inbound")
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
      const lastTouch = [...(lead.communications ?? [])].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      )[0]
      const facts = extractLeadInquiryFacts(
        inbound?.metadata ?? null,
        inbound?.body ?? null,
        inbound?.subject ?? null
      )
      const displayName =
        lead.name.includes("@") && facts.inquirerName
          ? facts.inquirerName
          : lead.name

      return {
        id: lead.id,
        status: lead.leadStatus ?? "new",
        name: displayName,
        company: lead.company,
        email: lead.email,
        role: lead.role ?? null,
        leadSource: lead.leadSource!,
        leadAt: lead.leadAt?.toISOString() ?? null,
        estimatedValue: decimalishToNumber(lead.estimatedValue),
        snippet: facts.request ?? facts.message,
        propertyName: facts.propertyName ?? facts.address ?? facts.listingLine,
        market: facts.market,
        signal: facts.kind,
        lastTouchAt: lastTouch?.date.toISOString() ?? null,
        ageDays: daysSince(lead.leadAt ?? lead.updatedAt, now),
        href: `/pages/leads/${lead.id}`,
      }
    })

  const columns = LEAD_STATUSES.map<BoardColumn<LeadCard, LeadStatus>>(
    (status) => {
      const statusCards = cards.filter((card) => card.status === status)
      return {
        id: status,
        title: LEAD_STATUS_LABELS[status],
        cards: statusCards,
        aggregate: {
          count: statusCards.length,
          estimatedValue: statusCards.reduce(
            (sum, card) => sum + (card.estimatedValue ?? 0),
            0
          ),
        },
      }
    }
  )

  return { columns, aggregates: aggregateColumns(columns) }
}

function aggregateColumns<TCard, TKey extends string>(
  columns: BoardColumn<TCard, TKey>[]
) {
  return columns.reduce(
    (acc, column) => ({
      count: acc.count + column.aggregate.count,
      grossValue: acc.grossValue + (column.aggregate.grossValue ?? 0),
      weightedValue: acc.weightedValue + (column.aggregate.weightedValue ?? 0),
      estimatedValue:
        acc.estimatedValue + (column.aggregate.estimatedValue ?? 0),
    }),
    { count: 0, grossValue: 0, weightedValue: 0, estimatedValue: 0 }
  )
}
