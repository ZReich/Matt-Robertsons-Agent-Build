import { describe, expect, it } from "vitest";

import { mapGraphToContact } from "./contacts";

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
