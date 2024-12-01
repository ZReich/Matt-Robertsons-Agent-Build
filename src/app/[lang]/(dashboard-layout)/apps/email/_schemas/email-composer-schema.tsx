import * as z from "zod";

export const EmailComposerSchema = z.object({
  to: z.string().email({ message: "Invalid email address" }),
  cc: z.string().email({ message: "Invalid email address" }).optional(),
  bcc: z.string().email({ message: "Invalid email address" }).optional(),
  subject: z
    .string()
    .min(1, { message: "Subject must contain at least 1 character" })
    .max(100, { message: "Subject must contain at most 100 characters" }),
  content: z
    .string()
    .min(1, { message: "Content must contain at least 1 character" })
    .max(5000, { message: "Content must contain at most 5000 characters" }),
});
