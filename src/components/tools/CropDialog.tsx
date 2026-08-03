import { useMemo, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import type { NormalizedRect } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Modal, fieldClassName } from '@/components/ui/Modal'

type MarginKey = 'top' | 'right' | 'bottom' | 'left'

export function CropDialog({ onClose }: { onClose: () => void }) {
  const { pages, selection, cropPages } = usePdfToolkit()
  const [margins, setMargins] = useState<Record<MarginKey, number>>({ top: 0, right: 0, bottom: 0, left: 0 })
  const [scope, setScope] = useState<'selected' | 'all'>(selection.count > 0 ? 'selected' : 'all')
  const targetIds = useMemo(
    () =>
      scope === 'selected'
        ? pages.filter((page) => selection.selectedIds.has(page.id)).map((page) => page.id)
        : pages.map((page) => page.id),
    [scope, pages, selection.selectedIds],
  )
  const valid = margins.left + margins.right < 95 && margins.top + margins.bottom < 95

  const update = (key: MarginKey, value: number) =>
    setMargins((previous) => ({ ...previous, [key]: Math.min(45, Math.max(0, value || 0)) }))

  const apply = () => {
    if (!valid || targetIds.length === 0) return
    const rect: NormalizedRect = {
      x: margins.left / 100,
      y: margins.top / 100,
      width: 1 - (margins.left + margins.right) / 100,
      height: 1 - (margins.top + margins.bottom) / 100,
    }
    cropPages(targetIds, rect)
    onClose()
  }

  return (
    <Modal
      title="Crop page margins"
      description="Crop is non-destructive: export changes the visible page box without rasterizing its content."
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['top', 'right', 'bottom', 'left'] as const).map((key) => (
          <label key={key} className="text-xs font-medium capitalize text-muted-foreground">
            {key} %
            <input
              className={`${fieldClassName} mt-1`}
              type="number"
              min="0"
              max="45"
              step="0.5"
              value={margins[key]}
              onChange={(event) => update(key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[2.5, 5, 10].map((value) => (
          <Button
            key={value}
            size="sm"
            variant="outline"
            onClick={() => setMargins({ top: value, right: value, bottom: value, left: value })}
          >
            Trim {value}% all sides
          </Button>
        ))}
      </div>

      <fieldset className="mt-5 flex flex-wrap gap-4 text-sm">
        <legend className="mb-2 font-medium">Apply to</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={scope === 'selected'}
            disabled={selection.count === 0}
            onChange={() => setScope('selected')}
          />
          Selected pages ({selection.count})
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />
          All pages ({pages.length})
        </label>
      </fieldset>

      {!valid && <p className="mt-3 text-sm text-destructive">Opposite margins leave no visible page area.</p>}
      <footer className="mt-5 flex flex-wrap justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            cropPages(targetIds, null)
            onClose()
          }}
        >
          Clear crop
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || targetIds.length === 0} onClick={apply}>Apply crop</Button>
        </div>
      </footer>
    </Modal>
  )
}
