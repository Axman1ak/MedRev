'use client'
// src/app/dashboard/fiches/[lessonId]/qcm/page.tsx
//
// Page de session QCM par fiche.
// 3 phases : question / feedback / end.
// Lance la lightbox SourceLightbox quand l'élève clique "Voir la source ↗".

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, AiQuestion, AiQuestionSourceRef, LessonMedia, System } from '@/types'
import { normalizeAnswer, isMultiAnswer } from '@/types'
import SourceLightbox from '@/components/SourceLightbox'
import './styles.css'

type Phase = 'loading' | 'question' | 'feedback' | 'end' | 'empty'

// Depuis 2026-05-15 : `selected` est TOUJOURS un tableau d'index choisis.
//   - QCS  → [3]
//   - QCM  → [0, 2, 4]
//   - vide → [] (rien sélectionné)
// On unifie la struct pour ne pas avoir à brancher dans chaque consumer.
interface Answer {
  selected: number[]
  isCorrect: boolean | null
}

// Compare deux ensembles d'index sans dépendre de l'ordre. Utilisé en
// "tout-ou-rien" : il faut EXACTEMENT les bonnes ET AUCUNE mauvaise.
function arraysEqualAsSets(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sa = new Set(a)
  for (const v of b) if (!sa.has(v)) return false
  return true
}

function letterFor(i: number): string {
  return String.fromCharCode(65 + i)
}

// Mélange Fisher-Yates : nouvel ordre à chaque session.
function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp
  }
  return a
}

// Normalise un source_ref qui peut être objet, string legacy, ou null
function normalizeSourceRef(raw: AiQuestion['source_ref']): AiQuestionSourceRef | null {
  if (!raw) return null
  if (typeof raw === 'string') return null  // legacy string, pas exploitable pour jump
  if (typeof raw === 'object') {
    const out: AiQuestionSourceRef = {}
    if (typeof raw.pdf_page === 'number' && raw.pdf_page > 0) out.pdf_page = raw.pdf_page
    if (typeof raw.video_ts === 'number' && raw.video_ts >= 0) out.video_ts = raw.video_ts
    return Object.keys(out).length > 0 ? out : null
  }
  return null
}

export default function QcmSessionPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [system, setSystem] = useState<System | null>(null)
  const [questions, setQuestions] = useState<AiQuestion[]>([])
  // Indices d'origine des questions de la session, dans le tableau
  // ai_questions de la fiche. Permet de reporter les compteurs
  // attempts/correct sur la bonne entrée après shuffle.
  const [origIndices, setOrigIndices] = useState<number[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [showSource, setShowSource] = useState<AiQuestionSourceRef | null>(null)

  // Reset scroll au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      const main = document.querySelector('main')
      if (main) main.scrollTop = 0
    }
  }, [])

  // Load lesson + ai_questions
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: les, error: lesErr } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .eq('user_id', user.id)
        .single()

      if (cancelled) return
      if (lesErr || !les) {
        router.push('/dashboard/fiches')
        return
      }

      const aiQs = Array.isArray(les.ai_questions) ? (les.ai_questions as AiQuestion[]) : []

      // Récupère le système pour le contexte
      const { data: sys } = await supabase
        .from('systems')
        .select('*')
        .eq('id', les.system_id)
        .single()

      if (cancelled) return

      setLesson(les as Lesson)
      setSystem(sys as System)

      if (aiQs.length === 0) {
        setPhase('empty')
        return
      }

      // Mélange les questions à chaque ouverture (ordre différent par session)
      // tout en conservant l'index d'origine pour reporter les compteurs.
      const indexed = aiQs.map((q, i) => ({ q, idx: i }))
      const shuffledIndexed = shuffleArr(indexed)
      setQuestions(shuffledIndexed.map(x => x.q))
      setOrigIndices(shuffledIndexed.map(x => x.idx))
      setAnswers(shuffledIndexed.map(() => ({ selected: [], isCorrect: null })))
      setStartTime(Date.now())
      setPhase('question')
    }
    load()
    return () => { cancelled = true }
  }, [lessonId, router, supabase])

  // ---- Handlers ----
  // Toggle pour QCM (multi), remplace pour QCS (single).
  function selectOption(idx: number) {
    if (phase !== 'question') return
    const q = questions[currentIdx]
    const multi = isMultiAnswer(q)
    const current = answers[currentIdx]?.selected ?? []
    const has = current.includes(idx)

    let nextSelected: number[]
    if (multi) {
      // QCM : toggle. On ajoute si pas déjà coché, on retire sinon.
      nextSelected = has ? current.filter(i => i !== idx) : [...current, idx].sort((a, b) => a - b)
    } else {
      // QCS : on remplace (même comportement qu'un radio).
      nextSelected = has ? [] : [idx]
    }

    const next = [...answers]
    next[currentIdx] = { selected: nextSelected, isCorrect: null }
    setAnswers(next)
  }

  function validate() {
    const ans = answers[currentIdx]
    if (!ans || ans.selected.length === 0) return
    const q = questions[currentIdx]
    const correctIdxs = normalizeAnswer(q.answer)
    // Fiche QCM : tout-ou-rien. Pas de score partiel ici, pour rester simple
    // pédagogiquement. Le scoring "discordance progressive" est réservé au
    // mode Simulateur (cf src/types/index.ts).
    const isCorrect = arraysEqualAsSets(ans.selected, correctIdxs)
    const next = [...answers]
    next[currentIdx] = { selected: ans.selected, isCorrect }
    setAnswers(next)
    setPhase('feedback')
  }

  function goNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1)
      setPhase('question')
    } else {
      // Fin de session : on persiste les compteurs (attempts / correct) sur
      // les questions concernées AVANT d'afficher l'écran de fin, pour que
      // les stats cumulées soient à jour.
      void persistSessionResults()
      setPhase('end')
    }
  }

  // Met à jour attempts/correct sur les questions répondues, sauve en DB,
  // et met à jour le state local pour que l'écran de fin voie les nouveaux
  // chiffres immédiatement.
  async function persistSessionResults() {
    if (!lesson) return
    // Type local étendu : AiQuestion + compteurs optionnels. Évite que
    // TypeScript râle sur les champs `attempts`/`correct` non déclarés
    // dans l'interface AiQuestion d'origine.
    type QWithStats = AiQuestion & { attempts?: number; correct?: number }
    const allQs: QWithStats[] = Array.isArray(lesson.ai_questions)
      ? ([...(lesson.ai_questions as QWithStats[])])
      : []

    answers.forEach((ans, sessIdx) => {
      if (!ans || ans.selected.length === 0) return
      const origIdx = origIndices[sessIdx]
      if (origIdx === undefined || origIdx < 0 || origIdx >= allQs.length) return
      const cur = allQs[origIdx]
      const newAttempts = (cur.attempts || 0) + 1
      const newCorrect = (cur.correct || 0) + (ans.isCorrect ? 1 : 0)
      allQs[origIdx] = { ...cur, attempts: newAttempts, correct: newCorrect }
    })

    // Update local d'abord pour rendu instantané
    setLesson(prev => (prev ? { ...prev, ai_questions: allQs as AiQuestion[] } : prev))

    // Puis persistance DB (best-effort)
    try {
      await supabase
        .from('lessons')
        .update({ ai_questions: allQs as AiQuestion[] })
        .eq('id', lesson.id)
    } catch (e) {
      console.error('[qcm] persist results failed:', e)
    }
  }

  // Démarre une mini-session ciblée sur les questions où l'élève rate
  // chroniquement (sur l'ensemble de ses sessions, pas juste la dernière).
  function restartChronicallyMissed() {
    if (!lesson) return
    const allQs = Array.isArray(lesson.ai_questions)
      ? (lesson.ai_questions as Array<AiQuestion & { attempts?: number; correct?: number }>)
      : []
    const ranked = allQs
      .map((q, i) => ({
        q,
        idx: i,
        attempts: q.attempts || 0,
        correct: q.correct || 0,
      }))
      .filter(x => x.attempts > 0 && x.correct < x.attempts)
      .sort((a, b) => {
        // Tri par ratio raté/réussi décroissant : une question avec
        // 4 ratées sur 5 attempts (ratio 4) passe devant une question
        // avec 4 ratées sur 10 (ratio 0.67). Les questions jamais
        // réussies (correct = 0) montent automatiquement en tête.
        const ratioA = a.correct === 0 ? Number.MAX_SAFE_INTEGER : (a.attempts - a.correct) / a.correct
        const ratioB = b.correct === 0 ? Number.MAX_SAFE_INTEGER : (b.attempts - b.correct) / b.correct
        if (ratioB !== ratioA) return ratioB - ratioA
        // Tie-break : plus d'attempts = ratio plus fiable
        return b.attempts - a.attempts
      })
      .slice(0, 3)

    if (ranked.length === 0) {
      quitToFiches()
      return
    }
    const focusedIndexed = ranked.map(x => ({ q: x.q, idx: x.idx }))
    const shuffled = shuffleArr(focusedIndexed)
    setQuestions(shuffled.map(x => x.q))
    setOrigIndices(shuffled.map(x => x.idx))
    setAnswers(shuffled.map(() => ({ selected: [], isCorrect: null })))
    setCurrentIdx(0)
    setStartTime(Date.now())
    setPhase('question')
  }

  function quitToFiches() {
    router.push('/dashboard/fiches')
  }

  function restartMissed() {
    const missedIndices = answers
      .map((a, i) => (a.selected.length > 0 && !a.isCorrect ? i : -1))
      .filter(i => i >= 0)
    if (missedIndices.length === 0) {
      quitToFiches()
      return
    }
    // IMPORTANT : on doit shuffler ENSEMBLE la question et son origIdx pour
    // que persistSessionResults() incrémente les compteurs attempts/correct
    // sur les bonnes entrées de lesson.ai_questions. Sans ça, les stats par
    // question sont silencieusement faussées dès qu'on relance les ratées.
    const pairs = missedIndices.map(i => ({ q: questions[i], idx: origIndices[i] }))
    const shuffledPairs = shuffleArr(pairs)
    setQuestions(shuffledPairs.map(p => p.q))
    setOrigIndices(shuffledPairs.map(p => p.idx))
    setAnswers(shuffledPairs.map(() => ({ selected: [], isCorrect: null })))
    setCurrentIdx(0)
    setStartTime(Date.now())
    setPhase('question')
  }

  // ---- Render ----
  if (phase === 'loading') {
    return (
      <div className="qcm-page">
        <div className="qcm-loading">Chargement de la session…</div>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="qcm-page">
        <div className="qcm-empty">
          <h1 className="qcm-empty-title">Aucun QCM <em>pour cette fiche</em></h1>
          <p className="qcm-empty-text">
            Tu dois d&apos;abord générer les QCM depuis les sources de la fiche.
            Reviens dans <em>Mes matières</em>, ouvre cette fiche, puis clique sur <em>Générer les QCM</em>.
          </p>
          <button className="qcm-empty-btn" onClick={quitToFiches}>← Retour aux fiches</button>
        </div>
      </div>
    )
  }

  // Phase end
  if (phase === 'end') {
    const correctCount = answers.filter(a => a.isCorrect).length
    const totalCount = questions.length
    const wrongCount = answers.filter(a => a.isCorrect === false).length
    const skippedCount = answers.filter(a => a.selected.length === 0).length
    const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
    const timeUsedSec = Math.round((Date.now() - startTime) / 1000)
    const minutes = Math.floor(timeUsedSec / 60)
    const seconds = timeUsedSec % 60
    const timeLabel = `${minutes} min ${seconds.toString().padStart(2, '0')}`
    const haloCls = score >= 70 ? 'ok' : score >= 50 ? 'amber' : 'rose'
    const message = score >= 70 ? 'Excellente session' : score >= 50 ? 'Bonne session' : 'À retravailler'
    const submessage =
      score >= 70 ? 'tu maîtrises l\'essentiel.' :
      score >= 50 ? 'tu progresses, continue.' :
      'c\'est en faisant les fautes qu\'on apprend.'

    // Stats cumulées sur l'ensemble des sessions de cette fiche
    const allQuestions = Array.isArray(lesson?.ai_questions)
      ? (lesson!.ai_questions as Array<AiQuestion & { attempts?: number; correct?: number }>)
      : []
    const cumAttempts = allQuestions.reduce((sum, q) => sum + (q.attempts || 0), 0)
    const cumCorrect = allQuestions.reduce((sum, q) => sum + (q.correct || 0), 0)
    const cumPct = cumAttempts > 0 ? Math.round((cumCorrect / cumAttempts) * 100) : 0

    // Top 3 questions chroniquement ratées
    const chronicallyFailed = allQuestions
      .map((q, i) => ({
        q,
        idx: i,
        attempts: q.attempts || 0,
        correct: q.correct || 0,
      }))
      .filter(x => x.attempts > 0 && x.correct < x.attempts)
      .sort((a, b) => {
        // Tri par ratio raté/réussi décroissant : une question avec
        // 4 ratées sur 5 attempts (ratio 4) passe devant une question
        // avec 4 ratées sur 10 (ratio 0.67). Les questions jamais
        // réussies (correct = 0) montent automatiquement en tête.
        const ratioA = a.correct === 0 ? Number.MAX_SAFE_INTEGER : (a.attempts - a.correct) / a.correct
        const ratioB = b.correct === 0 ? Number.MAX_SAFE_INTEGER : (b.attempts - b.correct) / b.correct
        if (ratioB !== ratioA) return ratioB - ratioA
        // Tie-break : plus d'attempts = ratio plus fiable
        return b.attempts - a.attempts
      })
      .slice(0, 3)

    return (
      <div className="qcm-page">
        <div className="qcm-topbar">
          <button className="qcm-topback" onClick={quitToFiches}>←</button>
          <span className="qcm-ctx">
            <strong>{system?.name || 'Fiche'} · {lesson?.name || ''}</strong> · session terminée
          </span>
        </div>

        <div className="qcm-end">
          <div className={`qcm-end-score ${haloCls}`}>{score}<span className="qcm-end-pct">%</span></div>
          <div className="qcm-end-message"><strong>{message}</strong>, {submessage}</div>

          <div className="qcm-end-stats">
            <div className="qcm-end-stat">
              <div className="qcm-end-stat-num ok">{correctCount}</div>
              <div className="qcm-end-stat-lbl">Bonnes</div>
            </div>
            <div className="qcm-end-stat">
              <div className="qcm-end-stat-num ko">{wrongCount}</div>
              <div className="qcm-end-stat-lbl">Ratées</div>
            </div>
            <div className="qcm-end-stat">
              <div className="qcm-end-stat-num">{timeLabel}</div>
              <div className="qcm-end-stat-lbl">Temps</div>
            </div>
            {skippedCount > 0 && (
              <div className="qcm-end-stat">
                <div className="qcm-end-stat-num">{skippedCount}</div>
                <div className="qcm-end-stat-lbl">Passées</div>
              </div>
            )}
          </div>

          {/* Stats cumulées sur toutes les sessions de cette fiche */}
          {cumAttempts > 0 && (
            <div style={{
              background: '#FAF8F2',
              border: '1px solid #E1DDD3',
              borderRadius: 12,
              padding: '14px 18px',
              margin: '20px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              textAlign: 'left',
              maxWidth: 540,
            }}>
              <div style={{
                fontFamily: "var(--font-bricolage), Georgia, serif",
                fontWeight: 500,
                fontSize: 28,
                color: cumPct >= 70 ? '#1B4332' : cumPct >= 50 ? '#C47B2B' : '#C75050',
                lineHeight: 1,
                minWidth: 60,
              }}>{cumPct} %</div>
              <div style={{ flex: 1, fontSize: 12, color: '#6B6F6A', lineHeight: 1.5 }}>
                de réussite cumulée sur {cumAttempts} réponse{cumAttempts > 1 ? 's' : ''} données pour cette fiche
              </div>
            </div>
          )}

          {/* Liste des questions chroniquement ratées */}
          {chronicallyFailed.length > 0 && (
            <div style={{ margin: '20px 0 0', textAlign: 'left', maxWidth: 540 }}>
              <div style={{
                fontWeight: 600,
                fontSize: 11,
                color: '#6B6F6A',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 10,
              }}>Questions que tu rates encore systématiquement</div>
              {chronicallyFailed.map(({ q, attempts, correct }, i) => {
                const fails = attempts - correct
                const isHigh = fails >= 3
                return (
                  <div key={i} style={{
                    background: 'white',
                    border: '1px solid #E1DDD3',
                    borderLeft: `3px solid ${isHigh ? '#C75050' : '#E08B3C'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 6,
                    fontSize: 12.5,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <div style={{ flex: 1, color: '#111310', lineHeight: 1.4 }}>
                      {q.question.length > 90 ? q.question.slice(0, 90) + '…' : q.question}
                    </div>
                    <div style={{
                      color: isHigh ? '#C75050' : '#E08B3C',
                      fontSize: 11,
                      fontWeight: 500,
                      flexShrink: 0,
                    }}>{fails}× ratée{fails > 1 ? 's' : ''}</div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="qcm-end-actions">
            <button className="qcm-end-btn ghost" onClick={quitToFiches}>Retour à la fiche</button>
            {chronicallyFailed.length > 0 ? (
              <button
                className="qcm-end-btn primary"
                onClick={restartChronicallyMissed}
              >
                Refaire ces {chronicallyFailed.length} question{chronicallyFailed.length > 1 ? 's' : ''} →
              </button>
            ) : wrongCount > 0 ? (
              <button
                className="qcm-end-btn primary"
                onClick={restartMissed}
              >
                Refaire les {wrongCount} ratée{wrongCount > 1 ? 's' : ''} →
              </button>
            ) : (
              <button className="qcm-end-btn primary" disabled>Aucune ratée</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Phase question / feedback
  const q = questions[currentIdx]
  const ans = answers[currentIdx]
  const isFeedback = phase === 'feedback'
  const correctIdxs = normalizeAnswer(q.answer)
  const multi = correctIdxs.length >= 2
  const sourceRef = isFeedback ? normalizeSourceRef(q.source_ref) : null
  const media = (lesson?.media ?? {}) as LessonMedia
  const canShowSource = !!sourceRef && (
    (sourceRef.video_ts !== undefined && !!media.video_path) ||
    (sourceRef.pdf_page !== undefined && !!media.pdf_path)
  )

  return (
    <div className="qcm-page">

      <div className="qcm-topbar">
        <button className="qcm-topback" onClick={quitToFiches}>←</button>
        <span className="qcm-ctx">
          <strong>{system?.name || 'Fiche'} · {lesson?.name || ''}</strong> · session de <em>{questions.length} questions</em>
        </span>
      </div>

      <div className="qcm-content">

        <div className="qcm-progress">
          <div className="qcm-progress-bar">
            <span style={{ width: `${((currentIdx + (isFeedback ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
          <div className="qcm-progress-lbl">{currentIdx + 1} / {questions.length}</div>
        </div>

        <div className="qcm-q-kicker">
          Question {currentIdx + 1}
          <span className={`qcm-q-type${multi ? ' multi' : ''}`}>
            {multi ? 'QCM · plusieurs bonnes réponses' : 'QCS · une seule bonne réponse'}
          </span>
        </div>
        <h1 className="qcm-q-stem">{q.question}</h1>

        <div className={`qcm-options${multi ? ' multi' : ''}`}>
          {q.options.map((opt, i) => {
            const isSelected = ans?.selected.includes(i) ?? false
            const isCorrect = correctIdxs.includes(i)
            let cls = 'qcm-option'
            if (isFeedback) {
              if (isCorrect) cls += ' correct'
              else if (isSelected) cls += ' wrong'
              else cls += ' dim'
            } else if (isSelected) {
              cls += ' selected'
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => selectOption(i)}
                disabled={isFeedback}
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
              >
                <span className={`qcm-letter${multi ? ' check' : ''}`}>
                  {multi ? (isSelected ? '✓' : '') : letterFor(i)}
                </span>
                <span className="qcm-text">
                  {multi && <span className="qcm-text-letter">{letterFor(i)}.</span>}
                  {stripLetterPrefix(opt)}
                </span>
                {isFeedback && isCorrect && <span className="qcm-mark">Bonne réponse</span>}
                {isFeedback && isSelected && !isCorrect && <span className="qcm-mark">Ta réponse</span>}
                {isFeedback && !isSelected && isCorrect && <span className="qcm-mark">Manquée</span>}
              </button>
            )
          })}
        </div>

        {isFeedback && q.explanation && (
          <div className={`qcm-feedback ${ans?.isCorrect ? 'right' : 'wrong'}`}>
            <div className="qcm-feedback-label">{ans?.isCorrect ? 'Bonne réponse' : 'Explication'}</div>
            <p className="qcm-feedback-text">{q.explanation}</p>
            {canShowSource && sourceRef && (
              <div className="qcm-source-row">
                {sourceRef.video_ts !== undefined && media.video_path && (
                  <span className="qcm-source-tag video">{formatTs(sourceRef.video_ts)}</span>
                )}
                {sourceRef.pdf_page !== undefined && media.pdf_path && (
                  <span className="qcm-source-tag pdf">{sourceRef.pdf_page}</span>
                )}
                <button
                  type="button"
                  className="qcm-source-jump"
                  onClick={() => setShowSource(sourceRef)}
                >
                  {sourceRef.pdf_page !== undefined && media.pdf_path
                    ? `Voir page ${sourceRef.pdf_page} ↗`
                    : `Voir la vidéo à ${formatTs(sourceRef.video_ts ?? 0)} ↗`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="qcm-actions">
          {!isFeedback ? (
            <button
              className="qcm-validate"
              onClick={validate}
              disabled={!ans || ans.selected.length === 0}
            >
              Valider {multi && ans?.selected.length ? `(${ans.selected.length} coché${ans.selected.length > 1 ? 'es' : 'e'})` : ''} →
            </button>
          ) : (
            <button className="qcm-next" onClick={goNext}>
              {currentIdx < questions.length - 1 ? 'Question suivante →' : 'Terminer la session →'}
            </button>
          )}
        </div>

      </div>

      {showSource && lesson && (
        <SourceLightbox
          media={media}
          sourceRef={showSource}
          lessonName={lesson.name}
          onClose={() => setShowSource(null)}
        />
      )}
    </div>
  )
}

function stripLetterPrefix(s: string): string {
  // "A. Option" → "Option" (Gemini préfixe parfois les options)
  return s.replace(/^[A-E][.)]\s*/, '')
}

function formatTs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}
