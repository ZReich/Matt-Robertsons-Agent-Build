// Verifies a candidate password against what's stored in the DB.
// Usage: node --env-file=.env.local scripts/check-user-password.mjs <email> <password>
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const [, , email, password] = process.argv
if (!email || !password) {
  console.error("usage: <email> <password>")
  process.exit(1)
}

const prisma = new PrismaClient()
const u = await prisma.user.findFirst({
  where: { email: { equals: email.toLowerCase(), mode: "insensitive" } },
  select: { id: true, email: true, name: true, password: true, updatedAt: true },
})

if (!u) {
  console.log("no user found")
} else {
  console.log("found:", { id: u.id, email: u.email, name: u.name, updatedAt: u.updatedAt, hasPassword: !!u.password })
  if (u.password) {
    const match = await bcrypt.compare(password, u.password)
    console.log("password matches:", match)
  }
}
await prisma.$disconnect()
