import { useSyncExternalStore } from 'react'

export type Toast = { id: number; message: string }

let current: Toast | null = null
let nextId = 1
let timer: number | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function showToast(message: string, duration = 1600) {
  current = { id: nextId++, message }
  emit()
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    current = null
    timer = undefined
    emit()
  }, duration)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useToast() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
}

export async function copyText(value: string, label = 'Copied'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    showToast(label)
    return true
  } catch {
    showToast('Copy failed - clipboard blocked')
    return false
  }
}
