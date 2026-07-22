import { useEffect, useRef, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { displayedPageSizePt } from '@/lib/annotationGeometry'
import { AnnotationModalShell } from '@/components/annotations/AnnotationModalShell'
import { ArrangeMarksStep } from '@/components/annotations/ArrangeMarksStep'
import type { NormalizedRect, PageDescriptor } from '@/domain/types'
import type { AnnotationImage } from '@/lib/readAnnotationImage'
import type { RenderedSize } from '@/hooks/usePagePreview'
import { ImagePickStep } from './ImagePickStep'

/**
 * Image annotation dialog: pick the image (upload or paste) and it lands
 * centered on the page, ready to drag into place and corner-resize. The
 * placement waits for the preview's rendered size so the initial rect is
 * aspect-true even on pages with an intrinsic `/Rotate`.
 */
export function ImageAnnotateModal() {
  const { annotatingPage, cancelAnnotate, addAnnotation } = usePdfToolkit()
  const [pickedImage, setPickedImage] = useState<AnnotationImage | null>(null)
  const [renderedSize, setRenderedSize] = useState<RenderedSize | null>(null)
  const placedRef = useRef(false)

  useEffect(() => {
    if (!annotatingPage || !pickedImage || !renderedSize || placedRef.current) return
    placedRef.current = true
    addAnnotation(annotatingPage.id, {
      id: createId('ann'),
      kind: 'image',
      dataUrl: pickedImage.dataUrl,
      format: pickedImage.format,
      rect: initialImageRect(pickedImage, annotatingPage, renderedSize),
      rotationAtCreate: annotatingPage.rotation,
    })
  }, [annotatingPage, pickedImage, renderedSize, addAnnotation])

  if (!annotatingPage) return null

  return (
    <AnnotationModalShell
      title="Add an image"
      subtitle={
        pickedImage
          ? 'Place the image — it is already on the page.'
          : 'Pick an image; it lands on the page ready to move and resize.'
      }
      onClose={cancelAnnotate}
    >
      {pickedImage ? (
        <ArrangeMarksStep
          page={annotatingPage}
          hint="Drag the image to move it; drag its corner handle to resize."
          onDone={cancelAnnotate}
          onRenderedSizeChange={setRenderedSize}
        />
      ) : (
        <ImagePickStep onCancel={cancelAnnotate} onPlace={setPickedImage} />
      )}
    </AnnotationModalShell>
  )
}

/** Fraction of the displayed page the freshly placed image initially spans. */
const INITIAL_IMAGE_PAGE_FRACTION = 0.5

/**
 * Centered starting rect for a picked image: aspect-true on screen, spanning
 * half the displayed page along its limiting dimension. Displayed page points
 * come from the rendered bitmap's aspect, which honors intrinsic `/Rotate`.
 */
function initialImageRect(
  image: AnnotationImage,
  page: PageDescriptor,
  renderedSize: RenderedSize,
): NormalizedRect {
  const { widthPt, heightPt } = displayedPageSizePt(
    { width: page.width, height: page.height },
    renderedSize.width / renderedSize.height,
  )
  const imageAspect = image.width / image.height
  const widthOnPagePt = Math.min(
    INITIAL_IMAGE_PAGE_FRACTION * widthPt,
    INITIAL_IMAGE_PAGE_FRACTION * heightPt * imageAspect,
  )
  const width = widthOnPagePt / widthPt
  const height = widthOnPagePt / imageAspect / heightPt
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height }
}
