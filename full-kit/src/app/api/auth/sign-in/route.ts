import { NextResponse } from "next/server"

import { userData } from "@/data/user"

import { SignInSchema } from "@/schemas/sign-in-schema"

export async function POST(req: Request) {
  const body = await req.json()
  const parsedData = SignInSchema.safeParse(body)

  // If validation fails, return an error response with a 400 status
  if (!parsedData.success) {
    return NextResponse.json(parsedData.error, { status: 400 })
  }

  const { email, password } = parsedData.data

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const configuredReviewerEmails = csvSet(
      process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS
    )
    const isConfiguredLocalUser =
      normalizedEmail === userData.email.toLowerCase() ||
      configuredReviewerEmails.has(normalizedEmail)

    // If provided email and password match the local credential gate
    if (!isConfiguredLocalUser || userData.password !== password) {
      return NextResponse.json(
        { message: "Invalid email or password", email },
        { status: 401 }
      )
    }

    // Return success response with user data if credentials are correct
    return NextResponse.json(
      {
        id:
          normalizedEmail === userData.email.toLowerCase()
            ? userData.id
            : `local:${normalizedEmail}`,
        name:
          normalizedEmail === userData.email.toLowerCase()
            ? userData.name
            : nameFromEmail(normalizedEmail),
        email: normalizedEmail,
        avatar: userData.avatar,
        status: userData.status,
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("Error signing in:", e)
    return NextResponse.json({ error: "Error signing in" }, { status: 500 })
  }
}

function csvSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  )
}

function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
