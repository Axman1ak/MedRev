'use client'
// src/app/dashboard/stats/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, System, StepEntry } from '@/types'
import { doneCount, avgScore, scoreColor } from '@/types'

export default function StatsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [systems, setSystems] = useState<System[]>([])

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

  const total = lessons.length
  const started = lessons.filter(l => doneCount(l) > 0).length
  const totalDone = lessons.reduce((a, l) => a + doneCount(l), 0)
  const allScores = lessons.flatMap(l => (l.steps as (StepEntry | null)[]).filter(Boolean).map(s => (s as StepEntry).score))
  const globalAvg = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : null
  const aiCount = lessons.filter(l => l.ai_questions?.length > 0).length

  const stats = [
    { num: total, label: 'Fiches totales', color: 'var(--accent)' },
    { num: started, label: 'Démarrées', color: 'var(--accent2)' },
    { num: totalDone, label: 'Révisions notées', color: 'var(--accent3)' },
    { num: globalAvg ? `${globalAvg}/5` : '—', label: 'Score moyen global', color: 'var(--accent)' },
    { num: aiCount, label: 'Fiches avec QCM IA', color: 'var(--purple)' },
  ]

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 className="font-syne font-black text-2xl mb-6" style={{ color: 'var(--t1)' }}>
        Mes <span style={{ color: 'var(--accent)' }}>statistiques</span>
      </h1>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div className="font-syne font-black text-4xl" style={{ color: s.color, lineHeight: 1 }}>{s.num}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--t2)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress by subject */}
      <div>
        <div className="font-syne font-bold text-base mb-4" style={{ color: 'var(--t1)' }}>Score moyen par matière</div>
        {systems.length === 0 && <div className="text-sm" style={{ color: 'var(--t3)' }}>Aucune matière créée.</div>}
        {systems.map(s => {
          const sl = lessons.filter(l => l.system_id === s.id)
          const sc = sl.flatMap(l => (l.steps as (StepEntry | null)[]).filter(Boolean).map(x => (x as StepEntry).score))
          if (!sc.length) return null
          const avg = sc.reduce((a, b) => a + b, 0) / sc.length
          const pct = Math.round((avg / 5) * 100)
          return (
            <div key={s.id} className="flex items-center gap-3 mb-3">
              <div style={{ width: 150, fontSize: 13, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {s.icon} {s.name}
              </div>
              <div style={{ flex: 1, height: 8, background: 'var(--bg3)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 20, background: `linear-gradient(90deg, var(--accent), var(--accent2))`, transition: 'width .6s ease' }} />
              </div>
              <div style={{ width: 36, fontSize: 12, color: 'var(--t2)', textAlign: 'right' }}>{avg.toFixed(1)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
