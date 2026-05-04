import { NextResponse } from "next/server"

import type { PendingReplyStatus, Prisma } from "@prisma/client"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { authenticateUser } from "@/lib/auth"
import { sendMailAsMatt } from "@/lib/msgraph/send-mail"
import { db } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

const ACTIONS = new Set(["approve", "dismiss", "edit", "send"])

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const reply = await db.pendingReply.findUnique({
    where: { id },
    include: {
      property: {
        select: { id: true, name: true, address: true, listingUrl: true },
      },
    },
  })
  if (!reply) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ reply })
}

export async function PATCH(
  request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  const { id } = await ctx.params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const action = typeof body.action === "string" ? body.action : null
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${[...ACTIONS].join(", ")}` },
      { status: 400 }
    )
  }

  const existing = await db.pendingReply.findUnique({ where: { id } })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })

  if (action === "edit") {
    if (existing.status !== "pending") {
      return NextResponse.json(
        {
          error:
            "cannot edit a reply in status=" +
            existing.status +
            " — only pending drafts are editable",
        },
        { status: 409 }
      )
    }
    const data: Prisma.PendingReplyUpdateInput = {}
    if (typeof body.draftSubject === "string")
      data.draftSubject =
        body.draftSubject.trim().slice(0, 998) || existing.draftSubject
    if (typeof body.draftBody === "string")
      // Cap the body at 64KB. Anything longer is almost certainly a paste
      // accident or a worst-case adversarial input.
      data.draftBody = body.draftBody.trim().slice(0, 65_535)
    const updated = await db.pendingReply.update({ where: { id }, data })
    return NextResponse.json({ ok: true, reply: updated })
  }

  const sessionUser = await authenticateUser()
  const reviewer = sessionUser.email ?? sessionUser.id

  if (action === "approve") {
    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: `cannot approve a reply in status=${existing.status}` },
        { status: 409 }
      )
    }
    // We deliberately do NOT call Microsoft Graph send-mail here. Per Matt's
    // sign-off in the transcript, auto-replies are draft-only until he gives
    // explicit approval to wire send. Approval here marks the draft as
    // accepted and (optionally) creates a synthetic outbound Communication
    // row so the timeline reflects that Matt or Genevieve sent something —
    // but the actual send happens manually (copy/paste into Outlook).
    const outboundComm = await db.communication.create({
      data: {
        channel: "email",
        direction: "outbound",
        subject: existing.draftSubject,
        body: existing.draftBody,
        date: new Date(),
        contactId: existing.contactId ?? undefined,
        metadata: {
          source: "auto-reply-approved",
          pendingReplyId: existing.id,
          modelUsed: existing.modelUsed ?? null,
        },
      },
      select: { id: true },
    })
    const updated = await db.pendingReply.update({
      where: { id },
      data: {
        status: "approved" as PendingReplyStatus,
        approvedAt: new Date(),
        approvedBy: reviewer,
        approvedCommunicationId: outboundComm.id,
      },
    })
    return NextResponse.json({
      ok: true,
      reply: updated,
      outboundCommunicationId: outboundComm.id,
    })
  }

  if (action === "send") {
    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: `cannot send a reply in status=${existing.status}` },
        { status: 409 }
      )
    }
    if (!existing.contactId) {
      return NextResponse.json(
        {
          error: "no contact linked to this draft — cannot resolve a recipient",
        },
        { status: 400 }
      )
    }
    const contact = await db.contact.findUnique({
      where: { id: existing.contactId },
      select: { id: true, name: true, email: true },
    })
    if (!contact?.email) {
      return NextResponse.json(
        {
          error:
            "linked contact has no email address on file — edit the contact, then come back and approve manually",
        },
        { status: 400 }
      )
    }

    const sendResult = await sendMailAsMatt({
      subject: existing.draftSubject,
      body: existing.draftBody,
      contentType: "Text",
      toRecipients: [{ address: contact.email, name: contact.name }],
      saveToSentItems: true,
    })

    if (!sendResult.ok) {
      return NextResponse.json(
        {
          error: "send failed",
          reason: sendResult.reason,
          status: sendResult.status,
          details: sendResult.details,
        },
        { status: sendResult.reason === "permission_denied" ? 503 : 502 }
      )
    }

    // Create a placeholder outbound Communication row so the timeline shows
    // the sent message immediately. The next email-sync delta will pick up
    // the real Sent Items message; we identify the synthetic row by
    // metadata.pendingReplyId so a future reconciliation step can merge them
    // when the real graph messageId arrives.
    const outboundComm = await db.communication.create({
      data: {
        channel: "email",
        direction: "outbound",
        subject: existing.draftSubject,
        body: existing.draftBody,
        date: new Date(),
        contactId: existing.contactId,
        metadata: {
          source: "auto-reply-sent-graph",
          pendingReplyId: existing.id,
          modelUsed: existing.modelUsed ?? null,
          recipientEmail: contact.email,
          sentBy: reviewer,
          awaitingSentItemsSync: true,
        },
      },
      select: { id: true },
    })
    const updated = await db.pendingReply.update({
      where: { id },
      data: {
        status: "approved" as PendingReplyStatus,
        approvedAt: new Date(),
        approvedBy: reviewer,
        approvedCommunicationId: outboundComm.id,
      },
    })
    return NextResponse.json({
      ok: true,
      sent: true,
      reply: updated,
      outboundCommunicationId: outboundComm.id,
    })
  }

  if (action === "dismiss") {
    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: `cannot dismiss a reply in status=${existing.status}` },
        { status: 409 }
      )
    }
    const updated = await db.pendingReply.update({
      where: { id },
      data: {
        status: "dismissed" as PendingReplyStatus,
        dismissedAt: new Date(),
        dismissReason:
          typeof body.dismissReason === "string"
            ? body.dismissReason.slice(0, 500)
            : null,
      },
    })
    return NextResponse.json({ ok: true, reply: updated })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
