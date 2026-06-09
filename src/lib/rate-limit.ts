interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000).unref()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { limited: false, remaining: limit - entry.count, resetAt: entry.resetAt }
}
