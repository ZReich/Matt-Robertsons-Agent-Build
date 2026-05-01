import { db } from "@/lib/prisma"

/**
 * Count of active deals where the most recent communication is inbound —
 * i.e. someone reached out and we haven't replied yet. Mirrors the leads
 * "needs attention" pattern. Closed and archived deals are excluded.
 */
export async function getNewDealsCount(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM deals d
    WHERE d.archived_at IS NULL
      AND d.stage <> 'closed'
      AND (
        SELECT m.direction
        FROM communications m
        WHERE m.deal_id = d.id
          AND m.archived_at IS NULL
        ORDER BY m.date DESC
        LIMIT 1
      ) = 'inbound'
  `
  return rows[0]?.n ?? 0
}
