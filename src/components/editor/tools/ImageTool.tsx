import { useEffect, useRef, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { displayedPageSizePt } from '@/lib/annotationGeometry'
import { ImagePickStep } from '@/components/image/ImagePickStep'
import type { NormalizedRect, PageDescriptor } from '@/domain/types'
import type { AnnotationImage } from '@/lib/readAnnotationImage'
import type { RenderedSize } from '@/hooks/usePagePreview'
import { IdleTool } from './IdleTool'

interface ImageToolProps {
  page: PageDescriptor
  zoom: number
  onDone: () => void
}

/**
 * Image tool: pick an image and it lands centred on the page, then the tool
 * disarms so it can be dragged and corner-resized on the idle page.
 *
 * Placement waits for the preview's rendered size because only the rendered
 * bitmap's aspect reflects an intrinsic `/Rotate` — the descriptor's own
 * width/height do not, and using them would skew the initial rect on rotated
 * pages. That is why the page is shown for a frame before the tool disarms.
 */
export function ImageTool({ page, zoom, onDone }: ImageToolProps) {
  const { addAnnotation, closeEditor } = usePdfToolkit()
  const [pickedImage, setPickedImage] = useState<AnnotationImage | null>(null)
  const [renderedSize, setRenderedSize] = useState<RenderedSize | null>(null)
  const placedRef = useRef(false)

  useEffect(() => {
    if (!pickedImage || !renderedSize || placedRef.current) return
    placedRef.current = true
    addAnnotation(page.id, {
      id: createId('ann'),
      kind: 'image',
      dataUrl: pickedImage.dataUrl,
      format: pickedImage.format,
      rect: initialImageRect(pickedImage, page, renderedSize),
      rotationAtCreate: page.rotation,
    })
    onDone()
  }, [pickedImage, renderedSize, page, addAnnotation, onDone])

  if (!pickedImage) return <ImagePickStep onClose={closeEditor} onPlace={setPickedImage} />
  return <IdleTool page={page} zoom={zoom} onRenderedSizeChange={setRenderedSize} />
}

/** Fraction of the displayed page the freshly placed image initially spans. */
const INITIAL_IMAGE_PAGE_FRACTION = 0.5

/**
 * Centered starting rect for a picked image: aspect-true on screen, spanning
 * half the displayed page along its limiting dimension.
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
