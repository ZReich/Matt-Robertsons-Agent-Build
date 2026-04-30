import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { authenticateUser } from "@/lib/auth"
import { db } from "@/lib/prisma"

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  })

export async function POST(req: Request) {
  let sessionUser
  try {
    sessionUser = await authenticateUser()
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = ChangePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = parsed.data

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, password: true },
  })

  if (!user || !user.password) {
    return NextResponse.json(
      { message: "Account is not configured for password sign-in." },
      { status: 400 }
    )
  }

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) {
    return NextResponse.json(
      { message: "Current password is incorrect." },
      { status: 400 }
    )
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
