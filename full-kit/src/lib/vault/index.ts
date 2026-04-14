export { parseVaultNote, serializeVaultNote } from "./parser"
export {
  readNote,
  listNotes,
  listNotesByCategory,
  listNotesByType,
  updateNote,
  createNote,
  deleteNote,
  archiveNote,
  searchNotes,
} from "./reader"
export type {
  VaultCategory,
  DealStage,
  DealDocumentType,
  DealDocument,
  PropertyType,
  ContactMethod,
  CommunicationType,
  VaultNoteMeta,
  DealMeta,
  ClientMeta,
  ContactMeta,
  CommunicationMeta,
  MeetingMeta,
  TodoMeta,
  TemplateMeta,
  VaultNote,
  AnyVaultMeta,
  AgentActionTier,
  AgentActionStatus,
  AgentActionType,
  AgentActionMeta,
  AgentMemoryMeta,
} from "./types"
export { DEAL_STAGE_LABELS } from "./types"
export {
  normalizeEntityRef,
  toSlug,
  sanitizeFilename,
  validateVaultPath,
} from "./utils"
