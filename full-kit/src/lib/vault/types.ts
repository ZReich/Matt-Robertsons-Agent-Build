import type {
  AttachmentFetchStatus,
  AttachmentSummaryItem,
} from "@/lib/communications/attachment-types"

/** Vault category used for Life/Work toggle filtering */
export type VaultCategory = "business" | "personal"

/** Deal pipeline stages matching the Kanban board columns */
export type DealStage =
  | "prospecting"
  | "listing"
  | "marketing"
  | "showings"
  | "offer"
  | "under-contract"
  | "due-diligence"
  | "closing"
  | "closed"

/** Display labels for each deal stage */
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  prospecting: "Prospecting",
  listing: "Listing",
  marketing: "Marketing",
  showings: "Showings",
  offer: "Offer",
  "under-contract": "Under Contract",
  "due-diligence": "Due Diligence",
  closing: "Closing",
  closed: "Closed",
}

/** Commercial property types */
export type PropertyType =
  | "office"
  | "retail"
  | "industrial"
  | "multifamily"
  | "land"
  | "mixed-use"
  | "hospitality"
  | "medical"
  | "other"

/** Preferred contact method */
export type ContactMethod = "email" | "phone" | "text" | "whatsapp"

/** Communication channel types */
export type CommunicationType =
  | "email"
  | "call"
  | "text"
  | "whatsapp"
  | "meeting"

/** Base frontmatter shared by all vault notes */
export interface VaultNoteMeta {
  type: string
  category: VaultCategory
  tags?: string[]
  created?: string
  updated?: string
}

/** Document category types for deal file tracking */
export type DealDocumentType =
  | "contract"
  | "inspection"
  | "financial"
  | "title"
  | "marketing"
  | "correspondence"
  | "other"

/** A document or file record attached to a deal */
export interface DealDocument {
  name: string
  type: DealDocumentType
  date_added?: string
  /** URL to cloud storage (Google Drive, Dropbox, S3, etc.) — empty string = pending */
  url?: string
  notes?: string
}

/** Deal note frontmatter (vault/clients/{name}/{Deal}.md) */
export interface DealMeta extends VaultNoteMeta {
  type: "deal"
  category: "business"
  client: string
  property_address: string
  property_type: PropertyType
  square_feet?: number
  stage: DealStage
  value?: number
  listed_date?: string
  closing_date?: string
  key_contacts?: Record<string, string>
  documents?: DealDocument[]
}

/** Client note frontmatter (vault/clients/{name}/{Name}.md) */
export interface ClientMeta extends VaultNoteMeta {
  type: "client"
  category: "business"
  name: string
  company?: string
  email?: string
  phone?: string
  role?: string
  preferred_contact?: ContactMethod
  notes?: string
}

/** Personal contact note frontmatter (vault/contacts/{Name}.md) */
export interface ContactMeta extends VaultNoteMeta {
  type: "contact"
  category: "personal"
  name: string
  role?: string
  company?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
}

/** Communication log frontmatter (vault/communications/*.md) */
export interface CommunicationMeta extends VaultNoteMeta {
  type: "communication"
  channel: CommunicationType
  contact: string
  subject?: string
  date: string
  direction?: "inbound" | "outbound"
  deal?: string
  attachments?: AttachmentSummaryItem[]
  attachmentFetchStatus?: AttachmentFetchStatus
}

/** Meeting/calendar event frontmatter (vault/meetings/*.md) */
export interface MeetingMeta extends VaultNoteMeta {
  type: "meeting"
  title: string
  contact?: string
  date: string
  duration_minutes?: number
  location?: string
  deal?: string
  attachments?: AttachmentSummaryItem[]
  attachmentFetchStatus?: AttachmentFetchStatus
}

/** Todo item frontmatter (vault/todos/business/ and vault/todos/personal/) */
export interface TodoMeta extends VaultNoteMeta {
  type: "todo"
  title: string
  /** Omitted status defaults to "pending". Keep legacy "in-progress" readable. */
  status?:
    | "proposed"
    | "pending"
    | "in_progress"
    | "in-progress"
    | "done"
    | "dismissed"
  priority?: "low" | "medium" | "high" | "urgent"
  due_date?: string
  deal?: string
  contact?: string
  source?: "manual" | "ai_email_scrub" | "buildout_event"
  proposedByRunId?: string
  /** Vault path of the communication that generated this todo */
  source_communication?: string
  /** When the AI generated this todo, the model's one-line "why" — surfaced
   * in the UI so the user understands what triggered it. */
  ai_rationale?: string
  /** When this Todo was auto-promoted from a pending AgentAction, the action
   * type drives which inline approve/reject buttons are rendered on the
   * Todo card (e.g. "auto-reply" → Send draft / Edit / Reject). Mirrors
   * the persisted `todos.metadata.actionType` JSON field. */
  agent_action_type?: string
  /** ID of the AgentAction this Todo was promoted from. The inline buttons
   * POST to /api/agent/actions/{id}/{approve,reject,snooze}. */
  agent_action_id?: string
  /** Heuristic confidence (0–1) from the entity matcher when the Todo was
   * auto-promoted from an AgentAction. Surfaced in the UI as a "Weak match"
   * chip when below 0.7 so the operator knows to verify before acting. */
  match_score?: number
  /** Signals that contributed to the match (e.g. "name_token_overlap",
   * "email_exact", "name_ambiguous"). Rendered in the weak-match tooltip. */
  match_signals?: string[]
}

/** Email template frontmatter (vault/templates/*.md) */
export interface TemplateMeta extends VaultNoteMeta {
  type: "template"
  name: string
  subject?: string
  use_case?: string
}

/** A parsed vault note with frontmatter and content */
export interface VaultNote<T extends VaultNoteMeta = VaultNoteMeta> {
  /** Relative path from vault root (e.g., "clients/john-smith/John Smith.md") */
  path: string
  /** Parsed YAML frontmatter */
  meta: T
  /** Markdown body content (after frontmatter) */
  content: string
}

/** Agent action approval tiers */
export type AgentActionTier = "auto" | "log-only" | "approve" | "blocked"

/** Agent action status */
export type AgentActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "expired"

/** Agent action types */
export type AgentActionType =
  | "create-todo"
  | "update-todo"
  | "create-deal"
  | "update-deal"
  | "move-deal-stage"
  | "create-communication"
  | "create-meeting"
  | "update-meeting"
  | "send-email"
  | "send-text"
  | "create-client"
  | "update-client"
  | "create-contact"
  | "update-contact"
  | "archive-deal"
  | "general"

/** Agent action frontmatter (vault/agent-actions/{status}/*.md) */
export interface AgentActionMeta extends VaultNoteMeta {
  type: "agent-action"
  category: "business"
  action_type: AgentActionType
  tier: AgentActionTier
  status: AgentActionStatus
  target_entity?: string
  summary: string
  created_at: string
  executed_at?: string
  feedback?: string
}

/** Agent memory note frontmatter (vault/agent-memory/*.md) */
export interface AgentMemoryMeta extends VaultNoteMeta {
  type: "agent-memory"
  category: "business"
  memory_type:
    | "rule"
    | "preference"
    | "playbook"
    | "client-note"
    | "style-guide"
  title: string
  priority?: "critical" | "high" | "medium" | "low"
  last_updated?: string
}

/** Union of all vault note types for type-safe filtering */
export type AnyVaultMeta =
  | DealMeta
  | ClientMeta
  | ContactMeta
  | CommunicationMeta
  | MeetingMeta
  | TodoMeta
  | TemplateMeta
  | AgentActionMeta
  | AgentMemoryMeta
