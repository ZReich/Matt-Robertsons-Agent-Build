import { NextResponse } from "next/server"

import { patchLeadRecord } from "@/lib/pipeline/server/lead-actions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  return patchLeadRecord(id, body)
}
