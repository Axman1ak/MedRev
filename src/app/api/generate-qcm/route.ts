// src/app/api/generate-qcm/route.ts
//
// Génère des QCM depuis les sources (vidéo + PDF) d'une fiche.
// - Authentifie via le cookie Supabase (RLS check ownership)
// - Lit lessons.media → télécharge les fichiers depuis Storage
// - Envoie à Gemini Flash : PDF inline (si < 18 Mo) + vidéo via Files API
// - Demande à Gemini un source_ref par question { pdf_page?, video_ts? }
// - Sauvegarde le résultat dans lessons.ai_questions
//
// ⚠ Plan Vercel : nécessite Pro pour avoir maxDuration > 10s.
//   Vidéos > 100 Mo → erreur "vidéo trop lourde" pour MVP.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_GEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const GEMINI_FILES_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`
const GEMINI_FILE_GET_URL = (name: string) =>
  `https://generativelanguage.googleapis.com/v1beta/${name}?key=${GEMINI_API_KEY}`

// Limite vidéo (Vercel serverless memory + Gemini upload time)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024  // 100 Mo
const PDF_INLINE_THRESHOLD = 18 * 1024 * 1024  // 18 Mo (limite Gemini inline = 20 Mo total req)

const FORMAT_DESC: Record<string, string> = {
  mixed: 'un mélange équilibré de QCM classiques (4 options A/B/C/D), KFP (vignette clinique courte + questions liées) et Vrai/Faux raisonnés',
  qcm:   'des QCM classiques avec 4 options (A/B/C/D), une seule bonne réponse par question',
  kfp:   'des Key-Feature Problems : vignette clinique courte réaliste puis questions précises',
  vf:    'des questions Vrai/Faux avec justification dans l\'explication',
}

const DIFF_DESC: Record<string, string> = {
  annales:  'au niveau des annales EDN réelles — questions précises, pièges subtils sur les valeurs seuils et définitions officielles',
  concours: 'niveau concours blanc rigoureux — sémiologie, raisonnement diagnostique',
  appro:    'niveau approfondi — physiopathologie, mécanismes moléculaires, exceptions, dernières recommandations HAS',
}

// ============================================================
// Gemini Files API helpers
// ============================================================
type GeminiFile = {
  name: string
  uri: string
  mimeType: string
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED' | string
}

async function uploadFileToGemini(blob: Blob, mimeType: string, displayName: string): Promise<GeminiFile> {
  // Étape 1 : init resumable upload
  const init = await fetch(GEMINI_FILES_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(blob.size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  })

  if (!init.ok) {
    const t = await init.text()
    throw new Error(`Gemini upload init failed (${init.status}): ${t.slice(0, 200)}`)
  }

  const uploadUrl = init.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) throw new Error('Pas de X-Goog-Upload-URL en réponse')

  // Étape 2 : upload bytes
  const arrBuf = await blob.arrayBuffer()
  const upload = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(blob.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: arrBuf,
  })

  if (!upload.ok) {
    const t = await upload.text()
    throw new Error(`Gemini upload failed (${upload.status}): ${t.slice(0, 200)}`)
  }

  const data = await upload.json()
  if (!data?.file) throw new Error('Réponse Gemini upload sans file')
  return data.file as GeminiFile
}

async function waitForGeminiFile(name: string, maxWaitMs = 45000): Promise<GeminiFile> {
  const startTs = Date.now()
  while (Date.now() - startTs < maxWaitMs) {
    const resp = await fetch(GEMINI_FILE_GET_URL(name))
    if (resp.ok) {
      const data = (await resp.json()) as GeminiFile
      if (data.state === 'ACTIVE') return data
      if (data.state === 'FAILED') throw new Error('Gemini file processing failed')
    }
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Gemini file processing timeout (>45s)')
}

// ============================================================
// Sanitisation des questions retournées par Gemini
// ============================================================
type SanitizedQuestion = {
  question: string
  options: string[]
  answer: number
  explanation: string
  source_ref: { pdf_page?: number; video_ts?: number } | null
}

function sanitizeQuestions(raw: unknown[], maxN: number): SanitizedQuestion[] {
  const out: SanitizedQuestion[] = []
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue
    const r = q as Record<string, unknown>
    const question = String(r.question || r.stem || '').trim()
    const options = Array.isArray(r.options) ? (r.options as unknown[]).map(String) : []
    const answer = typeof r.answer === 'number' ? r.answer
      : typeof r.correct === 'number' ? r.correct
      : 0
    const explanation = String(r.explanation || '').trim()
    if (!question || options.length < 2) continue
    if (answer < 0 || answer >= options.length) continue

    // source_ref : on ne garde que les nombres valides
    let sourceRef: SanitizedQuestion['source_ref'] = null
    const ref = r.source_ref
    if (ref && typeof ref === 'object') {
      const refObj = ref as Record<string, unknown>
      const pdf_page = typeof refObj.pdf_page === 'number' && refObj.pdf_page > 0 ? refObj.pdf_page : undefined
      const video_ts = typeof refObj.video_ts === 'number' && refObj.video_ts >= 0 ? refObj.video_ts : undefined
      if (pdf_page !== undefined || video_ts !== undefined) {
        sourceRef = {}
        if (pdf_page !== undefined) sourceRef.pdf_page = pdf_page
        if (video_ts !== undefined) sourceRef.video_ts = video_ts
      }
    }

    out.push({ question, options, answer, explanation, source_ref: sourceRef })
    if (out.length >= maxN) break
  }
  return out
}

// ============================================================
// Handler
// ============================================================
export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })
    }

    // 1. Auth
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // 2. Body
    const body = await req.json().catch(() => ({}))
    const {
      lessonId,
      nbQ = 30,
      format = 'mixed',
      difficulty = 'annales',
      mode = 'replace',
    } = body as {
      lessonId?: string
      nbQ?: number
      format?: string
      difficulty?: string
      mode?: 'replace' | 'append'
    }
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId requis' }, { status: 400 })
    }

    // 3. Fetch lesson + ownership check (RLS)
    const { data: lesson, error: lessonErr } = await supabase
      .from('lessons')
      .select('id, name, user_id, media, ai_questions')
      .eq('id', lessonId)
      .single()

    if (lessonErr || !lesson) {
      return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
    }
    if (lesson.user_id !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const media = (lesson.media ?? {}) as { video_path?: string; pdf_path?: string }
    if (!media.video_path && !media.pdf_path) {
      return NextResponse.json(
        { error: "Aucune source uploadée. Ajoute une vidéo ou un PDF avant de générer." },
        { status: 400 }
      )
    }

    // 4. Build Gemini parts
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { fileData: { mimeType: string; fileUri: string } }
    > = []

    // PDF
    if (media.pdf_path) {
      const { data: pdfBlob, error: pdfErr } = await supabase.storage
        .from('lesson-media')
        .download(media.pdf_path)
      if (pdfErr || !pdfBlob) {
        return NextResponse.json({ error: 'PDF introuvable dans Storage' }, { status: 500 })
      }
      if (pdfBlob.size < PDF_INLINE_THRESHOLD) {
        const arrBuf = await pdfBlob.arrayBuffer()
        const b64 = Buffer.from(arrBuf).toString('base64')
        parts.push({ inlineData: { mimeType: 'application/pdf', data: b64 } })
      } else {
        const file = await uploadFileToGemini(pdfBlob, 'application/pdf', 'poly.pdf')
        const active = file.state === 'ACTIVE' ? file : await waitForGeminiFile(file.name, 30000)
        parts.push({ fileData: { mimeType: active.mimeType, fileUri: active.uri } })
      }
    }

    // Vidéo (toujours via Files API, avec garde-fou de taille)
    let videoIncluded = false
    let videoSkipReason: string | null = null
    if (media.video_path) {
      const { data: videoBlob, error: vidErr } = await supabase.storage
        .from('lesson-media')
        .download(media.video_path)
      if (vidErr || !videoBlob) {
        videoSkipReason = 'téléchargement Storage échoué'
      } else if (videoBlob.size > MAX_VIDEO_SIZE) {
        videoSkipReason = `vidéo trop lourde (${(videoBlob.size / 1024 / 1024).toFixed(0)} Mo > 100 Mo)`
      } else {
        try {
          const file = await uploadFileToGemini(videoBlob, videoBlob.type || 'video/mp4', 'cours.mp4')
          const active = file.state === 'ACTIVE' ? file : await waitForGeminiFile(file.name, 45000)
          parts.push({ fileData: { mimeType: active.mimeType, fileUri: active.uri } })
          videoIncluded = true
        } catch (e) {
          videoSkipReason = e instanceof Error ? e.message : 'erreur upload Gemini'
        }
      }
    }

    // 5. Prompt
    const sources: string[] = []
    if (media.pdf_path) sources.push('le polycopié du cours (PDF)')
    if (videoIncluded) sources.push('la vidéo du cours (audio + image)')
    const sourcesStr = sources.join(' et ')

    // En mode append, on récupère les questions déjà générées pour les passer
    // au prompt et demander à Gemini de NE PAS les reproduire.
    const existingQuestions = mode === 'append' && Array.isArray(lesson.ai_questions)
      ? (lesson.ai_questions as Array<Record<string, unknown>>)
      : []

    const existingBlock = existingQuestions.length > 0
      ? `\nQUESTIONS DÉJÀ GÉNÉRÉES POUR CETTE FICHE — ne les reproduis SURTOUT PAS, formule des questions sur d'autres angles, d'autres parties du cours, ou avec des pièges différents :
${existingQuestions.slice(0, 100).map((q, i) => `${i + 1}. ${String(q.question || q.stem || '').slice(0, 140)}`).join('\n')}
`
      : ''

    const prompt = `Tu es un enseignant expert en médecine, spécialisé dans la préparation aux EDN (Épreuves Dématérialisées Nationales) français.

CONTEXTE : tu reçois ${sourcesStr} pour le sujet "${lesson.name}".
${existingBlock}
CONSIGNE :
Génère exactement ${nbQ} ${existingQuestions.length > 0 ? 'NOUVELLES ' : ''}questions de type : ${FORMAT_DESC[format] || FORMAT_DESC.mixed}.
Niveau requis : ${DIFF_DESC[difficulty] || DIFF_DESC.annales}.

RÈGLES IMPÉRATIVES :
- Base-toi exclusivement sur le contenu réel des sources fournies.
${existingQuestions.length > 0 ? '- Couvre des aspects DIFFÉRENTS de ceux déjà traités ci-dessus (autres pages du PDF, autres moments de la vidéo, autres notions, autres pièges).\n' : ''}- Pour CHAQUE question, indique précisément où trouver l'information dans un objet "source_ref" :
  - "pdf_page" : numéro de page du PDF (entier ≥ 1) si l'info vient du PDF
  - "video_ts" : timestamp en secondes dans la vidéo (entier ≥ 0) si l'info vient de la vidéo
  - Tu peux remplir l'un, l'autre, ou les deux. Si vraiment indéterminable, omets le champ.
- Questions précises avec valeurs numériques exactes, définitions officielles, pièges réalistes.
- Pas de questions évidentes ou triviales.
- Langue : français médical rigoureux.

RÉPONDS UNIQUEMENT avec un tableau JSON valide (sans markdown, sans backticks), exactement ce format :
[
  {
    "question": "Question précise ?",
    "options": ["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
    "answer": 0,
    "explanation": "Explication pédagogique citant la source.",
    "source_ref": { "pdf_page": 4, "video_ts": 2528 }
  }
]

"answer" est l'index (0-based) de la bonne réponse dans "options".`

    parts.push({ text: prompt })

    // 6. Generate
    const genResp = await fetch(GEMINI_GEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: 8000,
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!genResp.ok) {
      const errText = await genResp.text()
      throw new Error(`Gemini generateContent failed (${genResp.status}): ${errText.slice(0, 200)}`)
    }

    const genData = await genResp.json()
    const rawText = genData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // 7. Parse JSON
    let parsed: unknown[]
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('Réponse Gemini non-JSON')
      parsed = JSON.parse(match[0])
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Réponse Gemini : tableau attendu')
    }

    // 8. Sanitize
    const sanitized = sanitizeQuestions(parsed, nbQ)
    if (sanitized.length === 0) {
      throw new Error('Aucune question valide générée')
    }

    // 9. Si mode append, concaténer aux existantes ; sinon remplacer
    const finalQuestions = mode === 'append'
      ? [...existingQuestions, ...sanitized]
      : sanitized

    // 10. Save
    const { error: updateErr } = await supabase
      .from('lessons')
      .update({ ai_questions: finalQuestions })
      .eq('id', lessonId)
      .eq('user_id', user.id)

    if (updateErr) {
      throw new Error(`Sauvegarde échouée : ${updateErr.message}`)
    }

    return NextResponse.json({
      count: sanitized.length,             // nb de questions générées dans cet appel
      total: finalQuestions.length,        // nb total après ajout
      mode,
      questions: sanitized,
      videoIncluded,
      videoSkipReason,
    })
  } catch (error) {
    console.error('[generate-qcm] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
