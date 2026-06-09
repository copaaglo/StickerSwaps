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
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: mapDbError(error) }, { status: 400 })
  return NextResponse.redirect(new URL('/trades', req.url))
}
