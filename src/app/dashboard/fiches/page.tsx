'use client'
// src/app/dashboard/fiches/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const COLORS = ['#4ADE80', '#60A5FA', '#F59E0B', '#F472B6', '#A78BFA', '#2D6A4F', '#E5E7EB']
const ICONS = ['📁', '🧬', '🦴', '🫀', '🧠', '💊', '🔬', '⚗️', '🫁', '🦷', '👁️', '🩺']

function jDotStatus(lesson: Lesson, stepIndex: number, today: string): 'ok' | 'late' | 'miss' | 'next' | 'future' {
  if (!lesson.learn_date) return 'future'
  const steps = lesson.steps as (null | object)[]
  const d = new Date(lesson.learn_date + 'T12:00:00')
  d.setDate(d.getDate() + J[stepIndex])
  const dateStr = d.toISOString().split('T')[0]
  if (steps[stepIndex]) return 'ok'
  if (dateStr < today) return 'miss'
  if (dateStr === today) return 'next'
  return 'future'
}

export default function FichesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modals
  const [showNewSystem, setShowNewSystem] = useState(false)
  const [showNewLesson, setShowNewLesson] = useState(false)

  // New system form
  const [newSysName, setNewSysName] = useState('')
  const [newSysIcon, setNewSysIcon] = useState('📁')
  const [newSysSemestre, setNewSysSemestre] = useState(1)
  const [sysLoading, setSysLoading] = useState(false)

  // New lesson form
  const [newLesName, setNewLesName] = useState('')
  const [newLesDate, setNewLesDate] = useState('')
  const [newLesSysId, setNewLesSysId] = useState('')
  const [lesLoading, setLesLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
    ])
    setSystems(sys || [])
    setLessons(les || [])
    if (sys && sys.length > 0 && !selectedSystemId) {
      setSelectedSystemId(sys[0].id)
    }
  }, [selectedSystemId])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      load(user.id)
    })
  }, [])

  // Auto-select first system when systems load
  useEffect(() => {
    if (systems.length > 0 && !selectedSystemId) {
      setSelectedSystemId(systems[0].id)
    }
  }, [systems])

  async function createSystem() {
    if (!userId || !newSysName.trim()) return
    setSysLoading(true)
    const { data, error } = await supabase.from('systems').insert({
      user_id: userId,
      name: newSysName.trim(),
      icon: newSysIcon,
      semestre: newSysSemestre,
    }).select().single()
    setSysLoading(false)
    if (data) {
      setSystems(prev => [...prev, data])
      setSelectedSystemId(data.id)
    }
    setShowNewSystem(false)
    setNewSysName('')
    setNewSysIcon('📁')
    setNewSysSemestre(1)
  }

  async function createLesson() {
    if (!userId || !newLesName.trim() || !newLesSysId) return
    setLesLoading(true)
    const steps = new Array(J.length).fill(null)
    const { data } = await supabase.from('lessons').insert({
      user_id: userId,
      system_id: newLesSysId,
      name: newLesName.trim(),
      learn_date: newLesDate || today,
      steps,
      ai_questions: [],
    }).select().single()
    setLesLoading(false)
    if (data) setLessons(prev => [...prev, data])
    setShowNewLesson(false)
    setNewLesName('')
    setNewLesDate('')
  }

  // ---- Derived data ----
  function sysStats(sys: System) {
    const sysLessons = lessons.filter(l => l.system_id === sys.id)
    const totalSteps = sysLessons.length * J.length
    const doneSteps = sysLessons.reduce((acc, l) => {
      const steps = l.steps as (null | object)[]
      return acc + steps.filter(Boolean).length
    }, 0)
    const mastery = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0
    const dueCount = sysLessons.filter(l => {
      if (!l.learn_date) return false
      const steps = l.steps as (null | object)[]
      return J.some((off, i) => {
        if (steps[i]) return false
        const d = new Date(l.learn_date + 'T12:00:00')
        d.setDate(d.getDate() + off)
        return d.toISOString().split('T')[0] <= today
      })
    }).length
    const lastLesson = sysLessons.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    const lastDate = lastLesson
      ? new Date(lastLesson.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      : null
    return { count: sysLessons.length, mastery, dueCount, lastDate }
  }

  function nextRevision(lesson: Lesson) {
    if (!lesson.learn_date) return null
    const steps = lesson.steps as (null | object)[]
    for (let i = 0; i < J.length; i++) {
      if (!steps[i]) {
        const d = new Date(lesson.learn_date + 'T12:00:00')
        d.setDate(d.getDate() + J[i])
        return d.toISOString().split('T')[0]
      }
    }
    return null // all done
  }

  function masteryLevel(lesson: Lesson): { label: string; color: string } {
    const steps = lesson.steps as (null | object)[]
    const done = steps.filter(Boolean).length
    const pct = Math.round((done / J.length) * 100)
    if (pct >= 70) return { label: 'Bonne', color: '#4ADE80' }
    if (pct >= 35) return { label: 'Moyenne', color: '#F59E0B' }
    return { label: 'Faible', color: '#F472B6' }
  }

  const selectedSystem = systems.find(s => s.id === selectedSystemId) ?? null
  const visibleLessons = lessons
    .filter(l => l.system_id === selectedSystemId)
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))

  const colorForSystem = (sys: System) => {
    const idx = systems.indexOf(sys)
    return COLORS[idx % COLORS.length]
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
        :root {
          --cream: #F5F1EA; --dark: #111310; --green: #1B4332; --gm: #2D6A4F;
          --gl: #D8EAE0; --amber: #C47B2B; --al: #FBF0E0; --gray: #6B7280; --border: #DDD8CE;
        }
        .fi-main { padding: 26px 28px; background: #EDEAE3; min-height: 100vh; display: flex; flex-direction: column; gap: 16px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .fi-card { background: white; border: 1px solid var(--border); border-radius: 13px; }
        .fi-ct { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--gray); margin-bottom: 14px; }
        .fi-btn-g { background: #1B4332; color: white; border: none; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 600; padding: 9px 18px; border-radius: 7px; cursor: pointer; }
        .fi-btn-d { background: #111310; color: white; border: none; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 600; padding: 9px 18px; border-radius: 7px; cursor: pointer; }
        .fi-btn-o { background: transparent; border: 1.5px solid var(--border); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 500; padding: 7px 13px; border-radius: 7px; cursor: pointer; color: var(--gray); transition: all .15s; }
        .fi-btn-o:hover { border-color: #aaa; color: #333; }
        .fi-btn-sm { background: #1B4332; color: white; border: none; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 600; padding: 5px 11px; border-radius: 6px; cursor: pointer; }

        /* Subject cards */
        .fi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 900px) { .fi-grid { grid-template-columns: 1fr 1fr; } }
        .fi-subj { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 18px; cursor: pointer; transition: box-shadow .15s, border-color .15s; }
        .fi-subj:hover { box-shadow: 0 4px 14px rgba(0,0,0,.07); }
        .fi-subj.active { border-color: #2D6A4F; box-shadow: 0 0 0 2px rgba(45,106,79,.15); }
        .fi-subj-add { background: #FAFAF8; border: 1.5px dashed var(--border); border-radius: 12px; padding: 18px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 120px; transition: all .15s; }
        .fi-subj-add:hover { border-color: #2D6A4F; background: #F0F7F3; }

        /* Stats */
        .fi-sstats { display: flex; gap: 14px; margin-bottom: 12px; }
        .fi-sst-n { font-family: 'Fraunces', Georgia, serif; font-size: 20px; font-weight: 500; color: #111310; line-height: 1; }
        .fi-sst-l { font-size: 9.5px; color: var(--gray); text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
        .fi-spb { height: 4px; background: #F0EDE6; border-radius: 20px; overflow: hidden; }
        .fi-spbf { height: 100%; border-radius: 20px; }
        .fi-slast { font-size: 10.5px; color: var(--gray); margin-top: 6px; }

        /* Table */
        .fi-table { width: 100%; border-collapse: collapse; }
        .fi-table th { text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--gray); padding: 10px 14px; background: #FAFAF8; border-bottom: 1px solid var(--border); }
        .fi-table td { padding: 10px 14px; font-size: 12.5px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .fi-table tr:last-child td { border-bottom: none; }
        .fi-table tr:hover td { background: #FAFAF8; }

        /* J dots */
        .jdot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--border); display: inline-block; flex-shrink: 0; }
        .jdot.ok { background: #4ADE80; border-color: #4ADE80; }
        .jdot.late { background: #F59E0B; border-color: #F59E0B; }
        .jdot.miss { background: #F472B6; border-color: #F472B6; }
        .jdot.next { background: var(--al); border-color: var(--amber); }
        .jdot.future { background: #F0EDE6; border-color: #E5E0D8; }

        /* Modal overlay */
        .fi-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.38); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .fi-modal { background: white; border-radius: 16px; padding: 28px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,.15); }
        .fi-modal-title { font-family: 'Fraunces', Georgia, serif; font-size: 20px; font-weight: 500; color: #111310; margin-bottom: 20px; }
        .fi-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--gray); margin-bottom: 6px; }
        .fi-input { width: 100%; padding: 10px 13px; border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; color: #111310; outline: none; transition: border-color .15s; box-sizing: border-box; }
        .fi-input:focus { border-color: #2D6A4F; }
        .fi-select { width: 100%; padding: 10px 13px; border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; color: #111310; outline: none; background: white; box-sizing: border-box; }
        .fi-icon-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .fi-icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid var(--border); background: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .fi-icon-btn.sel { border-color: #2D6A4F; background: #D8EAE0; }
        .fi-modal-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 22px; }

        .nr { font-size: 11px; color: var(--gray); }
        .nr.soon { color: #B91C1C; font-weight: 600; }
        .nr.today { color: #2D6A4F; font-weight: 600; }
        .nr.done { color: #9CA3AF; }
      `}</style>

      <div className="fi-main">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 500, color: '#111310' }}>
            Mes matières
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 13px', fontSize: '12.5px', color: 'var(--gray)', width: 200 }}>
              <input
                type="text"
                placeholder="Rechercher une fiche…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '12.5px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111310', width: '100%', background: 'transparent' }}
              />
            </div>
            <button className="fi-btn-o" style={{ fontSize: 12 }} onClick={() => { setShowNewSystem(true) }}>
              + Nouvelle matière
            </button>
            <button className="fi-btn-g" style={{ fontSize: 12 }} onClick={() => {
              setNewLesSysId(selectedSystemId || (systems[0]?.id ?? ''))
              setNewLesDate(today)
              setShowNewLesson(true)
            }}>
              + Créer une fiche
            </button>
          </div>
        </div>

        {/* Subject cards grid */}
        <div className="fi-grid">
          {systems.map((sys, idx) => {
            const { count, mastery, dueCount, lastDate } = sysStats(sys)
            const color = COLORS[idx % COLORS.length]
            return (
              <div
                key={sys.id}
                className={`fi-subj${selectedSystemId === sys.id ? ' active' : ''}`}
                onClick={() => setSelectedSystemId(sys.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', minWidth: 9 }} />
                    <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#111310' }}>{sys.icon} {sys.name}</span>
                  </div>
                  <button
                    className="fi-btn-sm"
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedSystemId(sys.id)
                      setNewLesSysId(sys.id)
                      setNewLesDate(today)
                      setShowNewLesson(true)
                    }}
                  >
                    Réviser
                  </button>
                </div>
                <div className="fi-sstats">
                  <div style={{ textAlign: 'center' }}>
                    <div className="fi-sst-n">{count}</div>
                    <div className="fi-sst-l">Fiches</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="fi-sst-n">{dueCount}</div>
                    <div className="fi-sst-l">À revoir</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="fi-sst-n">{mastery}%</div>
                    <div className="fi-sst-l">Maîtrise</div>
                  </div>
                </div>
                <div className="fi-spb">
                  <div className="fi-spbf" style={{ width: `${mastery}%`, background: color }} />
                </div>
                {lastDate && (
                  <div className="fi-slast">Dernière fiche : {lastDate}</div>
                )}
                {!lastDate && (
                  <div className="fi-slast">Aucune fiche — clique pour en créer</div>
                )}
              </div>
            )
          })}

          {/* Add subject card */}
          <div className="fi-subj-add" onClick={() => setShowNewSystem(true)}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#D8EAE0', color: '#1B4332', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              +
            </div>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--gray)' }}>Nouvelle matière</span>
          </div>
        </div>

        {/* Empty state */}
        {systems.length === 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 13, padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 500, color: '#111310', marginBottom: 8 }}>
              Crée ta première matière
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 20 }}>
              Commence par ajouter une matière, puis crée tes fiches dedans.
            </p>
            <button className="fi-btn-g" onClick={() => setShowNewSystem(true)}>
              + Créer une matière
            </button>
          </div>
        )}

        {/* Lessons table for selected system */}
        {selectedSystem && (
          <div className="fi-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[systems.indexOf(selectedSystem) % COLORS.length], display: 'inline-block', minWidth: 10 }} />
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 500, color: '#111310' }}>
                  {selectedSystem.icon} {selectedSystem.name}
                </h2>
                <span style={{ fontSize: 13, color: 'var(--gray)' }}>{visibleLessons.length} fiche{visibleLessons.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="fi-btn-o" style={{ fontSize: 11, padding: '5px 11px' }}>Toutes</button>
                <button className="fi-btn-o" style={{ fontSize: 11, padding: '5px 11px' }}>À revoir</button>
                <button className="fi-btn-g" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => {
                  setNewLesSysId(selectedSystem.id)
                  setNewLesDate(today)
                  setShowNewLesson(true)
                }}>
                  + Créer une fiche
                </button>
              </div>
            </div>

            {/* J-curve legend */}
            <div style={{ padding: '7px 18px', background: '#FAFAF8', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--gray)' }}>
              <span style={{ fontWeight: 600 }}>Courbe J :</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot ok" />Révisé</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot late" />En retard</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot miss" />Manqué</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot next" />Aujourd&apos;hui</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot future" />À venir</span>
            </div>

            {/* Empty lessons state */}
            {visibleLessons.length === 0 && (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 14 }}>
                  {search ? 'Aucune fiche ne correspond à ta recherche.' : 'Aucune fiche dans cette matière pour l\'instant.'}
                </p>
                {!search && (
                  <button className="fi-btn-g" style={{ fontSize: 12 }} onClick={() => {
                    setNewLesSysId(selectedSystem.id)
                    setNewLesDate(today)
                    setShowNewLesson(true)
                  }}>
                    + Créer la première fiche
                  </button>
                )}
              </div>
            )}

            {/* Lessons table */}
            {visibleLessons.length > 0 && (
              <table className="fi-table">
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Fiche</th>
                    <th>Maîtrise</th>
                    <th>Courbe J (J0 → J120)</th>
                    <th>Prochaine révision</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLessons.map(lesson => {
                    const { label: mastLabel, color: mastColor } = masteryLevel(lesson)
                    const nextRev = nextRevision(lesson)
                    const nextRevLabel = (() => {
                      if (!nextRev) return { text: 'Complétée ✓', cls: 'done' }
                      if (nextRev < today) return { text: 'En retard', cls: 'soon' }
                      if (nextRev === today) return { text: 'Aujourd\'hui', cls: 'today' }
                      const diff = Math.round((new Date(nextRev).getTime() - new Date(today).getTime()) / 86400000)
                      if (diff === 1) return { text: 'Demain', cls: '' }
                      return { text: `Dans ${diff} jours`, cls: '' }
                    })()

                    return (
                      <tr key={lesson.id}>
                        <td style={{ fontWeight: 500, color: '#111310' }}>{lesson.name}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: mastColor, display: 'inline-block' }} />
                            <span style={{ fontSize: 12, color: 'var(--gray)' }}>{mastLabel}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'nowrap' }}>
                            {J.map((_, i) => {
                              const status = jDotStatus(lesson, i, today)
                              return <span key={i} className={`jdot ${status}`} title={`J+${J[i]}`} />
                            })}
                          </div>
                        </td>
                        <td>
                          <span className={`nr${nextRevLabel.cls ? ' ' + nextRevLabel.cls : ''}`}>
                            {nextRevLabel.text}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ---- MODAL : Nouvelle matière ---- */}
      {showNewSystem && (
        <div className="fi-overlay" onClick={() => setShowNewSystem(false)}>
          <div className="fi-modal" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">Nouvelle matière</div>

            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Nom de la matière</label>
              <input
                className="fi-input"
                type="text"
                placeholder="ex : Biochimie, Anatomie…"
                value={newSysName}
                onChange={e => setNewSysName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && createSystem()}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Icône</label>
              <div className="fi-icon-grid">
                {ICONS.map(ic => (
                  <button
                    key={ic}
                    className={`fi-icon-btn${newSysIcon === ic ? ' sel' : ''}`}
                    onClick={() => setNewSysIcon(ic)}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <label className="fi-label">Semestre</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2].map(s => (
                  <button
                    key={s}
                    onClick={() => setNewSysSemestre(s)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${newSysSemestre === s ? '#2D6A4F' : 'var(--border)'}`,
                      background: newSysSemestre === s ? '#D8EAE0' : 'white',
                      color: newSysSemestre === s ? '#1B4332' : 'var(--gray)',
                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    Semestre {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setShowNewSystem(false)}>Annuler</button>
              <button
                className="fi-btn-g"
                onClick={createSystem}
                disabled={!newSysName.trim() || sysLoading}
                style={{ opacity: !newSysName.trim() ? .5 : 1 }}
              >
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
              <input
                className="fi-input"
                type="text"
                placeholder="ex : Glycolyse — étapes et régulation"
                value={newLesName}
                onChange={e => setNewLesName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && createLesson()}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Matière</label>
              <select
                className="fi-select"
                value={newLesSysId}
                onChange={e => setNewLesSysId(e.target.value)}
              >
                {systems.map(sys => (
                  <option key={sys.id} value={sys.id}>{sys.icon} {sys.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 4 }}>
              <label className="fi-label">Date d&apos;apprentissage (J0)</label>
              <input
                className="fi-input"
                type="date"
                value={newLesDate}
                onChange={e => setNewLesDate(e.target.value)}
              />
              <p style={{ fontSize: 11, color: 'var(--gray)', marginTop: 5 }}>
                MedRev planifiera les révisions J+1, J+3, J+5… à partir de cette date.
              </p>
            </div>

            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setShowNewLesson(false)}>Annuler</button>
              <button
                className="fi-btn-g"
                onClick={createLesson}
                disabled={!newLesName.trim() || !newLesSysId || lesLoading}
                style={{ opacity: (!newLesName.trim() || !newLesSysId) ? .5 : 1 }}
              >
                {lesLoading ? 'Création…' : 'Créer la fiche'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
