'use client'
// src/app/dashboard/page.tsx

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const FRAGILE_THRESHOLD = 3 // fiche considérée fragile si moyenne < 3

// Jardin Focus : pleine maturité de l'arbre à 100h cumulées (synchro avec la page focus)
const GARDEN_TIME_TO_FULL_MS = 100 * 60 * 60 * 1000

// ======================= TYPES =======================
type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null
type ScoreClass = 's1' | 's2' | 's3' | 's4' | 's5'

type DueInfo = {
  stepIndex: number
  dueDate: string
  status: 'missed' | 'today'
  overdueDays: number
}

type PriorityLesson = {
  lesson: Lesson
  due: DueInfo
  lastScore: Score | null
  priority: number
}

type FragileFiche = {
  lesson: Lesson
  avg: number
  last3: Score[]
  nextRevDate: string | null
}

type MatiereStat = {
  system: System
  totalFiches: number
  fichesWithScores: number
  avgScore: number | null
  fragile: FragileFiche[]
  okCount: number
}

type WeekDay = { label: string; date: string; active: boolean; isToday: boolean; inFuture: boolean }

// ======================= DATE HELPERS =======================
function dateStrFromOffset(base: string, offset: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}

// ======================= STEP HELPERS =======================
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

function getAverageScore(lesson: Lesson): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  let sum = 0, n = 0
  for (let i = 0; i < J.length; i++) {
    const sc = stepScore(steps[i])
    if (sc) { sum += sc; n++ }
  }
  return n > 0 ? sum / n : null
}

function getLast3Scores(lesson: Lesson): Score[] {
  const steps = (lesson.steps as StepEntry[]) || []
  const out: Score[] = []
  for (let i = J.length - 1; i >= 0 && out.length < 3; i--) {
    const sc = stepScore(steps[i])
    if (sc) out.unshift(sc)
  }
  return out
}

function getNextRevDate(lesson: Lesson): string | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (!stepScore(steps[i])) return stepDate(lesson, i)
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
    break // steps are chronological
  }
  return null
}

// ======================= PRIORITY / QUEUE =======================
function computeTodayQueue(lessons: Lesson[], today: string): PriorityLesson[] {
  const out: PriorityLesson[] = []
  for (const l of lessons) {
    const due = getDueForToday(l, today)
    if (!due) continue
    const lastScore = getLastScore(l)
    // Priority: lower = more urgent
    // Groupes : missed (0-999) < due with score (1000-5999) < new, no prior score (6000+)
    let priority: number
    if (due.status === 'missed') {
      // plus overdue + plus faible = plus urgent
      priority = -due.overdueDays * 100 + (lastScore ?? 3) * 10
    } else if (lastScore !== null) {
      priority = 1000 + lastScore * 100
    } else {
      priority = 6000 + due.stepIndex
    }
    out.push({ lesson: l, due, lastScore, priority })
  }
  return out.sort((a, b) => a.priority - b.priority)
}

// ======================= STREAK / REGULARITY =======================
function buildActiveDaysSet(lessons: Lesson[]): Set<string> {
  const set = new Set<string>()
  for (const l of lessons) {
    const steps = (l.steps as StepEntry[]) || []
    for (const s of steps) {
      if (!s) continue
      if (stepScore(s) === null) continue
      if (s.date) set.add(s.date)
    }
  }
  return set
}

function computeStreak(activeDays: Set<string>, today: string): number {
  let streak = 0
  let cursor = today
  // si aujourd'hui pas encore actif, on part d'hier (le streak tient toujours)
  if (!activeDays.has(cursor)) cursor = dateStrFromOffset(cursor, -1)
  while (activeDays.has(cursor)) {
    streak++
    cursor = dateStrFromOffset(cursor, -1)
  }
  return streak
}

function computeRecordStreak(activeDays: Set<string>): number {
  const sorted = Array.from(activeDays).sort()
  if (sorted.length === 0) return 0
  let max = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
      cur++
      if (cur > max) max = cur
    } else {
      cur = 1
    }
  }
  return max
}

function computeWeek(activeDays: Set<string>, today: string): WeekDay[] {
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const d = new Date(today + 'T12:00:00')
  const dayOfWeek = d.getDay() // 0=dim
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const out: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const t = new Date(d)
    t.setDate(d.getDate() + mondayOffset + i)
    const dateStr = t.toISOString().split('T')[0]
    out.push({
      label: labels[i],
      date: dateStr,
      active: activeDays.has(dateStr),
      isToday: dateStr === today,
      inFuture: dateStr > today,
    })
  }
  return out
}

// ======================= UPCOMING LOAD =======================
type WeekLoad = { label: string; count: number }

function computeUpcomingLoad(lessons: Lesson[], today: string): WeekLoad[] {
  const d = new Date(today + 'T12:00:00')
  const dayOfWeek = d.getDay()
  // décalage jusqu'au lundi suivant (exclu la semaine en cours)
  const nextMondayOffset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const weekStarts: string[] = []
  for (let w = 0; w < 4; w++) {
    const s = new Date(d)
    s.setDate(d.getDate() + nextMondayOffset + w * 7)
    weekStarts.push(s.toISOString().split('T')[0])
  }
  const counts = [0, 0, 0, 0]
  for (const l of lessons) {
    if (!l.learn_date) continue
    const steps = (l.steps as StepEntry[]) || []
    for (let i = 0; i < J.length; i++) {
      if (stepScore(steps[i])) continue
      const dd = stepDate(l, i)
      for (let w = 0; w < 4; w++) {
        const end = dateStrFromOffset(weekStarts[w], 6)
        if (dd >= weekStarts[w] && dd <= end) {
          counts[w]++
          break
        }
      }
    }
  }
  return counts.map((c, i) => ({ label: `S+${i + 1}`, count: c }))
}

// ======================= MATIÈRE STATS =======================
function computeMatiereStats(systems: System[], lessons: Lesson[]): MatiereStat[] {
  const out: MatiereStat[] = []
  for (const sys of systems) {
    const sysLessons = lessons.filter(l => l.system_id === sys.id)
    let sum = 0, n = 0
    const fragile: FragileFiche[] = []
    for (const l of sysLessons) {
      const avg = getAverageScore(l)
      if (avg === null) continue
      sum += avg; n++
      if (avg < FRAGILE_THRESHOLD) {
        fragile.push({
          lesson: l,
          avg,
          last3: getLast3Scores(l),
          nextRevDate: getNextRevDate(l),
        })
      }
    }
    fragile.sort((a, b) => a.avg - b.avg)
    out.push({
      system: sys,
      totalFiches: sysLessons.length,
      fichesWithScores: n,
      avgScore: n > 0 ? sum / n : null,
      fragile,
      okCount: Math.max(0, sysLessons.length - fragile.length),
    })
  }
  // Filtre : matières avec au moins une fiche notée
  const withData = out.filter(m => m.fichesWithScores > 0)
  // Tri par avg ascendant (plus faible en premier)
  withData.sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999))
  return withData
}

// ======================= STYLING HELPERS =======================
function scoreClass(avg: number | null): ScoreClass {
  if (avg === null) return 's3'
  if (avg < 2) return 's1'
  if (avg < 3) return 's2'
  if (avg < 3.7) return 's3'
  if (avg < 4.5) return 's4'
  return 's5'
}

function scoreLabel(avg: number | null): string {
  const cls = scoreClass(avg)
  if (cls === 's1') return 'À retravailler'
  if (cls === 's2') return 'Fragile'
  if (cls === 's3') return 'Moyen'
  if (cls === 's4') return 'Bien'
  return 'Maîtrisée'
}

function formatDateFR(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function buildMetaForDue(due: DueInfo, systemName: string, lastScore: Score | null): { text: string; withOverdue: boolean } {
  const parts: string[] = []
  if (due.status === 'missed') {
    parts.push(`J+${J[due.stepIndex]} manqué depuis ${due.overdueDays} j`)
  } else if (lastScore === null && due.stepIndex === 0) {
    parts.push(`J+0 nouvelle fiche`)
  } else {
    parts.push(`J+${J[due.stepIndex]} dû aujourd'hui`)
  }
  parts.push(systemName)
  if (lastScore !== null) parts.push(`dernière ${lastScore}/5`)
  return { text: parts.join(' · '), withOverdue: due.status === 'missed' }
}

// ======================= MINI JARDIN (lecture du state Focus) =======================
// On ne fait QUE lire l'état du jardin (localStorage prioritaire, Supabase optionnel).
// Le jardin est cultivé sur la page /dashboard/focus — ici on l'expose en aperçu.
type GardenKind =
  | 'flower' | 'tulip' | 'sunflower' | 'mushroom'
  | 'butterfly' | 'rabbit' | 'squirrel' | 'owl' | 'deer' | 'fox'
  | 'pond' | 'sapling' | 'log'
type GardenElement = { kind: GardenKind; x: number; y: number; variant?: string }
type GardenSnapshot = { elapsedMs: number; fichesCount: number; elements: GardenElement[] }

function readGardenLocal(userId: string): GardenSnapshot {
  if (typeof window === 'undefined') return { elapsedMs: 0, fichesCount: 0, elements: [] }
  try {
    const raw = localStorage.getItem('medrev-garden-' + userId)
    if (!raw) return { elapsedMs: 0, fichesCount: 0, elements: [] }
    const parsed = JSON.parse(raw)
    return {
      elapsedMs: Number(parsed.elapsedMs ?? 0),
      fichesCount: Number(parsed.fichesCount ?? 0),
      elements: (parsed.elements as GardenElement[]) ?? [],
    }
  } catch {
    return { elapsedMs: 0, fichesCount: 0, elements: [] }
  }
}

type GardenCounts = { flowers: number; butterflies: number; animals: number; rares: number }
function countGardenElements(els: GardenElement[]): GardenCounts {
  const c: GardenCounts = { flowers: 0, butterflies: 0, animals: 0, rares: 0 }
  for (const e of els) {
    if (e.kind === 'flower' || e.kind === 'tulip' || e.kind === 'sunflower') c.flowers++
    else if (e.kind === 'butterfly') c.butterflies++
    else if (e.kind === 'rabbit' || e.kind === 'mushroom' || e.kind === 'sapling') c.animals++
    else if (e.kind === 'owl' || e.kind === 'deer' || e.kind === 'fox' || e.kind === 'squirrel' || e.kind === 'pond' || e.kind === 'log') c.rares++
  }
  return c
}

const FLOWER_COLOR: Record<string, string> = {
  red: '#C75050', yellow: '#FBD56B', pink: '#F4B5C9',
  orange: '#E89A4F', purple: '#9C68B0', white: '#FFE5DD',
}
const BUTTERFLY_COLOR: Record<string, [string, string]> = {
  amber: ['#E89A4F', '#FBD56B'],
  blue:  ['#7AA8E0', '#A8C8E8'],
  purple:['#9C68B0', '#D5B0E0'],
}

// ======================= MINI JARDIN COMPONENT =======================
// Aperçu compact du jardin annuel : ciel + arbre + fleurs/papillons.
// Ne fait QUE lire le state — toute culture du jardin se fait sur /dashboard/focus.
function DashGarden({
  userId, queueLength, startHref,
}: { userId: string | null; queueLength: number; startHref: string }) {
  const supabase = createClient()
  const [garden, setGarden] = useState<GardenSnapshot | null>(null)

  useEffect(() => {
    if (!userId) return
    setGarden(readGardenLocal(userId))
    // Pull cloud (best-effort) si plus à jour que local
    void (async () => {
      try {
        const { data } = await supabase
          .from('gardens')
          .select('elapsed_ms, fiches_count, elements')
          .eq('user_id', userId)
          .maybeSingle()
        if (!data) return
        const cloudElapsed = Number((data as any).elapsed_ms ?? 0)
        const cloudFiches = Number((data as any).fiches_count ?? 0)
        const cloudElements = ((data as any).elements as GardenElement[]) ?? []
        setGarden(prev => {
          const local = prev ?? { elapsedMs: 0, fichesCount: 0, elements: [] }
          const seen = new Set<string>()
          const merged: GardenElement[] = []
          for (const e of [...local.elements, ...cloudElements]) {
            const k = e.kind + '|' + e.x + '|' + e.y + '|' + (e.variant ?? '')
            if (seen.has(k)) continue
            seen.add(k)
            merged.push(e)
          }
          return {
            elapsedMs: Math.max(local.elapsedMs, cloudElapsed),
            fichesCount: Math.max(local.fichesCount, cloudFiches),
            elements: merged,
          }
        })
      } catch {
        // swallow
      }
    })()

    // Re-load si Focus écrit dans localStorage pendant que le dashboard est ouvert
    function onStorage(e: StorageEvent) {
      if (e.key === 'medrev-garden-' + userId) setGarden(readGardenLocal(userId))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId, supabase])

  const treeProgress = garden ? Math.max(0, Math.min(1, garden.elapsedMs / GARDEN_TIME_TO_FULL_MS)) : 0
  const counts = garden ? countGardenElements(garden.elements) : { flowers: 0, butterflies: 0, animals: 0, rares: 0 }
  const elements = garden?.elements ?? []

  // Heure réelle pour l'ambiance ciel (jour ou nuit, sans tous les keyframes du focus)
  const hour = new Date().getHours()
  const isDay = hour >= 7 && hour < 19
  const skyTop = isDay ? '#7AA0B8' : '#1F2A4A'
  const skyMid = isDay ? '#B6CFD8' : '#3D3A6A'

  // Branches de l'arbre (apparaissent à des paliers de progression)
  const branches = [
    { progress: 0.18, x1: 200, y1: 138, x2: 156, y2: 116, w: 5 },
    { progress: 0.36, x1: 200, y1: 124, x2: 246, y2: 100, w: 5 },
    { progress: 0.54, x1: 200, y1: 110, x2: 168, y2: 86, w: 4 },
    { progress: 0.72, x1: 200, y1: 100, x2: 234, y2: 78, w: 4 },
  ]

  // Échelle des positions du focus (1600x1000) → mini (400x260)
  // sol focus = y 800-1000 → sol mini = y 220-260
  const SCALE_X = 0.25
  const SCALE_Y = 0.26

  return (
    <div className="dash-garden">
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMax slice"
        className="dash-garden-svg"
      >
        <defs>
          <linearGradient id="dgSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={skyMid} />
          </linearGradient>
          <linearGradient id="dgGround" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7AA56B" />
            <stop offset="1" stopColor="#5A8A4A" />
          </linearGradient>
        </defs>

        {/* Ciel */}
        <rect x="0" y="0" width="400" height="220" fill="url(#dgSky)" />
        {/* Soleil ou lune */}
        {isDay ? (
          <circle cx={60 + ((hour - 7) / 12) * 280} cy={80 - Math.sin(((hour - 7) / 12) * Math.PI) * 50} r="14" fill="#FBD56B" opacity=".9" />
        ) : (
          <circle cx="320" cy="60" r="11" fill="#E8E4D0" />
        )}
        {/* Nuages */}
        <ellipse cx="80" cy="50" rx="28" ry="6" fill="white" opacity={isDay ? .7 : .25} />
        <ellipse cx="280" cy="36" rx="22" ry="5" fill="white" opacity={isDay ? .6 : .2} />
        {/* Sol */}
        <rect x="0" y="220" width="400" height="40" fill="url(#dgGround)" />

        {/* Arbre central — pousse avec elapsedMs (transform sur attribut SVG plutôt
            que sur style pour éviter les soucis de transformBox sur certains parsers). */}
        {(() => {
          const scale = 0.45 + treeProgress * 0.55
          // pivot au pied de l'arbre (200, 220)
          const tx = 200 * (1 - scale)
          const ty = 220 * (1 - scale)
          return (
            <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
              <rect x="195" y="160" width="10" height="60" fill="#6B4F35" />
              <rect x="195" y="160" width="10" height="60" fill="#5A4128" opacity=".5" />
              {branches.map((b, i) => {
                if (treeProgress < b.progress) return null
                return (
                  <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke="#6B4F35" strokeWidth={b.w} strokeLinecap="round" />
                )
              })}
              {treeProgress >= 0.10 ? <ellipse cx="200" cy="148" rx="40" ry="36" fill="#3B6D11" /> : null}
              {treeProgress >= 0.40 ? <ellipse cx="174" cy="144" rx="22" ry="20" fill="#4A8A1F" /> : null}
              {treeProgress >= 0.60 ? <ellipse cx="226" cy="144" rx="22" ry="20" fill="#4A8A1F" /> : null}
              {treeProgress >= 0.80 ? <ellipse cx="200" cy="124" rx="24" ry="18" fill="#5AA02A" /> : null}
            </g>
          )
        })()}

        {/* Fleurs — positions exactes scalées depuis le focus garden */}
        {elements.map((el, i) => {
          const x = el.x * SCALE_X
          const y = el.y * SCALE_Y
          if (el.kind === 'flower' || el.kind === 'tulip' || el.kind === 'sunflower') {
            const color = FLOWER_COLOR[el.variant ?? 'red'] ?? '#C75050'
            const r = el.kind === 'sunflower' ? 4 : el.kind === 'tulip' ? 3 : 2.6
            return <circle key={i} cx={x} cy={y} r={r} fill={color} />
          }
          if (el.kind === 'butterfly') {
            const cols = BUTTERFLY_COLOR[el.variant ?? 'amber'] ?? BUTTERFLY_COLOR.amber
            return (
              <g key={i}>
                <ellipse cx={x - 2} cy={y} rx="2.2" ry="1.6" fill={cols[0]} />
                <ellipse cx={x + 2} cy={y} rx="2.2" ry="1.6" fill={cols[1]} />
                <line x1={x} y1={y - 1} x2={x} y2={y + 1.4} stroke="#3D2A1F" strokeWidth=".7" />
              </g>
            )
          }
          if (el.kind === 'mushroom') {
            return (
              <g key={i}>
                <rect x={x - 0.8} y={y - 1} width="1.6" height="2.5" fill="#E8DDC4" />
                <ellipse cx={x} cy={y - 1.5} rx="2.4" ry="1.6" fill={el.variant === 'orange' ? '#E89A4F' : '#C75050'} />
              </g>
            )
          }
          if (el.kind === 'rabbit') {
            return <ellipse key={i} cx={x} cy={y} rx="3" ry="2.2" fill="#E0D5C0" />
          }
          if (el.kind === 'pond') {
            return <ellipse key={i} cx={x} cy={y} rx="14" ry="4" fill="#5B8ED4" opacity=".75" />
          }
          // Animaux rares + sapling : petit dot sombre, lecture rapide
          return <circle key={i} cx={x} cy={y} r={2.5} fill="#3B2F1F" />
        })}
      </svg>

      <div className="dash-garden-overlay">
        <div className="dash-garden-stats">
          <div className="dash-garden-stat"><span className="dash-garden-num">{counts.flowers}</span><span className="dash-garden-lbl">fleurs</span></div>
          <div className="dash-garden-stat"><span className="dash-garden-num">{counts.butterflies}</span><span className="dash-garden-lbl">papillons</span></div>
          {counts.rares > 0 && (
            <div className="dash-garden-stat"><span className="dash-garden-num">{counts.rares}</span><span className="dash-garden-lbl">rares</span></div>
          )}
        </div>
        <div className="dash-garden-cta-wrap">
          <div className="dash-garden-queue">
            {queueLength === 0 ? (
              <span>Aucune révision aujourd&apos;hui</span>
            ) : (
              <span>
                <strong>{queueLength}</strong> {queueLength === 1 ? 'fiche' : 'fiches'} · ~{queueLength * 8} min
              </span>
            )}
          </div>
          <Link
            href={startHref}
            className="dash-garden-cta"
            style={queueLength === 0 ? { pointerEvents: 'none', opacity: .55 } : undefined}
          >
            {queueLength === 0 ? 'Voir le jardin' : 'Démarrer'}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ======================= MAIN COMPONENT =======================
export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ name?: string } | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [semester, setSemester] = useState<1 | 2>(2)
  const [showTodayModal, setShowTodayModal] = useState(false)
  const [showWeakModal, setShowWeakModal] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const firstName = profile?.name?.split(' ')[0] ?? ''

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
    ])
    setSystems((sys as System[] | null) ?? [])
    setLessons((les as Lesson[] | null) ?? [])
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            const displayName =
              (user.user_metadata as { username?: string; name?: string })?.username ||
              (user.user_metadata as { username?: string; name?: string })?.name ||
              (data as { name?: string }).name ||
              user.email?.split('@')[0] || ''
            setProfile({ name: displayName })
          }
        })
      load(user.id)
    })
  }, [load, router, supabase])

  // Écoute le toggle Sem 1 / Sem 2 depuis le layout
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemester(raw === '1' ? 1 : 2)
    function handler(e: Event) {
      const detail = (e as CustomEvent<1 | 2>).detail
      if (detail === 1 || detail === 2) setSemester(detail)
    }
    window.addEventListener('medrev-sem-change', handler)
    return () => window.removeEventListener('medrev-sem-change', handler)
  }, [])

  // Fermeture modale par ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowTodayModal(false)
        setShowWeakModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Reset du scroll à chaque entrée sur le dashboard (évite le décalage
  // hérité d'une autre page comme /dashboard/fiches qui scrolle le <main>)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [])

  // ================= DONNÉES DÉRIVÉES =================
  const semSystems = useMemo(() => systems.filter(s => s.semestre === semester), [systems, semester])
  const semSystemIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semSystemIds.has(l.system_id)), [lessons, semSystemIds])

  const todayQueue = useMemo(() => computeTodayQueue(semLessons, today), [semLessons, today])
  const activeDays = useMemo(() => buildActiveDaysSet(semLessons), [semLessons])
  const streak = useMemo(() => computeStreak(activeDays, today), [activeDays, today])
  const recordStreak = useMemo(() => computeRecordStreak(activeDays), [activeDays])
  const weekDays = useMemo(() => computeWeek(activeDays, today), [activeDays, today])
  const upcomingLoad = useMemo(() => computeUpcomingLoad(semLessons, today), [semLessons, today])
  const matiereStats = useMemo(() => computeMatiereStats(semSystems, semLessons), [semSystems, semLessons])

  // Nombre de jours actifs cette semaine jusqu'à aujourd'hui (inclus)
  const weekDone = weekDays.filter(d => d.active && !d.inFuture).length
  const weekTotal = weekDays.filter(d => !d.inFuture).length

  // Point faible principal
  const weakest = matiereStats[0] ?? null
  const weakestFragile = weakest?.fragile.slice(0, 2) ?? []

  // Charge : peak
  const loadMax = Math.max(1, ...upcomingLoad.map(w => w.count))
  const peakIdx = upcomingLoad.findIndex(w => w.count === loadMax && loadMax > 0)

  // Session focus — ouvre /dashboard/focus avec la queue complète.
  // Le focus gère l'ordre suggéré ; les flèches permettent de naviguer.
  const startSessionHref = '/dashboard/focus'

  // Label du jour
  const todayLabel = new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  })

  if (!userId) return null

  return (
    <div className="dash-page">

      {/* ====== TOP BAR ====== */}
      <div className="dash-top">
        <div>
          <h1 className="dash-title">
            {firstName ? <>Bonjour <em>{firstName}</em></> : <>Bonjour</>}
          </h1>
          <div className="dash-hello">Encore une journée pour avancer.</div>
        </div>
        <div className="dash-date">{todayLabel}</div>
      </div>

      {/* ====== 4 ZONES ====== */}
      <div className="dash">

        {/* ZONE 1 : AUJOURD'HUI */}
        <div className="today">
          <div className="today-left">
            <div className="today-head">
              <span className="today-label"><span className="today-label-dot" /> Aujourd&apos;hui</span>
              {todayQueue.length > 5 && (
                <button className="see-more" onClick={() => setShowTodayModal(true)}>
                  Voir les {todayQueue.length} révisions
                </button>
              )}
            </div>

            {todayQueue.length === 0 ? (
              <>
                <h2 className="today-intro">Aucune révision pour aujourd&apos;hui</h2>
                <div className="today-sub">Profite de ta journée — ou ajoute des fiches pour démarrer.</div>
                <div className="today-empty">Rien à faire aujourd&apos;hui.</div>
              </>
            ) : (
              <>
                <h2 className="today-intro">
                  Voici tes <em>révisions du jour</em>, dans l&apos;ordre suggéré
                </h2>
                <div className="today-sub">
                  le premier item est prioritaire — tu peux skip ou reporter à tout moment
                </div>

                <div className="today-list">
                  {todayQueue.slice(0, 5).map((p, idx) => {
                    const sys = semSystems.find(s => s.id === p.lesson.system_id)
                    const sysName = sys?.name ?? 'Matière'
                    const meta = buildMetaForDue(p.due, sysName, p.lastScore)
                    const highlight = idx === 0
                    return (
                      <div key={p.lesson.id} className={`today-item${highlight ? ' highlight' : ''}`}>
                        <div className="today-item-icon">{highlight ? '!' : idx + 1}</div>
                        <div className="today-item-main">
                          <div className="today-item-name">{p.lesson.name}</div>
                          <div className="today-item-meta">
                            {meta.withOverdue
                              ? <><strong>J+{J[p.due.stepIndex]} manqué depuis {p.due.overdueDays} j</strong> · {sysName}{p.lastScore !== null ? ` · dernière ${p.lastScore}/5` : ''}</>
                              : meta.text}
                          </div>
                        </div>
                        <div className="today-item-arrow">{'\u2192'}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Mini-jardin remplace le side panel CTA. La session focus se lance
              depuis le bouton intégré au jardin. */}
          <DashGarden
            userId={userId}
            queueLength={todayQueue.length}
            startHref={startSessionHref}
          />
        </div>

        {/* ZONES 2, 3, 4 */}
        <div className="dash-row">

          {/* ZONE 2 : POINT FAIBLE */}
          <div className="dash-card">
            <div className="dash-card-title with-action">
              Point faible
              {matiereStats.length > 0 && (
                <button className="see-more" onClick={() => setShowWeakModal(true)}>
                  Toutes les matières
                </button>
              )}
            </div>

            {weakest === null ? (
              <div className="weak-empty">
                Pas encore assez de notes pour identifier un point faible.
              </div>
            ) : (
              <>
                <h3 className="weak-matiere">
                  <span className={`weak-dot ${scoreClass(weakest.avgScore)}`} />
                  {weakest.system.name}
                </h3>
                <div className="weak-score">
                  <span className={`weak-score-num ${scoreClass(weakest.avgScore)}`}>
                    {weakest.avgScore !== null ? weakest.avgScore.toFixed(1) : '—'}
                  </span>
                  <span className="weak-score-max">/ 5</span>
                  <span className={`weak-score-label ${scoreClass(weakest.avgScore)}`}>
                    {scoreLabel(weakest.avgScore)}
                  </span>
                </div>

                {weakestFragile.length > 0 ? (
                  <>
                    <div className="weak-sub">
                      {weakestFragile.length} fiche{weakestFragile.length > 1 ? 's' : ''} fragile{weakestFragile.length > 1 ? 's' : ''}
                    </div>
                    <div className="weak-list">
                      {weakestFragile.map(f => {
                        const cls = scoreClass(f.avg)
                        return (
                          <div key={f.lesson.id} className="weak-item">
                            <div>
                              <div className="weak-item-name">{f.lesson.name}</div>
                              <div className="weak-item-meta">
                                {f.last3.length > 0
                                  ? `3 dernières · ${f.last3.join(' · ')}`
                                  : 'Pas encore notée'}
                              </div>
                            </div>
                            <div className="weak-item-score">
                              <span className={`weak-item-num ${cls}`}>{f.avg.toFixed(1)}</span>
                              <span className={`weak-chip ${cls}`}>{Math.round(f.avg)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="weak-sub" style={{ marginTop: 8 }}>Aucune fiche fragile — tu gères.</div>
                )}

                <Link
                  href={`/dashboard/focus?system=${weakest.system.id}`}
                  className="weak-cta"
                  style={{ textDecoration: 'none' }}
                >
                  Retravailler {weakestFragile.length > 0 ? 'ces fiches' : 'cette matière'}
                </Link>
              </>
            )}
          </div>

          {/* ZONE 3 : RÉGULARITÉ */}
          <div className="dash-card">
            <div className="dash-card-title">Régularité</div>

            <div className="reg-num-wrap">
              <div className="reg-num">{streak}</div>
              <div className="reg-num-unit">jours<br />d&apos;affilée</div>
            </div>
            <div className="reg-sub">
              {streak === 0
                ? 'Reprends le rythme aujourd\u2019hui.'
                : <>Tu tiens depuis le <strong>{formatDateFR(dateStrFromOffset(today, -(streak - 1)))}</strong>.</>}
            </div>

            <div className="reg-record">
              <span className="reg-record-label">Record perso</span>
              <strong>{recordStreak} jour{recordStreak > 1 ? 's' : ''}</strong>
            </div>

            <div className="reg-week">
              <div className="reg-week-label">
                <span>Cette semaine</span>
                <strong>{weekDone} / {weekTotal}</strong>
              </div>
              <div className="reg-strip">
                {weekDays.map((d, i) => {
                  const cls = [
                    'reg-day',
                    d.active && !d.inFuture ? 'done' : '',
                    d.isToday ? 'today' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <div key={i} className={cls}>
                      <div className="reg-day-dot" />
                      <div className="reg-day-label">{d.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ZONE 4 : CHARGE À VENIR */}
          <div className="dash-card">
            <div className="dash-card-title">Charge à venir</div>

            <div className="load-rows">
              {upcomingLoad.map((w, i) => {
                const showPeak = loadMax > 10
                const isPeak = showPeak && i === peakIdx && w.count === loadMax
                const pct = loadMax > 0 ? Math.max(6, Math.round((w.count / loadMax) * 100)) : 0
                return (
                  <div key={w.label} className="load-row">
                    <span className="load-week">{w.label}</span>
                    <div className="load-bar">
                      <div
                        className={`load-bar-f${isPeak ? ' peak' : ''}`}
                        style={{ width: `${w.count > 0 ? pct : 0}%` }}
                      />
                    </div>
                    <span className={`load-count${isPeak ? ' peak' : ''}`}>{w.count}</span>
                  </div>
                )
              })}
            </div>

            {loadMax === 0 ? (
              <div className="load-note calm">
                <strong>Aucune révision</strong> prévue dans les 4 prochaines semaines.
              </div>
            ) : peakIdx >= 0 && loadMax > 10 ? (
              <div className="load-note">
                <strong>Pic en {upcomingLoad[peakIdx].label}</strong> — pense à étaler tes nouvelles fiches.
              </div>
            ) : (
              <div className="load-note calm">
                <strong>Charge équilibrée</strong> sur les 4 prochaines semaines.
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ====== MODALE : AUJOURD'HUI ====== */}
      {showTodayModal && (
        <TodayModal
          queue={todayQueue}
          systems={semSystems}
          startHref={startSessionHref}
          onClose={() => setShowTodayModal(false)}
          todayLabel={todayLabel}
        />
      )}

      {/* ====== MODALE : POINT FAIBLE ====== */}
      {showWeakModal && (
        <WeakModal
          stats={matiereStats}
          onClose={() => setShowWeakModal(false)}
        />
      )}
    </div>
  )
}

// ======================= TODAY MODAL =======================
type TodaySort = 'priority' | 'subject' | 'j'

function TodayModal({
  queue, systems, startHref, onClose, todayLabel,
}: {
  queue: PriorityLesson[]
  systems: System[]
  startHref: string
  onClose: () => void
  todayLabel: string
}) {
  const [sort, setSort] = useState<TodaySort>('priority')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')

  const sortedFiltered = useMemo(() => {
    let list = queue.slice()
    if (subjectFilter !== 'all') {
      list = list.filter(p => p.lesson.system_id === subjectFilter)
    }
    if (sort === 'subject') {
      list.sort((a, b) => {
        const sa = systems.find(s => s.id === a.lesson.system_id)?.name ?? ''
        const sb = systems.find(s => s.id === b.lesson.system_id)?.name ?? ''
        return sa.localeCompare(sb)
      })
    } else if (sort === 'j') {
      list.sort((a, b) => J[a.due.stepIndex] - J[b.due.stepIndex])
    }
    // 'priority' = déjà trié par le calcul
    return list
  }, [queue, systems, sort, subjectFilter])

  const totalMin = queue.length * 8

  const subjectsInQueue = useMemo(() => {
    const ids = new Set(queue.map(p => p.lesson.system_id))
    return systems.filter(s => ids.has(s.id))
  }, [queue, systems])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>

        <div className="full-header">
          <div className="full-title-wrap">
            <div className="full-title-ic">{'\u25CF'}</div>
            <div>
              <h2 className="full-title">Révisions du jour</h2>
              <div className="full-sub">{todayLabel}</div>
            </div>
          </div>
