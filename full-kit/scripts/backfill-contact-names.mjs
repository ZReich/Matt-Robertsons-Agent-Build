// One-off backfill: fix Contact rows whose `name` is the Graph ID (an ugly
// base64 opaque string) because the first import of msgraph contacts used an
// older name-derivation cascade that fell through to `gc.id` when a contact
// had no displayName/givenName/surname/email fields — common for company-only
// entries in Matt's Outlook.
//
// The original Graph payload is stored verbatim on
// ExternalSync.rawData.graphContact, so we can replay the (now-extended)
// cascade against the stored payload and update Contact.name in place.
//
// Safe to run multiple times. Only updates rows where the current name still
// equals the externalId (the bad state); rows already fixed are skipped.
//
// Run with:
//   cd full-kit
//   set -a && source .env.local && set +a   # (from a bash-like shell)
//   node scripts/backfill-contact-names.mjs
// Or pass the env vars via shell inline.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Must match the cascade in src/lib/msgraph/contacts.ts::deriveName().
// Intentionally duplicated (not imported) so this script has no build/ts deps.
function deriveName(gc) {
  if (gc.displayName) return gc.displayName;
  if (gc.givenName || gc.surname) {
    return [gc.givenName, gc.surname].filter(Boolean).join(" ");
  }
  const firstEmail = gc.emailAddresses?.[0];
  if (firstEmail?.name) return firstEmail.name;
  if (firstEmail?.address) return firstEmail.address;
  if (gc.fileAs) return gc.fileAs;
  if (gc.companyName) return gc.companyName;
  return undefined;
}

try {
  const syncRows = await db.externalSync.findMany({
    where: {
      source: "msgraph-contacts",
      entityType: "contact",
      entityId: { not: null },
    },
    select: { entityId: true, externalId: true, rawData: true },
  });

  const contactIds = syncRows.map((r) => r.entityId);
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(contacts.map((c) => [c.id, c.name]));

  let alreadyGood = 0;
  let fixed = 0;
  let stillBad = 0;
  let missingPayload = 0;

  for (const row of syncRows) {
    const currentName = nameById.get(row.entityId);
    if (currentName === undefined) continue;

    // Skip rows whose name is already something other than the Graph id.
    if (currentName !== row.externalId) {
      alreadyGood++;
      continue;
    }

    // Current name IS the Graph id — bad state. Re-derive.
    const graphContact = row.rawData?.graphContact;
    if (!graphContact) {
      missingPayload++;
      continue;
    }

    const newName = deriveName(graphContact);

    if (!newName) {
      // No derivable name — leave as the Graph id.
      stillBad++;
      continue;
    }

    await db.contact.update({
      where: { id: row.entityId },
      data: { name: newName },
    });
    fixed++;
  }

  console.log(`Total msgraph-contact sync rows: ${syncRows.length}`);
  console.log(`Already had good names:          ${alreadyGood}`);
  console.log(`Fixed (name re-derived):         ${fixed}`);
  console.log(`Still Graph-id (no derivable):   ${stillBad}`);
  console.log(`Missing graphContact payload:    ${missingPayload}`);
} finally {
  await db.$disconnect();
}
