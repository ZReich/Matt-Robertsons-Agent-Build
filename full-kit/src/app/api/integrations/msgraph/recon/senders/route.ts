import { NextResponse } from "next/server";

import {
  constantTimeCompare,
  GraphError,
  loadMsgraphConfig,
  runSenderRecon,
  type ReconFolder,
} from "@/lib/msgraph";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/integrations/msgraph/recon/senders?daysBack=365&folder=all&platforms=crexi.com,loopnet.com
//
// One-off recon endpoint. Groups last-N-days of message headers by sender / domain
// and surfaces subject-line patterns for a list of platforms-of-interest.
// Read-only; does not touch the DB.
export async function GET(request: Request): Promise<Response> {
  let config;
  try {
    config = loadMsgraphConfig();
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  const provided = request.headers.get("x-admin-token");
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const daysBack = parsePositiveInt(url.searchParams.get("daysBack"), 365);
  const folderParam = url.searchParams.get("folder");
  const folder = normalizeFolder(folderParam);
  const platformsParam = url.searchParams.get("platforms");
  const platforms = platformsParam
    ? platformsParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : undefined;
  const topSendersLimit = parsePositiveInt(
    url.searchParams.get("topSendersLimit"),
    200,
  );
  const topDomainsLimit = parsePositiveInt(
    url.searchParams.get("topDomainsLimit"),
    100,
  );

  try {
    const report = await runSenderRecon({
      daysBack,
      folder,
      platforms,
      topSendersLimit,
      topDomainsLimit,
    });
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    if (err instanceof GraphError) {
      return NextResponse.json(
        {
          ok: false,
          status: err.status,
          code: err.code,
          path: err.path,
          message: err.message,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 500 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "unexpected", message: String(err) },
      { status: 500 },
    );
  }
}

export async function POST(): Promise<Response> {
  return new NextResponse(null, { status: 405 });
}

function parsePositiveInt(v: string | null, def: number): number {
  if (!v) return def;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function normalizeFolder(v: string | null): ReconFolder {
  if (v === "inbox" || v === "sentitems" || v === "all") return v;
  return "all";
}
