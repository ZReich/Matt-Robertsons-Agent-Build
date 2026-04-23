export { GraphError } from "./errors";
export {
  graphFetch,
  getMailboxInfo,
  listRecentMessages,
} from "./client";
export type { GraphMailboxInfo, GraphMessage } from "./client";
export { loadMsgraphConfig } from "./config";
export type { MsgraphConfig } from "./config";
export { constantTimeCompare } from "./constant-time-compare";
export { syncMicrosoftContacts } from "./contacts";
export type { SyncResult } from "./contacts";
export { runSenderRecon } from "./recon";
export type {
  ReconOptions,
  ReconReport,
  ReconFolder,
  SenderSummary,
  DomainSummary,
  PlatformSubjectPattern,
  NoteworthyAutomatedSender,
} from "./recon";
export { syncEmails } from "./emails";
export type {
  SyncEmailOptions,
  SyncEmailResult,
  FolderSyncSummary,
} from "./emails";
export { normalizeSenderAddress } from "./sender-normalize";
export type { NormalizedSender } from "./sender-normalize";
