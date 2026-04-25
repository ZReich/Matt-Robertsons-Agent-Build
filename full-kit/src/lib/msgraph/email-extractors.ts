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

  let m = subject.match(CREXI_COUNT_LEADS)
  if (m) {
    return {
      kind: "new-leads-count",
      leadCount: Number.parseInt(m[1], 10),
      propertyName: m[2].trim(),
    }
  }

  m = subject.match(CREXI_INQUIRY_SUBJECT)
  if (m) {
    const inquirer = parseInquirerBody(input.bodyText)
    return {
      kind: "inquiry",
      inquirerName: m[1].trim(),
      propertyName: m[2].trim(),
      cityOrMarket: m[3].trim(),
      ...(inquirer ? { inquirer } : {}),
    }
  }

  if (CREXI_GENERIC_NEW_LEADS.test(subject)) {
    const inquirer = parseInquirerBody(input.bodyText)
    return {
      kind: "inquiry",
      ...(inquirer ? { inquirer } : {}),
    }
  }

  m = subject.match(CREXI_TEAM_NOTE)
  if (m) {
    return {
      kind: "team-note",
      noteAuthor: m[1].trim(),
      propertyName: m[2].trim(),
    }
  }

  return null
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
    return {
      kind: "favorited",
      viewerName: m[1].trim(),
      propertyName: m[2].trim(),
    }
  }

  return null
}

export interface BuildoutEventExtract {
  kind:
    | "new-lead"
    | "deal-stage-update"
    | "task-assigned"
    | "critical-date"
    | "ca-executed"
    | "document-view"
  propertyName?: string
  inquirer?: InquirerInfo
  newStage?: string
  previousStage?: string
}

const BUILDOUT_NEW_LEAD = /^a new lead has been added\s*-\s*(.+)$/i
const BUILDOUT_STAGE = /^deal stage updated on\s+(.+)$/i
const BUILDOUT_TASK = /^you've been assigned a task/i
const BUILDOUT_CRITICAL = /critical date.*upcoming/i
const BUILDOUT_CA_EXECUTED = /^ca executed on\s+(.+)$/i
const BUILDOUT_DOCUMENT_VIEW = /^documents viewed on\s+(.+)$/i

export function extractBuildoutEvent(
  input: ExtractorInput
): BuildoutEventExtract | null {
  const subject = (input.subject ?? "").trim()
  if (!subject) return null

  let m = subject.match(BUILDOUT_NEW_LEAD)
  if (m) {
    const inquirer = parseInquirerBody(input.bodyText)
    return {
      kind: "new-lead",
      propertyName: m[1].trim(),
      ...(inquirer ? { inquirer } : {}),
    }
  }

  m = subject.match(BUILDOUT_STAGE)
  if (m) {
    return { kind: "deal-stage-update", propertyName: m[1].trim() }
  }

  if (BUILDOUT_TASK.test(subject)) {
    return { kind: "task-assigned" }
  }

  if (BUILDOUT_CRITICAL.test(subject)) {
    return { kind: "critical-date" }
  }

  m = subject.match(BUILDOUT_CA_EXECUTED)
  if (m) {
    return { kind: "ca-executed", propertyName: m[1].trim() }
  }

  m = subject.match(BUILDOUT_DOCUMENT_VIEW)
  if (m) {
    return { kind: "document-view", propertyName: m[1].trim() }
  }

  return null
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

  return Object.keys(info).length > 0 ? info : null
}
