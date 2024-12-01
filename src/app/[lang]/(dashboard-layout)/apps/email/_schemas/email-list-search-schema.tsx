import * as z from "zod";

export const EmailListSearchSchema = z.object({
  term: z
    .string()
    .max(100, { message: "Search term must contain at most 100 characters" }),
});
