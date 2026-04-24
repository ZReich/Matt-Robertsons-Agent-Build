import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Prisma mock shared across this test file ----
vi.mock("@/lib/prisma", () => {
  return {
    db: {
      externalSync: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      },
      contact: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (arg) => {
        if (typeof arg === "function") return await arg((await import("@/lib/prisma")).db);
        return await Promise.all(arg);
      }),
      $queryRaw: vi.fn(),
    },
  };
});

// ---- Mock graphFetch / loadMsgraphConfig ----
vi.mock("./client", () => ({
  graphFetch: vi.fn(),
}));
vi.mock("./config", () => ({
  loadMsgraphConfig: vi.fn(() => ({
    tenantId: "t",
    clientId: "c",
    clientSecret: "s",
    targetUpn: "matt@example.com",
    testAdminToken: "x".repeat(32),
    testRouteEnabled: false,
  })),
}));

import { db } from "@/lib/prisma";
import {
  deleteCursor,
  loadCursor,
  mapGraphToContact,
  saveCursor,
} from "./contacts";
import { graphFetch } from "./client";

function clearDbMocks() {
  for (const svc of [db.externalSync, db.contact] as const) {
    for (const fn of Object.values(svc)) {
      if (typeof fn === "function" && "mockReset" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
  }
  (db.$transaction as ReturnType<typeof vi.fn>).mockReset();
  (db.$queryRaw as ReturnType<typeof vi.fn>).mockReset();
  // Restore $transaction default behavior.
  (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return await (arg as (tx: typeof db) => Promise<unknown>)(db);
    }
    return await Promise.all(arg as Promise<unknown>[]);
  });
}

describe("mapGraphToContact", () => {
  it("returns partial with only fields present in the payload", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      mobilePhone: "(208) 555-1111",
    });

    expect(Object.keys(partial).sort()).toEqual(["phone"]);
    expect(partial.phone).toBe("(208) 555-1111");
  });

  it("uses displayName first when present", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      displayName: "Bob Smith",
      givenName: "Robert",
      surname: "Smith",
    });
    expect(partial.name).toBe("Bob Smith");
    expect(createOnly.name).toBe("Bob Smith");
  });

  it("falls back to givenName + surname when displayName missing", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      givenName: "Alice",
      surname: "Jones",
    });
    expect(partial.name).toBe("Alice Jones");
    expect(createOnly.name).toBe("Alice Jones");
  });

  it("falls back to emailAddresses[0].name when no name fields", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      emailAddresses: [{ name: "Carol Friendly", address: "carol@example.com" }],
    });
    expect(partial.name).toBe("Carol Friendly");
    expect(createOnly.name).toBe("Carol Friendly");
  });

  it("falls back to email address string when no name anywhere", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "X",
      emailAddresses: [{ name: "", address: "dave@example.com" }],
    });
    expect(partial.name).toBe("dave@example.com");
    expect(createOnly.name).toBe("dave@example.com");
  });

  it("falls back to fileAs when no person/email fields are present", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "AAkALg-opaque-id",
      fileAs: "Acme Corp (filed as)",
      companyName: "Acme Corp",
    });
    expect(partial.name).toBe("Acme Corp (filed as)");
    expect(createOnly.name).toBe("Acme Corp (filed as)");
  });

  it("falls back to companyName when fileAs is absent and no person/email", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "AAkALg-opaque-id",
      companyName: "Beckers Glass",
    });
    expect(partial.name).toBe("Beckers Glass");
    expect(createOnly.name).toBe("Beckers Glass");
  });

  it("prefers displayName over fileAs and companyName when all are present", () => {
    const { partial, createOnly } = mapGraphToContact({
      id: "AAkALg-opaque-id",
      displayName: "Preferred Display",
      fileAs: "Some Filing Name",
      companyName: "Some Company",
    });
    expect(partial.name).toBe("Preferred Display");
    expect(createOnly.name).toBe("Preferred Display");
  });

  it("uses the Graph ID as a last-resort name when nothing else is available", () => {
    const { createOnly } = mapGraphToContact({ id: "X-GRAPH-ID-123" });
    expect(createOnly.name).toBe("X-GRAPH-ID-123");
    // partial.name should NOT be set — Graph provided nothing to derive it from
  });

  it("partial.name is absent when Graph provided no name-related fields", () => {
    const { partial } = mapGraphToContact({ id: "X" });
    expect("name" in partial).toBe(false);
  });

  it("picks mobilePhone over businessPhones over homePhones", () => {
    expect(
      mapGraphToContact({
        id: "X",
        mobilePhone: "111",
        businessPhones: ["222"],
        homePhones: ["333"],
      }).partial.phone,
    ).toBe("111");
    expect(
      mapGraphToContact({
        id: "X",
        businessPhones: ["222"],
        homePhones: ["333"],
      }).partial.phone,
    ).toBe("222");
    expect(
      mapGraphToContact({
        id: "X",
        homePhones: ["333"],
      }).partial.phone,
    ).toBe("333");
  });

  it("maps first email address and company", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      emailAddresses: [{ address: "bob@acme.com" }, { address: "bob.personal@gmail.com" }],
      companyName: "Acme Inc.",
    });
    expect(partial.email).toBe("bob@acme.com");
    expect(partial.company).toBe("Acme Inc.");
  });

  it("emailAddresses empty array sets partial.email to null (key present, no value)", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      emailAddresses: [],
    });
    expect(partial.email).toBeNull();
    expect("email" in partial).toBe(true);
  });

  it("formats businessAddress, skipping empty parts", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      businessAddress: {
        street: "123 Main St",
        city: "Coeur d'Alene",
        state: "ID",
        postalCode: "83814",
        countryOrRegion: "",
      },
    });
    expect(partial.address).toBe("123 Main St, Coeur d'Alene, ID 83814");
  });

  it("passes categories through verbatim as tags", () => {
    const { partial } = mapGraphToContact({
      id: "X",
      categories: ["Red Category", "Client"],
    });
    expect(partial.tags).toEqual(["Red Category", "Client"]);
  });

  it("createOnly always sets category=business, createdBy=msgraph-contacts, notes from personalNotes", () => {
    const { createOnly } = mapGraphToContact({
      id: "X",
      displayName: "Eve",
      personalNotes: "Met at CRE conference 2024",
    });
    expect(createOnly.category).toBe("business");
    expect(createOnly.createdBy).toBe("msgraph-contacts");
    expect(createOnly.notes).toBe("Met at CRE conference 2024");
  });

  it("createOnly.notes is null when personalNotes absent or empty", () => {
    expect(mapGraphToContact({ id: "X" }).createOnly.notes).toBeNull();
    expect(
      mapGraphToContact({ id: "X", personalNotes: "" }).createOnly.notes,
    ).toBeNull();
  });
});

describe("cursor helpers", () => {
  beforeEach(() => clearDbMocks());

  it("loadCursor returns null when no row exists", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await loadCursor();

    expect(result).toBeNull();
    expect(db.externalSync.findUnique).toHaveBeenCalledWith({
      where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
    });
  });

  it("loadCursor returns deltaLink when row has valid rawData", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      rawData: { deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=abc" },
    });

    const result = await loadCursor();

    expect(result).toEqual({
      deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=abc",
    });
  });

  it("loadCursor returns null when rawData is malformed (missing deltaLink)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      rawData: { notADeltaLink: "oops" },
    });

    const result = await loadCursor();

    expect(result).toBeNull();
  });

  it("loadCursor returns null when rawData is not an object", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      rawData: "corrupted-string",
    });

    const result = await loadCursor();
    expect(result).toBeNull();
  });

  it("loadCursor returns null when rawData has an empty deltaLink string", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      rawData: { deltaLink: "" },
    });

    const result = await loadCursor();
    expect(result).toBeNull();
  });

  it("saveCursor upserts the cursor row", async () => {
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await saveCursor("https://graph.microsoft.com/v1.0/.../delta?$deltatoken=xyz");

    expect(db.externalSync.upsert).toHaveBeenCalledWith({
      where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
      create: {
        source: "msgraph-contacts",
        externalId: "__cursor__",
        entityType: "cursor",
        entityId: null,
        rawData: { deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=xyz" },
        status: "synced",
      },
      update: {
        rawData: { deltaLink: "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=xyz" },
        syncedAt: expect.any(Date),
        status: "synced",
      },
    });
  });

  it("deleteCursor removes the cursor row (no-op if missing)", async () => {
    (db.externalSync.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await deleteCursor();

    expect(db.externalSync.delete).toHaveBeenCalledWith({
      where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
    });
  });

  it("deleteCursor swallows P2025 (record not found) from Prisma", async () => {
    const err = Object.assign(new Error("not found"), { code: "P2025" });
    (db.externalSync.delete as ReturnType<typeof vi.fn>).mockRejectedValue(err);

    await expect(deleteCursor()).resolves.toBeUndefined();
  });
});

describe("upsertContact", () => {
  beforeEach(() => clearDbMocks());

  const sampleGraphContact = {
    id: "graph-bob-1",
    displayName: "Bob Smith",
    emailAddresses: [{ address: "bob@acme.com" }],
    mobilePhone: "(208) 555-1111",
    companyName: "Acme Inc.",
    personalNotes: "Met at CRE conference",
  };

  it("creates a new Contact and ExternalSync in a transaction when no existing row", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "new-uuid",
    });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact(sampleGraphContact);

    expect(result).toBe("created");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Bob Smith",
        email: "bob@acme.com",
        phone: "(208) 555-1111",
        company: "Acme Inc.",
        notes: "Met at CRE conference",
        category: "business",
        createdBy: "msgraph-contacts",
      }),
    });
    expect(db.externalSync.create).toHaveBeenCalledWith({
      data: {
        source: "msgraph-contacts",
        externalId: "graph-bob-1",
        entityType: "contact",
        entityId: "new-uuid",
        status: "synced",
        rawData: { graphContact: sampleGraphContact },
      },
    });
  });

  it("updates existing Contact when ExternalSync already maps the Graph id; only sets fields present in payload", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: null,
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const partialPayload = {
      id: "graph-bob-1",
      mobilePhone: "(208) 555-2222",
    };

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact(partialPayload);

    expect(result).toBe("updated");

    // Only `phone` should change; email/company/name/etc must NOT appear in the update.
    const updateCall = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toEqual({
      where: { id: "existing-contact-uuid" },
      data: { phone: "(208) 555-2222" },
    });
  });

  it("unarchives a Graph-archived contact on a later update (status='removed' → 'synced', archivedAt cleared)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "removed",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: new Date("2026-04-20"),
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact({ id: "graph-bob-1", displayName: "Bob (Returned)" });

    expect(result).toBe("unarchived");
    const updateCall = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.data.archivedAt).toBeNull();
    expect(updateCall.data.name).toBe("Bob (Returned)");

    const extSyncUpdate = (db.externalSync.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncUpdate.data.status).toBe("synced");
  });

  it("preserves manual-archive when status='synced' but archivedAt was set by another path", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "synced", // NOT "removed"
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: new Date("2026-04-20"), // set by some manual-archive flow
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { upsertContact } = await import("./contacts");
    const result = await upsertContact({ id: "graph-bob-1", mobilePhone: "999" });

    expect(result).toBe("updated");
    const updateCall = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Phone should update, archivedAt should NOT be in the data object.
    expect(updateCall.data.phone).toBe("999");
    expect("archivedAt" in updateCall.data).toBe(false);
  });

  it("fails loud when ExternalSync points to a Contact that no longer exists", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "orphan-contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { upsertContact } = await import("./contacts");
    await expect(upsertContact({ id: "graph-bob-1" })).rejects.toThrow(
      /missing Contact row/i,
    );
  });

  it("persists full Graph payload verbatim to ExternalSync.rawData.graphContact on create", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "new-uuid",
    });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const richPayload = {
      ...sampleGraphContact,
      jobTitle: "Senior Broker",
      department: "Sales",
      businessHomePage: "example.com",
      homeAddress: { street: "home" },
    };

    const { upsertContact } = await import("./contacts");
    await upsertContact(richPayload);

    const extSyncCreate = (db.externalSync.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncCreate.data.rawData).toEqual({ graphContact: richPayload });
  });

  it("persists full Graph payload on update as well", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "existing-contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-contact-uuid",
      archivedAt: null,
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const payload = { id: "graph-bob-1", mobilePhone: "999" };
    const { upsertContact } = await import("./contacts");
    await upsertContact(payload);

    const extSyncUpdate = (db.externalSync.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncUpdate.data.rawData).toEqual({ graphContact: payload });
  });
});

describe("archiveContact", () => {
  beforeEach(() => clearDbMocks());

  it("returns false when Graph id is not tracked (never seen before)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { archiveContact } = await import("./contacts");
    const result = await archiveContact("unknown-graph-id");

    expect(result).toBe(false);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns false when ExternalSync.status is already 'removed' (replayed tombstone)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "contact-uuid",
      status: "removed",
    });

    const { archiveContact } = await import("./contacts");
    const result = await archiveContact("graph-bob-1");

    expect(result).toBe(false);
    expect(db.contact.update).not.toHaveBeenCalled();
    expect(db.externalSync.update).not.toHaveBeenCalled();
  });

  it("archives live contact transactionally — sets archivedAt and status='removed'", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "contact-uuid",
      archivedAt: null,
    });
    (db.contact.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { archiveContact } = await import("./contacts");
    const result = await archiveContact("graph-bob-1");

    expect(result).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    const contactUpdate = (db.contact.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(contactUpdate.where).toEqual({ id: "contact-uuid" });
    expect(contactUpdate.data.archivedAt).toBeInstanceOf(Date);

    const extSyncUpdate = (db.externalSync.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(extSyncUpdate.where).toEqual({ id: "ext-sync-uuid" });
    expect(extSyncUpdate.data.status).toBe("removed");
  });

  it("throws when ExternalSync has no entityId (schema invariant violation)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: null,
      status: "synced",
    });

    const { archiveContact } = await import("./contacts");
    await expect(archiveContact("graph-bob-1")).rejects.toThrow(
      /no entityId/i,
    );
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("throws when ExternalSync points to a Contact that no longer exists", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ext-sync-uuid",
      entityId: "orphan-contact-uuid",
      status: "synced",
    });
    (db.contact.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { archiveContact } = await import("./contacts");
    await expect(archiveContact("graph-bob-1")).rejects.toThrow(
      /missing Contact row/i,
    );
    expect(db.contact.update).not.toHaveBeenCalled();
  });
});

describe("processOneItemWithRetry", () => {
  beforeEach(() => {
    clearDbMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches @removed entries to archiveContact", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { processOneItemWithRetry } = await import("./contacts");
    const result = await processOneItemWithRetry({
      id: "graph-x",
      "@removed": { reason: "deleted" },
    });

    expect(result.kind).toBe("archiveNoop"); // archiveContact returned false
  });

  it("dispatches live entries to upsertContact", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-uuid" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { processOneItemWithRetry } = await import("./contacts");
    const result = await processOneItemWithRetry({
      id: "graph-bob",
      displayName: "Bob",
    });

    expect(result.kind).toBe("created");
  });

  it("retries on transient failure and succeeds on second attempt", async () => {
    let callCount = 0;
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("transient db error");
      return null;
    });
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-uuid" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { processOneItemWithRetry } = await import("./contacts");
    const promise = processOneItemWithRetry({ id: "graph-bob", displayName: "Bob" });

    await vi.advanceTimersByTimeAsync(100); // past 50ms backoff
    const result = await promise;

    expect(result.kind).toBe("created");
    expect(callCount).toBe(2);
  });

  it("returns 'failed' with attempts=3 and records error when all 3 attempts fail", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("persistent db error"),
    );
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { processOneItemWithRetry } = await import("./contacts");
    const promise = processOneItemWithRetry({ id: "graph-bob", displayName: "Bob" });

    await vi.advanceTimersByTimeAsync(50 + 200 + 800 + 100); // all three backoffs + buffer
    const result = await promise;

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.error.graphId).toBe("graph-bob");
      expect(result.error.attempts).toBe(3);
      expect(result.error.message).toMatch(/persistent db error/);
    }

    // Should have attempted to mark ExternalSync.status = "failed"
    expect(db.externalSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source_externalId: { source: "msgraph-contacts", externalId: "graph-bob" },
        },
        update: expect.objectContaining({ status: "failed" }),
      }),
    );

    // Also verify errorMsg column populated (not just rawData.lastError)
    const upsertCall = (db.externalSync.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.update.errorMsg).toMatch(/persistent db error/);
    expect(upsertCall.create.errorMsg).toMatch(/persistent db error/);
  });
});

describe("syncMicrosoftContacts (orchestrator)", () => {
  beforeEach(() => {
    clearDbMocks();
    vi.useFakeTimers();
    // Default: advisory lock is acquired.
    (db.$queryRaw as ReturnType<typeof vi.fn>).mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes("pg_try_advisory_lock")) return [{ got: true }];
      if (sql.includes("pg_advisory_unlock")) return [{ released: true }];
      return [];
    });
    // Reset graphFetch mock
    (graphFetch as ReturnType<typeof vi.fn>).mockReset();
    process.env.MSGRAPH_TENANT_ID = "t";
    process.env.MSGRAPH_CLIENT_ID = "c";
    process.env.MSGRAPH_CLIENT_SECRET = "s";
    process.env.MSGRAPH_TARGET_UPN = "matt@example.com";
    process.env.MSGRAPH_TEST_ADMIN_TOKEN = "x".repeat(32);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function deltaResponse(body: unknown) {
    return body;
  }

  it("returns skippedLocked when advisory lock not acquired", async () => {
    (db.$queryRaw as ReturnType<typeof vi.fn>).mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes("pg_try_advisory_lock")) return [{ got: false }];
      return [];
    });

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.skippedLocked).toBe(true);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
  });

  it("bootstrap: no cursor → fetches delta from scratch → writes cursor on success", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { source_externalId: { externalId: string } } }) => {
      if (where.source_externalId.externalId === "__cursor__") return null;
      return null;
    });
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      deltaResponse({
        value: [{ id: "g-1", displayName: "Alice" }],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=NEW",
      }),
    );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.isBootstrap).toBe(true);
    expect(result.bootstrapReason).toBe("no-cursor");
    expect(result.created).toBe(1);
    expect(result.cursorAdvanced).toBe(true);
    // saveCursor via upsert
    expect(db.externalSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: "msgraph-contacts", externalId: "__cursor__" } },
      }),
    );
  });

  it("delta-empty: cursor present, value=[], cursor still advances to new deltaLink", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { source_externalId: { externalId: string } } }) => {
      if (where.source_externalId.externalId === "__cursor__") {
        return {
          rawData: {
            deltaLink: "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=OLD",
          },
        };
      }
      return null;
    });
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      deltaResponse({
        value: [],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=NEW",
      }),
    );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.isBootstrap).toBe(false);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.cursorAdvanced).toBe(true);
  });

  it("pagination: follows @odata.nextLink; cursor only written after final @odata.deltaLink", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new" });
    (db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    (graphFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        deltaResponse({
          value: [{ id: "g-1", displayName: "Alice" }],
          "@odata.nextLink":
            "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$skiptoken=PAGE2",
        }),
      )
      .mockResolvedValueOnce(
        deltaResponse({
          value: [{ id: "g-2", displayName: "Bob" }],
          "@odata.deltaLink":
            "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=FINAL",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.created).toBe(2);
    expect(result.cursorAdvanced).toBe(true);
    // Cursor upsert should have been called exactly ONCE (at the end), not after page 1.
    const cursorUpserts = (db.externalSync.upsert as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0].where.source_externalId.externalId === "__cursor__",
    );
    expect(cursorUpserts.length).toBe(1);
  });

  it("410 syncStateNotFound: deletes cursor, restarts as bootstrap, reports bootstrapReason=delta-expired", async () => {
    const { GraphError } = await import("./errors");
    // First call: findUnique returns the stored cursor.
    // After 410 + deleteCursor, recursive call returns null (cursor gone).
    let findUniqueCount = 0;
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { source_externalId: { externalId: string } } }) => {
      if (where.source_externalId.externalId === "__cursor__") {
        findUniqueCount++;
        if (findUniqueCount === 1) {
          return {
            rawData: {
              deltaLink: "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=OLD",
            },
          };
        }
        return null;
      }
      return null;
    });
    (db.externalSync.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    (graphFetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(
        new GraphError(410, "syncStateNotFound", "/contacts/delta", "expired"),
      )
      // After recursion, second run starts fresh
      .mockResolvedValueOnce(
        deltaResponse({
          value: [],
          "@odata.deltaLink":
            "https://graph.microsoft.com/v1.0/users/matt@example.com/contacts/delta?$deltatoken=FRESH",
        }),
      );

    const { syncMicrosoftContacts } = await import("./contacts");
    const result = await syncMicrosoftContacts();

    expect(result.isBootstrap).toBe(true);
    expect(result.bootstrapReason).toBe("delta-expired");
    expect(db.externalSync.delete).toHaveBeenCalled();
  });

  it("persistent per-item failure: cursorAdvanced=false, errors[] populated", async () => {
    // First findUnique for cursor → null (bootstrap).
    // Then per-item findUnique (for upsertContact) always throws.
    let cursorChecked = false;
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { source_externalId: { externalId: string } } }) => {
      if (where.source_externalId.externalId === "__cursor__") {
        cursorChecked = true;
        return null;
      }
      throw new Error("persistent db error");
    });
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      deltaResponse({
        value: [{ id: "g-bad", displayName: "Bad" }],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=END",
      }),
    );

    const { syncMicrosoftContacts } = await import("./contacts");
    const promise = syncMicrosoftContacts();
    await vi.advanceTimersByTimeAsync(50 + 200 + 800 + 100);
    const result = await promise;

    expect(cursorChecked).toBe(true);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].graphId).toBe("g-bad");
    expect(result.cursorAdvanced).toBe(false);
    // Cursor upsert for "__cursor__" key should NOT have been called
    const cursorUpserts = (db.externalSync.upsert as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0].where.source_externalId.externalId === "__cursor__",
    );
    expect(cursorUpserts.length).toBe(0);
  });

  it("sends Prefer: IdType=ImmutableId header on the delta request", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.externalSync.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      deltaResponse({
        value: [],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/.../delta?$deltatoken=END",
      }),
    );

    const { syncMicrosoftContacts } = await import("./contacts");
    await syncMicrosoftContacts();

    const deltaCall = (graphFetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/contacts/delta"),
    );
    expect(deltaCall).toBeDefined();
    const headers = (deltaCall![1] as { headers?: Record<string, string> }).headers;
    expect(headers?.Prefer).toBe('IdType="ImmutableId"');
  });

  it("releases advisory lock even on error (finally block)", async () => {
    (db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { syncMicrosoftContacts } = await import("./contacts");
    await expect(syncMicrosoftContacts()).rejects.toThrow();

    const unlockCalls = (db.$queryRaw as ReturnType<typeof vi.fn>).mock.calls.filter((c: unknown[]) => {
      const sql = (c[0] as TemplateStringsArray).join("");
      return sql.includes("pg_advisory_unlock");
    });
    expect(unlockCalls.length).toBeGreaterThan(0);
  });
});
