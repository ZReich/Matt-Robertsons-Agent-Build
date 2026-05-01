import { NextResponse } from "next/server"

import { getNewDealsCount } from "@/lib/deals/count"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const count = await getNewDealsCount()
  return NextResponse.json({ ok: true, count })
}
