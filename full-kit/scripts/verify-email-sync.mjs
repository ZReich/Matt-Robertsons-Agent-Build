import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const db = new PrismaClient();

async function main() {
  const out = {};

  out.totalEmailComms = await db.$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM communications
    WHERE created_by = 'msgraph-email'
  `;

  out.classificationCounts = await db.$queryRaw`
    SELECT metadata->>'classification' AS cls, COUNT(*)::int AS n
    FROM communications
    WHERE created_by = 'msgraph-email'
    GROUP BY 1
    ORDER BY 1
  `;

  out.failedCount = await db.$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM external_sync
    WHERE source = 'msgraph-email' AND status = 'failed'
  `;

  out.leadsCreated = await db.$queryRaw`
    SELECT lead_source, COUNT(*)::int AS n
    FROM contacts
    WHERE created_by LIKE 'msgraph-email-%-extract'
    GROUP BY 1
    ORDER BY 1
  `;

  out.sourceBreakdown = await db.$queryRaw`
    SELECT metadata->>'source' AS source, COUNT(*)::int AS n
    FROM communications
    WHERE created_by = 'msgraph-email'
    GROUP BY 1
    ORDER BY n DESC
  `;

  out.directionBreakdown = await db.$queryRaw`
    SELECT direction, COUNT(*)::int AS n
    FROM communications
    WHERE created_by = 'msgraph-email'
    GROUP BY 1
    ORDER BY 1
  `;

  out.sampleCrexiExtracted = await db.$queryRaw`
    SELECT metadata->'extracted' AS extracted
    FROM communications
    WHERE metadata->>'source' = 'crexi-lead'
    LIMIT 3
  `;

  out.unansweredCrexiLeads = await db.$queryRaw`
    WITH leads AS (
      SELECT c.id, c.metadata->>'conversationId' AS conv, c.date
      FROM communications c
      WHERE c.metadata->>'source' = 'crexi-lead'
    )
    SELECT COUNT(*)::int AS n
    FROM leads l
    WHERE NOT EXISTS (
      SELECT 1 FROM communications r
      WHERE r.direction = 'outbound'
        AND r.metadata->>'conversationId' = l.conv
    )
  `;

  out.folderBreakdown = await db.$queryRaw`
    SELECT
      (raw_data->>'folder') AS folder,
      status,
      COUNT(*)::int AS n
    FROM external_sync
    WHERE source = 'msgraph-email'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
