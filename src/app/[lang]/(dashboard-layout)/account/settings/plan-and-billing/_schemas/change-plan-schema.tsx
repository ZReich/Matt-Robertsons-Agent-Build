import { z } from "zod";

export const ChangePlanSchema = z.object({
  plan: z.string(),
  interval: z.boolean().default(false).optional(),
});
