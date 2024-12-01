import { z } from "zod";

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
    .any()
    .optional()
    .refine(
      (file) =>
        file === null || file === undefined || file.size <= 2 * 1024 * 1024,
      "Max file size is 2MB"
    )
    .refine(
      (file) =>
        file === null ||
        file === undefined ||
        [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/svg+xml",
          "image/webp",
          "image/jpg",
        ].includes(file.type),
      "Only JPEG, PNG, GIF, SVG, and WebP files are allowed"
    ),
});
