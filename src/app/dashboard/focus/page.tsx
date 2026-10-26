'use client'
// src/app/dashboard/focus/page.tsx
//
// SESSION DE TRAVAIL (refonte 2026-10, remplace la session « bibliothèque »).
//
// Les fiches dues aujourd'hui, l'une après l'autre, chacune en 3 étapes :
//   1. Relire      : la fiche de synthèse (courte) + les erreurs de l'étudiante,
//                    le poly complet en un clic.
//   2. S'entraîner : jusqu'à 10 QCM de la fiche, dans la page (ratées d'abord).
//                    Chaque erreur devient une flashcard (src/lib/qcmMissed.ts) et
//                    les compteurs de chaque question sont mis à jour.
//   3. Se noter    : avec le résultat des QCM sous les yeux et une note proposée.
//                    La note est enregistrée comme avant (score officiel, ou
//                    temporaire si le palier n'est pas encore dû).
//
// Paramètres d'URL inchangés : ?lesson=<id> (cette fiche en premier),
// ?system=<id> (une matière), ?lessons=id1,id2 (retravailler, notes temporaires).
//
// Temps de travail : toujours compté par jour dans gardens.day_log (page Stats,
// carte Progression du tableau de bord). Les colonnes de l'ancienne
// bibliothèque (fiches_count, book_log) ne sont plus écrites, ni effacées.

import { reviewDate } from '@/lib/restDays'
import '@/components/review-modal.css'
import { QCM_COUNTS, getQcmCount, setQcmCount, type QcmCount } from '@/lib/qcmCount'
import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson, AiQuestion, AiQuestionSourceRef, LessonMedia, Flashcard } from '@/types'
import { toDateStr, todayStr, normalizeAnswer } from '@/types'
import { DEFAULT_J, scheduleOf, makeScheduleResolver } from '@/lib/schedule'
import { normalizeYear, scopeToYear } from '@/lib/year'
import { isMissed, addCardsFromMistakes } from '@/lib/qcmMissed'
import { buildSubjectColorMap } from '@/lib/subjectColors'
import { cleanExplanation, whyFor, correctAnswersRecap } from '@/lib/qcmText'
import { startGen, finishGen, useGenJobs } from '@/lib/qcmGenStore'
import { countPdfPages } from '@/lib/pdf'
import { FREE_PDF_SIZE_MB, FREE_VIDEO_SIZE_MB } from '@/types'
import GenProgress from '@/components/GenProgress'
import SourceLightbox from '@/components/SourceLightbox'
import QuestionFigure from '@/components/QuestionFigure'
import ReportQuestion from '@/components/ReportQuestion'
import PageLoader from '@/components/PageLoader'
import './styles.css'

// ===================== TYPES =====================
type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string; temp_score?: number } | null
type DueInfo = { stepIndex: number; dueDate: string; status: 'missed' | 'today' | 'fresh'; overdueDays: number }
type QueueItem = { lesson: Lesson; due: DueInfo; lastScore: Score | null; lastDate: string | null }
type Result = { kind: 'rated'; score: Score } | { kind: 'reported' }
type Phase = 'loading' | 'empty' | 'session' | 'done'
type Step = 0 | 1 | 2
type Attempt = { origIdx: number; selected: number[]; correct: boolean }

const TRAIN_SIZE = 10
const CARDS_SIZE = 10
const GRADE_LABELS: Record<Score, [string, string]> = {
  1: ['À revoir', "Je ne m'en souvenais presque pas"],
  2: ['Faible', 'Beaucoup de trous'],
  3: ['Moyen', "L'essentiel, avec des erreurs"],
  4: ['Bien', 'Quelques détails à revoir'],
  5: ['Maîtrisé', 'Tout était là'],
}

// ===================== DATES & PLANNING (logique reprise de l'ancienne session) =====================
function dateStrFromOffset(base: string, offset: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  return toDateStr(d)
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}
function prettyDate(d: string): string {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) } catch { return d }
}
function shortDate(d: string): string {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) } catch { return d }
}
function stepScore(s: StepEntry): Score | null {
  if (!s) return null
  if (typeof s.score === 'number' && s.score >= 1 && s.score <= 5) return s.score as Score
  if (typeof s.ok === 'boolean') return s.ok ? 5 : 1
  return null
}
function effectiveStepScore(s: StepEntry): Score | null {
  const off = stepScore(s)
  if (off) return off
  const t = s?.temp_score
  return typeof t === 'number' && t >= 1 && t <= 5 ? (t as Score) : null
}
function stepDate(lesson: Lesson, i: number, j: number[]): string {
  return lesson.learn_date ? reviewDate(lesson.learn_date, j[i]) : ''
}
function getLast(lesson: Lesson, j: number[]): { score: Score | null; date: string | null } {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = j.length - 1; i >= 0; i--) {
    const sc = effectiveStepScore(steps[i])
    if (sc) return { score: sc, date: steps[i]?.date ?? null }
  }
  return { score: null, date: null }
}
function lessonSkips(l: Lesson): number[] {
  const s = (l as { skips?: unknown }).skips
  return Array.isArray(s) ? (s as number[]) : []
}
function lessonPostpones(l: Lesson): Record<string, string> {
  const p = (l as { postpones?: unknown }).postpones
  return p && typeof p === 'object' ? (p as Record<string, string>) : {}
}
function getDueOn(lesson: Lesson, day: string, j: number[]): DueInfo | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  const skips = lessonSkips(lesson)
  const postpones = lessonPostpones(lesson)
  for (let i = 0; i < j.length; i++) {
    if (stepScore(steps[i])) continue
    if (skips.includes(i)) continue
    const dd = postpones[String(i)] ?? stepDate(lesson, i, j)
    if (dd <= day) return { stepIndex: i, dueDate: dd, status: dd === day ? 'today' : 'missed', overdueDays: dd < day ? daysBetween(dd, day) : 0 }
    break
  }
  return null
}
function getNextUndone(lesson: Lesson, j: number[]): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < j.length; i++) if (!stepScore(steps[i])) return i
  return null
}
function syntheticDue(l: Lesson, j: number[], today: string): DueInfo | null {
  const due = getDueOn(l, today, j)
  if (due) return due
  const idx = getNextUndone(l, j)
  if (idx === null) return null
  if (!l.learn_date) return { stepIndex: idx, dueDate: today, status: 'fresh', overdueDays: 0 }
  const dd = stepDate(l, idx, j)
  return { stepIndex: idx, dueDate: dd, status: dd <= today ? (dd === today ? 'today' : 'missed') : 'fresh', overdueDays: dd < today ? daysBetween(dd, today) : 0 }
}
function item(l: Lesson, due: DueInfo, j: number[]): QueueItem {
  const last = getLast(l, j)
  return { lesson: l, due, lastScore: last.score, lastDate: last.date }
}
function buildQueue(lessons: Lesson[], systems: System[], lessonParam: string | null, systemParam: string | null, lessonsParam: string | null, today: string): QueueItem[] {
  const schedOf = makeScheduleResolver(systems)
  if (lessonsParam) {
    return lessonsParam.split(',').map(s => s.trim()).filter(Boolean)
      .map(id => lessons.find(x => x.id === id))
      .filter((l): l is Lesson => !!l)
      .map(l => { const j = schedOf(l.system_id); const d = syntheticDue(l, j, today); return d ? item(l, d, j) : null })
      .filter((x): x is QueueItem => !!x)
  }
  let pool: Lesson[]
  if (systemParam) pool = lessons.filter(l => l.system_id === systemParam)
  else {
    const semRaw = typeof window !== 'undefined' ? localStorage.getItem('medrev-sem') : null
    const sem: 1 | 2 | 'year' = semRaw === '1' ? 1 : semRaw === 'year' ? 'year' : 2
    pool = sem === 'year' ? lessons : lessons.filter(l => systems.find(s => s.id === l.system_id)?.semestre === sem)
  }
  const q: QueueItem[] = []
  for (const l of pool) {
    const j = schedOf(l.system_id)
    const d = getDueOn(l, today, j)
    if (d) q.push(item(l, d, j))
  }
  q.sort((a, b) => schedOf(a.lesson.system_id)[a.due.stepIndex] - schedOf(b.lesson.system_id)[b.due.stepIndex])
  if (lessonParam) {
    const at = q.findIndex(x => x.lesson.id === lessonParam)
    if (at > 0) q.unshift(q.splice(at, 1)[0])
    else if (at === -1) {
      const l = lessons.find(x => x.id === lessonParam)
      if (l) { const j = schedOf(l.system_id); const d = syntheticDue(l, j, today); if (d) q.unshift(item(l, d, j)) }
    }
  }
  return q
}

// ===================== TEMPS DE TRAVAIL (gardens.day_log) =====================
type SbClient = ReturnType<typeof createClient>
type TimeState = { startedDate?: string; elapsedMs: number; dayLog: Record<string, number> }
function parseDayLog(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'number' && v > 0) out[k] = v
  return out
}
function pruneDayLog(log: Record<string, number>): Record<string, number> {
  const keys = Object.keys(log).sort()
  if (keys.length <= 220) return log
  const out: Record<string, number> = {}
  for (const k of keys.slice(-220)) out[k] = log[k]
  return out
}
async function pullTime(supabase: SbClient, userId: string): Promise<TimeState> {
  try {
    const { data } = await supabase.from('gardens').select('started_date, elapsed_ms, day_log').eq('user_id', userId).maybeSingle()
    const d = data as { started_date?: string; elapsed_ms?: number; day_log?: unknown } | null
    return { startedDate: d?.started_date ?? undefined, elapsedMs: Number(d?.elapsed_ms ?? 0), dayLog: parseDayLog(d?.day_log) }
  } catch { return { elapsedMs: 0, dayLog: {} } }
}
function pushTime(supabase: SbClient, userId: string | null, s: TimeState) {
  if (!userId) return
  // Seules ces colonnes sont écrites : celles de l'ancienne bibliothèque restent intactes.
  void supabase.from('gardens').upsert(
    { user_id: userId, started_date: s.startedDate ?? todayStr(), elapsed_ms: s.elapsedMs, day_log: pruneDayLog(s.dayLog) },
    { onConflict: 'user_id' },
  ).then(() => {}, () => {})
}

// ===================== QCM : tirage pour l'entraînement =====================
function pickTraining(qs: AiQuestion[]): number[] {
  const idx = qs.map((_, i) => i)
  const shuffle = (a: number[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [b[i], b[k]] = [b[k], b[i]] } return b }
  const missed = shuffle(idx.filter(i => isMissed(qs[i])))
  const fresh = shuffle(idx.filter(i => !isMissed(qs[i]) && !(qs[i].attempts || 0)))
  const rest = shuffle(idx.filter(i => !isMissed(qs[i]) && (qs[i].attempts || 0) > 0))
  return [...missed, ...fresh, ...rest].slice(0, TRAIN_SIZE)
}
function suggestGrade(ok: number, total: number): Score | null {
  if (total === 0) return null
  const r = ok / total
  return r >= 0.9 ? 5 : r >= 0.75 ? 4 : r >= 0.55 ? 3 : r >= 0.35 ? 2 : 1
}
// Flashcards à revoir : d'abord les jamais vues (dont celles créées par les
// erreurs de QCM), puis les moins bien sues.
function pickDeck(cards: Flashcard[]): string[] {
  const ratio = (c: Flashcard) => (c.reviews ? (c.known || 0) / c.reviews : -1)
  return [...cards]
    .map(c => ({ c, r: Math.random() }))
    .sort((a, b) => ratio(a.c) - ratio(b.c) || a.r - b.r)
    .slice(0, CARDS_SIZE)
    .map(x => x.c.id)
}
const stripLetter = (s: string) => s.replace(/^\s*[A-E][.)]\s*/, '')

// ===================== PAGE =====================
export default function FocusPage() {
  return (
    <Suspense fallback={<div className="se-root"><PageLoader label="Préparation de ta session…" /></div>}>
      <SessionBody />
    </Suspense>
  )
}

function SessionBody() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const lessonParam = searchParams.get('lesson')
  const systemParam = searchParams.get('system')
  const lessonsParam = searchParams.get('lessons')
  const today = todayStr()

  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<(Result | null)[]>([])
  const [busy, setBusy] = useState(false)

  // Chrono (avec pause)
  const [startedAt, setStartedAt] = useState(0)
  const [pausedMs, setPausedMs] = useState(0)
  const [pauseFrom, setPauseFrom] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const timeRef = useRef<TimeState>({ elapsedMs: 0, dayLog: {} })

  // Étape de la fiche en cours + entraînement
  const [step, setStep] = useState<Step>(0)
  const [plan, setPlan] = useState<number[]>([])
  const [qi, setQi] = useState(0)
  const [sel, setSel] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [trainSaved, setTrainSaved] = useState<{ ok: number; total: number; cards: number } | null>(null)
  const [grade, setGrade] = useState<Score | null>(null)
  const [gradeTouched, setGradeTouched] = useState(false)
  const [stats, setStats] = useState({ qcmOk: 0, qcmTotal: 0, cardsKnown: 0, cardsTotal: 0 })
  // Flashcards dans « S'entraîner »
  const [mode, setMode] = useState<'qcm' | 'cards'>('qcm')
  const [deck, setDeck] = useState<string[]>([])
  const [ci, setCi] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [cardRes, setCardRes] = useState<Record<string, boolean>>({})
  const [cardsSaved, setCardsSaved] = useState<{ known: number; total: number } | null>(null)
  const [source, setSource] = useState<AiQuestionSourceRef | null>(null)
  const [genSynth, setGenSynth] = useState<'idle' | 'running' | 'error'>('idle')
  const [genSynthErr, setGenSynthErr] = useState<string | null>(null)
  const [genQcmErr, setGenQcmErr] = useState<string | null>(null)

  const userIdRef = useRef<string | null>(null)
  const [planName, setPlanName] = useState<string | null>(null)
  const [uploading, setUploading] = useState<null | 'pdf' | 'video'>(null)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const pdfInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const genJobs = useGenJobs()
  // Mêmes couleurs de matière que les pages Fiches et Tableau de bord
  const colorMap = useMemo(() => buildSubjectColorMap(systems), [systems])

  // ---------- Chargement ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      if (cancelled) return
      setUserId(user.id); userIdRef.current = user.id
      const [{ data: sys }, { data: les }, { data: prof }, time] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id),
        supabase.from('lessons').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('current_year, plan').eq('id', user.id).single(),
        pullTime(supabase, user.id),
      ])
      if (cancelled) return
      timeRef.current = time
      setPlanName(((prof as { plan?: string } | null)?.plan) ?? null)
      const scoped = scopeToYear((sys as System[] | null) ?? [], (les as Lesson[] | null) ?? [], normalizeYear((prof as { current_year?: string } | null)?.current_year))
      setSystems(scoped.systems)
      setAllLessons(scoped.lessons)
      const q = buildQueue(scoped.lessons, scoped.systems, lessonParam, systemParam, lessonsParam, today)
      setQueue(q)
      setResults(new Array(q.length).fill(null))
      setIdx(0)
      if (q.length === 0) { setPhase('empty'); return }
      setStartedAt(Date.now()); setNow(Date.now())
      setPhase('session')
    })()
    return () => { cancelled = true }
  }, [supabase, router, lessonParam, systemParam, lessonsParam, today])

  const paused = pauseFrom !== null
  const elapsedMs = startedAt ? Math.max(0, (paused ? pauseFrom! : now) - startedAt - pausedMs) : 0

  // Tick d'affichage + temps de travail du jour (toutes les 30 s, hors pause)
  useEffect(() => {
    if (phase !== 'session') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])
  useEffect(() => {
    if (phase !== 'session' || paused) return
    const t = setInterval(() => {
      const cur = timeRef.current
      const dk = todayStr()
      const next = { ...cur, elapsedMs: cur.elapsedMs + 30000, dayLog: { ...cur.dayLog, [dk]: (cur.dayLog[dk] ?? 0) + 30000 } }
      timeRef.current = next
      pushTime(supabase, userIdRef.current, next)
    }, 30000)
    return () => clearInterval(t)
  }, [phase, paused, supabase])

  const current = queue[idx]
  const sys = current ? systems.find(s => s.id === current.lesson.system_id) : undefined
  const sysJ = scheduleOf(sys)
  const qs: AiQuestion[] = useMemo(() => (Array.isArray(current?.lesson.ai_questions) ? current!.lesson.ai_questions : []), [current])
  const media = (current?.lesson.media ?? {}) as LessonMedia

  // Remise à zéro quand on change de fiche
  const resetFiche = useCallback(() => {
    setStep(0); setPlan([]); setQi(0); setSel([]); setChecked(false); setAttempts([]); setTrainSaved(null)
    setGrade(null); setGradeTouched(false); setMode('qcm'); setDeck([]); setCi(0); setFlipped(false); setCardRes({}); setCardsSaved(null)
    setGenSynth('idle'); setGenSynthErr(null); setGenQcmErr(null)
  }, [])

  const replaceLesson = useCallback((l: Lesson) => {
    setQueue(q => q.map(it => (it.lesson.id === l.id ? { ...it, lesson: l } : it)))
    setAllLessons(a => a.map(x => (x.id === l.id ? l : x)))
  }, [])

  // La page défile dans .se-root (plein écran fixe) : on remonte en haut à chaque étape ou fiche.
  useEffect(() => { document.querySelector('.se-root')?.scrollTo({ top: 0 }) }, [step, idx])

  // ---------- Entraînement ----------
  const lessonCards: Flashcard[] = useMemo(() => (Array.isArray(current?.lesson.flashcards) ? (current!.lesson.flashcards as Flashcard[]) : []), [current])

  const startTraining = useCallback(() => {
    setStep(1)
    if (plan.length === 0 && !trainSaved) { setPlan(pickTraining(qs)); setQi(0); setSel([]); setChecked(false); setAttempts([]) }
    if (qs.length === 0 && lessonCards.length > 0 && deck.length === 0) { setMode('cards'); setDeck(pickDeck(lessonCards)); setCi(0); setFlipped(false) }
  }, [plan.length, trainSaved, qs, lessonCards, deck.length])

  // Enregistre les réponses (compteurs, dernière réussite) et crée les flashcards
  const saveTraining = useCallback(async (list: Attempt[]): Promise<Flashcard[]> => {
    if (!current || trainSaved) return lessonCards
    if (list.length === 0) { setTrainSaved({ ok: 0, total: 0, cards: 0 }); return lessonCards }
    const all = [...qs] as AiQuestion[]
    for (const a of list) {
      const q = all[a.origIdx]
      all[a.origIdx] = { ...q, attempts: (q.attempts || 0) + 1, correct: (q.correct || 0) + (a.correct ? 1 : 0), last_correct: a.correct }
    }
    const prevCards = Array.isArray(current.lesson.flashcards) ? (current.lesson.flashcards as Flashcard[]) : []
    const { cards, added } = addCardsFromMistakes(prevCards, list.filter(a => !a.correct).map(a => ({ q: qs[a.origIdx], selected: a.selected })))
    const ok = list.filter(a => a.correct).length
    setTrainSaved({ ok, total: list.length, cards: added })
    setStats(s => ({ ...s, qcmOk: s.qcmOk + ok, qcmTotal: s.qcmTotal + list.length }))
    replaceLesson({ ...current.lesson, ai_questions: all, flashcards: cards })
    const update: { ai_questions: AiQuestion[]; flashcards?: Flashcard[] } = { ai_questions: all }
    if (added > 0) update.flashcards = cards
    const { error } = await supabase.from('lessons').update(update).eq('id', current.lesson.id)
    if (error && added > 0) await supabase.from('lessons').update({ ai_questions: all }).eq('id', current.lesson.id)
    return cards
  }, [current, trainSaved, qs, supabase, replaceLesson, lessonCards])

  // Enregistre les flashcards revues (compteurs vues / sues)
  const saveCards = useCallback(async (res: Record<string, boolean>) => {
    if (!current || cardsSaved) return
    const ids = Object.keys(res)
    if (ids.length === 0) return
    const nowIso = new Date().toISOString()
    const cards = lessonCards.map(c => (c.id in res ? { ...c, reviews: (c.reviews || 0) + 1, known: (c.known || 0) + (res[c.id] ? 1 : 0), last_reviewed_at: nowIso } : c))
    const known = ids.filter(id => res[id]).length
    setCardsSaved({ known, total: ids.length })
    setStats(s => ({ ...s, cardsKnown: s.cardsKnown + known, cardsTotal: s.cardsTotal + ids.length }))
    replaceLesson({ ...current.lesson, flashcards: cards })
    await supabase.from('lessons').update({ flashcards: cards }).eq('id', current.lesson.id)
  }, [current, cardsSaved, lessonCards, replaceLesson, supabase])

  // Fin des QCM : on enchaîne sur les flashcards (dont celles tirées des erreurs)
  const finishQcm = useCallback(async () => {
    const cards = await saveTraining(attempts)
    if (cards.length > 0) { setMode('cards'); setDeck(d => (d.length ? d : pickDeck(cards))); setCi(0); setFlipped(false) }
    else setStep(2)
  }, [saveTraining, attempts])

  const openCards = useCallback(async () => {
    const cards = attempts.length && !trainSaved ? await saveTraining(attempts) : lessonCards
    setMode('cards')
    setDeck(d => (d.length ? d : pickDeck(cards)))
  }, [attempts, trainSaved, saveTraining, lessonCards])

  const markCard = useCallback((known: boolean) => {
    const id = deck[ci]
    if (!id) return
    const res = { ...cardRes, [id]: known }
    setCardRes(res)
    if (ci + 1 >= deck.length) { void saveCards(res); setStep(2) }
    else { setCi(ci + 1); setFlipped(false) }
  }, [deck, ci, cardRes, saveCards])

  const saveAllPending = useCallback(async () => {
    if (!trainSaved && attempts.length) await saveTraining(attempts)
    if (!cardsSaved && Object.keys(cardRes).length) await saveCards(cardRes)
  }, [trainSaved, attempts, saveTraining, cardsSaved, cardRes, saveCards])

  const goRate = useCallback(() => { void saveAllPending(); setStep(2) }, [saveAllPending])

  // Note proposée : QCM justes + flashcards sues, tant que l'étudiante n'a pas choisi
  const sugg = (() => {
    const ok = (trainSaved?.ok ?? 0) + (cardsSaved?.known ?? 0)
    const total = (trainSaved?.total ?? 0) + (cardsSaved?.total ?? 0)
    return { ok, total, grade: suggestGrade(ok, total) }
  })()
  useEffect(() => { if (step === 2 && !gradeTouched && sugg.grade) setGrade(sugg.grade) }, [step, gradeTouched, sugg.grade])

  const validate = useCallback(() => {
    const q = qs[plan[qi]]
    if (!q || sel.length === 0) return
    const correct = (() => { const a = normalizeAnswer(q.answer); return a.length === sel.length && a.every(x => sel.includes(x)) })()
    setAttempts(list => [...list, { origIdx: plan[qi], selected: sel, correct }])
    setChecked(true)
  }, [qs, plan, qi, sel])

  const nextQuestion = useCallback(() => {
    if (qi + 1 >= plan.length) { void finishQcm(); return }
    setQi(qi + 1); setSel([]); setChecked(false)
  }, [qi, plan.length, finishQcm])

  // ---------- Génération (QCM, synthèse) depuis la session ----------
  const [qcmNb, setQcmNbState] = useState<QcmCount>(10)
  useEffect(() => { setQcmNbState(getQcmCount()) }, [])
  const chooseQcmNb = (n: QcmCount) => { setQcmNbState(n); setQcmCount(n) }
  const [qcmPick, setQcmPick] = useState(false)

  const generateQcm = useCallback(async () => {
    if (!current) return
    setGenQcmErr(null)
    startGen(current.lesson.id, current.lesson.name)
    let ok = false
    try {
      const res = await fetch('/api/generate-qcm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: current.lesson.id, nbQ: getQcmCount(), format: 'mixed', difficulty: 'annales', mode: 'replace' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`)
      const { data: fresh } = await supabase.from('lessons').select('*').eq('id', current.lesson.id).single()
      if (fresh) { replaceLesson(fresh as Lesson); setPlan(pickTraining((fresh as Lesson).ai_questions || [])) }
      ok = true
    } catch (e) {
      setGenQcmErr(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      finishGen(current.lesson.id, ok)
    }
  }, [current, supabase, replaceLesson])

  const generateSynthese = useCallback(async () => {
    if (!current) return
    setGenSynth('running'); setGenSynthErr(null)
    try {
      const res = await fetch('/api/generate-synthese', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: current.lesson.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`)
      replaceLesson({ ...current.lesson, media: { ...(current.lesson.media as LessonMedia), synthese: (data as { synthese: LessonMedia['synthese'] }).synthese } })
      setGenSynth('idle')
    } catch (e) {
      setGenSynth('error'); setGenSynthErr(e instanceof Error ? e.message : 'Erreur inconnue')
    }
  }, [current, replaceLesson])

  // ---------- Ajouter le cours depuis la session ----------
  const uploadCourse = useCallback(async (file: File) => {
    if (!current || !userId) return
    setUploadErr(null)
    const kind: 'pdf' | 'video' | null = file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('video/') ? 'video' : null
    if (!kind) { setUploadErr('Dépose un PDF (le poly) ou une vidéo (le cours en amphi).'); return }
    const sizeMB = file.size / (1024 * 1024)
    if (planName === 'free' && kind === 'pdf' && sizeMB > FREE_PDF_SIZE_MB) { setUploadErr(`Ton PDF fait ${sizeMB.toFixed(0)} Mo. Le mode Gratuit limite à ${FREE_PDF_SIZE_MB} Mo.`); return }
    if (planName === 'free' && kind === 'video' && sizeMB > FREE_VIDEO_SIZE_MB) { setUploadErr(`Ta vidéo fait ${sizeMB.toFixed(0)} Mo. Le mode Gratuit limite à ${FREE_VIDEO_SIZE_MB} Mo.`); return }
    setUploading(kind)
    try {
      const prev = (current.lesson.media ?? {}) as LessonMedia
      const ext = kind === 'pdf' ? 'pdf' : ((file.name.split('.').pop() || 'mp4').toLowerCase())
      const path = `${userId}/${current.lesson.id}/${kind === 'pdf' ? 'poly' : 'cours'}.${ext}`
      if (kind === 'video' && prev.video_path && prev.video_path !== path) await supabase.storage.from('lesson-media').remove([prev.video_path])
      const { error: upErr } = await supabase.storage.from('lesson-media').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const nowIso = new Date().toISOString()
      const next: LessonMedia = kind === 'pdf'
        ? { ...prev, pdf_path: path, pdf_pages: (await countPdfPages(file)) ?? undefined, pdf_size: file.size, pdf_uploaded_at: nowIso, pdf_name: file.name }
        : { ...prev, video_path: path, video_size: file.size, video_uploaded_at: nowIso, video_name: file.name }
      const { error: dbErr } = await supabase.from('lessons').update({ media: next }).eq('id', current.lesson.id)
      if (dbErr) throw dbErr
      replaceLesson({ ...current.lesson, media: next })
      if (kind === 'video') {
        // Transcription en arrière-plan (comme depuis la fiche)
        const id = current.lesson.id
        void fetch('/api/transcribe-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: id }) })
          .then(async () => { const { data } = await supabase.from('lessons').select('*').eq('id', id).single(); if (data) replaceLesson(data as Lesson) })
          .catch(() => {})
      }
    } catch (e) {
      setUploadErr(`L'envoi a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
    } finally {
      setUploading(null)
    }
  }, [current, userId, planName, supabase, replaceLesson])

  // Crée en une fois ce qui manque : fiche de synthèse et QCM
  const createAll = useCallback(() => {
    if (!current) return
    const m = (current.lesson.media ?? {}) as LessonMedia & { transcript?: unknown[] }
    const canSynth = !!m.pdf_path || (Array.isArray(m.transcript) && m.transcript.length > 0)
    if (!m.synthese && canSynth) void generateSynthese()
    if (!(current.lesson.ai_questions || []).length) void generateQcm()
  }, [current, generateSynthese, generateQcm])

  // ---------- Noter / reporter ----------
  const findNextEmpty = (arr: (Result | null)[], from: number) => {
    for (let i = from + 1; i < arr.length; i++) if (arr[i] === null) return i
    for (let i = 0; i < from; i++) if (arr[i] === null) return i
    return -1
  }
  const advance = useCallback((arr: (Result | null)[]) => {
    const n = findNextEmpty(arr, idx)
    if (n === -1) setPhase('done')
    else { setIdx(n); resetFiche() }
  }, [idx, resetFiche])

  const rate = useCallback(async (score: Score) => {
    if (!current || busy) return
    setBusy(true)
    await saveAllPending()
    const newSteps = [...((current.lesson.steps as StepEntry[]) || [])]
    while (sysJ.length > newSteps.length) newSteps.push(null)
    newSteps[current.due.stepIndex] = current.due.status === 'fresh'
      ? ({ note: '', temp_score: score, temp_date: today } as unknown as StepEntry)
      : ({ score, date: today, note: '' } as StepEntry)
    await supabase.from('lessons').update({ steps: newSteps }).eq('id', current.lesson.id)
    replaceLesson({ ...current.lesson, steps: newSteps as Lesson['steps'] })
    const arr = [...results]; arr[idx] = { kind: 'rated', score }
    setResults(arr)
    setBusy(false)
    advance(arr)
  }, [current, busy, saveAllPending, sysJ.length, today, supabase, replaceLesson, results, idx, advance])

  const report = useCallback(async () => {
    if (!current || busy) return
    setBusy(true)
    if (results[idx]?.kind === 'rated') {
      const newSteps = [...((current.lesson.steps as StepEntry[]) || [])]
      newSteps[current.due.stepIndex] = null
      await supabase.from('lessons').update({ steps: newSteps }).eq('id', current.lesson.id)
    }
    const arr = [...results]; arr[idx] = { kind: 'reported' }
    setResults(arr)
    setBusy(false)
    advance(arr)
  }, [current, busy, results, idx, supabase, advance])

  const goTo = useCallback((i: number) => { if (i !== idx) { setIdx(i); resetFiche() } }, [idx, resetFiche])

  // Raccourcis : 1-5 noter (étape 3), flèches changer de fiche
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'session') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft' && idx > 0) goTo(idx - 1)
      else if (e.key === 'ArrowRight' && idx < queue.length - 1) goTo(idx + 1)
      else if (step === 2 && /^[1-5]$/.test(e.key)) { setGrade(Number(e.key) as Score); setGradeTouched(true) }
      else if (step === 1 && mode === 'cards' && e.key === ' ') { e.preventDefault(); setFlipped(f => !f) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, idx, queue.length, step, mode, goTo])

  // ===================== RENDUS =====================
  if (phase === 'loading') return <div className="se-root"><PageLoader label="Préparation de ta session…" /></div>

  const mm = Math.floor(elapsedMs / 60000), ss = Math.floor(elapsedMs / 1000) % 60
  const timer = `${mm}:${String(ss).padStart(2, '0')}`
  const doneCount = results.filter(Boolean).length
  const estMin = queue.length * 8

  if (phase === 'empty') {
    return (
      <div className="se-root">
        <div className="se-center">
          <div className="se-empty">
            <h1>Rien à réviser</h1>
            <p>{lessonParam ? "Cette fiche n'est pas disponible pour la révision." : systemParam ? "Aucune fiche de cette matière n'est due aujourd'hui." : 'Tu es à jour. Profite de ta journée.'}</p>
            <Link href="/dashboard" className="se-btn se-btn-primary">Retour au tableau de bord</Link>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const rated = results.filter((r): r is Extract<Result, { kind: 'rated' }> => r?.kind === 'rated').length
    const tomorrow = dateStrFromOffset(today, 1)
    const schedOf = makeScheduleResolver(systems)
    const tomorrowCount = allLessons.filter(l => getDueOn(l, tomorrow, schedOf(l.system_id))).length
    const weakCount = results.filter(r => r?.kind === 'rated' && r.score <= 2).length
    const totalMin = Math.max(1, Math.round(elapsedMs / 60000))
    const dur = totalMin >= 60 ? `${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, '0')}` : `${totalMin} min`
    return (
      <div className="se-root">
        <div className="se-done">
          <div className="se-kicker se-ok">Session terminée</div>
          <h1 className="se-done-title">{rated} fiche{rated > 1 ? 's' : ''} revue{rated > 1 ? 's' : ''}.</h1>
          <p className="se-done-sub">
            {dur} de travail{stats.qcmTotal > 0 ? `, ${stats.qcmOk} QCM justes sur ${stats.qcmTotal}` : ''}{stats.cardsTotal > 0 ? `, ${stats.cardsKnown} flashcard${stats.cardsKnown > 1 ? 's' : ''} sue${stats.cardsKnown > 1 ? 's' : ''} sur ${stats.cardsTotal}` : ''}.
          </p>
          <section className="se-card se-done-list">
            {queue.map((it, i) => {
              const r = results[i]
              if (!r) return null
              const j = scheduleOf(systems.find(s => s.id === it.lesson.system_id))
              const nextI = it.due.stepIndex + 1
              const next = r.kind === 'reported' ? 'demain' : nextI < j.length && it.lesson.learn_date ? shortDate(stepDate(it.lesson, nextI, j)) : 'fin du planning'
              const color = colorMap.get(it.lesson.system_id) || '#3E6F9C'
              return (
                <div key={it.lesson.id} className="se-done-row">
                  <span className="se-dot" style={{ background: color }} />
                  <span className="se-done-name">{it.lesson.name}</span>
                  {r.kind === 'rated'
                    ? <span className={`se-pill s${r.score}`}>{r.score}/5</span>
                    : <span className="se-pill se-pill-muted">Reportée</span>}
                  <span className="se-done-next">{next}</span>
                </div>
              )
            })}
          </section>
          <section className="se-card se-done-foot">
            <p><b>Demain :</b> {tomorrowCount} fiche{tomorrowCount > 1 ? 's' : ''} prévue{tomorrowCount > 1 ? 's' : ''}{weakCount === 1 ? '. Pense à relire la fiche notée 1 ou 2.' : weakCount > 1 ? `. Pense à relire les ${weakCount} fiches notées 1 ou 2.` : '.'}</p>
            <Link href="/dashboard" className="se-btn se-btn-primary">Retour au tableau de bord</Link>
          </section>
        </div>
      </div>
    )
  }

  // ---------- Session ----------
  if (!current) return null
  const color = (current && colorMap.get(current.lesson.system_id)) || '#3E6F9C'
  const statusLabel = current.due.status === 'missed'
    ? `J+${sysJ[current.due.stepIndex]}, en retard de ${current.due.overdueDays} jour${current.due.overdueDays > 1 ? 's' : ''}`
    : current.due.status === 'fresh'
      ? `J+${sysJ[current.due.stepIndex]}, en avance`
      : current.lastScore === null && current.due.stepIndex === 0 ? 'Nouvelle fiche, J+0' : `J+${sysJ[current.due.stepIndex]}, prévue aujourd'hui`
  const synth = media.synthese
  const missedQs = qs.map((q, i) => ({ q, i })).filter(x => isMissed(x.q)).slice(0, 3)
  const hasSource = !!media.pdf_path || !!media.video_path || (Array.isArray(media.transcript) && media.transcript.length > 0)
  const nextI = current.due.stepIndex + 1
  const nextDate = nextI < sysJ.length && current.lesson.learn_date ? stepDate(current.lesson, nextI, sysJ) : null
  const tq = plan.length ? qs[plan[qi]] : undefined
  const okSoFar = attempts.filter(a => a.correct).length
  const fc = deck.length ? lessonCards.find(c => c.id === deck[ci]) : undefined
  const cardSeen = Object.keys(cardRes).length
  const cardKnown = Object.values(cardRes).filter(Boolean).length

  const qcmRunning = genJobs.some(j => j.lessonId === current.lesson.id && j.status === 'running')
  const missingSynth = !synth
  const missingQcm = qs.length === 0

  // Écran « ajoute ton cours » / « crée ta synthèse et tes QCM »
  const courseSetup = (
    !hasSource ? (
      <div className="se-setup">
        <h2>Ajoute ton cours pour réviser cette fiche</h2>
        <p className="se-setup-sub">MedRev a besoin du poly ou de la vidéo de l&apos;amphi. À partir du fichier, il prépare tout le reste.</p>
        <ol className="se-howto">
          <li><b>1</b><span><strong>Dépose ton cours</strong>Le poly ou la vidéo de l&apos;amphi.</span></li>
          <li><b>2</b><span><strong>MedRev prépare tout</strong>Synthèse, QCM, flashcards.</span></li>
          <li><b>3</b><span><strong>Tu révises ici</strong>À chaque palier, au même endroit.</span></li>
        </ol>
        <div
          className={`se-drop${dragOver ? ' over' : ''}${uploading ? ' busy' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void uploadCourse(f) }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
          <b>{uploading === 'pdf' ? 'Envoi du poly…' : uploading === 'video' ? 'Envoi de la vidéo…' : 'Glisse ton fichier ici'}</b>
          <span>ou</span>
          <div className="se-drop-btns">
            <button type="button" className="se-btn se-btn-primary" disabled={!!uploading} onClick={() => pdfInput.current?.click()}>Choisir le poly (PDF)</button>
            <button type="button" className="se-btn se-btn-ghost" disabled={!!uploading} onClick={() => videoInput.current?.click()}>Ajouter la vidéo</button>
          </div>
        </div>
        {uploadErr && <p className="se-err" role="alert">{uploadErr}</p>}
      </div>
    ) : (
      <div className="se-setup">
        <h2>{missingSynth && missingQcm ? 'Ton cours est ajouté, prépare ta révision' : missingQcm ? 'Crée les QCM de ce cours' : 'Crée ta fiche de synthèse'}</h2>
        <p className="se-setup-sub">En un clic, MedRev lit {media.pdf_name || media.video_name ? <b>{media.pdf_name || media.video_name}</b> : 'ton cours'} et prépare ce qui manque.</p>
        <ul className="se-check">
          <li className="ok"><i>✓</i><span><strong>Cours ajouté</strong>{media.pdf_path ? `Poly${media.pdf_pages ? `, ${media.pdf_pages} pages` : ''}` : 'Vidéo de l\'amphi'}</span></li>
          <li className={synth ? 'ok' : genSynth === 'running' ? 'run' : ''}><i>{synth ? '✓' : '2'}</i><span><strong>Fiche de synthèse</strong>{synth ? 'Prête' : genSynth === 'running' ? 'En cours, environ 20 secondes' : 'Les idées clés, un tableau et les pièges'}</span></li>
          <li className={!missingQcm ? 'ok' : qcmRunning ? 'run' : ''}><i>{!missingQcm ? '✓' : '3'}</i><span><strong>QCM et flashcards</strong>{!missingQcm ? `${qs.length} QCM prêts` : qcmRunning ? 'En cours, 30 à 60 secondes' : `${qcmNb} QCM, et une flashcard par erreur`}</span></li>
        </ul>

        {qcmRunning && <GenProgress lessonId={current.lesson.id} variant="fiche" />}
        {(missingSynth || missingQcm) && (
          <button type="button" className="se-btn se-btn-primary se-setup-go" onClick={createAll} disabled={genSynth === 'running' || qcmRunning}>
            {genSynth === 'running' || qcmRunning ? 'Préparation en cours…' : missingSynth && missingQcm ? 'Créer la synthèse et les QCM' : missingQcm ? 'Créer les QCM' : 'Créer ma fiche de synthèse'}
          </button>
        )}
        {genSynthErr && <p className="se-err" role="alert">{genSynthErr}</p>}
        {genQcmErr && <p className="se-err" role="alert">{genQcmErr}</p>}
      </div>
    )
  )

  // S'entraîner sans QCM : un aperçu d'entraînement grisé, et une seule action
  // (ajouter le cours, ou créer les QCM). Volontairement différent de « Relire ».
  const trainSetup = (
    <div className="se-tset">
      <div className="se-tset-preview" aria-hidden="true">
        <div className="se-qhead"><span>Question 1 sur 10</span><span>Plusieurs bonnes réponses</span></div>
        <div className="se-bar"><i style={{ width: '10%' }} /></div>
        <div className="se-tset-q" />
        <div className="se-tset-q short" />
        {[0, 1, 2, 3].map(i => <div key={i} className="se-tset-opt"><span /><i style={{ width: `${[72, 58, 80, 46][i]}%` }} /></div>)}
      </div>
      <div className="se-tset-over">
        <div className="se-tset-card">
          <span className="se-tset-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
          </span>
          <h2>{hasSource ? 'Tes QCM ne sont pas encore créés' : 'Pas de QCM sans ton cours'}</h2>
          <p>{hasSource
            ? 'Des questions corrigées, tirées de ton cours, en 30 à 60 secondes. Chaque erreur deviendra une flashcard.'
            : 'Les QCM et les flashcards sont créés à partir de ton poly ou de la vidéo de l\'amphi. Ajoute-le, MedRev s\'occupe du reste.'}</p>
          {hasSource ? (
            <>
              {qcmPick && !qcmRunning ? (
                <div className="se-nbpanel">
                  <div className="se-nbpanel-h">Combien de QCM&nbsp;?<button type="button" aria-label="Annuler" onClick={() => setQcmPick(false)}>×</button></div>
                  <div className="rmod-nb big" role="group" aria-label="Combien de questions ?">
                    {QCM_COUNTS.map(n => (
                      <button key={n} type="button" onClick={() => { chooseQcmNb(n); setQcmPick(false); setTimeout(() => void generateQcm(), 0) }}><b>{n}</b>questions</button>
                    ))}
                  </div>
                </div>
              ) : (
                <button type="button" className="se-btn se-btn-primary" onClick={() => setQcmPick(true)} disabled={qcmRunning}>{qcmRunning ? 'Création des QCM…' : 'Créer les QCM'}</button>
              )}
              {qcmRunning && <GenProgress lessonId={current.lesson.id} variant="fiche" />}
              {genQcmErr && <p className="se-err" role="alert">{genQcmErr}</p>}
            </>
          ) : (
            <>
              <div className="se-drop-btns">
                <button type="button" className="se-btn se-btn-primary" disabled={!!uploading} onClick={() => pdfInput.current?.click()}>{uploading === 'pdf' ? 'Envoi du poly…' : 'Ajouter le poly (PDF)'}</button>
                <button type="button" className="se-btn se-btn-ghost" disabled={!!uploading} onClick={() => videoInput.current?.click()}>{uploading === 'video' ? 'Envoi…' : 'La vidéo'}</button>
              </div>
              {uploadErr && <p className="se-err" role="alert">{uploadErr}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )

  // L'entraînement n'existe qu'avec des QCM ou des flashcards : sinon l'étape 2
  // est grisée, et c'est dans l'étape 1 qu'on crée les QCM.
  const trainLocked = qs.length === 0 && lessonCards.length === 0
  const steps: { label: string; sub: string }[] = [
    { label: 'Relire', sub: synth ? 'Ta fiche de synthèse' : 'Ton cours' },
    { label: "S'entraîner", sub: trainLocked ? (qcmRunning ? 'QCM en cours de création' : hasSource ? "Crée d'abord les QCM" : "Ajoute d'abord ton cours") : qs.length && lessonCards.length ? 'QCM et flashcards' : qs.length ? `${Math.min(TRAIN_SIZE, qs.length)} QCM sur ce cours` : lessonCards.length ? 'Tes flashcards' : 'QCM et flashcards' },
    { label: 'Se noter', sub: 'Avec ton résultat' },
  ]

  return (
    <div className="se-root">
      <header className="se-head">
        <div className="se-head-title">
          <Link href="/dashboard" className="se-logo" aria-label="Retour au tableau de bord">M</Link>
          <div>
            <div className="se-head-name">Session du jour</div>
            <div className="se-head-sub">{queue.length} fiche{queue.length > 1 ? 's' : ''} prévue{queue.length > 1 ? 's' : ''}, environ {estMin >= 60 ? `${Math.floor(estMin / 60)} h ${String(estMin % 60).padStart(2, '0')}` : `${estMin} min`}</div>
          </div>
        </div>
        <div className="se-head-prog">
          <div className="se-head-prog-lbl"><span>Fiche {idx + 1} sur {queue.length}</span><span>{doneCount} terminée{doneCount > 1 ? 's' : ''}</span></div>
          <div className="se-segs" style={{ gridTemplateColumns: `repeat(${Math.min(queue.length, 40)}, minmax(0, 1fr))` }}>
            {queue.slice(0, 40).map((_, i) => <i key={i} className={results[i] ? 'done' : i === idx ? 'cur' : ''} />)}
          </div>
        </div>
        <div className="se-head-acts">
          <span className="se-timer" aria-label="Temps de travail">{timer}</span>
          <button type="button" className="se-btn se-btn-ghost-dark" onClick={() => {
            if (paused) { setPausedMs(p => p + (Date.now() - pauseFrom!)); setPauseFrom(null) } else setPauseFrom(Date.now())
          }}>{paused ? 'Reprendre' : 'Pause'}</button>
          <button type="button" className="se-btn se-btn-link-dark" onClick={() => { void saveAllPending(); setPhase('done') }}>Terminer</button>
        </div>
      </header>

      {paused && (
        <div className="se-pause" role="dialog" aria-label="Session en pause">
          <div className="se-pause-card">
            <h2>Session en pause</h2>
            <p>Le temps ne compte plus. Reprends quand tu es prêt.</p>
            <button type="button" className="se-btn se-btn-primary" onClick={() => { setPausedMs(p => p + (Date.now() - pauseFrom!)); setPauseFrom(null) }}>Reprendre</button>
          </div>
        </div>
      )}

      <div className="se-body">
        <aside className="se-queue" aria-label="Au programme">
          <div className="se-kicker">Au programme</div>
          {queue.map((it, i) => {
            const r = results[i]
            const c = (systems.find(s => s.id === it.lesson.system_id) as { color?: string; name?: string } | undefined)
            const j = scheduleOf(systems.find(s => s.id === it.lesson.system_id))
            return (
              <button key={it.lesson.id} type="button" onClick={() => goTo(i)} className={`se-qrow${i === idx ? ' cur' : ''}${r ? ' done' : ''}`}>
                <span className="se-dot" style={{ background: colorMap.get(it.lesson.system_id) || '#3E6F9C' }} />
                <span className="se-qtxt">
                  <span className="se-qname">{it.lesson.name}</span>
                  <span className="se-qmeta">{c?.name ?? 'Matière'}, J+{j[it.due.stepIndex]}</span>
                </span>
                {r?.kind === 'rated' && <span className={`se-pill s${r.score}`}>{r.score}/5</span>}
                {r?.kind === 'reported' && <span className="se-pill se-pill-muted">Reportée</span>}
                {!r && i === idx && <span className="se-pill se-pill-cur">En cours</span>}
                {!r && i !== idx && it.due.stepIndex === 0 && it.lastScore === null && <span className="se-pill se-pill-new">Nouvelle</span>}
              </button>
            )
          })}
        </aside>

        <main className="se-main">
          <section className="se-card se-fiche">
            <div className="se-chips">
              <span className="se-chip" style={{ color, background: `${color}1A` }}><span className="se-dot" style={{ background: color }} />{sys?.name ?? 'Matière'}</span>
              <span className={`se-chip ${current.due.status === 'missed' ? 'se-chip-late' : 'se-chip-plain'}`}>{statusLabel}</span>
              {current.lastScore !== null && <span className="se-chip-text">Dernière note : {current.lastScore}/5{current.lastDate ? `, le ${shortDate(current.lastDate)}` : ''}</span>}
            </div>
            <h1 className="se-title">{current.lesson.name}</h1>
            <nav className="se-steps" aria-label="Étapes">
              {steps.map((s, i) => {
                const on = step === i, past = i < step
                const locked = i === 1 && trainLocked
                return (
                  <button key={s.label} type="button" className={`se-step${on ? ' on' : ''}${past && !locked ? ' past' : ''}${locked ? ' locked' : ''}`} disabled={locked} aria-disabled={locked} onClick={() => (i === 1 ? startTraining() : i === 2 ? goRate() : setStep(0))} aria-current={on ? 'step' : undefined}>
                    <span className="se-step-n">{locked
                      ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                      : past ? '✓' : i + 1}</span>
                    <span className="se-step-txt"><b>{s.label}</b><span>{s.sub}</span></span>
                  </button>
                )
              })}
            </nav>
          </section>

          {/* ===== 1. RELIRE ===== */}
          {step === 0 && (
            <section className="se-card se-panel se-split">
              <div className="se-split-main">
                {synth ? (
                  <>
                    <div className="se-panel-head"><h2>Ta fiche de synthèse</h2>
                      <button type="button" className="se-btn se-btn-link se-redo" onClick={generateSynthese} disabled={genSynth === 'running'}>{genSynth === 'running' ? 'Nouvelle version en cours…' : 'Refaire la synthèse'}</button></div>
                    {genSynthErr && <p className="se-err" role="alert">{genSynthErr}</p>}
                    <ul className="se-ess">
                      {synth.essentiel.map((e, i) => (
                        <li key={i}>{e.texte}{e.page && media.pdf_path ? <> <button type="button" className="se-page" onClick={() => setSource({ pdf_page: e.page })}>p. {e.page}</button></> : null}</li>
                      ))}
                    </ul>
                    {synth.tableau && (
                      <div className="se-table-wrap">
                        <table className="se-table">
                          <thead><tr>{synth.tableau.colonnes.map(c => <th key={c}>{c}</th>)}</tr></thead>
                          <tbody>{synth.tableau.lignes.map((l, i) => <tr key={i}>{l.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    )}
                    {synth.liste && (
                      <dl className="se-list">
                        {synth.liste.map((x, i) => <div key={i}><dt>{x.terme}</dt><dd>{x.detail}</dd></div>)}
                      </dl>
                    )}
                  </>
                ) : courseSetup}
              </div>
              <div className="se-split-side">
                {(synth?.pieges.length || missedQs.length) ? (
                  <div className="se-traps">
                    <div className="se-kicker se-late">Tes pièges sur ce cours</div>
                    <ul>
                      {missedQs.map(({ q, i }) => {
                        const ref = q.source_ref && typeof q.source_ref === 'object' ? q.source_ref : null
                        return (
                          <li key={`m${i}`}>
                            <b>Ratée la dernière fois :</b> {q.question}{' '}
                            {ref?.pdf_page && media.pdf_path ? <button type="button" className="se-page" onClick={() => setSource({ pdf_page: ref.pdf_page })}>p. {ref.pdf_page}</button> : null}
                          </li>
                        )
                      })}
                      {(synth?.pieges ?? []).slice(0, Math.max(0, 3 - missedQs.length)).map((p, i) => (
                        <li key={`p${i}`}>{p.texte}{p.page && media.pdf_path ? <> <button type="button" className="se-page" onClick={() => setSource({ pdf_page: p.page })}>p. {p.page}</button></> : null}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {hasSource && (
                  <div className="se-box">
                    <b>Le cours complet</b>
                    {media.pdf_path && <button type="button" className="se-btn se-btn-ghost" onClick={() => setSource({ pdf_page: 1 })}>Ouvrir le poly{media.pdf_pages ? ` (${media.pdf_pages} pages)` : ''}</button>}
                    {media.video_path && <button type="button" className="se-btn se-btn-ghost" onClick={() => setSource({ video_ts: 0 })}>Vidéo de l&apos;amphi</button>}
                  </div>
                )}
                {!hasSource && (
                  <div className="se-box">
                    <b>Pas de fichier sous la main ?</b>
                    <span className="se-muted">Relis ton cours de ton côté, puis note-toi. Tu pourras ajouter le poly plus tard.</span>
                  </div>
                )}
                {trainLocked && hasSource && (
                  <div className="se-box se-unlock">
                    <b>Débloque l&apos;entraînement</b>
                    <span className="se-muted">Crée les QCM de ce cours pour passer à l&apos;étape 2.</span>
                    {qcmRunning ? (
                      <GenProgress lessonId={current.lesson.id} variant="fiche" />
                    ) : qcmPick ? (
                      <div className="se-nbpanel">
                        <div className="se-nbpanel-h">Combien de QCM&nbsp;?<button type="button" aria-label="Annuler" onClick={() => setQcmPick(false)}>×</button></div>
                        <div className="rmod-nb big" role="group" aria-label="Combien de questions ?">
                          {QCM_COUNTS.map(n => (
                            <button key={n} type="button" onClick={() => { chooseQcmNb(n); setQcmPick(false); setTimeout(() => void generateQcm(), 0) }}><b>{n}</b>questions</button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="se-btn se-btn-primary" onClick={() => setQcmPick(true)}>Créer les QCM</button>
                    )}
                    {genQcmErr && <p className="se-err" role="alert">{genQcmErr}</p>}
                  </div>
                )}
                <button type="button" className={`se-btn se-push ${!trainLocked ? 'se-btn-primary' : 'se-btn-ghost'}`} onClick={!trainLocked ? startTraining : goRate}>
                  {!trainLocked ? "J'ai relu, je m'entraîne" : "J'ai relu, je me note"}
                </button>
              </div>
            </section>
          )}

          {/* ===== 2. S'ENTRAÎNER ===== */}
          {step === 1 && (
            <section className="se-card se-panel se-split">
              <div className="se-split-main">
                {(qs.length > 0 || lessonCards.length > 0) && (
                  <div className="se-tabs" role="tablist" aria-label="Type d'entraînement">
                    <button type="button" role="tab" aria-selected={mode === 'qcm'} className={mode === 'qcm' ? 'on' : ''} onClick={() => setMode('qcm')}>
                      QCM <span>{qs.length ? Math.min(TRAIN_SIZE, qs.length) : 0}</span>
                    </button>
                    <button type="button" role="tab" aria-selected={mode === 'cards'} className={mode === 'cards' ? 'on' : ''} onClick={() => void openCards()}>
                      Flashcards <span>{deck.length || Math.min(CARDS_SIZE, lessonCards.length)}</span>
                    </button>
                  </div>
                )}
                {mode === 'cards' ? (
                  lessonCards.length === 0 ? (
                    <div className="se-nosynth">
                      <h2>Pas encore de flashcards</h2>
                      <p>Elles se créent toutes seules à partir de tes erreurs de QCM. Tu peux aussi en écrire depuis la fiche.</p>
                    </div>
                  ) : cardsSaved ? (
                    <div className="se-nosynth">
                      <h2>Flashcards terminées</h2>
                      <p>{cardsSaved.known} sue{cardsSaved.known > 1 ? 's' : ''} sur {cardsSaved.total}.</p>
                    </div>
                  ) : fc ? (
                    <>
                      <div className="se-qhead"><span>Carte {ci + 1} sur {deck.length}{!fc.reviews ? ', nouvelle' : ''}</span><span>Espace pour retourner</span></div>
                      <div className="se-bar"><i style={{ width: `${(ci / deck.length) * 100}%` }} /></div>
                      <button type="button" className={`se-fc${flipped ? ' back' : ''}`} onClick={() => setFlipped(f => !f)} aria-label={flipped ? 'Voir le recto' : 'Voir la réponse'}>
                        {fc.origin === 'qcm' && fc.prop ? (
                          !flipped ? (
                            <>
                              <span className="se-fc-side">Vrai ou faux ?</span>
                              {fc.stem && <span className="se-fc-stem">{fc.stem}</span>}
                              <span className="se-fc-text">{fc.prop}</span>
                            </>
                          ) : (
                            <>
                              <span className="se-fc-side">Réponse</span>
                              <span className={`se-fc-verdict ${fc.verdict ? 'v' : 'f'}`}>{fc.verdict ? 'Vrai' : 'Faux'}</span>
                              {fc.why && <span className="se-fc-why">{fc.why}</span>}
                            </>
                          )
                        ) : (
                          <>
                            <span className="se-fc-side">{flipped ? 'Réponse' : 'Question'}</span>
                            <span className="se-fc-text">{flipped ? fc.back : fc.front}</span>
                          </>
                        )}
                        <span className="se-fc-hint">{flipped ? 'Clique pour revoir la question' : 'Clique pour voir la réponse'}</span>
                      </button>
                      <div className="se-actions se-fc-acts">
                        {!flipped
                          ? <button type="button" className="se-btn se-btn-primary" onClick={() => setFlipped(true)}>Voir la réponse</button>
                          : <>
                              <button type="button" className="se-btn se-btn-ghost se-fc-no" onClick={() => markCard(false)}>À revoir</button>
                              <button type="button" className="se-btn se-btn-primary" onClick={() => markCard(true)}>Je savais</button>
                            </>}
                      </div>
                    </>
                  ) : null
                ) : qs.length === 0 ? (
                  trainSetup
                ) : trainSaved ? (
                  <div className="se-nosynth">
                    <h2>QCM terminés</h2>
                    <p>{trainSaved.ok} juste{trainSaved.ok > 1 ? 's' : ''} sur {trainSaved.total}.{trainSaved.cards > 0 ? ` ${trainSaved.cards} flashcard${trainSaved.cards > 1 ? 's' : ''} créée${trainSaved.cards > 1 ? 's' : ''} à partir de tes erreurs.` : ''}</p>
                  </div>
                ) : tq ? (
                  <>
                    <div className="se-qhead"><span>Question {qi + 1} sur {plan.length}{isMissed(tq) ? ', ratée la dernière fois' : ''}</span><span>{normalizeAnswer(tq.answer).length > 1 ? 'Plusieurs bonnes réponses' : 'Une seule bonne réponse'}</span></div>
                    <div className="se-bar"><i style={{ width: `${((qi + (checked ? 1 : 0)) / plan.length) * 100}%` }} /></div>
                    <h2 className="se-qtitle">{tq.question}</h2>
                    {tq.visual && media.pdf_path && <QuestionFigure pdfPath={media.pdf_path} page={tq.visual.page} box={tq.visual.box} />}
                    <div className="se-opts">
                      {tq.options.map((opt, i) => {
                        const answer = normalizeAnswer(tq.answer)
                        const multi = answer.length > 1
                        const on = sel.includes(i), ok = answer.includes(i)
                        let cls = 'se-opt'
                        if (checked) cls += ok && on ? ' good' : ok ? ' missed' : on ? ' bad' : ' dim'
                        else if (on) cls += ' on'
                        const mark = checked ? (on ? (ok ? '✓' : '✕') : '') : on ? '✓' : ''
                        const why = checked ? whyFor(tq, i, tq.options.length) : ''
                        return (
                          <button key={i} type="button" className={cls} disabled={checked} aria-pressed={on}
                            onClick={() => setSel(s => (multi ? (s.includes(i) ? s.filter(x => x !== i) : [...s, i]) : s.includes(i) ? [] : [i]))}>
                            <span className="se-opt-box">{mark}</span>
                            <span className="se-opt-txt">
                              <span>{String.fromCharCode(65 + i)}. {stripLetter(opt)}</span>
                              {checked && <span className="se-opt-mark">{ok ? (on ? 'Vrai, tu l\'as cochée' : 'Vrai, tu ne l\'as pas cochée') : on ? 'Faux, tu l\'as cochée' : 'Faux'}</span>}
                              {why && <span className="se-opt-why">{why}</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {checked && (() => {
                      const expl = cleanExplanation(tq.explanation) || correctAnswersRecap(tq.options, normalizeAnswer(tq.answer))
                      const ref = tq.source_ref && typeof tq.source_ref === 'object' ? tq.source_ref : null
                      const last = attempts[attempts.length - 1]
                      return (
                        <div className={`se-feedback ${last?.correct ? 'ok' : 'ko'}`}>
                          <b>{last?.correct ? 'Juste' : 'Faux : il fallait cocher exactement les bonnes propositions'}</b>
                          {expl && <p>{expl}</p>}
                          {ref?.pdf_page && media.pdf_path && <button type="button" className="se-page" onClick={() => setSource({ pdf_page: ref.pdf_page })}>Voir la page {ref.pdf_page}</button>}
                          <ReportQuestion lessonId={current.lesson.id} source="session" questionIndex={plan[qi]} question={tq} />
                        </div>
                      )
                    })()}
                    <div className="se-actions">
                      {!checked
                        ? <button type="button" className="se-btn se-btn-primary" onClick={validate} disabled={sel.length === 0}>Valider</button>
                        : <button type="button" className="se-btn se-btn-primary" onClick={nextQuestion}>{qi + 1 < plan.length ? 'Question suivante' : lessonCards.length || attempts.some(a => !a.correct) ? 'Passer aux flashcards' : 'Passer à la note'}</button>}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="se-split-side">
                {mode === 'qcm' && qs.length > 0 && !trainSaved && (
                  <div className="se-box">
                    <span className="se-muted">QCM, pour l&apos;instant</span>
                    <div className="se-mini-stats">
                      <div><b className="se-ok">{okSoFar}</b><span>juste{okSoFar > 1 ? 's' : ''}</span></div>
                      <div><b className="se-late">{attempts.length - okSoFar}</b><span>fausse{attempts.length - okSoFar > 1 ? 's' : ''}</span></div>
                    </div>
                  </div>
                )}
                {mode === 'cards' && lessonCards.length > 0 && !cardsSaved && (
                  <div className="se-box">
                    <span className="se-muted">Flashcards, pour l&apos;instant</span>
                    <div className="se-mini-stats">
                      <div><b className="se-ok">{cardKnown}</b><span>sue{cardKnown > 1 ? 's' : ''}</span></div>
                      <div><b className="se-late">{cardSeen - cardKnown}</b><span>à revoir</span></div>
                    </div>
                  </div>
                )}
                {(mode === 'cards' || qs.length > 0) && <div className="se-info">
                  {mode === 'qcm'
                    ? 'Chaque erreur devient une flashcard. Après les QCM, tu passes aux flashcards.'
                    : 'Les nouvelles cartes viennent de tes erreurs de QCM, puis celles que tu sais le moins.'}
                </div>}
                <button type="button" className="se-btn se-btn-ghost se-push" onClick={goRate}>{attempts.length || cardSeen ? 'Arrêter et me noter' : 'Passer à la note'}</button>
              </div>
            </section>
          )}

          {/* ===== 3. SE NOTER ===== */}
          {step === 2 && (
            <section className="se-card se-panel se-rate">
              {sugg.total > 0 && (
                <div className="se-rate-stats">
                  <div><b>{trainSaved && trainSaved.total ? `${trainSaved.ok} / ${trainSaved.total}` : 'Aucun'}</b><span>QCM justes</span></div>
                  {cardsSaved
                    ? <div><b>{cardsSaved.known} / {cardsSaved.total}</b><span>flashcards sues</span></div>
                    : <div><b>{trainSaved?.cards ?? 0}</b><span>nouvelle{(trainSaved?.cards ?? 0) > 1 ? 's' : ''} flashcard{(trainSaved?.cards ?? 0) > 1 ? 's' : ''}</span></div>}
                  <div><b>{current.lastScore !== null ? `${current.lastScore}/5` : 'Aucune'}</b><span>note précédente</span></div>
                </div>
              )}
              <div>
                <h2 className="se-h2">Comment ça s&apos;est passé ?</h2>
                <p className="se-p">{sugg.grade ? <>Avec {[trainSaved?.total ? `${trainSaved.ok} QCM sur ${trainSaved.total}` : '', cardsSaved?.total ? `${cardsSaved.known} flashcard${cardsSaved.known > 1 ? 's' : ''} sur ${cardsSaved.total}` : ''].filter(Boolean).join(' et ')}, on te propose <b>{sugg.grade}, {GRADE_LABELS[sugg.grade][0]}</b>. Tu peux choisir une autre note.</> : 'Sois honnête : ta note sert à savoir où tu en es.'}</p>
              </div>
              <div className="se-grades" role="radiogroup" aria-label="Note de 1 à 5">
                {([1, 2, 3, 4, 5] as Score[]).map(n => (
                  <button key={n} type="button" role="radio" aria-checked={grade === n} className={`se-grade g${n}${grade === n ? ' on' : ''}`} onClick={() => { setGrade(n); setGradeTouched(true) }}>
                    <b>{n}</b><span className="se-grade-l">{GRADE_LABELS[n][0]}</span><span className="se-grade-h">{GRADE_LABELS[n][1]}</span>
                  </button>
                ))}
              </div>
              <div className="se-rate-foot">
                <p>
                  {current.due.status === 'fresh'
                    ? <>Révision en avance : ta note est provisoire, la révision prévue le {shortDate(current.due.dueDate)} reste au planning.</>
                    : nextDate ? <>Prochaine révision : J+{sysJ[nextI]}, {prettyDate(nextDate)}.</> : <>C&apos;était la dernière révision prévue pour cette fiche.</>}
                </p>
                <button type="button" className="se-btn se-btn-primary" disabled={!grade || busy} onClick={() => grade && rate(grade)}>
                  {idx + 1 >= queue.length && results.filter(Boolean).length >= queue.length - 1 ? 'Valider et terminer' : 'Valider et fiche suivante'}
                </button>
              </div>
            </section>
          )}

          <div className="se-under">
            <span />
            <button type="button" className="se-btn se-btn-link" onClick={report} disabled={busy}>Reporter cette fiche à demain</button>
          </div>
        </main>
      </div>

      <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadCourse(f) }} />
      <input ref={videoInput} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadCourse(f) }} />
      {source && (
        <SourceLightbox media={media} sourceRef={source} lessonName={current.lesson.name} onClose={() => setSource(null)} />
      )}
    </div>
  )
}

// DEFAULT_J reste importé pour les fiches sans matière (scheduleOf s'en sert).
void DEFAULT_J
