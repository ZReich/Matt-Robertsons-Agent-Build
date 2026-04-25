import { NextResponse } from "next/server"

import type { NextRequest } from "next/server"

import {
  parsePipelineFilters,
  serializeLeadBoard,
} from "@/lib/pipeline/server/board"
import { patchLeadRecord } from "@/lib/pipeline/server/lead-actions"
import { db } from "@/lib/prisma"

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

export async function GET(request: NextRequest): Promise<Response> {
  const filters = parsePipelineFilters(request.nextUrl.searchParams)
  const terminalCutoff = daysAgo(30)

  const leads = await db.contact.findMany({
    where: {
      archivedAt: null,
      leadSource: { not: null },
      ...(filters.source ? { leadSource: filters.source } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { company: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
              {
                communications: {
                  some: {
                    subject: { contains: filters.search, mode: "insensitive" },
                  },
                },
              },
              {
                communications: {
                  some: {
                    body: { contains: filters.search, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
      ...(filters.showAll
        ? {}
        : {
            OR: [
              { leadStatus: { notIn: ["converted", "dropped"] } },
              { leadStatus: null },
              { leadAt: { gte: terminalCutoff } },
              { leadAt: null, updatedAt: { gte: terminalCutoff } },
            ],
          }),
    },
    include: {
      communications: {
        orderBy: { date: "desc" },
        take: 20,
        select: {
          id: true,
          subject: true,
          body: true,
          date: true,
          direction: true,
          metadata: true,
        },
      },
    },
    orderBy: [{ leadAt: "desc" }, { updatedAt: "desc" }],
  })

  return NextResponse.json(serializeLeadBoard(leads, filters))
}

export async function PATCH(request: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const id = typeof body.id === "string" ? body.id : null
  if (!id)
    return NextResponse.json({ error: "id is required" }, { status: 400 })

  return patchLeadRecord(id, body)
}
