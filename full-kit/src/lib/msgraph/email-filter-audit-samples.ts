import { db } from "@/lib/prisma"

export interface EmailFilterAuditSampleInput {
  id: string
  runId: string
  communicationId: string | null
  externalMessageId: string
  ruleId: string
  classification: string
  bodyDecision: string
  disposition: string
  riskFlags: unknown
  rescueFlags: unknown
  evidenceSnapshot: unknown
  createdAt: Date
}

export interface EmailFilterAuditSample {
  auditId: string
  runId: string
  communicationId: string | null
  externalMessageId: string
  ruleId: string
  classification: string
  bodyDecision: string
  disposition: string
  riskFlags: string[]
  rescueFlags: string[]
  subject: string | null
  date: string | null
  direction: string | null
  senderAddress: string | null
  senderDomain: string | null
  storedClassification: string | null
  currentClassification: string | null
  systemRecommendation: "KEEP" | "NOISE" | "REVIEW"
  reviewPriority: number
  suggestedCategory: "business" | "personal"
  whyThisMatters: string
  likelyTodo: string
  createdAt: string
}

export interface EmailFilterAuditSampleBucket {
  key: string
  label: string
  totalCandidates: number
  samples: EmailFilterAuditSample[]
}

export interface EmailFilterAuditSampleReport {
  runIds: string[]
  scannedAuditRows: number
  generatedAt: string
  buckets: EmailFilterAuditSampleBucket[]
}

export interface ListEmailFilterAuditSamplesOptions {
  runIds?: string[]
  latestRunCount?: number
  perBucketLimit?: number
  reviewPackLimit?: number
}

const CSV_COLUMNS = [
  "matt_decision",
  "matt_notes",
  "system_recommendation",
  "review_priority",
  "why_this_matters",
  "likely_todo",
  "suggested_category",
  "bucket",
  "bucket_description",
  "what_to_check",
  "subject",
  "sender",
  "sender_domain",
  "email_date",
  "direction",
  "current_classification",
  "old_classification",
  "rule",
  "risk_flags",
  "rescue_flags",
  "communication_id",
  "audit_id",
] as const

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function auditSnapshotDate(gateResults: unknown): string | null {
  return stringValue(record(record(gateResults).auditScope).snapshotDate)
}

function senderDomain(address: string | null): string | null {
  if (!address?.includes("@")) return null
  return address.split("@").pop()?.toLowerCase() ?? null
}

const PROPERTY_INQUIRY_TERMS =
  /(requesting information|loopnet lead|new lead has been added|new leads? found|favorited|inquiry|interested|availability|available space|available suite|price|pricing|tour|showing|property info|more information|information on)/i
const REVENUE_TERMS =
  /(referral|buyer|tenant|landlord|broker|client|listing agreement|lease|loi|purchase agreement|contract|under contract|closing|commission|voucher|invoice|deal stage|critical date|assigned a task|docusign|dotloop|buildout|crexi|loopnet|tour|sourcing|transacting)/i
const OBVIOUS_NOISE_TERMS =
  /(newsletter|webinar|unsubscribe|sale ends|discount|daily digest|market report|auction alert|property blast|recommended properties|mls member mail|sior connect listing|featured listings?|\blistings?\b|most viewed listings|listings for lease|nationwide|available individually|absolute nnn|abs nnn|corporate nnn|net lease|nnn lease|low rent|new price|price reduced|improved pricing|cap rate|corporate guarantee|bp guarantee|realtor tour|refreshments|drawing|search ranking|updates have been made|email blast|try this on your next listing|fair housing|continuing education|roadshow|bar brief|office closure|mls tool spotlight|listhub|supra one|student presentation|first-to-market|excellent exposure|commercial corridor|kindercare|family dollar|dollar general|bank of america|arco\/ampm|publix|investment grade credit|master-planned community|bonus depreciation|operating history|dense in-?fill|large operator|average hh incomes|double drive-thru|gas station|car wash|outparcels available|development site|redevelopment opportunity|available on well-traveled|happy hour|just listed|top producers? events?|official invite|payment reminder)/i
const THREAD_CONTEXT_TERMS = /^\s*((re|fw|fwd):|accepted:)/i
const PROPERTY_ADDRESS_TERMS =
  /(?:^|\b(?:for|at|re:|fw:|fwd:)\s+)\d{3,6}\s+(?!sf\b|sq\b)[a-z0-9.'-]+(?:\s+[a-z0-9.'-]+){0,5}\b/i
const DEAL_DISCUSSION_TERMS =
  /\b(discussion|psa|nda|loi|sublease|post-closing|closing|final coordination)\b/i
const PERSONAL_REVIEW_TERMS =
  /(grace montessori|billings christian|mccoy|\bschool\b|\bkids?\b|\bson\b|\bdaughter\b|hgc board packet and financials|highlands? golf|hilands? golf|hilandsgolfclub\.com)/i
const OWNED_PROPERTY_REVIEW_TERMS =
  /(bin\s*119|high water usage|billings logistics center|billings us\s*bank|us\s*bank|added a property to accel|file number-\d+-address-)/i
const IMPORTANT_REVIEW_TERMS =
  /(hgc board packet and financials|highlands? golf|hilands? golf|hilandsgolfclub\.com)/i
const FEEDBACK_NO_ACTION_TERMS =
  /(top producer details|top producers? events?|official invite|laurel,\s*mt bov'?s \+ nai billings introduction|declined:.*billings marketing bi-weekly|undeliverable:|mailer-daemon|sior palm springs|reflections from the sior global spring conference|heja community has grown|billings is full of surprises|notice of breach of confidentiality|sior spring event|ambassador program)/i

function hasAnyFlag(flags: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => flags.includes(candidate))
}

function scoreCreUsefulness(input: {
  classification: string
  rescueFlags: string[]
  riskFlags: string[]
  ruleId: string
  subject: string | null
  direction: string | null
  senderDomain: string | null
  storedClassification: string | null
  currentClassification: string | null
}): Pick<
  EmailFilterAuditSample,
  | "likelyTodo"
  | "reviewPriority"
  | "suggestedCategory"
  | "systemRecommendation"
  | "whyThisMatters"
> {
  const reasons: string[] = []
  const subject = input.subject ?? ""
  const textForPattern = `${subject} ${input.senderDomain ?? ""}`
  const feedbackNoAction = FEEDBACK_NO_ACTION_TERMS.test(textForPattern)
  const obviousNoise = feedbackNoAction || OBVIOUS_NOISE_TERMS.test(subject)
  const isOutbound = input.direction === "outbound"
  const hasThreadContextSubject = THREAD_CONTEXT_TERMS.test(subject)
  const isPersonalReview = PERSONAL_REVIEW_TERMS.test(textForPattern)
  const isOwnedPropertyReview = OWNED_PROPERTY_REVIEW_TERMS.test(subject)
  const isImportantReview = IMPORTANT_REVIEW_TERMS.test(textForPattern)
  const isDirectToMatt = input.rescueFlags.includes("direct_to_matt")
  let score = 0

  if (feedbackNoAction) {
    reasons.push("Matt feedback says this pattern does not need action")
  }
  if (isOutbound) {
    score += 100
    reasons.push("Matt sent this email, so it belongs in thread context")
  }
  if (isPersonalReview) {
    score += 70
    reasons.push("direct personal/family/school context for Matt")
  }
  if (isOwnedPropertyReview) {
    score += 70
    reasons.push("owned property or property-admin context")
  }
  if (isImportantReview) {
    score += 70
    reasons.push("Matt feedback says this may be important")
  }
  if (hasThreadContextSubject) {
    score += 45
    reasons.push("subject is a reply/forward/meeting thread")
  }
  if (PROPERTY_INQUIRY_TERMS.test(subject)) {
    score += 45
    reasons.push("subject looks like a property inquiry or lead")
  }
  if (PROPERTY_ADDRESS_TERMS.test(subject) && !obviousNoise) {
    score += 45
    reasons.push("subject looks like a specific property/deal address")
  }
  if (DEAL_DISCUSSION_TERMS.test(subject) && !obviousNoise) {
    score += 45
    reasons.push("subject looks like an active deal discussion")
  }
  if (REVENUE_TERMS.test(subject)) {
    score += 25
    reasons.push("subject has broker/deal/revenue language")
  }
  if (input.rescueFlags.includes("platform_lead_subject")) {
    score += 50
    reasons.push("platform lead pattern")
  }
  if (input.rescueFlags.includes("deal_or_document_terms")) {
    score += 30
    reasons.push("deal/document terms")
  }
  if (input.rescueFlags.includes("known_contact")) {
    score += 25
    reasons.push("known contact")
  }
  if (
    input.rescueFlags.includes("matt_replied_before") ||
    input.rescueFlags.includes("existing_thread")
  ) {
    score += 35
    reasons.push("Matt has already engaged on this thread")
  }
  if (input.rescueFlags.includes("large_cre_broker")) {
    score += 20
    reasons.push("large CRE broker domain")
  }
  if (input.rescueFlags.includes("nai_internal")) {
    score += 15
    reasons.push("NAI/internal broker context")
  }
  if (isDirectToMatt) {
    score += 10
    reasons.push("sent directly to Matt")
  }
  if (input.storedClassification === "noise" && input.currentClassification) {
    score += 20
    reasons.push("new rules rescued this from old noise handling")
  }

  if (
    hasAnyFlag(input.riskFlags, [
      "list_unsubscribe",
      "noise_domain",
      "noise_sender",
      "automated_local_part",
    ])
  ) {
    score -= 20
  }
  if (obviousNoise) {
    score -= input.rescueFlags.includes("platform_lead_subject") ? 25 : 80
    reasons.push("subject looks like marketing/list noise")
  }

  const likelyTodo = isOutbound
    ? "Keep as sent-message context for the related contact/client/deal thread."
    : obviousNoise && !input.rescueFlags.includes("platform_lead_subject")
      ? ""
      : isPersonalReview
        ? "Create a personal review item for Matt; classify under personal."
        : isOwnedPropertyReview
          ? "Create a property/business review item for Matt; check whether follow-up is needed."
          : isImportantReview
            ? "Create a review item for Matt; HGC board/financial packet may need attention."
            : hasThreadContextSubject
              ? "Keep for thread context; check whether follow-up or deal notes are needed."
              : PROPERTY_INQUIRY_TERMS.test(subject)
                ? "Create or verify a lead/todo if this person is asking about a property or wants info."
                : PROPERTY_ADDRESS_TERMS.test(subject) && !obviousNoise
                  ? "Keep for property/deal context; check whether follow-up or notes are needed."
                  : DEAL_DISCUSSION_TERMS.test(subject) && !obviousNoise
                    ? "Keep for active deal context; check whether follow-up or notes are needed."
                    : input.rescueFlags.includes("matt_replied_before") ||
                        input.rescueFlags.includes("existing_thread")
                      ? "Check whether Matt already replied and whether follow-up is still needed."
                      : REVENUE_TERMS.test(subject)
                        ? "Check for a deal/client/contact note or follow-up task."
                        : isDirectToMatt
                          ? "Create a review item for Matt; this was sent directly to him."
                          : ""

  const hasEngagementOrLeadRescue = hasAnyFlag(input.rescueFlags, [
    "platform_lead_subject",
    "matt_replied_before",
    "existing_thread",
  ])
  const hasNoiseRisk = hasAnyFlag(input.riskFlags, [
    "list_unsubscribe",
    "noise_domain",
    "noise_sender",
    "automated_local_part",
  ])
  const hasStrongRescue =
    hasEngagementOrLeadRescue ||
    (input.rescueFlags.includes("known_contact") &&
      !hasNoiseRisk &&
      !obviousNoise)
  const strongBusinessSignal =
    hasStrongRescue ||
    hasThreadContextSubject ||
    (PROPERTY_ADDRESS_TERMS.test(subject) && !obviousNoise) ||
    (DEAL_DISCUSSION_TERMS.test(subject) && !obviousNoise) ||
    isImportantReview ||
    (input.rescueFlags.includes("large_cre_broker") &&
      input.rescueFlags.includes("direct_to_matt") &&
      !obviousNoise)
  const directReviewSignal = isDirectToMatt && !obviousNoise
  const hasOnlyWeakRescue =
    input.rescueFlags.length > 0 &&
    input.rescueFlags.every((flag) =>
      ["direct_to_matt", "small_recipient_list"].includes(flag)
    )
  const systemRecommendation =
    isOutbound || hasEngagementOrLeadRescue
      ? "KEEP"
      : isPersonalReview || isOwnedPropertyReview || isImportantReview
        ? "KEEP"
        : hasThreadContextSubject && !obviousNoise
          ? "KEEP"
          : strongBusinessSignal && !obviousNoise
            ? "KEEP"
            : directReviewSignal
              ? "KEEP"
              : (input.classification === "noise" ||
                    input.storedClassification === "noise") &&
                  hasOnlyWeakRescue &&
                  !strongBusinessSignal
                ? "NOISE"
                : (obviousNoise ||
                      (input.classification === "noise" && hasNoiseRisk)) &&
                    !hasStrongRescue
                  ? "NOISE"
                  : score >= 35 && !hasNoiseRisk && !obviousNoise
                    ? "KEEP"
                    : score >= 45
                      ? "KEEP"
                      : score <= -25 && input.rescueFlags.length === 0
                        ? "NOISE"
                        : "REVIEW"

  return {
    likelyTodo,
    reviewPriority: Math.max(0, Math.min(100, score)),
    suggestedCategory: isPersonalReview ? "personal" : "business",
    systemRecommendation,
    whyThisMatters:
      reasons.length > 0
        ? reasons.join("; ")
        : "No strong CRE business signal found from metadata",
  }
}

function toSample(audit: EmailFilterAuditSampleInput): EmailFilterAuditSample {
  const evidence = record(audit.evidenceSnapshot)
  const from = record(evidence.from)
  const senderAddress = stringValue(from.address)
  const subject = stringValue(evidence.subject)
  const domain = senderDomain(senderAddress)
  const riskFlags = stringArray(audit.riskFlags)
  const rescueFlags = stringArray(audit.rescueFlags)
  const storedClassification = stringValue(evidence.storedClassification)
  const currentClassification = stringValue(evidence.currentClassification)
  const direction = stringValue(evidence.direction)
  const usefulness = scoreCreUsefulness({
    classification: audit.classification,
    rescueFlags,
    riskFlags,
    ruleId: audit.ruleId,
    subject,
    direction,
    senderDomain: domain,
    storedClassification,
    currentClassification,
  })
  return {
    auditId: audit.id,
    runId: audit.runId,
    communicationId: audit.communicationId,
    externalMessageId: audit.externalMessageId,
    ruleId: audit.ruleId,
    classification: audit.classification,
    bodyDecision: audit.bodyDecision,
    disposition: audit.disposition,
    riskFlags,
    rescueFlags,
    subject,
    date: stringValue(evidence.date),
    direction,
    senderAddress,
    senderDomain: domain,
    storedClassification,
    currentClassification,
    ...usefulness,
    createdAt: audit.createdAt.toISOString(),
  }
}

function includesFlag(flags: string[], flag: string): boolean {
  return flags.includes(flag)
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value)
    ? value.join("; ")
    : value === null || value === undefined
      ? ""
      : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function bucketInstruction(bucketKey: string): string {
  switch (bucketKey) {
    case "rescued_noise":
      return "Would Matt care if future emails like this were kept and summarized? If yes, mark KEEP."
    case "historical_noise_now_uncertain":
      return "These used to be treated as noise. Confirm whether this sender/subject could be real broker/client/deal activity."
    case "mixed_cre_broker_domain":
      return "Check if this is a real broker/deal email or just a marketing blast."
    case "known_contact_noise":
      return "This involves someone already in contacts. Mark KEEP unless it is clearly junk/marketing."
    case "platform_lead_subject":
      return "Check whether this looks like a real lead/inquiry/task from a platform."
    case "unsubscribe_noise":
      return "Check whether unsubscribe/list emails are safe to ignore or if any contain deal/client info."
    case "domain_drop_noise":
      return "Check whether this domain is always noise or sometimes important."
    case "sender_drop_noise":
      return "Check whether this sender address is always automated junk or sometimes important."
    case "local_part_drop_noise":
      return "Check whether automated-looking senders like noreply/marketing are safe to ignore."
    default:
      return "Mark KEEP if Matt would want this in the second brain; MARK NOISE if safe to ignore."
  }
}

function isMattReviewable(sample: EmailFilterAuditSample): boolean {
  if (sample.direction === "outbound") return false
  if (sample.senderAddress?.startsWith("mrobertson@")) return false
  if (sample.senderDomain === "naibusinessproperties.com") return false
  return true
}

function isSystemExampleEligible(sample: EmailFilterAuditSample): boolean {
  return isMattReviewable(sample) || sample.direction === "outbound"
}

function normalizedReviewSubject(subject: string | null): string {
  return (subject ?? "")
    .toLowerCase()
    .replace(/^(\s*(re|fw|fwd):\s*)+/i, "")
    .replace(/\[ext\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function uniqueByReviewPattern(
  samples: EmailFilterAuditSample[]
): EmailFilterAuditSample[] {
  const seen = new Set<string>()
  const unique: EmailFilterAuditSample[] = []
  for (const sample of samples) {
    const key = `${sample.systemRecommendation}|${sample.senderAddress ?? ""}|${normalizedReviewSubject(sample.subject)}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(sample)
  }
  return unique
}

function takeEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items
  if (limit <= 1) return items.slice(0, 1)
  const lastIndex = items.length - 1
  return Array.from({ length: limit }, (_, index) => {
    const itemIndex = Math.round((index * lastIndex) / (limit - 1))
    return items[itemIndex]!
  })
}

function bucket(
  samples: EmailFilterAuditSample[],
  key: string,
  label: string,
  predicate: (sample: EmailFilterAuditSample) => boolean,
  limit: number
): EmailFilterAuditSampleBucket {
  const candidates = samples
    .filter(predicate)
    .sort((a, b) => b.reviewPriority - a.reviewPriority)
  return {
    key,
    label,
    totalCandidates: candidates.length,
    samples: takeEvenly(candidates, limit),
  }
}

function tinyDecisionPack(
  samples: EmailFilterAuditSample[],
  limit: number
): EmailFilterAuditSampleBucket[] {
  const mattReviewable = samples.filter(isMattReviewable)
  const systemExampleEligible = samples.filter(isSystemExampleEligible)
  const needsHuman = mattReviewable
    .filter((sample) => sample.systemRecommendation === "REVIEW")
    .sort((a, b) => b.reviewPriority - a.reviewPriority)
  const likelyKeep = systemExampleEligible
    .filter((sample) => sample.systemRecommendation === "KEEP")
    .sort((a, b) => b.reviewPriority - a.reviewPriority)
  const likelyNoise = systemExampleEligible
    .filter((sample) => sample.systemRecommendation === "NOISE")
    .sort((a, b) => a.reviewPriority - b.reviewPriority)

  return [
    {
      key: "matt_review_pack",
      label: "Only the highest-risk ambiguous items Matt should review",
      totalCandidates: needsHuman.length,
      samples: uniqueByReviewPattern(needsHuman).slice(0, limit),
    },
    {
      key: "system_keep_examples",
      label: "System thinks these should be kept; quick spot-check only",
      totalCandidates: likelyKeep.length,
      samples: uniqueByReviewPattern(likelyKeep).slice(0, Math.min(5, limit)),
    },
    {
      key: "system_noise_examples",
      label: "System thinks these are safe noise; quick spot-check only",
      totalCandidates: likelyNoise.length,
      samples: uniqueByReviewPattern(likelyNoise).slice(0, Math.min(5, limit)),
    },
  ]
}

export function buildEmailFilterAuditSampleReport(
  audits: EmailFilterAuditSampleInput[],
  options: {
    generatedAt?: Date
    perBucketLimit?: number
    reviewPackLimit?: number
    runIds?: string[]
  } = {}
): EmailFilterAuditSampleReport {
  const limit = Math.max(1, Math.min(options.perBucketLimit ?? 25, 100))
  const reviewPackLimit = Math.max(
    1,
    Math.min(options.reviewPackLimit ?? 15, 25)
  )
  const samples = audits.map(toSample)
  const detailedBuckets = [
    bucket(
      samples,
      "rescued_noise",
      "Noise-classified rows with rescue flags",
      (sample) =>
        sample.classification === "noise" && sample.rescueFlags.length > 0,
      limit
    ),
    bucket(
      samples,
      "historical_noise_now_uncertain",
      "Rows hardened from historical noise to current uncertain",
      (sample) =>
        sample.storedClassification === "noise" &&
        sample.currentClassification === "uncertain",
      limit
    ),
    bucket(
      samples,
      "mixed_cre_broker_domain",
      "Rows from mixed CRE/broker domains",
      (sample) => includesFlag(sample.riskFlags, "mixed_cre_broker_domain"),
      limit
    ),
    bucket(
      samples,
      "known_contact_noise",
      "Noise-classified rows involving known contacts",
      (sample) =>
        sample.classification === "noise" &&
        includesFlag(sample.rescueFlags, "known_contact"),
      limit
    ),
    bucket(
      samples,
      "platform_lead_subject",
      "Rows with platform lead subject rescue",
      (sample) => includesFlag(sample.rescueFlags, "platform_lead_subject"),
      limit
    ),
    bucket(
      samples,
      "unsubscribe_noise",
      "Rows hit by unsubscribe-header noise rule",
      (sample) => sample.ruleId === "layer-b-unsubscribe-header",
      limit
    ),
    bucket(
      samples,
      "domain_drop_noise",
      "Rows hit by domain-drop noise rule",
      (sample) => sample.ruleId === "layer-b-domain-drop",
      limit
    ),
    bucket(
      samples,
      "sender_drop_noise",
      "Rows hit by sender-drop noise rule",
      (sample) => sample.ruleId === "layer-b-sender-drop",
      limit
    ),
    bucket(
      samples,
      "local_part_drop_noise",
      "Rows hit by automated local-part noise rule",
      (sample) => sample.ruleId === "layer-b-local-part-drop",
      limit
    ),
  ]

  return {
    runIds:
      options.runIds ??
      Array.from(new Set(audits.map((audit) => audit.runId))).sort(),
    scannedAuditRows: audits.length,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    buckets: [
      ...tinyDecisionPack(samples, reviewPackLimit),
      ...detailedBuckets,
    ],
  }
}

export function buildEmailFilterAuditSampleCsv(
  report: EmailFilterAuditSampleReport
): string {
  const rows = [CSV_COLUMNS.map(csvCell).join(",")]
  for (const bucket of report.buckets) {
    if (!bucket.key.startsWith("matt_") && !bucket.key.startsWith("system_")) {
      continue
    }
    for (const sample of bucket.samples) {
      rows.push(
        [
          "",
          "",
          sample.systemRecommendation,
          sample.reviewPriority,
          sample.whyThisMatters,
          sample.likelyTodo,
          sample.suggestedCategory,
          bucket.key,
          bucket.label,
          bucketInstruction(bucket.key),
          sample.subject,
          sample.senderAddress,
          sample.senderDomain,
          sample.date,
          sample.direction,
          sample.currentClassification ?? sample.classification,
          sample.storedClassification,
          sample.ruleId,
          sample.riskFlags,
          sample.rescueFlags,
          sample.communicationId,
          sample.auditId,
        ]
          .map(csvCell)
          .join(",")
      )
    }
  }
  return `${rows.join("\r\n")}\r\n`
}

export async function listEmailFilterAuditSamples(
  options: ListEmailFilterAuditSamplesOptions = {}
): Promise<EmailFilterAuditSampleReport> {
  const perBucketLimit = Math.max(
    1,
    Math.min(options.perBucketLimit ?? 25, 100)
  )
  const reviewPackLimit = Math.max(
    1,
    Math.min(options.reviewPackLimit ?? 15, 25)
  )
  let runIds = options.runIds
  if (!runIds || runIds.length === 0) {
    const latestRuns = await db.emailFilterRun.findMany({
      where: {
        mailboxId: "stored-communications",
        mode: "dry_run",
        status: "completed",
      },
      orderBy: { startedAt: "desc" },
      take: Math.max(1, Math.min(options.latestRunCount ?? 100, 100)),
      select: { runId: true, gateResults: true },
    })
    const latestSnapshotDate = auditSnapshotDate(latestRuns[0]?.gateResults)
    const matchingSnapshotRuns = latestSnapshotDate
      ? latestRuns.filter(
          (run) => auditSnapshotDate(run.gateResults) === latestSnapshotDate
        )
      : []
    runIds = (
      matchingSnapshotRuns.length > 0 ? matchingSnapshotRuns : latestRuns
    ).map((run) => run.runId)
  }

  const audits = await db.emailFilterAudit.findMany({
    where: { runId: { in: runIds } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      runId: true,
      communicationId: true,
      externalMessageId: true,
      ruleId: true,
      classification: true,
      bodyDecision: true,
      disposition: true,
      riskFlags: true,
      rescueFlags: true,
      evidenceSnapshot: true,
      createdAt: true,
    },
  })

  return buildEmailFilterAuditSampleReport(audits, {
    perBucketLimit,
    reviewPackLimit,
    runIds,
  })
}
