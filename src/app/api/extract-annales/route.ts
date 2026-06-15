// src/app/api/extract-annales/route.ts
//
// Extrait les questions d'un PDF d'annales (table annales) via Gemini.
// EXTRACTION, pas génération : on recopie les vraies questions du sujet.
// - Si le corrigé est dans le PDF, on l'utilise pour answer.
// - Sinon Gemini résout la question et le signale dans explanation.
// Même squelette que generate-qcm : auth, quota IA, retry + modèle de repli,
// parse tolérant aux troncatures, sanitize 5 options strictes.
//
// Compte comme 1 génération IA dans le quota (RPC try_increment_ai_generations_monthly).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_FILES_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`
const GEMINI_FILE_GET_URL = (name: string) =>
  `https://generativelanguage.googleapis.com/v1beta/${name}?key=${GEMINI_API_KEY}`

const PDF_INLINE_THRESHOLD = 18 * 1024 * 1024  // 18 Mo (limite Gemini inline)

// Mêmes valeurs que generate-qcm — doivent rester alignées avec
// FREE_AI_GENERATIONS_LIMIT / PREMIUM_MONTHLY_AI_CAP dans src/types/index.ts.
const FREE_AI_GENERATIONS_LIMIT = 10
const PREMIUM_MONTHLY_AI_CAP = 100

// Cap dur de questions par annale : un sujet PASS fait 30-80 questions,
// 200 laisse de la marge pour les gros sujets multi-UE.
const MAX_QUESTIONS_PER_ANNALE = 200

// ============================================================
// Gemini Files API helpers (copie de generate-qcm)
// ============================================================
type GeminiFile = {
  name: string
  uri: string
  mimeType: string
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED' | string
}

async function uploadFileToGemini(blob: Blob, mimeType: string, displayName: string): Promise<GeminiFile> {
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
// Parsing JSON tolérant aux troncatures (copie de generate-qcm)
// ============================================================
function parseQuestionsJson(raw: string): unknown[] {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try {
    const v = JSON.parse(cleaned)
    if (Array.isArray(v)) return v
  } catch { /* fallbacks */ }

  const arrayStart = cleaned.indexOf('[')
  if (arrayStart < 0) return []

  let depth = 0
  let inString = false
  let escape = false
  let lastValidEnd = -1
  for (let i = arrayStart + 1; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) lastValidEnd = i
    } else if (c === ']' && depth === 0) {
      try {
        const v = JSON.parse(cleaned.slice(arrayStart, i + 1))
        if (Array.isArray(v)) return v
      } catch { /* continue */ }
    }
  }
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
// Sanitisation — comme generate-qcm MAIS sans shuffle des options :
// ce sont les vraies questions du sujet, on garde l'ordre A-E original.
// ============================================================
type SanitizedQuestion = {
  question: string
  options: string[]
  answer: number[]
  explanation: string
  source_ref: { pdf_page?: number } | null
}

function sanitizeQuestions(raw: unknown[], maxN: number): SanitizedQuestion[] {
  const out: SanitizedQuestion[] = []
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue
    const r = q as Record<string, unknown>
    const question = String(r.question || r.stem || '').trim()
    const options = Array.isArray(r.options) ? (r.options as unknown[]).map(String) : []

    let answerArr: number[] = []
    const rawAnswer = r.answer ?? r.answers ?? r.correct
    if (Array.isArray(rawAnswer)) {
      answerArr = (rawAnswer as unknown[])
        .filter(v => typeof v === 'number' && Number.isInteger(v) && v >= 0)
        .map(v => v as number)
    } else if (typeof rawAnswer === 'number' && Number.isInteger(rawAnswer) && rawAnswer >= 0) {
      answerArr = [rawAnswer]
    }
    answerArr = Array.from(new Set(answerArr)).sort((a, b) => a - b)

    const explanation = String(r.explanation || '').trim()
    if (!question) continue
    if (options.length !== 5) continue
    if (answerArr.length < 1) continue
    if (answerArr.some(i => i < 0 || i >= options.length)) continue

    let sourceRef: SanitizedQuestion['source_ref'] = null
    const ref = r.source_ref
    if (ref && typeof ref === 'object') {
      const refObj = ref as Record<string, unknown>
      const pdf_page = typeof refObj.pdf_page === 'number' && refObj.pdf_page > 0 ? refObj.pdf_page : undefined
      if (pdf_page !== undefined) sourceRef = { pdf_page }
    }

    out.push({ question, options, answer: answerArr, explanation, source_ref: sourceRef })
    if (out.length >= maxN) break
  }
  return out
}

// ============================================================
// Handler
// ============================================================
export async function POST(req: NextRequest) {
  // annaleId lu en dehors du try pour pouvoir marquer status='error' dans le catch.
  let annaleId: string | undefined
  let supabaseForCatch: ReturnType<typeof createClient> | null = null
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })
    }

    // 1. Auth
    const supabase = createClient()
    supabaseForCatch = supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // 1b. Quotas (mêmes règles que generate-qcm)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan, ai_generations_count, ai_generations_month_count, ai_generations_month_started_at')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 500 })
    }

    if (profile.plan !== 'pro' && (profile.ai_generations_count ?? 0) >= FREE_AI_GENERATIONS_LIMIT) {
      return NextResponse.json(
        {
          error: `Limite atteinte : ${FREE_AI_GENERATIONS_LIMIT} générations IA en mode Gratuit. Passe en Premium pour des extractions illimitées.`,
          code: 'quota_exceeded',
          quota: 'ai_generations',
          limit: FREE_AI_GENERATIONS_LIMIT,
          used: profile.ai_generations_count ?? 0,
        },
        { status: 403 }
      )
    }

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
            error: `Cap mensuel atteint : ${PREMIUM_MONTHLY_AI_CAP} générations IA ce mois-ci. Le compteur se reset le 1er du mois prochain.`,
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
    annaleId = (body as { annaleId?: string }).annaleId
    if (!annaleId) {
      return NextResponse.json({ error: 'annaleId requis' }, { status: 400 })
    }

    // 3. Fetch annale + ownership
    const { data: annale, error: annaleErr } = await supabase
      .from('annales')
      .select('id, user_id, name, pdf_path')
      .eq('id', annaleId)
      .single()
    if (annaleErr || !annale) {
      return NextResponse.json({ error: 'Annale introuvable' }, { status: 404 })
    }
    if (annale.user_id !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
    if (!annale.pdf_path) {
      return NextResponse.json({ error: 'Aucun PDF sur cette annale' }, { status: 400 })
    }

    // 4. Download PDF + build Gemini parts
    const { data: pdfBlob, error: pdfErr } = await supabase.storage
      .from('lesson-media')
      .download(annale.pdf_path)
    if (pdfErr || !pdfBlob) {
      return NextResponse.json({ error: 'PDF introuvable dans Storage' }, { status: 500 })
    }

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { fileData: { mimeType: string; fileUri: string } }
    > = []

    if (pdfBlob.size < PDF_INLINE_THRESHOLD) {
      const arrBuf = await pdfBlob.arrayBuffer()
      const b64 = Buffer.from(arrBuf).toString('base64')
      parts.push({ inlineData: { mimeType: 'application/pdf', data: b64 } })
    } else {
      const file = await uploadFileToGemini(pdfBlob, 'application/pdf', 'annales.pdf')
      const active = file.state === 'ACTIVE' ? file : await waitForGeminiFile(file.name, 30000)
      parts.push({ fileData: { mimeType: active.mimeType, fileUri: active.uri } })
    }

    // 5. Prompt — EXTRACTION fidèle, pas génération
    const prompt = `Tu es un assistant d'extraction de sujets d'examen de médecine (PASS/LAS, France).

CONTEXTE : tu reçois le PDF d'un sujet d'annales intitulé "${annale.name}". Il contient des questions d'examen à choix multiples, et PEUT contenir une grille de correction (corrigé) à la fin ou intégrée.

CONSIGNE : EXTRAIS toutes les questions du sujet, FIDÈLEMENT, sans en inventer ni en reformuler. Recopie l'énoncé et les 5 options telles quelles (corrige uniquement les artefacts d'OCR évidents).

RÈGLES IMPÉRATIVES :
- N'extrais QUE les questions ayant EXACTEMENT 5 options A-E (standard PASS). Ignore les autres formats (QROC, schémas à légender, etc.).
- Pour "answer" :
  - Si le PDF contient un corrigé : utilise-le. C'est la source de vérité absolue.
  - Sinon : détermine la ou les bonnes réponses avec tes connaissances médicales, et commence "explanation" par "[Corrigé absent du PDF — réponse proposée par l'IA] ".
- "answer" est TOUJOURS un tableau d'index 0-based (A=0, B=1, C=2, D=3, E=4), même pour une seule bonne réponse : QCS → [3], QCM → [0, 2, 4].
- "explanation" : si le corrigé donne une justification, recopie-la ; sinon une justification brève et rigoureuse.
- "source_ref" : { "pdf_page": N } = page du PDF où se trouve la question (entier ≥ 1).
- Conserve l'ORDRE original des questions du sujet et l'ordre original des options A-E.
- Langue : français.

RÉPONDS UNIQUEMENT avec un tableau JSON valide (sans markdown, sans backticks) :
[
  {
    "question": "Concernant la membrane plasmique, quelle(s) proposition(s) est(sont) exacte(s) ?",
    "options": ["A. ...", "B. ...", "C. ...", "D. ...", "E. ..."],
    "answer": [1, 4],
    "explanation": "...",
    "source_ref": { "pdf_page": 3 }
  }
]`

    parts.push({ text: prompt })

    // 6. Generate — retry + modèle de repli (copie generate-qcm)
    const genBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: 32000,  // un sujet complet peut faire 60-80 questions
        temperature: 0.1,        // extraction : on veut de la fidélité, pas de créativité
        responseMimeType: 'application/json',
      },
    })
    const GEN_MODELS = [GEMINI_MODEL, 'gemini-2.0-flash']
    let genResp: Response | null = null
    let lastStatus = 0
    let lastErrText = ''
    for (const model of GEN_MODELS) {
      if (genResp) break
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: genBody,
        })
        if (r.ok) { genResp = r; break }
        lastStatus = r.status
        lastErrText = (await r.text()).slice(0, 200)
        const retriable = r.status === 503 || r.status === 429 || r.status === 500
        if (retriable && attempt === 0) {
          await new Promise(res => setTimeout(res, 1200))
          continue
        }
        break
      }
    }

    if (!genResp) {
      if (lastStatus === 503 || lastStatus === 429 || lastStatus === 500) {
        return NextResponse.json(
          { error: "L'extraction est temporairement surchargée côté IA. Réessaie dans une minute, c'est passager.", code: 'ai_overloaded' },
          { status: 503 },
        )
      }
      throw new Error(`Gemini generateContent failed (${lastStatus}): ${lastErrText}`)
    }

    const genData = await genResp.json()
    const rawText = genData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // 7. Parse + sanitize
    const parsed: unknown[] = parseQuestionsJson(rawText)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Aucune question extraite. Le PDF contient-il bien des QCM à 5 options A-E ?')
    }
    const sanitized = sanitizeQuestions(parsed, MAX_QUESTIONS_PER_ANNALE)
    if (sanitized.length === 0) {
      throw new Error('Aucune question valide extraite (le format attendu est 5 options A-E).')
    }

    // 8. Save
    const { error: updateErr } = await supabase
      .from('annales')
      .update({ questions: sanitized, status: 'ready', extract_error: null })
      .eq('id', annaleId)
      .eq('user_id', user.id)
    if (updateErr) {
      throw new Error(`Sauvegarde échouée : ${updateErr.message}`)
    }

    // 9. Quota (après sauvegarde — une extraction échouée ne consomme rien)
    const limitForRpc = profile.plan === 'pro' ? PREMIUM_MONTHLY_AI_CAP : FREE_AI_GENERATIONS_LIMIT
    const { error: incErr } = await supabase.rpc('try_increment_ai_generations_monthly', {
      uid: user.id,
      monthly_limit: limitForRpc,
    })
    if (incErr) {
      console.warn('[extract-annales] try_increment_ai_generations_monthly RPC failed:', incErr.message)
    }

    return NextResponse.json({
      count: sanitized.length,
      questions: sanitized,
    })
  } catch (error) {
    console.error('[extract-annales] error:', error)
    // Marque l'annale en erreur pour que l'UI propose "Réessayer".
    if (annaleId && supabaseForCatch) {
      try {
        await supabaseForCatch
          .from('annales')
          .update({
            status: 'error',
            extract_error: error instanceof Error ? error.message.slice(0, 300) : 'Erreur interne',
          })
          .eq('id', annaleId)
      } catch { /* best effort */ }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
