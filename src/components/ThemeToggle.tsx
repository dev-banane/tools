import { useSyncExternalStore } from 'react'
import { Icon } from './Icon'

declare global {
  interface Window {
    __applyTheme?: (theme: string) => void
  }
}

function getThemeSnapshot() {
  return document.documentElement.getAttribute('data-theme') ?? 'dark'
}

function subscribeTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  return () => observer.disconnect()
}

function applyTheme(next: string) {
  localStorage.setItem('theme', next)
  window.__applyTheme?.(next)
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => 'dark')
  const isDark = theme === 'dark'

  function toggle() {
    const next = isDark ? 'light' : 'dark'

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const supportsViewTransition = 'startViewTransition' in document

    if (reduceMotion || !supportsViewTransition) {
      applyTheme(next)
      return
    }

    const transition = (
      document as Document & {
        startViewTransition: (cb: () => void) => { ready: Promise<void> }
      }
    ).startViewTransition(() => applyTheme(next))

    transition.ready.then(() => {
      const endRadius = Math.hypot(window.innerWidth, window.innerHeight)
      const origin = next === 'light' ? '100% 0%' : '0% 100%'
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0% at ${origin})`,
            `circle(${endRadius}px at ${origin})`,
          ],
        },
        {
          duration: 650,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={toggle}
    >
      <Icon name="sun-03" className="theme-toggle__icon theme-toggle__icon--sun" size={16} />
      <Icon name="moon-02" className="theme-toggle__icon theme-toggle__icon--moon" size={16} />
    </button>
  )
}
