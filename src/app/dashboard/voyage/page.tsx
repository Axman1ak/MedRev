'use client'
// src/app/dashboard/voyage/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, System } from '@/types'

interface VoyageCheck { lesson_id: string; passes: number }

export default function VoyagePage() {
  const supabase = createClient()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [systems, setSystems] = useState<System[]>([])
  const [checks, setChecks] = useState<Record<string, number>>({})
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      Promise.all([
        supabase.from('lessons').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('systems').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('voyage_checks').select('*').eq('user_id', user.id),
      ]).then(([{ data: les }, { data: sys }, { data: vc }]) => {
        setLessons(les || [])
        setSystems(sys || [])
        const map: Record<string, number> = {}
        ;(vc || []).forEach((v: VoyageCheck) => { map[v.lesson_id] = v.passes })
        setChecks(map)
      })
    })
  }, [])

  async function toggle(lessonId: string, pass: 1 | 2) {
    if (!userId) return
    const cur = checks[lessonId] || 0
    let next = cur
    if (pass === 1) { next = cur === 0 ? 1 : cur === 1 ? 0 : cur }
    else { if (cur >= 1) next = cur === 2 ? 1 : 2 }

    setChecks(prev => ({ ...prev, [lessonId]: next }))

    // Upsert in Supabase
    await supabase.from('voyage_checks').upsert({
      user_id: userId,
      lesson_id: lessonId,
      passes: next,
    }, { onConflict: 'user_id,lesson_id' })
  }

  async function resetVoyage() {
    if (!userId || !confirm('Réinitialiser tous les passages du voyage ?')) return
    await supabase.from('voyage_checks').delete().eq('user_id', userId)
    setChecks({})
  }

  const total = lessons.length
  const done1 = Object.values(checks).filter(v => v >= 1).length
  const done2 = Object.values(checks).filter(v => v === 2).length

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-syne font-black text-2xl" style={{ color: 'var(--t1)' }}>
            Voyage de <span style={{ color: 'var(--accent)' }}>révision</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>Coche chaque fiche révisée · max 2 passages</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-syne font-bold text-sm" style={{ color: 'var(--accent)' }}>
            {done1}/{total} révisées · {done2} × 2 passages
          </span>
          <button onClick={resetVoyage} className="btn btn-ghost btn-sm">Réinitialiser</button>
        </div>
      </div>

      {lessons.length === 0 && (
        <div className="text-center text-sm" style={{ color: 'var(--t3)', padding: 40 }}>Aucune fiche trouvée.</div>
      )}

      {systems.map(s => {
        const sl = lessons.filter(l => l.system_id === s.id)
        if (!sl.length) return null
        const sDone = sl.filter(l => (checks[l.id] || 0) >= 1).length
        return (
          <div key={s.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--bg3)', borderRadius: 10, marginBottom: 8, border: '1px solid var(--border)' }}>
              <div className="font-syne font-bold text-sm flex items-center gap-2" style={{ color: 'var(--t1)' }}>
                <span>{s.icon}</span>{s.name}
              </div>
              <div className="text-xs" style={{ color: 'var(--t2)' }}>{sDone} / {sl.length}</div>
            </div>
            {sl.map(l => {
              const p = checks[l.id] || 0
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 5, opacity: p === 2 ? 0.5 : 1, transition: 'all .2s' }}>
                  <div className="text-sm flex-1" style={{ color: 'var(--t1)', lineHeight: 1.3 }}>{l.name}</div>
                  <div className="flex gap-2">
                    {([1, 2] as const).map(pass => {
                      const done = pass === 1 ? p >= 1 : p === 2
                      const disabled = pass === 2 && p < 1
                      return (
                        <div key={pass} onClick={() => !disabled && toggle(l.id, pass)}
                          style={{ width: 26, height: 26, borderRadius: 7, border: `2px solid ${done ? (pass === 1 ? 'var(--accent2)' : 'var(--accent3)') : 'var(--border)'}`, background: done ? (pass === 1 ? 'var(--accent2)' : 'var(--accent3)') : 'var(--bg3)', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: done ? '#0d0f14' : 'var(--t3)', fontWeight: 700, opacity: disabled ? 0.3 : 1, transition: 'all .15s' }}>
                          {done ? '✓' : pass}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
