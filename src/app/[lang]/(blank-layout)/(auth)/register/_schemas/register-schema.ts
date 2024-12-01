import { z } from "zod";

export const RegisterSchema = z.object({
  firstName: z
    .string()
    .min(2, {
      message: "Fisrt name must contain at least 2 character(s)",
    })
    .trim(),
  lastName: z
    .string()
    .min(2, {
      message: "Last name must contain at least 2 character(s)",
    })
    .trim(),
  username: z
    .string()
    .min(3, {
      message: "Usernmae must contain at least 3 character(s)",
    })
    .toLowerCase()
    .trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8, {
      message: "Password must contain at least 8 character(s)",
    })
    .regex(/(?=.*[a-zA-Z])/, {
      message: "Password must contain at least one letter.",
    })
    .regex(/(?=.*[0-9])/, {
      message: "Password must contain at least one number.",
    }),
});
