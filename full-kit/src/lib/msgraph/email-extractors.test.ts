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
