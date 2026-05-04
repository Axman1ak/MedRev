'use client'
// src/app/dashboard/simulateur/page.tsx
//
// Simulateur d'examen — refonte complète.
// 3 phases : config / session / results.
// 2 modes : apprentissage (reveal + explanation + self-rating)
//          / examen blanc (pas de feedback, navigation libre, grille style concours).
//
// Le toggle semestre (S1/S2/Année) de la sidebar pilote les matières disponibles.

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

// ===================== TYPES =====================
type Semestre = 1 | 2 | 'year'
type Mode = 'apprentissage' | 'examen'
type Phase = 'config' | 'session' | 'results'
type Selection = 'random' | 'weak'

interface Question {
  question: string
  options: string[]
  answer: number
  source?: string
  explanation?: string
  lessonId?: string
  lessonName?: string
  systemName?: string
  systemId?: string
}

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

// ===================== STEP HELPERS (pour Angles morts) =====================
type StepEntry = {
  score?: number
  ok?: boolean
  date?: string
  note?: string
  temp_score?: number
  temp_date?: string
} | null

function stepScore(s: StepEntry): number | null {
  if (!s) return null
  if (typeof (s as { score?: number }).score === 'number') {
    const sc = (s as { score: number }).score
    if (sc >= 1 && sc <= 5) return sc
  }
  if (typeof (s as { ok?: boolean }).ok === 'boolean') {
    return (s as { ok: boolean }).ok ? 5 : 1
  }
  return null
}

function effectiveStepScore(s: StepEntry): number | null {
  const off = stepScore(s)
  if (off) return off
  if (!s) return null
  const t = (s as { temp_score?: number }).temp_score
  if (typeof t === 'number' && t >= 1 && t <= 5) return t
  return null
}

function lessonAvg(lesson: Lesson): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  let sum = 0, n = 0
  for (let i = 0; i < J.length; i++) {
    const eff = effectiveStepScore(steps[i])
    if (eff) { sum += eff; n++ }
  }
  return n > 0 ? sum / n : null
}

function scoreClass(avg: number | null): string {
  if (avg === null) return 's3'
  if (avg < 2) return 's1'
  if (avg < 3) return 's2'
  if (avg < 3.7) return 's3'
  if (avg < 4.5) return 's4'
  return 's5'
}

// ===================== QUESTIONS PARSING =====================
function parseQuestions(lesson: Lesson, systemName: string, systemId: string): Question[] {
  const raw = lesson.ai_questions as unknown[]
  if (!Array.isArray(raw) || raw.length === 0) return []
  const out: Question[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const q = r as Record<string, unknown>
    const question = (q.question as string) || (q.q as string) || ''
    const options = (q.options as string[]) || (q.opts as string[]) || []
    const answer = typeof q.answer === 'number'
      ? (q.answer as number)
      : typeof q.correct_index === 'number'
        ? (q.correct_index as number)
        : 0
    const source = (q.source as string) || (q.src as string) || undefined
    const explanation = (q.explanation as string) || (q.explication as string) || undefined
    if (!question || !Array.isArray(options) || options.length < 2) continue
    out.push({
      question,
      options,
      answer,
      source,
      explanation,
      lessonId: lesson.id,
      lessonName: lesson.name,
      systemName,
      systemId,
    })
  }
  return out
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function letterFor(i: number): string {
  return String.fromCharCode(65 + i) // 0 → A, 1 → B, …
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ===================== PAGE =====================
export default function SimulateurPage() {
  const supabase = createClient()
  const router = useRouter()

  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [semester, setSemester] = useState<Semestre>(2)

  const [selectedSysIds, setSelectedSysIds] = useState<Set<string>>(new Set())

  // Config
  const [nbQuestions, setNbQuestions] = useState(20)
  const [duration, setDuration] = useState<number | null>(30)
  const [selectionMode, setSelectionMode] = useState<Selection>('random')
  const [mode, setMode] = useState<Mode>('apprentissage')

  // Session state
  const [phase, setPhase] = useState<Phase>('config')
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [selfRatings, setSelfRatings] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ===================== LOAD =====================
  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid),
    ])
    setSystems((sys as System[] | null) ?? [])
    setLessons((les as Lesson[] | null) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      load(user.id)
    })
  }, [supabase, router, load])

  // ===================== SEMESTER LISTENER =====================
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemester(raw === '1' ? 1 : raw === 'year' ? 'year' : 2)
    const onSem = (e: Event) => {
      const detail = (e as CustomEvent<Semestre>).detail
      if (detail === 1 || detail === 2 || detail === 'year') setSemester(detail)
    }
    window.addEventListener('medrev-sem-change', onSem)
    return () => window.removeEventListener('medrev-sem-change', onSem)
  }, [])

  // Filtre matières par semestre
  const semSystems = useMemo(
    () => semester === 'year' ? systems : systems.filter(s => s.semestre === semester),
    [systems, semester]
  )

  // Sélectionne toutes les matières du semestre courant par défaut
  useEffect(() => {
    setSelectedSysIds(new Set(semSystems.map(s => s.id)))
  }, [semSystems])

  // ===================== AVAILABLE QUESTIONS =====================
  function countQuestionsForSystem(sysId: string): number {
    return lessons
      .filter(l => l.system_id === sysId)
      .reduce((acc, l) => acc + (Array.isArray(l.ai_questions) ? (l.ai_questions as unknown[]).length : 0), 0)
  }

  function avgForSystem(sysId: string): number | null {
    const sysLessons = lessons.filter(l => l.system_id === sysId)
    let sum = 0, n = 0
    for (const l of sysLessons) {
      const a = lessonAvg(l)
      if (a !== null) { sum += a; n++ }
    }
    return n > 0 ? sum / n : null
  }

  const availableQuestions = useMemo<Question[]>(() => {
    const out: Question[] = []
    for (const l of lessons) {
      if (!selectedSysIds.has(l.system_id)) continue
      const sys = systems.find(s => s.id === l.system_id)
      if (!sys) continue
      out.push(...parseQuestions(l, sys.name, sys.id))
    }
    return out
  }, [lessons, selectedSysIds, systems])

  const totalAvailable = availableQuestions.length

  // ===================== TIMER =====================
  useEffect(() => {
    if (phase === 'session' && duration !== null) {
      setTimeLeft(duration * 60)
    }
  }, [phase, duration])

  useEffect(() => {
    if (phase !== 'session' || duration === null) return
    if (timeLeft <= 0) { endSession(); return }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft])

  // ===================== ACTIONS =====================
  function launchSession() {
    if (totalAvailable === 0) return

    let qs = [...availableQuestions]

    if (selectionMode === 'weak') {
      // Pondère vers les leçons fragiles : poids = (5 - avg) si avg dispo, sinon 3
      const lessonAvgs = new Map<string, number>()
      for (const l of lessons) {
        const a = lessonAvg(l)
        if (a !== null) lessonAvgs.set(l.id, a)
      }
      const weighted = qs.map(q => {
        const avg = q.lessonId ? lessonAvgs.get(q.lessonId) : undefined
        const weight = avg !== undefined ? Math.max(0.5, 5 - avg) : 3
        return { q, weight, r: Math.random() / weight }
      })
      qs = weighted.sort((a, b) => a.r - b.r).map(x => x.q)
    } else {
      qs = shuffle(qs)
    }

    qs = qs.slice(0, nbQuestions)
    setSessionQuestions(qs)
    setCurrentIdx(0)
    setAnswers(new Array(qs.length).fill(null))
    setRevealed(new Array(qs.length).fill(false))
    setSelfRatings(new Array(qs.length).fill(''))
    setPhase('session')
  }

  function selectOption(optIdx: number) {
    // Si déjà révélée en mode app, on ignore
    if (mode === 'apprentissage' && revealed[currentIdx]) return

    const newAnswers = [...answers]
    newAnswers[currentIdx] = optIdx
    setAnswers(newAnswers)

    if (mode === 'apprentissage') {
      const newRevealed = [...revealed]
      newRevealed[currentIdx] = true
      setRevealed(newRevealed)
    }
  }

  function rateSelf(rating: string) {
    const newRatings = [...selfRatings]
    newRatings[currentIdx] = rating
    setSelfRatings(newRatings)
  }

  function gotoNext() {
    if (currentIdx < sessionQuestions.length - 1) {
      setCurrentIdx(currentIdx + 1)
    } else {
      endSession()
    }
  }

  function gotoPrev() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1)
  }

  function gotoQuestion(idx: number) {
    if (idx >= 0 && idx < sessionQuestions.length) setCurrentIdx(idx)
  }

  function endSession() {
    if (timerRef.current) clearTimeout(timerRef.current)
    // En examen blanc, on révèle tout pour la phase results
    if (mode === 'examen') {
      setRevealed(new Array(sessionQuestions.length).fill(true))
    }
    setPhase('results')
  }

  function newSession() {
    setPhase('config')
    setSessionQuestions([])
    setAnswers([])
    setRevealed([])
    setSelfRatings([])
  }

  function replayMissed() {
    const missed = sessionQuestions.filter((q, i) => answers[i] !== null && answers[i] !== q.answer)
    if (missed.length === 0) { newSession(); return }
    setSessionQuestions(missed)
    setCurrentIdx(0)
    setAnswers(new Array(missed.length).fill(null))
    setRevealed(new Array(missed.length).fill(false))
    setSelfRatings(new Array(missed.length).fill(''))
    setPhase('session')
  }

  // ===================== STATS DERIVED =====================
  const correctCount = answers.filter((a, i) => a !== null && a === sessionQuestions[i]?.answer).length
  const wrongCount = answers.filter((a, i) => a !== null && a !== sessionQuestions[i]?.answer).length
  const answeredCount = answers.filter(a => a !== null).length
  const score = sessionQuestions.length > 0 ? Math.round((correctCount / sessionQuestions.length) * 100) : 0
  const timeUsed = duration !== null ? duration * 60 - timeLeft : 0

  // ===================== RENDER =====================
  if (loading) {
    return (
      <div className="sim-page">
        <div className="sim-loading">Chargement…</div>
      </div>
    )
  }

  if (phase === 'config') return renderConfig()
  if (phase === 'session') return renderSession()
  return renderResults()

  // ===================== CONFIG VIEW =====================
  function renderConfig() {
    const summary = {
      mode: mode === 'apprentissage' ? 'Apprentissage' : 'Examen blanc',
      selection: selectionMode === 'random' ? 'Aléatoire' : 'Angles morts',
      duration: duration ? `${duration} minutes` : 'Libre',
      matieres: `${selectedSysIds.size} / ${semSystems.length}`,
    }
    const launchableCount = Math.min(nbQuestions, totalAvailable)
    const canLaunch = totalAvailable > 0 && selectedSysIds.size > 0

    return (
      <div className="sim-page">

        <div className="sim-header">
          <div>
            <h1 className="sim-title">Simulateur d&apos;<em>examen</em></h1>
            <div className="sim-sub">
              Multi-matières · chronométré · corrigé. Configure ta session, lance.
            </div>
          </div>
        </div>

        <div className="sim-cfg-grid">

          {/* ===== LEFT ===== */}
          <div className="sim-cfg-left">

            {/* Matières */}
            <div className="sim-card">
              <div className="sim-card-h">
                Matières à inclure
                <span className="sim-meta">
                  {selectedSysIds.size} sur {semSystems.length}
                  {totalAvailable > 0 ? ` · ${totalAvailable} questions disponibles` : ''}
                </span>
              </div>
              <div className="sim-mat-grid">
                {semSystems.length === 0 ? (
                  <div className="sim-mat-empty">Aucune matière pour {semester === 'year' ? 'l\'année' : `le semestre ${semester}`}.</div>
                ) : semSystems.map((sys, i) => {
                  const isSel = selectedSysIds.has(sys.id)
                  const qCount = countQuestionsForSystem(sys.id)
                  const sysColor = (sys as unknown as { color?: string }).color || PALETTE[i % PALETTE.length]
                  const avg = avgForSystem(sys.id)
                  const scoreCls = scoreClass(avg)
                  const fillPct = avg !== null ? (avg / 5) * 100 : 0
                  return (
                    <button
                      key={sys.id}
                      className={`sim-mat-row${isSel ? ' sel' : ''}`}
                      onClick={() => {
                        const next = new Set(selectedSysIds)
                        if (isSel) next.delete(sys.id); else next.add(sys.id)
                        setSelectedSysIds(next)
                      }}
                    >
                      <span className="sim-mat-check" />
                      <span className="sim-mat-color" style={{ background: sysColor }} />
                      <span className="sim-mat-name">{sys.name}</span>
                      <span className="sim-mat-bar" title={avg !== null ? `${avg.toFixed(1)}/5 en moyenne` : 'aucune note'}>
                        <span className={`sim-mat-bar-fill ${scoreCls}`} style={{ width: `${fillPct}%` }} />
                      </span>
                      <span className="sim-mat-q">{qCount}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Options : 3 sub-cards */}
            <div className="sim-opt-row">
              <div className="sim-opt-card">
                <div className="sim-opt-h">Nb questions</div>
                <div className="sim-opt-pills">
                  {[10, 20, 30, 50].map(n => (
                    <button key={n} className={`sim-opt-pill${nbQuestions === n ? ' sel' : ''}`} onClick={() => setNbQuestions(n)}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="sim-opt-card">
                <div className="sim-opt-h">Durée</div>
                <div className="sim-opt-pills">
                  {[15, 30, 45, null].map(d => (
                    <button
                      key={d ?? 'libre'}
                      className={`sim-opt-pill${duration === d ? ' sel' : ''}`}
                      onClick={() => setDuration(d)}
                    >
                      {d === null ? 'Libre' : d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sim-opt-card">
                <div className="sim-opt-h">Sélection</div>
                <div className="sim-opt-pills">
                  <button className={`sim-opt-pill${selectionMode === 'random' ? ' sel' : ''}`} onClick={() => setSelectionMode('random')}>Aléatoire</button>
                  <button className={`sim-opt-pill${selectionMode === 'weak' ? ' sel' : ''}`} onClick={() => setSelectionMode('weak')}>Angles morts</button>
                </div>
              </div>
            </div>

            {/* Mode card */}
            <div className="sim-card sim-mode-card">
              <div className="sim-card-h">Mode de session</div>
              <div className="sim-mode-pills">

                <button
                  className={`sim-mode-pill${mode === 'apprentissage' ? ' sel' : ''}`}
                  onClick={() => setMode('apprentissage')}
                  type="button"
                >
                  <div className="sim-mode-pill-top">
                    <div className="sim-mode-pill-h">Apprentissage</div>
                    <div className="sim-mode-pill-sub">Réponse révélée + explication. Tu apprends en faisant.</div>
                  </div>
                  <div className="sim-mp-vis sim-mp-vis-app">
                    <div className="sim-mp-app-q">Quel mécanisme principal de la dyspnée ?</div>
                    <div className="sim-mp-app-opt dim"><span className="mark">A.</span>Bronchospasme vagal</div>
                    <div className="sim-mp-app-opt wrong"><span className="mark">B.</span>Hyperventilation</div>
                    <div className="sim-mp-app-opt right"><span className="mark">C.</span>Redistribution sanguine<span className="check">✓</span></div>
                    <div className="sim-mp-app-opt dim"><span className="mark">D.</span>Activation rénine-angiotensine</div>
                    <div className="sim-mp-app-opt dim"><span className="mark">E.</span>Décompression abdominale</div>
                    <div className="sim-mp-app-explain">
                      <strong>Pourquoi C ?</strong> En décubitus, le sang redescend vers le thorax…
                    </div>
                  </div>
                </button>

                <button
                  className={`sim-mode-pill${mode === 'examen' ? ' sel' : ''}`}
                  onClick={() => setMode('examen')}
                  type="button"
                >
                  <div className="sim-mode-pill-top">
                    <div className="sim-mode-pill-h">Examen blanc</div>
                    <div className="sim-mode-pill-sub">Aucun feedback. Grille type concours, corrections à la fin.</div>
                  </div>
                  <div className="sim-mp-vis sim-mp-vis-ex">
                    <div className="sim-mp-ex-header">
                      <div></div>
                      <div>A</div>
                      <div>B</div>
                      <div>C</div>
                      <div>D</div>
                      <div>E</div>
                    </div>
                    <div className="sim-mp-ex-row">
                      <div className="num">Q1</div>
                      <div className="bubble" /><div className="bubble filled" /><div className="bubble" /><div className="bubble" /><div className="bubble" />
                    </div>
                    <div className="sim-mp-ex-row">
                      <div className="num">Q2</div>
                      <div className="bubble filled" /><div className="bubble" /><div className="bubble" /><div className="bubble" /><div className="bubble" />
                    </div>
                    <div className="sim-mp-ex-row">
                      <div className="num">Q3</div>
                      <div className="bubble" /><div className="bubble" /><div className="bubble" /><div className="bubble filled" /><div className="bubble" />
                    </div>
                    <div className="sim-mp-ex-row current">
                      <div className="num">Q4</div>
                      <div className="bubble" /><div className="bubble" /><div className="bubble filled" /><div className="bubble" /><div className="bubble" />
                    </div>
                    <div className="sim-mp-ex-row">
                      <div className="num">Q5</div>
                      <div className="bubble" /><div className="bubble" /><div className="bubble" /><div className="bubble" /><div className="bubble" />
                    </div>
                    <div className="sim-mp-ex-bottom">Tu coches, tu valides à la fin · 0 indice.</div>
                  </div>
                </button>

              </div>
            </div>

          </div>

          {/* ===== RIGHT : Hero CTA ===== */}
          <div className="sim-hero">
            <div className="sim-hero-tag">Prêt à lancer</div>
            <div className="sim-hero-display">
              <div className="sim-hero-num-row">
                <span className="sim-hero-num">{launchableCount}</span>
                <span className="sim-hero-num-unit">question{launchableCount > 1 ? 's' : ''}</span>
              </div>
              <div className="sim-hero-quote">
                <strong>Si tu peux faire ça,</strong> tu peux faire le concours.<br />
                C&apos;est exactement le rythme demandé en P1.
              </div>
              <div className="sim-hero-summary">
                <div className="sim-hero-row">
                  <span className="sim-hero-row-l">Mode</span>
                  <span className="sim-hero-row-v">{summary.mode}</span>
                </div>
                <div className="sim-hero-row">
                  <span className="sim-hero-row-l">Sélection</span>
                  <span className="sim-hero-row-v">{summary.selection}</span>
                </div>
                <div className="sim-hero-row">
                  <span className="sim-hero-row-l">Durée</span>
                  <span className="sim-hero-row-v">{summary.duration}</span>
                </div>
                <div className="sim-hero-row">
                  <span className="sim-hero-row-l">Matières</span>
                  <span className="sim-hero-row-v">{summary.matieres}</span>
                </div>
              </div>
            </div>
            <button
              className="sim-hero-cta"
              disabled={!canLaunch}
              onClick={launchSession}
            >
              {!canLaunch
                ? (totalAvailable === 0 ? 'Aucune question disponible' : 'Sélectionne au moins une matière')
                : 'Lancer la session →'}
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ===================== SESSION VIEW =====================
  function renderSession() {
    const q = sessionQuestions[currentIdx]
    if (!q) return <div className="sim-page"><div className="sim-loading">…</div></div>
    const selectedAnswer = answers[currentIdx]
    const isRevealed = mode === 'apprentissage' && revealed[currentIdx]
    const correctIdx = q.answer

    return (
      <div className="sim-page">

        {/* HEADER */}
        <div className="sim-ses-header">
          <div className="sim-ses-header-l">
            <span className={`sim-ses-tag ${mode === 'apprentissage' ? 'app' : 'ex'}`}>
              {mode === 'apprentissage' ? 'Apprentissage' : 'Examen blanc'}
            </span>
            <span className="sim-ses-tag-sub">
              {mode === 'apprentissage'
                ? 'Réponse révélée + explication à chaque question'
                : 'Aucun feedback avant la fin · style concours'}
            </span>
          </div>
          <div className="sim-ses-stats">
            <div className="sim-ses-stat">
              <div className="sim-ses-stat-num progress">{currentIdx + 1} / {sessionQuestions.length}</div>
              <div className="sim-ses-stat-lbl">Question</div>
            </div>
            {mode === 'apprentissage' ? (
              <>
                <div className="sim-ses-stat">
                  <div className="sim-ses-stat-num ok">{correctCount}</div>
                  <div className="sim-ses-stat-lbl">Bonnes</div>
                </div>
                <div className="sim-ses-stat">
                  <div className="sim-ses-stat-num ko">{wrongCount}</div>
                  <div className="sim-ses-stat-lbl">Ratées</div>
                </div>
              </>
            ) : (
              <div className="sim-ses-stat">
                <div className="sim-ses-stat-num progress">{answeredCount}</div>
                <div className="sim-ses-stat-lbl">Répondues</div>
              </div>
            )}
            {duration !== null && (
              <div className="sim-ses-stat">
                <div className={`sim-ses-stat-num timer${timeLeft < 120 ? ' danger' : ''}`}>{formatTime(timeLeft)}</div>
                <div className="sim-ses-stat-lbl">Restant</div>
              </div>
            )}
          </div>
          <button className="sim-ses-quit" onClick={endSession}>Terminer</button>
        </div>

        {/* GRID 1.5fr 1fr */}
        <div className="sim-ses-grid">

          {/* LEFT : Question */}
          <div className="sim-ses-q">
            <div className="sim-ses-q-meta">
              <em>Question {currentIdx + 1} / {sessionQuestions.length}</em>
              {q.systemName && <span className="sim-ses-q-source">{q.systemName}{q.lessonName ? ` · ${q.lessonName}` : ''}</span>}
            </div>
            <div className="sim-ses-q-text">{q.question}</div>

            <div className="sim-ses-q-options">
              {q.options.map((opt, i) => {
                const isSelected = selectedAnswer === i
                const isCorrect = i === correctIdx
                let cls = 'sim-ses-q-opt'
                if (isRevealed) {
                  if (isCorrect) cls += ' correct'
                  else if (isSelected && !isCorrect) cls += ' wrong'
                  else cls += ' dim'
                } else if (isSelected) {
                  cls += ' sel'
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    disabled={mode === 'apprentissage' && isRevealed}
                    onClick={() => selectOption(i)}
                  >
                    <span className="sim-ses-q-opt-letter">{letterFor(i)}.</span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Explication + self-rating (Apprentissage only, après reveal) */}
            {mode === 'apprentissage' && isRevealed && (
              <>
                <div className="sim-ses-explain">
                  <div className="sim-ses-explain-h">Explication</div>
                  <div className="sim-ses-explain-text">
                    {q.explanation ? (
                      q.explanation
                    ) : (
                      <>
                        La bonne réponse était <strong>{letterFor(correctIdx)}. {q.options[correctIdx]}</strong>.
                      </>
                    )}
                  </div>
                  {q.lessonId && (
                    <a className="sim-ses-explain-link" href={`/dashboard/fiches?lesson=${q.lessonId}`}>
                      Voir cette fiche →
                    </a>
                  )}
                </div>

                <div className="sim-ses-rate-h">Comment tu t&apos;es senti sur cette question ?</div>
                <div className="sim-ses-rate">
                  <button className={`sim-ses-rate-btn r1${selfRatings[currentIdx] === 'reprendre' ? ' on' : ''}`} onClick={() => rateSelf('reprendre')}>À reprendre</button>
                  <button className={`sim-ses-rate-btn r2${selfRatings[currentIdx] === 'difficile' ? ' on' : ''}`} onClick={() => rateSelf('difficile')}>Difficile</button>
                  <button className={`sim-ses-rate-btn r3${selfRatings[currentIdx] === 'bien' ? ' on' : ''}`} onClick={() => rateSelf('bien')}>Bien</button>
                  <button className={`sim-ses-rate-btn r4${selfRatings[currentIdx] === 'facile' ? ' on' : ''}`} onClick={() => rateSelf('facile')}>Facile</button>
                </div>
              </>
            )}

            <div className="sim-ses-nav">
              <button className="sim-ses-nav-btn" onClick={gotoPrev} disabled={currentIdx === 0}>← Précédente</button>
              <button className="sim-ses-nav-btn primary" onClick={gotoNext}>
                {currentIdx === sessionQuestions.length - 1 ? 'Terminer →' : 'Suivante →'}
              </button>
            </div>
          </div>

          {/* RIGHT : Answer grid */}
          <div className="sim-ses-sheet">
            <div className="sim-ses-sheet-h">
              Grille de réponses
              <span className="sim-meta">
                {mode === 'apprentissage' ? 'vert = correct · rouge = raté' : 'clique pour aller à une question'}
              </span>
            </div>
            <SheetGrid
              questions={sessionQuestions}
              answers={answers}
              revealed={revealed}
              currentIdx={currentIdx}
              mode={mode}
              onRowClick={gotoQuestion}
              onBubbleClick={(qi, oi) => {
                if (qi === currentIdx) selectOption(oi)
                else gotoQuestion(qi)
              }}
            />
            <div className="sim-ses-sheet-progress">
              <span className="sim-ses-sheet-progress-l">
                {mode === 'apprentissage' ? 'Score live' : 'Progression'}
              </span>
              <span className="sim-ses-sheet-progress-v">
                {mode === 'apprentissage'
                  ? <>{correctCount}<em>/ {answeredCount} répondues{wrongCount > 0 ? ` · ${wrongCount} ratée${wrongCount > 1 ? 's' : ''}` : ''}</em></>
                  : <>{answeredCount}<em>/ {sessionQuestions.length} répondues</em></>
                }
              </span>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ===================== RESULTS VIEW =====================
  function renderResults() {
    const message = score >= 70 ? 'Excellente session' : score >= 50 ? 'Bonne session' : 'À retravailler'
    const submessage = score >= 70 ? '— tu maîtrises l\'essentiel.' : score >= 50 ? '— tu progresses, continue.' : '— c\'est en faisant les fautes qu\'on apprend.'
    const scoreCls = score >= 70 ? 'ok' : score >= 50 ? 'amber' : 'rose'
    const totalSeconds = duration !== null ? duration * 60 - timeLeft : 0
    const tu = formatTime(totalSeconds)
    const matieres = Array.from(new Set(sessionQuestions.map(q => q.systemName).filter(Boolean))).join(' · ')

    const r1 = selfRatings.filter(r => r === 'reprendre').length
    const r2 = selfRatings.filter(r => r === 'difficile').length
    const r3 = selfRatings.filter(r => r === 'bien').length
    const r4 = selfRatings.filter(r => r === 'facile').length
    const rTotal = r1 + r2 + r3 + r4
    const hasRatings = rTotal > 0

    return (
      <div className="sim-page">

        <div className="sim-header">
          <div>
            <h1 className="sim-title">Session <em>terminée</em></h1>
            <div className="sim-sub">{matieres || 'Toutes matières'} · {sessionQuestions.length} questions · {tu}</div>
          </div>
        </div>

        <div className="sim-res-wrap">

          <div className="sim-res-hero">
            <div className="sim-res-tag">Mode {mode === 'apprentissage' ? 'apprentissage' : 'examen blanc'}</div>
            <div className={`sim-res-score ${scoreCls}`}>{score}<sup>%</sup></div>
            <div className="sim-res-message">
              <strong>{message}</strong> {submessage}
            </div>
          </div>

          <div className="sim-res-stats">
            <div className="sim-res-stat">
              <div className="sim-res-stat-lbl">Bonnes</div>
              <div className="sim-res-stat-num ok">{correctCount}</div>
              <div className="sim-res-stat-sub">sur {sessionQuestions.length} questions</div>
            </div>
            <div className="sim-res-stat">
              <div className="sim-res-stat-lbl">Ratées</div>
              <div className="sim-res-stat-num ko">{wrongCount}</div>
              <div className="sim-res-stat-sub">{wrongCount > 0 ? 'à refaire en révision ciblée' : 'aucune ratée · solide'}</div>
            </div>
            <div className="sim-res-stat">
              <div className="sim-res-stat-lbl">Temps utilisé</div>
              <div className="sim-res-stat-num total">{tu}</div>
              <div className="sim-res-stat-sub">
                {duration !== null ? `sur ${duration} min` : 'mode libre'}
              </div>
            </div>
          </div>

          {hasRatings && (
            <div className="sim-res-rates">
              <div className="sim-res-rates-h">Ressenti — répartition de tes réponses</div>
              <div className="sim-res-rates-bar">
                {r1 > 0 && <div className="sim-res-rates-segment r1" style={{ width: `${(r1 / rTotal) * 100}%` }} />}
                {r2 > 0 && <div className="sim-res-rates-segment r2" style={{ width: `${(r2 / rTotal) * 100}%` }} />}
                {r3 > 0 && <div className="sim-res-rates-segment r3" style={{ width: `${(r3 / rTotal) * 100}%` }} />}
                {r4 > 0 && <div className="sim-res-rates-segment r4" style={{ width: `${(r4 / rTotal) * 100}%` }} />}
              </div>
              <div className="sim-res-rates-list">
                <div className="sim-res-rate"><span className="sim-res-rate-dot r1" /><span className="sim-res-rate-num">{r1}</span><span className="sim-res-rate-lbl">à reprendre</span></div>
                <div className="sim-res-rate"><span className="sim-res-rate-dot r2" /><span className="sim-res-rate-num">{r2}</span><span className="sim-res-rate-lbl">difficiles</span></div>
                <div className="sim-res-rate"><span className="sim-res-rate-dot r3" /><span className="sim-res-rate-num">{r3}</span><span className="sim-res-rate-lbl">bien</span></div>
                <div className="sim-res-rate"><span className="sim-res-rate-dot r4" /><span className="sim-res-rate-num">{r4}</span><span className="sim-res-rate-lbl">faciles</span></div>
              </div>
            </div>
          )}

          <div className="sim-res-actions">
            <button className="sim-res-btn sim-res-btn-secondary" onClick={newSession}>Nouvelle session</button>
            <button className="sim-res-btn sim-res-btn-primary" onClick={replayMissed} disabled={wrongCount === 0}>
              {wrongCount > 0 ? `Refaire les ${wrongCount} ratée${wrongCount > 1 ? 's' : ''} →` : 'Aucune ratée'}
            </button>
          </div>

        </div>
      </div>
    )
  }
}

// ===================== ANSWER GRID =====================
function SheetGrid({
  questions,
  answers,
  revealed,
  currentIdx,
  mode,
  onRowClick,
  onBubbleClick,
}: {
  questions: Question[]
  answers: (number | null)[]
  revealed: boolean[]
  currentIdx: number
  mode: Mode
  onRowClick: (i: number) => void
  onBubbleClick: (qi: number, oi: number) => void
}) {
  // On découpe les questions en 2 colonnes égales
  const total = questions.length
  const half = Math.ceil(total / 2)
  const col1 = questions.slice(0, half)
  const col2 = questions.slice(half)

  // Détecte le nombre max d'options sur l'ensemble (souvent 5)
  const maxOpts = questions.reduce((m, q) => Math.max(m, q.options.length), 5)
  const letters = Array.from({ length: maxOpts }, (_, i) => letterFor(i))

  function renderRow(q: Question, qi: number) {
    const isCurrent = qi === currentIdx
    const ans = answers[qi]
    const isRevealed = mode === 'apprentissage' && revealed[qi]
    return (
      <div
        key={qi}
        className={`sim-ses-sheet-row${isCurrent ? ' current' : ''}`}
        onClick={() => onRowClick(qi)}
      >
        <span className="sim-ses-sheet-num">Q{qi + 1}</span>
        {letters.map((_, oi) => {
          const exists = oi < q.options.length
          if (!exists) return <span key={oi} className="sim-ses-sheet-bubble missing" />
          const filled = ans === oi
          let cls = 'sim-ses-sheet-bubble'
          if (filled) cls += ' filled'
          if (isRevealed) {
            if (oi === q.answer) cls = 'sim-ses-sheet-bubble ok'
            else if (filled) cls = 'sim-ses-sheet-bubble bad'
          }
          return (
            <button
              key={oi}
              className={cls}
              onClick={(e) => { e.stopPropagation(); onBubbleClick(qi, oi) }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="sim-ses-sheet-wrap">
      <div className="sim-ses-sheet-headers" style={{ gridTemplateColumns: `26px repeat(${maxOpts}, 1fr)` }}>
        <div className="h"></div>
        {letters.map(l => <div key={l} className="h">{l}</div>)}
      </div>
      <div className="sim-ses-sheet-grid">
        <div>
          {col1.map((q, i) => (
            <div key={i} style={{ ['--cols' as never]: maxOpts }}>{renderRow(q, i)}</div>
          ))}
        </div>
        <div>
          {col2.map((q, i) => (
            <div key={i + half} style={{ ['--cols' as never]: maxOpts }}>{renderRow(q, i + half)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===================== PALETTE FALLBACK (si systems n'a pas de color) =====================
const PALETTE = ['#7AA56B', '#60A5FA', '#F59E0B', '#A78BFA', '#F472B6', '#2D6A4F', '#9CA3AF']
