// Idempotently upserts the two real user accounts (Zach + Matt) and sets
// their password to a known starter value. Run again any time you need to
// reset either account back to the starter password.
//
// Usage: node scripts/seed-users.mjs [starterPassword]
//   - Optional CLI arg overrides the starter password.
//   - Default "ChangeMe2026!" satisfies the sign-in schema (≥8 chars,
//     letter + digit). Both users should sign in once and immediately
//     rotate it via Account Settings → Security.

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const STARTER_PASSWORD = process.argv[2] ?? "ChangeMe2026!"

const USERS = [
  {
    email: "zachreichert2000@gmail.com",
    name: "Zach Reichert",
  },
  {
    email: "mrobertson@naibusinessproperties.com",
    name: "Matt Robertson",
  },
]

const prisma = new PrismaClient()

async function main() {
  const hashed = await bcrypt.hash(STARTER_PASSWORD, 12)

  for (const u of USERS) {
    const email = u.email.toLowerCase()

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: u.name,
          email,
          password: hashed,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      })
      console.log(`updated ${email}`)
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email,
          password: hashed,
          status: "ONLINE",
        },
      })
      console.log(`created ${email}`)
    }
  }

  console.log("")
  console.log(`Starter password for both accounts: ${STARTER_PASSWORD}`)
  console.log(
    "Sign in, then rotate it via Account → Settings → Security → Change Password."
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
