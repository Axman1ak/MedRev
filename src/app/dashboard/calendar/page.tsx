'use client'
// src/app/dashboard/calendar/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
const MONTH_FULL_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// Color palette for systems (bg, text)
const SYS_COLORS: [string, string][] = [
  ['#D8EAE0', '#1B4332'],
  ['#DBEAFE', '#1D4ED8'],
  ['#FEF3C7', '#92400E'],
  ['#FCE7F3', '#9D174D'],
  ['#EDE9FE', '#6D28D9'],
  ['#D1FAE5', '#065F46'],
  ['#FEE2E2', '#991B1B'],
]

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function CalendarPage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState<'week' | 'month'>('week')

  const today = toDateStr(new Date())
  const monday = getMondayOfWeek(addDays(new Date(), weekOffset * 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const weekStart = toDateStr(weekDays[0])
  const weekEnd = toDateStr(weekDays[6])

  // Month view
  const monthDate = new Date()
  monthDate.setMonth(monthDate.getMonth() + Math.floor(weekOffset / 4))
  const currentMonth = monthDate.getMonth()
  const currentYear = monthDate.getFullYear()

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid),
    ])
    setSystems(sys || [])
    setLessons(les || [])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      load(user.id)
    })
  }, [])

  // Compute cards due on a given date, grouped by system
  function getCardsForDate(dateStr: string): { sys: System; count: number; color: [string, string] }[] {
    const result: Record<string, number> = {}
    lessons.forEach(l => {
      if (!l.learn_date) return
      const steps = l.steps as (null | object)[]
      J.forEach((off, i) => {
        const d = new Date(l.learn_date + 'T12:00:00')
        d.setDate(d.getDate() + off)
        if (toDateStr(d) === dateStr && !steps[i]) {
          result[l.system_id] = (result[l.system_id] || 0) + 1
        }
      })
    })
    return Object.entries(result)
      .map(([sysId, count]) => {
        const sys = systems.find(s => s.id === sysId)
        if (!sys) return null
        const colorIdx = systems.indexOf(sys) % SYS_COLORS.length
        return { sys, count, color: SYS_COLORS[colorIdx] }
      })
      .filter(Boolean) as { sys: System; count: number; color: [string, string] }[]
  }

  function getTotalForDate(dateStr: string): number {
    let count = 0
    lessons.forEach(l => {
      if (!l.learn_date) return
      const steps = l.steps as (null | object)[]
      J.forEach((off, i) => {
        const d = new Date(l.learn_date + 'T12:00:00')
        d.setDate(d.getDate() + off)
        if (toDateStr(d) === dateStr && !steps[i]) count++
      })
    })
    return count
  }

  const totalWeek = weekDays.reduce((acc, d) => acc + getTotalForDate(toDateStr(d)), 0)

  // Week label
  const weekLabel = (() => {
    const s = weekDays[0]
    const e = weekDays[6]
    const sm = MONTH_FULL_FR[s.getMonth()]
    const em = MONTH_FULL_FR[e.getMonth()]
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} au ${e.getDate()} ${sm} ${e.getFullYear()}`
    }
    return `${s.getDate()} ${sm} au ${e.getDate()} ${em} ${e.getFullYear()}`
  })()

  // Month grid data
  function getMonthDays() {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    // Start from Monday
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const days: (Date | null)[] = Array(startPad).fill(null)
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(currentYear, currentMonth, i))
    }
    // Pad to complete last week
    while (days.length % 7 !== 0) days.push(null)
    return days
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
        :root {
          --dark:#111310; --green:#1B4332; --gm:#2D6A4F; --gl:#D8EAE0;
          --amber:#C47B2B; --al:#FBF0E0; --gray:#6B7280; --border:#DDD8CE;
        }
        .cal-main { padding: 26px 28px; background: #EDEAE3; min-height: 100vh; display: flex; flex-direction: column; gap: 16px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .cal-card { background: white; border: 1px solid var(--border); border-radius: 13px; }
        .cal-btn-d { background: #111310; color: white; border: none; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 600; padding: 9px 18px; border-radius: 7px; cursor: pointer; }
        .cal-btn-o { background: transparent; border: 1.5px solid var(--border); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 500; padding: 7px 9px; border-radius: 7px; cursor: pointer; color: var(--gray); line-height: 1; transition: all .15s; }
        .cal-btn-o:hover { border-color: #aaa; color: #333; }
        .cal-pill { font-size: 10.5px; font-weight: 500; padding: 4px 7px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cal-ct { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--gray); margin-bottom: 14px; }
        .cal-ai { display: flex; gap: 10px; padding: 11px; border-radius: 9px; border: 1px solid var(--border); background: #FAFAF8; margin-bottom: 8px; }
        .cal-ai:last-child { margin-bottom: 0; }

        /* Month grid */
        .cal-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
        .cal-month-cell { border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 7px 8px; min-height: 72px; }
        .cal-month-cell:nth-child(7n) { border-right: none; }
        .cal-month-header-cell { padding: 8px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--gray); background: #FAFAF8; border-right: 1px solid var(--border); border-bottom: 2px solid var(--border); }
        .cal-month-header-cell:last-child { border-right: none; }
      `}</style>

      <div className="cal-main">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 500, color: '#111310' }}>
              {view === 'week'
                ? `Semaine du ${weekLabel}`
                : `${MONTH_FULL_FR[currentMonth].charAt(0).toUpperCase() + MONTH_FULL_FR[currentMonth].slice(1)} ${currentYear}`
              }
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--gray)', marginTop: 3 }}>
              {view === 'week' && totalWeek > 0
                ? <>{totalWeek} carte{totalWeek > 1 ? 's' : ''} planifiée{totalWeek > 1 ? 's' : ''} cette semaine</>
                : view === 'week' ? 'Aucune révision planifiée cette semaine'
                : 'Vue mensuelle'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setView('week')}
                style={{
                  padding: '7px 14px', fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: view === 'week' ? '#111310' : 'white',
                  color: view === 'week' ? 'white' : 'var(--gray)'
                }}
              >Semaine</button>
              <button
                onClick={() => setView('month')}
                style={{
                  padding: '7px 14px', fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: view === 'month' ? '#111310' : 'white',
                  color: view === 'month' ? 'white' : 'var(--gray)'
                }}
              >Mois</button>
            </div>
            {/* Navigation */}
            <button className="cal-btn-o" onClick={() => setWeekOffset(w => w - 1)}>‹</button>
            <button
              className="cal-btn-o"
              onClick={() => setWeekOffset(0)}
              style={{ fontSize: 11, padding: '5px 10px' }}
            >
              Aujourd&apos;hui
            </button>
            <button className="cal-btn-o" onClick={() => setWeekOffset(w => w + 1)}>›</button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, flex: 1 }}>

          {/* ---- WEEK VIEW ---- */}
          {view === 'week' && (
            <div className="cal-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid var(--border)' }}>
                {weekDays.map((day, i) => {
                  const dateStr = toDateStr(day)
                  const isToday = dateStr === today
                  const total = getTotalForDate(dateStr)
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '10px 8px', textAlign: 'center',
                        borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                        background: isToday ? '#F0F7F3' : 'white'
                      }}
                    >
                      <div style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: isToday ? '#1B4332' : 'var(--gray)' }}>
                        {isToday ? 'Auj.' : DAY_LABELS[i]}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: isToday ? 700 : 500, color: isToday ? '#1B4332' : 'var(--gray)', margin: '3px 0' }}>
                        {day.getDate()}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: isToday ? 600 : 400, color: isToday ? '#1B4332' : 'var(--gray)' }}>
                        {total > 0 ? `${total} carte${total > 1 ? 's' : ''}` : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Day bodies */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
                {weekDays.map((day, i) => {
                  const dateStr = toDateStr(day)
                  const isToday = dateStr === today
                  const isPast = dateStr < today
                  const cards = getCardsForDate(dateStr)
                  return (
                    <div
                      key={i}
                      style={{
                        borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                        padding: 8,
                        display: 'flex', flexDirection: 'column', gap: 4,
                        background: isToday ? '#F0F7F3' : 'white',
                        minHeight: 120,
                        opacity: isPast && !isToday ? 0.65 : 1
                      }}
                    >
                      {cards.length === 0 && (
                        <div style={{ fontSize: 10, color: '#D1CFC9', textAlign: 'center', marginTop: 16 }}>—</div>
                      )}
                      {cards.map(({ sys, count, color }) => (
                        <div
                          key={sys.id}
                          className="cal-pill"
                          style={{
                            background: color[0], color: color[1],
                            border: isToday && count > 10 ? `1.5px solid ${color[1]}40` : 'none',
                            fontWeight: isToday ? 700 : 500,
                          }}
                        >
                          {sys.name} · {count}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>

              {/* Footer totals */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '2px solid var(--border)', background: '#FAFAF8' }}>
                {weekDays.map((day, i) => {
                  const dateStr = toDateStr(day)
                  const isToday = dateStr === today
                  const isPast = dateStr < today
                  const total = getTotalForDate(dateStr)
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '7px 8px', borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                        textAlign: 'center',
                        background: isToday ? '#F0F7F3' : '#FAFAF8'
                      }}
                    >
                      {total === 0 ? (
                        <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>✓</div>
                      ) : isPast ? (
                        <>
                          <div style={{ fontSize: '9.5px', color: 'var(--gray)' }}>Passé</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>{total}</div>
                        </>
                      ) : isToday ? (
                        <>
                          <div style={{ fontSize: '9.5px', color: '#1B4332', fontWeight: 600 }}>En cours</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4332' }}>{total}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '9.5px', color: 'var(--gray)' }}>Prévu</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray)' }}>{total}</div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ---- MONTH VIEW ---- */}
          {view === 'month' && (
            <div className="cal-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Day name headers */}
              <div className="cal-month-grid">
                {DAY_LABELS.map(d => (
                  <div key={d} className="cal-month-header-cell">{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="cal-month-grid">
                {getMonthDays().map((day, i) => {
                  if (!day) return (
                    <div key={i} className="cal-month-cell" style={{ background: '#FAFAF8' }} />
                  )
                  const dateStr = toDateStr(day)
                  const isToday = dateStr === today
                  const cards = getCardsForDate(dateStr)
                  const total = getTotalForDate(dateStr)
                  return (
                    <div
                      key={i}
                      className="cal-month-cell"
                      style={{ background: isToday ? '#F0F7F3' : 'white' }}
                    >
                      <div style={{
                        fontSize: 12, fontWeight: isToday ? 700 : 400,
                        color: isToday ? '#1B4332' : '#111310',
                        marginBottom: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <span>{day.getDate()}</span>
                        {total > 0 && (
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            background: isToday ? '#1B4332' : '#E5E0D8',
                            color: isToday ? 'white' : 'var(--gray)',
                            borderRadius: 20, padding: '1px 5px'
                          }}>{total}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {cards.slice(0, 2).map(({ sys, color }) => (
                          <div key={sys.id} style={{
                            fontSize: 9, padding: '2px 5px', borderRadius: 3,
                            background: color[0], color: color[1], fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {sys.name}
                          </div>
                        ))}
                        {cards.length > 2 && (
                          <div style={{ fontSize: 9, color: 'var(--gray)' }}>+{cards.length - 2} de plus</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* À venir */}
            <div className="cal-card" style={{ padding: 20 }}>
              <div className="cal-ct">À venir</div>
              {/* Upcoming high-load days */}
              {(() => {
                // Find next 3 days with cards due in the next 30 days
                const upcoming: { dateStr: string; total: number }[] = []
                for (let i = 1; i <= 30 && upcoming.length < 3; i++) {
                  const d = addDays(new Date(), i)
                  const dateStr = toDateStr(d)
                  const total = getTotalForDate(dateStr)
                  if (total > 0) upcoming.push({ dateStr, total })
                }
                if (upcoming.length === 0) {
                  return (
                    <p style={{ fontSize: 12, color: 'var(--gray)', lineHeight: 1.5 }}>
                      Aucune révision prévue dans les 30 prochains jours.
                    </p>
                  )
                }
                return upcoming.map(({ dateStr, total }) => {
                  const d = new Date(dateStr + 'T12:00:00')
                  const cards = getCardsForDate(dateStr)
                  const topSys = cards[0]
                  return (
                    <div key={dateStr} className="cal-ai">
                      <div style={{ textAlign: 'center', minWidth: 34 }}>
                        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 500, color: '#111310', lineHeight: 1 }}>
                          {d.getDate()}
                        </div>
                        <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--gray)', fontWeight: 600 }}>
                          {MONTH_FR[d.getMonth()]}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '12.5px', fontWeight: 600, color: '#111310', marginBottom: 2 }}>
                          {total} carte{total > 1 ? 's' : ''} à réviser
                        </h4>
                        <p style={{ fontSize: 11, color: 'var(--gray)' }}>
                          {cards.map(c => c.sys.name).join(', ')}
                        </p>
                        {topSys && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                            marginTop: 4, display: 'inline-block',
                            background: topSys.color[0], color: topSys.color[1]
                          }}>
                            {topSys.sys.name}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Légende */}
            {systems.length > 0 && (
              <div className="cal-card" style={{ padding: 20 }}>
                <div className="cal-ct">Légende</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {systems.map((sys, i) => {
                    const [bg] = SYS_COLORS[i % SYS_COLORS.length]
                    return (
                      <div key={sys.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--gray)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: bg, minWidth: 10 }} />
                        {sys.icon} {sys.name}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state for no lessons */}
            {lessons.length === 0 && (
              <div className="cal-card" style={{ padding: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--gray)', lineHeight: 1.6 }}>
                  Ajoute des fiches dans<br />
                  <strong style={{ color: '#111310' }}>Mes matières</strong><br />
                  pour voir ton planning ici.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
