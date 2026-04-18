'use client'
// src/app/dashboard/fiches/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

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

function getDueStepIndex(lesson: Lesson, today: string): number {
  if (!lesson.learn_date) return -1
  const steps = lesson.steps as (null | object)[]
  for (let i = 0; i < J.length; i++) {
    if (steps[i]) continue
    const d = new Date(lesson.learn_date + 'T12:00:00')
    d.setDate(d.getDate() + J[i])
    if (d.toISOString().split('T')[0] <= today) return i
  }
  return -1
}

export default function FichesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showNewSystem, setShowNewSystem] = useState(false)
  const [showNewLesson, setShowNewLesson] = useState(false)
  const [newSysName, setNewSysName] = useState('')
  const [newSysIcon, setNewSysIcon] = useState('📁')
  const [newSysSemestre, setNewSysSemestre] = useState(1)
  const [sysLoading, setSysLoading] = useState(false)
  const [newLesName, setNewLesName] = useState('')
  const [newLesDate, setNewLesDate] = useState('')
  const [newLesSysId, setNewLesSysId] = useState('')
  const [lesLoading, setLesLoading] = useState(false)
  const [reviewSysId, setReviewSysId] = useState<string | null>(null)
  const [reviewIdx, setReviewIdx] = useState(0)
  const [reviewResults, setReviewResults] = useState<{ lessonId: string; ok: boolean }[]>([])
  const [reviewDone, setReviewDone] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
    ])
    setSystems(sys || [])
    setLessons(les || [])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      load(user.id)
    })
  }, [])

  useEffect(() => {
    if (systems.length > 0 && !selectedSystemId) setSelectedSystemId(systems[0].id)
  }, [systems])

  async function createSystem() {
    if (!userId || !newSysName.trim()) return
    setSysLoading(true)
    const { data } = await supabase.from('systems').insert({
      user_id: userId, name: newSysName.trim(), icon: newSysIcon, semestre: newSysSemestre,
    }).select().single()
    setSysLoading(false)
    if (data) { setSystems(prev => [...prev, data]); setSelectedSystemId(data.id) }
    setShowNewSystem(false); setNewSysName(''); setNewSysIcon('📁'); setNewSysSemestre(1)
  }

  async function createLesson() {
    if (!userId || !newLesName.trim() || !newLesSysId) return
    setLesLoading(true)
    const { data } = await supabase.from('lessons').insert({
      user_id: userId, system_id: newLesSysId, name: newLesName.trim(),
      learn_date: newLesDate || today, steps: new Array(J.length).fill(null), ai_questions: [],
    }).select().single()
    setLesLoading(false)
    if (data) setLessons(prev => [...prev, data])
    setShowNewLesson(false); setNewLesName(''); setNewLesDate('')
  }

  function getDueLessons(sysId: string): Lesson[] {
    return lessons.filter(l => l.system_id === sysId && getDueStepIndex(l, today) !== -1)
  }

  function startReview(sysId: string) {
    setReviewSysId(sysId); setReviewIdx(0); setReviewResults([]); setReviewDone(false)
  }

  async function rateLesson(ok: boolean) {
    if (!reviewSysId) return
    const dueLessons = getDueLessons(reviewSysId)
    const lesson = dueLessons[reviewIdx]
    if (!lesson) return
    const stepIdx = getDueStepIndex(lesson, today)
    if (stepIdx === -1) return
    setReviewLoading(true)
    const newSteps = [...(lesson.steps as any[])]
    newSteps[stepIdx] = { ok, date: today }
    await supabase.from('lessons').update({ steps: newSteps }).eq('id', lesson.id)
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, steps: newSteps as any } : l))
    setReviewResults(prev => [...prev, { lessonId: lesson.id, ok }])
    setReviewLoading(false)
    if (reviewIdx + 1 >= dueLessons.length) setReviewDone(true)
    else setReviewIdx(i => i + 1)
  }

  function sysStats(sys: System) {
    const sysLessons = lessons.filter(l => l.system_id === sys.id)
    const totalSteps = sysLessons.length * J.length
    const doneSteps = sysLessons.reduce((acc, l) => acc + (l.steps as (null | object)[]).filter(Boolean).length, 0)
    const mastery = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0
    const dueCount = getDueLessons(sys.id).length
    const lastLesson = [...sysLessons].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    const lastDate = lastLesson ? new Date(lastLesson.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null
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
    return null
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
  const reviewSystem = systems.find(s => s.id === reviewSysId)
  const dueLessons = reviewSysId ? getDueLessons(reviewSysId) : []
  const currentReviewLesson = dueLessons[reviewIdx]
  const currentStepIdx = currentReviewLesson ? getDueStepIndex(currentReviewLesson, today) : -1

  return (
    <>
      <div className="fi-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 500, color: '#111310' }}>Mes matières</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 13px', width: 200 }}>
              <input type="text" placeholder="Rechercher une fiche..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '12.5px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111310', width: '100%', background: 'transparent' }} />
            </div>
            <button className="fi-btn-o" style={{ fontSize: 12 }} onClick={() => setShowNewSystem(true)}>+ Nouvelle matiere</button>
            <button className="fi-btn-g" style={{ fontSize: 12 }} onClick={() => { setNewLesSysId(selectedSystemId || (systems[0]?.id ?? '')); setNewLesDate(today); setShowNewLesson(true) }}>+ Creer une fiche</button>
          </div>
        </div>

        <div className="fi-grid">
          {systems.map((sys, idx) => {
            const { count, mastery, dueCount, lastDate } = sysStats(sys)
            const color = COLORS[idx % COLORS.length]
            const isUrgent = dueCount > 0
            return (
              <div key={sys.id} className={"fi-subj" + (selectedSystemId === sys.id ? ' active' : '')} onClick={() => setSelectedSystemId(sys.id)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', minWidth: 9 }} />
                    <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#111310' }}>{sys.icon} {sys.name}</span>
                  </div>
                  <button className={"fi-btn-sm" + (isUrgent ? ' urgent' : '')} onClick={e => { e.stopPropagation(); startReview(sys.id) }}>
                    {isUrgent ? 'Reviser (' + dueCount + ')' : 'Reviser'}
                  </button>
                </div>
                <div className="fi-sstats">
                  <div style={{ textAlign: 'center' }}><div className="fi-sst-n">{count}</div><div className="fi-sst-l">Fiches</div></div>
                  <div style={{ textAlign: 'center' }}><div className="fi-sst-n" style={{ color: isUrgent ? '#B91C1C' : undefined }}>{dueCount}</div><div className="fi-sst-l">A revoir</div></div>
                  <div style={{ textAlign: 'center' }}><div className="fi-sst-n">{mastery}%</div><div className="fi-sst-l">Maitrise</div></div>
                </div>
                <div className="fi-spb"><div className="fi-spbf" style={{ width: mastery + '%', background: color }} /></div>
                {lastDate ? <div className="fi-slast">Derniere fiche : {lastDate}</div> : <div className="fi-slast">Aucune fiche</div>}
              </div>
            )
          })}
          <div className="fi-subj-add" onClick={() => setShowNewSystem(true)}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#D8EAE0', color: '#1B4332', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</div>
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--gray)' }}>Nouvelle matiere</span>
          </div>
        </div>

        {systems.length === 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 13, padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 500, color: '#111310', marginBottom: 8 }}>Cree ta premiere matiere</h2>
            <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 20 }}>Commence par ajouter une matiere, puis cree tes fiches dedans.</p>
            <button className="fi-btn-g" onClick={() => setShowNewSystem(true)}>+ Creer une matiere</button>
          </div>
        )}

        {selectedSystem && (
          <div className="fi-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[systems.indexOf(selectedSystem) % COLORS.length], display: 'inline-block', minWidth: 10 }} />
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 500, color: '#111310' }}>{selectedSystem.icon} {selectedSystem.name}</h2>
                <span style={{ fontSize: 13, color: 'var(--gray)' }}>{visibleLessons.length} fiche{visibleLessons.length !== 1 ? 's' : ''}</span>
              </div>
              <button className="fi-btn-g" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => { setNewLesSysId(selectedSystem.id); setNewLesDate(today); setShowNewLesson(true) }}>+ Creer une fiche</button>
            </div>
            <div style={{ padding: '7px 18px', background: '#FAFAF8', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--gray)' }}>
              <span style={{ fontWeight: 600 }}>Courbe J :</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot ok" />Revise</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot late" />En retard</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot miss" />Manque</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot next" />Aujourd'hui</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="jdot future" />A venir</span>
            </div>
            {visibleLessons.length === 0 ? (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 14 }}>{search ? 'Aucune fiche ne correspond.' : 'Aucune fiche dans cette matiere.'}</p>
                {!search && <button className="fi-btn-g" style={{ fontSize: 12 }} onClick={() => { setNewLesSysId(selectedSystem.id); setNewLesDate(today); setShowNewLesson(true) }}>+ Creer la premiere fiche</button>}
              </div>
            ) : (
              <table className="fi-table">
                <thead><tr><th style={{ width: '35%' }}>Fiche</th><th>Maitrise</th><th>Courbe J</th><th>Prochaine revision</th></tr></thead>
                <tbody>
                  {visibleLessons.map(lesson => {
                    const { label: mastLabel, color: mastColor } = masteryLevel(lesson)
                    const nextRev = nextRevision(lesson)
                    const isDue = getDueStepIndex(lesson, today) !== -1
                    const diff = nextRev ? Math.round((new Date(nextRev).getTime() - new Date(today).getTime()) / 86400000) : 0
                    const nextText = !nextRev ? 'Complete' : nextRev < today ? 'En retard' : nextRev === today ? "Aujourd'hui" : diff === 1 ? 'Demain' : 'Dans ' + diff + ' j.'
                    const nextCls = !nextRev ? 'done' : nextRev <= today ? 'soon' : ''
                    return (
                      <tr key={lesson.id} style={{ background: isDue ? '#FFFBF0' : undefined }}>
                        <td style={{ fontWeight: 500, color: '#111310' }}>
                          {lesson.name}
                          {isDue && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 700, background: '#FEE2E2', color: '#B91C1C', borderRadius: 20, padding: '1px 6px' }}>A reviser</span>}
                        </td>
                        <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: mastColor, display: 'inline-block' }} /><span style={{ fontSize: 12, color: 'var(--gray)' }}>{mastLabel}</span></span></td>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{J.map((_, i) => <span key={i} className={"jdot " + jDotStatus(lesson, i, today)} title={"J+" + J[i]} />)}</div></td>
                        <td><span className={"nr" + (nextCls ? ' ' + nextCls : '')}>{nextText}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {reviewSysId && (
        <div className="fi-overlay" onClick={() => setReviewSysId(null)}>
          <div className="rev-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gray)', marginBottom: 3 }}>Session de revision</div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 500, color: '#111310' }}>{reviewSystem?.icon} {reviewSystem?.name}</div>
              </div>
              <button onClick={() => setReviewSysId(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray)', padding: '4px 8px', borderRadius: 6 }}>x</button>
            </div>
            {dueLessons.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, color: '#111310', marginBottom: 6 }}>Tout est a jour !</p>
                <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 20 }}>Aucune fiche a reviser pour cette matiere aujourd'hui.</p>
                <button className="fi-btn-g" onClick={() => setReviewSysId(null)}>Fermer</button>
              </div>
            )}
            {dueLessons.length > 0 && reviewDone && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{reviewResults.filter(r => r.ok).length === reviewResults.length ? '🏆' : '✅'}</div>
                <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: '#111310', marginBottom: 6 }}>Session terminee !</p>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 20 }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, color: '#4ADE80', fontWeight: 500 }}>{reviewResults.filter(r => r.ok).length}</div><div style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase' }}>Maitrisees</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, color: '#F472B6', fontWeight: 500 }}>{reviewResults.filter(r => !r.ok).length}</div><div style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase' }}>A retravailler</div></div>
                </div>
                <button className="fi-btn-g" style={{ width: '100%' }} onClick={() => setReviewSysId(null)}>Fermer</button>
              </div>
            )}
            {dueLessons.length > 0 && !reviewDone && currentReviewLesson && (
              <>
                <div style={{ background: '#F0EDE6', borderRadius: 20, height: 5, marginBottom: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 20, background: '#1B4332', width: ((reviewIdx / dueLessons.length) * 100) + '%', transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 6, textAlign: 'center' }}>{reviewIdx + 1} / {dueLessons.length} · J+{J[currentStepIdx]}</div>
                <div style={{ background: '#FAFAF8', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 20px', textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gray)', marginBottom: 10 }}>Revision J+{J[currentStepIdx]}</div>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 500, color: '#111310', lineHeight: 1.4 }}>{currentReviewLesson.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8 }}>{reviewSystem?.name} · appris le {new Date(currentReviewLesson.learn_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>
                </div>
                <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--gray)', textAlign: 'center', fontWeight: 500 }}>Tu maitrises cette fiche ?</div>
                <div style={{ display: 'flex', gap: 9 }}>
                  <button className="rev-rating-btn ko" onClick={() => rateLesson(false)} disabled={reviewLoading}>A retravailler</button>
                  <button className="rev-rating-btn ok" onClick={() => rateLesson(true)} disabled={reviewLoading}>Maitrise</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showNewSystem && (
        <div className="fi-overlay" onClick={() => setShowNewSystem(false)}>
          <div className="fi-modal" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">Nouvelle matiere</div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Nom de la matiere</label>
              <input className="fi-input" type="text" placeholder="ex : Biochimie, Anatomie..." value={newSysName} onChange={e => setNewSysName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && createSystem()} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Icone</label>
              <div className="fi-icon-grid">{ICONS.map(ic => <button key={ic} className={"fi-icon-btn" + (newSysIcon === ic ? ' sel' : '')} onClick={() => setNewSysIcon(ic)}>{ic}</button>)}</div>
            </div>
            <div style={{ marginBottom: 4 }}>
              <label className="fi-label">Semestre</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2].map(s => (
                  <button key={s} onClick={() => setNewSysSemestre(s)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1.5px solid ' + (newSysSemestre === s ? '#2D6A4F' : 'var(--border)'), background: newSysSemestre === s ? '#D8EAE0' : 'white', color: newSysSemestre === s ? '#1B4332' : 'var(--gray)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Semestre {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setShowNewSystem(false)}>Annuler</button>
              <button className="fi-btn-g" onClick={createSystem} disabled={!newSysName.trim() || sysLoading} style={{ opacity: !newSysName.trim() ? .5 : 1 }}>{sysLoading ? 'Creation...' : 'Creer la matiere'}</button>
            </div>
          </div>
        </div>
      )}

      {showNewLesson && (
        <div className="fi-overlay" onClick={() => setShowNewLesson(false)}>
          <div className="fi-modal" onClick={e => e.stopPropagation()}>
            <div className="fi-modal-title">Nouvelle fiche</div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Intitule de la fiche</label>
              <input className="fi-input" type="text" placeholder="ex : Glycolyse etapes et regulation" value={newLesName} onChange={e => setNewLesName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && createLesson()} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="fi-label">Matiere</label>
              <select className="fi-select" value={newLesSysId} onChange={e => setNewLesSysId(e.target.value)}>
                {systems.map(sys => <option key={sys.id} value={sys.id}>{sys.icon} {sys.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 4 }}>
              <label className="fi-label">Date apprentissage (J0)</label>
              <input className="fi-input" type="date" value={newLesDate} onChange={e => setNewLesDate(e.target.value)} />
              <p style={{ fontSize: 11, color: 'var(--gray)', marginTop: 5 }}>MedRev planifiera les revisions J+1, J+3, J+5 a partir de cette date.</p>
            </div>
            <div className="fi-modal-actions">
              <button className="fi-btn-o" onClick={() => setShowNewLesson(false)}>Annuler</button>
              <button className="fi-btn-g" onClick={createLesson} disabled={!newLesName.trim() || !newLesSysId || lesLoading} style={{ opacity: (!newLesName.trim() || !newLesSysId) ? .5 : 1 }}>{lesLoading ? 'Creation...' : 'Creer la fiche'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
