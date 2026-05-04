/**
 * Bounded-concurrency batch processor. Processes `items` in slices of
 * `batchSize`, awaiting each slice's `Promise.allSettled` before moving on
 * to the next.
 *
 * Why `allSettled` rather than `Promise.all`: callers want one bad item in a
 * batch to be an isolated failure rather than rejecting the whole slice. The
 * caller is responsible for inspecting `status === "fulfilled"` / `"rejected"`
 * and updating any counters / side-effect logs accordingly.
 *
 * Why batched (slice-by-slice) rather than a true concurrency-N worker pool:
 * for the call sites here (DB writes per ingest, DeepSeek calls per scrub),
 * the slice-then-await shape is easier to reason about and the small
 * inefficiency of waiting for the slowest item in each slice is dwarfed by
 * the overall savings from N=5 vs N=1.
 *
 * Pick a small `batchSize` — DB connection pool and provider rate limits
 * dominate the upside; >5 starts to hit per-call overhead with diminishing
 * returns and may saturate the pgbouncer connection.
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  if (batchSize < 1) {
    throw new Error(
      `processInBatches: batchSize must be >= 1 (got ${batchSize})`
    )
  }
  const out: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize)
    const results = await Promise.allSettled(slice.map((item) => fn(item)))
    out.push(...results)
  }
  return out
}
