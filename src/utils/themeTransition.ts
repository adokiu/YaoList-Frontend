import { flushSync } from 'react-dom'

export type ThemeTransitionOrigin = { x: number; y: number }

const THEME_SWITCH_CLASS = 'theme-switching'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function transitionRadius(origin: ThemeTransitionOrigin): number {
  const { innerWidth: w, innerHeight: h } = window
  return Math.hypot(
    Math.max(origin.x, w - origin.x),
    Math.max(origin.y, h - origin.y),
  )
}

/**
 * 从点击位置圆形扩散切换主题，避免各卡片 transition: all 造成的抖动。
 */
export function applyThemeTransition(apply: () => void, origin?: ThemeTransitionOrigin): void {
  const doc = document.documentElement
  const startViewTransition = (document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> }
  }).startViewTransition

  if (prefersReducedMotion() || typeof startViewTransition !== 'function') {
    apply()
    return
  }

  const point: ThemeTransitionOrigin = origin ?? {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }
  const radius = transitionRadius(point)

  doc.classList.add(THEME_SWITCH_CLASS)

  const transition = startViewTransition.call(document, () => {
    flushSync(apply)
  })

  transition.ready
    .then(() => {
      doc.animate(
        {
          clipPath: [
            `circle(0px at ${point.x}px ${point.y}px)`,
            `circle(${radius}px at ${point.x}px ${point.y}px)`,
          ],
        },
        {
          duration: 520,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    .catch(() => {})

  transition.finished.finally(() => {
    doc.classList.remove(THEME_SWITCH_CLASS)
  })
}
