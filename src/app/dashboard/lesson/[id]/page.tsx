'use client'
// src/app/dashboard/lesson/[id]/page.tsx

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, System, AiQuestion, StepEntry } from '@/types'
import { J_STEPS, jLabel, stepDate, fmtDate, todayStr, scoreColor, doneCount } from '@/types'
import QcmPanel from '@/components/QcmPanel'

export default function LessonPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [system, setSystem] = useState<System | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [stepScore, setStepScore] = useState<number | null>(null)
  const [stepNote, setStepNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      const [{ data: prof }, { data: les }] = await Promise.all([
        supabase.from('profiles').select('plan').eq('id', user.id).single(),
        supabase.from('lessons').select('*').eq('id', id).single(),
      ])
      setIsPro(prof?.plan === 'pro')
      if (!les) { router.push('/dashboard'); return }
      setLesson(les)
      const { data: sys } = await supabase.from('systems').select('*').eq('id', les.system_id).single()
      setSystem(sys)
    })
  }, [id])

  function openStep(i: number) {
    if (!lesson) return
    const step = lesson.steps[i] as StepEntry | null
    setActiveStep(i)
    setStepScore(step?.score ?? null)
    setStepNote(step?.note ?? '')
  }

  async function saveStep() {
    if (!lesson || activeStep === null || !stepScore || !userId) return
    setSaving(true)
    const newSteps = [...lesson.steps]
    newSteps[activeStep] = { score: stepScore, note: stepNote }
    const { data: updated } = await supabase.from('lessons')
      .update({ steps: newSteps })
      .eq('id', lesson.id)
      .select().single()
    if (updated) setLesson(updated)
    setSaving(false)
    toast('Révision enregistrée ✓')
  }

  async function deleteStep() {
    if (!lesson || activeStep === null || !userId) return
    const newSteps = [...lesson.steps]
    newSteps[activeStep] = null
    const { data: updated } = await supabase.from('lessons').update({ steps: newSteps }).eq('id', lesson.id).select().single()
    if (updated) setLesson(updated)
    setActiveStep(null)
    toast('Supprimée')
  }

  async function saveAiQuestions(questions: AiQuestion[]) {
    if (!lesson || !userId) return
    const { data: updated } = await supabase.from('lessons').update({ ai_questions: questions }).eq('id', lesson.id).select().single()
    if (updated) setLesson(updated)
  }

  function toast(msg: string) {
    const el = document.createElement('div')
    el.textContent = msg
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', right: '24px',
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '12px 18px', fontSize: '14px',
      zIndex: '300', animation: 'mIn .3s ease',
      boxShadow: '0 4px 24px rgba(0,0,0,.12)', color: 'var(--t1)'
    })
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2500)
  }

  if (!lesson) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  const t = todayStr()

  // Score colors adapted for light mode
  const SCORE_COLORS: Record<number, string> = {
    1: '#dc2626', 2: '#ea580c', 3: '#ca8a04', 4: '#16a34a', 5: '#2d6a4f'
  }
  const SCORE_TEXT: Record<number, string> = {
    1: '#fff', 2: '#fff', 3: '#fff', 4: '#fff', 5: '#fff'
  }

  const activeStepData = activeStep !== null ? (lesson.steps[activeStep] as StepEntry | null) : null
  const activeStepDateStr = activeStep !== null ? stepDate(lesson, activeStep) : null

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>

      {/* Top bar */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 20, lineHeight: 1, padding: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {system && <span className="badge badge-sys">{system.icon} {system.name}</span>}
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>{doneCount(lesson)}/14 révisions faites</span>
            {lesson.ai_questions?.length > 0 && <span className="badge badge-ai">✨ {lesson.ai_questions.length} QCM IA</span>}
          </div>
          <h1 className="font-syne font-bold text-lg leading-tight" style={{ color: 'var(--t1)' }}>{lesson.name}</h1>
        </div>
        {lesson.learn_date && (
          <div style={{ fontSize: 13, color: 'var(--t3)', flexShrink: 0 }}>
            📖 J0 : {fmtDate(lesson.learn_date)}
          </div>
        )}
      </div>

      {/* Body: 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 0, minHeight: 'calc(100vh - 73px)' }}>

        {/* LEFT: Step timeline */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 20px 0', flex: 1, overflowY: 'auto' }}>
            <div className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--t3)', letterSpacing: '0.08em' }}>
              14 étapes de révision espacée
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
              {J_STEPS.map((_, i) => {
                const step = lesson.steps[i] as StepEntry | null
                const ds = stepDate(lesson, i)
                const isFuture = ds && ds > t && i > 0
                const isToday = ds === t
                const isLate = ds && ds < t && !step && i > 0
                const isActive = activeStep === i

                let borderColor = 'var(--border)'
                let bg = 'var(--bg2)'
                if (isActive) { borderColor = 'var(--accent)'; bg = 'rgba(45,106,79,.06)' }
                else if (step) {
                  borderColor = SCORE_COLORS[step.score] + '60'
                  bg = SCORE_COLORS[step.score] + '12'
                }
                else if (isToday) { borderColor = 'rgba(45,106,79,.4)'; bg = 'rgba(45,106,79,.04)' }
                else if (isLate) { borderColor = 'rgba(220,38,38,.3)'; bg = 'rgba(220,38,38,.04)' }

                return (
                  <div key={i}
                    onClick={() => openStep(i)}
                    style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '10px', cursor: 'pointer', transition: 'all .2s', opacity: isFuture ? 0.45 : 1, boxShadow: isActive ? `0 0 0 2px rgba(45,106,79,.2)` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="font-syne font-bold text-xs" style={{ color: step ? SCORE_COLORS[step.score] : isToday ? 'var(--accent)' : isLate ? 'var(--danger)' : 'var(--t3)' }}>
                        {jLabel(i)}
                      </span>
                      {ds && <span style={{ fontSize: 10, color: 'var(--t3)' }}>{fmtDate(ds)}</span>}
                    </div>
                    {step ? (
                      <>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: SCORE_COLORS[step.score], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 14, color: SCORE_TEXT[step.score], margin: '4px 0' }}>
                          {step.score}
                        </div>
                        {step.note && <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.note}</div>}
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: isLate ? 'var(--danger)' : 'var(--t3)', fontStyle: 'italic', marginTop: 4 }}>
                        {isLate ? 'Non fait' : isToday ? '📝 Aujourd\'hui !' : 'À venir'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Step entry panel */}
            {activeStep !== null && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="font-syne font-bold text-sm mb-1" style={{ color: 'var(--t1)' }}>
                  {jLabel(activeStep)}{activeStepDateStr ? ` — ${fmtDate(activeStepDateStr)}` : ''}
                </div>
                <div className="text-xs mb-4" style={{ color: 'var(--t3)' }}>{lesson.name}</div>

                <div className="text-xs font-medium mb-2" style={{ color: 'var(--t2)' }}>Note de confiance</div>
                <div className="flex gap-2 mb-2">
                  {[1,2,3,4,5].map(v => (
                    <button key={v} onClick={() => setStepScore(v)}
                      style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${stepScore === v ? SCORE_COLORS[v] : 'var(--border)'}`, background: stepScore === v ? SCORE_COLORS[v] : 'var(--bg2)', color: stepScore === v ? '#fff' : 'var(--t2)', fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 text-xs mb-4" style={{ color: 'var(--t3)' }}>
                  <span>1 😵 Très dur</span><span>3 🤔 Moyen</span><span>5 🎯 Maîtrisé</span>
                </div>

                <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--t2)' }}>Remarques</div>
                <textarea className="input mb-4" rows={3} placeholder="Points difficiles, clés à retenir..." value={stepNote} onChange={e => setStepNote(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.6 }} />

                <div className="flex gap-2 justify-end">
                  {activeStepData && (
                    <button onClick={deleteStep} className="btn btn-danger btn-sm">Supprimer</button>
                  )}
                  <button onClick={() => setActiveStep(null)} className="btn btn-ghost btn-sm">Annuler</button>
                  <button onClick={saveStep} disabled={!stepScore || saving} className="btn btn-primary btn-sm" style={{ opacity: !stepScore || saving ? 0.5 : 1 }}>
                    {saving ? '...' : '💾 Sauvegarder'}
                  </button>
                </div>
              </div>
            )}

            {activeStep === null && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--t3)', fontSize: 13 }}>
                ← Cliquez sur une étape pour noter votre révision
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: QCM Panel */}
        <div style={{ padding: 24, overflowY: 'auto', background: 'var(--bg)' }}>
          <QcmPanel
            lesson={lesson}
            isPro={isPro}
            onSave={saveAiQuestions}
          />
        </div>

      </div>
    </div>
  )
}
