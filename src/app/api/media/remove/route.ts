// POST /api/media/remove  { paths: string[] }
// Supprime des fichiers de fiche (R2 et Supabase Storage). Seulement les siens.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { removeMedia } from '@/lib/mediaServer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { paths } = (await req.json().catch(() => ({}))) as { paths?: unknown }
  const list = (Array.isArray(paths) ? paths : []).filter((p): p is string => typeof p === 'string' && p.startsWith(`${user.id}/`) && !p.includes('..'))
  await removeMedia(supabase, list)
  return NextResponse.json({ removed: list.length })
}
