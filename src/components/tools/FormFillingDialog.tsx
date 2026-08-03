import { useMemo, useState } from 'react'
import { usePdfToolkit } from '@/coordinator/toolkitContext'
import type { FormFieldDescriptor, FormFieldValue, FormValuesBySource } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Modal, fieldClassName } from '@/components/ui/Modal'

export function FormFillingDialog({ onClose }: { onClose: () => void }) {
  const { getFormFields, getSourceName, formValues, setFormValues } = usePdfToolkit()
  const fields = useMemo(() => getFormFields(), [getFormFields])
  const [draft, setDraft] = useState<FormValuesBySource>(() => seedValues(fields, formValues))
  const sourceIds = [...new Set(fields.map((field) => field.sourceId))]

  const setValue = (field: FormFieldDescriptor, value: FormFieldValue) => {
    setDraft((previous) => ({
      ...previous,
      [field.sourceId]: { ...previous[field.sourceId], [field.name]: value },
    }))
  }

  return (
    <Modal
      title="Fill existing PDF forms"
      description="Supported fields are filled locally and flattened during export so they look the same in every reader."
      onClose={onClose}
    >
      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No supported AcroForm fields were found in the loaded PDFs.
        </div>
      ) : (
        <div className="space-y-5">
          {sourceIds.map((sourceId) => (
            <section key={sourceId}>
              <h3 className="mb-2 text-sm font-semibold">{getSourceName(sourceId) ?? 'PDF form'}</h3>
              <div className="space-y-3 rounded-xl border p-4">
                {fields.filter((field) => field.sourceId === sourceId).map((field) => (
                  <FormFieldControl
                    key={field.name}
                    field={field}
                    value={draft[sourceId]?.[field.name] ?? field.value}
                    onChange={(value) => setValue(field, value)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        XFA forms and cryptographic signature fields are not changed. Flattening makes filled fields non-editable in the exported copy.
      </p>
      <footer className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          disabled={fields.length === 0}
          onClick={() => {
            setFormValues(draft)
            onClose()
          }}
        >
          Save form values
        </Button>
      </footer>
    </Modal>
  )
}

function FormFieldControl({
  field,
  value,
  onChange,
}: {
  field: FormFieldDescriptor
  value: FormFieldValue
  onChange: (value: FormFieldValue) => void
}) {
  if (field.kind === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value === true}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.name}
      </label>
    )
  }
  if (field.kind === 'radio' || field.kind === 'dropdown') {
    return (
      <label className="block text-xs font-medium text-muted-foreground">
        {field.name}
        <select
          className={`${fieldClassName} mt-1`}
          value={typeof value === 'string' ? value : ''}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">—</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    )
  }
  if (field.kind === 'option-list') {
    return (
      <label className="block text-xs font-medium text-muted-foreground">
        {field.name}
        <select
          className={`${fieldClassName} mt-1 h-24 py-2`}
          multiple
          value={Array.isArray(value) ? value : []}
          disabled={field.readOnly}
          onChange={(event) =>
            onChange(Array.from(event.target.selectedOptions, (option) => option.value))
          }
        >
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    )
  }
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {field.name}
      <input
        className={`${fieldClassName} mt-1`}
        value={typeof value === 'string' ? value : ''}
        readOnly={field.readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function seedValues(
  fields: FormFieldDescriptor[],
  existing: FormValuesBySource,
): FormValuesBySource {
  const result: FormValuesBySource = structuredClone(existing)
  for (const field of fields) {
    result[field.sourceId] ??= {}
    result[field.sourceId][field.name] ??= field.value
  }
  return result
}
