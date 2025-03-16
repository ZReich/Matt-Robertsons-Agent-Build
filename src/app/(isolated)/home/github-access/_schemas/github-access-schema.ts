import { z } from "zod"

export const GitHubAccessSchema = z.object({
  purchaseCode: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$/,
      {
        message: "Purchase Code must be in the correct format",
      }
    ),
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must contain at least 2 characters" })
    .max(50, { message: "Name must contain at most 50 characters" }),
  email: z
    .string()
    .toLowerCase()
    .trim()
    .email({ message: "Invalid email address" })
    .min(2, { message: "Email must contain at least 2 characters" })
    .max(50, { message: "Email must contain at most 50 characters" }),
  gitHubUsername: z
    .string()
    .trim()
    .min(2, { message: "GitHub Username must contain at least 2 character" })
    .max(50, {
      message: "GitHub Username must contain at most 50 characters",
    }),
  repository: z
    .string()
    .trim()
    .min(2, { message: "Repository must contain at least 2 character" })
    .max(50, {
      message: "Repository must contain at most 50 characters",
    }),
})
