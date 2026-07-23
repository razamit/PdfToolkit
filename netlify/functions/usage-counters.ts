import { readTotals } from '../lib/usageStore'

/** Counters change once a night, so serving a stale copy costs nothing. */
const CACHE_SECONDS = 900

/**
 * Public, unauthenticated read of the lifetime usage totals.
 *
 * The lifetime totals live in server-side Blob storage, written one increment at
 * a time by `/api/track`. This endpoint only reads them back. Only aggregate
 * counts cross this boundary; no per-visitor data is ever stored or served.
 *
 * Failures return an empty object rather than an error status: the counters are
 * decoration, and a broken analytics backend must never surface on the page.
 */
export default async (): Promise<Response> => {
  try {
    const totals = await readTotals()
    return Response.json(totals ?? {}, {
      headers: {
        'cache-control': `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
        'netlify-cdn-cache-control': `public, durable, s-maxage=${CACHE_SECONDS}`,
      },
    })
  } catch {
    return Response.json({})
  }
}
