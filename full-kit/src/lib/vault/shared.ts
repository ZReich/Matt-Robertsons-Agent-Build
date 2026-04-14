/**
 * Client-safe vault exports — types and utilities only.
 * No Node.js fs/path imports. Safe for "use client" components.
 *
 * Import from "@/lib/vault/shared" in client components instead of "@/lib/vault".
 */

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

export { normalizeEntityRef, toSlug } from "./utils"
