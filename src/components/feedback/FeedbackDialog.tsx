import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Modal, fieldClassName } from '@/components/ui/Modal'

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('sending')
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(
          Array.from(data.entries(), ([key, value]) => [key, String(value)]),
        ).toString(),
      })
      if (!response.ok) throw new Error(`Feedback submission failed (${response.status}).`)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <Modal
      title="Send feedback"
      description="Tell us what worked, what was confusing, or what the machine should do next."
      onClose={onClose}
    >
      {status === 'sent' ? (
        <div className="rounded-xl border bg-muted/40 p-6 text-center">
          <p className="font-medium">Thanks—your feedback was sent.</p>
          <Button className="mt-4" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form
          name="feedback"
          method="POST"
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          onSubmit={(event) => void submit(event)}
          className="space-y-4"
        >
          <input type="hidden" name="form-name" value="feedback" />
          <p hidden><label>Do not fill this out: <input name="bot-field" /></label></p>
          <label className="block text-xs font-medium text-muted-foreground">
            Feedback type
            <select className={`${fieldClassName} mt-1`} name="category" defaultValue="suggestion">
              <option value="suggestion">Feature suggestion</option>
              <option value="problem">Something went wrong</option>
              <option value="praise">Something worked well</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Email (optional)
            <input className={`${fieldClassName} mt-1`} name="email" type="email" autoComplete="email" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Your feedback
            <textarea
              className="mt-1 min-h-32 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              name="message"
              required
              maxLength={4000}
            />
          </label>
          {status === 'error' && (
            <p className="text-sm text-destructive">Could not send feedback. Please check your connection and try again.</p>
          )}
          <footer className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send feedback'}
            </Button>
          </footer>
        </form>
      )}
    </Modal>
  )
}
