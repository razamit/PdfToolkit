import type { ReactNode } from 'react'

/**
 * Shared chrome for a tool's panel inside the editing session: the page area
 * on top, one footer strip below. Every tool uses these two so the session
 * chrome cannot drift apart tool by tool, which is what happened when each
 * tool owned a whole modal of its own.
 */
export function EditorPanel({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col">
      {children}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        {footer}
      </footer>
    </div>
  )
}

/** Left-hand side of a footer: the tool's own controls, then its hint text. */
export function EditorHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
