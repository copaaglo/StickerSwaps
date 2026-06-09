import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isValidUUID } from '@/lib/validate'
import { mapDbError } from '@/lib/errors'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid trade ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('trades')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['accepted'])
    .or(`proposer_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (error) return NextResponse.json({ error: mapDbError(error) }, { status: 400 })
  return NextResponse.redirect(new URL('/trades', req.url))
}
