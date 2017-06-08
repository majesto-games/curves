
export function JsonSafeParse<T>(s: string | null | undefined, onFail: any): T {
  if (s != null) {
    try {
      return JSON.parse(s)
    } catch (_) {
      // fall through to return onFail
    }
  }
  return onFail
}

interface FullscreenElement extends HTMLElement {
  requestFullscreen: () => void
  mozRequestFullScreen: () => void
  webkitRequestFullscreen: () => void
  msRequestFullscreen: () => void
}

export function requestFullscreen(element: FullscreenElement = document.documentElement as FullscreenElement) {
  if (element.requestFullscreen) {
    element.requestFullscreen()
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen()
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen()
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen()
  }
}

export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
