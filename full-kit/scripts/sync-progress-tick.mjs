// One-line DB-count tick used by the per-minute sync monitor.
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const r = await db.$queryRaw`
  SELECT
    (SELECT COUNT(*)::int FROM communications) AS comms,
    (SELECT COUNT(*)::int FROM communications WHERE direction='inbound') AS inb,
    (SELECT COUNT(*)::int FROM communications WHERE direction='outbound') AS outb,
    (SELECT COUNT(*)::int FROM contacts) AS contacts,
    (SELECT COUNT(*)::int FROM deals) AS deals,
    (SELECT COUNT(*)::int FROM agent_actions) AS actions
`
const row = r[0]
console.log(
  `comms=${row.comms} (in=${row.inb} out=${row.outb}) contacts=${row.contacts} deals=${row.deals} actions=${row.actions}`
)
await db.$disconnect()
