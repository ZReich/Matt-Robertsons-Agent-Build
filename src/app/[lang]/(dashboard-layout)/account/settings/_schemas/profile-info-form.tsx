import { z } from "zod";

import { MAX_AVATAR_SIZE } from "../../constants";

import { formatFileSize } from "@/lib/utils";

export const fomratedAvatarSize = formatFileSize(MAX_AVATAR_SIZE);

export const ProfileInfoSchema = z.object({
  firstName: z
    .string()
    .min(2, { message: "First Name must contain at least 2 character(s)" })
    .trim(),
  lastName: z
    .string()
    .min(2, { message: "Last Name must contain at least 2 character(s)" })
    .trim(),
  username: z
    .string()
    .min(3, { message: "Username must contain at least 3 character(s)" })
    .toLowerCase()
    .trim(),
  email: z.string().email().toLowerCase().trim(),
  phoneNumber: z
    .string()
    .min(10, { message: "Phone Number must be at least 10 digits" }),
  state: z.string().trim(),
  country: z.string().trim(),
  address: z.string().trim(),
  zipCode: z.string().min(5, { message: "Zip Code must be at least 5 digits" }),
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
