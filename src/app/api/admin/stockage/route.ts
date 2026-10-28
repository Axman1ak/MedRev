// /api/admin/stockage — migration des fichiers de Supabase Storage vers R2.
// Réservé au compte de Lou (ADMIN_ID).
//
// GET                         -> état : R2 activé ?, nombre de fichiers, combien déjà sur R2
// POST { action: 'cors' }     -> autorise medrev.fr à lire et envoyer sur le bucket
// POST { action: 'copy', offset } -> copie un lot de fichiers manquants sur R2
// POST { action: 'purge', offset } -> supprime de Supabase les fichiers déjà présents sur R2

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { r2Enabled, r2Exists, r2Put, r2SetCors } from '@/lib/r2'
import { MEDIA_BUCKET } from '@/lib/mediaServer'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ADMIN_ID = 'ac481ec0-abb7-49e2-b3e1-8907a4da5815'
const BATCH = 6

async function guard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_ID) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel')
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

// Tous les fichiers référencés par une fiche ou une annale.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function allPaths(admin: any): Promise<string[]> {
  const out = new Set<string>()
  const { data: les } = await admin.from('lessons').select('media')
  for (const l of les ?? []) {
    const m = ((l as { media?: Record<string, unknown> }).media ?? {}) as { pdf_path?: string; video_path?: string }
    if (m.pdf_path) out.add(m.pdf_path)
    if (m.video_path) out.add(m.video_path)
  }
  const { data: ann } = await admin.from('annales').select('pdf_path')
  for (const a of ann ?? []) { const p = (a as { pdf_path?: string }).pdf_path; if (p) out.add(p) }
  return Array.from(out).sort()
}

export async function GET() {
  try {
    const admin = await guard()
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    const paths = await allPaths(admin)
    if (!r2Enabled()) return NextResponse.json({ r2: false, total: paths.length, onR2: 0 })
    let onR2 = 0
    for (let i = 0; i < paths.length; i += 10) {
      const res = await Promise.all(paths.slice(i, i + 10).map(p => r2Exists(p).catch(() => false)))
      onR2 += res.filter(Boolean).length
    }
    return NextResponse.json({ r2: true, total: paths.length, onR2 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await guard()
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!r2Enabled()) return NextResponse.json({ error: 'R2 pas encore configuré dans Vercel' }, { status: 400 })
    const { action, offset = 0 } = (await req.json().catch(() => ({}))) as { action?: string; offset?: number }

    if (action === 'cors') {
      const status = await r2SetCors(['https://www.medrev.fr', 'https://medrev.fr', 'http://localhost:3000'])
      return NextResponse.json({ ok: status >= 200 && status < 300, status })
    }

    if (action === 'orphans') {
      // Fichiers encore sur Supabase mais rattachés à aucune fiche ni annale.
      const refs = new Set(await allPaths(admin))
      const found: string[] = []
      const walk = async (prefix: string, depth: number) => {
        const { data } = await admin.storage.from(MEDIA_BUCKET).list(prefix, { limit: 1000 })
        for (const e of data ?? []) {
          const full = prefix ? `${prefix}/${e.name}` : e.name
          if (e.id) found.push(full)            // un fichier
          else if (depth < 4) await walk(full, depth + 1) // un dossier
        }
      }
      await walk('', 0)
      const orphans = found.filter(p => !refs.has(p))
      if (orphans.length) await admin.storage.from(MEDIA_BUCKET).remove(orphans)
      return NextResponse.json({ total: orphans.length, next: orphans.length, done: true, report: orphans.map(p => ({ path: p, result: 'orphelin supprimé de Supabase' })) })
    }

    const paths = await allPaths(admin)
    const batch = paths.slice(offset, offset + BATCH)
    const report: { path: string; result: string }[] = []

    if (action === 'copy') {
      for (const p of batch) {
        try {
          if (await r2Exists(p)) { report.push({ path: p, result: 'déjà sur R2' }); continue }
          const { data, error } = await admin.storage.from(MEDIA_BUCKET).download(p)
          if (error || !data) { report.push({ path: p, result: 'introuvable sur Supabase' }); continue }
          await r2Put(p, await data.arrayBuffer(), data.type || (p.endsWith('.pdf') ? 'application/pdf' : 'video/mp4'))
          report.push({ path: p, result: 'copié' })
        } catch (e) {
          report.push({ path: p, result: 'erreur : ' + (e instanceof Error ? e.message : String(e)) })
        }
      }
    } else if (action === 'purge') {
      const ok: string[] = []
      for (const p of batch) {
        if (await r2Exists(p).catch(() => false)) ok.push(p)
        else report.push({ path: p, result: 'gardé (pas sur R2)' })
      }
      if (ok.length) await admin.storage.from(MEDIA_BUCKET).remove(ok)
      ok.forEach(p => report.push({ path: p, result: 'supprimé de Supabase' }))
    } else {
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
    }

    const next = offset + batch.length
    return NextResponse.json({ total: paths.length, next, done: next >= paths.length, report })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 })
  }
}
