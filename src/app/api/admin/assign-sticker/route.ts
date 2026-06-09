import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { LIMITS, isValidStickerCode, isValidFilename } from '@/lib/validate'

const OWNER_EMAIL = process.env.OWNER_EMAIL
const MAPPING_PATH = path.join(process.cwd(), 'data', 'sticker-mapping.json')

let writeLock: Promise<void> = Promise.resolve()

async function readMapping(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(MAPPING_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > LIMITS.assignStickerBodyBytes) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const raw = await req.text()
  if (raw.length > LIMITS.assignStickerBodyBytes) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { stickerCode, filename } = body as Record<string, unknown>

  if (typeof stickerCode !== 'string' || !isValidStickerCode(stickerCode)) {
    return NextResponse.json({ error: 'Invalid stickerCode' }, { status: 400 })
  }

  if (filename !== null && filename !== undefined) {
    if (typeof filename !== 'string' || !isValidFilename(path.basename(filename))) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let writeError: Error | null = null
  const prevLock = writeLock
  let releaseLock!: () => void
  writeLock = new Promise<void>(res => { releaseLock = res })

  await prevLock
  try {
    const mapping = await readMapping()
    if (filename === null || filename === undefined) {
      delete mapping[stickerCode]
    } else {
      mapping[stickerCode] = path.basename(filename as string)
    }
    await writeFile(MAPPING_PATH, JSON.stringify(mapping, null, 2))
  } catch (e) {
    writeError = e instanceof Error ? e : new Error(String(e))
  } finally {
    releaseLock()
  }

  if (writeError) return NextResponse.json({ error: 'Failed to save mapping' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
