import matter from "gray-matter"

import type { VaultNote, VaultNoteMeta } from "./types"

/**
 * Parse a raw markdown string into a VaultNote with typed frontmatter.
 *
 * @param raw - The raw markdown file content
 * @param path - The relative path from vault root
 */
export function parseVaultNote<T extends VaultNoteMeta = VaultNoteMeta>(
  raw: string,
  path: string
): VaultNote<T> {
  const { data, content } = matter(raw)

  return {
    path,
    meta: data as T,
    content: content.trim(),
  }
}

/**
 * Serialize a VaultNote back to a markdown string with YAML frontmatter.
 */
export function serializeVaultNote<T extends VaultNoteMeta>(
  note: VaultNote<T>
): string {
  return matter.stringify(note.content, note.meta as Record<string, unknown>)
}
