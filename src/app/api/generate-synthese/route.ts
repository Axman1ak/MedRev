// src/app/api/generate-synthese/route.ts
//
// Fiche de synthèse d'une fiche : un rappel COURT du cours, à lire en début de
// révision (étape « Relire » de la session de travail). Même pour un poly de
// 80 pages, elle reste petite. Sa forme s'adapte au cours : les idées
// essentielles, puis les blocs qui conviennent (étapes d'un mécanisme,
// tableau comparatif, notions, valeurs à connaître, pièges), chaque élément
// renvoyant à sa page. Le reste, c'est le poly.
//
// Sources : le PDF (inline ou Files API) et/ou le transcript de la vidéo.
// Pas d'envoi de la vidéo brute (trop cher pour un résumé) : sans transcript,
// une fiche vidéo seule doit d'abord être transcrite.
//
// Résultat stocké dans lessons.media.synthese (jsonb, aucune migration).

import { monthlyLimit, usedThisMonth, quotaExceeded } from '@/lib/quotas'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LessonSynthese } from '@/types'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const PDF_INLINE_THRESHOLD = 18 * 1024 * 1024

type GeminiFile = { name: string; uri: string; mimeType: string; state: string }

async function uploadPdfToGemini(blob: Blob): Promise<GeminiFile> {
  const init = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(blob.size),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'poly.pdf' } }),
  })
  if (!init.ok) throw new Error(`Gemini upload init failed (${init.status})`)
  const uploadUrl = init.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) throw new Error('Pas de X-Goog-Upload-URL')
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Length': String(blob.size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: await blob.arrayBuffer(),
  })
  if (!up.ok) throw new Error(`Gemini upload failed (${up.status})`)
  let file = (await up.json()).file as GeminiFile
  const t0 = Date.now()
  while (file.state !== 'ACTIVE' && Date.now() - t0 < 30000) {
    if (file.state === 'FAILED') throw new Error('Gemini file processing failed')
    await new Promise(r => setTimeout(r, 2500))
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${GEMINI_API_KEY}`)
    if (r.ok) file = (await r.json()) as GeminiFile
  }
  if (file.state !== 'ACTIVE') throw new Error('Gemini file processing timeout')
  return file
}

function formatTs(s: number): string {
  const t = Math.floor(s)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// ---- Nettoyage de la réponse : on borne tout, on jette ce qui est mal formé ----
type Item = { texte: string; page?: number }
type Synthese = LessonSynthese

// On ne coupe jamais au milieu d'une phrase : la limite est large, et si elle
// est dépassée on s'arrête à la dernière fin de phrase (ou au dernier mot).
function clip(t: string, max: number): string {
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  if (end > max * 0.5) return cut.slice(0, end + 1)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…'
}
const str = (v: unknown, max = 600) => (typeof v === 'string' ? clip(v.replace(/\s+/g, ' ').trim(), max) : '')
const page = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 1 && v < 2000 ? Math.round(v) : undefined)
const items = (v: unknown, max: number): Item[] =>
  (Array.isArray(v) ? v : [])
    .map(x => (x && typeof x === 'object' ? { texte: str((x as Record<string, unknown>).texte), page: page((x as Record<string, unknown>).page) } : { texte: str(x) }))
    .filter(x => x.texte)
    .slice(0, max)

function sanitize(raw: Record<string, unknown>): Synthese | null {
  const essentiel = items(raw.essentiel, 7)
  const pieges = items(raw.pieges, 4)
  let tableau: Synthese['tableau']
  const t = raw.tableau as Record<string, unknown> | undefined
  if (t && Array.isArray(t.colonnes) && Array.isArray(t.lignes)) {
    const colonnes = t.colonnes.map(c => str(c, 60)).filter(Boolean).slice(0, 4)
    const lignes = t.lignes
      .filter(Array.isArray)
      .map(l => (l as unknown[]).slice(0, colonnes.length).map(c => str(c, 240)))
      .filter(l => l.length === colonnes.length && l.every(Boolean))
      .slice(0, 8)
    if (colonnes.length >= 2 && lignes.length >= 2) tableau = { titre: str(t.titre, 80) || undefined, colonnes, lignes }
  }
  let liste: Synthese['liste']
  if (Array.isArray(raw.liste)) {
    liste = (raw.liste as unknown[])
      .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {}))
      .map(x => ({ terme: str(x.terme, 80), detail: str(x.detail, 320), page: page(x.page) }))
      .filter(x => x.terme && x.detail)
      .slice(0, 8)
    if (liste.length === 0) liste = undefined
  }
  let etapes: Synthese['etapes']
  const e = raw.etapes as Record<string, unknown> | undefined
  if (e && typeof e === 'object') {
    const its = items(e.items, 8)
    if (its.length >= 2) etapes = { titre: str(e.titre, 80) || undefined, items: its }
  }
  let chiffres: Synthese['chiffres']
  if (Array.isArray(raw.chiffres)) {
    chiffres = (raw.chiffres as unknown[])
      .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {}))
      .map(x => ({ valeur: str(x.valeur, 40), sens: str(x.sens, 200), page: page(x.page) }))
      .filter(x => x.valeur && x.sens)
      .slice(0, 6)
    if (chiffres.length === 0) chiffres = undefined
  }
  if (essentiel.length === 0) return null
  return { essentiel, tableau, liste, listeTitre: str(raw.listeTitre, 80) || undefined, etapes, chiffres, pieges, generated_at: new Date().toISOString() }
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { lessonId } = (await req.json().catch(() => ({}))) as { lessonId?: string }
    if (!lessonId) return NextResponse.json({ error: 'lessonId requis' }, { status: 400 })

    const { data: lesson } = await supabase.from('lessons').select('id, name, user_id, media').eq('id', lessonId).single()
    if (!lesson) return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
    if (lesson.user_id !== user.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    // Limite mensuelle (bêta) : voir src/lib/quotas.ts
    const { data: profile } = await supabase.from('profiles').select('plan, usage').eq('id', user.id).single()
    const limit = monthlyLimit(profile?.plan, 'synthese')
    const used = profile ? usedThisMonth(profile, 'synthese') : 0
    if (used >= limit) return NextResponse.json(quotaExceeded('synthese', used, limit), { status: 403 })

    const media = (lesson.media ?? {}) as Record<string, unknown> & {
      pdf_path?: string
      transcript?: { start: number; end: number; text: string }[]
    }
    const hasTranscript = Array.isArray(media.transcript) && media.transcript.length > 0
    if (!media.pdf_path && !hasTranscript) {
      return NextResponse.json(
        { error: media.video_path ? 'La vidéo doit d\'abord être transcrite (bouton dans la fiche).' : 'Ajoute le poly ou la vidéo du cours à la fiche.', code: 'no_source' },
        { status: 400 },
      )
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } } | { fileData: { mimeType: string; fileUri: string } }> = []
    if (media.pdf_path) {
      const { data: blob, error } = await supabase.storage.from('lesson-media').download(media.pdf_path)
      if (error || !blob) return NextResponse.json({ error: 'PDF introuvable' }, { status: 500 })
      if (blob.size < PDF_INLINE_THRESHOLD) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: Buffer.from(await blob.arrayBuffer()).toString('base64') } })
      } else {
        const f = await uploadPdfToGemini(blob)
        parts.push({ fileData: { mimeType: f.mimeType, fileUri: f.uri } })
      }
    }
    if (hasTranscript) {
      parts.push({ text: 'TRANSCRIPT DE LA VIDÉO DU COURS :\n\n' + media.transcript!.map(s => `[${formatTs(s.start)}] ${s.text}`).join('\n') })
    }

    parts.push({ text: `Tu prépares une FICHE DE SYNTHÈSE pour une étudiante de première année de médecine (PASS/LAS). Sujet de la fiche : "${lesson.name}".

Tous les cours sont acceptés, quelle que soit la matière (santé, sciences, droit, économie, sciences humaines…). Ne refuse QUE si les sources sont vides ou illisibles ; dans ce seul cas, réponds uniquement :
{"hors_sujet": true, "raison": "<ce que contient le document, en une courte phrase>"}

BUT : un rappel qu'on lit en deux minutes AVANT de s'entraîner, pour avoir la STRUCTURE du cours en tête. Couvre tout le poly, du début à la fin.

ADAPTE LA FORME AU COURS. Chaque cours est différent : choisis les blocs qui le rendent le plus clair, et seulement ceux-là. Deux cours différents ne doivent pas forcément avoir la même forme.
- "essentiel" (toujours) : les grandes idées, dans l'ordre du poly. De 2 idées pour un cours court à 6 pour un cours long. Chaque idée est une phrase COMPLÈTE et courte (25 mots maximum), qui se termine par un point.
- "etapes" : si le cours décrit un mécanisme, une voie, un déroulé ou une démarche dans l'ordre (ex. glycolyse, potentiel d'action, embryologie, démarche diagnostique). Un titre court et 3 à 8 étapes courtes.
- "tableau" : si le cours compare des catégories (ex. types de tissus, classes de médicaments, nerfs et leurs territoires). Un titre court, 2 à 4 colonnes, 3 à 8 lignes, des mots-clés plutôt que des phrases.
- "liste" : si le cours repose sur des définitions ou des notions clés. 3 à 8 notions, chacune avec un "terme" et un "detail" d'une phrase complète. Un "listeTitre" court si utile (ex. "Les notions à connaître").
- "chiffres" : seulement si le cours contient des valeurs à connaître par cœur (normes, constantes, seuils, dates). 2 à 6 valeurs, chacune avec sa "valeur" (ex. "70 mV") et son "sens" (ce qu'elle représente).
- "pieges" : 1 à 3 confusions classiques, chacune en une ou deux phrases complètes qui donnent la bonne version. Omets-les s'il n'y en a pas de vraies.
En général 2 ou 3 blocs en plus de "essentiel" suffisent. Ne remplis jamais un bloc pour le principe.

RÈGLES :
- Uniquement tiré des sources, rien de tes connaissances propres.
- Ne coupe jamais une phrase : chaque texte est une phrase entière et finie.
- "page" : numéro de page DANS LE FICHIER PDF (1 = première page) d'où vient l'information, quand c'est clair. Sinon omets-le.
- Français rigoureux, phrases courtes, pas de tiret cadratin, pas de point médian.

RÉPONDS UNIQUEMENT en JSON valide, sans markdown, avec seulement les blocs choisis :
{
  "essentiel": [{"texte": "...", "page": 4}],
  "etapes": {"titre": "...", "items": [{"texte": "...", "page": 5}]},
  "tableau": {"titre": "...", "colonnes": ["...", "..."], "lignes": [["...", "..."]]},
  "listeTitre": "...",
  "liste": [{"terme": "...", "detail": "...", "page": 8}],
  "chiffres": [{"valeur": "...", "sens": "...", "page": 9}],
  "pieges": [{"texte": "...", "page": 12}]
}` })

    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 8000, temperature: 0.3, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } },
    })
    let resp: Response | null = null
    for (let attempt = 0; attempt < 2 && !resp; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      })
      if (r.ok) resp = r
      else if ((r.status === 503 || r.status === 429 || r.status === 500) && attempt === 0) await new Promise(res => setTimeout(res, 1500))
      else if (r.status === 503 || r.status === 429) {
        return NextResponse.json({ error: "L'IA est surchargée, réessaie dans une minute.", code: 'ai_overloaded' }, { status: 503 })
      } else throw new Error(`Gemini ${r.status}`)
    }
    if (!resp) return NextResponse.json({ error: "L'IA est surchargée, réessaie dans une minute.", code: 'ai_overloaded' }, { status: 503 })

    const raw = (await resp.json())?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, '')) } catch { /* vide */ }
    if (parsed.hors_sujet === true) {
      const raison = str(parsed.raison, 140)
      return NextResponse.json(
        { error: `Impossible de lire ce document${raison ? ` (${raison.replace(/\.$/, '')})` : ''}. Vérifie qu'il contient bien du texte.`, code: 'not_a_course' },
        { status: 422 },
      )
    }
    const synthese = sanitize(parsed)
    if (!synthese) return NextResponse.json({ error: 'La synthèse n\'a pas pu être générée, réessaie.' }, { status: 502 })

    const { error: upErr } = await supabase.from('lessons').update({ media: { ...media, synthese } }).eq('id', lesson.id)
    if (upErr) throw upErr
    // Comptée seulement une fois la synthèse enregistrée.
    await supabase.rpc('try_use_quota', { kind: 'synthese', monthly_limit: limit }).then(() => {}, () => {})
    return NextResponse.json({ synthese })
  } catch (e) {
    console.error('[generate-synthese]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur inconnue' }, { status: 500 })
  }
}
