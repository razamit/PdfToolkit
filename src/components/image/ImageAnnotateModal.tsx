import { useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { mapRectWithin } from '@/lib/signatureGeometry'
import { AnnotationModalShell } from '@/components/annotations/AnnotationModalShell'
import { RectChooseStep } from '@/components/annotations/RectChooseStep'
import type { NormalizedRect } from '@/domain/types'
import type { AnnotationImage } from '@/lib/readAnnotationImage'
import { ImagePickStep } from './ImagePickStep'

type ImageStep = 'rect' | 'pick'

/**
 * Two-step image annotation dialog, mirroring the signature flow: choose a
 * placement rectangle on the page, then pick the image (upload or paste).
 * The image is centered and aspect-fitted inside the chosen rectangle.
 */
export function ImageAnnotateModal() {
  const { annotatingPage, cancelAnnotate, addAnnotation } = usePdfToolkit()
  const [step, setStep] = useState<ImageStep>('rect')
  const [chosenRect, setChosenRect] = useState<NormalizedRect | null>(null)
  const [rectAspectRatio, setRectAspectRatio] = useState(1)

  if (!annotatingPage) return null
  const page = annotatingPage

  const handleContinue = (rect: NormalizedRect, aspectRatio: number) => {
    setChosenRect(rect)
    setRectAspectRatio(aspectRatio)
    setStep('pick')
  }

  const handlePlace = (image: AnnotationImage) => {
    if (!chosenRect) return
    addAnnotation(page.id, {
      id: createId('ann'),
      kind: 'image',
      dataUrl: image.dataUrl,
      format: image.format,
      rect: mapRectWithin(chosenRect, fitImageWithinRect(image, rectAspectRatio)),
      rotationAtCreate: page.rotation,
    })
    cancelAnnotate()
  }

  return (
    <AnnotationModalShell
      title="Add an image"
      subtitle={
        step === 'rect'
          ? 'Step 1 of 2 — choose where the image goes.'
          : 'Step 2 of 2 — pick the image to place.'
      }
      onClose={cancelAnnotate}
    >
      {step === 'rect' ? (
        <RectChooseStep
          page={page}
          initialRect={chosenRect}
          instruction="Drag a rectangle on the page where the image should go."
          confirmedInstruction="Placement chosen — drag again to adjust."
          onCancel={cancelAnnotate}
          onContinue={handleContinue}
        />
      ) : (
        <ImagePickStep onBack={() => setStep('rect')} onPlace={handlePlace} />
      )}
    </AnnotationModalShell>
  )
}

/**
 * Largest centered sub-rect of the chosen box (given its on-screen aspect)
 * that preserves the image's aspect ratio, in fractions of the box.
 */
function fitImageWithinRect(
  image: { width: number; height: number },
  rectAspectRatio: number,
): NormalizedRect {
  const imageAspect = image.width / image.height
  const width = imageAspect >= rectAspectRatio ? 1 : imageAspect / rectAspectRatio
  const height = imageAspect >= rectAspectRatio ? rectAspectRatio / imageAspect : 1
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height }
}
