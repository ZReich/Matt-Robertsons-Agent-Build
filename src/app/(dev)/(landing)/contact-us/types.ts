import { z } from "zod";

import { ContactUsSchema } from "./_schemas/contact-us-schema";

export type ContactUsType = z.infer<typeof ContactUsSchema>;
