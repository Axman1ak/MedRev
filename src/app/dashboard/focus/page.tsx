'use client'
// src/app/dashboard/focus/page.tsx
// Session focus plein écran : enchaîne les fiches dues dans l'ordre suggéré.
// Lit ?lesson=<id> (mode solo) et ?system=<id> (filtre matière).
// Sans param : queue d'aujourd'hui filtrée par le semestre courant (localStorage 'medrev-sem').

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

// ===================== TYPES =====================
type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null

type DueInfo = {
  stepIndex: number
  dueDate: string
  status: 'missed' | 'today' | 'fresh'
  overdueDays: number
}

type QueueItem = {
  lesson: Lesson
  due: DueInfo
  lastScore: Score | null
  priority: number
}

type Result = {
  lessonId: string
  lessonName: string
  systemName: string
  outcome: { kind: 'rated'; score: Score } | { kind: 'reported' }
}

type Phase = 'loading' | 'session' | 'done' | 'empty'

// ===================== HELPERS =====================
function dateStrFromOffset(base: string, offset: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000
  )
}

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
  return dateStrFromOffset(lesson.learn_date, J[i])
}

function getLastScore(lesson: Lesson): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = J.length - 1; i >= 0; i--) {
    const sc = stepScore(steps[i])
    if (sc) return sc
  }
  return null
}

function getDueForToday(lesson: Lesson, today: string): DueInfo | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (stepScore(steps[i])) continue
    const dd = stepDate(lesson, i)
    if (dd <= today) {
      return {
        stepIndex: i,
        dueDate: dd,
        status: dd === today ? 'today' : 'missed',
        overdueDays: dd < today ? daysBetween(dd, today) : 0,
      }
    }
    break // steps chronologiques
  }
  return null
}

function getNextUndoneJ(lesson: Lesson): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (!stepScore(steps[i])) return i
  }
  return null
}

function computeTodayQueue(lessons: Lesson[], today: string): QueueItem[] {
  const out: QueueItem[] = []
  lessons.forEach(l => {
    const due = getDueForToday(l, today)
    if (!due) return
    const lastScore = getLastScore(l)
    let priority: number
    if (due.status === 'missed') {
      priority = -due.overdueDays * 100 + (lastScore ?? 3) * 10
    } else if (lastScore !== null) {
      priority = 1000 + lastScore * 100
    } else {
      priority = 6000 + due.stepIndex
    }
    out.push({ lesson: l, due, lastScore, priority })
  })
  return out.sort((a, b) => a.priority - b.priority)
}

function buildQueue(
  lessons: Lesson[],
  systems: System[],
  lessonParam: string | null,
  systemParam: string | null,
  today: string
): QueueItem[] {
  // Mode solo : une fiche précise (peut être une fiche pas due aujourd'hui)
  if (lessonParam) {
    const l = lessons.find(x => x.id === lessonParam)
    if (!l) return []
    let due: DueInfo | null = getDueForToday(l, today)
    if (!due) {
      const idx = getNextUndoneJ(l)
      if (idx === null) return []
      if (l.learn_date) {
        const dd = stepDate(l, idx)
        due = {
          stepIndex: idx,
          dueDate: dd,
          status: dd <= today ? (dd === today ? 'today' : 'missed') : 'fresh',
          overdueDays: dd < today ? daysBetween(dd, today) : 0,
        }
      } else {
        due = { stepIndex: idx, dueDate: today, status: 'fresh', overdueDays: 0 }
      }
    }
    return [{ lesson: l, due, lastScore: getLastScore(l), priority: 0 }]
  }

  // Filtre matière : queue d'aujourd'hui restreinte à un système
  if (systemParam) {
    const sysLessons = lessons.filter(l => l.system_id === systemParam)
    return computeTodayQueue(sysLessons, today)
  }

  // Queue complète : on filtre par le semestre courant comme le dashboard
  const semRaw = typeof window !== 'undefined' ? localStorage.getItem('medrev-sem') : null
  const sem = semRaw === '1' ? 1 : 2
  const semSystemIds = new Set(systems.filter(s => s.semestre === sem).map(s => s.id))
  const semLessons = lessons.filter(l => semSystemIds.has(l.system_id))
  return computeTodayQueue(semLessons, today)
}

// ===================== EXPORT (Suspense wrapper requis pour useSearchParams en Next.js 14) =====================
export default function FocusPage() {
  return (
    <Suspense fallback={
      <div className="focus-root">
        <div className="focus-loading">Chargement…</div>
      </div>
    }>
      <FocusPageBody />
    </Suspense>
  )
}

// ===================== BODY =====================
function FocusPageBody() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lessonParam = searchParams.get('lesson')
  const systemParam = searchParams.get('system')

  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [startedAt, setStartedAt] = useState<number>(0)
  const [now, setNow] = useState<number>(0)

  const today = new Date().toISOString().split('T')[0]

  // Reset scroll au montage (le <main> du layout dashboard a overflow auto)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [])

  // Chargement initial : auth + data + construction queue (en une fois)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      if (cancelled) return
      setUserId(user.id)
      const [{ data: sys }, { data: les }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id),
        supabase.from('lessons').select('*').eq('user_id', user.id),
      ])
      if (cancelled) return
      const sysList = (sys as System[] | null) ?? []
      const lesList = (les as Lesson[] | null) ?? []
      setSystems(sysList)
      const q = buildQueue(lesList, sysList, lessonParam, systemParam, today)
      setQueue(q)
      setPhase(q.length === 0 ? 'empty' : 'session')
      setCurrentIdx(0)
      setStartedAt(Date.now())
      setNow(Date.now())
    })()
    return () => { cancelled = true }
  }, [supabase, router, lessonParam, systemParam, today])

  // Tick du chrono en mode session
  useEffect(() => {
    if (phase !== 'session') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  const current = queue[currentIdx]
  const currentSystem = current ? systems.find(s => s.id === current.lesson.system_id) : undefined
  const currentSystemName = currentSystem?.name ?? 'Matière'

  // ============ Actions ============
  const rate = useCallback(async (score: Score) => {
    if (!current || loading || phase !== 'session') return
    setLoading(true)
    const newSteps = [...((current.lesson.steps as StepEntry[]) || [])]
    while (newSteps.length < J.length) newSteps.push(null)
    newSteps[current.due.stepIndex] = { score, date: today }
    await supabase.from('lessons').update({ steps: newSteps }).eq('id', current.lesson.id)

    setResults(prev => [...prev, {
      lessonId: current.lesson.id,
      lessonName: current.lesson.name,
      systemName: currentSystemName,
      outcome: { kind: 'rated', score },
    }])

    const nextIdx = currentIdx + 1
    if (nextIdx >= queue.length) setPhase('done')
    else setCurrentIdx(nextIdx)
    setLoading(false)
  }, [current, loading, phase, currentIdx, queue.length, supabase, today, currentSystemName])

  const report = useCallback(() => {
    if (!current || loading || phase !== 'session') return
    setResults(prev => [...prev, {
      lessonId: current.lesson.id,
      lessonName: current.lesson.name,
      systemName: currentSystemName,
      outcome: { kind: 'reported' },
    }])
    const nextIdx = currentIdx + 1
    if (nextIdx >= queue.length) setPhase('done')
    else setCurrentIdx(nextIdx)
  }, [current, loading, phase, currentIdx, queue.length, currentSystemName])

  // Raccourcis clavier : 1-5 / R / Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        router.push('/dashboard')
        return
      }
      if (phase !== 'session') return
      if (e.key === 'r' || e.key === 'R') { report(); return }
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 5) rate(n as Score)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rate, report, router, phase])

  // ===================== RENDERS =====================
  if (!userId || phase === 'loading') {
    return (
      <div className="focus-root">
        <div className="focus-loading">Chargement…</div>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="focus-root">
        <div className="focus-topbar">
          <div className="focus-brand">MedRev <span className="focus-brand-mode">focus</span></div>
          <Link href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
        </div>
        <div className="focus-stage">
          <div className="focus-card focus-empty-card">
            <div className="focus-empty-mark" aria-hidden="true">{'✓'}</div>
            <h2 className="focus-empty-title">Rien à réviser</h2>
            <p className="focus-empty-sub">
              {lessonParam
                ? "Cette fiche n’est pas disponible pour la révision."
                : systemParam
                  ? "Aucune fiche de cette matière n’est due aujourd’hui."
                  : "Tu es à jour. Profite de ta journée."}
            </p>
            <Link href="/dashboard" className="focus-empty-cta">Retour au tableau de bord</Link>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const elapsedSec = Math.max(0, Math.round((now - startedAt) / 1000))
    const min = Math.floor(elapsedSec / 60)
    const sec = elapsedSec % 60
    const rated = results.filter(r => r.outcome.kind === 'rated')
    const reported = results.length - rated.length
    const avg = rated.length === 0
      ? null
      : rated.reduce((s, r) => s + (r.outcome as { score: Score }).score, 0) / rated.length

    return (
      <div className="focus-root">
        <div className="focus-topbar">
          <div className="focus-brand">MedRev <span className="focus-brand-mode">focus</span></div>
          <Link href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
        </div>
        <div className="focus-stage">
          <div className="focus-card focus-done-card">
            <div className="focus-done-kicker">Session terminée</div>
            <h2 className="focus-done-title">
              {rated.length} fiche{rated.length > 1 ? 's' : ''} notée{rated.length > 1 ? 's' : ''}
              {reported > 0 && (
                <> <span className="focus-done-sep">{'·'}</span> <span className="focus-done-reported">{reported} reportée{reported > 1 ? 's' : ''}</span></>
              )}
            </h2>
            <div className="focus-done-meta">
              en {min} min {sec.toString().padStart(2, '0')} s
              {avg !== null && <> {'·'} moyenne <strong>{avg.toFixed(1)}/5</strong></>}
            </div>

            <div className="focus-done-list">
              {results.map((r, i) => (
                <div key={`${r.lessonId}-${i}`} className="focus-done-row">
                  <div className="focus-done-row-num">{i + 1}</div>
                  <div className="focus-done-row-main">
                    <div className="focus-done-row-name">{r.lessonName}</div>
                    <div className="focus-done-row-sys">{r.systemName}</div>
                  </div>
                  {r.outcome.kind === 'rated'
                    ? <div className={`focus-done-chip s${r.outcome.score}`}>{r.outcome.score}/5</div>
                    : <div className="focus-done-chip reported">Reportée</div>}
                </div>
              ))}
            </div>

            <Link href="/dashboard" className="focus-done-cta">Retour au tableau de bord</Link>
          </div>
        </div>
      </div>
    )
  }

  // ============ phase === 'session' ============
  if (!current) return null
  const elapsedSec = Math.max(0, Math.round((now - startedAt) / 1000))
  const min = Math.floor(elapsedSec / 60)
  const sec = elapsedSec % 60
  const total = queue.length
  const progressPct = Math.round((currentIdx / total) * 100)
  const sysColor = (currentSystem as { color?: string } | undefined)?.color || '#2D6A4F'

  let statusLabel = ''
  let statusCls: 'missed' | 'today' | 'fresh' = 'today'
  if (current.due.status === 'missed') {
    statusLabel = `J+${J[current.due.stepIndex]} manqué depuis ${current.due.overdueDays} j`
    statusCls = 'missed'
  } else if (current.due.status === 'fresh') {
    statusLabel = `J+${J[current.due.stepIndex]} · planification libre`
    statusCls = 'fresh'
  } else {
    statusLabel = current.lastScore === null && current.due.stepIndex === 0
      ? `J+0 · nouvelle fiche`
      : `J+${J[current.due.stepIndex]} dû aujourd’hui`
    statusCls = 'today'
  }

  return (
    <div className="focus-root">
      {/* TOP BAR */}
      <div className="focus-topbar">
        <div className="focus-brand">
          MedRev <span className="focus-brand-mode">focus</span>
        </div>
        <div className="focus-progress-wrap">
          <div className="focus-progress-bar" aria-hidden="true">
            <div className="focus-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="focus-progress-text">
            <strong>{currentIdx + 1}</strong> / {total}
            <span className="focus-progress-sep">{'·'}</span>
            <span className="focus-progress-time">{min}:{sec.toString().padStart(2, '0')}</span>
          </div>
        </div>
        <Link href="/dashboard" className="focus-quit" aria-label="Quitter la session">{'×'}</Link>
      </div>

      {/* STAGE */}
      <div className="focus-stage">
        <div className="focus-card">
          <div className="focus-kicker">
            <span className="focus-kicker-dot" style={{ background: sysColor }} />
            <span className="focus-kicker-sys">{currentSystemName}</span>
            <span className="focus-kicker-sep">{'•'}</span>
            <span className={`focus-kicker-status ${statusCls}`}>{statusLabel}</span>
          </div>

          <h1 className="focus-name">{current.lesson.name}</h1>

          {current.lastScore !== null && (
            <div className="focus-last">
              Dernière note&nbsp;: <span className={`focus-last-pill s${current.lastScore}`}>{current.lastScore}/5</span>
            </div>
          )}

          <div className="focus-ask">Quelle note&nbsp;?</div>
          <div className="focus-scores">
            {([1, 2, 3, 4, 5] as Score[]).map(n => (
              <button
                key={n}
                className={`focus-score s${n}`}
                onClick={() => rate(n)}
                disabled={loading}
                title={`Note ${n}/5 — raccourci ${n}`}
              >
                <span className="focus-score-num">{n}</span>
                <span className="focus-score-lbl">
                  {n === 1 ? 'À revoir' : n === 2 ? 'Faible' : n === 3 ? 'Moyen' : n === 4 ? 'Bien' : 'Maîtrisé'}
                </span>
                <span className="focus-score-key" aria-hidden="true">{n}</span>
              </button>
            ))}
          </div>

          <div className="focus-actions">
            <button
              className="focus-report"
              onClick={report}
              disabled={loading}
              title="Reporter à demain — raccourci R"
            >
              Reporter à demain
            </button>
          </div>
        </div>
      </div>

      {/* HINT */}
      <div className="focus-hint">
        <span><kbd>1</kbd>–<kbd>5</kbd> noter</span>
        <span className="focus-hint-sep">{'·'}</span>
        <span><kbd>R</kbd> reporter</span>
        <span className="focus-hint-sep">{'·'}</span>
        <span><kbd>Esc</kbd> quitter</span>
      </div>
    </div>
  )
}
