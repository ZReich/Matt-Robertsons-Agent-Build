import { NextResponse } from "next/server";

import {
  constantTimeCompare,
  GraphError,
  loadMsgraphConfig,
  syncMicrosoftContacts,
} from "@/lib/msgraph";

export const dynamic = "force-dynamic"; // never cache

export async function POST(request: Request): Promise<Response> {
  // 1. Kill switch — 404 if feature flag not explicitly "true" OR config fails to load.
  let config;
  try {
    config = loadMsgraphConfig();
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Auth — constant-time compare of x-admin-token.
  const provided = request.headers.get("x-admin-token");
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // 3. Handler.
  try {
    const result = await syncMicrosoftContacts();
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

// Reject other methods explicitly (Next.js App Router otherwise returns 405 default, but we make it explicit for clarity).
export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 });
}
