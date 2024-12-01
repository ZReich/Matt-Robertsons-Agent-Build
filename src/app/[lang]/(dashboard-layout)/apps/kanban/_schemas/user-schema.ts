import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatar: z.string(),
});
