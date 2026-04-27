export { GraphError } from "./errors"
export { graphFetch, getMailboxInfo, listRecentMessages } from "./client"
export type { GraphMailboxInfo, GraphMessage } from "./client"
export { loadMsgraphConfig } from "./config"
export type { MsgraphConfig } from "./config"
export { constantTimeCompare } from "./constant-time-compare"
export { syncMicrosoftContacts } from "./contacts"
export type { SyncResult } from "./contacts"
export { runSenderRecon } from "./recon"
export type {
  ReconOptions,
  ReconReport,
  ReconFolder,
  SenderSummary,
  DomainSummary,
  PlatformSubjectPattern,
  NoteworthyAutomatedSender,
} from "./recon"
export {
  EMAIL_METADATA_SELECT_FIELDS,
  fetchEmailBodyById,
  fetchEmailDelta,
  fetchEmailMetadataDelta,
  syncEmails,
} from "./emails"
export type {
  SyncEmailOptions,
  SyncEmailResult,
  FolderSyncSummary,
} from "./emails"
export { normalizeSenderAddress } from "./sender-normalize"
export type { NormalizedSender } from "./sender-normalize"

export {
  EMAIL_FILTER_RULE_SET_VERSION,
  SEEDED_EMAIL_FILTER_RULES,
  assertUniqueEmailFilterRules,
  createRuleVersionSnapshot,
  findSeededEmailFilterRule,
} from "./email-filter-rules"
export type { EmailFilterRuleDefinition } from "./email-filter-rules"
export {
  collectEmailRescueFlags,
  collectEmailRiskFlags,
  evaluateBodyFetchFailure,
  evaluateEmailAcquisition,
  evaluateStopGates,
} from "./email-filter-evaluator"
export type {
  EvaluateEmailAcquisitionOptions,
  StopGateInput,
} from "./email-filter-evaluator"
export {
  EMAIL_REDACTION_VERSION,
  assertRawBodyRetentionPolicy,
  hashBody,
  pruneGraphSnapshot,
  redactEmailBody,
} from "./email-filter-redaction"
export type { RedactedBodyArtifact } from "./email-filter-redaction"
export {
  buildEmailFilterRunReport,
  createEmailFilterChunk,
  createEmailFilterRun,
  createEmailFilterRunId,
  recordEmailFilterAudit,
} from "./email-filter-audit"
export type { EmailFilterRunSummary } from "./email-filter-audit"
export { runStoredEmailFilterAudit } from "./email-filter-audit-runner"
export type {
  RunStoredEmailFilterAuditOptions,
  RunStoredEmailFilterAuditResult,
} from "./email-filter-audit-runner"
export {
  buildEmailFilterAuditSampleCsv,
  buildEmailFilterAuditSampleReport,
  listEmailFilterAuditSamples,
} from "./email-filter-audit-samples"
export type {
  EmailFilterAuditSample,
  EmailFilterAuditSampleBucket,
  EmailFilterAuditSampleReport,
  ListEmailFilterAuditSamplesOptions,
} from "./email-filter-audit-samples"
