/**
 * Server-only vault utilities — requires Node.js `path` module.
 * Do NOT import in "use client" components.
 */
import path from "path"

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
  if (
    !resolved.startsWith(normalizedRoot + path.sep) &&
    resolved !== normalizedRoot
  ) {
    return null
  }
  return resolved
}
