import { NextResponse } from "next/server";

import {
  constantTimeCompare,
  GraphError,
  loadMsgraphConfig,
  syncEmails,
} from "@/lib/msgraph";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
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
  const daysBackRaw = url.searchParams.get("daysBack");
  const daysBack = daysBackRaw
    ? Math.max(1, Number.parseInt(daysBackRaw, 10) || 90)
    : undefined;
  const forceBootstrap = url.searchParams.get("forceBootstrap") === "true";

  try {
    const result = await syncEmails({ daysBack, forceBootstrap });
    return NextResponse.json({ ok: true, ...result });
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

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 });
}
