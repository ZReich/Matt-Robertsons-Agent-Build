import { db } from "@/lib/prisma"

export async function getUnreadLeadsCount(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM contacts c
    WHERE c.lead_source IS NOT NULL
      AND c.lead_status NOT IN ('converted', 'dropped')
      AND (
        c.lead_status = 'new'
        OR EXISTS (
          SELECT 1 FROM communications m
          WHERE m.contact_id = c.id
            AND m.direction = 'inbound'
            AND m.date > COALESCE(c.lead_last_viewed_at, c.lead_at)
        )
      )
  `

  return rows[0]?.n ?? 0
}
