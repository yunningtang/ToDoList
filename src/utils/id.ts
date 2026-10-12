export function uid(prefix = ''): string {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  return prefix ? `${prefix}_${s}` : s
}
