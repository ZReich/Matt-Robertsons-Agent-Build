import { z } from "zod";

import { MAX_AVATAR_SIZE } from "../../constants";

import { formatFileSize } from "@/lib/utils";

export const fomratedAvatarSize = formatFileSize(MAX_AVATAR_SIZE);

export const ProfileInfoSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, { message: "First Name must contain at least 2 characters." })
    .max(50, { message: "First Name must be at most 50 characters." }),
  lastName: z
    .string()
    .trim()
    .min(2, { message: "Last Name must contain at least 2 characters." })
    .max(50, { message: "Last Name must be at most 50 characters." }),
  username: z
    .string()
    .toLowerCase()
    .trim()
    .min(3, { message: "Username must contain at least 3 characters." })
    .max(50, { message: "Username must be at most 50 characters." }),
  email: z
    .string()
    .email({ message: "Invalid email address" })
    .toLowerCase()
    .trim(),
  phoneNumber: z
    .string()
    .min(10, { message: "Phone Number must be at least 10 digits." })
    .max(15, { message: "Username must be at most 15 digits." }),
  state: z
    .string()
    .trim()
    .min(2, { message: "State must contain at least 2 characters." })
    .max(50, { message: "State must be at most 50 characters." }),
  country: z
    .string()
    .trim()
    .min(2, { message: "Country must contain at least 2 characters." })
    .max(56, { message: "Country must be at most 56 characters." }),
  address: z
    .string()
    .trim()
    .min(2, { message: "Address must contain at least 2 characters." })
    .max(100, { message: "Address must be at most 100 characters." }),
  zipCode: z
    .string()
    .min(5, { message: "Zip Code must be at least 5 digits." })
    .max(10, { message: "Zip Code must be at most 10 characters." }),
  language: z.string(),
  timeZone: z.string(),
  currency: z.string(),
  organization: z.string().trim().optional(),
  avatar: z
    .instanceof(File)
    .refine((avatar) => avatar.size <= MAX_AVATAR_SIZE, {
      message: `Avatar must be ${fomratedAvatarSize} or less.`,
    })
    .optional(),
});
