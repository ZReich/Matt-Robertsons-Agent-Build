import { z } from "zod";

export const RegisterSchema = z.object({
  firstName: z.string().min(2, {
    message: "Fisrt name must contain at least 2 character(s)",
  }),
  lastName: z.string().min(2, {
    message: "Last name must contain at least 2 character(s)",
  }),
  username: z.string().min(3, {
    message: "Usernmae must contain at least 3 character(s)",
  }),
  email: z
    .string()
    .email()
    .transform((val) => val.toLowerCase()),
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
