import { z } from "zod";

export const SignInSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(250),
});
