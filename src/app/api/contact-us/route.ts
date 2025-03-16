import { google } from "googleapis"
import nodemailer from "nodemailer"
import { z } from "zod"

import type { NextRequest } from "next/server"

import { ContactUsSchema } from "@/app/(isolated)/home/contact-us/_schemas/contact-us-schema"

import { rateLimiter } from "@/lib/rate-limit"

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_OAUTH_CLIENT_ID,
  process.env.GMAIL_OAUTH_CLIENT_SECRET,
  process.env.GMAIL_OAUTH_REDIRECT_URI
)
oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
})

export async function POST(req: NextRequest) {
  const rateLimitResult = rateLimiter(req)
  if (!rateLimitResult.success) {
    return new Response(
      JSON.stringify({
        message: "You have made too many requests. Please try again later.",
      }),
      {
        status: 429,
      }
    )
  }

  try {
    const body = await req.json()
    const parsedBody = ContactUsSchema.parse(body)
    const { name, email, message } = parsedBody

    const accessToken = await oAuth2Client.getAccessToken()

    const transporter = nodemailer.createTransport({
      // @ts-ignore
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_OAUTH_USER,
        clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
        clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    })

    await transporter.sendMail({
      from: process.env.GMAIL_OAUTH_USER,
      to: process.env.GMAIL_OAUTH_USER,
      subject: "New Message from Shadboard Next.js Contact Form",
      text: `Message from: ${name} (${email})\n\n${message}`,
    })

    return new Response(
      JSON.stringify({ message: "Email sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          message: error.message,
          formErrors: error.formErrors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    console.error("Failed to send email:", error)
    return new Response(JSON.stringify({ message: "Failed to send email" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
