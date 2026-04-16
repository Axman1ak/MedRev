'use client'
// src/app/dashboard/simulateur/page.tsx

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'

const SYS_COLORS: [string, string][] = [
  ['#4ADE80', '#166534'],
  ['#60A5FA', '#1D4ED8'],
  ['#F59E0B', '#92400E'],
  ['#F472B6', '#9D174D'],
  ['#A78BFA', '#6D28D9'],
  ['#2D6A4F', '#D8EAE0'],
  ['#9CA3AF', '#374151'],
]

interface Question {
  question: string
  options: string[]
  answer: number
  source?: string
  lessonName?: string
  systemName?: string
}

function parseQuestions(lesson: Lesson, systemName: string): Question[] {
  const raw = lesson.ai_questions as any[]
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((q: any) => ({
    question: q.question || q.q || '',
    options: q.options || q.opts || [],
    answer: typeof q.answer === 'number' ? q.answer : (typeof q.correct_index === 'number' ? q.correct_index : 0),
    source: q.source || q.src || undefined,
    lessonName: lesson.name,
    systemName,
  })).filter(q => q.question && q.options.length >= 2)
}

export default function SimulateurPage() {
  const supabase = createClient()
  const router = useRouter()

  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedSysIds, setSelectedSysIds] = useState<Set<string>>(new Set())

  // Config
  const [nbQuestions, setNbQuestions] = useState(20)
  const [duration, setDuration] = useState<number | null>(30) // minutes, null = libre
  const [selectionMode, setSelectionMode] = useState<'random' | 'weak'>('random')

  // Session state
  type Phase = 'config' | 'session' | 'results'
  const [phase, setPhase] = useState<Phase>('config')
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([]) // selected option per question
  const [revealed, setRevealed] = useState(false)
  const [selfRatings, setSelfRatings] = useState<string[]>([]) // 'reprendre'|'difficile'|'bien'|'facile'
  const [timeLeft, setTimeLeft] = useState(0) // seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid),
    ])
    setSystems(sys || [])
    setLessons(les || [])
    if (sys && sys.length > 0) {
      setSelectedSysIds(new Set(sys.map((s: System) => s.id)))
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      load(user.id)
    })
  }, [])

  // Timer
  useEffect(() => {
    if (phase === 'session' && duration !== null) {
      setTimeLeft(duration * 60)
    }
  }, [phase, duration])

  useEffect(() => {
    if (phase !== 'session' || duration === null) return
    if (timeLeft <= 0) { endSession(); return }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, timeLeft])

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Available questions for selected systems
  function getAvailableQuestions(): Question[] {
    const qs: Question[] = []
    lessons.forEach(l => {
      if (!selectedSysIds.has(l.system_id)) return
      const sys = systems.find(s => s.id === l.system_id)
      if (!sys) return
      qs.push(...parseQuestions(l, sys.name))
    })
    return qs
  }

  function countQuestionsForSystem(sysId: string): number {
    return lessons
      .filter(l => l.system_id === sysId)
      .reduce((acc, l) => acc + (Array.isArray(l.ai_questions) ? (l.ai_questions as any[]).length : 0), 0)
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function launchSession() {
    let qs = getAvailableQuestions()
    if (qs.length === 0) return
    qs = shuffle(qs).slice(0, nbQuestions)
    setSessionQuestions(qs)
    setCurrentIdx(0)
    setAnswers(new Array(qs.length).fill(null))
    setSelfRatings(new Array(qs.length).fill(''))
    setRevealed(false)
    setPhase('session')
  }

  function selectOption(optIdx: number) {
    if (revealed) return
    const newAnswers = [...answers]
    newAnswers[currentIdx] = optIdx
    setAnswers(newAnswers)
    setRevealed(true)
  }

  function rateSelf(rating: string) {
    const newRatings = [...selfRatings]
    newRatings[currentIdx] = rating
    setSelfRatings(newRatings)
    // Go to next question
    if (currentIdx < sessionQuestions.length - 1) {
      setCurrentIdx(i => i + 1)
      setRevealed(false)
    } else {
      endSession()
    }
  }

  function endSession() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('results')
  }

  const correctCount = answers.filter((a, i) => a === sessionQuestions[i]?.answer).length
  const score = sessionQuestions.length > 0 ? Math.round((correctCount / sessionQuestions.length) * 100) : 0
  const availableQs = getAvailableQuestions()
  const totalAvailable = availableQs.length

  // ---- CONFIG PHASE ----
  if (phase === 'config') return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
        :root { --dark:#111310;--green:#1B4332;--gm:#2D6A4F;--gl:#D8EAE0;--amber:#C47B2B;--al:#FBF0E0;--gray:#6B7280;--border:#DDD8CE; }
        .sim-main { padding:26px 28px; background:#EDEAE3; min-height:100vh; display:flex; flex-direction:column; gap:16px; font-family:'Plus Jakarta Sans',sans-serif; }
        .sim-card { background:white; border:1px solid var(--border); border-radius:13px; padding:20px; }
        .sim-ct { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--gray); margin-bottom:14px; }
        .sim-label { display:block; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--gray); margin-bottom:10px; }
        .popt { padding:6px 14px; border-radius:20px; border:1.5px solid var(--border); font-size:12.5px; font-weight:500; color:var(--gray); cursor:pointer; background:white; font-family:'Plus Jakarta Sans',sans-serif; transition:all .15s; }
        .popt:hover { border-color:#aaa; }
        .popt.sel { background:var(--dark); border-color:var(--dark); color:white; }
        .spill { display:flex; align-items:center; gap:6px; padding:7px 13px; border-radius:20px; border:1.5px solid var(--border); background:white; font-size:12.5px; font-weight:500; color:var(--gray); cursor:pointer; transition:all .15s; font-family:'Plus Jakarta Sans',sans-serif; }
        .spill:hover { border-color:#aaa; }
        .spill.sel { border-color:var(--green); background:var(--gl); color:var(--green); }
        .spill .sd { width:7px; height:7px; border-radius:50%; min-width:7px; }
      `}</style>
      <div className="sim-main">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 500, color: '#111310' }}>
            Simulateur d&apos;examen
          </h1>
          <p style={{ fontSize: '12.5px', color: 'var(--gray)', marginTop: 3 }}>
            Prépare-toi dans les conditions réelles du concours — multi-matières, chronométré, corrigé.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>
          {/* Config left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Matières */}
            <div className="sim-card">
              <div className="sim-ct">Matières à inclure</div>
              {systems.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--gray)' }}>Aucune matière — crée des fiches d&apos;abord.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {systems.map((sys, i) => {
                    const [dotColor] = SYS_COLORS[i % SYS_COLORS.length]
                    const isSel = selectedSysIds.has(sys.id)
                    const qCount = countQuestionsForSystem(sys.id)
                    return (
                      <div
                        key={sys.id}
                        className={`spill${isSel ? ' sel' : ''}`}
                        onClick={() => {
                          const next = new Set(selectedSysIds)
                          isSel ? next.delete(sys.id) : next.add(sys.id)
                          setSelectedSysIds(next)
                        }}
                      >
                        <span className="sd" style={{ background: dotColor }} />
                        {sys.icon} {sys.name}
                        <span style={{ fontSize: 10, marginLeft: 3, color: isSel ? 'var(--green)' : 'var(--gray)' }}>
                          {qCount} Q
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Options grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="sim-card">
                <label className="sim-label">Nb de questions</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[10, 20, 30, 50].map(n => (
                    <button key={n} className={`popt${nbQuestions === n ? ' sel' : ''}`} onClick={() => setNbQuestions(n)}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="sim-card">
                <label className="sim-label">Durée</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[{ label: '15 min', val: 15 }, { label: '30 min', val: 30 }, { label: '45 min', val: 45 }, { label: 'Libre', val: null }].map(({ label, val }) => (
                    <button key={label} className={`popt${duration === val ? ' sel' : ''}`} onClick={() => setDuration(val)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="sim-card" style={{ gridColumn: '1 / -1' }}>
                <label className="sim-label">Sélection des questions</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className={`popt${selectionMode === 'weak' ? ' sel' : ''}`} onClick={() => setSelectionMode('weak')}>Angles morts</button>
                  <button className={`popt${selectionMode === 'random' ? ' sel' : ''}`} onClick={() => setSelectionMode('random')}>Aléatoire</button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary + launch */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#111310', borderRadius: 13, padding: 22 }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,.32)', marginBottom: 16 }}>
                Résumé
              </div>
              {[
                { label: 'Matières', value: systems.filter(s => selectedSysIds.has(s.id)).map(s => s.name).join(', ') || '—' },
                { label: 'Questions disponibles', value: `${totalAvailable} QCMs` },
                { label: 'Questions lancées', value: `${Math.min(nbQuestions, totalAvailable)} QCMs` },
                { label: 'Durée max', value: duration ? `${duration} minutes` : 'Libre' },
              ].map(({ label, value }) => (
                <div key={label} style={{ borderBottom: '1px solid rgba(255,255,255,.08)', padding: '9px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.42)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'white', maxWidth: 160, textAlign: 'right' }}>{value}</span>
                </div>
              ))}

              <button
                onClick={launchSession}
                disabled={totalAvailable === 0 || selectedSysIds.size === 0}
                style={{
                  width: '100%', marginTop: 16, padding: 12,
                  background: totalAvailable === 0 || selectedSysIds.size === 0 ? 'rgba(255,255,255,.1)' : '#2D6A4F',
                  border: 'none', borderRadius: 9,
                  fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
                  color: totalAvailable === 0 || selectedSysIds.size === 0 ? 'rgba(255,255,255,.3)' : 'white',
                  cursor: totalAvailable === 0 || selectedSysIds.size === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {totalAvailable === 0 ? 'Aucune question disponible' : 'Lancer la session →'}
              </button>

              {totalAvailable === 0 && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
                  Importe des cours depuis<br />Mes matières pour générer des QCMs.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  // ---- SESSION PHASE ----
  if (phase === 'session') {
    const q = sessionQuestions[currentIdx]
    const selectedAnswer = answers[currentIdx]
    const progress = ((currentIdx) / sessionQuestions.length) * 100
    const correctSoFar = answers.slice(0, currentIdx).filter((a, i) => a === sessionQuestions[i]?.answer).length
    const wrongSoFar = answers.slice(0, currentIdx).filter((a, i) => a !== null && a !== sessionQuestions[i]?.answer).length

    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
          :root { --dark:#111310;--green:#1B4332;--gm:#2D6A4F;--gl:#D8EAE0;--gray:#6B7280;--border:#DDD8CE; }
          .ses-main { padding:26px 28px; background:#EDEAE3; min-height:100vh; display:flex; flex-direction:column; gap:16px; font-family:'Plus Jakarta Sans',sans-serif; }
          .opt-btn { padding:13px 18px; border-radius:10px; border:1.5px solid var(--border); background:white; font-family:'Plus Jakarta Sans',sans-serif; font-size:13.5px; color:var(--dark); cursor:pointer; text-align:left; transition:all .15s; display:block; width:100%; margin-bottom:6px; }
          .opt-btn:hover:not(:disabled) { border-color:var(--gm); background:var(--gl); }
          .opt-btn.correct { border-color:var(--green); background:var(--gl); color:var(--green); font-weight:600; }
          .opt-btn.wrong { border-color:#FCA5A5; background:#FEF2F2; color:#B91C1C; }
          .opt-btn.neutral-revealed { opacity:.5; }
          .sab { flex:1; padding:9px; border-radius:9px; border:1.5px solid var(--border); font-family:'Plus Jakarta Sans',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; background:white; transition:all .15s; }
          .sab:hover { opacity:.8; }
          .sa-a { color:#B91C1C; border-color:#FCA5A5; }
          .sa-h { color:var(--amber); border-color:#E8C89A; }
          .sa-ok2 { color:var(--green); border-color:var(--gl); }
          .sa-e { color:var(--green); background:var(--gl); border-color:var(--gl); }
        `}</style>
        <div className="ses-main">
          {/* Session header */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 13, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#FAFAF8', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Session en cours
                </span>
                <button
                  onClick={endSession}
                  style={{ fontSize: 11, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Terminer
                </button>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 500, color: '#4ADE80' }}>{correctSoFar}</div>
                  <div style={{ fontSize: 9, color: 'var(--gray)', textTransform: 'uppercase' }}>Bonnes</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 500, color: '#F472B6' }}>{wrongSoFar}</div>
                  <div style={{ fontSize: 9, color: 'var(--gray)', textTransform: 'uppercase' }}>Ratées</div>
                </div>
                {duration !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 500, color: timeLeft < 120 ? '#B91C1C' : 'var(--amber)' }}>
                      {formatTime(timeLeft)}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--gray)', textTransform: 'uppercase' }}>Restant</div>
                  </div>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: '#E5E7EB', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#1B4332', transition: 'width .3s' }} />
            </div>
          </div>

          {/* Question card */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 13, padding: 24, maxWidth: 720, margin: '0 auto', width: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray)', marginBottom: 11, textAlign: 'center' }}>
              Question {currentIdx + 1} / {sessionQuestions.length}
              {q.systemName && ` · ${q.systemName}`}
            </div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 400, lineHeight: 1.5, color: '#111310', textAlign: 'center', marginBottom: 14 }}>
              {q.question}
            </div>
            {q.source && (
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <span style={{ background: 'var(--gl)', color: 'var(--green)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>
                  {q.source}
                </span>
              </div>
            )}
            {q.lessonName && !q.source && (
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <span style={{ background: '#F3F4F6', color: 'var(--gray)', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                  {q.lessonName}
                </span>
              </div>
            )}

            {/* Options */}
            <div style={{ marginBottom: 14 }}>
              {q.options.map((opt, i) => {
                const isSelected = selectedAnswer === i
                const isCorrect = i === q.answer
                let cls = 'opt-btn'
                if (revealed) {
                  if (isCorrect) cls += ' correct'
                  else if (isSelected && !isCorrect) cls += ' wrong'
                  else cls += ' neutral-revealed'
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    disabled={revealed}
                    onClick={() => selectOption(i)}
                  >
                    {opt}{isCorrect && revealed ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>

            {/* Self-rating (only after revealing) */}
            {revealed && (
              <>
                <div style={{ fontSize: 11, color: 'var(--gray)', textAlign: 'center', marginBottom: 7, fontWeight: 500 }}>
                  Comment tu t&apos;es senti ?
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { label: 'À reprendre', cls: 'sab sa-a', val: 'reprendre' },
                    { label: 'Difficile', cls: 'sab sa-h', val: 'difficile' },
                    { label: 'Bien', cls: 'sab sa-ok2', val: 'bien' },
                    { label: 'Facile', cls: 'sab sa-e', val: 'facile' },
                  ].map(({ label, cls, val }) => (
                    <button key={val} className={cls} onClick={() => rateSelf(val)}>{label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  // ---- RESULTS PHASE ----
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
        :root { --dark:#111310;--green:#1B4332;--gm:#2D6A4F;--gl:#D8EAE0;--gray:#6B7280;--border:#DDD8CE; }
        .res-main { padding:26px 28px; background:#EDEAE3; min-height:100vh; display:flex; flex-direction:column; gap:16px; font-family:'Plus Jakarta Sans',sans-serif; align-items:center; justify-content:center; }
      `}</style>
      <div className="res-main">
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 36, maxWidth: 520, width: '100%', textAlign: 'center' }}>
          {/* Score */}
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 56, fontWeight: 500, color: score >= 70 ? '#1B4332' : score >= 50 ? '#C47B2B' : '#B91C1C', lineHeight: 1, marginBottom: 6 }}>
            {score}%
          </div>
          <p style={{ fontSize: 14, color: 'var(--gray)', marginBottom: 24 }}>
            {score >= 70 ? 'Excellente session ! 🎉' : score >= 50 ? 'Bonne session, continue !' : 'À retravailler — tu progresses.'}
          </p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { n: correctCount, label: 'Bonnes', color: '#4ADE80' },
              { n: sessionQuestions.length - correctCount, label: 'Ratées', color: '#F472B6' },
              { n: sessionQuestions.length, label: 'Questions', color: '#60A5FA' },
            ].map(({ n, label, color }) => (
              <div key={label} style={{ background: '#FAFAF8', borderRadius: 10, padding: '14px 8px' }}>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 500, color }}>{n}</div>
                <div style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Self-rating breakdown */}
          {selfRatings.some(Boolean) && (
            <div style={{ background: '#FAFAF8', borderRadius: 10, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray)', marginBottom: 10 }}>
                Ressenti
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {[
                  { val: 'reprendre', label: 'À reprendre', color: '#B91C1C' },
                  { val: 'difficile', label: 'Difficile', color: '#C47B2B' },
                  { val: 'bien', label: 'Bien', color: '#1B4332' },
                  { val: 'facile', label: 'Facile', color: '#1B4332' },
                ].map(({ val, label, color }) => {
                  const count = selfRatings.filter(r => r === val).length
                  if (count === 0) return null
                  return (
                    <div key={val} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color }}>{count}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray)' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 9 }}>
            <button
              onClick={() => { setPhase('config'); setSessionQuestions([]); setAnswers([]); setSelfRatings([]) }}
              style={{
                flex: 1, padding: '11px', borderRadius: 8,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid var(--border)', background: 'white', color: '#111310'
              }}
            >
              Nouvelle session
            </button>
            <button
              onClick={launchSession}
              style={{
                flex: 1, padding: '11px', borderRadius: 8,
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 600,
                cursor: 'pointer', border: 'none', background: '#1B4332', color: 'white'
              }}
            >
              Rejouer →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
