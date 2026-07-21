import { useEffect, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import type { TextRun } from '@/lib/textRunGeometry'
import type { PageDescriptor } from '@/domain/types'

/**
 * Loads the text runs of a PDF page (base displayed frame) with loading and
 * error state. Extraction and caching live in `TextContentManager`.
 */
export function useTextRuns(page: PageDescriptor) {
  const { textContent } = usePdfToolkit()
  const [runs, setRuns] = useState<TextRun[] | null>(null)
  const [failed, setFailed] = useState(false)

  const { sourceId, sourcePageIndex } = page
  useEffect(() => {
    let cancelled = false
    setRuns(null)
    setFailed(false)
    textContent
      .getTextRuns(sourceId, sourcePageIndex)
      .then((result) => {
        if (!cancelled) setRuns(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [textContent, sourceId, sourcePageIndex])

  return { runs, loading: runs === null && !failed, failed }
}
