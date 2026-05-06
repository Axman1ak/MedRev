// src/app/api/transcribe-video/route.ts
//
// Extrait le transcript audio d'une vidéo de fiche via Gemini, avec
// timestamps. Stocke le résultat dans lesson.media.transcript pour que
// /api/generate-qcm puisse l'utiliser à la place de l'upload vidéo
// (économie ~95% sur les générations suivantes).
//
// Auth via cookie Supabase (RLS check ownership).
// Appelé automatiquement par ReviewModal après upload vidéo, et via
// le bouton "Regénérer le transcript" si la vidéo est remplacée.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300 // Pro plan max ; transcription d'1h de vidéo peut prendre 60-120s
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_GEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const GEMINI_FILES_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`
const GEMINI_FILE_GET_URL = (name: string) =>
  `https://generativelanguage.googleapis.com/v1beta/${name}?key=${GEMINI_API_KEY}`

const MAX_VIDEO_SIZE = 250 * 1024 * 1024 // 250 Mo (cohérent avec generate-qcm)

// ============================================================
// Reuse des helpers Files API (mêmes que generate-qcm)
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
// Parse transcript JSON (tolérant aux troncatures)
// ============================================================
type TranscriptSegment = { start: number; end: number; text: string }

function parseTranscriptJson(raw: string): TranscriptSegment[] {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  // Essai direct
  try {
    const v = JSON.parse(cleaned)
    if (Array.isArray(v)) return v.filter(isValidSegment)
  } catch { /* fallback */ }

  // Extraction du tableau jusqu'au dernier '}' top-level
  const arrayStart = cleaned.indexOf('[')
  if (arrayStart < 0) return []
  let depth = 0, inString = false, escape = false, lastValidEnd = -1
  for (let i = arrayStart + 1; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) lastValidEnd = i }
    else if (c === ']' && depth === 0) {
      try {
        const v = JSON.parse(cleaned.slice(arrayStart, i + 1))
        if (Array.isArray(v)) return v.filter(isValidSegment)
      } catch { /* continue */ }
    }
  }
  if (lastValidEnd > 0) {
    const repaired = cleaned.slice(arrayStart, lastValidEnd + 1) + ']'
    try {
      const v = JSON.parse(repaired)
      if (Array.isArray(v)) return v.filter(isValidSegment)
    } catch { /* échec final */ }
  }
  return []
}

function isValidSegment(x: unknown): x is TranscriptSegment {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.start === 'number' &&
    typeof r.end === 'number' &&
    typeof r.text === 'string' &&
    r.text.trim().length > 0 &&
    r.start >= 0 &&
    r.end >= r.start
  )
}

// ============================================================
// Handler
// ============================================================
export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY non configurée' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { lessonId } = body as { lessonId?: string }
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId requis' }, { status: 400 })
    }

    // Fetch lesson + ownership check
    const { data: lesson, error: lessonErr } = await supabase
      .from('lessons')
      .select('id, user_id, media')
      .eq('id', lessonId)
      .single()

    if (lessonErr || !lesson) {
      return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
    }
    if (lesson.user_id !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const media = (lesson.media ?? {}) as {
      video_path?: string
      transcript?: TranscriptSegment[]
      transcript_generated_at?: string
    }
    if (!media.video_path) {
      return NextResponse.json({ error: 'Aucune vidéo uploadée' }, { status: 400 })
    }

    // Download video from Storage
    const { data: videoBlob, error: vidErr } = await supabase.storage
      .from('lesson-media')
      .download(media.video_path)
    if (vidErr || !videoBlob) {
      return NextResponse.json({ error: 'Vidéo introuvable dans Storage' }, { status: 500 })
    }
    if (videoBlob.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: `Vidéo trop lourde (${(videoBlob.size / 1024 / 1024).toFixed(0)} Mo > 100 Mo)` },
        { status: 400 }
      )
    }

    // Upload to Gemini Files API
    const file = await uploadFileToGemini(videoBlob, videoBlob.type || 'video/mp4', `transcript-${lessonId}.mp4`)
    const active = file.state === 'ACTIVE' ? file : await waitForGeminiFile(file.name, 45000)

    // Generate transcript with timestamps
    const prompt = `Transcrit l'audio de cette vidéo en français, avec des timestamps précis pour chaque segment.

CONSIGNES :
- Segments de 5 à 15 secondes maximum, coupés sur des fins de phrase naturelles.
- "start" et "end" en SECONDES (nombres décimaux acceptés, ex: 12.4).
- "text" : transcription naturelle, fidèle, sans hésitations ni "euh".
- Ignore les longs silences (>3s) et les interjections sans contenu.
- Conserve le vocabulaire médical exact tel que prononcé.

RÉPONDS UNIQUEMENT avec un tableau JSON valide (pas de markdown, pas de backticks), exactement ce format :
[
  { "start": 0.0, "end": 5.2, "text": "Bonjour, aujourd'hui nous parlons de la glycolyse." },
  { "start": 5.3, "end": 11.8, "text": "C'est une voie métabolique cytosolique essentielle..." }
]`

    const genResp = await fetch(GEMINI_GEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { fileData: { mimeType: active.mimeType, fileUri: active.uri } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 32000, // transcript long peut être verbose
          temperature: 0.1,        // factuel, pas de créativité
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!genResp.ok) {
      const errText = await genResp.text()
      throw new Error(`Gemini transcription failed (${genResp.status}): ${errText.slice(0, 200)}`)
    }

    const genData = await genResp.json()
    const rawText = genData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    const transcript = parseTranscriptJson(rawText)
    if (transcript.length === 0) {
      throw new Error('Transcript vide ou non parsable')
    }

    // Update lesson.media with transcript
    const updatedMedia = {
      ...media,
      transcript,
      transcript_generated_at: new Date().toISOString(),
    }

    const { error: updErr } = await supabase
      .from('lessons')
      .update({ media: updatedMedia })
      .eq('id', lessonId)
      .eq('user_id', user.id)

    if (updErr) {
      throw new Error(`Sauvegarde échouée : ${updErr.message}`)
    }

    return NextResponse.json({
      success: true,
      segmentCount: transcript.length,
      durationS: transcript[transcript.length - 1]?.end || 0,
    })
  } catch (error) {
    console.error('[transcribe-video] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
