import { useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import type { ExportDecorations } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Modal, fieldClassName } from '@/components/ui/Modal'

export function DecorationsDialog({ onClose }: { onClose: () => void }) {
  const { exportDecorations, setExportDecorations } = usePdfToolkit()
  const [draft, setDraft] = useState<ExportDecorations>(exportDecorations)

  const save = () => {
    setExportDecorations(draft)
    onClose()
  }

  return (
    <Modal
      title="Page numbers & watermark"
      description="These document-wide stamps are added locally when you export."
      onClose={onClose}
    >
      <section className="rounded-xl border p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.pageNumbers.enabled}
            onChange={(event) =>
              setDraft({ ...draft, pageNumbers: { ...draft.pageNumbers, enabled: event.target.checked } })
            }
          />
          Add page numbers
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Format">
            <select
              className={fieldClassName}
              value={draft.pageNumbers.format}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  pageNumbers: { ...draft.pageNumbers, format: event.target.value as 'number' | 'page-of-total' },
                })
              }
            >
              <option value="number">1, 2, 3</option>
              <option value="page-of-total">Page 1 of 3</option>
            </select>
          </Field>
          <Field label="Start at">
            <input
              className={fieldClassName}
              type="number"
              min="0"
              value={draft.pageNumbers.startAt}
              onChange={(event) =>
                setDraft({ ...draft, pageNumbers: { ...draft.pageNumbers, startAt: Number(event.target.value) || 0 } })
              }
            />
          </Field>
          <Field label="Position">
            <select
              className={fieldClassName}
              value={draft.pageNumbers.position}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  pageNumbers: {
                    ...draft.pageNumbers,
                    position: event.target.value as ExportDecorations['pageNumbers']['position'],
                  },
                })
              }
            >
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-center">Bottom center</option>
              <option value="bottom-right">Bottom right</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="mt-4 rounded-xl border p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.watermark.enabled}
            onChange={(event) =>
              setDraft({ ...draft, watermark: { ...draft.watermark, enabled: event.target.checked } })
            }
          />
          Add text watermark
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field label="Watermark text">
            <input
              className={fieldClassName}
              value={draft.watermark.text}
              maxLength={120}
              onChange={(event) =>
                setDraft({ ...draft, watermark: { ...draft.watermark, text: event.target.value } })
              }
              placeholder="CONFIDENTIAL"
            />
          </Field>
          <Field label="Opacity">
            <input
              className={fieldClassName}
              type="number"
              min="0.05"
              max="0.8"
              step="0.05"
              value={draft.watermark.opacity}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  watermark: {
                    ...draft.watermark,
                    opacity: Math.min(0.8, Math.max(0.05, Number(event.target.value) || 0.18)),
                  },
                })
              }
            />
          </Field>
        </div>
      </section>

      <footer className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save export stamps</Button>
      </footer>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}{<span className="mt-1 block">{children}</span>}</label>
}
