import { z } from "zod";

import { MAX_AVATAR_SIZE } from "../../constants";

import { formatFileSize } from "@/lib/utils";

export const fomratedAvatarSize = formatFileSize(MAX_AVATAR_SIZE);

export const ProfileInfoSchema = z.object({
  firstName: z
    .string()
    .min(2, { message: "First Name must contain at least 2 character(s)" }),
  lastName: z
    .string()
    .min(2, { message: "Last Name must contain at least 2 character(s)" }),
  username: z
    .string()
    .min(3, { message: "Username must contain at least 3 character(s)" }),
  email: z.string().email(),
  phoneNumber: z
    .string()
    .min(10, { message: "Phone Number must be at least 10 digits" }),
  state: z.string(),
  country: z.string(),
  address: z.string(),
  zipCode: z.string().min(5, { message: "Zip Code must be at least 5 digits" }),
  language: z.string(),
  timeZone: z.string(),
  currency: z.string(),
  organization: z.string().optional(),
  avatar: z
    .instanceof(File)
    .refine((avatar) => avatar.size <= MAX_AVATAR_SIZE, {
      message: `Avatar must be ${fomratedAvatarSize} or less.`,
    })
    .optional(),
});
