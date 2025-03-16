import { z } from "zod"

import { GitHubAccessSchema } from "./_schemas/github-access-schema"

export type GitHubAccessType = z.infer<typeof GitHubAccessSchema>
