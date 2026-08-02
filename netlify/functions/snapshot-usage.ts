import type { Config } from '@netlify/functions'
import { writeDailySnapshot } from '../lib/usageStore'

/**
 * Freeze the current lifetime totals at the start of every UTC day.
 *
 * Errors deliberately escape so Netlify records a failed invocation instead of
 * silently leaving a hole that looks like a valid zero-activity day.
 */
export default async (): Promise<Response> => {
  await writeDailySnapshot()
  return new Response(null, { status: 204 })
}

export const config: Config = {
  schedule: '0 0 * * *',
}
