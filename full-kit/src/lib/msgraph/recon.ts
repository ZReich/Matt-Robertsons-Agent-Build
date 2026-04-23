import { graphFetch } from "./client";
import { loadMsgraphConfig } from "./config";

interface MessageHeader {
  id: string;
  subject: string | null;
  from: { emailAddress: { name: string; address: string } } | null;
  receivedDateTime: string;
  hasAttachments: boolean;
  conversationId: string;
  parentFolderId: string;
}

interface GraphPage<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

export type ReconFolder = "inbox" | "sentitems" | "all";

export interface ReconOptions {
  daysBack?: number;
  platforms?: string[];
  topSendersLimit?: number;
  topDomainsLimit?: number;
  folder?: ReconFolder;
}

export interface SenderSummary {
  email: string;
  name: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  hasAttachmentsCount: number;
}

export interface DomainSummary {
  domain: string;
  count: number;
}

export interface PlatformSubjectPattern {
  platform: string;
  senderAddress: string;
  subjectPattern: string;
  count: number;
  withAttachments: number;
  sampleIds: string[];
}

export interface NoteworthyAutomatedSender {
  email: string;
  count: number;
  reason: string;
}

export interface ReconReport {
  params: {
    sinceIso: string;
    folder: ReconFolder;
    totalMessages: number;
    platforms: string[];
  };
  topSenders: SenderSummary[];
  topDomains: DomainSummary[];
  platformBreakdown: PlatformSubjectPattern[];
  noteworthyAutomatedSenders: NoteworthyAutomatedSender[];
}

const DEFAULT_PLATFORMS = [
  "crexi.com",
  "loopnet.com",
  "costar.com",
  "docusign.com",
  "dotloop.com",
  "hellosign.com",
  "apartments.com",
  "realtor.com",
  "buildout.com",
  "zillow.com",
  "redfin.com",
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 999;

const AUTOMATED_LOCAL_PART = /^(noreply|no-reply|donotreply|do-not-reply|mailer|notifications?|alerts?|updates?|news|newsletter|digest|info|support|help|customercare|postmaster|bounces?|delivery|system|marketing|hello|team|admin)(\+.*)?$/i;

export async function runSenderRecon(
  options: ReconOptions = {},
): Promise<ReconReport> {
  const cfg = loadMsgraphConfig();
  const daysBack = options.daysBack ?? 365;
  const platforms = (options.platforms ?? DEFAULT_PLATFORMS).map((p) =>
    p.toLowerCase().trim(),
  );
  const topSendersLimit = options.topSendersLimit ?? 200;
  const topDomainsLimit = options.topDomainsLimit ?? 100;
  const folder: ReconFolder = options.folder ?? "all";
  const sinceIso = new Date(Date.now() - daysBack * MS_PER_DAY).toISOString();

  const folderSegment =
    folder === "inbox"
      ? "/mailFolders/inbox"
      : folder === "sentitems"
        ? "/mailFolders/sentitems"
        : "";

  const basePath = `/users/${encodeURIComponent(cfg.targetUpn)}${folderSegment}/messages`;
  const initialQuery: Record<string, string> = {
    $filter: `receivedDateTime ge ${sinceIso}`,
    $select:
      "id,subject,from,receivedDateTime,hasAttachments,conversationId,parentFolderId",
    $top: String(PAGE_SIZE),
    $orderby: "receivedDateTime desc",
  };

  const allHeaders: MessageHeader[] = [];
  let page = 0;
  let nextUrl: string | undefined;
  do {
    page++;
    const res = await graphFetch<GraphPage<MessageHeader>>(
      nextUrl ?? basePath,
      nextUrl ? {} : { query: initialQuery },
    );
    allHeaders.push(...res.value);
    // eslint-disable-next-line no-console
    console.log(
      `[recon] page ${page}: +${res.value.length} headers (total ${allHeaders.length})`,
    );
    nextUrl = res["@odata.nextLink"];
  } while (nextUrl);

  // eslint-disable-next-line no-console
  console.log(`[recon] fetched ${allHeaders.length} headers; analyzing…`);

  // --- Sender + domain aggregation ---
  interface SenderAgg {
    count: number;
    name: string;
    firstSeen: string;
    lastSeen: string;
    hasAttachmentsCount: number;
  }
  const senderCounts = new Map<string, SenderAgg>();
  const domainCounts = new Map<string, number>();

  for (const h of allHeaders) {
    const rawAddr = h.from?.emailAddress.address;
    if (!rawAddr) continue;
    const addr = rawAddr.toLowerCase();
    const existing = senderCounts.get(addr);
    if (existing) {
      existing.count++;
      if (h.receivedDateTime < existing.firstSeen)
        existing.firstSeen = h.receivedDateTime;
      if (h.receivedDateTime > existing.lastSeen)
        existing.lastSeen = h.receivedDateTime;
      if (!existing.name && h.from?.emailAddress.name)
        existing.name = h.from.emailAddress.name;
      if (h.hasAttachments) existing.hasAttachmentsCount++;
    } else {
      senderCounts.set(addr, {
        count: 1,
        name: h.from?.emailAddress.name ?? "",
        firstSeen: h.receivedDateTime,
        lastSeen: h.receivedDateTime,
        hasAttachmentsCount: h.hasAttachments ? 1 : 0,
      });
    }
    const atIdx = addr.indexOf("@");
    if (atIdx > 0) {
      const domain = addr.slice(atIdx + 1);
      if (domain) domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
  }

  const topSenders: SenderSummary[] = [...senderCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topSendersLimit)
    .map(([email, v]) => ({
      email,
      name: v.name,
      count: v.count,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      hasAttachmentsCount: v.hasAttachmentsCount,
    }));

  const topDomains: DomainSummary[] = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topDomainsLimit)
    .map(([domain, count]) => ({ domain, count }));

  // --- Platform breakdown: for each platform-of-interest, group by
  //     (senderAddress, normalized subject pattern) and count. ---
  interface PlatformAgg {
    platform: string;
    senderAddress: string;
    subjectPattern: string;
    count: number;
    withAttachments: number;
    sampleIds: string[];
  }
  const platformAggs = new Map<string, PlatformAgg>();

  for (const h of allHeaders) {
    const rawAddr = h.from?.emailAddress.address?.toLowerCase();
    if (!rawAddr) continue;
    const atIdx = rawAddr.indexOf("@");
    if (atIdx <= 0) continue;
    const domain = rawAddr.slice(atIdx + 1);
    const platform = platforms.find(
      (p) => domain === p || domain.endsWith(`.${p}`),
    );
    if (!platform) continue;

    const normalizedSubject = normalizeSubject(h.subject ?? "");
    const key = `${platform}::${rawAddr}::${normalizedSubject}`;
    const agg = platformAggs.get(key);
    if (agg) {
      agg.count++;
      if (h.hasAttachments) agg.withAttachments++;
      if (agg.sampleIds.length < 5) agg.sampleIds.push(h.id);
    } else {
      platformAggs.set(key, {
        platform,
        senderAddress: rawAddr,
        subjectPattern: normalizedSubject,
        count: 1,
        withAttachments: h.hasAttachments ? 1 : 0,
        sampleIds: [h.id],
      });
    }
  }

  const platformBreakdown: PlatformSubjectPattern[] = [...platformAggs.values()]
    .sort((a, b) => b.count - a.count);

  // --- Noteworthy automated senders ---
  const noteworthy: NoteworthyAutomatedSender[] = topSenders
    .filter((s) => {
      const localPart = s.email.split("@")[0] ?? "";
      return AUTOMATED_LOCAL_PART.test(localPart) || s.count >= 50;
    })
    .map((s) => {
      const localPart = s.email.split("@")[0] ?? "";
      const reason = AUTOMATED_LOCAL_PART.test(localPart)
        ? `automated local-part pattern (${localPart})`
        : `high volume (${s.count} in ${daysBack} days)`;
      return { email: s.email, count: s.count, reason };
    });

  return {
    params: {
      sinceIso,
      folder,
      totalMessages: allHeaders.length,
      platforms,
    },
    topSenders,
    topDomains,
    platformBreakdown,
    noteworthyAutomatedSenders: noteworthy,
  };
}

function normalizeSubject(s: string): string {
  let out = s.replace(/^((re|fwd?|fw|aw):\s*)+/gi, "").trim();
  out = out.replace(/\s+/g, " ");
  if (out.length > 140) out = out.slice(0, 140) + "…";
  return out;
}
