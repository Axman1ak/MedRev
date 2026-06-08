'use client'
// src/app/dashboard/fiches/page.tsx

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import ReviewModal from '@/components/ReviewModal'
import SubjectIcon from '@/components/SubjectIcon'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

// Palette de couleurs pour les matières
const SUBJ_COLORS = [
  '#C75050', '#5B8ED4', '#8D6BB0', '#A06840',
  '#C47B2B', '#3A8F8A', '#7AA56B', '#D9B24A',
]

type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null

// stepScore : score OFFICIEL uniquement. Utilisé pour la logique de calendrier
// (due, done, next undone) — un temp_score ne rend pas un J "fait".
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

// effectiveStepScore : officiel sinon temp_score. Utilisé pour les agrégations
// affichées (last score) — un retravailler en avance compte comme score posé.
function effectiveStepScore(s: StepEntry): Score | null {
  const off = stepScore(s)
  if (off) return off
  if (!s) return null
  const t = (s as any).temp_score
  if (typeof t === 'number' && t >= 1 && t <= 5) return t as Score
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
  | { kind: 'temp'; score: Score }      // score temporaire (retravailler), à remplacer au vrai J
  | { kind: 'today' }
  | { kind: 'missed' }
  | { kind: 'future' }

// Lit le temp_score d'un step si présent et valide (1-5)
function stepTempScore(s: StepEntry | null): Score | null {
  if (!s) return null
  const t = (s as { temp_score?: number }).temp_score
  if (typeof t === 'number' && t >= 1 && t <= 5) return t as Score
  return null
}

function getStampState(lesson: Lesson, i: number, today: string): StampState {
  const steps = (lesson.steps as StepEntry[]) || []
  const sc = stepScore(steps[i])
  if (sc) return { kind: 'score', score: sc }
  // Score officiel absent : on regarde si un retravailler en avance a posé un temp_score.
  const tempSc = stepTempScore(steps[i])
  if (tempSc) return { kind: 'temp', score: tempSc }
  if (!lesson.learn_date) return { kind: 'future' }
  const ds = stepDate(lesson, i)
  if (ds === today) return { kind: 'today' }
  if (ds < today) return { kind: 'missed' }
  return { kind: 'future' }
}

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

function getLastScore(lesson: Lesson): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = J.length - 1; i >= 0; i--) {
    const sc = effectiveStepScore(steps[i])
    if (sc) return sc
  }
  return null
}

function getDoneCount(lesson: Lesson): number {
  const steps = (lesson.steps as StepEntry[]) || []
  let n = 0
  for (let i = 0; i < J.length; i++) if (stepScore(steps[i])) n++
  return n
}

type ProgressKind = 'new' | 'inprogress' | 'done'
function progressKind(lesson: Lesson): ProgressKind {
  const n = getDoneCount(lesson)
  if (n === 0) return 'new'
  if (n >= J.length) return 'done'
  return 'inprogress'
}

function getNextRevDate(lesson: Lesson): string | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (!stepScore(steps[i])) return stepDate(lesson, i)
  }
  return null
}

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

function cardStatus(lesson: Lesson): { cls: string; label: string } {
  const last = getLastScore(lesson)
  if (last === null) return { cls: 'new', label: 'Nouvelle' }
  if (last === 1) return { cls: 's1', label: 'À revoir' }
  if (last === 2) return { cls: 's2', label: 'Faible' }
  if (last === 3) return { cls: 's3', label: 'Moyen' }
  if (last === 4) return { cls: 's4', label: 'Bien' }
  return { cls: 's5', label: 'Maîtrisée' }
}

type FilterNote = 'all' | 's1' | 's2' | 's3' | 's4' | 's5'
type FilterProgress = 'all' | 'new' | 'inprogress' | 'done'

export default function FichesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const [filterNote, setFilterNote] = useState<FilterNote>('all')
  const [filterProgress, setFilterProgress] = useState<FilterProgress>('all')
  const [showDueOnly, setShowDueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [semester, setSemester] = useState<1 | 2 | 'year'>(2)

  // Create modals
  const [showNewSystem, setShowNewSystem] = useState(false)
  const [showNewLesson, setShowNewLesson] = useState(false)

  // New system form
  const [newSysName, setNewSysName] = useState('')
  const [newSysSemestre, setNewSysSemestre] = useState<1 | 2>(2)
  const [newSysColor, setNewSysColor] = useState(SUBJ_COLORS[0])
  const [sysLoading, setSysLoading] = useState(false)
  const [sysError, setSysError] = useState<string | null>(null)

  // New lesson form
  const [newLesName, setNewLesName] = useState('')
  const [newLesDate, setNewLesDate] = useState('')
  const [newLesSysId, setNewLesSysId] = useState('')
  const [lesLoading, setLesLoading] = useState(false)
  const [lesError, setLesError] = useState<string | null>(null)

  // Review session : on délègue tout au composant partagé ReviewModal.
  // On ne garde que la fiche en cours (null = modal fermé).
  const [reviewLesson, setReviewLesson] = useState<Lesson | null>(null)

  // Menu contextuel (⋯) + éditer / supprimer
  type EditTarget = { type: 'system' | 'lesson'; id: string; name: string; semestre?: 1 | 2 } | null
  type DeleteTarget = { type: 'system' | 'lesson'; id: string; name: string; childCount?: number } | null
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditTarget>(null)
  const [editName, setEditName] = useState('')
  // Semestre en cours d'édition (uniquement utilisé quand type === 'system').
  // Permet à l'user de déplacer une matière entre S1 et S2 si la pré-config
  // au signup ne correspond pas à son vrai cursus.
  const [editSemestre, setEditSemestre] = useState<1 | 2>(2)
  const [editLoading, setEditLoading] = useState(false)
  const [deleting, setDeleting] = useState<DeleteTarget>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemester(raw === '1' ? 1 : raw === 'year' ? 'year' : 2)
    const onSem = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail === 1 || detail === 2 || detail === 'year') setSemester(detail)
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

  // En mode 'year' : tous les systèmes ; sinon filtre par semestre
  const semSystems = useMemo(
    () => semester === 'year'
      ? systems
      : systems.filter(s => (s as any).semestre === semester),
    [systems, semester]
  )

  useEffect(() => {
    if (semSystems.length === 0) { setSelectedSystemId(null); return }
    if (!selectedSystemId || !semSystems.find(s => s.id === selectedSystemId)) {
      setSelectedSystemId(semSystems[0].id)
    }
  }, [semSystems, selectedSystemId])

  // Ferme le menu contextuel (⋯) quand on clique ailleurs
  useEffect(() => {
    if (!menuOpenFor) return
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('.fi-menu') && !target.closest('.fi-menu-btn')) {
        setMenuOpenFor(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpenFor])

  // ---- Create functions ----
  async function createSystem() {
    if (!userId || !newSysName.trim()) return
    setSysLoading(true)
    setSysError(null)
    const payload: any = {
      user_id: userId,
      name: newSysName.trim(),
      semestre: newSysSemestre,
      color: newSysColor,
      icon: '',
    }
    const { data, error } = await supabase.from('systems').insert(payload).select().single()
    setSysLoading(false)
    if (error || !data) {
      // On garde le form ouvert et on affiche l'erreur pour diagnostiquer.
      console.error('[createSystem] Erreur Supabase:', error, 'data:', data)
      setSysError(error?.message || 'La création a échoué (data null). Vérifie les RLS Supabase.')
      return
    }
    setSystems(prev => [...prev, data as System])
    if (semester === 'year' || (data as any).semestre === semester) setSelectedSystemId(data.id)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medrev-system-created'))
    }
    // Reset du form : succès uniquement
    setShowNewSystem(false); setNewSysName(''); setNewSysColor(SUBJ_COLORS[0])
    setNewSysSemestre(semester === 'year' ? 2 : semester)
  }

  async function createLesson() {
    if (!userId || !newLesName.trim() || !newLesSysId) return
    setLesLoading(true)
    setLesError(null)
    const { data, error } = await supabase.from('lessons').insert({
      user_id: userId, system_id: newLesSysId, name: newLesName.trim(),
      learn_date: newLesDate || today, steps: new Array(J.length).fill(null), ai_questions: [],
    }).select().single()
    setLesLoading(false)
    if (error || !data) {
      console.error('[createLesson] Erreur Supabase:', error, 'data:', data)
      setLesError(error?.message || 'La création a échoué (data null). Vérifie les RLS Supabase.')
      return
    }
    setLessons(prev => [...prev, data as Lesson])
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medrev-lesson-created'))
    }
    setShowNewLesson(false); setNewLesName(''); setNewLesDate('')
  }

  // ---- Review session : ouverture / mise à jour / fermeture ----
  function openReview(lesson: Lesson) {
    setReviewLesson(lesson)
  }

  function closeReview() {
    setReviewLesson(null)
  }

  // Callback du ReviewModal partagé : on met à jour à la fois la lesson
  // affichée dans la grille ET la lesson active dans le modal (pour que les
  // tampons J se rafraîchissent en direct).
  const handleReviewUpdated = useCallback((updated: Lesson) => {
    setLessons(prev => prev.map(l => l.id === updated.id ? updated : l))
    setReviewLesson(prev => (prev && prev.id === updated.id ? updated : prev))
  }, [])

  // ---- Menu ⋯ : éditer / supprimer matière ou fiche ----
  function openEdit(type: 'system' | 'lesson', id: string, name: string) {
    // Pour une matière, on charge aussi son semestre actuel pour pouvoir
    // l'éditer dans le même modal. Pour une fiche, semestre n'est pas
    // utilisé (la fiche hérite du semestre de sa matière).
    let currentSemestre: 1 | 2 = 2
    if (type === 'system') {
      const sys = systems.find(s => s.id === id)
      if (sys) currentSemestre = (sys.semestre === 1 ? 1 : 2)
    }
    setEditing({ type, id, name, semestre: currentSemestre })
    setEditName(name)
    setEditSemestre(currentSemestre)
    setMenuOpenFor(null)
  }
  function openDelete(type: 'system' | 'lesson', id: string, name: string) {
    let childCount: number | undefined
    if (type === 'system') {
      childCount = lessons.filter(l => l.system_id === id).length
    }
    setDeleting({ type, id, name, childCount })
    setMenuOpenFor(null)
  }
  async function saveEdit() {
    if (!editing) return
    const trimmed = editName.trim()
    if (!trimmed) return
    setEditLoading(true)
    if (editing.type === 'system') {
      // Pour une matière, on met à jour name ET semestre dans la même requête.
      const { error } = await supabase
        .from('systems')
        .update({ name: trimmed, semestre: editSemestre })
        .eq('id', editing.id)
      if (!error) {
        setSystems(prev => prev.map(s => s.id === editing.id
          ? ({ ...s, name: trimmed, semestre: editSemestre } as System)
          : s))
      } else {
        console.error('[saveEdit] system update failed:', error)
      }
    } else {
      const { error } = await supabase.from('lessons').update({ name: trimmed }).eq('id', editing.id)
      if (!error) {
        setLessons(prev => prev.map(l => l.id === editing.id ? ({ ...l, name: trimmed } as Lesson) : l))
      } else {
        console.error('[saveEdit] lesson update failed:', error)
      }
    }
    setEditLoading(false)
    setEditing(null)
  }
  async function confirmDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    // On check les erreurs Supabase pour ne pas retirer du state local
    // ce qui n'a pas été effectivement supprimé en DB (cas RLS bloque ou
    // réseau down : l'UI montrait la fiche disparue mais elle réapparaissait
    // au refresh).
    try {
      if (deleting.type === 'system') {
        const sysLessons = lessons.filter(l => l.system_id === deleting.id)
        const lessonIds = sysLessons.map(l => l.id)
        if (lessonIds.length > 0) {
          const { error: vcErr } = await supabase.from('voyage_checks').delete().in('lesson_id', lessonIds)
          if (vcErr) throw vcErr
          const { error: lessErr } = await supabase.from('lessons').delete().eq('system_id', deleting.id)
          if (lessErr) throw lessErr
        }
        const { error: sysErr } = await supabase.from('systems').delete().eq('id', deleting.id)
        if (sysErr) throw sysErr
        setLessons(prev => prev.filter(l => l.system_id !== deleting.id))
        setSystems(prev => prev.filter(s => s.id !== deleting.id))
      } else {
        const { error: vcErr } = await supabase.from('voyage_checks').delete().eq('lesson_id', deleting.id)
        if (vcErr) throw vcErr
        const { error: lessErr } = await supabase.from('lessons').delete().eq('id', deleting.id)
        if (lessErr) throw lessErr
        setLessons(prev => prev.filter(l => l.id !== deleting.id))
      }
      setDeleting(null)
    } catch (e) {
      console.error('[confirmDelete] erreur Supabase :', e)
      // On laisse le modal ouvert pour que l'user voie qu'il s'est passé qqch.
      alert(`Suppression impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}. Réessaie ou recharge la page.`)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ---- Dérivées ----
  const selectedSystem = semSystems.find(s => s.id === selectedSystemId) ?? null

  const colorOfSystem = useMemo(() => {
    const map = new Map<string, string>()
    // Détecte si toutes les matières ont la même couleur en base
    // (signe que le picker n'a jamais été utilisé consciemment — la default est
    // SUBJ_COLORS[0] rouge, donc à la création toutes les matières héritent du
    // rouge sauf si l'utilisateur clique explicitement sur une autre couleur).
    // Dans ce cas on bascule sur la palette par index pour avoir des couleurs
    // distinctes visuelles.
    const distinctColors = new Set(
      semSystems.map(s => (s as any).color).filter(Boolean)
    )
    const allSameColor = distinctColors.size <= 1 && semSystems.length > 1

    semSystems.forEach((s, idx) => {
      const c = allSameColor
        ? SUBJ_COLORS[idx % SUBJ_COLORS.length]
        : ((s as any).color || SUBJ_COLORS[idx % SUBJ_COLORS.length])
      map.set(s.id, c)
    })
    return map
  }, [semSystems])

  const countsBySystem = useMemo(() => {
    const counts = new Map<string, { total: number; due: number }>()
    semSystems.forEach(s => {
      const sysLessons = lessons.filter(l => l.system_id === s.id)
      const due = sysLessons.filter(l => getDueStepIndex(l, today) !== -1).length
      counts.set(s.id, { total: sysLessons.length, due })
    })
    return counts
  }, [semSystems, lessons, today])

  const visibleLessons = useMemo(() => {
    let pool: Lesson[]
    if (showDueOnly) {
      pool = lessons.filter(l => semSystems.find(s => s.id === l.system_id))
      pool = pool.filter(l => getDueStepIndex(l, today) !== -1)
    } else {
      if (!selectedSystem) return []
      pool = lessons.filter(l => l.system_id === selectedSystem.id)
    }
    if (search) {
      const q = search.toLowerCase()
      pool = pool.filter(l => l.name.toLowerCase().includes(q))
    }
    if (filterNote !== 'all') {
      pool = pool.filter(l => cardStatus(l).cls === filterNote)
    }
    if (filterProgress !== 'all') {
      pool = pool.filter(l => progressKind(l) === filterProgress)
    }
    return pool
  }, [lessons, selectedSystem, filterNote, filterProgress, showDueOnly, search, semSystems, today])

  const dueTodayCount = useMemo(
    () => lessons.filter(l => semSystems.find(s => s.id === l.system_id) && getDueStepIndex(l, today) !== -1).length,
    [lessons, semSystems, today]
  )

  const totalSemFiches = useMemo(
    () => lessons.filter(l => semSystems.find(s => s.id === l.system_id)).length,
    [lessons, semSystems]
  )

  const reviewSystemName = reviewLesson
    ? (systems.find(s => s.id === reviewLesson.system_id)?.name || '')
    : ''

  return (
    <>
      <div className="fi-main">

        {/* Header */}
        <div className="fi-topbar">
          <div>
            <h1 className="fi-h1">Mes matières</h1>
            <div className="fi-sub">
              {semester === 'year' ? 'Année complète' : `Semestre ${semester}`} · {semSystems.length} matière{semSystems.length > 1 ? 's' : ''} · {totalSemFiches} fiche{totalSemFiches > 1 ? 's' : ''}
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
            <button
              data-tour="add-system"
              className="fi-btn-o"
              onClick={() => { setNewSysSemestre(semester === 'year' ? 2 : semester); setShowNewSystem(true) }}
            >
              + Ajouter une matière
            </button>
            <button
              data-tour="add-lesson"
              className="fi-btn-g"
              onClick={() => {
                setNewLesSysId(selectedSystemId || (semSystems[0]?.id ?? ''))
                setNewLesDate(today)
                setShowNewLesson(true)
              }}
            >
              + Ajouter une fiche
            </button>
          </div>
        </div>

        {/* Matière tabs */}
        {semSystems.length > 0 && (
          <div className="mtabs">
            {semSystems.map(sys => {
              const c = colorOfSystem.get(sys.id) || SUBJ_COLORS[0]
              const counts = countsBySystem.get(sys.id) || { total: 0, due: 0 }
              const active = !showDueOnly && selectedSystemId === sys.id
              const menuKey = `sys-${sys.id}`
              return (
                <div
                  key={sys.id}
                  className={`mtab${active ? ' active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setSelectedSystemId(sys.id); setShowDueOnly(false) }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setSelectedSystemId(sys.id); setShowDueOnly(false) } }}
                  style={{ position: 'relative' }}
                >
                  <span className="micon" style={active ? undefined : { color: c }}>
                    <SubjectIcon name={sys.name} />
                  </span>
                  <span className="nm">{sys.name}</span>
                  <span className="ct">{counts.total}</span>
                  {counts.due > 0 && <span className="urg" />}
                  <button
                    type="button"
                    className="fi-menu-btn"
                    onClick={e => {
                      e.stopPropagation()
                      setMenuOpenFor(menuOpenFor === menuKey ? null : menuKey)
                    }}
                    aria-label="Options de la matière"
                  >{'⋯'}</button>
                  {menuOpenFor === menuKey && (
                    <div className="fi-menu" onClick={e => e.stopPropagation()}>
                      <button type="button" className="fi-menu-item" onClick={() => openEdit('system', sys.id, sys.name)}>
                        Renommer
                      </button>
                      <button type="button" className="fi-menu-item fi-menu-item-danger" onClick={() => openDelete('system', sys.id, sys.name)}>
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {dueTodayCount > 0 && (
              <button
                className={`mtab-review${showDueOnly ? ' active' : ''}`}
                onClick={() => setShowDueOnly(v => !v)}
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
            <h2 className="fi-empty-title">Aucune matière {semester === 'year' ? 'pour cette année' : `pour le semestre ${semester}`}</h2>
            <p className="fi-empty-text">Commence par ajouter une matière, puis crée tes fiches dedans.</p>
            <button className="fi-btn-g" onClick={() => { setNewSysSemestre(semester === 'year' ? 2 : semester); setShowNewSystem(true) }}>
              + Créer une matière
            </button>
          </div>
        )}

        {/* Filtres dropdowns + stats */}
        {semSystems.length > 0 && (
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-block">
                <span className="filter-label">Dernière note</span>
                <div className="filter-select-wrap">
                  <span className={`filter-select-dot ${filterNote === 'all' ? 'empty' : filterNote}`} />
                  <select
                    className="filter-select"
                    value={filterNote}
                    onChange={e => setFilterNote(e.target.value as FilterNote)}
                  >
                    <option value="all">Toutes</option>
                    <option value="s1">Rouge · à revoir</option>
                    <option value="s2">Orange · faible</option>
                    <option value="s3">Jaune · moyen</option>
                    <option value="s4">Vert clair · bien</option>
                    <option value="s5">Vert foncé · maîtrisée</option>
                  </select>
                </div>
              </label>

              <label className="filter-block">
                <span className="filter-label">Progression</span>
                <div className="filter-select-wrap">
                  <span className={`filter-select-glyph ${filterProgress}`} />
                  <select
                    className="filter-select"
                    value={filterProgress}
                    onChange={e => setFilterProgress(e.target.value as FilterProgress)}
                  >
                    <option value="all">Toutes</option>
                    <option value="new">Non commencées</option>
                    <option value="inprogress">En cours</option>
                    <option value="done">Terminées</option>
                  </select>
                </div>
              </label>

              {(filterNote !== 'all' || filterProgress !== 'all') && (
                <button
                  className="filter-reset"
                  onClick={() => { setFilterNote('all'); setFilterProgress('all') }}
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <div className="filter-stats">
              <strong>{visibleLessons.length}</strong> fiche{visibleLessons.length > 1 ? 's' : ''}
              {!showDueOnly && dueTodayCount > 0 && (
                <> · <strong>{dueTodayCount}</strong> à réviser aujourd'hui</>
              )}
            </div>
          </div>
        )}

        {/* Grille de cartes */}
        {semSystems.length > 0 && visibleLessons.length > 0 && (
          <div className="fi-grid">
            {visibleLessons.map(lesson => {
              const st = cardStatus(lesson)
              const nr = nextRevLabel(lesson, today)
              return (
                <div
                  key={lesson.id}
                  data-tour="lesson-card"
                  className={`card st-${st.cls} clickable`}
                  onClick={() => openReview(lesson)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openReview(lesson) }}
                  style={{ position: 'relative' }}
                >
                  <div className="card-accent" />
                  <div className="card-body">
                    <div className="card-head">
                      <div className="card-name">{lesson.name}</div>
                      <span className={`card-status ${st.cls}`}>{st.label}</span>
                    </div>
                    <button
                      type="button"
                      className="fi-menu-btn fi-menu-btn-card"
                      onClick={e => {
                        e.stopPropagation()
                        setMenuOpenFor(menuOpenFor === `les-${lesson.id}` ? null : `les-${lesson.id}`)
                      }}
                      aria-label="Options de la fiche"
                    >{'⋯'}</button>
                    {menuOpenFor === `les-${lesson.id}` && (
                      <div className="fi-menu" onClick={e => e.stopPropagation()}>
                        <button type="button" className="fi-menu-item" onClick={() => openEdit('lesson', lesson.id, lesson.name)}>
                          Renommer
                        </button>
                        <button type="button" className="fi-menu-item fi-menu-item-danger" onClick={() => openDelete('lesson', lesson.id, lesson.name)}>
                          Supprimer
                        </button>
                      </div>
                    )}
                    <div className="stamps">
                      {J.map((_, i) => {
                        const s = getStampState(lesson, i, today)
                        if (s.kind === 'score') {
                          return (
                            <span key={i} className={`stamp s${s.score}`} title={`J+${J[i]} · note ${s.score}/5`}>
                              {s.score === 5 && <span className="stamp-star" aria-hidden="true">★</span>}
                            </span>
                          )
                        }
                        if (s.kind === 'temp') {
                          return (
                            <span key={i} className={`stamp temp s${s.score}`} title={`J+${J[i]} · retravaillé en avance · note ${s.score}/5 (temporaire jusqu'au vrai J)`}>
                              {s.score}
                            </span>
                          )
                        }
                        if (s.kind === 'today') return <span key={i} className="stamp today" title={`J+${J[i]} · aujourd'hui`} />
                        if (s.kind === 'missed') return <span key={i} className="stamp missed" title={`J+${J[i]} · manqué`} />
                        return <span key={i} className="stamp future" title={`J+${J[i]} · à venir`} />
                      })}
                    </div>
                    <div className="card-foot">
                      <span className="next-text" dangerouslySetInnerHTML={{ __html: nr.html }} />
                      <span className={`cta ${nr.urgent ? 'urgent' : nr.start ? 'start' : 'calm'}`}>
                        {nr.urgent ? 'Réviser' : nr.start ? 'Démarrer' : 'Voir'}
                      </span>
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
              {showDueOnly
                ? `Aucune fiche à réviser aujourd'hui ${semester === 'year' ? 'cette année' : 'dans ce semestre'}. Bravo !`
                : search
                  ? "Aucune fiche ne correspond à ta recherche."
                  : (filterNote !== 'all' || filterProgress !== 'all')
                    ? "Aucune fiche pour ces filtres."
                    : "Aucune fiche dans cette matière."}
            </p>
            {!showDueOnly && !search && filterNote === 'all' && filterProgress === 'all' && selectedSystem && (
              <button className="fi-btn-g" onClick={() => {
                setNewLesSysId(selectedSystem.id); setNewLesDate(today); setShowNewLesson(true)
              }}>
                + Créer une fiche
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---- REVIEW SESSION (composant partagé) ---- */}
      {reviewLesson && (
        <ReviewModal
          lesson={reviewLesson}
          systemName={reviewSystemName}
          initialStepIdx={null}
          onClose={closeReview}
          onUpdated={handleReviewUpdated}
        />
      )}

      {/* ---- MODAL : Nouvelle matière ---- */}
      {showNewSystem && (
        <div className="fi-overlay" onClick={() => setShowNewSystem(false)}>
          <div className="fi-modal" data-tour="matiere-form" onClick={e => e.stopPropagation()}>
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
                    border: `1.5px solid ${newSysSemestre === s ? 'var(--accent-medium)' : 'var(--border)'}`,
                    background: newSysSemestre === s ? 'var(--accent-soft)' : 'var(--card)',
                    color: newSysSemestre === s ? 'var(--accent-on-soft)' : 'var(--gray)',
                    fontFamily: "var(--font-hanken), sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}>
                    Semestre {s}
                  </button>
                ))}
              </div>
            </div>
            {sysError && (
              <div style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                padding: '8px 10px',
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 13,
                lineHeight: 1.4,
              }}>
                <strong>Erreur :</strong> {sysError}
              </div>
            )}
            <div className="fi-modal-actions">
              <button data-tour="matiere-cancel" className="fi-btn-o" onClick={() => { setSysError(null); setShowNewSystem(false) }}>Annuler</button>
              <button data-tour="matiere-create" className="fi-btn-g" onClick={createSystem} disabled={!newSysName.trim() || sysLoading}
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
          <div className="fi-modal" data-tour="fiche-form" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">Nouvelle fiche</div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Intitulé de la fiche</label>
              <input className="fi-input" type="text" placeholder="ex : Glycolyse, étapes et régulation" value={newLesName}
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
            {lesError && (
              <div style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                padding: '8px 10px',
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 13,
                lineHeight: 1.4,
              }}>
                <strong>Erreur :</strong> {lesError}
              </div>
            )}
            <div className="fi-modal-actions">
              <button data-tour="fiche-cancel" className="fi-btn-o" onClick={() => { setLesError(null); setShowNewLesson(false) }}>Annuler</button>
              <button data-tour="fiche-create" className="fi-btn-g" onClick={createLesson} disabled={!newLesName.trim() || !newLesSysId || lesLoading}
                style={{ opacity: (!newLesName.trim() || !newLesSysId) ? .5 : 1 }}>
                {lesLoading ? 'Création…' : 'Créer la fiche'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- MODAL : Éditer matière (nom + semestre) ou Renommer fiche ---- */}
      {editing && (
        <div className="fi-overlay" onClick={() => setEditing(null)}>
          <div className="fi-modal" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">
              {editing.type === 'system' ? 'Modifier la matière' : 'Renommer la fiche'}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="fi-label">{editing.type === 'system' ? 'Nom de la matière' : 'Nouveau nom'}</label>
              <input
                className="fi-input"
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && editName.trim()) saveEdit() }}
              />
            </div>
            {/* Picker S1/S2 : visible uniquement pour les matières. Permet de
                corriger la pré-config du signup si l'user a une matière dans
                le mauvais semestre selon sa fac. */}
            {editing.type === 'system' && (
              <div style={{ marginBottom: 4 }}>
                <label className="fi-label">Semestre</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className={`fi-btn-o${editSemestre === 1 ? ' fi-btn-active' : ''}`}
                    onClick={() => setEditSemestre(1)}
                    style={{
                      flex: 1,
                      background: editSemestre === 1 ? 'var(--gm)' : 'transparent',
                      color: editSemestre === 1 ? '#fff' : 'inherit',
                      borderColor: editSemestre === 1 ? 'var(--gm)' : undefined,
                    }}
                  >
                    Semestre 1
                  </button>
                  <button
                    type="button"
                    className={`fi-btn-o${editSemestre === 2 ? ' fi-btn-active' : ''}`}
                    onClick={() => setEditSemestre(2)}
                    style={{
                      flex: 1,
                      background: editSemestre === 2 ? 'var(--gm)' : 'transparent',
                      color: editSemestre === 2 ? '#fff' : 'inherit',
                      borderColor: editSemestre === 2 ? 'var(--gm)' : undefined,
                    }}
                  >
                    Semestre 2
                  </button>
                </div>
              </div>
            )}
            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setEditing(null)}>Annuler</button>
              <button
                className="fi-btn-g"
                onClick={saveEdit}
                disabled={
                  !editName.trim()
                  || editLoading
                  || (editing.type === 'system'
                    ? editName.trim() === editing.name && editSemestre === editing.semestre
                    : editName.trim() === editing.name)
                }
                style={{
                  opacity: (!editName.trim()
                    || (editing.type === 'system'
                      ? editName.trim() === editing.name && editSemestre === editing.semestre
                      : editName.trim() === editing.name)) ? .5 : 1,
                }}
              >
                {editLoading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- MODAL : Confirmation de suppression ---- */}
      {deleting && (
        <div className="fi-overlay" onClick={() => setDeleting(null)}>
          <div className="fi-modal" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">
              Supprimer {deleting.type === 'system' ? 'cette matière' : 'cette fiche'} ?
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray)', lineHeight: 1.5, marginBottom: 14 }}>
              <strong style={{ color: 'var(--dark)' }}>{deleting.name}</strong>
              {deleting.type === 'system' && deleting.childCount !== undefined && deleting.childCount > 0 && (
                <> · {deleting.childCount} fiche{deleting.childCount > 1 ? 's' : ''} et leurs révisions seront aussi supprimées.</>
              )}
              {deleting.type === 'lesson' && (
                <> · toutes les notes et révisions enregistrées seront perdues.</>
              )}
            </p>
            <p style={{ fontSize: 12, color: 'var(--gray)', fontStyle: 'italic' }}>
              Cette action est irréversible.
            </p>
            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setDeleting(null)}>Annuler</button>
              <button
                className="fi-btn-danger"
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
