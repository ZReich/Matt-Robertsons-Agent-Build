import { NextResponse } from "next/server"

import { searchNotes } from "@/lib/vault"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q")
    const scope = searchParams.get("scope") // comma-separated subdirs

    if (!query) {
      return NextResponse.json(
        { error: "q (query) parameter is required" },
        { status: 400 }
      )
    }

    const subdirs = scope ? scope.split(",").map((s) => s.trim()) : undefined
    const results = await searchNotes(query, subdirs)

    return NextResponse.json(results)
  } catch (e) {
    console.error("Error searching vault:", e)
    return NextResponse.json(
      { error: "Failed to search vault" },
      { status: 500 }
    )
  }
}
