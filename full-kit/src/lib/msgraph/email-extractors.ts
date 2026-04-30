import { normalizeBuildoutProperty } from "@/lib/buildout/property-normalizer"
import { parseBuildoutStageTransition } from "@/lib/msgraph/buildout-stage-parser"

export interface ExtractorInput {
  subject: string | null | undefined
  bodyText: string
}

export interface InquirerInfo {
  name?: string
  email?: string
  phone?: string
  company?: string
  message?: string
}

export interface CrexiLeadExtract {
  kind: "new-leads-count" | "inquiry" | "team-note"
  propertyName?: string
  propertyAddress?: string
  propertyKey?: string
  propertyAliases?: string[]
  propertyAddressMissing?: boolean
  leadCount?: number
  cityOrMarket?: string
  inquirerName?: string
  inquirer?: InquirerInfo
  noteAuthor?: string
}

const CREXI_COUNT_LEADS = /^(\d+)\s+new leads? found for\s+(.+)$/i
const CREXI_INQUIRY_SUBJECT =
  /^(.+?)\s+requesting\s+information\s+on\s+(.+?)\s+in\s+(.+)$/i
const CREXI_TEAM_NOTE = /^(.+?)\s+entered a note on\s+(.+)$/i
const CREXI_GENERIC_NEW_LEADS = /^you have NEW leads to be contacted$/i

export function extractCrexiLead(
  input: ExtractorInput
): CrexiLeadExtract | null {
  const subject = (input.subject ?? "").trim()
  if (!subject) return null

  let result: CrexiLeadExtract | null = null

  let m = subject.match(CREXI_COUNT_LEADS)
  if (m) {
    result = {
      kind: "new-leads-count",
      leadCount: Number.parseInt(m[1], 10),
      propertyName: m[2].trim(),
    }
  }

  if (!result) {
    m = subject.match(CREXI_INQUIRY_SUBJECT)
    if (m) {
      const inquirer = parseInquirerBody(input.bodyText)
      result = {
        kind: "inquiry",
        inquirerName: m[1].trim(),
        propertyName: m[2].trim(),
        cityOrMarket: m[3].trim(),
        ...(inquirer ? { inquirer } : {}),
      }
    }
  }

  if (!result && CREXI_GENERIC_NEW_LEADS.test(subject)) {
    const inquirer = parseInquirerBody(input.bodyText)
    result = {
      kind: "inquiry",
      ...(inquirer ? { inquirer } : {}),
    }
  }

  if (!result) {
    m = subject.match(CREXI_TEAM_NOTE)
    if (m) {
      result = {
        kind: "team-note",
        noteAuthor: m[1].trim(),
        propertyName: m[2].trim(),
      }
    }
  }

  if (!result) return null

  // Crexi inquiry bodies start with "Regarding listing at <full address>".
  // Route through normalizeBuildoutProperty for canonical-key derivation —
  // same single source of truth as the Buildout extractor.
  const addressMatch = input.bodyText.match(
    /Regarding listing at\s+(.+?)(?:\r?\n|<|$)/
  )
  const addressFromLabel = addressMatch?.[1]?.trim()
  const normalized = normalizeBuildoutProperty(
    result.propertyName ?? addressFromLabel ?? "",
    addressFromLabel ?? input.bodyText
  )
  if (normalized) {
    // Prefer the labeled full line over normalized.propertyAddressRaw
    // (which is only the regex-extracted street portion).
    result.propertyAddress = addressFromLabel ?? normalized.propertyAddressRaw
    result.propertyKey = normalized.normalizedPropertyKey
    result.propertyAliases = normalized.aliases
    result.propertyAddressMissing = normalized.addressMissing
  }

  return result
}

export interface LoopNetLeadExtract {
  kind: "inquiry" | "favorited"
  propertyName: string
  inquirer?: InquirerInfo
  viewerName?: string
}

const LOOPNET_INQUIRY = /^loopnet lead for\s+(.+)$/i
const LOOPNET_FAVORITED = /^(.+?)\s+favorited\s+(.+)$/i
const LOOPNET_SELF_CONFIRM = /^your loopnet inquiry was sent$/i

export function extractLoopNetLead(
  input: ExtractorInput
): LoopNetLeadExtract | null {
  const subject = (input.subject ?? "").trim()
  if (!subject) return null

  if (LOOPNET_SELF_CONFIRM.test(subject)) return null

  let m = subject.match(LOOPNET_INQUIRY)
  if (m) {
    const inquirer = parseInquirerBody(input.bodyText)
    return {
      kind: "inquiry",
      propertyName: m[1].trim(),
      ...(inquirer ? { inquirer } : {}),
    }
  }

  m = subject.match(LOOPNET_FAVORITED)
  if (m) {
    const inquirer = parseInquirerBody(input.bodyText)
    return {
      kind: "favorited",
      viewerName: m[1].trim(),
      propertyName: m[2].trim(),
      ...(inquirer ? { inquirer } : {}),
    }
  }

  return null
}

export interface BuildoutEventExtract {
  kind:
    | "new-lead"
    | "information-requested"
    | "deal-stage-update"
    | "task-assigned"
    | "critical-date"
    | "ca-executed"
    | "document-view"
    | "voucher-approved"
    | "voucher-deposit"
    | "commission-payment"
    | "listing-expiration"
  propertyName?: string
  propertyAddress?: string
  propertyKey?: string
  propertyAliases?: string[]
  propertyAddressMissing?: boolean
  inquirer?: InquirerInfo
  viewer?: InquirerInfo
  newStage?: string
  previousStage?: string
  fromStageRaw?: string
  toStageRaw?: string
  taskTitle?: string
  taskDueDate?: string
  taskAssignee?: string
  criticalDate?: string
  deadlineType?: string
  documentName?: string
  voucherName?: string
  payerName?: string
  daysUntilExpiration?: number
}

const BUILDOUT_NEW_LEAD = /^a new lead has been added\s*-\s*(.+)$/i
const BUILDOUT_INFORMATION_REQUESTED =
  /^(.+?)\s*-\s*information requested by\s+(.+)$/i
const BUILDOUT_STAGE = /^deal stage updated on\s+(.+)$/i
const BUILDOUT_TASK =
  /^(?:you've been assigned a task|tasks? (?:were )?assigned to you on\s+(.+))$/i
const BUILDOUT_CRITICAL = /critical date.*upcoming/i
const BUILDOUT_CA_EXECUTED = /^ca executed on\s+(.+)$/i
const BUILDOUT_DOCUMENT_VIEW = /^documents viewed on\s+(.+)$/i
const BUILDOUT_VOUCHER_APPROVED = /^voucher approved$/i
const BUILDOUT_VOUCHER_DEPOSIT = /^new voucher deposit$/i
const BUILDOUT_COMMISSION_PAYMENT = /^new commission payment$/i
const BUILDOUT_LISTING_EXPIRATION =
  /^buildout:\s*(\d+)\s+day expiration notice for ['"]?(.+?)['"]?$/i

export function extractBuildoutEvent(
  input: ExtractorInput
): BuildoutEventExtract | null {
  const subject = (input.subject ?? "").trim()
  if (!subject) return null

  let result: BuildoutEventExtract | null = null

  let m = subject.match(BUILDOUT_NEW_LEAD)
  if (m) {
    const inquirer = parseBuildoutLeadBody(input.bodyText)
    result = {
      kind: "new-lead",
      propertyName: m[1].trim(),
      ...(inquirer ? { inquirer } : {}),
    }
  }

  if (!result) {
    m = subject.match(BUILDOUT_INFORMATION_REQUESTED)
    if (m) {
      const inquirer = parseBuildoutLeadBody(input.bodyText) ?? {
        name: m[2].trim(),
      }
      result = {
        kind: "information-requested",
        propertyName: m[1].trim(),
        inquirer: {
          ...inquirer,
          name: inquirer.name ?? m[2].trim(),
        },
      }
    }
  }

  if (!result) {
    m = subject.match(BUILDOUT_STAGE)
    if (m) {
      const stage = parseBuildoutStageBody(input.bodyText)
      const transition = parseBuildoutStageTransition(input.bodyText)
      result = {
        kind: "deal-stage-update",
        propertyName: m[1].trim(),
        previousStage: stage.previousStage,
        newStage: stage.newStage,
        ...(transition?.fromStageRaw
          ? { fromStageRaw: transition.fromStageRaw }
          : {}),
        ...(transition?.toStageRaw
          ? { toStageRaw: transition.toStageRaw }
          : {}),
      }
    }
  }

  if (!result) {
    m = subject.match(BUILDOUT_TASK)
    if (m) {
      const task = parseBuildoutTaskBody(input.bodyText)
      result = {
        kind: "task-assigned",
        propertyName: task.propertyName ?? m[1]?.trim(),
        taskTitle: task.taskTitle,
        taskDueDate: task.taskDueDate,
        taskAssignee: task.taskAssignee,
      }
    }
  }

  if (!result && BUILDOUT_CRITICAL.test(subject)) {
    result = {
      kind: "critical-date",
      ...parseBuildoutCriticalDateBody(input.bodyText),
    }
  }

  if (!result) {
    m = subject.match(BUILDOUT_CA_EXECUTED)
    if (m) {
      result = { kind: "ca-executed", propertyName: m[1].trim() }
    }
  }

  if (!result) {
    m = subject.match(BUILDOUT_DOCUMENT_VIEW)
    if (m) {
      result = {
        kind: "document-view",
        propertyName: m[1].trim(),
        ...parseBuildoutDocumentViewBody(input.bodyText),
      }
    }
  }

  if (!result && BUILDOUT_VOUCHER_APPROVED.test(subject)) {
    result = {
      kind: "voucher-approved",
      ...parseBuildoutVoucherBody(input.bodyText),
    }
  }

  if (!result && BUILDOUT_VOUCHER_DEPOSIT.test(subject)) {
    result = {
      kind: "voucher-deposit",
      ...parseBuildoutVoucherBody(input.bodyText),
    }
  }

  if (!result && BUILDOUT_COMMISSION_PAYMENT.test(subject)) {
    result = {
      kind: "commission-payment",
      ...parseBuildoutVoucherBody(input.bodyText),
    }
  }

  if (!result) {
    m = subject.match(BUILDOUT_LISTING_EXPIRATION)
    if (m) {
      result = {
        kind: "listing-expiration",
        daysUntilExpiration: Number.parseInt(m[1], 10),
        propertyName: m[2].trim(),
      }
    }
  }

  if (!result) return null

  // Extract the labelled "Listing Address" line for high-fidelity address text,
  // then delegate canonical-key derivation to the existing Buildout normalizer
  // (single source of truth across lead-derived and Buildout-event Deal joins).
  const addressMatch = input.bodyText.match(
    /Listing Address\s+(.+?)(?:\r?\n|<|$)/
  )
  const addressFromLabel = addressMatch?.[1]?.trim()
  const normalized = normalizeBuildoutProperty(
    result.propertyName ?? addressFromLabel ?? "",
    addressFromLabel ?? input.bodyText
  )
  if (normalized) {
    // Prefer the labeled full line ("303 North Broadway, Billings, MT 59101")
    // over normalized.propertyAddressRaw (which is just the regex-extracted
    // street portion, "303 North Broadway" — no city/state/zip).
    result.propertyAddress = addressFromLabel ?? normalized.propertyAddressRaw
    result.propertyKey = normalized.normalizedPropertyKey
    result.propertyAliases = normalized.aliases
    result.propertyAddressMissing = normalized.addressMissing
  }

  return result
}

function parseBuildoutLeadBody(body: string): InquirerInfo | null {
  const parsed = parseInquirerBody(body) ?? {}
  const text = compactText(body)
  const viewedM = text.match(/Hello,\s+(.+?)\s+has viewed your Property Page/i)
  if (viewedM) parsed.name ??= viewedM[1].trim()
  const infoM = text.match(/Profile information on file for\s+(.+?):/i)
  if (infoM) parsed.name ??= infoM[1].trim()
  const emailM = text.match(/\bEmail\s+([^\s<>]+@[^\s<>]+)/i)
  if (emailM) parsed.email ??= cleanEmail(emailM[1])
  const phoneM = text.match(/\bPhone\s+([+\d][+\d\s().-]{6,})/i)
  if (phoneM) parsed.phone ??= cleanPhone(phoneM[1])
  const companyM = text.match(
    /\bCompany\s+(.+?)\s+(?:Role|Job Title|Email|Phone)\b/i
  )
  if (companyM) parsed.company ??= companyM[1].trim()
  return Object.keys(parsed).length > 0 ? parsed : null
}

function parseBuildoutStageBody(body: string): {
  previousStage?: string
  newStage?: string
} {
  const text = compactText(body)
  const m = text.match(
    /\bwas updated from\s+(.+?)\s+to\s+(.+?)(?:\.|\s+\[https?:|\s+View\b|$)/i
  )
  return m
    ? {
        previousStage: m[1].trim(),
        newStage: m[2].trim(),
      }
    : {}
}

function parseBuildoutTaskBody(body: string): {
  propertyName?: string
  taskTitle?: string
  taskDueDate?: string
  taskAssignee?: string
} {
  const text = compactText(body)
  const m = text.match(
    /assigned multiple tasks on\s+(.+?)\s+(\d{1,2}\s+[A-Z]{3},\s+\d{4})\s+(.+?)(?:\s+\[https?:|\s+View\b|$)/i
  )
  return m
    ? {
        propertyName: m[1].trim(),
        taskDueDate: m[2].trim(),
        taskTitle: m[3].trim(),
        taskAssignee: "Matt Robertson",
      }
    : {}
}

function parseBuildoutCriticalDateBody(body: string): {
  propertyName?: string
  criticalDate?: string
  deadlineType?: string
} {
  const text = compactText(body)
  const dateM = text.match(
    /(\d{1,2}\s+[A-Z]{3},\s+\d{4})\s+(.+?)(?:\s+\[https?:|\s+View\b|$)/i
  )
  const propertyM = text.match(
    /(?:on|for)\s+(.+?)\s+\d{1,2}\s+[A-Z]{3},\s+\d{4}/i
  )
  return {
    propertyName: propertyM?.[1]?.trim(),
    criticalDate: dateM?.[1]?.trim(),
    deadlineType: dateM?.[2]?.trim(),
  }
}

function parseBuildoutDocumentViewBody(body: string): {
  propertyAddress?: string
  documentName?: string
  viewer?: InquirerInfo
} {
  const text = compactText(body)
  const viewM = text.match(/(.+?)\s+viewed\s+(.+?)\s+for\s+(.+?)\s+at\s+/i)
  const viewer = parseBuildoutLeadBody(body)
  return {
    viewer: viewer ?? (viewM?.[1] ? { name: viewM[1].trim() } : undefined),
    documentName: viewM?.[2]?.trim(),
    propertyAddress: viewM?.[3]?.trim(),
  }
}

function parseBuildoutVoucherBody(body: string): {
  voucherName?: string
  payerName?: string
} {
  const text = compactText(body)
  const payerM = text.match(/Payer\s+(.+?)\s+Voucher\s+/i)
  const voucherM =
    text.match(/Voucher\s+(.+?)\s+VIEW VOUCHER/i) ??
    text.match(/Voucher\s+(.+?)\s+View Voucher/i)
  let voucherName = voucherM?.[1]?.trim()
  if (voucherName?.includes("Voucher ")) {
    voucherName = voucherName.split("Voucher ").at(-1)?.trim()
  }
  return {
    voucherName,
    payerName: payerM?.[1]?.trim(),
  }
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

// Shared by Crexi + LoopNet + Buildout extractors
export function parseInquirerBody(body: string): InquirerInfo | null {
  if (!body) return null
  const info: InquirerInfo = {}
  const nameM = body.match(/^\s*name\s*[:\-]\s*(.+?)\s*$/im)
  if (nameM) info.name = nameM[1].trim()
  const emailM = body.match(/^\s*email\s*[:\-]\s*([^\s<>]+@[^\s<>]+)\s*$/im)
  if (emailM) info.email = emailM[1].trim().toLowerCase()
  const phoneM = body.match(/^\s*phone\s*[:\-]\s*([+\d\s().\-]+?)\s*$/im)
  if (phoneM) info.phone = phoneM[1].trim()
  const companyM = body.match(/^\s*company\s*[:\-]\s*(.+?)\s*$/im)
  if (companyM) info.company = companyM[1].trim()
  const messageM = body.match(/^\s*message\s*[:\-]\s*([\s\S]+?)(?:\n\s*\n|$)/im)
  if (messageM) info.message = messageM[1].trim()

  const loopNetLeadM = body.match(
    /new\s+lead\s+from:\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|\s*([^\s|<>]+@[^\s|<>]+)/i
  )
  if (loopNetLeadM) {
    info.name ??= loopNetLeadM[1].trim()
    info.phone ??= cleanPhone(loopNetLeadM[2])
    info.email ??= cleanEmail(loopNetLeadM[3])
  }

  const bracketEmailM = body.match(/\[\s*email\s*\]\s*([^\s<>]+@[^\s<>]+)/i)
  if (bracketEmailM) info.email ??= cleanEmail(bracketEmailM[1])
  const bracketPhoneM = body.match(/\[\s*phone\s*\]\s*([+\d][+\d\s().\-]+)/i)
  if (bracketPhoneM) info.phone ??= cleanPhone(bracketPhoneM[1])

  const crexiSignatureM = body.match(
    /thank\s+you!\s+([^\n\r]+?)\s+([+\d][+\d\s().\-]{6,})(?:<[^>]+>)?\s+([^\s<>]+@[^\s<>]+)/i
  )
  if (crexiSignatureM) {
    info.name ??= crexiSignatureM[1].trim()
    info.phone ??= cleanPhone(crexiSignatureM[2])
    info.email ??= cleanEmail(crexiSignatureM[3])
  }

  return Object.keys(info).length > 0 ? info : null
}

function cleanEmail(value: string | undefined): string | undefined {
  const match = value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const email = match?.[0].toLowerCase()
  if (!email || isPlatformSystemEmail(email)) return undefined
  return email
}

function cleanPhone(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || undefined
}

function isPlatformSystemEmail(email: string): boolean {
  const [local = "", domain = ""] = email.split("@")
  if (
    [
      "support",
      "help",
      "info",
      "noreply",
      "no-reply",
      "notifications",
      "emails",
    ].includes(local)
  ) {
    return true
  }
  return ["crexi.com", "loopnet.com", "buildout.com"].includes(domain)
}
