// POST /api/media/sign  { op: 'get' | 'put', path, contentType? }
//
// Donne au navigateur une URL temporaire pour lire ou envoyer un fichier de
// fiche sur R2. Seulement pour ses propres fichiers (chemin qui commence par
// son id). Réponse { url } ou { backend: 'supabase' } quand R2 n'est pas
// activé, ou que le fichier demandé n'y est pas encore (migration en cours).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { r2Enabled, r2Exists, r2SignedUrl } from '@/lib/r2'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { op, path } = (await req.json().catch(() => ({}))) as { op?: string; path?: string }
  if (!path || (op !== 'get' && op !== 'put')) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  if (!r2Enabled()) return NextResponse.json({ backend: 'supabase' })
  if (op === 'get' && !(await r2Exists(path).catch(() => false))) return NextResponse.json({ backend: 'supabase' })
  const url = await r2SignedUrl(op === 'get' ? 'GET' : 'PUT', path, op === 'get' ? 3600 : 900)
  return NextResponse.json({ backend: 'r2', url })
}
