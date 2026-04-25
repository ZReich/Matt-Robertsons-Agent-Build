export type NextSearchParamsRecord = Record<
  string,
  string | string[] | undefined
>

export function toURLSearchParams(record: NextSearchParamsRecord = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0])
    } else if (value) params.set(key, value)
  }
  return params
}
