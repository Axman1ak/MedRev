'use client'
// src/app/dashboard/simulateur/page.tsx
//
// Simulateur d'examen — refonte + fixes 2026-05 :
// - bug 1 (race condition) : setTimeLeft fait dans launchSession AVANT setPhase
// - bug 3 : les options A-E à gauche ne sont plus cliquables (réponse via la grille de droite uniquement)
// - bug 4 : header A-E aligné par colonne dans la SheetGrid

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson, Profile } from '@/types'
import { SCORING_SYSTEMS, getScoringForFac } from '@/types'
import PaywallModal, { type PaywallInfo } from '@/components/PaywallModal'
import SubjectIcon from '@/components/SubjectIcon'
import './styles.css'

type Semestre = 1 | 2 | 'year'
type Mode = 'apprentissage' | 'examen'
type Phase = 'config' | 'session' | 'results'
type Selection = 'random' | 'weak'

// Depuis 2026-05-15 : answer est TOUJOURS un tableau d'index 0-based.
//   QCS = [3], QCM = [0, 2, 4]. Permet de gérer multi-réponses.
interface Question {
  question: string
  options: string[]
  answer: number[]  // 1+ index, jamais vide ni null
  source?: string
  explanation?: string
  lessonId?: string
  lessonName?: string
  systemName?: string
  systemId?: string
}

// Compare deux ensembles d'index sans dépendre de l'ordre.
function arraysEqualAsSets(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sa = new Set(a)
  for (const v of b) if (!sa.has(v)) return false
  return true
}

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

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

function parseQuestions(lesson: Lesson, systemName: string, systemId: string): Question[] {
  const raw = lesson.ai_questions as unknown[]
  if (!Array.isArray(raw) || raw.length === 0) return []
  const out: Question[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const q = r as Record<string, unknown>
    const question = (q.question as string) || (q.q as string) || ''
    const options = (q.options as string[]) || (q.opts as string[]) || []

    // Normalise answer en tableau d'index 0-based.
    // - Nouveau format : answer = [0, 2, 4] (tableau directement)
    // - Legacy : answer = 3 (number) → on l'enroule en [3]
    let answerArr: number[] = []
    const rawAns = q.answer ?? q.answers ?? q.correct_index ?? q.correct
    if (Array.isArray(rawAns)) {
      answerArr = (rawAns as unknown[])
        .filter(v => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < options.length)
        .map(v => v as number)
    } else if (typeof rawAns === 'number' && rawAns >= 0 && rawAns < options.length) {
      answerArr = [rawAns]
    }
    // Dédup + tri ascendant.
    // Array.from(new Set()) plutôt que [...new Set()] : le spread sur Set
    // demande un target TS >= ES2015, alors qu'Array.from marche partout.
    answerArr = Array.from(new Set(answerArr)).sort((a, b) => a - b)

    const source = (q.source as string) || (q.src as string) || undefined
    const explanation = (q.explanation as string) || (q.explication as string) || undefined
    // Standard PASS médecine : EXACTEMENT 5 options A-E + au moins 1 bonne réponse.
    if (!question || !Array.isArray(options) || options.length !== 5) continue
    if (answerArr.length === 0) continue
    out.push({
      question,
      options,
      answer: answerArr,
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
  return String.fromCharCode(65 + i)
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const PALETTE = ['#7AA56B', '#60A5FA', '#F59E0B', '#A78BFA', '#F472B6', '#2D6A4F', '#9CA3AF']

export default function SimulateurPage() {
  const supabase = createClient()
  const router = useRouter()

  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [semester, setSemester] = useState<Semestre>(2)

  const [selectedSysIds, setSelectedSysIds] = useState<Set<string>>(new Set())

  // Wizard config (refonte 2026-06) : 4 étapes, une décision par écran.
  // - step          : étape courante 1..4
  // - selectedLessonIds : sélection par fiche. Set VIDE = "toutes les fiches
  //   des matières choisies" (défaut). Si non-vide, on restreint à ces fiches.
  // - source        : source du contenu. Mappée vers selectionMode au lancement
  //   ('genere' → 'random', 'rate' → 'weak'). 'annales' désactivé pour l'instant.
  const [step, setStep] = useState(1)
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set())
  const [source, setSource] = useState<'genere' | 'rate' | 'annales'>('genere')
  const [lessonSearch, setLessonSearch] = useState('')
  // Quelles matières ont leur groupe de fiches déplié (étape 1). Repliées par défaut.
  const [openSys, setOpenSys] = useState<Set<string>>(new Set())

  const [nbQuestions, setNbQuestions] = useState(20)
  const [duration, setDuration] = useState<number | null>(30)
  const [selectionMode, setSelectionMode] = useState<Selection>('random')
  const [mode, setMode] = useState<Mode>('apprentissage')

  // source pilote selectionMode (le moteur de lancement lit selectionMode).
  useEffect(() => {
    setSelectionMode(source === 'rate' ? 'weak' : 'random')
  }, [source])

  const [phase, setPhase] = useState<Phase>('config')
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  // Chaque réponse est un tableau d'index cochés. null = pas encore répondu
  // (différent de [] qui veut dire "vu mais aucune option cochée").
  const [answers, setAnswers] = useState<(number[] | null)[]>([])
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [selfRatings, setSelfRatings] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Système de scoring selon la fac de l'user. Default = discordance progressive
  // (la plus répandue en PASS français). Cf src/types/index.ts pour ajouter
  // un système per-fac plus précis.
  const scoringId = useMemo(() => getScoringForFac(profile?.fac), [profile?.fac])
  const scoring = SCORING_SYSTEMS[scoringId]

  // Quota Free : vérifié serveur via /api/simulator/start avant lancement.
  // - quotaError : message inline pour les erreurs réseau / serveur génériques
  // - paywall    : payload pour la modale Premium quand l'API renvoie 403 quota_exceeded
  const [launching, setLaunching] = useState(false)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [paywall, setPaywall] = useState<PaywallInfo | null>(null)

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }, { data: pro }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid),
      supabase.from('profiles').select('*').eq('id', uid).single(),
    ])
    setSystems((sys as System[] | null) ?? [])
    setLessons((les as Lesson[] | null) ?? [])
    if (pro) setProfile(pro as Profile)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      load(user.id)
    })
  }, [supabase, router, load])

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

  const semSystems = useMemo(
    () => semester === 'year' ? systems : systems.filter(s => s.semestre === semester),
    [systems, semester]
  )

  // Map ID matière → couleur effective. Si toutes les matières ont la même
  // couleur en base (signe que le picker n'a jamais été utilisé consciemment),
  // on bascule sur PALETTE[idx] pour avoir des couleurs distinctes.
  const colorOfSystem = useMemo(() => {
    const map = new Map<string, string>()
    const distinctColors = new Set(
      systems.map(s => (s as unknown as { color?: string }).color).filter(Boolean)
    )
    const allSameColor = distinctColors.size <= 1 && systems.length > 1

    systems.forEach((s, idx) => {
      const baseColor = (s as unknown as { color?: string }).color
      const c = allSameColor
        ? PALETTE[idx % PALETTE.length]
        : (baseColor || PALETTE[idx % PALETTE.length])
      map.set(s.id, c)
    })
    return map
  }, [systems])

  useEffect(() => {
    setSelectedSysIds(new Set(semSystems.map(s => s.id)))
    // Changement de semestre = on repart d'une sélection fiches vierge + étape 1.
    setSelectedLessonIds(new Set())
    setStep(1)
  }, [semSystems])

  // Fiches disponibles pour le picker de l'étape 1 : celles des matières
  // sélectionnées qui ont au moins une question IA.
  const pickerLessons = useMemo(() => {
    return lessons
      .filter(l => selectedSysIds.has(l.system_id))
      .filter(l => Array.isArray(l.ai_questions) && (l.ai_questions as unknown[]).length > 0)
      .map(l => {
        const sys = systems.find(s => s.id === l.system_id)
        return {
          id: l.id,
          name: l.name,
          systemName: sys?.name ?? '',
          systemId: l.system_id,
          qCount: (l.ai_questions as unknown[]).length,
        }
      })
      .sort((a, b) => a.systemName.localeCompare(b.systemName) || a.name.localeCompare(b.name))
  }, [lessons, selectedSysIds, systems])

  function countQuestionsForSystem(sysId: string): number {
    return lessons
      .filter(l => l.system_id === sysId)
      .reduce((acc, l) => acc + (Array.isArray(l.ai_questions) ? (l.ai_questions as unknown[]).length : 0), 0)
  }

  const availableQuestions = useMemo<Question[]>(() => {
    const out: Question[] = []
    for (const l of lessons) {
      if (!selectedSysIds.has(l.system_id)) continue
      // Set vide = toutes les fiches des matières choisies. Sinon, on restreint.
      if (selectedLessonIds.size > 0 && !selectedLessonIds.has(l.id)) continue
      const sys = systems.find(s => s.id === l.system_id)
      if (!sys) continue
      out.push(...parseQuestions(l, sys.name, sys.id))
    }
    return out
  }, [lessons, selectedSysIds, selectedLessonIds, systems])

  const totalAvailable = availableQuestions.length

  // Conditions d'examen (étape 4) : l'élève ne choisit rien, on s'aligne sur
  // les conditions réelles. Toutes les questions de la portée, et un chrono
  // imposé en mode examen (~1,5 min/question = rythme concours). En mode
  // apprentissage, pas de chrono (correction en direct).
  const examQuestionCount = totalAvailable
  const examDurationMin = mode === 'examen' ? Math.max(1, Math.ceil(examQuestionCount * 1.5)) : null

  // On pousse ces valeurs calculées dans l'état que lit launchSession.
  // Mis à jour dès que la portée ou le mode change, donc nbQuestions/duration
  // sont déjà corrects quand on arrive à l'étape 4 et qu'on lance.
  useEffect(() => {
    setNbQuestions(examQuestionCount)
    setDuration(examDurationMin)
  }, [examQuestionCount, examDurationMin])

  useEffect(() => {
    if (phase !== 'session' || duration === null) return
    if (timeLeft <= 0) {
      if (sessionQuestions.length > 0) endSession()
      return
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft])

  async function launchSession() {
    if (totalAvailable === 0 || launching) return

    // 1. Check quota côté serveur AVANT de construire la session.
    // Si le user est Free et a déjà consommé sa session, on bloque ici.
    setLaunching(true)
    setQuotaError(null)
    setPaywall(null)
    try {
      const resp = await fetch('/api/simulator/start', { method: 'POST' })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        // 403 + code='quota_exceeded' → on ouvre le PaywallModal
        // au lieu d'un simple message rouge inline.
        if (resp.status === 403 && data?.code === 'quota_exceeded') {
          setPaywall({
            quota: 'simulator_sessions',
            used: typeof data.used === 'number' ? data.used : undefined,
            limit: typeof data.limit === 'number' ? data.limit : undefined,
            message: typeof data.error === 'string' ? data.error : undefined,
          })
          setLaunching(false)
          return
        }
        // Autres erreurs : message inline classique
        const msg = (data?.error as string)
          || 'Impossible de lancer la session. Réessaie dans un instant.'
        setQuotaError(msg)
        setLaunching(false)
        return
      }
    } catch {
      setQuotaError('Connexion impossible. Vérifie ta connexion et réessaie.')
      setLaunching(false)
      return
    }

    // 2. Quota OK : on construit la session normalement
    let qs = [...availableQuestions]

    if (selectionMode === 'weak') {
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
    if (duration !== null) {
      setTimeLeft(duration * 60)
    } else {
      setTimeLeft(0)
    }
    setPhase('session')
    setLaunching(false)
  }

  // Toggle pour QCM (multi), remplace pour QCS (single).
  // Le revealed en mode apprentissage ne se déclenche QUE quand l'élève clique
  // "Valider" (cf validateCurrent ci-dessous) — avant ce clic, il peut cocher /
  // décocher librement les options.
  function selectOption(optIdx: number) {
    if (mode === 'apprentissage' && revealed[currentIdx]) return

    const q = sessionQuestions[currentIdx]
    if (!q) return
    const multi = q.answer.length >= 2
    const current = answers[currentIdx] ?? []
    const has = current.includes(optIdx)

    let nextSelected: number[]
    if (multi) {
      nextSelected = has ? current.filter(i => i !== optIdx) : [...current, optIdx].sort((a, b) => a - b)
    } else {
      // QCS : on remplace (= un radio button)
      nextSelected = has ? [] : [optIdx]
    }
    const newAnswers = [...answers]
    newAnswers[currentIdx] = nextSelected
    setAnswers(newAnswers)
  }

  // En mode apprentissage : passe la question en revealed pour afficher
  // la correction + l'explication. En mode examen : pas de validation par
  // question, tout est révélé d'un coup à la fin.
  function validateCurrent() {
    if (mode !== 'apprentissage') return
    if (revealed[currentIdx]) return
    const sel = answers[currentIdx]
    if (!sel || sel.length === 0) return
    const newRevealed = [...revealed]
    newRevealed[currentIdx] = true
    setRevealed(newRevealed)
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
    setTimeLeft(0)
  }

  function replayMissed() {
    // Une question est "ratée" si la sélection n'égale pas exactement
    // le set des bonnes réponses (tout-ou-rien pour le replay, plus simple
    // que le score discordance ici).
    const missed = sessionQuestions.filter((q, i) => {
      const a = answers[i]
      return a !== null && !arraysEqualAsSets(a, q.answer)
    })
    if (missed.length === 0) { newSession(); return }
    setSessionQuestions(missed)
    setCurrentIdx(0)
    setAnswers(new Array(missed.length).fill(null))
    setRevealed(new Array(missed.length).fill(false))
    setSelfRatings(new Array(missed.length).fill(''))
    if (duration !== null) {
      setTimeLeft(duration * 60)
    } else {
      setTimeLeft(0)
    }
    setPhase('session')
  }

  // Score "tout-ou-rien" pour les compteurs Bonnes / Ratées (lisible dans
  // la UI). Le vrai score pondéré (discordance) est calculé séparément
  // pour le pourcentage final.
  const correctCount = answers.filter((a, i) => {
    const q = sessionQuestions[i]
    return a !== null && q && arraysEqualAsSets(a, q.answer)
  }).length
  const wrongCount = answers.filter((a, i) => {
    const q = sessionQuestions[i]
    return a !== null && a.length > 0 && q && !arraysEqualAsSets(a, q.answer)
  }).length
  const answeredCount = answers.filter(a => a !== null && a.length > 0).length

  // Score pondéré selon le système de scoring de la fac (discordance progressive
  // par défaut). Somme des scores par question / nb total de questions, x100.
  const weightedScoreSum = useMemo(() => {
    let sum = 0
    for (let i = 0; i < sessionQuestions.length; i++) {
      const q = sessionQuestions[i]
      const a = answers[i]
      if (!q || a === null) continue  // non répondue = 0
      sum += scoring.score(a, q.answer, q.options.length)
    }
    return sum
  }, [sessionQuestions, answers, scoring])
  const score = sessionQuestions.length > 0
    ? Math.round((weightedScoreSum / sessionQuestions.length) * 100)
    : 0

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

  function renderConfig() {
    const launchableCount = Math.min(nbQuestions, totalAvailable)
    const nbMatieres = selectedSysIds.size

    // Validation par étape pour activer "Suivant".
    const step1Ok = selectedSysIds.size > 0 && totalAvailable > 0
    const canLaunch = step1Ok
    const stepCanNext =
      step === 1 ? step1Ok
      : step === 2 ? source !== 'annales'
      : step === 3 ? true
      : true

    const STEPS = [
      { n: 1, label: 'Quoi réviser' },
      { n: 2, label: 'Avec quoi' },
      { n: 3, label: 'Comment' },
      { n: 4, label: 'Conditions' },
    ]

    return (
      <div className="sim-page">
        <div className="sim-header">
          <div>
            <h1 className="sim-title">Simulateur d&apos;<em>examen</em></h1>
            <div className="sim-sub">
              Multi-matières · chronométré · corrigé. Une décision par étape, puis on lance.
            </div>
          </div>
        </div>

        {/* Barre de progression du wizard */}
        <div className="sim-wiz-steps">
          {STEPS.map((s, i) => (
            <div key={s.n} className="sim-wiz-step-wrap">
              <button
                type="button"
                className={`sim-wiz-step${step === s.n ? ' active' : ''}${step > s.n ? ' done' : ''}`}
                onClick={() => { if (s.n < step) setStep(s.n) }}
                disabled={s.n > step}
              >
                <span className="sim-step-dot">{step > s.n ? '✓' : s.n}</span>
                <span className="sim-step-label">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="sim-wiz-step-line" />}
            </div>
          ))}
        </div>

        <div className="sim-wiz">
          {/* ====================== ÉTAPE 1 — Portée ====================== */}
          {step === 1 && (
            <div className="sim-wiz-body">
              <div className="sim-wiz-q">Quoi réviser ?</div>

              <div className="sim-wiz-mat-head">
                <span className="sim-wiz-mat-count">
                  {nbMatieres} matière{nbMatieres > 1 ? 's' : ''}
                  {totalAvailable > 0 ? ` · ${totalAvailable} question${totalAvailable > 1 ? 's' : ''}` : ''}
                </span>
                <button
                  type="button"
                  className="sim-wiz-link"
                  onClick={() => {
                    if (selectedSysIds.size === semSystems.length) {
                      setSelectedSysIds(new Set())
                    } else {
                      setSelectedSysIds(new Set(semSystems.map(s => s.id)))
                    }
                  }}
                >
                  {selectedSysIds.size === semSystems.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>

              <div className="sim-wiz-mat-grid">
                {semSystems.length === 0 ? (
                  <div className="sim-mat-empty">
                    Aucune matière pour {semester === 'year' ? "l'année" : `le semestre ${semester}`}.
                  </div>
                ) : semSystems.map((sys) => {
                  const isSel = selectedSysIds.has(sys.id)
                  const qCount = countQuestionsForSystem(sys.id)
                  const sysColor = colorOfSystem.get(sys.id) ?? PALETTE[0]
                  return (
                    <button
                      key={sys.id}
                      type="button"
                      className={`sim-wiz-chip${isSel ? ' sel' : ''}`}
                      onClick={() => {
                        const next = new Set(selectedSysIds)
                        if (isSel) next.delete(sys.id); else next.add(sys.id)
                        setSelectedSysIds(next)
                        // Retire de la sélection fiches celles dont la matière sort.
                        if (isSel && selectedLessonIds.size > 0) {
                          const nextL = new Set(selectedLessonIds)
                          for (const l of lessons) {
                            if (l.system_id === sys.id) nextL.delete(l.id)
                          }
                          setSelectedLessonIds(nextL)
                        }
                      }}
                      style={{ ['--chip' as never]: sysColor }}
                    >
                      <span className="sim-wiz-chip-ic"><SubjectIcon name={sys.name} /></span>
                      <span className="sim-wiz-chip-name">{sys.name}</span>
                      <span className="sim-wiz-chip-q">{qCount}</span>
                    </button>
                  )
                })}
              </div>

              {pickerLessons.length > 0 && (() => {
                const q = lessonSearch.trim().toLowerCase()
                const matchFiche = (l: typeof pickerLessons[number]) =>
                  !q || l.name.toLowerCase().includes(q)
                // Fiches groupées par matière sélectionnée, dans l'ordre du grid.
                const groups = semSystems
                  .filter(sys => selectedSysIds.has(sys.id))
                  .map(sys => ({
                    sys,
                    fiches: pickerLessons.filter(l => l.systemId === sys.id),
                  }))
                  .filter(g => g.fiches.length > 0)
                return (
                  <div className="sim-wiz-fiches">
                    <div className="sim-wiz-fiches-head">
                      <span className="sim-wiz-sublabel">Fiches</span>
                      <span className="sim-wiz-sublabel-note">
                        {selectedLessonIds.size === 0
                          ? 'aucune cochée = toutes'
                          : `${selectedLessonIds.size} ciblée${selectedLessonIds.size > 1 ? 's' : ''}`}
                      </span>
                      {selectedLessonIds.size > 0 && (
                        <button type="button" className="sim-wiz-link" onClick={() => setSelectedLessonIds(new Set())}>
                          Réinitialiser
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      className="sim-wiz-search"
                      placeholder="Rechercher une fiche…"
                      value={lessonSearch}
                      onChange={e => setLessonSearch(e.target.value)}
                    />
                    <div className="sim-wiz-groups">
                      {groups.map(({ sys, fiches }) => {
                        const visible = fiches.filter(matchFiche)
                        if (q && visible.length === 0) return null
                        const expanded = openSys.has(sys.id) || q.length > 0
                        const sysColor = colorOfSystem.get(sys.id) ?? PALETTE[0]
                        const pickedInSys = fiches.filter(l => selectedLessonIds.has(l.id)).length
                        return (
                          <div key={sys.id} className="sim-wiz-group">
                            <button
                              type="button"
                              className={`sim-wiz-group-head${expanded ? ' open' : ''}`}
                              onClick={() => {
                                const next = new Set(openSys)
                                if (next.has(sys.id)) next.delete(sys.id); else next.add(sys.id)
                                setOpenSys(next)
                              }}
                              style={{ ['--chip' as never]: sysColor }}
                            >
                              <span className="sim-wiz-group-ic"><SubjectIcon name={sys.name} /></span>
                              <span className="sim-wiz-group-name">{sys.name}</span>
                              <span className="sim-wiz-group-count">{pickedInSys}/{fiches.length} fiches</span>
                              <span className="sim-wiz-group-chev" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                              </span>
                            </button>
                            {expanded && (
                              <div className="sim-wiz-group-body">
                                <div className="sim-wiz-group-actions">
                                  <button
                                    type="button"
                                    className="sim-wiz-link"
                                    onClick={() => {
                                      const next = new Set(selectedLessonIds)
                                      fiches.forEach(l => next.add(l.id))
                                      setSelectedLessonIds(next)
                                    }}
                                  >Toutes</button>
                                  <button
                                    type="button"
                                    className="sim-wiz-link"
                                    onClick={() => {
                                      const next = new Set(selectedLessonIds)
                                      fiches.forEach(l => next.delete(l.id))
                                      setSelectedLessonIds(next)
                                    }}
                                  >Aucune</button>
                                </div>
                                <div className="sim-wiz-group-list">
                                  {visible.map(l => {
                                    const checked = selectedLessonIds.has(l.id)
                                    return (
                                      <button
                                        key={l.id}
                                        type="button"
                                        className={`sim-wiz-fiche${checked ? ' sel' : ''}`}
                                        onClick={() => {
                                          const next = new Set(selectedLessonIds)
                                          if (checked) next.delete(l.id); else next.add(l.id)
                                          setSelectedLessonIds(next)
                                        }}
                                      >
                                        <span className="sim-wiz-fiche-check" />
                                        <span className="sim-wiz-fiche-name">{l.name}</span>
                                        <span className="sim-wiz-fiche-q">{l.qCount}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ====================== ÉTAPE 2 — Source ====================== */}
          {step === 2 && (
            <div className="sim-wiz-body sim-wiz-body-center">
              <div className="sim-wiz-q">Avec quoi tu révises ?</div>
              <div className="sim-wiz-hint">La source des questions de cette session.</div>

              <div className="sim-wiz-cards sim-wiz-cards-big">
                <button
                  type="button"
                  className={`sim-wiz-card${source === 'genere' ? ' sel' : ''}`}
                  onClick={() => setSource('genere')}
                >
                  <span className="sim-wiz-card-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2Z" />
                    </svg>
                  </span>
                  <div className="sim-wiz-card-h">QCM généré</div>
                  <div className="sim-wiz-card-sub">Questions générées par l&apos;IA depuis tes fiches.</div>
                </button>

                <button
                  type="button"
                  className={`sim-wiz-card${source === 'rate' ? ' sel' : ''}`}
                  onClick={() => setSource('rate')}
                >
                  <span className="sim-wiz-card-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a10 10 0 1 0 10 10" />
                      <path d="M22 12A10 10 0 0 0 12 2v10Z" />
                      <path d="m8 12 3 3 5-6" />
                    </svg>
                  </span>
                  <div className="sim-wiz-card-h">{"Ce que j'ai raté"}</div>
                  <div className="sim-wiz-card-sub">Priorise tes points faibles, tes fiches les plus basses.</div>
                </button>

                <button
                  type="button"
                  className="sim-wiz-card disabled"
                  disabled
                  aria-disabled="true"
                >
                  <span className="sim-wiz-card-ic" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <path d="M14 2v6h6M9 13h6M9 17h6" />
                    </svg>
                  </span>
                  <div className="sim-wiz-card-h">
                    Annales
                    <span className="sim-wiz-badge">Bientôt</span>
                  </div>
                  <div className="sim-wiz-card-sub">Les vrais sujets, bientôt avec l&apos;import de PDF.</div>
                </button>
              </div>
            </div>
          )}

          {/* ====================== ÉTAPE 3 — Mode ====================== */}
          {step === 3 && (
            <div className="sim-wiz-body">
              <div className="sim-wiz-q">Comment tu veux travailler ?</div>
              <div className="sim-wiz-hint">Le mode change le feedback pendant la session.</div>

              <div className="sim-mode-pills sim-wiz-modes">
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
                    <div className="sim-mp-app-opt right"><span className="mark">C.</span>Redistribution sanguine<span className="check">{'✓'}</span></div>
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
          )}

          {/* ====================== ÉTAPE 4 — Réglages + récap ====================== */}
          {step === 4 && (
            <div className="sim-wiz-body">
              <div className="sim-wiz-q">Conditions {mode === 'examen' ? <em>réelles</em> : <em>d&apos;entraînement</em>}</div>

              <div className="sim-cond-tiles">
                <div className="sim-cond-tile">
                  <div className="sim-cond-tile-v">{examQuestionCount}</div>
                  <div className="sim-cond-tile-l">questions</div>
                </div>
                {mode === 'examen' ? (
                  <div className="sim-cond-tile">
                    <div className="sim-cond-tile-v">{examDurationMin} min</div>
                    <div className="sim-cond-tile-l">chrono imposé</div>
                  </div>
                ) : (
                  <div className="sim-cond-tile wide">
                    <div className="sim-cond-tile-v">Sans chrono</div>
                    <div className="sim-cond-tile-l">correction en direct</div>
                  </div>
                )}
                <div className="sim-cond-tile" title={scoring.desc}>
                  <div className="sim-cond-tile-v sm">{scoring.label}</div>
                  <div className="sim-cond-tile-l">barème</div>
                </div>
              </div>

              {quotaError && (
                <div role="alert" className="sim-wiz-error">{quotaError}</div>
              )}
            </div>
          )}
        </div>

        {/* ====================== Navigation ====================== */}
        <div className="sim-nav">
          {step > 1 ? (
            <button type="button" className="sim-nav-btn" onClick={() => setStep(s => Math.max(1, s - 1))}>
              ← Retour
            </button>
          ) : <span />}

          {step < 4 ? (
            <button
              type="button"
              className="sim-nav-btn primary"
              disabled={!stepCanNext}
              onClick={() => setStep(s => Math.min(4, s + 1))}
            >
              Suivant →
            </button>
          ) : (
            <button
              className="sim-nav-btn launch"
              disabled={!canLaunch || launching}
              onClick={launchSession}
            >
              {launching
                ? 'Lancement…'
                : !canLaunch
                  ? (totalAvailable === 0 ? 'Aucune question disponible' : 'Sélectionne au moins une matière')
                  : `Lancer la session (${launchableCount}) →`}
            </button>
          )}
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
      </div>
    )
  }

  function renderSession() {
    const q = sessionQuestions[currentIdx]
    if (!q) return <div className="sim-page"><div className="sim-loading">…</div></div>
    const selectedAnswer = answers[currentIdx] ?? []
    const isRevealed = mode === 'apprentissage' && revealed[currentIdx]
    const correctIdxs = q.answer
    const isMulti = correctIdxs.length >= 2

    return (
      <div className="sim-page">
        <div className="sim-ses-header">
          <div className="sim-ses-header-l">
            <span className={`sim-ses-tag ${mode === 'apprentissage' ? 'app' : 'ex'}`}>
              {mode === 'apprentissage' ? 'Apprentissage' : 'Examen blanc'}
            </span>
            <span className="sim-ses-tag-sub">
              {mode === 'apprentissage'
                ? 'Réponse révélée + explication à chaque question'
                : `Aucun feedback avant la fin · scoring "${scoring.label}"`}
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

        <div className="sim-ses-grid">
          <div className="sim-ses-q">
            <div className="sim-ses-q-meta">
              <em>Question {currentIdx + 1} / {sessionQuestions.length}</em>
              {q.systemName && <span className="sim-ses-q-source">{q.systemName}{q.lessonName ? ` · ${q.lessonName}` : ''}</span>}
              <span className={`sim-ses-q-type${isMulti ? ' multi' : ''}`}>
                {isMulti ? 'QCM · plusieurs bonnes' : 'QCS · une seule bonne'}
              </span>
            </div>
            <div className="sim-ses-q-text">{q.question}</div>

            <div className={`sim-ses-q-options${isMulti ? ' multi' : ''}`}>
              {q.options.map((opt, i) => {
                const isSelected = selectedAnswer.includes(i)
                const isCorrect = correctIdxs.includes(i)
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
                    onClick={() => selectOption(i)}
                    disabled={isRevealed}
                    type="button"
                    role={isMulti ? 'checkbox' : 'radio'}
                    aria-checked={isSelected}
                  >
                    <span className="sim-ses-q-opt-letter">{letterFor(i)}.</span>
                    {opt}
                    {isRevealed && isCorrect && !isSelected && <span className="sim-ses-q-opt-mark">manquée</span>}
                  </button>
                )
              })}
            </div>

            {mode === 'apprentissage' && !isRevealed && (
              <div className="sim-ses-nav" style={{ marginTop: 18 }}>
                <button
                  className="sim-ses-nav-btn primary"
                  onClick={validateCurrent}
                  disabled={selectedAnswer.length === 0}
                >
                  Valider ma réponse {isMulti && selectedAnswer.length > 0 ? `(${selectedAnswer.length} coché${selectedAnswer.length > 1 ? 'es' : 'e'})` : ''} →
                </button>
              </div>
            )}

            {mode === 'apprentissage' && isRevealed && (
              <>
                <div className="sim-ses-explain">
                  <div className="sim-ses-explain-h">
                    Explication
                    <span className="sim-ses-explain-score">
                      {scoring.score(selectedAnswer, correctIdxs, q.options.length).toFixed(2).replace(/\.00$/, '')} pt
                    </span>
                  </div>
                  <div className="sim-ses-explain-text">
                    {q.explanation ? (
                      q.explanation
                    ) : (
                      <>
                        Bonne{correctIdxs.length > 1 ? 's' : ''} réponse{correctIdxs.length > 1 ? 's' : ''} :{' '}
                        <strong>
                          {correctIdxs.map(idx => `${letterFor(idx)}. ${q.options[idx]}`).join(' · ')}
                        </strong>.
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

          <div className="sim-ses-sheet">
            <div className="sim-ses-sheet-h">
              Grille de réponses
              <span className="sim-meta">
                {mode === 'apprentissage' ? 'vert = correct · rouge = raté' : 'clique pour répondre · navigation par ligne'}
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

  function renderResults() {
    const message = score >= 70 ? 'Excellente session' : score >= 50 ? 'Bonne session' : 'À retravailler'
    const submessage = score >= 70 ? 'tu maîtrises l\'essentiel.' : score >= 50 ? 'tu progresses, continue.' : 'c\'est en faisant les fautes qu\'on apprend.'
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
            <div className="sim-res-scoring" title={scoring.desc}>
              Scoring : <strong>{scoring.label}</strong>
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
              <div className="sim-res-rates-h">Ressenti · répartition de tes réponses</div>
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

// ============================================================
// SHEET GRID — bug 4 fix : header A B C D E par colonne
// ============================================================
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
  answers: (number[] | null)[]
  revealed: boolean[]
  currentIdx: number
  mode: Mode
  onRowClick: (i: number) => void
  onBubbleClick: (qi: number, oi: number) => void
}) {
  const total = questions.length
  const half = Math.ceil(total / 2)
  const col1 = questions.slice(0, half)
  const col2 = questions.slice(half)

  const maxOpts = questions.reduce((m, q) => Math.max(m, q.options.length), 5)
  const letters = Array.from({ length: maxOpts }, (_, i) => letterFor(i))

  function renderRow(q: Question, qi: number) {
    const isCurrent = qi === currentIdx
    const ans = answers[qi] ?? []
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
          const filled = ans.includes(oi)
          const isCorrectOpt = q.answer.includes(oi)
          let cls = 'sim-ses-sheet-bubble'
          if (filled) cls += ' filled'
          if (isRevealed) {
            // Vert si bonne réponse (cochée ou pas) ; rouge si cochée par erreur
            if (isCorrectOpt) cls = 'sim-ses-sheet-bubble ok'
            else if (filled) cls = 'sim-ses-sheet-bubble bad'
          }
          return (
            <button
              key={oi}
              className={cls}
              onClick={(e) => { e.stopPropagation(); onBubbleClick(qi, oi) }}
              aria-pressed={filled}
            />
          )
        })}
      </div>
    )
  }

  const headerJsx = (
    <div
      className="sim-ses-sheet-headers"
      style={{ gridTemplateColumns: `26px repeat(${maxOpts}, 1fr)` }}
    >
      <div className="h"></div>
      {letters.map(l => <div key={l} className="h">{l}</div>)}
    </div>
  )

  return (
    <div className="sim-ses-sheet-wrap">
      <div className="sim-ses-sheet-grid">
        <div>
          {headerJsx}
          {col1.map((q, i) => (
            <div key={i} style={{ ['--cols' as never]: maxOpts }}>{renderRow(q, i)}</div>
          ))}
        </div>
        <div>
          {headerJsx}
          {col2.map((q, i) => (
            <div key={i + half} style={{ ['--cols' as never]: maxOpts }}>{renderRow(q, i + half)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
