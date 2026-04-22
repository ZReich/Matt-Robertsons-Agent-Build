import { NextResponse } from "next/server";

import {
  constantTimeCompare,
  getMailboxInfo,
  GraphError,
  listRecentMessages,
  loadMsgraphConfig,
} from "@/lib/msgraph";

export const dynamic = "force-dynamic"; // never cache this

export async function GET(request: Request): Promise<Response> {
  // 1. Kill switch. Evaluated FIRST, before anything else.
  //    404 — indistinguishable from a route that doesn't exist.
  let config;
  try {
    config = loadMsgraphConfig();
  } catch (err) {
    // If env vars are missing in prod, don't leak that fact via a 500.
    // Fall through to 404 as if the route isn't deployed.
    return new NextResponse(null, { status: 404 });
  }
  if (!config.testRouteEnabled) {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Auth gate — shared-secret header, constant-time comparison.
  const provided = request.headers.get("x-admin-token");
  if (!provided || !constantTimeCompare(provided, config.testAdminToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // 3. Do the two Graph calls in order.
  try {
    const mailbox = await getMailboxInfo(config.targetUpn);
    const messagesRaw = await listRecentMessages(config.targetUpn, 10);

    const recentMessages = messagesRaw.map((m) => ({
      id: m.id,
      subject: m.subject,
      from: m.from?.emailAddress
        ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
        : null,
      receivedAt: m.receivedDateTime,
    }));

    return NextResponse.json({
      ok: true,
      mailbox: {
        displayName: mailbox.displayName,
        totalItemCount: mailbox.totalItemCount,
        unreadItemCount: mailbox.unreadItemCount,
      },
      recentMessages,
    });
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
