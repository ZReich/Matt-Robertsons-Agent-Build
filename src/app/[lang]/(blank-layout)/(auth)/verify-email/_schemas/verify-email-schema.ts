import { z } from "zod";

export const VerifyEmailSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});
