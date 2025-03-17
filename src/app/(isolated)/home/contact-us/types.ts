import type { z } from "zod"
import type { ContactUsSchema } from "./_schemas/contact-us-schema"

export type ContactUsType = z.infer<typeof ContactUsSchema>
