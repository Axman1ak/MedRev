// src/app/api/import-fiches/route.ts
//
// Import de fiches : l'étudiant dépose le document qui liste ses cours
// (programme, plan du semestre : PDF, capture d'écran ou photo). On renvoie la
// liste des cours trouvés, chacun rangé dans une de ses matières si possible.
// Rien n'est créé ici : la page affiche la liste, l'étudiant valide, puis le
// client crée les fiches (sans J-0, « pas encore vues »).
//
// Corps : multipart/form-data avec `file` (PDF ou image, 4 Mo max à cause de
// la limite de corps des fonctions Vercel) et `systems` (JSON [{id, name}]).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_BYTES = 4 * 1024 * 1024
const OK_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Le fichier dépasse 4 Mo. Envoie une capture ou une version plus légère du document.' }, { status: 413 })
    const mimeType = file.type || 'application/pdf'
    if (!OK_TYPES.includes(mimeType)) return NextResponse.json({ error: 'Dépose un PDF ou une image (capture, photo).' }, { status: 400 })

    let systems: { id: string; name: string }[] = []
    try { systems = JSON.parse(String(form?.get('systems') ?? '[]')) } catch { systems = [] }
    systems = systems.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string').slice(0, 60)

    const data = Buffer.from(await file.arrayBuffer()).toString('base64')
    const matieres = systems.map(s => `- ${s.name}`).join('\n') || '(aucune matière créée pour l\'instant)'

    const prompt = `Ce document liste les cours d'un étudiant de première année de santé (PASS/LAS) : programme, plan de semestre, sommaire de polys, emploi du temps des cours…

VÉRIFICATION PRÉALABLE : si le document ne contient PAS une liste de cours (CV, facture, texte sans rapport, page illisible), réponds uniquement :
{"hors_sujet": true, "raison": "<ce que contient le document, en une courte phrase>"}

SINON, extrais chaque COURS du document : un cours = une leçon qu'on révisera comme une fiche (par exemple « Membre supérieur », « Enzymologie », « Optique géométrique »).
- "nom" : le titre du cours, court et propre (sans numéro de cours, sans date, sans nom d'enseignant, sans code d'UE). Garde la terminologie du document.
- "matiere" : la matière du cours. Si elle correspond à une des matières de l'étudiant ci-dessous, recopie EXACTEMENT son nom. Sinon, propose un nom de matière court (par exemple « Biochimie »).
- Garde l'ordre du document.
- N'inclus PAS : les TD, les examens, les dates seules, les titres d'UE ou de partie qui regroupent plusieurs cours, les introductions administratives.
- Pas de doublons.

Matières de l'étudiant :
${matieres}

RÉPONDS UNIQUEMENT en JSON valide, sans markdown :
{"cours": [{"nom": "...", "matiere": "..."}]}`

    const body = JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType, data } }, { text: prompt }] }],
      generationConfig: { maxOutputTokens: 8000, temperature: 0.1, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } },
    })
    let resp: Response | null = null
    for (let attempt = 0; attempt < 2 && !resp; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      })
      if (r.ok) resp = r
      else if ((r.status === 503 || r.status === 429 || r.status === 500) && attempt === 0) await new Promise(res => setTimeout(res, 1500))
      else if (r.status === 503 || r.status === 429) return NextResponse.json({ error: "L'IA est surchargée, réessaie dans une minute." }, { status: 503 })
      else throw new Error(`Gemini ${r.status}`)
    }
    if (!resp) return NextResponse.json({ error: "L'IA est surchargée, réessaie dans une minute." }, { status: 503 })

    const raw = (await resp.json())?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, '')) } catch { /* vide */ }
    if (parsed.hors_sujet === true) {
      const raison = clean(parsed.raison, 140).replace(/\.$/, '')
      return NextResponse.json({ error: `Ce document ne ressemble pas à une liste de cours${raison ? ` (${raison})` : ''}.`, code: 'not_a_list' }, { status: 422 })
    }

    const byName = new Map(systems.map(s => [norm(s.name), s.id]))
    const seen = new Set<string>()
    const cours = (Array.isArray(parsed.cours) ? parsed.cours : [])
      .map(c => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
      .map(c => {
        const nom = clean(c.nom, 120)
        const matiere = clean(c.matiere, 60)
        return { nom, matiere, system_id: byName.get(norm(matiere)) ?? null }
      })
      .filter(c => {
        if (!c.nom) return false
        const k = `${norm(c.matiere)}|${norm(c.nom)}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, 250)

    if (cours.length === 0) return NextResponse.json({ error: "Aucun cours trouvé dans ce document. Essaie avec le programme ou le plan du semestre." }, { status: 422 })
    return NextResponse.json({ cours })
  } catch (e) {
    console.error('[import-fiches]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur inconnue' }, { status: 500 })
  }
}
