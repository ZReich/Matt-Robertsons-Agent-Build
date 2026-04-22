import { GraphError } from "./errors";
import { parseRetryAfter } from "./retry-after";
import { getTokenManager, TokenManager } from "./token-manager";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const RETRY_AFTER_DEFAULT_MS = 2000;
const RETRY_AFTER_MAX_MS = 60_000;

// --- narrow types: only the fields we actually consume ---

export interface GraphMailboxInfo {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

export interface GraphMessage {
  id: string;
  subject: string | null;
  from: {
    emailAddress: { name: string; address: string };
  } | null;
  receivedDateTime: string;
}

// --- test-only seam: allow tests to inject a stubbed TokenManager ---

let injectedTokenManager: TokenManager | null = null;
/** @internal — for tests only. Not exported from index.ts. */
export function __setTokenManagerForTests(tm: TokenManager | null): void {
  injectedTokenManager = tm;
}
function activeTokenManager(): TokenManager {
  return injectedTokenManager ?? getTokenManager();
}

// --- main wrapper ---

interface GraphFetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}

export async function graphFetch<T>(
  path: string,
  options: GraphFetchOptions = {},
): Promise<T> {
  return doGraphFetch<T>(path, options, /*isRetry*/ false);
}

async function doGraphFetch<T>(
  path: string,
  options: GraphFetchOptions,
  isRetry: boolean,
): Promise<T> {
  const tm = activeTokenManager();
  const token = await tm.getAccessToken();

  // Resolve absolute vs. relative. Absolute URLs must be on graph.microsoft.com
  // so we never leak a bearer token to an unexpected host.
  let url: URL;
  if (path.startsWith("https://") || path.startsWith("http://")) {
    if (!path.startsWith("https://graph.microsoft.com/")) {
      throw new GraphError(
        0,
        "BadURL",
        path,
        "absolute URL must target graph.microsoft.com",
      );
    }
    url = new URL(path);
  } else {
    url = new URL(GRAPH_BASE + path);
  }
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body,
    });
  } catch (networkErr) {
    // Network failure: retry once, then give up.
    if (!isRetry) {
      await sleep(RETRY_AFTER_DEFAULT_MS);
      return doGraphFetch<T>(path, options, /*isRetry*/ true);
    }
    throw new GraphError(
      0,
      "NetworkError",
      path,
      networkErr instanceof Error ? networkErr.message : String(networkErr),
    );
  }

  if (res.ok) {
    try {
      return (await res.json()) as T;
    } catch {
      // Graph normally returns JSON on 2xx, but maintenance pages or
      // proxy errors can occasionally produce HTML with a 200 status.
      // Surface as a typed GraphError so callers' `err instanceof GraphError`
      // branches handle it uniformly.
      throw new GraphError(
        res.status,
        "MalformedResponse",
        path,
        "Graph returned a non-JSON body on a 2xx response",
      );
    }
  }

  // --- error handling ---
  if (res.status === 401 && !isRetry) {
    tm.invalidate();
    return doGraphFetch<T>(path, options, /*isRetry*/ true);
  }

  if (res.status === 403) {
    throw await buildGraphError(res, path);
  }

  if ((res.status === 429 || res.status === 503 || res.status === 504) && !isRetry) {
    const waitMs = parseRetryAfter(
      res.headers.get("Retry-After"),
      RETRY_AFTER_DEFAULT_MS,
      RETRY_AFTER_MAX_MS,
    );
    await sleep(waitMs);
    return doGraphFetch<T>(path, options, /*isRetry*/ true);
  }

  throw await buildGraphError(res, path);
}

async function buildGraphError(res: Response, path: string): Promise<GraphError> {
  let code: string | undefined;
  let message = `Graph returned ${res.status}`;
  try {
    const data = (await res.json()) as {
      error?: { code?: string; message?: string };
    };
    if (data.error?.code) code = data.error.code;
    if (data.error?.message) message = data.error.message;
  } catch {
    // non-JSON body; keep default message
  }
  return new GraphError(res.status, code, path, message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- narrow helpers ---

export async function getMailboxInfo(upn: string): Promise<GraphMailboxInfo> {
  return graphFetch<GraphMailboxInfo>(
    `/users/${encodeURIComponent(upn)}/mailFolders/inbox`,
  );
}

export async function listRecentMessages(
  upn: string,
  top: number,
): Promise<GraphMessage[]> {
  const res = await graphFetch<{ value: GraphMessage[] }>(
    `/users/${encodeURIComponent(upn)}/messages`,
    {
      query: {
        $top: String(top),
        $select: "id,subject,from,receivedDateTime",
        $orderby: "receivedDateTime desc",
      },
    },
  );
  return res.value;
}
