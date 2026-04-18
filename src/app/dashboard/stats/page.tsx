'use client'
// src/app/dashboard/stats/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

type StepEntry = { ok: boolean; date: string } | null

function getCompletedSteps(lesson: Lesson): StepEntry[] {
  return (lesson.steps as StepEntry[]) || []
}

function getMasteryLevel(lesson: Lesson): number {
  const steps = getCompletedSteps(lesson)
  let count = 0
  for (let i = 0; i < J.length; i++) {
    if (steps[i]) count = i + 1
  }
  return count // 0 = jamais révisé, 14 = maîtrisé complet
}

function getMasteryPct(lesson: Lesson): number {
  return Math.round((getMasteryLevel(lesson) / J.length) * 100)
}

function getDueCount(lessons: Lesson[], today: string): number {
  return lessons.filter(l => {
    if (!l.learn_date) return false
    const steps = getCompletedSteps(l)
    for (let i = 0; i < J.length; i++) {
      if (steps[i]) continue
      const d = new Date(l.learn_date + 'T12:00:00')
      d.setDate(d.getDate() + J[i])
      if (d.toISOString().split('T')[0] <= today) return true
    }
    return false
  }).length
}

function getSuccessRate(lessons: Lesson[]): number {
  let ok = 0, total = 0
  lessons.forEach(l => {
    const steps = getCompletedSteps(l)
    steps.forEach(s => {
      if (s !== null) {
        total++
        if (s && (s as { ok: boolean }).ok) ok++
      }
    })
  })
  return total === 0 ? 0 : Math.round((ok / total) * 100)
}

// Returns array of {date, count} for last N days of reviews done
function getActivityLast30(lessons: Lesson[]): { date: string; ok: number; miss: number }[] {
  const map: Record<string, { ok: number; miss: number }> = {}
  lessons.forEach(l => {
    const steps = getCompletedSteps(l)
    steps.forEach(s => {
      if (s && typeof s === 'object' && 'date' in s) {
        const entry = s as { ok: boolean; date: string }
        if (!map[entry.date]) map[entry.date] = { ok: 0, miss: 0 }
        if (entry.ok) map[entry.date].ok++
        else map[entry.date].miss++
      }
    })
  })
  // Build last 30 days
  const result: { date: string; ok: number; miss: number }[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    result.push({ date: ds, ok: map[ds]?.ok || 0, miss: map[ds]?.miss || 0 })
  }
  return result
}

// Streak: consecutive days with at least 1 review
function getStreak(activity: { date: string; ok: number; miss: number }[]): number {
  let streak = 0
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].ok + activity[i].miss > 0) streak++
    else break
  }
  return streak
}

export default function StatsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSemestre, setSelectedSemestre] = useState<number | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
    ])
    setSystems(sys || [])
    setLessons(les || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      load(user.id)
    })
  }, [])

  // Filtered data
  const filteredSystems = selectedSemestre === null
    ? systems
    : systems.filter(s => s.semestre === selectedSemestre)
  const filteredSysIds = new Set(filteredSystems.map(s => s.id))
  const filteredLessons = lessons.filter(l => filteredSysIds.has(l.system_id))

  const totalFiches = filteredLessons.length
  const fichesAvecDate = filteredLessons.filter(l => l.learn_date).length
  const dueCount = getDueCount(filteredLessons, today)
  const successRate = getSuccessRate(filteredLessons)

  const activity = getActivityLast30(filteredLessons)
  const streak = getStreak(activity)
  const totalRevisions = activity.reduce((acc, d) => acc + d.ok + d.miss, 0)
  const maxActivity = Math.max(...activity.map(d => d.ok + d.miss), 1)

  // Per-system mastery
  const systemStats = filteredSystems.map(sys => {
    const sysLessons = filteredLessons.filter(l => l.system_id === sys.id)
    if (sysLessons.length === 0) return { sys, avg: 0, count: 0, due: 0 }
    const avg = Math.round(sysLessons.reduce((a, l) => a + getMasteryPct(l), 0) / sysLessons.length)
    const due = getDueCount(sysLessons, today)
    return { sys, avg, count: sysLessons.length, due }
  }).sort((a, b) => b.avg - a.avg)

  // Mastery distribution
  const dist = [0, 0, 0, 0, 0] // 0-20, 21-40, 41-60, 61-80, 81-100
  filteredLessons.forEach(l => {
    const pct = getMasteryPct(l)
    if (pct <= 20) dist[0]++
    else if (pct <= 40) dist[1]++
    else if (pct <= 60) dist[2]++
    else if (pct <= 80) dist[3]++
    else dist[4]++
  })
  const maxDist = Math.max(...dist, 1)

  // Semestres disponibles
  const semestres = [...new Set(systems.map(s => s.semestre).filter(Boolean))].sort() as number[]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EDEAE3' }}>
      <div style={{ color: '#1B4332', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16 }}>Chargement…</div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#EDEAE3',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      color: '#111310',
      padding: '32px 24px',
      maxWidth: 1100,
      margin: '0 auto',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 28, fontWeight: 700, color: '#111310', margin: 0 }}>
            Statistiques
          </h1>
          <p style={{ margin: '4px 0 0', color: '#5a5a4a', fontSize: 14 }}>
            Suivi de ta progression en révision espacée
          </p>
        </div>
        {/* Filtre semestre */}
        {semestres.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedSemestre(null)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                borderColor: selectedSemestre === null ? '#1B4332' : '#ccc',
                background: selectedSemestre === null ? '#1B4332' : 'white',
                color: selectedSemestre === null ? 'white' : '#555',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>
              Tout
            </button>
            {semestres.map(s => (
              <button
                key={s}
                onClick={() => setSelectedSemestre(s)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: selectedSemestre === s ? '#1B4332' : '#ccc',
                  background: selectedSemestre === s ? '#1B4332' : 'white',
                  color: selectedSemestre === s ? 'white' : '#555',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                S{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard label="Fiches créées" value={totalFiches} sub={`${fichesAvecDate} avec date`} color="#1B4332" />
        <KpiCard label="À réviser aujourd'hui" value={dueCount} sub={dueCount === 0 ? 'Tu es à jour ✓' : 'fiches en attente'} color={dueCount > 0 ? '#B91C1C' : '#1B4332'} />
        <KpiCard label="Taux de réussite" value={`${successRate}%`} sub="révisions notées OK" color="#C47B2B" />
        <KpiCard label="Série active" value={`${streak}j`} sub="jours consécutifs" color="#2D6A4F" />
        <KpiCard label="Révisions (30j)" value={totalRevisions} sub="répétitions effectuées" color="#555" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Activité 30j */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 17, fontWeight: 700, margin: '0 0 16px', color: '#111310' }}>
            Activité des 30 derniers jours
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {activity.map((d, i) => {
              const total = d.ok + d.miss
              const h = total === 0 ? 2 : Math.max(6, Math.round((total / maxActivity) * 72))
              const okH = total === 0 ? 2 : Math.round((d.ok / total) * h)
              const missH = h - okH
              const isToday = d.date === today
              return (
                <div key={i} title={`${d.date}: ${d.ok} OK, ${d.miss} raté`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                    {total > 0 ? (
                      <>
                        <div style={{ height: missH, background: '#FCA5A5', minHeight: missH > 0 ? 2 : 0 }} />
                        <div style={{ height: okH, background: '#1B4332', minHeight: okH > 0 ? 2 : 0 }} />
                      </>
                    ) : (
                      <div style={{ height: 2, background: '#e5e5e5' }} />
                    )}
                  </div>
                  {isToday && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#C47B2B', marginTop: 3 }} />}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#555' }}>
              <div style={{ width: 10, height: 10, background: '#1B4332', borderRadius: 2 }} /> Réussi
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#555' }}>
              <div style={{ width: 10, height: 10, background: '#FCA5A5', borderRadius: 2 }} /> À retravailler
            </div>
          </div>
        </div>

        {/* Distribution de maîtrise */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 17, fontWeight: 700, margin: '0 0 16px', color: '#111310' }}>
            Distribution de maîtrise
          </h2>
          {totalFiches === 0 ? (
            <div style={{ color: '#999', fontSize: 14, textAlign: 'center', paddingTop: 24 }}>Aucune fiche créée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Non commencé (0–20%)', color: '#E5E7EB', count: dist[0] },
                { label: 'Débutant (21–40%)', color: '#D8EAE0', count: dist[1] },
                { label: 'En cours (41–60%)', color: '#86EFAC', count: dist[2] },
                { label: 'Avancé (61–80%)', color: '#2D6A4F', count: dist[3] },
                { label: 'Maîtrisé (81–100%)', color: '#1B4332', count: dist[4] },
              ].map(({ label, color, count }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 4 }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 600, color: '#111310' }}>{count}</span>
                  </div>
                  <div style={{ height: 8, background: '#f0f0ee', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round((count / totalFiches) * 100)}%`,
                      background: color,
                      borderRadius: 4,
                      border: color === '#E5E7EB' ? '1px solid #ccc' : 'none',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Maîtrise par matière */}
      <div style={{ background: 'white', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 17, fontWeight: 700, margin: '0 0 16px', color: '#111310' }}>
          Maîtrise par matière
        </h2>
        {systemStats.length === 0 ? (
          <div style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            Aucune matière créée. Commence par ajouter des matières dans <a href="/dashboard/fiches" style={{ color: '#1B4332' }}>Fiches</a>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {systemStats.map(({ sys, avg, count, due }) => (
              <div key={sys.id} style={{
                border: '1.5px solid #e8e4dc',
                borderRadius: 12,
                padding: '14px 16px',
                background: '#faf9f7',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{sys.icon || '📁'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111310' }}>{sys.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{count} fiche{count > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  {due > 0 && (
                    <span style={{
                      background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA',
                      borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    }}>
                      {due} à réviser
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div style={{ height: 8, background: '#e8e4dc', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{
                    height: '100%',
                    width: `${avg}%`,
                    background: avg >= 80 ? '#1B4332' : avg >= 50 ? '#2D6A4F' : avg >= 25 ? '#86EFAC' : '#D8EAE0',
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 12, color: '#666', textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: avg >= 70 ? '#1B4332' : '#C47B2B' }}>{avg}%</span>
                  {' '}de maîtrise
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Détail des fiches */}
      <div style={{ background: 'white', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 17, fontWeight: 700, margin: '0 0 16px', color: '#111310' }}>
          Détail des fiches
        </h2>
        {filteredLessons.length === 0 ? (
          <div style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            Aucune fiche. <a href="/dashboard/fiches" style={{ color: '#1B4332' }}>Créer des fiches →</a>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8e4dc' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 600, fontSize: 12 }}>Fiche</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 600, fontSize: 12 }}>Matière</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: '#888', fontWeight: 600, fontSize: 12 }}>Palier</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: '#888', fontWeight: 600, fontSize: 12 }}>Maîtrise</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: '#888', fontWeight: 600, fontSize: 12 }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredLessons.slice(0, 50).map(lesson => {
                  const sys = systems.find(s => s.id === lesson.system_id)
                  const level = getMasteryLevel(lesson)
                  const pct = getMasteryPct(lesson)
                  const isDue = getDueCount([lesson], today) > 0
                  return (
                    <tr key={lesson.id} style={{ borderBottom: '1px solid #f0f0ee', background: isDue ? '#FFF7F7' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', color: '#111310', fontWeight: 500 }}>{lesson.name}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span>{sys?.icon || '📁'}</span>
                          <span>{sys?.name || '—'}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555' }}>
                        {lesson.learn_date ? `J${level > 0 ? J[level - 1] : 0} / J${J[J.length - 1]}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: '#e8e4dc', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: pct >= 80 ? '#1B4332' : pct >= 50 ? '#2D6A4F' : '#86EFAC',
                              borderRadius: 3,
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#555', minWidth: 30 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {!lesson.learn_date ? (
                          <span style={{ fontSize: 12, color: '#999' }}>Sans date</span>
                        ) : isDue ? (
                          <span style={{
                            background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA',
                            borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                          }}>À réviser</span>
                        ) : pct === 100 ? (
                          <span style={{
                            background: '#D8EAE0', color: '#1B4332', border: '1px solid #A7D3BC',
                            borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                          }}>Maîtrisé ✓</span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#888' }}>En cours</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredLessons.length > 50 && (
              <div style={{ textAlign: 'center', padding: '12px 0', color: '#888', fontSize: 13 }}>
                Affichage des 50 premières fiches sur {filteredLessons.length}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'Fraunces, Georgia, serif', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>{sub}</div>
    </div>
  )
}
