'use client'
// src/components/ReviewModal.tsx
// Modal partagé de révision : picker J (14 paliers) → notation 5 scores.
// Utilisé par Mes matières (fiches) et Calendrier.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lesson } from '@/types'
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

// ================ Props ================
interface ReviewModalProps {
  lesson: Lesson
  systemName?: string
  /** Ouvre directement en notation sur ce J (pratique depuis le calendrier). null = picker. */
  initialStepIdx?: number | null
  onClose: () => void
  /** Callback appelé quand une note est enregistrée, avec la lesson mise à jour. */
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
  const [lesson, setLesson] = useState<Lesson>(initialLesson)
  const [stepIdx, setStepIdx] = useState<number | null>(initialStepIdx)
  const [loading, setLoading] = useState(false)
  const [justRated, setJustRated] = useState<{ idx: number; score: Score } | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Synchronise uniquement si on ouvre sur une AUTRE fiche (id différent) ou un autre J.
  // On ne se base pas sur initialLesson (objet entier) car une mise à jour parente
  // déclencherait une réinitialisation intempestive du modal (perte du toast, etc.).
  useEffect(() => {
    setLesson(initialLesson)
    setStepIdx(initialStepIdx)
    setJustRated(null)
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

  return (
    <div className="rmod-overlay" onClick={onClose}>
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
          </div>
          <button className="rmod-close" onClick={onClose} aria-label="Fermer">{'\u00D7'}</button>
        </div>

        {/* ---- ÉTAPE 1 : Picker J ---- */}
        {stepIdx === null && (
          <>
            {justRated && (
              <div className="rmod-toast">
                <span className={`rmod-toast-dot s${justRated.score}`} />
                Note {justRated.score}/5 enregistrée pour J+{J[justRated.idx]}
              </div>
            )}

            <div className="rmod-jpicker">
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
                        <span className="rmod-stamp-star" aria-hidden="true">{'\u2605'}</span>
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
              {'\u2190'} Retour aux J
            </button>
          </>
        )}
      </div>
    </div>
  )
}
