'use client'
// src/components/ReviewModal.tsx
// Modal partagé de révision : picker J (14 paliers) → notation 5 scores.
// + extension 2026-05 : Sources (vidéo + PDF) + QCM générés.
// Utilisé par Mes matières (fiches) et Calendrier.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, LessonMedia } from '@/types'
import { FREE_VIDEO_SIZE_MB, FREE_PDF_SIZE_MB } from '@/types'
import PaywallModal, { type PaywallInfo } from '@/components/PaywallModal'
import './review-modal.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null

type StampState =
  | { kind: 'score'; score: Score }
  | { kind: 'today' }
  | { kind: 'missed' }
  | { kind: 'future' }

// ================ Helpers ================
function stepScore(s: StepEntry): Score | null {
  if (!s) return null
  if (typeof (s as { score?: number }).score === 'number') {
    const sc = (s as { score: number }).score
    if (sc >= 1 && sc <= 5) return sc as Score
  }
  if (typeof (s as { ok?: boolean }).ok === 'boolean') {
    return (s as { ok: boolean }).ok ? 5 : 1
  }
  return null
}

function stepDate(lesson: Lesson, i: number): string {
  if (!lesson.learn_date) return ''
  const d = new Date(lesson.learn_date + 'T12:00:00')
  d.setDate(d.getDate() + J[i])
  return d.toISOString().split('T')[0]
}

function getStampState(lesson: Lesson, i: number, today: string): StampState {
  const steps = (lesson.steps as StepEntry[]) || []
  const sc = stepScore(steps[i])
  if (sc) return { kind: 'score', score: sc }
  if (!lesson.learn_date) return { kind: 'future' }
  const ds = stepDate(lesson, i)
  if (ds === today) return { kind: 'today' }
  if (ds < today) return { kind: 'missed' }
  return { kind: 'future' }
}

function frenchDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// Durée en hMM ou MM min
function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m} min`
}

// Taille en ko / Mo
function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

// Lecture côté client de la durée d'une vidéo via HTML5 video element
function getVideoDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const dur = video.duration
      URL.revokeObjectURL(url)
      resolve(isFinite(dur) ? Math.round(dur) : 0)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}

// Compte approximatif des pages d'un PDF en regex sur le binaire (latin1).
// Suffisant pour des PDF générés normalement. Renvoie null si échec.
async function countPdfPages(file: File): Promise<number | null> {
  try {
    const buf = await file.arrayBuffer()
    const arr = new Uint8Array(buf)
    let str = ''
    const chunk = 65536
    for (let i = 0; i < arr.length; i += chunk) {
      const end = Math.min(i + chunk, arr.length)
      // String.fromCharCode est limité en taille de stack — on chunke
      let part = ''
      for (let j = i; j < end; j++) part += String.fromCharCode(arr[j])
      str += part
    }
    const matches = str.match(/\/Type\s*\/Page[^s]/g)
    return matches ? matches.length : null
  } catch {
    return null
  }
}

function getExt(name: string, fallback = 'bin'): string {
  const m = name.match(/\.([^.]+)$/)
  return m ? m[1].toLowerCase() : fallback
}

// ================ Props ================
interface ReviewModalProps {
  lesson: Lesson
  systemName?: string
  /** Ouvre directement en notation sur ce J (pratique depuis le calendrier). null = picker. */
  initialStepIdx?: number | null
  onClose: () => void
  /** Callback appelé quand une note est enregistrée OU quand les médias changent. */
  onUpdated?: (updatedLesson: Lesson) => void
}

// ================ Component ================
export default function ReviewModal({
  lesson: initialLesson,
  systemName = '',
  initialStepIdx = null,
  onClose,
  onUpdated,
}: ReviewModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const [lesson, setLesson] = useState<Lesson>(initialLesson)
  const [stepIdx, setStepIdx] = useState<number | null>(initialStepIdx)
  const [loading, setLoading] = useState(false)
  const [justRated, setJustRated] = useState<{ idx: number; score: Score } | null>(null)

  // Upload state
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Transcript state (auto-déclenché après upload vidéo, regen possible)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)

  // QCM generation state
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [genInfo, setGenInfo] = useState<string | null>(null)

  // PaywallModal — ouvert quand l'API renvoie code='quota_exceeded'
  // (10e génération QCM IA atteinte ou vidéo > 100 Mo en mode Free).
  const [paywall, setPaywall] = useState<PaywallInfo | null>(null)

  // Plan du user — fetched une fois à l'ouverture pour gating les uploads
  // (PDF > 20 Mo et vidéo > 100 Mo refusés en Free, modale Premium ouverte).
  // Null tant qu'on ne sait pas (on autorise par défaut, le serveur a le
  // dernier mot pour la transcription vidéo).
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Synchronise uniquement si on ouvre sur une AUTRE fiche (id différent) ou un autre J.
  useEffect(() => {
    setLesson(initialLesson)
    setStepIdx(initialStepIdx)
    setJustRated(null)
    setUploadError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLesson.id, initialStepIdx])

  // Fermeture par ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Fetch le plan du user une fois à l'ouverture pour gating les uploads.
  useEffect(() => {
    let cancelled = false
    async function loadPlan() {
      const { data } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', initialLesson.user_id)
        .single()
      if (cancelled) return
      setUserPlan((data?.plan as 'free' | 'pro') ?? 'free')
    }
    loadPlan()
    return () => { cancelled = true }
  }, [supabase, initialLesson.user_id])

  function selectStep(idx: number) {
    if (!lesson.learn_date) return
    const ds = stepDate(lesson, idx)
    if (ds > today) return
    setStepIdx(idx)
    setJustRated(null)
  }

  async function rate(score: Score) {
    if (stepIdx === null) return
    setLoading(true)
    const newSteps = [...((lesson.steps as StepEntry[]) || [])]
    while (newSteps.length < J.length) newSteps.push(null)
    newSteps[stepIdx] = { score, date: today }

    await supabase.from('lessons').update({ steps: newSteps }).eq('id', lesson.id)

    const updated = { ...lesson, steps: newSteps } as Lesson
    setLesson(updated)
    if (onUpdated) onUpdated(updated)

    setLoading(false)
    setJustRated({ idx: stepIdx, score })
    setStepIdx(null)
  }

  // ============================================================
  //  Upload / remplacement / suppression de médias
  // ============================================================
  async function uploadMedia(file: File, kind: 'video' | 'pdf') {
    setUploadError(null)
    const userId = lesson.user_id
    if (!userId) {
      setUploadError("Impossible d'identifier l'utilisateur — recharge la page.")
      return
    }

    // Garde-fous types
    if (kind === 'video' && !file.type.startsWith('video/')) {
      setUploadError('Le fichier doit être une vidéo (.mp4, .webm…)'); return
    }
    if (kind === 'pdf' && file.type !== 'application/pdf') {
      setUploadError('Le fichier doit être un PDF.'); return
    }

    // Garde-fou quota Free : on bloque l'upload AVANT de payer le coût Storage
    // si le fichier dépasse les limites du plan Free. Le user passe directement
    // sur la PaywallModal pour upgrader. Si userPlan='pro' ou null (chargement
    // en cours), on laisse passer — la transcription vidéo refera un check
    // serveur côté /api/transcribe-video pour le cas null.
    if (userPlan === 'free') {
      const sizeMB = file.size / (1024 * 1024)
      if (kind === 'video' && sizeMB > FREE_VIDEO_SIZE_MB) {
        setPaywall({
          quota: 'video_size',
          message: `Ta vidéo fait ${sizeMB.toFixed(0)} Mo. Le mode Gratuit limite à ${FREE_VIDEO_SIZE_MB} Mo (~30 min). Passe en Premium pour des vidéos jusqu'à 250 Mo.`,
        })
        return
      }
      if (kind === 'pdf' && sizeMB > FREE_PDF_SIZE_MB) {
        setPaywall({
          quota: 'pdf_size',
          message: `Ton PDF fait ${sizeMB.toFixed(0)} Mo. Le mode Gratuit limite à ${FREE_PDF_SIZE_MB} Mo. Passe en Premium pour des PDF sans limite de taille.`,
        })
        return
      }
    }

    if (kind === 'video') setUploadingVideo(true)
    else setUploadingPdf(true)

    try {
      // Métadonnées calculées côté client
      let durationS: number | undefined
      let pdfPages: number | undefined
      if (kind === 'video') {
        durationS = await getVideoDuration(file)
      } else {
        const p = await countPdfPages(file)
        pdfPages = p ?? undefined
      }

      // Path : {uid}/{lessonId}/cours.{ext}  ou  {uid}/{lessonId}/poly.pdf
      const ext = kind === 'video' ? getExt(file.name, 'mp4') : 'pdf'
      const baseName = kind === 'video' ? 'cours' : 'poly'
      const path = `${userId}/${lesson.id}/${baseName}.${ext}`

      // Si on remplace une vidéo avec une autre extension, supprimer l'ancienne pour éviter
      // les fichiers orphelins (Supabase Storage upsert ne supprime pas les autres ext).
      const existingMedia = (lesson.media ?? {}) as LessonMedia
      if (kind === 'video' && existingMedia.video_path && existingMedia.video_path !== path) {
        await supabase.storage.from('lesson-media').remove([existingMedia.video_path])
      }

      const { error: upErr } = await supabase.storage
        .from('lesson-media')
        .upload(path, file, {
          upsert: true,
          contentType: file.type || (kind === 'pdf' ? 'application/pdf' : 'video/mp4'),
        })

      if (upErr) throw upErr

      // Update lessons.media
      const newMedia: LessonMedia & {
      transcript?: { start: number; end: number; text: string }[]
      transcript_generated_at?: string
    } = { ...existingMedia }
      if (kind === 'video') {
        newMedia.video_path = path
        newMedia.video_duration_s = durationS
        newMedia.video_size = file.size
        newMedia.video_uploaded_at = new Date().toISOString()
      } else {
        newMedia.pdf_path = path
        newMedia.pdf_pages = pdfPages
        newMedia.pdf_size = file.size
        newMedia.pdf_uploaded_at = new Date().toISOString()
      }

      const { data: updated, error: dbErr } = await supabase
        .from('lessons')
        .update({ media: newMedia })
        .eq('id', lesson.id)
        .select()
        .single()

      if (dbErr) throw dbErr
      if (updated) {
        setLesson(updated as Lesson)
        if (onUpdated) onUpdated(updated as Lesson)
      }

      // Auto-déclenche la transcription après upload vidéo (fire-and-forget,
      // le composant ne bloque pas dessus). Économise ~95% sur les coûts QCM.
      if (kind === 'video') {
        void transcribeVideo()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setUploadError(`Échec de l'upload : ${msg}`)
    } finally {
      if (kind === 'video') setUploadingVideo(false)
      else setUploadingPdf(false)
    }
  }

  // ---- Transcript : extraction Gemini en background ----
  async function transcribeVideo() {
    setTranscribing(true)
    setTranscribeError(null)
    try {
      const res = await fetch('/api/transcribe-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }
      // Re-fetch la fiche pour récupérer le transcript inscrit en DB
      const { data: refreshed } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lesson.id)
        .single()
      if (refreshed) {
        setLesson(refreshed as Lesson)
        if (onUpdated) onUpdated(refreshed as Lesson)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setTranscribeError(msg)
    } finally {
      setTranscribing(false)
    }
  }

  async function removeMedia(kind: 'video' | 'pdf') {
    const existingMedia = (lesson.media ?? {}) as LessonMedia
    const targetPath = kind === 'video' ? existingMedia.video_path : existingMedia.pdf_path
    if (!targetPath) return

    if (!confirm(`Supprimer ${kind === 'video' ? 'la vidéo' : 'le PDF'} ?`)) return

    try {
      await supabase.storage.from('lesson-media').remove([targetPath])
    } catch {
      // on continue même si le fichier physique a déjà été supprimé manuellement
    }

    const newMedia: LessonMedia & {
      transcript?: { start: number; end: number; text: string }[]
      transcript_generated_at?: string
    } = { ...existingMedia }
    if (kind === 'video') {
      delete newMedia.video_path
      delete newMedia.video_duration_s
      delete newMedia.video_size
      delete newMedia.video_uploaded_at
      // Le transcript est lié à la vidéo : on l'invalide aussi
      delete newMedia.transcript
      delete newMedia.transcript_generated_at
    } else {
      delete newMedia.pdf_path
      delete newMedia.pdf_pages
      delete newMedia.pdf_size
      delete newMedia.pdf_uploaded_at
    }

    const { data: updated } = await supabase
      .from('lessons')
      .update({ media: newMedia })
      .eq('id', lesson.id)
      .select()
      .single()

    if (updated) {
      setLesson(updated as Lesson)
      if (onUpdated) onUpdated(updated as Lesson)
    }
  }

  function startQcmSession() {
    onClose()
    router.push(`/dashboard/fiches/${lesson.id}/qcm`)
  }

  async function generateQcms(mode: 'replace' | 'append' = 'replace') {
    setGenError(null)
    setGenInfo(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-qcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          nbQ: 30,
          format: 'mixed',
          difficulty: 'annales',
          mode,
        }),
      })
      // Lecture résiliente : si le serveur a renvoyé une page d'erreur HTML
      // (Vercel timeout / build error / etc.), on capture le texte brut au
      // lieu de crasher sur res.json().
      const rawText = await res.text()
      let data: { error?: string; count?: number; total?: number; videoSkipReason?: string } = {}
      try {
        data = JSON.parse(rawText)
      } catch {
        const head = rawText.slice(0, 200).replace(/<[^>]+>/g, '').trim()
        throw new Error(
          `Réponse non-JSON du serveur (HTTP ${res.status}). Détail : ${head || 'aucun contenu'}`
        )
      }
      if (!res.ok) {
        // 403 + code='quota_exceeded' → on ouvre le PaywallModal au lieu de
        // throw (le throw afficherait juste un texte rouge basique).
        const d = data as { code?: string; quota?: string; used?: number; limit?: number; error?: string }
        if (res.status === 403 && d.code === 'quota_exceeded') {
          const qType: PaywallInfo['quota'] = d.quota === 'video_size'
            ? 'video_size'
            : 'ai_generations'
          setPaywall({
            quota: qType,
            used: d.used,
            limit: d.limit,
            message: d.error,
          })
          return
        }
        throw new Error(data.error || `Erreur génération (HTTP ${res.status})`)
      }

      // Recharge la lesson pour récupérer les ai_questions à jour
      const { data: updated } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lesson.id)
        .single()
      if (updated) {
        setLesson(updated as Lesson)
        if (onUpdated) onUpdated(updated as Lesson)
      }

      if (data.videoSkipReason) {
        setGenInfo(`Note : la vidéo n'a pas pu être utilisée (${data.videoSkipReason}). Les QCM viennent du PDF.`)
      } else if (mode === 'append' && typeof data.total === 'number') {
        setGenInfo(`+${data.count} questions ajoutées · total : ${data.total} QCM sur cette fiche.`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setGenError(`Échec : ${msg}`)
    } finally {
      setGenerating(false)
    }
  }

  // ============================================================
  //  Données dérivées pour l'UI
  // ============================================================
  // Type local étendu : LessonMedia + transcript (pour éviter de dépendre de
  // types/index.ts qui n'a peut-être pas encore été mis à jour). Le runtime
  // fonctionne même si LessonMedia n'a pas le champ transcript.
  type LessonMediaExt = LessonMedia & {
    transcript?: { start: number; end: number; text: string }[]
    transcript_generated_at?: string
  }
  const media = (lesson.media ?? {}) as LessonMediaExt
  const hasVideo = !!media.video_path
  const hasPdf = !!media.pdf_path
  const hasAnySource = hasVideo || hasPdf

  const aiQuestions: unknown[] = Array.isArray(lesson.ai_questions) ? lesson.ai_questions : []
  const qcmCount = aiQuestions.length

  return (
    <>
    <div className="rmod-overlay" data-tour="review-modal" onClick={onClose}>
      <div className="rmod-card" onClick={e => e.stopPropagation()}>

        <div className="rmod-header">
          <div>
            <div className="rmod-kicker">
              {stepIdx === null ? 'Choisis un J à noter' : 'Session de révision'}
            </div>
            <div className="rmod-title">{lesson.name}</div>
            <div className="rmod-meta">
              {systemName}
              {lesson.learn_date && <> · appris le {frenchDate(lesson.learn_date)}</>}
            </div>
            {/anat|histo|embryo|osteo|arthro|myolog|splanchn|neuro|locomoteur|squelette|cardio|respi|thorax/
              .test(systemName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "")) && (
              <a
                className="rmod-anat-btn"
                href={`https://sketchfab.com/search?q=${encodeURIComponent(lesson.name + ' anatomy')}&type=models`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title={`Voir « ${lesson.name} » en 3D sur Sketchfab`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                Voir en 3D ↗
              </a>
            )}
          </div>
          <button data-tour="rmod-close" className="rmod-close" onClick={onClose} aria-label="Fermer">{'×'}</button>
        </div>

        {/* ---- ÉTAPE 1 : Picker J + Sources + QCM ---- */}
        {stepIdx === null && (
          <>
            {justRated && (
              <div className="rmod-toast">
                <span className={`rmod-toast-dot s${justRated.score}`} />
                Note {justRated.score}/5 enregistrée pour J+{J[justRated.idx]}
              </div>
            )}

            <div className="rmod-jpicker" data-tour="picker-j">
              {J.map((jVal, i) => {
                const s = getStampState(lesson, i, today)
                const ds = lesson.learn_date ? stepDate(lesson, i) : ''
                const isFuture = s.kind === 'future' && ds !== '' && ds > today
                const isLocked = isFuture || !lesson.learn_date

                let statusText = ''
                if (s.kind === 'score') statusText = `Fait · ${s.score}/5`
                else if (s.kind === 'today') statusText = "Aujourd'hui"
                else if (s.kind === 'missed') statusText = 'Manqué'
                else if (ds) {
                  const diff = Math.round((new Date(ds).getTime() - new Date(today).getTime()) / 86400000)
                  statusText = diff === 1 ? 'Demain' : `Dans ${diff} j`
                } else {
                  statusText = 'À planifier'
                }

                const stampCls =
                  s.kind === 'score' ? `s${s.score}` :
                  s.kind === 'today' ? 'today' :
                  s.kind === 'missed' ? 'missed' : 'future'

                return (
                  <button
                    key={i}
                    className={`rmod-jstep${isLocked ? ' locked' : ''}`}
                    disabled={isLocked}
                    onClick={() => selectStep(i)}
                    title={isLocked ? 'Révision future — verrouillée' : `Noter J+${jVal}`}
                  >
                    <span className="rmod-jlbl">J+{jVal}</span>
                    <span className={`rmod-jbig rmod-stamp ${stampCls}`}>
                      {s.kind === 'score' && s.score === 5 && (
                        <span className="rmod-stamp-star" aria-hidden="true">{'★'}</span>
                      )}
                    </span>
                    <span className="rmod-jstatus">{statusText}</span>
                  </button>
                )
              })}
            </div>

            <div className="rmod-hint">
              Clique sur un J pour le noter. Les J futurs sont verrouillés — ils se débloqueront à la bonne date.
            </div>

            {/* ─────────────────────────────────────────────── */}
            {/*  Bloc Sources (vidéo + PDF)                    */}
            {/* ─────────────────────────────────────────────── */}
            <div className="rmod-divider" />
            <div data-tour="sources">
            <div className="rmod-block-label">Sources</div>

            {/* Vidéo */}
            {hasVideo ? (
              <div className="rmod-src-row">
                <div className="rmod-src-icon video">{'▶'}</div>
                <div className="rmod-src-name">
                  cours.{getExt(media.video_path || '', 'mp4')}
                </div>
                <div className="rmod-src-meta">
                  {formatDuration(media.video_duration_s) || formatSize(media.video_size)}
                </div>
                <button
                  type="button"
                  className="rmod-src-replace"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                >
                  {uploadingVideo ? '...' : 'Remplacer'}
                </button>
                <button
                  type="button"
                  className="rmod-src-replace rmod-src-remove"
                  onClick={() => removeMedia('video')}
                  disabled={uploadingVideo}
                  aria-label="Supprimer la vidéo"
                >{'×'}</button>
              </div>
            ) : (
              <button
                type="button"
                className="rmod-src-empty"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingVideo}
              >
                <span className="rmod-src-plus">+</span>
                <span>{uploadingVideo ? 'Upload de la vidéo…' : 'Ajouter la vidéo du cours'}</span>
              </button>
            )}

            {/* Transcript : statut + bouton regen, affiché seulement si vidéo présente */}
            {hasVideo && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: 'var(--gray)',
                fontFamily: "var(--font-hanken), serif",
                fontStyle: 'italic',
                marginTop: -4,
                marginBottom: 4,
              }}>
                {transcribing ? (
                  <>
                    <span style={{ color: '#C47B2B' }}>{'…'}</span>
                    Transcription en cours (1-2 min pour 1h de vidéo)
                  </>
                ) : transcribeError ? (
                  <>
                    <span style={{ color: '#C75050' }}>Erreur transcript : {transcribeError}.</span>
                    <button
                      type="button"
                      onClick={() => void transcribeVideo()}
                      style={{
                        background: 'none', border: 'none', color: '#2C5F8A',
                        cursor: 'pointer', fontSize: 12, textDecoration: 'underline',
                        padding: 0, fontFamily: 'inherit', fontStyle: 'inherit',
                      }}
                    >Réessayer</button>
                  </>
                ) : media.transcript && media.transcript.length > 0 ? (
                  <>
                    <span style={{ color: '#2C5F8A' }}>{'✓'}</span>
                    Transcript prêt · {media.transcript.length} segments
                    <button
                      type="button"
                      onClick={() => void transcribeVideo()}
                      style={{
                        background: 'none', border: 'none', color: 'var(--gray)',
                        cursor: 'pointer', fontSize: 11, textDecoration: 'underline',
                        padding: 0, fontFamily: 'inherit', fontStyle: 'inherit',
                        marginLeft: 'auto',
                      }}
                    >Regénérer</button>
                  </>
                ) : (
                  <>
                    <span>Pas de transcript</span>
                    <button
                      type="button"
                      onClick={() => void transcribeVideo()}
                      style={{
                        background: 'none', border: 'none', color: '#2C5F8A',
                        cursor: 'pointer', fontSize: 12, textDecoration: 'underline',
                        padding: 0, fontFamily: 'inherit', fontStyle: 'inherit',
                      }}
                    >Générer maintenant</button>
                  </>
                )}
              </div>
            )}

            {/* PDF */}
            {hasPdf ? (
              <div className="rmod-src-row">
                <div className="rmod-src-icon pdf">{'📄'}</div>
                <div className="rmod-src-name">poly.pdf</div>
                <div className="rmod-src-meta">
                  {media.pdf_pages ? `${media.pdf_pages} p.` : formatSize(media.pdf_size)}
                </div>
                <button
                  type="button"
                  className="rmod-src-replace"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={uploadingPdf}
                >
                  {uploadingPdf ? '...' : 'Remplacer'}
                </button>
                <button
                  type="button"
                  className="rmod-src-replace rmod-src-remove"
                  onClick={() => removeMedia('pdf')}
                  disabled={uploadingPdf}
                  aria-label="Supprimer le PDF"
                >{'×'}</button>
              </div>
            ) : (
              <button
                type="button"
                className="rmod-src-empty"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
              >
                <span className="rmod-src-plus">+</span>
                <span>{uploadingPdf ? 'Upload du PDF…' : 'Ajouter le polycopié (PDF)'}</span>
              </button>
            )}

            {/* Inputs cachés — déclenchés par les boutons ci-dessus */}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) uploadMedia(f, 'video')
              }}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) uploadMedia(f, 'pdf')
              }}
            />

            {uploadError && (
              <div className="rmod-upload-error">{uploadError}</div>
            )}
            </div>{/* /data-tour="sources" */}

            {/* ─────────────────────────────────────────────── */}
            {/*  Bloc QCM générés                              */}
            {/* ─────────────────────────────────────────────── */}
            <div className="rmod-divider" />
            <div data-tour="qcm-section">
            <div className="rmod-block-label">QCM générés depuis ces sources</div>

            {qcmCount > 0 ? (
              <div className="rmod-qcm-line">
                <div className="rmod-qcm-num">{qcmCount}</div>
                <div className="rmod-qcm-meta">QCM disponibles sur cette fiche</div>
                <div className="rmod-qcm-actions">
                  <button
                    type="button"
                    className="rmod-qcm-regen"
                    onClick={() => generateQcms('append')}
                    disabled={generating}
                    title="Ajouter 30 questions de plus (sur d'autres aspects du cours)"
                  >
                    {generating ? '…' : '+ Ajouter 30'}
                  </button>
                  <button
                    type="button"
                    className="rmod-qcm-cta"
                    onClick={startQcmSession}
                    disabled={generating}
                  >
                    Lancer une session
                  </button>
                </div>
              </div>
            ) : hasAnySource ? (
              <div className="rmod-qcm-line">
                <div className="rmod-qcm-meta rmod-qcm-meta-grow">
                  Aucun QCM encore. L&apos;IA peut en générer depuis {hasVideo && hasPdf ? 'la vidéo et le PDF' : hasVideo ? 'la vidéo' : 'le PDF'}.
                </div>
                <button
                  type="button"
                  className="rmod-qcm-cta"
                  onClick={() => generateQcms('replace')}
                  disabled={generating}
                >
                  {generating ? 'Génération… (30-60s)' : 'Générer 30 QCM'}
                </button>
              </div>
            ) : (
              <div className="rmod-qcm-empty">
                Les QCM seront générés automatiquement <em>dès qu&apos;une source sera ajoutée</em>.
              </div>
            )}

            {genError && (
              <div className="rmod-upload-error">{genError}</div>
            )}
            {genInfo && (
              <div className="rmod-gen-info">{genInfo}</div>
            )}
            </div>{/* /data-tour="qcm-section" */}
          </>
        )}

        {/* ---- ÉTAPE 2 : Notation ---- */}
        {stepIdx !== null && (
          <>
            <div className="rmod-lesson">
              <div className="rmod-lesson-kicker">Révision J+{J[stepIdx]}</div>
              <div className="rmod-lesson-name">{lesson.name}</div>
              <div className="rmod-lesson-meta">
                {systemName}
                {lesson.learn_date
                  ? <> · prévue le {frenchDate(stepDate(lesson, stepIdx))}</>
                  : ' · date non planifiée'}
              </div>
            </div>

            <div className="rmod-ask">Quelle note ?</div>
            <div className="rmod-scores">
              {([1, 2, 3, 4, 5] as Score[]).map(n => (
                <button
                  key={n}
                  className={`rmod-score s${n}`}
                  onClick={() => rate(n)}
                  disabled={loading}
                >
                  <span className="rmod-num">{n}</span>
                  <span className="rmod-lbl">
                    {n === 1 ? 'À revoir' : n === 2 ? 'Faible' : n === 3 ? 'Moyen' : n === 4 ? 'Bien' : 'Maîtrisé'}
                  </span>
                </button>
              ))}
            </div>

            <button className="rmod-back" onClick={() => setStepIdx(null)}>
              {'←'} Retour aux J
            </button>
          </>
        )}
      </div>
    </div>

    {paywall && (
      <PaywallModal
        quota={paywall.quota}
        used={paywall.used}
        limit={paywall.limit}
        message={paywall.message}
        onClose={() => setPaywall(null)}
      />
    )}
    </>
  )
}
