import { describe, expect, it } from "vitest"

import type {
  ClientMeta,
  CommunicationMeta,
  ContactMeta,
  DealMeta,
  TodoMeta,
  VaultNote,
} from "./types"

import {
  resolveAllTodoContexts,
  resolvePrismaTodoContexts,
} from "./resolve-context"

describe("resolvePrismaTodoContexts", () => {
  it("maps a Prisma todo with contact, deal, and source communication", () => {
    const contexts = resolvePrismaTodoContexts([
      {
        id: "todo-1",
        contact: {
          id: "contact-1",
          name: "Alex Wright",
          company: "Wright Commercial",
          email: "alex@example.com",
          phone: "555-0100",
          role: "investor",
          preferredContact: "email",
        },
        deal: {
          id: "deal-1",
          propertyAddress: "303 N Broadway",
          propertyType: "office",
          stage: "prospecting",
          value: { toNumber: () => 1_250_000 },
          squareFeet: 4200,
          closingDate: new Date("2026-05-01T00:00:00.000Z"),
          keyContacts: { owner: "Alex Wright", broker: "Matt Robertson" },
          contact: { name: "Alex Wright" },
        },
        communication: {
          id: "comm-1",
          channel: "email",
          subject: "Following up on Broadway",
          date: new Date("2026-04-27T12:30:00.000Z"),
          externalMessageId: "A/B C",
          createdBy: "msgraph-email",
          contact: { name: "Alex Wright" },
        },
      },
    ])

    expect(contexts["prisma-todos/todo-1"]).toEqual({
      person: {
        name: "Alex Wright",
        slug: "contact-1",
        company: "Wright Commercial",
        email: "alex@example.com",
        phone: "555-0100",
        role: "investor",
        preferredContact: "email",
        entityType: "contacts",
      },
      deal: {
        noteTitle: "303 N Broadway",
        slug: "deal-1",
        propertyAddress: "303 N Broadway",
        propertyType: "office",
        stage: "prospecting",
        value: 1_250_000,
        squareFeet: 4200,
        clientName: "Alex Wright",
        closingDate: "2026-05-01T00:00:00.000Z",
        keyContacts: { owner: "Alex Wright", broker: "Matt Robertson" },
      },
      sourceComm: {
        path: "communication:comm-1",
        channel: "email",
        subject: "Following up on Broadway",
        date: "2026-04-27T12:30:00.000Z",
        contact: "Alex Wright",
        externalMessageId: "A/B C",
        sourceSystem: "msgraph-email",
        outlookUrl: "https://outlook.office.com/mail/deeplink/read/A%2FB%20C",
      },
    })
  })

  it("does not create Outlook links for non-Outlook source systems", () => {
    const contexts = resolvePrismaTodoContexts([
      {
        id: "todo-generic-source",
        communication: {
          id: "comm-generic",
          channel: "email",
          subject: "Imported email",
          date: "2026-04-27T12:30:00.000Z",
          externalMessageId: "gmail-message",
          createdBy: "gmail-import",
        },
      },
    ])

    expect(
      contexts["prisma-todos/todo-generic-source"].sourceComm
    ).toMatchObject({
      externalMessageId: "gmail-message",
      sourceSystem: "gmail-import",
    })
    expect(
      contexts["prisma-todos/todo-generic-source"].sourceComm?.outlookUrl
    ).toBeUndefined()
  })

  it("uses createdBy (not metadata.source) to identify the mailbox source for Outlook deeplinks", () => {
    // Regression: Communication.metadata.source holds lead-classification
    // values like "crexi-lead" or "loopnet-lead" set by msgraph ingestion.
    // The mailbox source is Communication.createdBy ("msgraph-email"). A prior
    // implementation read metadata.source first, which silently suppressed
    // Outlook deeplinks for every lead-platform email.
    const contexts = resolvePrismaTodoContexts([
      {
        id: "todo-lead-platform",
        communication: {
          id: "comm-lead",
          channel: "email",
          subject: "New lead from LoopNet",
          date: "2026-04-27T12:30:00.000Z",
          externalMessageId: "loopnet-msg-id",
          createdBy: "msgraph-email",
          metadata: { source: "loopnet-lead" },
        },
      },
    ])

    const sourceComm = contexts["prisma-todos/todo-lead-platform"].sourceComm
    expect(sourceComm).toMatchObject({
      sourceSystem: "msgraph-email",
      outlookUrl:
        "https://outlook.office.com/mail/deeplink/read/loopnet-msg-id",
    })
  })

  it("normalizes Prisma enum values for drawer display", () => {
    const contexts = resolvePrismaTodoContexts([
      {
        id: "todo-enums",
        deal: {
          id: "deal-enums",
          propertyAddress: "404 Mixed Use Ave",
          propertyType: "mixed_use",
          stage: "under_contract",
        },
      },
    ])

    expect(contexts["prisma-todos/todo-enums"].deal).toMatchObject({
      propertyType: "mixed-use",
      stage: "under-contract",
    })
  })

  it("maps a contact-only Prisma todo", () => {
    const contexts = resolvePrismaTodoContexts([
      {
        id: "todo-contact",
        contact: {
          id: "contact-2",
          name: "Jordan Lee",
        },
        deal: null,
        communication: null,
      },
    ])

    expect(contexts["prisma-todos/todo-contact"]).toEqual({
      person: {
        name: "Jordan Lee",
        slug: "contact-2",
        entityType: "contacts",
      },
    })
  })

  it("keeps a context entry for a Prisma todo with no relations", () => {
    expect(
      resolvePrismaTodoContexts([
        { id: "todo-empty", contact: null, deal: null, communication: null },
      ])
    ).toEqual({ "prisma-todos/todo-empty": {} })
  })
})

describe("resolveAllTodoContexts", () => {
  it("continues resolving vault todos from vault note references", () => {
    const todo = note<TodoMeta>("todos/business/follow-up.md", {
      type: "todo",
      category: "business",
      title: "Follow up",
      contact: "[[Alex Wright]]",
      deal: "[[303 N Broadway]]",
      source_communication: "communications/alex-email.md",
    })
    const client = note<ClientMeta>("clients/alex-wright/Alex Wright.md", {
      type: "client",
      category: "business",
      name: "Alex Wright",
      company: "Wright Commercial",
      email: "alex@example.com",
    })
    const deal = note<DealMeta>("clients/alex-wright/303 N Broadway.md", {
      type: "deal",
      category: "business",
      client: "[[Alex Wright]]",
      property_address: "303 N Broadway",
      property_type: "office",
      stage: "prospecting",
    })
    const communication = note<CommunicationMeta>(
      "communications/alex-email.md",
      {
        type: "communication",
        category: "business",
        channel: "email",
        contact: "[[Alex Wright]]",
        subject: "Broadway",
        date: "2026-04-27",
      }
    )

    expect(
      resolveAllTodoContexts([todo], [client], [], [deal], [communication])
    ).toMatchObject({
      "todos/business/follow-up.md": {
        person: {
          name: "Alex Wright",
          slug: "alex-wright",
          entityType: "clients",
        },
        deal: {
          noteTitle: "303 N Broadway",
          propertyAddress: "303 N Broadway",
        },
        sourceComm: {
          path: "communications/alex-email.md",
          channel: "email",
          subject: "Broadway",
        },
      },
    })
  })
})

function note<
  T extends TodoMeta | ClientMeta | ContactMeta | DealMeta | CommunicationMeta,
>(path: string, meta: T): VaultNote<T> {
  return { path, meta, content: "" }
}
