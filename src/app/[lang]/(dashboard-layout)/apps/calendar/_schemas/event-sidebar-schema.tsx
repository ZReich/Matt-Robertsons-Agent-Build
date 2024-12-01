import { z } from "zod";

import { categoriesData } from "../_data/categories";

import type { CategoryType } from "../types";

export const EventSidebarSchema = z.object({
  url: z.string().url({ message: "Invalid url" }).optional().or(z.literal("")),
  title: z.string().min(1, { message: "Title is required" }),
  allDay: z.boolean(),
  description: z.string().optional(),
  start: z.date().nullable(),
  end: z.date().nullable(),
  category: z.custom<CategoryType>(
    (value) => categoriesData.some((category) => category === value),
    { message: "Invalid label" }
  ),
});
