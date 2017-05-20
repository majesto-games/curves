
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
