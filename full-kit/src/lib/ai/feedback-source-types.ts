export const AI_FEEDBACK_SOURCE_TYPES = {
  agentAction: "agent_action",
  scrubOutput: "scrub_output",
  manualReview: "manual_review",
} as const

export type AiFeedbackSourceType =
  (typeof AI_FEEDBACK_SOURCE_TYPES)[keyof typeof AI_FEEDBACK_SOURCE_TYPES]
