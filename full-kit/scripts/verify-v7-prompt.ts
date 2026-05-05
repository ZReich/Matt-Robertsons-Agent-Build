/**
 * Verification script for the v7 extractor prompt.
 *
 * Loads a fixed list of Communications likely to contain personal-context
 * signals, runs scrubWithOpenAI directly (the same provider used in
 * production by default), and prints the profileFacts arrays the model
 * returns under the new v7 prompt. No DB writes — read-only verification.
 *
 * Usage:
 *   cd full-kit
 *   set -a && source .env.local && set +a
 *   pnpm tsx scripts/verify-v7-prompt.ts
 */

import { buildPromptInputs } from "@/lib/ai/scrub"
import { scrubWithOpenAI } from "@/lib/ai/openai"
import { db } from "@/lib/prisma"

const COMM_IDS = [
  // TOM CAT thread (subject is actually a person named Tom — adversarial check)
  "bb30aceb-b822-4ce3-a3db-e49d6d0f3e50", // "Re: TOM CAT" / "Ha! Stop it!"
  "b46903a3-044f-4214-9fda-cba1c996753e", // "TOM CAT" / "Hi Tom, ..." (the original)
  // Casual closing thanks (Liz Marchi)
  "f1504286-d2b1-4b50-872c-51c054f07103", // "Re: Insurance" / "Thank you! Really appreciate..."
  "8a7ce665-4eec-4534-8193-e4aafa6a4f78", // "Re: Closing" / "Agreed!"
  "37f23ddd-ce14-4546-a581-3ce15a65cfc9", // "RE: Aviation Place Closing"
  // YIPEE KAYAH — extremely casual subject reply
  "37578609-4e1d-4b94-9ff9-aeec45e80f53", // "Re: Billings Airport properties" / "YIPEE KAYAH"
]

async function main() {
  const results: Array<{
    id: string
    subject: string | null
    bodyPreview: string
    profileFacts: unknown
    summary: string
    error?: string
  }> = []

  for (const id of COMM_IDS) {
    try {
      const comm = await db.communication.findUnique({
        where: { id },
        select: { id: true, subject: true, body: true },
      })
      if (!comm) {
        results.push({
          id,
          subject: null,
          bodyPreview: "(comm not found)",
          profileFacts: null,
          summary: "",
          error: "comm not found",
        })
        continue
      }
      const bodyPreview = (comm.body || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200)

      const inputs = await buildPromptInputs(id)
      const response = await scrubWithOpenAI({
        perEmailPrompt: inputs.perEmailPrompt,
        globalMemory: inputs.globalMemory,
      })
      const tool = response.toolInput as {
        summary?: string
        profileFacts?: unknown
      }
      results.push({
        id,
        subject: comm.subject,
        bodyPreview,
        summary: tool.summary || "",
        profileFacts: tool.profileFacts ?? null,
      })
    } catch (err) {
      results.push({
        id,
        subject: null,
        bodyPreview: "",
        profileFacts: null,
        summary: "",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  for (const r of results) {
    console.log("=".repeat(80))
    console.log("ID:", r.id)
    console.log("Subject:", r.subject)
    console.log("Body preview:", r.bodyPreview)
    if (r.error) {
      console.log("ERROR:", r.error)
      continue
    }
    console.log("Summary:", r.summary)
    console.log("profileFacts:", JSON.stringify(r.profileFacts, null, 2))
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
