import { NextResponse } from "next/server"

import { getUnreadLeadsCount } from "@/lib/leads/count"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const count = await getUnreadLeadsCount()
  return NextResponse.json({ ok: true, count })
}
