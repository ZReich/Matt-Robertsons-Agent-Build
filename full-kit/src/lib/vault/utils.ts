import path from "path"

/**
 * Strip [[wiki-link]] brackets and optional alias/heading fragments from vault entity references.
 * e.g., "[[John Smith]]" → "John Smith"
 *       "[[123 Main St Office]]" → "123 Main St Office"
 *       "[[note|alias]]" → "note"
 *       "[[note#heading]]" → "note"
 *       "John Smith" → "John Smith" (no-op if no brackets)
 */
export function normalizeEntityRef(ref: string): string {
  return ref
    .replace(/\[\[|\]\]/g, "")
    .replace(/[|#].*$/, "") // strip alias (|...) or heading (#...)
    .trim()
}

/**
 * Convert a name to a URL-safe slug.
 * e.g., "John Smith" → "john-smith"
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

/**
 * Sanitize a filename to prevent path traversal.
 * Strips directory separators, .., and non-safe characters.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .trim()
}

/**
 * Validate that a vault-relative path does not escape the vault root.
 * Returns the resolved path if safe, or null if it's a traversal attempt.
 */
export function validateVaultPath(
  vaultRoot: string,
  relativePath: string
): string | null {
  const resolved = path.resolve(vaultRoot, relativePath)
  const normalizedRoot = path.resolve(vaultRoot)
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    return null
  }
  return resolved
}

