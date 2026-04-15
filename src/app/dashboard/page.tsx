'use client'
// src/app/dashboard/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import { J_STEPS, todayStr } from '@/types'

const J = [0,1,3,5,7,15,21,30,45,60,75,90,105,120]

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const today = new Date().toISOString().split('T')[0]

  // Today's French date label
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
  const todayLabelCap = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)

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
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
      load(user.id)
    })
  }, [])

  // --- Derived data ---

  // Today's sessions to review
  const todaySessions = lessons.filter(l => {
    if (!l.learn_date) return false
    const steps = l.steps as (null|object)[]
    return J.some((off, i) => {
      const d = new Date(l.learn_date + 'T12:00:00')
      d.setDate(d.getDate() + off)
      return d.toISOString().split('T')[0] === today && !steps[i]
    })
  })

  // Total cards due today
  const totalDueToday = todaySessions.length

  // Sessions by priority (sort by urgency: lessons closest to exam first)
  const prioritySessions = todaySessions.slice(0, 3)

  // Mastery per subject
  const masteryBySubject = systems.map(sys => {
    const sysLessons = lessons.filter(l => l.system_id === sys.id)
    const totalCards = sysLessons.reduce((acc, l) => {
      const steps = l.steps as (null|object)[]
      return acc + J.length
    }, 0)
    const doneCards = sysLessons.reduce((acc, l) => {
      const steps = l.steps as (null|object)[]
      return acc + steps.filter(Boolean).length
    }, 0)
    const pct = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0
    return { name: sys.name, icon: sys.icon, pct, count: sysLessons.length }
  }).filter(s => s.count > 0).slice(0, 5)

  // Week load (cards due each day this week)
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const weekLoad = weekDays.map((day, i) => {
    const d = new Date()
    const dayOfWeek = d.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const targetDate = new Date(d)
    targetDate.setDate(d.getDate() + mondayOffset + i)
    const dateStr = targetDate.toISOString().split('T')[0]
    let count = 0
    lessons.forEach(l => {
      if (!l.learn_date) return
      const steps = l.steps as (null|object)[]
      J.forEach((off, ji) => {
        const dd = new Date(l.learn_date + 'T12:00:00')
        dd.setDate(dd.getDate() + off)
        if (dd.toISOString().split('T')[0] === dateStr && !steps[ji]) count++
      })
    })
    return { day, count, dateStr, isToday: dateStr === today }
  })
  const maxLoad = Math.max(...weekLoad.map(d => d.count), 1)
  const totalWeek = weekLoad.reduce((a, d) => a + d.count, 0)

  const barColors = ['#4ADE80','#60A5FA','#F59E0B','#F472B6','#A78BFA','#2D6A4F','#E5E7EB']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
        :root {
          --cream: #F5F1EA; --dark: #111310; --green: #1B4332; --gm: #2D6A4F;
          --gl: #D8EAE0; --amber: #C47B2B; --al: #FBF0E0; --gray: #6B7280; --border: #DDD8CE;
        }
        .db-main { padding: 26px 28px; background: #EDEAE3; display: flex; flex-direction: column; gap: 16px; min-height: 100vh; }
        .db-card { background: white; border: 1px solid var(--border); border-radius: 13px; padding: 20px; }
        .db-card-title { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--gray); margin-bottom: 14px; }
        .db-grid-3 { display: grid; gap: 14px; grid-template-columns: 2fr 1.1fr 1fr; }
        .db-btn-green { background: #1B4332; color: white; border: none; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 600; padding: 9px 18px; border-radius: 7px; cursor: pointer; }
        .db-btn-dark { background: #111310; color: white; border: none; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 600; padding: 9px 18px; border-radius: 7px; cursor: pointer; }
        .db-btn-outline { background: transparent; border: 1.5px solid var(--border); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 500; padding: 7px 13px; border-radius: 7px; cursor: pointer; color: var(--gray); }
        .db-task-row { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 9px; border: 1px solid var(--border); margin-bottom: 7px; }
        .db-task-row:last-child { margin-bottom: 0; }
        .db-task-row.done { opacity: .42; }
        .db-cb { width: 18px; height: 18px; border-radius: 5px; border: 2px solid var(--border); min-width: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; }
        .db-task-row.done .db-cb { background: #1B4332; border-color: #1B4332; color: white; }
        .db-task-name { font-size: 13px; font-weight: 500; color: var(--dark); margin-bottom: 1px; }
        .db-task-row.done .db-task-name { text-decoration: line-through; color: var(--gray); }
        .db-task-sub { font-size: 11px; color: var(--gray); }
        .db-badge-u { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 20px; white-space: nowrap; background: #FEE2E2; color: #B91C1C; }
        .db-badge-n { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 20px; white-space: nowrap; background: var(--gl); color: var(--green); }
        .db-badge-ok { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 20px; white-space: nowrap; background: #F3F4F6; color: var(--gray); }
        .db-mbr { display: flex; align-items: center; gap: 8px; font-size: 11.5px; margin-bottom: 7px; }
        .db-mbl { width: 68px; color: var(--gray); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
        .db-mbt { flex: 1; height: 5px; background: #F0EDE6; border-radius: 20px; overflow: hidden; }
        .db-mbf { height: 100%; border-radius: 20px; }
        .db-mbp { width: 26px; text-align: right; font-weight: 600; font-size: 11.5px; }
        .db-ecard { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 9px; border: 1px solid var(--border); margin-bottom: 7px; }
        .db-ecb { width: 3px; min-width: 3px; height: 32px; border-radius: 3px; }
        .db-ec-name { font-size: 13px; font-weight: 500; color: var(--dark); }
        .db-ec-date { font-size: 11px; color: var(--gray); }
        .db-ec-days { margin-left: auto; font-size: 11.5px; font-weight: 700; color: var(--amber); white-space: nowrap; }
        @media (max-width: 900px) { .db-grid-3 { grid-template-columns: 1fr; } }
      `}</style>

      <div className="db-main">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 500, color: '#111310' }}>
              {todayLabelCap} — ta journée
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--gray)', marginTop: 3 }}>
              {totalDueToday > 0
                ? <>MedRev a sélectionné <strong style={{ color: '#111310' }}>{totalDueToday} révisions</strong> pour aujourd&apos;hui</>
                : 'Rien à réviser aujourd\'hui 🎉 — ajoute des fiches pour commencer'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/dashboard/fiches" className="db-btn-dark" style={{ textDecoration: 'none', fontSize: 12 }}>
              + Importer un cours
            </Link>
          </div>
        </div>

        {/* Main grid */}
        <div className="db-grid-3">

          {/* Priorités du jour */}
          <div className="db-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="db-card-title" style={{ marginBottom: 0 }}>Priorités du jour</div>
              <button className="db-btn-outline" style={{ fontSize: 11 }}>
                File d&apos;attente ({totalDueToday})
              </button>
            </div>

            <div style={{ background: '#FAFAF8', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 13px', marginBottom: 13, fontSize: '11.5px', color: 'var(--gray)', lineHeight: 1.5 }}>
              Sélectionnées selon le <strong style={{ color: '#111310' }}>retard de révision</strong>, la <strong style={{ color: '#111310' }}>proximité du partiel</strong> et la <strong style={{ color: '#111310' }}>difficulté passée</strong>
            </div>

            {prioritySessions.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--gray)', textAlign: 'center', padding: '20px 0' }}>
                Aucune révision due aujourd&apos;hui 🎉
              </p>
            )}

            {prioritySessions.map((l, i) => {
              const sys = systems.find(s => s.id === l.system_id)
              return (
                <div key={l.id} className="db-task-row">
                  <div className="db-cb"></div>
                  <div style={{ flex: 1 }}>
                    <div className="db-task-name">{l.name}</div>
                    <div className="db-task-sub">{sys?.name || 'Matière'}</div>
                  </div>
                  <span className={i === 0 ? 'db-badge-u' : 'db-badge-n'}>
                    {i === 0 ? 'Urgent' : 'À revoir'}
                  </span>
                </div>
              )
            })}

            {totalDueToday > 0 && (
              <div style={{ marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--border)' }}>
                <Link href="/dashboard/fiches" className="db-btn-green" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontSize: 13 }}>
                  Commencer la session →
                </Link>
              </div>
            )}

            {totalDueToday === 0 && systems.length === 0 && (
              <div style={{ marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--border)' }}>
                <Link href="/dashboard/fiches" className="db-btn-green" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontSize: 13 }}>
                  Créer ma première fiche →
                </Link>
              </div>
            )}
          </div>

          {/* Charge de la semaine + Maîtrise */}
          <div className="db-card">
            <div className="db-card-title">Charge de la semaine</div>

            {/* Bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 72, marginBottom: 8 }}>
              {weekLoad.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
                  <div style={{
                    width: '100%',
                    height: d.count > 0 ? Math.max(4, Math.round((d.count / maxLoad) * 72)) : 4,
                    background: d.isToday ? '#2D6A4F' : barColors[i],
                    borderRadius: '4px 4px 0 0',
                    opacity: d.isToday ? 1 : .45
                  }} />
                  <div style={{ fontSize: 9, color: d.isToday ? '#2D6A4F' : 'var(--gray)', fontWeight: d.isToday ? 700 : 400 }}>
                    {d.isToday ? 'Auj.' : d.day}
                  </div>
                  <div style={{ fontSize: 9, color: d.isToday ? '#2D6A4F' : 'var(--gray)', fontWeight: d.isToday ? 700 : 400 }}>
                    {d.count}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'var(--gray)', borderTop: '1px solid var(--border)', paddingTop: 9, marginBottom: 14 }}>
              Total semaine : <strong style={{ color: '#111310' }}>{totalWeek} cartes</strong>
            </div>

            <div className="db-card-title" style={{ marginBottom: 10 }}>Maîtrise par matière</div>

            {masteryBySubject.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--gray)' }}>Ajoute des fiches pour voir ta progression</p>
            )}

            {masteryBySubject.map((s, i) => (
              <div key={s.name} className="db-mbr">
                <span className="db-mbl">{s.icon} {s.name}</span>
                <div className="db-mbt">
                  <div className="db-mbf" style={{ width: `${s.pct}%`, background: barColors[i % barColors.length] }} />
                </div>
                <span className="db-mbp">{s.pct}%</span>
              </div>
            ))}
          </div>

          {/* Prochains partiels + Coach */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="db-card">
              <div className="db-card-title">Accès rapide</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Link href="/dashboard/fiches" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)', textDecoration: 'none', fontSize: 13, fontWeight: 500, color: '#111310' }}>
                  <span>▤</span> Mes matières
                </Link>
                <Link href="/dashboard/calendar" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)', textDecoration: 'none', fontSize: 13, fontWeight: 500, color: '#111310' }}>
                  <span>▦</span> Calendrier
                  {totalDueToday > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#2D6A4F', color: 'white', borderRadius: 20, padding: '1px 7px' }}>
                      {totalDueToday}
                    </span>
                  )}
                </Link>
                <Link href="/dashboard/simulateur" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)', textDecoration: 'none', fontSize: 13, fontWeight: 500, color: '#111310' }}>
                  <span>▶</span> Simulateur
                </Link>
                <Link href="/dashboard/stats" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)', textDecoration: 'none', fontSize: 13, fontWeight: 500, color: '#111310' }}>
                  <span>◈</span> Statistiques
                </Link>
              </div>
            </div>

            {/* Coach card */}
            <div style={{ background: '#111310', borderRadius: 13, padding: 18, flex: 1 }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,.32)', marginBottom: 12 }}>
                Coach MedRev
              </div>
              {systems.length > 0 ? (
                <>
                  <p style={{ color: 'white', fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 400, lineHeight: 1.45, marginBottom: 12 }}>
                    Tu as <em style={{ color: '#86EFAC', fontStyle: 'italic' }}>{totalDueToday} révisions</em> prévues aujourd&apos;hui sur {systems.length} matière{systems.length > 1 ? 's' : ''}.
                  </p>
                  <Link href="/dashboard/fiches" className="db-btn-green" style={{ fontSize: 12, padding: '7px 14px', textDecoration: 'none', display: 'inline-block' }}>
                    Commencer →
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ color: 'white', fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 400, lineHeight: 1.45, marginBottom: 12 }}>
                    Importe ton premier cours pour que MedRev génère ton <em style={{ color: '#86EFAC', fontStyle: 'italic' }}>planning automatique.</em>
                  </p>
                  <Link href="/dashboard/fiches" className="db-btn-green" style={{ fontSize: 12, padding: '7px 14px', textDecoration: 'none', display: 'inline-block' }}>
                    Créer une fiche →
                  </Link>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
