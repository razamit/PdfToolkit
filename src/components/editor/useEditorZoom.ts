import { useCallback, useMemo, useState } from 'react'

/**
 * Zoom levels offered in the editing session. 1 means "fit the page to the
 * area", so there is deliberately nothing below it — zooming out past the fit
 * would only add empty space around a page that is already fully visible.
 */
const ZOOM_STEPS = [1, 1.25, 1.5, 2, 3, 4] as const

export function useEditorZoom() {
  const [step, setStep] = useState(0)

  const zoomIn = useCallback(() => setStep((s) => Math.min(s + 1, ZOOM_STEPS.length - 1)), [])
  const zoomOut = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])
  const resetZoom = useCallback(() => setStep(0), [])

  return useMemo(
    () => ({
      zoom: ZOOM_STEPS[step],
      /** "Fit" at the base level, a percentage above it. */
      label: step === 0 ? 'Fit' : `${Math.round(ZOOM_STEPS[step] * 100)}%`,
      canZoomIn: step < ZOOM_STEPS.length - 1,
      canZoomOut: step > 0,
      zoomIn,
      zoomOut,
      resetZoom,
    }),
    [step, zoomIn, zoomOut, resetZoom],
  )
}

export type EditorZoom = ReturnType<typeof useEditorZoom>
