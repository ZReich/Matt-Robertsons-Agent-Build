import { describe, it, expect } from "vitest";
import {
  isNoiseDomain,
  isNoiseSenderAddress,
  hasAutomatedLocalPart,
  hasUnsubscribeHeader,
  isJunkOrDeletedFolder,
  JUNK_FOLDER_NAMES,
} from "./email-filter";

describe("isNoiseDomain", () => {
  it("returns true for domains in the noise list", () => {
    expect(isNoiseDomain("propertyblast.com")).toBe(true);
    expect(isNoiseDomain("flexmail.flexmls.com")).toBe(true);
    expect(isNoiseDomain("e.mail.realtor.com")).toBe(true);
  });
  it("returns true for subdomains of noise domains", () => {
    expect(isNoiseDomain("sub.propertyblast.com")).toBe(true);
  });
  it("returns false for domains NOT in the noise list", () => {
    expect(isNoiseDomain("naibusinessproperties.com")).toBe(false);
    expect(isNoiseDomain("cbre.com")).toBe(false);
    expect(isNoiseDomain("docusign.net")).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isNoiseDomain("PropertyBlast.com")).toBe(true);
  });
});

describe("isNoiseSenderAddress", () => {
  it("returns true for specific Crexi noise senders", () => {
    expect(isNoiseSenderAddress("emails@pro.crexi.com")).toBe(true);
    expect(isNoiseSenderAddress("emails@search.crexi.com")).toBe(true);
    expect(isNoiseSenderAddress("emails@campaigns.crexi.com")).toBe(true);
    expect(isNoiseSenderAddress("notifications@pro.crexi.com")).toBe(true);
  });
  it("returns true for nlpg@cbre.com but not other cbre senders", () => {
    expect(isNoiseSenderAddress("nlpg@cbre.com")).toBe(true);
    expect(isNoiseSenderAddress("ian.schroeder@cbre.com")).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isNoiseSenderAddress("Emails@Pro.Crexi.Com")).toBe(true);
  });
});

describe("hasAutomatedLocalPart", () => {
  it("matches common automated prefixes", () => {
    expect(hasAutomatedLocalPart("noreply@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("no-reply@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("news@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("newsletter@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("digest@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("updates@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("marketing@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("alerts@example.com")).toBe(true);
  });
  it("matches with numeric suffixes and plus-tags", () => {
    expect(hasAutomatedLocalPart("news2@example.com")).toBe(true);
    expect(hasAutomatedLocalPart("marketing+promo@example.com")).toBe(true);
  });
  it("does NOT match personal-looking local parts", () => {
    expect(hasAutomatedLocalPart("alice@example.com")).toBe(false);
    expect(hasAutomatedLocalPart("mrobertson@example.com")).toBe(false);
    expect(hasAutomatedLocalPart("john.smith@example.com")).toBe(false);
  });
  it("does NOT match when no @ is present", () => {
    expect(hasAutomatedLocalPart("noreply")).toBe(false);
  });
});

describe("hasUnsubscribeHeader", () => {
  it("returns true when List-Unsubscribe header is present (any case)", () => {
    expect(
      hasUnsubscribeHeader([{ name: "List-Unsubscribe", value: "<mailto:u@x>" }]),
    ).toBe(true);
    expect(
      hasUnsubscribeHeader([{ name: "list-unsubscribe", value: "<mailto:u@x>" }]),
    ).toBe(true);
  });
  it("returns false when absent or headers undefined", () => {
    expect(hasUnsubscribeHeader([])).toBe(false);
    expect(hasUnsubscribeHeader(undefined)).toBe(false);
    expect(
      hasUnsubscribeHeader([{ name: "Subject", value: "Hi" }]),
    ).toBe(false);
  });
});

describe("isJunkOrDeletedFolder", () => {
  it("identifies Junk and Deleted Items folders by well-known IDs", () => {
    for (const name of JUNK_FOLDER_NAMES) {
      expect(isJunkOrDeletedFolder(name)).toBe(true);
    }
  });
  it("returns false for inbox/sentitems", () => {
    expect(isJunkOrDeletedFolder("inbox")).toBe(false);
    expect(isJunkOrDeletedFolder("sentitems")).toBe(false);
    expect(isJunkOrDeletedFolder(undefined)).toBe(false);
  });
});
