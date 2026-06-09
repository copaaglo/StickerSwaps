import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CollectionClient } from './CollectionClient'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

const OWNER_EMAIL = process.env.OWNER_EMAIL
const MAPPING_PATH = path.join(process.cwd(), 'data', 'sticker-mapping.json')

export default async function CollectionPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  const user = session.user

  const isOwner = user.email === OWNER_EMAIL

  const [stickersRes, userStickersRes, mappingContent] = await Promise.all([
    supabase.from('stickers').select('*').order('id'),
    supabase.from('user_stickers').select('*').eq('user_id', user.id),
    readFile(MAPPING_PATH, 'utf-8').catch(() => '{}'),
  ])

  const stickerMapping: Record<string, string> = JSON.parse(mappingContent)

  let imageFiles: string[] = []
  if (isOwner) {
    const all = await readdir(path.join(process.cwd(), 'public', 'stickers'))
    imageFiles = all.filter(f => f.endsWith('.jpg')).sort()
  }

  return (
    <CollectionClient
      userId={user.id}
      stickers={stickersRes.data ?? []}
      userStickers={userStickersRes.data ?? []}
      stickerMapping={stickerMapping}
      isOwner={isOwner}
      imageFiles={imageFiles}
    />
  )
}
