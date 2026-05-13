import { useEffect } from 'react'

import type { ToastMessage } from '../hooks/useToast'

interface ToastProps {
  message: ToastMessage | null
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDismiss, 12000)
    return () => window.clearTimeout(t)
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div
      role="status"
      className="pointer-events-auto fixed bottom-24 left-1/2 z-[2000] flex max-w-[min(520px,calc(100vw-32px))] -translate-x-1/2 items-start gap-3 rounded-lg border border-[#E0E0E0] bg-white px-4 py-3 font-sans text-sm text-[#212121] shadow-[0_2px_8px_rgba(0,0,0,0.12)] md:bottom-8"
    >
      <span
        className={
          message.kind === 'error' ? 'mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#E53935]' : 'mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#00796B]'
        }
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 leading-snug">{message.text}</p>
        {message.actionLabel && message.onAction ? (
          <button
            type="button"
            className="map-ui-focus mt-2 rounded px-2 py-1 text-sm font-medium text-[#00796B] hover:bg-[#E0F2F1]"
            onClick={() => {
              message.onAction?.()
              onDismiss()
            }}
          >
            {message.actionLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="map-ui-focus shrink-0 rounded px-2 py-0.5 text-[#757575] hover:bg-[#F5F5F5]"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
