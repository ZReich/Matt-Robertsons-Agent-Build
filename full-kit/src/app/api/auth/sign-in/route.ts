import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { SignInSchema } from "@/schemas/sign-in-schema"

import { db } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json()
  const parsedData = SignInSchema.safeParse(body)

  if (!parsedData.success) {
    return NextResponse.json(parsedData.error, { status: 400 })
  }

  const { email, password } = parsedData.data
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const user = await db.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        status: true,
        password: true,
      },
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("Error signing in:", e)
    return NextResponse.json({ error: "Error signing in" }, { status: 500 })
  }
}
