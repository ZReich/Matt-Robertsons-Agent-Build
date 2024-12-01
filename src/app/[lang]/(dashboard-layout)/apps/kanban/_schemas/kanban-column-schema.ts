import { z } from "zod";

export const KanbanColumnSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
});
