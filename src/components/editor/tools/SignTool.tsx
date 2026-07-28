import { useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { mapRectWithin } from '@/lib/signatureGeometry'
import { RectChooseStep } from '@/components/annotations/RectChooseStep'
import { SignatureDrawStep } from '@/components/signature/SignatureDrawStep'
import type { NormalizedRect, PageDescriptor, RememberedSignature } from '@/domain/types'

interface SignToolProps {
  page: PageDescriptor
  zoom: number
  onDone: () => void
}

/**
 * Signature tool, two steps inside the session: choose the placement rect on
 * the page, then draw. Completing places the signature and disarms the tool,
 * landing back on the idle page with the signature ready to nudge — the
 * session itself stays open.
 */
export function SignTool({ page, zoom, onDone }: SignToolProps) {
  const { addSignature, signatureLibrary, closeEditor } = usePdfToolkit()
  const [chosenRect, setChosenRect] = useState<NormalizedRect | null>(null)
  const [rectAspectRatio, setRectAspectRatio] = useState(1)
  const [drawing, setDrawing] = useState(false)

  const handleContinue = (rect: NormalizedRect, aspectRatio: number) => {
    setChosenRect(rect)
    setRectAspectRatio(aspectRatio)
    setDrawing(true)
  }

  const handleComplete = (
    pngDataUrl: string,
    inkRect: NormalizedRect,
    newSignature: RememberedSignature | null,
  ) => {
    if (!chosenRect) return
    addSignature(
      page.id,
      {
        id: createId('sig'),
        pngDataUrl,
        rect: mapRectWithin(chosenRect, inkRect),
        rotationAtSign: page.rotation,
      },
      newSignature,
    )
    onDone()
  }

  if (!drawing) {
    return (
      <RectChooseStep
        page={page}
        zoom={zoom}
        initialRect={chosenRect}
        instruction="Drag a rectangle on the page where the signature should go."
        confirmedInstruction="Placement chosen — drag again to adjust."
        onClose={closeEditor}
        onContinue={handleContinue}
      />
    )
  }

  return (
    <SignatureDrawStep
      aspectRatio={rectAspectRatio}
      library={signatureLibrary}
      onBack={() => setDrawing(false)}
      onClose={closeEditor}
      onComplete={handleComplete}
    />
  )
}
