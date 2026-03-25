'use client'
// src/app/dashboard/calendar/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, System, StepEntry } from '@/types'
import { J_STEPS, jLabel, addDays, fmtDate, todayStr, scoreColor } from '@/types'

export default function CalendarPage() {
  const supabase = createClient()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [systems, setSystems] = useState<System[]>([])
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      Promise.all([
        supabase.from('lessons').select('*').eq('user_id', user.id),
        supabase.from('systems').select('*').eq('user_id', user.id),
      ]).then(([{ data: les }, { data: sys }]) => {
        setLessons(les || [])
        setSystems(sys || [])
      })
    })
  }, [])

  function getWeekDates(off: number): string[] {
    const now = new Date()
    const day = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + off * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }

  const dates = getWeekDates(weekOffset)
  const t = todayStr()
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  // Build date map
  const map: Record<string, Array<{ lesson: Lesson; stepIdx: number; step: StepEntry | null; late: boolean }>> = {}
  lessons.forEach(l => {
    if (!l.learn_date) return
    const sys = systems.find(s => s.id === l.system_id)
    if (sys?.cal_hidden) return
    J_STEPS.forEach((off, i) => {
      const ds = addDays(l.learn_date!, off)
      if (!map[ds]) map[ds] = []
      const step = l.steps[i] as StepEntry | null
      map[ds].push({ lesson: l, stepIdx: i, step, late: !step && ds < t && i > 0 })
    })
  })

  const weekStart = new Date(dates[0] + 'T12:00:00')
  const weekEnd = new Date(dates[6] + 'T12:00:00')
  const weekLabel = `${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-syne font-black text-2xl" style={{ color: 'var(--t1)' }}>
          Calendrier de <span style={{ color: 'var(--accent)' }}>révision</span>
        </h1>
        <div className="text-xs" style={{ color: 'var(--t2)' }}>
          <span style={{ color: 'var(--t3)' }}>●</span> Non fait &nbsp;
          <span style={{ color: 'var(--accent)' }}>●</span> Planifiée &nbsp;
          <span style={{ color: 'var(--accent2)' }}>●</span> Faite
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => setWeekOffset(w => w - 1)} className="btn btn-ghost btn-sm">← Préc.</button>
        <span className="font-syne font-bold text-base" style={{ color: 'var(--t1)' }}>{weekLabel}</span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="btn btn-ghost btn-sm">Suiv. →</button>
        <button onClick={() => setWeekOffset(0)} className="btn btn-ghost btn-sm">Aujourd'hui</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
        {dates.map((ds, di) => {
          const isToday = ds === t
          const dNum = new Date(ds + 'T12:00:00').getDate()
          const entries = map[ds] || []

          return (
            <div key={ds} style={{ background: 'var(--card)', border: `1px solid ${isToday ? 'rgba(79,142,247,.3)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', minHeight: 160 }}>
              <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', background: isToday ? 'rgba(79,142,247,.12)' : 'var(--bg3)' }}>
                <div className="font-syne font-bold text-xs uppercase" style={{ color: 'var(--t3)', letterSpacing: '0.08em' }}>{DAYS[di]}</div>
                <div className="font-bold text-lg" style={{ color: isToday ? 'var(--accent)' : 'var(--t1)', marginTop: 2 }}>{dNum}</div>
              </div>
              <div style={{ padding: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entries.length === 0 && <div className="text-xs text-center" style={{ color: 'var(--t3)', padding: 10 }}>—</div>}
                {entries.map((x, xi) => {
                  const jlbl = jLabel(x.stepIdx)
                  if (x.step) {
                    const col = scoreColor(x.step.score)
                    return (
                      <div key={xi} onClick={() => router.push(`/dashboard/lesson/${x.lesson.id}`)}
                        style={{ padding: '6px 8px', borderRadius: 7, fontSize: 12, background: col + '15', border: `1px solid ${col}40`, color: col, textDecoration: 'line-through', opacity: 0.75, cursor: 'pointer', lineHeight: 1.3 }}>
                        <div className="font-semibold truncate">{x.lesson.name.replace(/\s*-\s*.*/, '')}</div>
                        <div style={{ fontSize: 10, opacity: 0.85 }}>{jlbl} · {x.step.score}/5</div>
                      </div>
                    )
                  } else if (x.late) {
                    return (
                      <div key={xi} onClick={() => router.push(`/dashboard/lesson/${x.lesson.id}`)}
                        style={{ padding: '6px 8px', borderRadius: 7, fontSize: 12, background: 'rgba(74,82,104,.18)', border: '1px solid rgba(74,82,104,.4)', color: 'var(--t3)', cursor: 'pointer', lineHeight: 1.3 }}>
                        <div className="font-semibold truncate">{x.lesson.name.replace(/\s*-\s*.*/, '')}</div>
                        <div style={{ fontSize: 10 }}>{jlbl} · Non fait</div>
                      </div>
                    )
                  } else {
                    return (
                      <div key={xi} onClick={() => router.push(`/dashboard/lesson/${x.lesson.id}`)}
                        style={{ padding: '6px 8px', borderRadius: 7, fontSize: 12, background: isToday ? 'rgba(79,142,247,.15)' : 'rgba(79,142,247,.07)', border: `1px solid ${isToday ? 'rgba(79,142,247,.45)' : 'rgba(79,142,247,.22)'}`, color: 'var(--accent)', cursor: 'pointer', lineHeight: 1.3 }}>
                        <div className="font-semibold truncate">{x.lesson.name.replace(/\s*-\s*.*/, '')}</div>
                        <div style={{ fontSize: 10 }}>{jlbl}{isToday ? ' · Aujourd\'hui' : ''}</div>
                      </div>
                    )
                  }
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
