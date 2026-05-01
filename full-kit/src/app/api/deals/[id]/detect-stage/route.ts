import { NextResponse } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import {
  DealStageDetectorError,
  detectDealStage,
  writeStageProposalAction,
} from "@/lib/ai/deal-stage-detector"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const csrfRejection = validateJsonMutationRequest(request)
  if (csrfRejection) return csrfRejection

  const { id } = await params

  try {
    const detection = await detectDealStage(id)
    const action = await writeStageProposalAction(detection)
    return NextResponse.json({ ok: true, detection, action })
  } catch (error) {
    if (error instanceof DealStageDetectorError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 ? error.status : 500 }
      )
    }
    throw error
  }
}
