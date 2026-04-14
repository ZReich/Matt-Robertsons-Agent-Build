import fs from "fs/promises"
import path from "path"

import type { VaultCategory, VaultNote, VaultNoteMeta } from "./types"

import { parseVaultNote, serializeVaultNote } from "./parser"

/** Resolve the vault root directory. Defaults to `vault/` in project root. */
function getVaultRoot(): string {
  return process.env.VAULT_PATH || path.join(process.cwd(), "vault")
}

/**
 * Read a single vault note by its relative path.
 *
 * @param relativePath - Path relative to vault root (e.g., "clients/john-smith/John Smith.md")
 */
export async function readNote<T extends VaultNoteMeta = VaultNoteMeta>(
  relativePath: string
): Promise<VaultNote<T>> {
  const fullPath = path.join(getVaultRoot(), relativePath)
  const raw = await fs.readFile(fullPath, "utf-8")
  return parseVaultNote<T>(raw, relativePath)
}

/**
 * List all markdown files in a vault subdirectory (recursive).
 *
 * @param subdir - Subdirectory within vault (e.g., "clients", "todos/business")
 */
export async function listNotes<T extends VaultNoteMeta = VaultNoteMeta>(
  subdir: string
): Promise<VaultNote<T>[]> {
  const dirPath = path.join(getVaultRoot(), subdir)
  const files = await collectMarkdownFiles(dirPath)
  const vaultRoot = getVaultRoot()

  const notes = await Promise.all(
    files.map(async (filePath) => {
      const raw = await fs.readFile(filePath, "utf-8")
      const relativePath = path
        .relative(vaultRoot, filePath)
        .replace(/\\/g, "/")
      return parseVaultNote<T>(raw, relativePath)
    })
  )

  return notes
}

/**
 * List notes filtered by vault category (business/personal).
 */
export async function listNotesByCategory<
  T extends VaultNoteMeta = VaultNoteMeta,
>(subdir: string, category: VaultCategory): Promise<VaultNote<T>[]> {
  const notes = await listNotes<T>(subdir)
  return notes.filter((note) => note.meta.category === category)
}

/**
 * List notes filtered by a specific frontmatter type field.
 */
export async function listNotesByType<T extends VaultNoteMeta = VaultNoteMeta>(
  subdir: string,
  type: string
): Promise<VaultNote<T>[]> {
  const notes = await listNotes<T>(subdir)
  return notes.filter((note) => note.meta.type === type)
}

/**
 * Update frontmatter fields of an existing vault note and write it back to disk.
 *
 * @param relativePath - Path relative to vault root (e.g., "clients/john-smith/Deal.md")
 * @param updates - Partial frontmatter fields to merge
 */
export async function updateNote<T extends VaultNoteMeta = VaultNoteMeta>(
  relativePath: string,
  updates: Partial<T>
): Promise<VaultNote<T>> {
  const fullPath = path.join(getVaultRoot(), relativePath)
  const raw = await fs.readFile(fullPath, "utf-8")
  const note = parseVaultNote<T>(raw, relativePath)
  const updated: VaultNote<T> = {
    ...note,
    meta: { ...note.meta, ...updates },
  }
  const serialized = serializeVaultNote(updated)
  await fs.writeFile(fullPath, serialized, "utf-8")
  return updated
}

/**
 * Create a new vault note with frontmatter and optional body content.
 *
 * @param subdir - Subdirectory within vault (e.g., "todos/business", "communications")
 * @param filename - Filename for the note (e.g., "My Todo.md")
 * @param meta - Frontmatter fields
 * @param content - Markdown body content (optional, defaults to "")
 * @returns The created VaultNote
 */
export async function createNote<T extends VaultNoteMeta = VaultNoteMeta>(
  subdir: string,
  filename: string,
  meta: T,
  content: string = ""
): Promise<VaultNote<T>> {
  const vaultRoot = getVaultRoot()
  const dirPath = path.join(vaultRoot, subdir)

  // Ensure directory exists
  await fs.mkdir(dirPath, { recursive: true })

  const relativePath = `${subdir}/${filename}`.replace(/\\/g, "/")
  const fullPath = path.join(dirPath, filename)

  const note: VaultNote<T> = { path: relativePath, meta, content }
  const serialized = serializeVaultNote(note)
  await fs.writeFile(fullPath, serialized, "utf-8")

  return note
}

/**
 * Delete a vault note from disk.
 *
 * @param relativePath - Path relative to vault root
 */
export async function deleteNote(relativePath: string): Promise<void> {
  const fullPath = path.join(getVaultRoot(), relativePath)
  await fs.unlink(fullPath)
}

/**
 * Archive a vault note by moving it to vault/archive/ (preserving folder structure).
 * Sets `archived: true` and `archived_date` in frontmatter before moving.
 *
 * @param relativePath - Path relative to vault root
 * @returns The archived VaultNote at its new path
 */
export async function archiveNote<T extends VaultNoteMeta = VaultNoteMeta>(
  relativePath: string
): Promise<VaultNote<T>> {
  const vaultRoot = getVaultRoot()
  const fullPath = path.join(vaultRoot, relativePath)

  // Read the note
  const raw = await fs.readFile(fullPath, "utf-8")
  const note = parseVaultNote<T>(raw, relativePath)

  // Add archive metadata
  const archivedMeta = {
    ...note.meta,
    archived: true,
    archived_date: new Date().toISOString().split("T")[0],
  }

  const archivePath = `archive/${relativePath}`
  const archiveFullPath = path.join(vaultRoot, archivePath)

  // Ensure archive directory exists
  await fs.mkdir(path.dirname(archiveFullPath), { recursive: true })

  // Write archived version
  const archived: VaultNote<T> = {
    path: archivePath,
    meta: archivedMeta as T,
    content: note.content,
  }
  await fs.writeFile(archiveFullPath, serializeVaultNote(archived), "utf-8")

  // Remove original
  await fs.unlink(fullPath)

  return archived
}

/**
 * Full-text search across all vault markdown files.
 * Searches both frontmatter fields and body content.
 *
 * @param query - Search string (case-insensitive)
 * @param subdirs - Optional subdirectories to limit search (defaults to all)
 * @returns Matching notes sorted by relevance (title match > frontmatter match > body match)
 */
export async function searchNotes<T extends VaultNoteMeta = VaultNoteMeta>(
  query: string,
  subdirs?: string[]
): Promise<VaultNote<T>[]> {
  const searchDirs = subdirs ?? [
    "clients",
    "contacts",
    "communications",
    "meetings",
    "todos",
    "templates",
  ]

  const allNotes: VaultNote<T>[] = []
  for (const subdir of searchDirs) {
    const notes = await listNotes<T>(subdir)
    allNotes.push(...notes)
  }

  const lowerQuery = query.toLowerCase()

  // Score and filter
  const scored = allNotes
    .map((note) => {
      const metaStr = JSON.stringify(note.meta).toLowerCase()
      const bodyStr = note.content.toLowerCase()
      const pathStr = note.path.toLowerCase()

      let score = 0
      // Title / name field matches score highest
      const nameField =
        (note.meta as Record<string, unknown>).title ||
        (note.meta as Record<string, unknown>).name ||
        (note.meta as Record<string, unknown>).property_address ||
        (note.meta as Record<string, unknown>).subject ||
        ""
      if (String(nameField).toLowerCase().includes(lowerQuery)) score += 10

      // Path match
      if (pathStr.includes(lowerQuery)) score += 5

      // Frontmatter field match
      if (metaStr.includes(lowerQuery)) score += 3

      // Body content match
      if (bodyStr.includes(lowerQuery)) score += 1

      return { note, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map((item) => item.note)
}

/**
 * Recursively collect all .md files in a directory.
 */
async function collectMarkdownFiles(dirPath: string): Promise<string[]> {
  const results: string[] = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const nested = await collectMarkdownFiles(fullPath)
        results.push(...nested)
      } else if (entry.name.endsWith(".md")) {
        results.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist yet — return empty
  }

  return results
}
