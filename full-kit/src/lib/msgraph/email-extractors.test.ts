import { describe, it, expect } from "vitest";
import { extractCrexiLead } from "./email-extractors";

describe("extractCrexiLead", () => {
  it("parses 'N new leads found for PROPERTY' pattern", () => {
    const r = extractCrexiLead({
      subject: "3 new leads found for West Park Promenade",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "new-leads-count",
      leadCount: 3,
      propertyName: "West Park Promenade",
    });
  });

  it("parses '1 new leads found for' (singular case in real data)", () => {
    const r = extractCrexiLead({
      subject: "1 new leads found for Hardin Gas Station",
      bodyText: "",
    });
    expect(r).toMatchObject({
      kind: "new-leads-count",
      leadCount: 1,
      propertyName: "Hardin Gas Station",
    });
  });

  it("parses '[Name] requesting Information on PROPERTY in CITY'", () => {
    const r = extractCrexiLead({
      subject: "JACKY BRADLEY requesting Information on Burger King | Sidney, MT in Sidney",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "inquiry",
      inquirerName: "JACKY BRADLEY",
      propertyName: "Burger King | Sidney, MT",
      cityOrMarket: "Sidney",
    });
  });

  it("parses '[Name] entered a note on PROPERTY' as team-note", () => {
    const r = extractCrexiLead({
      subject: "Margaret entered a note on Burger King | Sidney, MT",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "team-note",
      noteAuthor: "Margaret",
      propertyName: "Burger King | Sidney, MT",
    });
  });

  it("recognizes 'You have NEW leads to be contacted' as inquiry kind", () => {
    const r = extractCrexiLead({
      subject: "You have NEW leads to be contacted",
      bodyText: "Name: Jane Doe\nEmail: jane@example.com\nPhone: 555-1212\nCompany: Acme",
    });
    expect(r?.kind).toBe("inquiry");
    expect(r?.inquirer).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1212",
      company: "Acme",
    });
  });

  it("parses inquirer fields from body for 'requesting Information' kind", () => {
    const r = extractCrexiLead({
      subject: "Dean Klingner requesting Information on 13 Colorado Ave in Laurel",
      bodyText: "Name: Dean Klingner\nEmail: dean@buyer.com\nPhone: (406) 555-0000\nMessage: Interested in the property",
    });
    expect(r?.kind).toBe("inquiry");
    expect(r?.inquirer).toEqual({
      name: "Dean Klingner",
      email: "dean@buyer.com",
      phone: "(406) 555-0000",
      message: "Interested in the property",
    });
  });

  it("returns null on unrecognized subject", () => {
    const r = extractCrexiLead({ subject: "Some random subject", bodyText: "" });
    expect(r).toBeNull();
  });

  it("returns null on null subject", () => {
    const r = extractCrexiLead({ subject: null, bodyText: "" });
    expect(r).toBeNull();
  });
});

import { extractLoopNetLead } from "./email-extractors";

describe("extractLoopNetLead", () => {
  it("parses 'LoopNet Lead for PROPERTY' with body fields", () => {
    const r = extractLoopNetLead({
      subject: "LoopNet Lead for 303 N Broadway",
      bodyText: "Name: Tom Smith\nEmail: tom@buyer.net\nPhone: 406-555-0100",
    });
    expect(r).toEqual({
      kind: "inquiry",
      propertyName: "303 N Broadway",
      inquirer: {
        name: "Tom Smith",
        email: "tom@buyer.net",
        phone: "406-555-0100",
      },
    });
  });

  it("parses 'Alex Wright favorited PROPERTY' as favorited kind", () => {
    const r = extractLoopNetLead({
      subject: "Alex Wright favorited 303 N Broadway",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "favorited",
      viewerName: "Alex Wright",
      propertyName: "303 N Broadway",
    });
  });

  it("returns null for 'Your LoopNet inquiry was sent' (Matt's own outbound confirmation)", () => {
    const r = extractLoopNetLead({
      subject: "Your LoopNet inquiry was sent",
      bodyText: "",
    });
    expect(r).toBeNull();
  });

  it("returns null on unrecognized subject", () => {
    const r = extractLoopNetLead({ subject: "Random LoopNet update", bodyText: "" });
    expect(r).toBeNull();
  });
});

import { extractBuildoutEvent } from "./email-extractors";

describe("extractBuildoutEvent", () => {
  it("parses 'A new Lead has been added - PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "A new Lead has been added - US Bank Building",
      bodyText: "Name: Sam Buyer\nEmail: sam@example.com",
    });
    expect(r).toEqual({
      kind: "new-lead",
      propertyName: "US Bank Building",
      inquirer: { name: "Sam Buyer", email: "sam@example.com" },
    });
  });

  it("parses 'Deal stage updated on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "Deal stage updated on 2621 Overland",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "deal-stage-update",
      propertyName: "2621 Overland",
    });
  });

  it("parses 'You've been assigned a task'", () => {
    const r = extractBuildoutEvent({
      subject: "You've been assigned a task",
      bodyText: "",
    });
    expect(r?.kind).toBe("task-assigned");
  });

  it("parses critical date upcoming", () => {
    const r = extractBuildoutEvent({
      subject: "You have a critical date upcoming",
      bodyText: "",
    });
    expect(r?.kind).toBe("critical-date");
  });

  it("parses 'CA executed on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "CA executed on 2110 Overland Avenue",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "ca-executed",
      propertyName: "2110 Overland Avenue",
    });
  });

  it("parses 'Documents viewed on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "Documents viewed on US Bank Building",
      bodyText: "",
    });
    expect(r).toEqual({
      kind: "document-view",
      propertyName: "US Bank Building",
    });
  });

  it("returns null for unrelated Buildout email", () => {
    const r = extractBuildoutEvent({
      subject: "Buildout + NAI Business Partners | Meeting Recap",
      bodyText: "",
    });
    expect(r).toBeNull();
  });
});
