import type { GraphEmailHeader } from "./email-types";
import { LARGE_CRE_BROKER_DOMAINS } from "./email-types";

// =============================================================================
// NOISE CONSTANTS
// =============================================================================

/** Domains whose mail is blanket-dropped as noise. Subdomains also match. */
export const NOISE_DOMAINS: ReadonlySet<string> = new Set([
  "flexmail.flexmls.com",
  "e.mail.realtor.com",
  "notifications.realtor.com",
  "shared1.ccsend.com",
  "bhhs-ecards.com",
  "email-whitepages.com",
  "propertyblast.com",
  "srsrealestatepartners.com",
  "encorereis.com",
  "comms.cushwakedigital.com",
  "atlanticretail.reverecre.com",
  "mail.beehiiv.com",
  "publications.bisnow.com",
  "news.bdcnetwork.com",
  "daily.therundown.ai",
  "wrenews.com",
  "retechnology.com",
  "trepp.com",
  "alm.com",
  "infabode.com",
  "rentalbeast.com",
  "mail1.nnn.market",
  "toasttab.com",
  "e.allegiant.com",
  "h5.hilton.com",
  "notification.intuit.com",
  "gohighlevel.com",
  "80eighty.com",
  "oofos.com",
  "lumecube.com",
  "theceshop.com",
  "marketing.ecommission.com",
  "fayranches.com",
]);

/** Specific sender addresses that are always noise regardless of domain policy. */
export const NOISE_SENDER_ADDRESSES: ReadonlySet<string> = new Set([
  "emails@pro.crexi.com",
  "emails@search.crexi.com",
  "emails@campaigns.crexi.com",
  "notifications@pro.crexi.com",
  "auctions@notifications.crexi.com",
  "nlpg@cbre.com",
  "yafcteam@comms.cushwakedigital.com",
  "loopnet@email.loopnet.com",
  "noreply@loopnet.com",
  "sales@loopnet.com",
]);

/** Senders whose domains are allowlisted in Layer A and therefore should bypass
 *  the generic "no-reply local part" drop rule. */
export const TRANSACTIONAL_ALLOWLIST_DOMAINS: ReadonlySet<string> = new Set([
  "docusign.net",
  "buildout.com",
  "notifications.crexi.com",
  "loopnet.com",
  "dotloop.com",
]);

export const AUTOMATED_LOCAL_PART_DROP =
  /^(news|newsletter|digest|updates?|marketing|alerts?|announce|broadcast)[0-9]*(\+.*)?$/i;

export const AUTOMATED_NOREPLY_PATTERN =
  /^(no-?reply|donotreply|do-not-reply|mailer|postmaster|bounces?|delivery)(\+.*)?$/i;

/** Well-known folder names Graph emits as `parentFolderId` display names, plus
 *  common Well-Known Folder IDs in case Graph returns IDs rather than names. */
export const JUNK_FOLDER_NAMES: readonly string[] = [
  "junkemail",
  "junk email",
  "junk",
  "deleteditems",
  "deleted items",
  "deleted",
];

// =============================================================================
// PREDICATES
// =============================================================================

export function isNoiseDomain(domain: string | undefined): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  if (NOISE_DOMAINS.has(d)) return true;
  for (const noise of NOISE_DOMAINS) {
    if (d.endsWith(`.${noise}`)) return true;
  }
  return false;
}

export function isNoiseSenderAddress(address: string | undefined): boolean {
  if (!address) return false;
  return NOISE_SENDER_ADDRESSES.has(address.toLowerCase());
}

export function hasAutomatedLocalPart(address: string | undefined): boolean {
  if (!address) return false;
  const atIdx = address.indexOf("@");
  if (atIdx <= 0) return false;
  const localPart = address.slice(0, atIdx);
  return (
    AUTOMATED_LOCAL_PART_DROP.test(localPart) ||
    AUTOMATED_NOREPLY_PATTERN.test(localPart)
  );
}

export function hasUnsubscribeHeader(
  headers: GraphEmailHeader[] | undefined,
): boolean {
  if (!headers) return false;
  return headers.some((h) => h.name.toLowerCase() === "list-unsubscribe");
}

export function isJunkOrDeletedFolder(
  folderHint: string | undefined,
): boolean {
  if (!folderHint) return false;
  return JUNK_FOLDER_NAMES.includes(folderHint.toLowerCase());
}

export function domainIsLargeCreBroker(domain: string | undefined): boolean {
  if (!domain) return false;
  return (LARGE_CRE_BROKER_DOMAINS as readonly string[]).includes(domain.toLowerCase());
}
