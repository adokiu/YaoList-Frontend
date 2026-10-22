const LOCK_CLASS = 'yaolist-scroll-lock'

const SCROLLABLE_SELECTOR = '[data-scroll-lock-allow]'

function isAllowedScrollTarget(target: EventTarget | null, allowSelector: string): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(allowSelector) !== null
}

export interface ScrollLockOptions {
  allowScrollSelector?: string
  inertRoot?: boolean
}

type SavedSnapshot = {
  scrollY: number
  htmlOverflow: string
  htmlOverflowX: string
  bodyOverflow: string
  bodyOverflowX: string
  bodyPaddingRight: string
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyRight: string
  bodyWidth: string
}

let lockCount = 0
let snapshot: SavedSnapshot | null = null
let preventScroll: ((e: Event) => void) | null = null

function applyLock() {
  const html = document.documentElement
  const body = document.body
  const root = document.getElementById('root')

  snapshot = {
    scrollY: window.scrollY,
    htmlOverflow: html.style.overflow,
    htmlOverflowX: html.style.overflowX,
    bodyOverflow: body.style.overflow,
    bodyOverflowX: body.style.overflowX,
    bodyPaddingRight: body.style.paddingRight,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width
  }

  html.classList.add(LOCK_CLASS)
  html.style.overflow = 'hidden'
  html.style.overflowX = 'hidden'
  body.style.overflow = 'hidden'
  body.style.overflowX = 'hidden'

  // 清掉历史版本可能残留的 fixed / padding，避免英文切换或重复加锁后右侧空白
  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.right = ''
  body.style.width = ''
  body.style.paddingRight = ''

  if (root) {
    root.inert = true
    root.setAttribute('aria-hidden', 'true')
  }
}

function releaseLock(inertRoot: boolean) {
  if (!snapshot) return

  const html = document.documentElement
  const body = document.body
  const root = document.getElementById('root')
  const { scrollY } = snapshot

  html.classList.remove(LOCK_CLASS)
  html.style.overflow = snapshot.htmlOverflow
  html.style.overflowX = snapshot.htmlOverflowX
  body.style.overflow = snapshot.bodyOverflow
  body.style.overflowX = snapshot.bodyOverflowX
  body.style.paddingRight = snapshot.bodyPaddingRight
  body.style.position = snapshot.bodyPosition
  body.style.top = snapshot.bodyTop
  body.style.left = snapshot.bodyLeft
  body.style.right = snapshot.bodyRight
  body.style.width = snapshot.bodyWidth

  if (inertRoot && root) {
    root.inert = false
    root.removeAttribute('aria-hidden')
  }

  window.scrollTo(0, scrollY)
  snapshot = null
}

export function lockPageScroll(options: ScrollLockOptions = {}): () => void {
  const { allowScrollSelector = SCROLLABLE_SELECTOR, inertRoot = true } = options

  if (lockCount === 0) {
    applyLock()

    preventScroll = (e: Event) => {
      if (isAllowedScrollTarget(e.target, allowScrollSelector)) return
      e.preventDefault()
    }

    document.addEventListener('wheel', preventScroll, { passive: false, capture: true })
    document.addEventListener('touchmove', preventScroll, { passive: false, capture: true })
  }

  lockCount += 1

  return () => {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return

    if (preventScroll) {
      document.removeEventListener('wheel', preventScroll, { capture: true })
      document.removeEventListener('touchmove', preventScroll, { capture: true })
      preventScroll = null
    }

    releaseLock(inertRoot)
  }
}

/** 修复旧版 scrollLock 残留的 body.fixed / padding（无活跃锁时） */
export function healStuckDocumentScrollStyles() {
  if (lockCount > 0) return

  const html = document.documentElement
  const body = document.body

  html.classList.remove(LOCK_CLASS)

  if (body.style.position === 'fixed' || body.style.paddingRight) {
    const top = body.style.top
    const scrollY = top ? Math.abs(parseInt(top, 10)) || 0 : window.scrollY
    body.style.position = ''
    body.style.top = ''
    body.style.left = ''
    body.style.right = ''
    body.style.width = ''
    body.style.paddingRight = ''
    html.style.paddingRight = ''
    window.scrollTo(0, scrollY)
  }

  const root = document.getElementById('root')
  if (root?.inert) {
    root.inert = false
    root.removeAttribute('aria-hidden')
  }
}
