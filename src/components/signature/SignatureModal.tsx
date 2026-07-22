import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import { createId } from '@/lib/id'
import { mapRectWithin } from '@/lib/signatureGeometry'
import { RectChooseStep } from '@/components/annotations/RectChooseStep'
import type { NormalizedRect, RememberedSignature } from '@/domain/types'
import { SignatureDrawStep } from './SignatureDrawStep'

type SignatureStep = 'rect' | 'draw'

/**
 * Two-step signing dialog: choose a placement rectangle on the page, then draw
 * the signature. Escape and the close button cancel; clicking the backdrop
 * does not, so an in-progress drawing can't be lost by a stray tap.
 */
export function SignatureModal() {
  const { signingPage, cancelSign, addSignature, signatureLibrary } = usePdfToolkit()
  const [step, setStep] = useState<SignatureStep>('rect')
  const [chosenRect, setChosenRect] = useState<NormalizedRect | null>(null)
  const [rectAspectRatio, setRectAspectRatio] = useState(1)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelSign()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelSign])

  if (!signingPage) return null

  const handleContinue = (rect: NormalizedRect, aspectRatio: number) => {
    setChosenRect(rect)
    setRectAspectRatio(aspectRatio)
    setStep('draw')
  }

  const handleComplete = (
    pngDataUrl: string,
    inkRect: NormalizedRect,
    newSignature: RememberedSignature | null,
  ) => {
    if (!chosenRect) return
    addSignature(
      signingPage.id,
      {
        id: createId('sig'),
        pngDataUrl,
        rect: mapRectWithin(chosenRect, inkRect),
        rotationAtSign: signingPage.rotation,
      },
      newSignature,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign this page"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden overscroll-contain rounded-2xl border bg-background shadow-xl"
      >
        <ModalHeader step={step} onClose={cancelSign} />
        {step === 'rect' ? (
          <RectChooseStep
            page={signingPage}
            initialRect={chosenRect}
            instruction="Drag a rectangle on the page where the signature should go."
            confirmedInstruction="Placement chosen — drag again to adjust."
            onCancel={cancelSign}
            onContinue={handleContinue}
          />
        ) : (
          <SignatureDrawStep
            aspectRatio={rectAspectRatio}
            library={signatureLibrary}
            onBack={() => setStep('rect')}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  )
}

function ModalHeader({ step, onClose }: { step: SignatureStep; onClose: () => void }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">Sign this page</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {step === 'rect'
            ? 'Step 1 of 2 — choose where the signature goes.'
            : 'Step 2 of 2 — draw your signature.'}
        </p>
      </div>
      <button
        type="button"
        aria-label="Close"
        autoFocus
        onClick={onClose}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </header>
  )
}
