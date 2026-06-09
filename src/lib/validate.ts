export const LIMITS = {
  username: { min: 3, max: 20 },
  fullName: 100,
  bio: 500,
  email: 254,
  password: { min: 8, max: 72 },
  locationCity: 100,
  tradeMessage: 500,
  chatMessage: 1000,
  stickerCode: 10,
  filename: 100,
  maxStickersPerSide: 20,
  assignStickerBodyBytes: 2048,
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STICKER_CODE_RE = /^[A-Z]{2,4}_\d{1,3}$/
const FILENAME_RE = /^[A-Za-z0-9_\-]+\.[A-Za-z]{2,5}$/
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export function isValidUUID(val: string): boolean {
  return UUID_RE.test(val)
}

export function isValidStickerCode(val: string): boolean {
  return STICKER_CODE_RE.test(val)
}

export function isValidFilename(val: string): boolean {
  return val.length <= LIMITS.filename && FILENAME_RE.test(val)
}

export function isSafeRedirect(path: string): boolean {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
}

export function isValidUsername(val: string): boolean {
  return USERNAME_RE.test(val)
}
