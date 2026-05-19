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
//   Vidéos > MAX_VIDEO_SIZE (250 Mo) → erreur "vidéo trop lourde" pour MVP.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300 // Pro plan max ; transcript+PDF prend ~15-30s, vidéo upload peut prendre 60-90s
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_GEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const GEMINI_FILES_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`
const GEMINI_FILE_GET_URL = (name: string) =>
  `https://generativelanguage.googleapis.com/v1beta/${name}?key=${GEMINI_API_KEY}`

// Limite vidéo : 250 Mo permet d'encaisser une vidéo d'1h compressée 720p
// (typique : 200-300 Mo). Au-delà, la mémoire Vercel (1 Go sur Pro) devient
// tendue car on a le blob ET son ArrayBuffer en mémoire simultanément.
const MAX_VIDEO_SIZE = 250 * 1024 * 1024  // 250 Mo
const PDF_INLINE_THRESHOLD = 18 * 1024 * 1024  // 18 Mo (limite Gemini inline = 20 Mo total req)

// Quota Free : 10 générations IA totales sur le compte. Au-delà, il faut Premium.
// Révisé mai 2026 (était 5) — 5 était trop restrictif, l'user épuisait en
// novembre puis ne voyait plus la valeur récurrente. Doit rester aligné avec
// FREE_AI_GENERATIONS_LIMIT dans src/types/index.ts.
const FREE_AI_GENERATIONS_LIMIT = 10

// Fair use Premium : cap mensuel pour protéger des outliers qui pourraient
// cramer la marge avec des générations massives. Reset automatique au début
// de chaque mois calendaire (date_trunc côté DB). User normal en consomme
// 10-20/mois max, donc 100 laisse une grosse marge avant de gêner qui que ce
// soit de légitime.
const PREMIUM_MONTHLY_AI_CAP = 100

// Cap dur du nombre de questions stockées par fiche (mode append cumulatif).
// Au-delà : le JSON ai_questions devient lourd à charger côté UI, et l'intérêt
// pédagogique sature (au-delà de 100 questions sur une seule fiche, on tape
// du diminishing returns). Vaut pour tous les plans (Free ET Premium).
const MAX_QUESTIONS_PER_LESSON = 100

// Tous les formats produisent EXCLUSIVEMENT des questions à 5 options A-E
// (standard PASS médecine). Le V/F est interdit, les questions à moins ou
// plus de 5 options sont rejetées au sanitize.
//
// MIX QCS / QCM (depuis 2026-05-15) :
// Chaque question peut être :
//   - QCS = Question à Choix Simple : 1 seule bonne réponse (answer = [3])
//   - QCM = Question à Choix Multiples : 2 à 5 bonnes réponses (answer = [0, 2, 4])
// Gemini décide selon le contenu — on lui dit explicitement que les deux
// formats sont autorisés et que la cohérence pédagogique prime.
const FORMAT_DESC: Record<string, string> = {
  mixed: 'un mélange équilibré de QCS (Question à Choix Simple, 1 bonne réponse) et de QCM (Question à Choix Multiples, 2 à 5 bonnes réponses). Toutes les questions ont EXACTEMENT 5 options A-E. JAMAIS de Vrai/Faux.',
  qcm:   'des QCM/QRM classiques avec EXACTEMENT 5 options A-E, où il peut y avoir 1, 2, 3, 4 ou 5 bonnes réponses. Tu DOIS varier le nombre de bonnes réponses (~30% des questions à 1 bonne, ~70% à 2-4 bonnes). Standard PASS médecine.',
  kfp:   'des Key-Feature Problems : vignette clinique courte réaliste puis question précise à 5 options A-E. Mix QCS (1 bonne) et QCM (plusieurs bonnes) selon la situation clinique.',
  vf:    'des QCM à 5 options A-E (le format V/F n\'est pas supporté). Mix QCS et QCM autorisé.',
}

const DIFF_DESC: Record<string, string> = {
  annales:  'au niveau des annales EDN réelles — questions précises, pièges subtils sur les valeurs seuils et définitions officielles',
  concours: 'niveau concours blanc rigoureux — sémiologie, raisonnement diagnostique',
  appro:    'niveau approfondi — physiopathologie, mécanismes moléculaires, exceptions, dernières recommandations HAS',
}

// ============================================================
// Helper : format timestamp (s → "MM:SS" pour le prompt)
// ============================================================
function formatTs(s: number): string {
  const total = Math.floor(s)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
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
// Helpers : shuffle + dédup (questions sémantiquement proches)
// ============================================================
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp
  }
  return a
}

// Clé de comparaison pour dédup stricte :
// - lowercase
// - sans accents
// - sans ponctuation
// - whitespace normalisé
// → garantit "même question = même clé", sans toucher aux questions juste similaires.
function questionKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents
    .replace(/[^\w\s]/g, ' ')                           // strip ponctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================================
// Parsing JSON tolérant aux troncatures de Gemini.
// Si la réponse est coupée au milieu d'un objet, on retombe
// sur le dernier objet complet et on construit un tableau valide.
// ============================================================
function parseQuestionsJson(raw: string): unknown[] {
  const cleaned = raw.replace(/```json|```/g, '').trim()

  // 1. Essai direct
  try {
    const v = JSON.parse(cleaned)
    if (Array.isArray(v)) return v
  } catch {
    // continue avec les fallbacks
  }

  // 2. Cherche le tableau JSON dans la chaîne
  const arrayStart = cleaned.indexOf('[')
  if (arrayStart < 0) return []

  // 3. Reparcours caractère par caractère pour trouver la dernière } complète
  // qui clôt un objet de premier niveau dans le tableau, puis on referme [].
  let depth = 0          // profondeur des objets
  let inString = false
  let escape = false
  let lastValidEnd = -1  // index du dernier '}' qui ferme un objet top-level

  for (let i = arrayStart + 1; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue

    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) lastValidEnd = i  // on vient de fermer un objet top-level
    }
    else if (c === ']' && depth === 0) {
      // Fin propre du tableau : tente le parse
      try {
        const v = JSON.parse(cleaned.slice(arrayStart, i + 1))
        if (Array.isArray(v)) return v
      } catch { /* continue */ }
    }
  }

  // 4. Tableau pas refermé → on prend tout jusqu'au dernier '}' valide et on referme.
  if (lastValidEnd > 0) {
    const repaired = cleaned.slice(arrayStart, lastValidEnd + 1) + ']'
    try {
      const v = JSON.parse(repaired)
      if (Array.isArray(v)) return v
    } catch { /* échec final */ }
  }

  return []
}

// ============================================================
// Sanitisation des questions retournées par Gemini
// ============================================================
// Depuis 2026-05-15 : answer est TOUJOURS un tableau d'index 0-based.
// QCS = [3], QCM = [0, 2, 4]. La conversion depuis le legacy answer:number
// se fait à ce niveau (Gemini peut continuer à renvoyer un number pour les
// QCS, on l'enroule dans un array).
type SanitizedQuestion = {
  question: string
  options: string[]
  answer: number[]
  explanation: string
  source_ref: { pdf_page?: number; video_ts?: number } | null
}

// Réordonne aléatoirement les 5 options d'une question pour casser le biais
// positionnel des LLMs (Gemini place souvent les bonnes réponses en B/C).
// Strip le préfixe "A. ", "B. " etc., shuffle, puis ré-applique A-E dans
// l'ordre nouveau. Le tableau `answer` est remappé pour pointer sur les
// nouvelles positions des bonnes réponses.
function reletterAndShuffleOptions(q: SanitizedQuestion): SanitizedQuestion {
  // Strip le préfixe lettré au début de chaque option
  const stripped = q.options.map(opt => opt.replace(/^\s*[A-E][.)]\s*/, '').trim())

  // Construit un tableau d'indices et shuffle (Fisher-Yates)
  const idx = stripped.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp
  }

  // Ré-applique les lettres A-E dans le nouvel ordre
  const newOptions = idx.map((origPos, newPos) => {
    const letter = String.fromCharCode(65 + newPos) // 65 = 'A'
    return `${letter}. ${stripped[origPos]}`
  })

  // Remappe TOUTES les bonnes réponses vers leur nouvelle position.
  // Ex : answer=[0,2] (anciens index) → on cherche 0 et 2 dans idx[] et on
  // retourne leur position dans le nouvel ordre. .sort() pour avoir des index
  // ascendants (plus propre côté UI).
  const newAnswer = q.answer.map(origPos => idx.indexOf(origPos)).filter(i => i >= 0).sort((a, b) => a - b)

  return { ...q, options: newOptions, answer: newAnswer }
}

function sanitizeQuestions(raw: unknown[], maxN: number): SanitizedQuestion[] {
  const out: SanitizedQuestion[] = []
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue
    const r = q as Record<string, unknown>
    const question = String(r.question || r.stem || '').trim()
    const options = Array.isArray(r.options) ? (r.options as unknown[]).map(String) : []

    // Normalise answer : peut arriver en number (legacy) ou en number[] (nouveau).
    // On accepte aussi r.correct (legacy alias) et r.answers (alias parfois utilisé
    // par Gemini quand on lui demande multi-réponses).
    let answerArr: number[] = []
    const rawAnswer = r.answer ?? r.answers ?? r.correct
    if (Array.isArray(rawAnswer)) {
      answerArr = (rawAnswer as unknown[])
        .filter(v => typeof v === 'number' && Number.isInteger(v) && v >= 0)
        .map(v => v as number)
    } else if (typeof rawAnswer === 'number' && Number.isInteger(rawAnswer) && rawAnswer >= 0) {
      answerArr = [rawAnswer]
    }
    // Dédup + tri ascendant pour la robustesse.
    // Array.from(new Set()) plutôt que [...new Set()] : le spread sur Set
    // demande un target TS >= ES2015, alors qu'Array.from marche partout.
    answerArr = Array.from(new Set(answerArr)).sort((a, b) => a - b)

    const explanation = String(r.explanation || '').trim()
    if (!question) continue
    // RÈGLE STRICTE : exactement 5 options par question (standard PASS médecine).
    if (options.length !== 5) continue
    // Au moins 1 bonne réponse, et tous les index doivent être dans [0, 4].
    if (answerArr.length < 1) continue
    if (answerArr.some(i => i < 0 || i >= options.length)) continue
    // Cap : pas plus de 5 bonnes réponses (= toutes vraies, ce qui est OK
    // mais signal qu'il pourrait y avoir un bug Gemini). On laisse passer
    // jusqu'à 5 — c'est légal en PASS.

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

    // Shuffle des options pour neutraliser le biais positionnel de Gemini.
    const shuffled = reletterAndShuffleOptions({
      question, options, answer: answerArr, explanation, source_ref: sourceRef,
    })

    out.push(shuffled)
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

    // 1b. Check quotas avant d'appeler Gemini
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan, ai_generations_count, ai_generations_month_count, ai_generations_month_started_at')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 500 })
    }

    // Free : check du compteur cumulatif à vie
    if (profile.plan !== 'pro' && (profile.ai_generations_count ?? 0) >= FREE_AI_GENERATIONS_LIMIT) {
      return NextResponse.json(
        {
          error: `Limite atteinte : ${FREE_AI_GENERATIONS_LIMIT} générations QCM IA en mode Gratuit. Passe en Premium pour des générations illimitées.`,
          code: 'quota_exceeded',
          quota: 'ai_generations',
          limit: FREE_AI_GENERATIONS_LIMIT,
          used: profile.ai_generations_count ?? 0,
        },
        { status: 403 }
      )
    }

    // Pro : check du cap mensuel (fair use). Le compteur est reset à la volée
    // par la RPC quand on est dans un nouveau mois, mais le SELECT renvoie la
    // valeur stockée — donc on calcule le compteur effectif côté JS pour le
    // pré-check (la RPC fera le vrai reset atomique côté DB après).
    if (profile.plan === 'pro') {
      const startedAt = profile.ai_generations_month_started_at
        ? new Date(profile.ai_generations_month_started_at)
        : null
      const now = new Date()
      const inSameMonth = startedAt
        && startedAt.getUTCFullYear() === now.getUTCFullYear()
        && startedAt.getUTCMonth() === now.getUTCMonth()
      const effectiveMonthCount = inSameMonth ? (profile.ai_generations_month_count ?? 0) : 0

      if (effectiveMonthCount >= PREMIUM_MONTHLY_AI_CAP) {
        return NextResponse.json(
          {
            error: `Cap mensuel atteint : ${PREMIUM_MONTHLY_AI_CAP} générations QCM IA ce mois-ci. Le compteur se reset le 1er du mois prochain. Si tu en as besoin de plus, contacte-nous.`,
            code: 'quota_exceeded',
            quota: 'monthly_cap',
            limit: PREMIUM_MONTHLY_AI_CAP,
            used: effectiveMonthCount,
          },
          { status: 403 }
        )
      }
    }

    // 2. Body
    const body = await req.json().catch(() => ({}))
    let {
      nbQ = 30,
    } = body as { nbQ?: number }
    const {
      lessonId,
      format = 'mixed',
      difficulty = 'annales',
      mode = 'replace',
    } = body as {
      lessonId?: string
      format?: string
      difficulty?: string
      mode?: 'replace' | 'append'
    }
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId requis' }, { status: 400 })
    }

    // En mode replace : on ne génère jamais plus que le cap par fiche, point.
    if (mode === 'replace' && nbQ > MAX_QUESTIONS_PER_LESSON) {
      nbQ = MAX_QUESTIONS_PER_LESSON
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

    type TranscriptSegment = { start: number; end: number; text: string }
    const media = (lesson.media ?? {}) as {
      video_path?: string
      pdf_path?: string
      transcript?: TranscriptSegment[]
    }
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

    // Vidéo : si on a un transcript pré-calculé, on l'utilise (texte → ~95% moins
    // cher qu'envoyer la vidéo brute). Sinon fallback sur l'upload vidéo (legacy).
    let videoIncluded = false
    let transcriptIncluded = false
    let videoSkipReason: string | null = null

    if (media.transcript && Array.isArray(media.transcript) && media.transcript.length > 0) {
      // Mode transcript : on injecte le texte avec timestamps comme part text.
      // Gemini reçoit le contenu de la vidéo via le transcript + timing pour
      // produire des source_ref.video_ts précis.
      const transcriptText = media.transcript
        .map(s => `[${formatTs(s.start)}–${formatTs(s.end)}] ${s.text}`)
        .join('\n')
      parts.push({
        text: `TRANSCRIPT VIDÉO (avec timestamps en secondes — utilise ces timings pour video_ts dans source_ref) :\n\n${transcriptText}`,
      })
      transcriptIncluded = true
    } else if (media.video_path) {
      const { data: videoBlob, error: vidErr } = await supabase.storage
        .from('lesson-media')
        .download(media.video_path)
      if (vidErr || !videoBlob) {
        videoSkipReason = 'téléchargement Storage échoué'
      } else if (videoBlob.size > MAX_VIDEO_SIZE) {
        videoSkipReason = `vidéo trop lourde (${(videoBlob.size / 1024 / 1024).toFixed(0)} Mo > ${MAX_VIDEO_SIZE / 1024 / 1024} Mo)`
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
    if (transcriptIncluded) sources.push('le transcript audio de la vidéo du cours (avec timestamps)')
    else if (videoIncluded) sources.push('la vidéo du cours (audio + image)')
    const sourcesStr = sources.join(' et ')

    // En mode append, on récupère les questions déjà générées pour les passer
    // au prompt et demander à Gemini de NE PAS les reproduire.
    const existingQuestions = mode === 'append' && Array.isArray(lesson.ai_questions)
      ? (lesson.ai_questions as Array<Record<string, unknown>>)
      : []

    // Cap dur par fiche (mode append) : on refuse d'ajouter si on est déjà au plafond,
    // et on tronque la demande pour ne jamais dépasser MAX_QUESTIONS_PER_LESSON au total.
    if (mode === 'append' && existingQuestions.length >= MAX_QUESTIONS_PER_LESSON) {
      return NextResponse.json(
        {
          error: `Cette fiche contient déjà ${existingQuestions.length} questions générées (plafond : ${MAX_QUESTIONS_PER_LESSON}). Supprime des questions ou utilise "Régénérer" pour repartir de zéro.`,
          code: 'lesson_questions_cap',
          limit: MAX_QUESTIONS_PER_LESSON,
          used: existingQuestions.length,
        },
        { status: 403 }
      )
    }
    if (mode === 'append') {
      const remaining = MAX_QUESTIONS_PER_LESSON - existingQuestions.length
      if (nbQ > remaining) nbQ = remaining
    }

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

FORMAT QCS / QCM (CAPITAL) :
En PASS médecine, une question à 5 options peut avoir 1 SEULE bonne réponse (QCS — Question à Choix Simple) OU PLUSIEURS bonnes réponses (QCM/QRM — Question à Réponses Multiples, de 2 à 5 bonnes).
- Tu DOIS varier : environ 40% de QCS, 60% de QCM (parmi les QCM : surtout 2-3 bonnes, parfois 4, rarement 5).
- Ne mets PAS plusieurs bonnes réponses si le sujet n'en autorise qu'une (ex : "Quel est le ratio normal de…"). À l'inverse, ne mets PAS qu'une bonne réponse si plusieurs propositions du sujet sont vraies (ex : "Concernant l'insuline, lesquelles des propositions suivantes sont exactes ?").
- Le champ "answer" est TOUJOURS un TABLEAU d'index 0-based, même pour une seule bonne réponse :
    QCS → "answer": [3]
    QCM → "answer": [0, 2, 4]

RÈGLES IMPÉRATIVES :
- ⚠ CHAQUE question doit avoir EXACTEMENT 5 OPTIONS A à E. PAS 2, PAS 3, PAS 4, PAS 6. EXACTEMENT 5.
- AUCUNE question Vrai/Faux. AUCUNE question à 2 options.
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
    "question": "Parmi les propositions suivantes concernant la glycolyse, lesquelles sont exactes ?",
    "options": ["A. Elle se déroule dans la mitochondrie", "B. Elle produit 2 ATP nets par molécule de glucose", "C. La phosphofructokinase en est l'enzyme régulatrice", "D. Elle nécessite de l'oxygène", "E. Le pyruvate en est le produit final"],
    "answer": [1, 2, 4],
    "explanation": "B (2 ATP nets), C (PFK régulatrice), E (pyruvate produit). A faux : cytosol. D faux : anaérobie.",
    "source_ref": { "pdf_page": 4, "video_ts": 528 }
  },
  {
    "question": "Quel est le ratio insuline/glucagon à jeun chez un sujet sain ?",
    "options": ["A. 10/1", "B. 1/1", "C. 0,4/1", "D. 0,1/1", "E. 4/1"],
    "answer": [2],
    "explanation": "À jeun, le ratio descend autour de 0,4/1 pour favoriser la libération de glucose. Cf cours p.12.",
    "source_ref": { "pdf_page": 12 }
  }
]

"answer" est TOUJOURS un tableau (même avec un seul élément). Index 0-based dans "options" (donc 0, 1, 2, 3 ou 4).
RÈGLE NON NÉGOCIABLE : exactement 5 options par question, "answer" est un tableau d'au moins 1 et au plus 5 index distincts.`

    parts.push({ text: prompt })

    // 6. Generate
    const genResp = await fetch(GEMINI_GEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: 16000,  // 30 QCM détaillés ≈ 7-9k tokens, marge confortable
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

    // 7. Parse JSON — tolère les troncatures (Gemini peut couper en plein milieu)
    const parsed: unknown[] = parseQuestionsJson(rawText)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Réponse Gemini : aucune question parsable')
    }

    // 8. Sanitize
    let sanitized = sanitizeQuestions(parsed, nbQ)
    if (sanitized.length === 0) {
      throw new Error('Aucune question valide générée')
    }

    // 8b. Dédup INTERNE au batch (Gemini répète parfois)
    {
      const seen = new Set<string>()
      sanitized = sanitized.filter(q => {
        const fp = questionKey(q.question)
        if (seen.has(fp)) return false
        seen.add(fp)
        return true
      })
    }

    // 8c. Dédup vs. questions déjà présentes (mode append uniquement)
    let droppedDuplicates = 0
    if (mode === 'append' && existingQuestions.length > 0) {
      const existingFps = new Set(
        existingQuestions.map(q => questionKey(String(q.question || q.stem || '')))
      )
      const before = sanitized.length
      sanitized = sanitized.filter(q => !existingFps.has(questionKey(q.question)))
      droppedDuplicates = before - sanitized.length
    }

    if (sanitized.length === 0) {
      throw new Error('Toutes les questions générées étaient des doublons des existantes. Réessaie ou lance la génération sur d\'autres sources.')
    }

    // 8d. Mélange l'ordre du batch (sinon Gemini sort par ordre de pages source)
    sanitized = shuffle(sanitized)

    // 9. Si mode append, concaténer aux existantes ; sinon remplacer
    // Filet de sécurité : on retronque à MAX_QUESTIONS_PER_LESSON au cas où
    // Gemini aurait renvoyé plus que demandé (rare, mais ça arrive).
    const finalQuestions = (mode === 'append'
      ? [...existingQuestions, ...sanitized]
      : sanitized
    ).slice(0, MAX_QUESTIONS_PER_LESSON)

    // 10. Save
    const { error: updateErr } = await supabase
      .from('lessons')
      .update({ ai_questions: finalQuestions })
      .eq('id', lessonId)
      .eq('user_id', user.id)

    if (updateErr) {
      throw new Error(`Sauvegarde échouée : ${updateErr.message}`)
    }

    // 11. Incrémenter le compteur (atomique via RPC try_increment_ai_generations_monthly).
    // - Reset automatique du compteur mensuel si on est dans un nouveau mois
    // - Pour les Pro : refuse si on a atteint PREMIUM_MONTHLY_AI_CAP ce mois
    // - Pour les Free : on a déjà vérifié le quota total au step 1b, mais la RPC
    //   incrémente quand même ai_generations_count pour garder le total à jour
    //
    // Fait APRÈS la sauvegarde pour que les générations échouées ne consomment
    // pas le quota du user. Si l'incrément échoue, on log mais on ne fait pas
    // échouer la requête (le user a eu son contenu, c'est ce qui compte).
    //
    // Note : pour les Pro qui dépassent le cap mensuel, on a un cas un peu
    // bizarre : on a déjà servi la génération, puis on découvre le cap atteint.
    // C'est volontaire — on préfère un cas limite OK que de re-vérifier en
    // amont (qui demanderait 2 RPCs au lieu d'1). Le cap est un soft cap.
    let monthlyCount: number | null = null
    let monthlyCapHit = false
    const limitForRpc = profile.plan === 'pro' ? PREMIUM_MONTHLY_AI_CAP : FREE_AI_GENERATIONS_LIMIT
    const { data: incData, error: incErr } = await supabase.rpc('try_increment_ai_generations_monthly', {
      uid: user.id,
      monthly_limit: limitForRpc,
    })
    if (incErr) {
      console.warn('[generate-qcm] try_increment_ai_generations_monthly RPC failed:', incErr.message)
    } else if (incData && typeof incData === 'object') {
      const d = incData as { ok?: boolean; count?: number }
      if (typeof d.count === 'number') monthlyCount = d.count
      if (d.ok === false) monthlyCapHit = true
    }

    return NextResponse.json({
      count: sanitized.length,             // nb de questions générées dans cet appel
      total: finalQuestions.length,        // nb total après ajout
      mode,
      questions: sanitized,
      videoIncluded,
      transcriptIncluded,
      videoSkipReason,
      // Quota info pour l'UI client (toast "il vous reste X générations gratuites"
      // ou warning Premium "tu approches le cap mensuel")
      quotaPlan: profile.plan,
      quotaUsed: profile.plan === 'pro'
        ? monthlyCount ?? profile.ai_generations_month_count
        : monthlyCount ?? profile.ai_generations_count,
      quotaLimit: limitForRpc,
      quotaMonthlyCapHit: monthlyCapHit,
    })
  } catch (error) {
    console.error('[generate-qcm] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
