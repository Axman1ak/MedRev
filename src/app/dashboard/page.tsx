'use client'
// src/app/dashboard/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import { J_STEPS, FREE_LIMIT, jLabel, stepDate, doneCount, avgScore, fmtDate, todayStr, scoreColor } from '@/types'
import LessonModal from '@/components/LessonModal'
import SystemModal from '@/components/SystemModal'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [activeSystem, setActiveSystem] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'notstarted' | 'inprogress'>('all')
  const [search, setSearch] = useState('')
  const [showLessonModal, setShowLessonModal] = useState(false)
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [showSysModal, setShowSysModal] = useState(false)
  const [editSystem, setEditSystem] = useState<System | null>(null)

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
    ])
    setSystems(sys || [])
    setLessons(les || [])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      supabase.from('profiles').select('plan').eq('id', user.id).single()
        .then(({ data }) => setIsPro(data?.plan === 'pro'))
      load(user.id)
    })
  }, [])

  // Wire up import/export buttons in layout
  useEffect(() => {
    const expBtn = document.getElementById('trigger-export')
    const impBtn = document.getElementById('trigger-import')
    if (expBtn) expBtn.onclick = exportData
    if (impBtn) impBtn.onclick = () => document.getElementById('import-input')?.click()
  }, [lessons, systems])

  function exportData() {
    const blob = new Blob([JSON.stringify({ systems, lessons }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `medrev_backup_${todayStr()}.json`
    a.click()
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !userId) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const d = JSON.parse(ev.target?.result as string)
        if (!d.systems || !d.lessons) throw new Error()
        // Upsert into Supabase
        await supabase.from('systems').upsert(d.systems.map((s: System) => ({ ...s, user_id: userId })))
        await supabase.from('lessons').upsert(d.lessons.map((l: Lesson) => ({ ...l, user_id: userId })))
        load(userId)
        toast(`✅ Importé — ${d.lessons.length} fiches`)
      } catch { toast('❌ Fichier invalide') }
    }
    reader.readAsText(file)
  }

  function toast(msg: string) {
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = msg
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 18px;font-size:14px;z-index:300;animation:mIn .3s ease;box-shadow:0 4px 24px rgba(0,0,0,.4)'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2500)
  }

  // Filtered lessons
  const displayed = lessons
    .filter(l => !activeSystem || l.system_id === activeSystem)
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))
    .filter(l => {
      if (filter === 'notstarted') return doneCount(l) === 0
      if (filter === 'inprogress') return doneCount(l) > 0
      return true
    })

  const pageTitle = activeSystem
    ? (() => { const s = systems.find(x => x.id === activeSystem); return s ? `${s.icon} ${s.name}` : '' })()
    : 'Toutes les fiches'

  function cardScoreClass(l: Lesson) {
    const a = avgScore(l)
    if (a === null) return 'sc-none'
    if (a < 2.5) return 'sc-low'
    if (a < 3.8) return 'sc-mid'
    return 'sc-high'
  }

  function openAddLesson() {
    if (!isPro && lessons.length >= FREE_LIMIT) {
      router.push('/dashboard/pricing')
      return
    }
    setEditLesson(null)
    setShowLessonModal(true)
  }

  async function deleteLesson(id: string) {
    if (!confirm('Supprimer cette fiche ?') || !userId) return
    await supabase.from('lessons').delete().eq('id', id)
    setLessons(prev => prev.filter(l => l.id !== id))
  }

  async function deleteSystem(id: string) {
    if (!userId) return
    const cnt = lessons.filter(l => l.system_id === id).length
    if (cnt > 0 && !confirm(`Cette matière contient ${cnt} fiche(s). Supprimer quand même ?`)) return
    await supabase.from('systems').delete().eq('id', id)
    setSystems(prev => prev.filter(s => s.id !== id))
    setLessons(prev => prev.filter(l => l.system_id !== id))
    if (activeSystem === id) setActiveSystem(null)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>

      {/* Subject sidebar */}
      <aside style={{ width: 200, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <div className="text-xs font-bold uppercase mb-1" style={{ padding: '0 10px', color: 'var(--t3)', fontFamily: 'Syne', letterSpacing: '0.1em' }}>Matières</div>

        {/* All */}
        <div onClick={() => setActiveSystem(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: !activeSystem ? 'rgba(79,142,247,.1)' : 'transparent', color: !activeSystem ? 'var(--accent)' : 'var(--t3)', fontSize: 13, transition: 'all .15s' }}>
          <span>📋</span><span style={{ flex: 1 }}>Toutes</span>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{lessons.length}</span>
        </div>

        {systems.map(s => {
          const cnt = lessons.filter(l => l.system_id === s.id).length
          return (
            <div key={s.id} onClick={() => setActiveSystem(s.id)}
              className="group"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: activeSystem === s.id ? 'rgba(79,142,247,.1)' : 'transparent', color: activeSystem === s.id ? 'var(--accent)' : 'var(--t3)', fontSize: 13, transition: 'all .15s', position: 'relative' }}>
              <span>{s.icon}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span style={{ fontSize: 11 }}>{cnt}</span>
              <button onClick={e => { e.stopPropagation(); setEditSystem(s); setShowSysModal(true) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t3)', opacity: 0, padding: '2px 4px', borderRadius: 4, position: 'absolute', right: 4 }}
                className="transition-opacity">⚙️</button>
            </div>
          )
        })}
        <button onClick={() => { setEditSystem(null); setShowSysModal(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginTop: 4, borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--t3)', fontSize: 13, cursor: 'pointer', transition: 'all .2s', width: '100%' }}
          className="hover:border-accent hover:text-accent">
          ＋ Ajouter
        </button>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
        <input type="file" id="import-input" accept=".json" style={{ display: 'none' }} onChange={importData} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="font-syne font-black text-2xl" style={{ color: 'var(--t1)' }}>
            {activeSystem
              ? <>{systems.find(s => s.id === activeSystem)?.icon} <span style={{ color: 'var(--accent)' }}>{systems.find(s => s.id === activeSystem)?.name}</span></>
              : <>Toutes les <span style={{ color: 'var(--accent)' }}>fiches</span></>
            }
          </h1>
          <button onClick={openAddLesson} className="btn btn-primary">＋ Nouvelle fiche</button>
        </div>

        {/* Search + filters */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔍</span>
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Rechercher une fiche..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap mb-5">
          {(['all', 'notstarted', 'inprogress'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="btn btn-sm"
              style={{ border: '1px solid var(--border)', background: filter === f ? 'var(--card)' : 'transparent', color: filter === f ? 'var(--t1)' : 'var(--t2)', borderColor: filter === f ? 'var(--accent)' : 'var(--border)' }}>
              {{ all: 'Toutes', notstarted: 'Non démarrées', inprogress: 'En cours' }[f]}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {systems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <div className="font-syne font-bold text-lg mb-2" style={{ color: 'var(--t2)' }}>Commencez par créer une matière</div>
            <p className="text-sm mb-6" style={{ color: 'var(--t3)' }}>Cliquez sur "＋ Ajouter" dans la colonne de gauche pour créer votre première matière, puis ajoutez vos fiches de cours.</p>
            <button onClick={() => { setEditSystem(null); setShowSysModal(true) }} className="btn btn-primary">＋ Créer ma première matière</button>
          </div>
        )}

        {/* Grid */}
        {systems.length > 0 && displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
            <div>Aucune fiche trouvée.</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {displayed.map(l => {
            const sys = systems.find(s => s.id === l.system_id)
            const done = doneCount(l)
            const hasAi = l.ai_questions?.length > 0
            const t = todayStr()

            // Mini bar chart
            const bars = J_STEPS.map((_, i) => {
              const step = l.steps[i]
              const ds = stepDate(l, i)
              const isFuture = ds && ds > t && i > 0
              if (step) {
                const col = scoreColor(step.score)
                const h = Math.round((step.score / 5) * 34) + 4
                return <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', height: h, background: col, borderRadius: '3px 3px 0 0', minHeight: 2 }} />
                  <span style={{ fontSize: 8, color: col, lineHeight: 1 }}>{step.score}</span>
                </div>
              }
              return <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', height: 30, background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: '3px 3px 0 0', opacity: isFuture ? 0.3 : 0.7 }} />
                <span style={{ fontSize: 7, color: 'var(--t3)', lineHeight: 1 }}>{jLabel(i)}</span>
              </div>
            })

            return (
              <div key={l.id}
                onClick={() => router.push(`/dashboard/lesson/${l.id}`)}
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all .25s' }}
                className={`hover:-translate-y-0.5 hover:shadow-lg lesson-card-${cardScoreClass(l)}`}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,142,247,.4)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>

                {/* Score stripe */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: { 'sc-none': 'var(--t3)', 'sc-low': 'var(--danger)', 'sc-mid': 'var(--accent3)', 'sc-high': 'var(--accent2)' }[cardScoreClass(l)] }} />

                <div className="flex items-start justify-between gap-2" style={{ paddingLeft: 8 }}>
                  <div className="font-syne font-bold text-sm leading-snug" style={{ color: 'var(--t1)' }}>{l.name}</div>
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditLesson(l); setShowLessonModal(true) }} className="icon-btn" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg3)', color: 'var(--t2)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                    <button onClick={() => deleteLesson(l.id)} className="icon-btn" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg3)', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap" style={{ paddingLeft: 8 }}>
                  {sys && <span className="badge badge-sys">{sys.icon} {sys.name}</span>}
                  <span className="badge badge-done">{done}/14</span>
                  {hasAi && <span className="badge badge-ai">✨ {l.ai_questions.length} QCM</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, marginTop: 2, paddingLeft: 8 }}>
                  {bars}
                </div>

                <div className="text-xs" style={{ color: 'var(--t3)', paddingLeft: 8 }}>
                  {l.learn_date ? `📖 J0 : ${fmtDate(l.learn_date)}` : <span style={{ color: 'var(--t3)' }}>Pas de J0 défini</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {showLessonModal && (
        <LessonModal
          lesson={editLesson}
          systems={systems}
          defaultSystemId={activeSystem}
          userId={userId!}
          onClose={() => setShowLessonModal(false)}
          onSave={async (data) => {
            if (editLesson) {
              const { data: updated } = await supabase.from('lessons').update(data).eq('id', editLesson.id).select().single()
              if (updated) setLessons(prev => prev.map(l => l.id === editLesson.id ? updated : l))
            } else {
              const { data: created } = await supabase.from('lessons').insert({ ...data, user_id: userId, steps: new Array(14).fill(null), ai_questions: [] }).select().single()
              if (created) setLessons(prev => [...prev, created])
            }
            setShowLessonModal(false)
          }}
        />
      )}
      {showSysModal && (
        <SystemModal
          system={editSystem}
          userId={userId!}
          lessonCount={editSystem ? lessons.filter(l => l.system_id === editSystem.id).length : 0}
          onClose={() => setShowSysModal(false)}
          onSave={async (data) => {
            if (editSystem) {
              const { data: updated } = await supabase.from('systems').update(data).eq('id', editSystem.id).select().single()
              if (updated) setSystems(prev => prev.map(s => s.id === editSystem.id ? updated : s))
            } else {
              const { data: created } = await supabase.from('systems').insert({ ...data, user_id: userId }).select().single()
              if (created) setSystems(prev => [...prev, created])
            }
            setShowSysModal(false)
          }}
          onDelete={editSystem ? () => deleteSystem(editSystem.id) : undefined}
        />
      )}
    </div>
  )
}
