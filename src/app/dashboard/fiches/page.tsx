'use client'
// src/app/dashboard/fiches/page.tsx

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

// Palette de couleurs pour les matières, utilisée si sys.color n'est pas défini
const SUBJ_COLORS = [
  '#C75050', // rouge
  '#5B8ED4', // bleu
  '#8D6BB0', // violet
  '#A06840', // marron
  '#C47B2B', // ambre
  '#3A8F8A', // teal
  '#7AA56B', // vert
  '#D9B24A', // jaune
]

type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null

// Normalise une step : supporte l'ancien format {ok, date} et le nouveau {score, date}
function stepScore(s: StepEntry): Score | null {
  if (!s) return null
  if (typeof (s as any).score === 'number') {
    const sc = (s as any).score
    if (sc >= 1 && sc <= 5) return sc as Score
  }
  if (typeof (s as any).ok === 'boolean') {
    return (s as any).ok ? 5 : 1
  }
  return null
}

function stepDate(lesson: Lesson, i: number): string {
  if (!lesson.learn_date) return ''
  const d = new Date(lesson.learn_date + 'T12:00:00')
  d.setDate(d.getDate() + J[i])
  return d.toISOString().split('T')[0]
}

type StampState =
  | { kind: 'score'; score: Score }
  | { kind: 'today' }
  | { kind: 'missed' }
  | { kind: 'future' }

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

// Retourne l'index du premier J dû (date <= today, non fait)
function getDueStepIndex(lesson: Lesson, today: string): number {
  if (!lesson.learn_date) return -1
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (stepScore(steps[i])) continue
    const ds = stepDate(lesson, i)
    if (ds <= today) return i
  }
  return -1
}

// Dernière note donnée à cette fiche (pour filtre + accent de carte)
function getLastScore(lesson: Lesson): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = J.length - 1; i >= 0; i--) {
    const sc = stepScore(steps[i])
    if (sc) return sc
  }
  return null
}

// Prochaine date de révision (première step non faite)
function getNextRevDate(lesson: Lesson): string | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (!stepScore(steps[i])) return stepDate(lesson, i)
  }
  return null
}

// Label pour le pied de carte ("aujourd'hui", "dans 3 j", "terminée", "à planifier"…)
function nextRevLabel(lesson: Lesson, today: string): { text: string; html: string; urgent: boolean; calm: boolean; start: boolean } {
  if (!lesson.learn_date) {
    return { text: 'À planifier', html: 'À planifier', urgent: false, calm: false, start: true }
  }
  const d = getNextRevDate(lesson)
  if (!d) return { text: 'Terminée', html: 'Terminée', urgent: false, calm: true, start: false }
  if (d === today) return { text: "aujourd'hui", html: "Révision <strong>aujourd'hui</strong>", urgent: true, calm: false, start: false }
  if (d < today) return { text: 'en retard', html: '<strong>En retard</strong>', urgent: true, calm: false, start: false }
  const diff = Math.round((new Date(d).getTime() - new Date(today).getTime()) / 86400000)
  if (diff === 1) return { text: 'demain', html: 'Prochaine <strong>demain</strong>', urgent: false, calm: true, start: false }
  return { text: `dans ${diff} j`, html: `Prochaine <strong>dans ${diff} j</strong>`, urgent: false, calm: true, start: false }
}

// Status label (pastille en haut à droite de la carte)
function cardStatus(lesson: Lesson): { cls: string; label: string } {
  const last = getLastScore(lesson)
  if (last === null) {
    return { cls: 'new', label: 'Nouvelle' }
  }
  if (last === 1) return { cls: 's1', label: 'À revoir' }
  if (last === 2) return { cls: 's2', label: 'Faible' }
  if (last === 3) return { cls: 's3', label: 'Moyen' }
  if (last === 4) return { cls: 's4', label: 'Bien' }
  return { cls: 's5', label: 'Maîtrisée' }
}

type FilterKey = 'all' | 's1' | 's2' | 's3' | 's4' | 's5' | 'new' | 'due'

export default function FichesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [semester, setSemester] = useState<1 | 2>(2)

  // Create modals
  const [showNewSystem, setShowNewSystem] = useState(false)
  const [showNewLesson, setShowNewLesson] = useState(false)

  // New system form
  const [newSysName, setNewSysName] = useState('')
  const [newSysSemestre, setNewSysSemestre] = useState<1 | 2>(2)
  const [newSysColor, setNewSysColor] = useState(SUBJ_COLORS[0])
  const [sysLoading, setSysLoading] = useState(false)

  // New lesson form
  const [newLesName, setNewLesName] = useState('')
  const [newLesDate, setNewLesDate] = useState('')
  const [newLesSysId, setNewLesSysId] = useState('')
  const [lesLoading, setLesLoading] = useState(false)

  // Review session
  const [reviewLessons, setReviewLessons] = useState<Lesson[] | null>(null) // null = closed
  const [reviewIdx, setReviewIdx] = useState(0)
  const [reviewResults, setReviewResults] = useState<{ lessonId: string; score: Score }[]>([])
  const [reviewDone, setReviewDone] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewTitle, setReviewTitle] = useState<string>('')

  const today = new Date().toISOString().split('T')[0]

  // Load persisted semester + listen to changes from sidebar
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemester(raw === '1' ? 1 : 2)
    const onSem = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail === 1 || detail === 2) setSemester(detail)
    }
    window.addEventListener('medrev-sem-change', onSem)
    return () => window.removeEventListener('medrev-sem-change', onSem)
  }, [])

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
    ])
    setSystems((sys as System[]) || [])
    setLessons((les as Lesson[]) || [])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      load(user.id)
    })
  }, [])

  // Matières du semestre courant
  const semSystems = useMemo(
    () => systems.filter(s => (s as any).semestre === semester),
    [systems, semester]
  )

  // Sélection par défaut quand on change de semestre
  useEffect(() => {
    if (semSystems.length === 0) {
      setSelectedSystemId(null)
      return
    }
    if (!selectedSystemId || !semSystems.find(s => s.id === selectedSystemId)) {
      setSelectedSystemId(semSystems[0].id)
    }
  }, [semSystems, selectedSystemId])

  // ---- Create functions ----
  async function createSystem() {
    if (!userId || !newSysName.trim()) return
    setSysLoading(true)
    const payload: any = {
      user_id: userId,
      name: newSysName.trim(),
      semestre: newSysSemestre,
      color: newSysColor,
      icon: '',
    }
    const { data } = await supabase.from('systems').insert(payload).select().single()
    setSysLoading(false)
    if (data) {
      setSystems(prev => [...prev, data as System])
      if ((data as any).semestre === semester) setSelectedSystemId(data.id)
    }
    setShowNewSystem(false); setNewSysName(''); setNewSysColor(SUBJ_COLORS[0]); setNewSysSemestre(semester)
  }

  async function createLesson() {
    if (!userId || !newLesName.trim() || !newLesSysId) return
    setLesLoading(true)
    const { data } = await supabase.from('lessons').insert({
      user_id: userId, system_id: newLesSysId, name: newLesName.trim(),
      learn_date: newLesDate || today, steps: new Array(J.length).fill(null), ai_questions: [],
    }).select().single()
    setLesLoading(false)
    if (data) setLessons(prev => [...prev, data as Lesson])
    setShowNewLesson(false); setNewLesName(''); setNewLesDate('')
  }

  // ---- Review session ----
  function lessonsToReview(sysId?: string): Lesson[] {
    const pool = sysId
      ? lessons.filter(l => l.system_id === sysId)
      : lessons.filter(l => semSystems.find(s => s.id === l.system_id))
    return pool.filter(l => getDueStepIndex(l, today) !== -1)
  }

  function openReview(list: Lesson[], title: string) {
    if (list.length === 0) return
    setReviewLessons(list)
    setReviewTitle(title)
    setReviewIdx(0)
    setReviewResults([])
    setReviewDone(false)
  }

  async function rateLesson(score: Score) {
    if (!reviewLessons) return
    const lesson = reviewLessons[reviewIdx]
    if (!lesson) return
    const stepIdx = getDueStepIndex(lesson, today)
    if (stepIdx === -1) return

    setReviewLoading(true)
    const newSteps = [...((lesson.steps as StepEntry[]) || [])]
    while (newSteps.length < J.length) newSteps.push(null)
    newSteps[stepIdx] = { score, date: today }

    await supabase.from('lessons').update({ steps: newSteps }).eq('id', lesson.id)

    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, steps: newSteps } as Lesson : l))
    setReviewResults(prev => [...prev, { lessonId: lesson.id, score }])
    setReviewLoading(false)

    if (reviewIdx + 1 >= reviewLessons.length) setReviewDone(true)
    else setReviewIdx(i => i + 1)
  }

  // ---- Dérivées ----
  const selectedSystem = semSystems.find(s => s.id === selectedSystemId) ?? null

  // Matière ⇒ couleur
  const colorOfSystem = useMemo(() => {
    const map = new Map<string, string>()
    semSystems.forEach((s, idx) => {
      const c = (s as any).color || SUBJ_COLORS[idx % SUBJ_COLORS.length]
      map.set(s.id, c)
    })
    return map
  }, [semSystems])

  // Compteurs par matière (pour les onglets)
  const countsBySystem = useMemo(() => {
    const counts = new Map<string, { total: number; due: number }>()
    semSystems.forEach(s => {
      const sysLessons = lessons.filter(l => l.system_id === s.id)
      const due = sysLessons.filter(l => getDueStepIndex(l, today) !== -1).length
      counts.set(s.id, { total: sysLessons.length, due })
    })
    return counts
  }, [semSystems, lessons, today])

  // Fiches visibles dans la grille selon l'onglet et filtre
  const visibleLessons = useMemo(() => {
    let pool: Lesson[]
    if (filter === 'due') {
      pool = lessonsToReview() // toutes matières du semestre
    } else {
      if (!selectedSystem) return []
      pool = lessons.filter(l => l.system_id === selectedSystem.id)
    }
    if (search) {
      const q = search.toLowerCase()
      pool = pool.filter(l => l.name.toLowerCase().includes(q))
    }
    if (filter !== 'all' && filter !== 'due') {
      pool = pool.filter(l => {
        const st = cardStatus(l)
        return st.cls === filter
      })
    }
    return pool
  }, [lessons, selectedSystem, filter, search, semSystems])

  const dueTodayCount = useMemo(
    () => lessonsToReview().length,
    [lessons, semSystems, today]
  )

  const totalSemFiches = useMemo(
    () => lessons.filter(l => semSystems.find(s => s.id === l.system_id)).length,
    [lessons, semSystems]
  )

  // Review session helpers
  const currentReviewLesson = reviewLessons?.[reviewIdx] ?? null
  const currentStepIdx = currentReviewLesson ? getDueStepIndex(currentReviewLesson, today) : -1
  const reviewSystemName = currentReviewLesson
    ? (systems.find(s => s.id === currentReviewLesson.system_id)?.name || '')
    : ''

  return (
    <>
      <div className="fi-main">

        {/* Header */}
        <div className="fi-topbar">
          <div>
            <h1 className="fi-h1">Mes matières</h1>
            <div className="fi-sub">
              Semestre {semester} · {semSystems.length} matière{semSystems.length > 1 ? 's' : ''} · {totalSemFiches} fiche{totalSemFiches > 1 ? 's' : ''}
            </div>
          </div>
          <div className="fi-actions">
            <input
              type="text"
              className="fi-search"
              placeholder="Rechercher une fiche…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="fi-btn-o" onClick={() => { setNewSysSemestre(semester); setShowNewSystem(true) }}>
              + Matière
            </button>
            <button className="fi-btn-g" onClick={() => {
              setNewLesSysId(selectedSystemId || (semSystems[0]?.id ?? ''))
              setNewLesDate(today)
              setShowNewLesson(true)
            }}>
              + Nouvelle fiche
            </button>
          </div>
        </div>

        {/* Matière tabs — horizontal, dot colorée */}
        {semSystems.length > 0 && (
          <div className="mtabs">
            {semSystems.map(sys => {
              const c = colorOfSystem.get(sys.id) || SUBJ_COLORS[0]
              const counts = countsBySystem.get(sys.id) || { total: 0, due: 0 }
              const active = filter !== 'due' && selectedSystemId === sys.id
              return (
                <button
                  key={sys.id}
                  className={`mtab${active ? ' active' : ''}`}
                  onClick={() => { setSelectedSystemId(sys.id); setFilter('all') }}
                >
                  <span className="mdot" style={{ background: c }} />
                  <span className="nm">{sys.name}</span>
                  <span className="ct">{counts.total}</span>
                  {counts.due > 0 && <span className="urg" />}
                </button>
              )
            })}

            {dueTodayCount > 0 && (
              <button
                className={`mtab-review${filter === 'due' ? ' active' : ''}`}
                onClick={() => setFilter('due')}
              >
                À réviser
                <span className="ct">{dueTodayCount}</span>
              </button>
            )}
          </div>
        )}

        {/* Empty state semestre vide */}
        {semSystems.length === 0 && (
          <div className="fi-empty">
            <h2 className="fi-empty-title">Aucune matière pour le semestre {semester}</h2>
            <p className="fi-empty-text">
              Commence par ajouter une matière, puis crée tes fiches dedans.
            </p>
            <button className="fi-btn-g" onClick={() => { setNewSysSemestre(semester); setShowNewSystem(true) }}>
              + Créer une matière
            </button>
          </div>
        )}

        {/* Filtres + stats */}
        {semSystems.length > 0 && (
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">Dernière note</span>
              <button className={`pill${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>Toutes</button>
              <button className={`pill${filter === 's1' ? ' active' : ''}`} onClick={() => setFilter('s1')}>
                <span className="dot" style={{ background: 'var(--s1)' }} />Rouge
              </button>
              <button className={`pill${filter === 's2' ? ' active' : ''}`} onClick={() => setFilter('s2')}>
                <span className="dot" style={{ background: 'var(--s2)' }} />Orange
              </button>
              <button className={`pill${filter === 's3' ? ' active' : ''}`} onClick={() => setFilter('s3')}>
                <span className="dot" style={{ background: 'var(--s3)' }} />Jaune
              </button>
              <button className={`pill${filter === 's4' ? ' active' : ''}`} onClick={() => setFilter('s4')}>
                <span className="dot" style={{ background: 'var(--s4)' }} />Vert clair
              </button>
              <button className={`pill${filter === 's5' ? ' active' : ''}`} onClick={() => setFilter('s5')}>
                <span className="dot" style={{ background: 'var(--s5)' }} />Vert foncé
              </button>
              <button className={`pill${filter === 'new' ? ' active' : ''}`} onClick={() => setFilter('new')}>
                <span className="ring" />Non commencées
              </button>
            </div>
            <div className="filter-stats">
              <strong>{visibleLessons.length}</strong> fiche{visibleLessons.length > 1 ? 's' : ''}
              {filter !== 'due' && dueTodayCount > 0 && (
                <> · <strong>{dueTodayCount}</strong> à réviser aujourd'hui</>
              )}
            </div>
          </div>
        )}

        {/* Grille de cartes */}
        {semSystems.length > 0 && (
          <div className="fi-grid">
            {visibleLessons.map(lesson => {
              const st = cardStatus(lesson)
              const nr = nextRevLabel(lesson, today)
              const isDue = getDueStepIndex(lesson, today) !== -1
              return (
                <div key={lesson.id} className={`card st-${st.cls}`}>
                  <div className="card-accent" />
                  <div className="card-body">
                    <div className="card-head">
                      <div className="card-name">{lesson.name}</div>
                      <span className={`card-status ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="stamps">
                      {J.map((_, i) => {
                        const s = getStampState(lesson, i, today)
                        if (s.kind === 'score') return <span key={i} className={`stamp s${s.score}`} title={`J+${J[i]} · note ${s.score}/5`} />
                        if (s.kind === 'today') return <span key={i} className="stamp today" title={`J+${J[i]} · aujourd'hui`} />
                        if (s.kind === 'missed') return <span key={i} className="stamp missed" title={`J+${J[i]} · manqué`} />
                        return <span key={i} className="stamp future" title={`J+${J[i]} · à venir`} />
                      })}
                    </div>
                    <div className="card-foot">
                      <span className="next-text" dangerouslySetInnerHTML={{ __html: nr.html }} />
                      <button
                        className={`cta ${nr.urgent ? 'urgent' : nr.start ? 'start' : 'calm'}`}
                        disabled={!isDue && !nr.start}
                        onClick={() => {
                          if (isDue) openReview([lesson], lesson.name)
                          // "Démarrer" (nr.start) pourra ouvrir un futur formulaire d'édition
                        }}
                        style={!isDue && !nr.start ? { opacity: .55, cursor: 'default' } : undefined}
                      >
                        {nr.urgent ? 'Réviser' : nr.start ? 'Démarrer' : 'Voir'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state filtre vide */}
        {semSystems.length > 0 && visibleLessons.length === 0 && (
          <div className="fi-empty">
            <p className="fi-empty-text">
              {filter === 'due'
                ? "Aucune fiche à réviser aujourd'hui dans ce semestre — bravo !"
                : search
                  ? "Aucune fiche ne correspond à ta recherche."
                  : "Aucune fiche pour ce filtre."}
            </p>
            {filter !== 'due' && !search && selectedSystem && (
              <button className="fi-btn-g" onClick={() => {
                setNewLesSysId(selectedSystem.id); setNewLesDate(today); setShowNewLesson(true)
              }}>
                + Créer une fiche
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---- REVIEW SESSION OVERLAY ---- */}
      {reviewLessons && (
        <div className="fi-overlay" onClick={() => setReviewLessons(null)}>
          <div className="rev-card" onClick={e => e.stopPropagation()}>

            <div className="rev-header">
              <div>
                <div className="rev-kicker">Session de révision</div>
                <div className="rev-title">{reviewTitle}</div>
              </div>
              <button className="rev-close" onClick={() => setReviewLessons(null)}>×</button>
            </div>

            {reviewLessons.length === 0 && (
              <div className="rev-empty">
                <p className="rev-empty-title">Tout est à jour !</p>
                <p className="rev-empty-text">Aucune fiche à réviser ici aujourd'hui.</p>
                <button className="fi-btn-g" onClick={() => setReviewLessons(null)}>Fermer</button>
              </div>
            )}

            {reviewLessons.length > 0 && reviewDone && (
              <div className="rev-results">
                <p className="rev-done-title">Session terminée !</p>
                <div className="rev-done-grid">
                  {[1, 2, 3, 4, 5].map(n => {
                    const c = reviewResults.filter(r => r.score === n).length
                    return (
                      <div key={n} className="rev-done-cell">
                        <span className={`rev-done-dot s${n}`} />
                        <span className="rev-done-num">{c}</span>
                      </div>
                    )
                  })}
                </div>
                <button className="fi-btn-g" style={{ width: '100%' }} onClick={() => setReviewLessons(null)}>Fermer</button>
              </div>
            )}

            {reviewLessons.length > 0 && !reviewDone && currentReviewLesson && (
              <>
                <div className="rev-progress">
                  <div
                    className="rev-progress-bar"
                    style={{ width: `${(reviewIdx / reviewLessons.length) * 100}%` }}
                  />
                </div>
                <div className="rev-step">
                  {reviewIdx + 1} / {reviewLessons.length} · J+{J[currentStepIdx]}
                </div>

                <div className="rev-lesson">
                  <div className="rev-lesson-kicker">Révision J+{J[currentStepIdx]}</div>
                  <div className="rev-lesson-name">{currentReviewLesson.name}</div>
                  <div className="rev-lesson-meta">
                    {reviewSystemName} · appris le {currentReviewLesson.learn_date
                      ? new Date(currentReviewLesson.learn_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                      : '—'}
                  </div>
                </div>

                <div className="rev-ask">Quelle note ?</div>
                <div className="rev-scores">
                  {([1, 2, 3, 4, 5] as Score[]).map(n => (
                    <button
                      key={n}
                      className={`rev-score s${n}`}
                      onClick={() => rateLesson(n)}
                      disabled={reviewLoading}
                    >
                      <span className="num">{n}</span>
                      <span className="lbl">
                        {n === 1 ? 'À revoir' : n === 2 ? 'Faible' : n === 3 ? 'Moyen' : n === 4 ? 'Bien' : 'Maîtrisé'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- MODAL : Nouvelle matière ---- */}
      {showNewSystem && (
        <div className="fi-overlay" onClick={() => setShowNewSystem(false)}>
          <div className="fi-modal" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">Nouvelle matière</div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Nom de la matière</label>
              <input className="fi-input" type="text" placeholder="ex : Biochimie, Anatomie…" value={newSysName}
                onChange={e => setNewSysName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && createSystem()} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Couleur</label>
              <div className="fi-color-grid">
                {SUBJ_COLORS.map(c => (
                  <button
                    key={c}
                    className={`fi-color-btn${newSysColor === c ? ' sel' : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewSysColor(c)}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 4 }}>
              <label className="fi-label">Semestre</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([1, 2] as (1 | 2)[]).map(s => (
                  <button key={s} onClick={() => setNewSysSemestre(s)} style={{
                    flex: 1, padding: '9px', borderRadius: 8,
                    border: `1.5px solid ${newSysSemestre === s ? '#2D6A4F' : 'var(--border)'}`,
                    background: newSysSemestre === s ? '#D8EAE0' : 'white',
                    color: newSysSemestre === s ? '#1B4332' : 'var(--gray)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}>
                    Semestre {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setShowNewSystem(false)}>Annuler</button>
              <button className="fi-btn-g" onClick={createSystem} disabled={!newSysName.trim() || sysLoading}
                style={{ opacity: !newSysName.trim() ? .5 : 1 }}>
                {sysLoading ? 'Création…' : 'Créer la matière'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- MODAL : Nouvelle fiche ---- */}
      {showNewLesson && (
        <div className="fi-overlay" onClick={() => setShowNewLesson(false)}>
          <div className="fi-modal" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">Nouvelle fiche</div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Intitulé de la fiche</label>
              <input className="fi-input" type="text" placeholder="ex : Glycolyse — étapes et régulation" value={newLesName}
                onChange={e => setNewLesName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && createLesson()} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Matière</label>
              <select className="fi-select" value={newLesSysId} onChange={e => setNewLesSysId(e.target.value)}>
                {systems.map(sys => <option key={sys.id} value={sys.id}>
                  {sys.name} · S{(sys as any).semestre}
                </option>)}
              </select>
            </div>
            <div style={{ marginBottom: 4 }}>
              <label className="fi-label">Date d&apos;apprentissage (J0)</label>
              <input className="fi-input" type="date" value={newLesDate} onChange={e => setNewLesDate(e.target.value)} />
              <p style={{ fontSize: 11, color: 'var(--gray)', marginTop: 5 }}>
                MedRev planifiera les révisions J+1, J+3, J+5… à partir de cette date.
              </p>
            </div>
            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setShowNewLesson(false)}>Annuler</button>
              <button className="fi-btn-g" onClick={createLesson} disabled={!newLesName.trim() || !newLesSysId || lesLoading}
                style={{ opacity: (!newLesName.trim() || !newLesSysId) ? .5 : 1 }}>
                {lesLoading ? 'Création…' : 'Créer la fiche'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
