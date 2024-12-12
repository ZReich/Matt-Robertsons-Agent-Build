import { z } from "zod";

import { categoriesData } from "../_data/categories";

import type { CategoryType } from "../types";

export const EventSidebarSchema = z.object({
  url: z.string().url({ message: "Invalid url" }).or(z.literal("")),
  title: z
    .string()
    .trim()
    .min(2, { message: "Title must be at least 2 characters." })
    .max(50, { message: "Title must be at most 50 characters." }),
  allDay: z.boolean(),
  description: z
    .string()
    .trim()
    .min(2, { message: "Description must be at least 2 characters." })
    .max(250, { message: "Description must be at most 250 characters." }),
  start: z.date(),
  end: z.date(),
  category: z.custom<CategoryType>(
    (value) => categoriesData.some((category) => category === value),
    { message: "Invalid label" }
  ),
});
