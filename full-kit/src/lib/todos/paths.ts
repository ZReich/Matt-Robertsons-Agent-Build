export const PRISMA_TODO_PATH_PREFIX = "prisma-todos/"

export function prismaTodoPath(id: string) {
  return `${PRISMA_TODO_PATH_PREFIX}${id}`
}

export function isPrismaTodoPath(path: string) {
  return path.startsWith(PRISMA_TODO_PATH_PREFIX)
}

export function getPrismaTodoId(path: string) {
  return isPrismaTodoPath(path)
    ? path.slice(PRISMA_TODO_PATH_PREFIX.length)
    : null
}
