import type { z } from "zod"
import type { GitHubAccessSchema } from "./_schemas/github-access-schema"

export type GitHubAccessType = z.infer<typeof GitHubAccessSchema>
