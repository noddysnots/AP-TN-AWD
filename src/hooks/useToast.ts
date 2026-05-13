import { useCallback, useState } from 'react'

export type ToastKind = 'error' | 'info'

export interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
  actionLabel?: string
  onAction?: () => void
}

let toastId = 0

export function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null)

  const show = useCallback((partial: Omit<ToastMessage, 'id'>) => {
    toastId += 1
    setMessage({ ...partial, id: toastId })
  }, [])

  const dismiss = useCallback(() => setMessage(null), [])

  return { message, show, dismiss }
}
