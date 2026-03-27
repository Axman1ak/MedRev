'use client'
// src/app/dashboard/lesson/[id]/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, System, AiQuestion, StepEntry } from '@/types'
import { J_STEPS, jLabel, stepDate, fmtDate, todayStr, doneCount } from '@/types'

type Tab = 'timeline' | 'qcm' | 'flashcards' | 'annales'
type Format = 'mixed' | 'qcm' | 'kfp' | 'vf'
type Difficulty = 'annales' | 'concours' | 'appro'

interface Flashcard { q: string; a: string; status: 'new' | 'hard' | 'ok' | 'easy' }

const SCORE_COLORS: Record<number, string> = { 1: '#dc2626', 2: '#ea580c', 3: '#ca8a04', 4: '#16a34a', 5: '#2d6a4f' }
const SCORE_BG: Record<number, string> = { 1: '#fff5f5', 2: '#fff7ed', 3: '#fffbeb', 4: '#f0fdf4', 5: '#f0faf5' }
const SCORE_BORDER: Record<number, string> = { 1: '#fca5a5', 2: '#fdba74', 3: '#fcd34d', 4: '#86efac', 5: '#b7dfca' }

export default function LessonPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [system, setSystem] = useState<System | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('timeline')

  // Timeline state
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [stepScore, setStepScore] = useState<number | null>(null)
  const [stepNote, setStepNote] = useState('')
  const [saving, setSaving] = useState(false)

  // QCM state
  const [sourceTab, setSourceTab] = useState<'text' | 'file'>('text')
  const [courseText, setCourseText] = useState('')
  const [fileName, setFileName] = useState('')
  const [nbQ, setNbQ] = useState(10)
  const [format, setFormat] = useState<Format>('mixed')
  const [difficulty, setDifficulty] = useState<Difficulty>('annales')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<AiQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)

  // Flashcard state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { q: 'Quels sont les 4 signes cardinaux de l\'OAP cardiogénique ?', a: 'Dyspnée aiguë · Crépitants bilatéraux · SpO2 < 92% · Expectoration mousseuse rose saumonée', status: 'new' },
    { q: 'Première cause d\'ICA en France ?', a: 'Syndrome coronarien aigu (40% des cas)', status: 'new' },
    { q: 'Seuil de BNP pour insuffisance cardiaque aiguë ?', a: '> 100 pg/mL (NT-proBNP > 300 pg/mL)', status: 'new' },
  ])
  const [fcIndex, setFcIndex] = useState(0)
  const [fcFlipped, setFcFlipped] = useState(false)
  const [fcTab, setFcTab] = useState<'revise' | 'create'>('revise')
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [fcGenerating, setFcGenerating] = useState(false)
  const [fcCourseText, setFcCourseText] = useState('')

  // Annales state (mock)
  const ANNALES = [
    { year: 'EDN 2023', q: 'Patient de 68 ans, dyspnée aiguë, BNP à 1200 pg/mL, crépitants bilatéraux. Prise en charge initiale ?', tag: 'IC · Urgences', opts: ['Furosémide IV 40mg', 'Oxygénothérapie + position demi-assise + furosémide', 'Dérivés nitrés sublinguaux', 'Dobutamine IVSE'], correct: 1 },
    { year: 'EDN 2022', q: 'Concernant l\'ICFEP, quelle(s) proposition(s) est/sont exacte(s) ?', tag: 'ICFEP · Physiopathologie', opts: ['FE > 50%', 'Prédominance féminine', 'HTA comme facteur favorisant', 'Toutes les réponses'], correct: 3 },
    { year: 'EDN 2021', q: 'Patient sous furosémide pour IC chronique, kaliémie à 2,8 mmol/L. Attitude ?', tag: 'Traitement · Complications', opts: ['Arrêt furosémide', 'Supplémenter en potassium + surveillance', 'Hospitalisation en urgence', 'Augmenter la dose de furosémide'], correct: 1 },
  ]
  const [annalesAnswers, setAnnalesAnswers] = useState<Record<number, number>>({})

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
      if (les.ai_questions?.length > 0) setQuestions(les.ai_questions)
      const { data: sys } = await supabase.from('systems').select('*').eq('id', les.system_id).single()
      setSystem(sys)
    })
  }, [id])

  // Keyboard shortcuts for flashcards
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (tab !== 'flashcards' || fcTab !== 'revise') return
    if (e.code === 'Space') { e.preventDefault(); setFcFlipped(f => !f) }
    if (e.key === '1' && fcFlipped) fcAnswer('hard')
    if (e.key === '2' && fcFlipped) fcAnswer('ok')
    if (e.key === '3' && fcFlipped) fcAnswer('easy')
  }, [tab, fcTab, fcFlipped, fcIndex])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function toast(msg: string) {
    const el = document.createElement('div')
    el.textContent = msg
    Object.assign(el.style, { position: 'fixed', bottom: '24px', right: '24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 18px', fontSize: '14px', zIndex: '300', animation: 'mIn .3s ease', boxShadow: '0 4px 24px rgba(0,0,0,.12)', color: 'var(--t1)' })
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2500)
  }

  // --- TIMELINE ---
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
    const { data: updated } = await supabase.from('lessons').update({ steps: newSteps }).eq('id', lesson.id).select().single()
    if (updated) setLesson(updated)
    setSaving(false)
    setActiveStep(null)
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

  // --- QCM ---
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setFileName(file.name)
    if (file.type === 'application/pdf') {
      setCourseText(`[PDF: ${file.name}]`)
    } else {
      const reader = new FileReader()
      reader.onload = ev => setCourseText(ev.target?.result as string)
      reader.readAsText(file)
    }
  }

  async function generateQcm() {
    setGenerating(true); setAnswers({}); setShowResults(false)
    try {
      const res = await fetch('/api/generate-qcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonName: lesson?.name, courseText: courseText.slice(0, 12000), nbQ, format, difficulty })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQuestions(data.questions)
      if (lesson && userId) {
        const { data: updated } = await supabase.from('lessons').update({ ai_questions: data.questions }).eq('id', lesson.id).select().single()
        if (updated) setLesson(updated)
      }
      toast(`✨ ${data.questions.length} questions générées !`)
    } catch { toast('❌ Erreur lors de la génération') }
    setGenerating(false)
  }

  function answerQcm(qi: number, oi: number) {
    if (answers[qi] !== undefined) return
    const newA = { ...answers, [qi]: oi }
    setAnswers(newA)
    if (oi === questions[qi].correct) toast('✅ Bonne réponse !')
    else toast('❌ Mauvaise réponse')
    if (Object.keys(newA).length === questions.length) setShowResults(true)
  }

  // --- FLASHCARDS ---
  function fcAnswer(status: 'hard' | 'ok' | 'easy') {
    const updated = [...flashcards]
    updated[fcIndex] = { ...updated[fcIndex], status }
    setFlashcards(updated)
    setFcFlipped(false)
    if (fcIndex < flashcards.length - 1) setFcIndex(i => i + 1)
    else toast('🎉 Session terminée !')
  }

  function addFlashcard() {
    if (!newQ.trim() || !newA.trim()) return
    setFlashcards(f => [...f, { q: newQ.trim(), a: newA.trim(), status: 'new' }])
    setNewQ(''); setNewA('')
    toast('Carte ajoutée ✓')
  }

  function deleteFlashcard(i: number) {
    setFlashcards(f => f.filter((_, idx) => idx !== i))
    if (fcIndex >= flashcards.length - 1) setFcIndex(Math.max(0, flashcards.length - 2))
  }

  async function generateFlashcards() {
    if (!fcCourseText.trim()) return
    setFcGenerating(true)
    try {
      const res = await fetch('/api/generate-qcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonName: lesson?.name, courseText: fcCourseText.slice(0, 12000), nbQ: 8, format: 'vf', difficulty: 'annales', mode: 'flashcard' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newCards: Flashcard[] = data.questions.map((q: AiQuestion) => ({ q: q.stem, a: q.explanation || q.options[q.correct], status: 'new' as const }))
      setFlashcards(f => [...f, ...newCards])
      toast(`✨ ${newCards.length} flashcards générées !`)
    } catch { toast('❌ Erreur lors de la génération') }
    setFcGenerating(false)
  }

  if (!lesson) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  const t = todayStr()
  const done = doneCount(lesson)
  const activeStepData = activeStep !== null ? (lesson.steps[activeStep] as StepEntry | null) : null
  const activeStepDateStr = activeStep !== null ? stepDate(lesson, activeStep) : null
  const qCorrect = questions.filter((q, i) => answers[i] === q.correct).length
  const fcMastered = flashcards.filter(f => f.status === 'easy').length
  const fcHard = flashcards.filter(f => f.status === 'hard').length
  const fcOk = flashcards.filter(f => f.status === 'ok').length
  const currentCard = flashcards[fcIndex]

  const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
    qcm: { bg: 'rgba(45,106,79,.1)', color: '#2d6a4f' },
    kfp: { bg: 'rgba(109,40,217,.1)', color: '#6d28d9' },
    vf:  { bg: 'rgba(217,119,6,.1)', color: '#d97706' },
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>

      {/* TOP BAR */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 20, lineHeight: 1, padding: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {system && <span className="badge badge-sys">{system.icon} {system.name}</span>}
            {lesson.ai_questions?.length > 0 && <span className="badge badge-ai">✨ {lesson.ai_questions.length} QCM</span>}
          </div>
          <h1 className="font-syne font-bold text-lg leading-tight" style={{ color: 'var(--t1)' }}>{lesson.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 100, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${(done / 14) * 100}%` }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'DM Mono, monospace' }}>{done}/14 étapes</span>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '0 28px', display: 'flex', gap: 4 }}>
        {([
          { id: 'timeline', label: 'Révision espacée', icon: '📅' },
          { id: 'qcm', label: 'QCM IA', icon: '🤖' },
          { id: 'flashcards', label: 'Flashcards', icon: '🃏' },
          { id: 'annales', label: 'Annales EDN', icon: '📚' },
        ] as { id: Tab; label: string; icon: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '12px 18px', fontSize: 14, fontWeight: tab === t.id ? 500 : 400, color: tab === t.id ? 'var(--accent)' : 'var(--t3)', cursor: 'pointer', border: 'none', background: 'transparent', borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`, fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s' }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── TIMELINE ── */}
        {tab === 'timeline' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div className="font-syne font-bold" style={{ fontSize: 22, color: 'var(--t1)' }}>Progression J0 → J+120</div>
                <div style={{ fontSize: 14, color: 'var(--t3)', marginTop: 2 }}>14 étapes de révision espacée · courbe d&apos;Ebbinghaus</div>
              </div>
              {lesson.learn_date && <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: 13, color: 'var(--t2)' }}>📖 J0 · {fmtDate(lesson.learn_date)}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 10 }}>
              {J_STEPS.slice(0, 7).map((_, i) => <StepCard key={i} i={i} lesson={lesson} t={t} activeStep={activeStep} openStep={openStep} SCORE_COLORS={SCORE_COLORS} SCORE_BG={SCORE_BG} SCORE_BORDER={SCORE_BORDER} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 28 }}>
              {J_STEPS.slice(7).map((_, i) => <StepCard key={i+7} i={i+7} lesson={lesson} t={t} activeStep={activeStep} openStep={openStep} SCORE_COLORS={SCORE_COLORS} SCORE_BG={SCORE_BG} SCORE_BORDER={SCORE_BORDER} />)}
              <div />
            </div>

            {activeStep !== null ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div className="font-syne font-bold" style={{ fontSize: 18, color: 'var(--t1)' }}>
                      {jLabel(activeStep)}{activeStepDateStr ? ` — ${fmtDate(activeStepDateStr)}` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>{lesson.name}</div>
                  </div>
                  {activeStepData && <span style={{ background: SCORE_BG[activeStepData.score], border: `1px solid ${SCORE_BORDER[activeStepData.score]}`, color: SCORE_COLORS[activeStepData.score], borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>Score actuel : {activeStepData.score}/5</span>}
                </div>

                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t2)', marginBottom: 12 }}>Comment tu te sens sur ce sujet ?</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  {[1,2,3,4,5].map(v => (
                    <button key={v} onClick={() => setStepScore(v)}
                      style={{ width: 52, height: 52, borderRadius: 12, border: `2px solid ${stepScore === v ? SCORE_COLORS[v] : 'var(--border)'}`, background: stepScore === v ? SCORE_COLORS[v] : SCORE_BG[v] || 'var(--bg2)', color: stepScore === v ? '#fff' : SCORE_COLORS[v], fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {v}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 32, fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>
                  <span>1 — Très difficile</span><span>3 — Moyen</span><span>5 — Maîtrisé</span>
                </div>

                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t2)', marginBottom: 8 }}>Remarques (optionnel)</div>
                <textarea className="input" rows={3} placeholder="Points difficiles, erreurs fréquentes, clés à retenir…" value={stepNote} onChange={e => setStepNote(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.6, marginBottom: 20 }} />

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  {activeStepData && <button onClick={deleteStep} className="btn btn-danger btn-sm">Supprimer</button>}
                  <button onClick={() => setActiveStep(null)} className="btn btn-ghost btn-sm">Annuler</button>
                  <button onClick={saveStep} disabled={!stepScore || saving} className="btn btn-primary btn-sm" style={{ opacity: !stepScore || saving ? 0.5 : 1 }}>
                    {saving ? '...' : '💾 Enregistrer la révision'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: 14, background: 'var(--bg2)', borderRadius: 16, border: '1px dashed var(--border)' }}>
                Clique sur une étape pour noter ta révision
              </div>
            )}
          </div>
        )}

        {/* ── QCM IA ── */}
        {tab === 'qcm' && (
          <div>
            {!isPro ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center', gap: 16, background: 'rgba(109,40,217,.04)', border: '1px solid rgba(109,40,217,.12)', borderRadius: 16 }}>
                <div style={{ fontSize: 40 }}>🔒</div>
                <div className="font-syne font-bold" style={{ fontSize: 20, color: 'var(--t1)' }}>QCM IA — niveau annales</div>
                <p style={{ color: 'var(--t3)', maxWidth: 320, lineHeight: 1.7 }}>Générez des QCM niveau annales EDN sur vos cours. Réservé aux membres Premium.</p>
                <a href="/dashboard/pricing" className="btn btn-primary" style={{ textDecoration: 'none' }}>Passer Premium →</a>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 32, alignItems: 'start' }}>
                  {/* Left: generator */}
                  <div>
                    <div className="font-syne font-bold" style={{ fontSize: 22, color: 'var(--t1)', marginBottom: 6 }}>Générer des questions</div>
                    <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 20 }}>Colle ton cours ou uploade un PDF — l&apos;IA génère des questions niveau annales EDN.</div>

                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 10, padding: 4, marginBottom: 14 }}>
                      {(['text', 'file'] as const).map(s => (
                        <button key={s} onClick={() => setSourceTab(s)}
                          style={{ flex: 1, padding: '9px', borderRadius: 7, fontSize: 13, cursor: 'pointer', border: sourceTab === s ? '1px solid var(--border)' : 'none', background: sourceTab === s ? 'var(--card)' : 'transparent', color: sourceTab === s ? 'var(--accent)' : 'var(--t3)', fontWeight: sourceTab === s ? 500 : 400, fontFamily: 'DM Sans, sans-serif' }}>
                          {s === 'text' ? '📝 Coller le cours' : '📄 Uploader un PDF'}
                        </button>
                      ))}
                    </div>

                    {sourceTab === 'text' ? (
                      <textarea className="input" rows={7} placeholder={`Colle ici le contenu de ton cours, tes notes, ou un extrait de référentiel.\n\nPlus le texte est précis, plus les questions seront niveau annales EDN.`} value={courseText} onChange={e => setCourseText(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.6, fontSize: 13, marginBottom: 12 }} />
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        <label htmlFor="qcm-file" style={{ display: 'block', border: `2px dashed ${fileName ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: fileName ? 'rgba(45,106,79,.04)' : 'var(--bg2)', marginBottom: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: fileName ? 'var(--accent)' : 'var(--t2)' }}>{fileName ? `📄 ${fileName}` : '📤 Cliquer pour uploader'}</div>
                          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>PDF, TXT, Markdown — max 5 Mo</div>
                        </label>
                        <input id="qcm-file" type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handleFile} />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      {[
                        { label: 'Questions', el: <select className="input" style={{ width: 90, padding: '6px 8px', fontSize: 12 }} value={nbQ} onChange={e => setNbQ(+e.target.value)}>{[5,10,15,20].map(n => <option key={n} value={n}>{n}</option>)}</select> },
                        { label: 'Format', el: <select className="input" style={{ width: 190, padding: '6px 8px', fontSize: 12 }} value={format} onChange={e => setFormat(e.target.value as Format)}><option value="mixed">Mixte (QCM + KFP + V/F)</option><option value="qcm">QCM classiques</option><option value="kfp">KFP clinique</option><option value="vf">Vrai / Faux</option></select> },
                        { label: 'Niveau', el: <select className="input" style={{ width: 150, padding: '6px 8px', fontSize: 12 }} value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}><option value="annales">Annales EDN</option><option value="concours">Concours blanc</option><option value="appro">Approfondi</option></select> },
                      ].map(({ label, el }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{label}</span>{el}
                        </div>
                      ))}
                    </div>

                    <button onClick={generateQcm} disabled={generating} className="btn btn-primary w-full" style={{ width: '100%', padding: '13px', justifyContent: 'center', fontSize: 14, opacity: generating ? 0.6 : 1 }}>
                      {generating ? '⏳ Génération en cours...' : '🤖 Générer les questions'}
                    </button>

                    {showResults && (
                      <div style={{ marginTop: 16, background: 'rgba(45,106,79,.06)', border: '1px solid rgba(45,106,79,.2)', borderRadius: 12, padding: 18, textAlign: 'center' }}>
                        <div className="font-syne font-bold" style={{ fontSize: 36, color: 'var(--accent)' }}>{qCorrect}/{questions.length}</div>
                        <div style={{ fontSize: 14, color: 'var(--t3)', marginTop: 4 }}>
                          {Math.round(qCorrect/questions.length*100)}% — {qCorrect/questions.length >= 0.8 ? '🎯 Excellent !' : qCorrect/questions.length >= 0.6 ? '👍 Bien !' : '📚 À retravailler'}
                        </div>
                        <button onClick={() => { setAnswers({}); setShowResults(false) }} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>🔄 Recommencer</button>
                      </div>
                    )}
                  </div>

                  {/* Right: questions */}
                  <div>
                    {generating && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48, color: 'var(--t3)', fontSize: 14 }}>
                        <div className="spinner" /> L&apos;IA analyse le cours et génère {nbQ} questions…
                      </div>
                    )}
                    {!generating && questions.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)', fontSize: 14, background: 'var(--bg2)', borderRadius: 16, border: '1px dashed var(--border)' }}>
                        Les questions apparaîtront ici après génération
                      </div>
                    )}
                    {!generating && questions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {questions.map((q, qi) => {
                          const answered = answers[qi] !== undefined
                          const ts = TYPE_STYLES[q.type] || TYPE_STYLES.qcm
                          return (
                            <div key={qi} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '.08em' }}>Question {qi + 1}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', background: ts.bg, color: ts.color }}>{q.type.toUpperCase()}</span>
                                {answered && <span style={{ marginLeft: 'auto', fontSize: 16 }}>{answers[qi] === q.correct ? '✅' : '❌'}</span>}
                              </div>
                              {q.context && <div style={{ fontSize: 13, color: 'var(--t2)', fontStyle: 'italic', marginBottom: 10, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, borderLeft: '3px solid var(--border)', lineHeight: 1.6 }}>{q.context}</div>}
                              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.5, marginBottom: 12 }}>{q.stem}</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                {q.options.map((opt, oi) => {
                                  const isRight = oi === q.correct
                                  const isChosen = answers[qi] === oi
                                  let border = '1px solid var(--border)', bg = 'var(--bg)', color = 'var(--t2)'
                                  if (answered) {
                                    if (isRight) { border = '1px solid var(--accent)'; bg = 'rgba(45,106,79,.08)'; color = 'var(--accent)' }
                                    else if (isChosen) { border = '1px solid var(--danger)'; bg = 'rgba(220,38,38,.06)'; color = 'var(--danger)' }
                                  }
                                  return (
                                    <button key={oi} onClick={() => answerQcm(qi, oi)} disabled={answered}
                                      style={{ padding: '10px 14px', borderRadius: 9, border, background: bg, fontSize: 13, color, cursor: answered ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', transition: 'all .15s', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                      <span style={{ fontWeight: 700, flexShrink: 0, width: 18 }}>{String.fromCharCode(65 + oi)}.</span>
                                      <span>{opt.replace(/^[A-D]\.\s*/, '')}</span>
                                    </button>
                                  )
                                })}
                              </div>
                              {answered && (
                                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(45,106,79,.05)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0', fontSize: 12, color: 'var(--t2)', lineHeight: 1.65 }}>
                                  <strong style={{ color: 'var(--t1)' }}>Explication :</strong> {q.explanation}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FLASHCARDS ── */}
        {tab === 'flashcards' && (
          <div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 10, padding: 4, marginBottom: 24, maxWidth: 360 }}>
              {(['revise', 'create'] as const).map(t => (
                <button key={t} onClick={() => setFcTab(t)}
                  style={{ flex: 1, padding: '9px', borderRadius: 7, fontSize: 13, cursor: 'pointer', border: fcTab === t ? '1px solid var(--border)' : 'none', background: fcTab === t ? 'var(--card)' : 'transparent', color: fcTab === t ? 'var(--accent)' : 'var(--t3)', fontWeight: fcTab === t ? 500 : 400, fontFamily: 'DM Sans, sans-serif' }}>
                  {t === 'revise' ? `Réviser (${flashcards.length} cartes)` : 'Créer / Gérer'}
                </button>
              ))}
            </div>

            {fcTab === 'revise' && (
              <div>
                {/* Score bar */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                  {[
                    { num: fcMastered, label: 'Maîtrisées', color: 'var(--accent)' },
                    { num: fcOk, label: 'À revoir', color: 'var(--gold)' },
                    { num: fcHard, label: 'Difficiles', color: 'var(--danger)' },
                    { num: flashcards.filter(f => f.status === 'new').length, label: 'Nouvelles', color: 'var(--t3)' },
                  ].map((s, i, arr) => (
                    <div key={s.label} style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div>
                        <div className="font-syne font-bold" style={{ fontSize: 28, color: s.color, lineHeight: 1 }}>{s.num}</div>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3, fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
                      </div>
                      {i < arr.length - 1 && <div style={{ width: 1, height: 40, background: 'var(--border)' }} />}
                    </div>
                  ))}
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ width: 160, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${((fcMastered + fcOk) / Math.max(flashcards.length, 1)) * 100}%`, transition: 'width .3s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{fcIndex + 1}/{flashcards.length} cartes</div>
                  </div>
                </div>

                {currentCard ? (
                  <>
                    {/* Card */}
                    <div onClick={() => setFcFlipped(f => !f)}
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 56px', textAlign: 'center', cursor: 'pointer', maxWidth: 680, margin: '0 auto 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform .1s' }}>
                      {!fcFlipped ? (
                        <>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16 }}>Question</div>
                          <div className="font-syne" style={{ fontSize: 22, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.4, marginBottom: 16 }}>{currentCard.q}</div>
                          <div style={{ fontSize: 13, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>↩</span> Clique pour révéler · ou appuie sur <strong>Espace</strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16 }}>Réponse</div>
                          <div style={{ fontSize: 17, color: 'var(--t1)', lineHeight: 1.65, maxWidth: 500 }}>{currentCard.a}</div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {fcFlipped ? (
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
                        {[
                          { status: 'hard' as const, label: '😵 Difficile', border: '#fca5a5', color: '#dc2626', bg: '#fff5f5', key: '1' },
                          { status: 'ok' as const, label: '🤔 À revoir', border: '#fcd34d', color: '#92400e', bg: '#fffbeb', key: '2' },
                          { status: 'easy' as const, label: '✅ Maîtrisé', border: '#b7dfca', color: '#2d6a4f', bg: '#f0faf5', key: '3' },
                        ].map(btn => (
                          <button key={btn.status} onClick={() => fcAnswer(btn.status)}
                            style={{ flex: 1, maxWidth: 160, borderRadius: 14, padding: '14px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: `2px solid ${btn.border}`, color: btn.color, background: btn.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            {btn.label}
                            <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', opacity: .6 }}>touche {btn.key}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--t3)', marginBottom: 24, fontFamily: 'DM Mono, monospace' }}>
                        Après révélation : <strong>1</strong> Difficile · <strong>2</strong> À revoir · <strong>3</strong> Maîtrisé
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => { setFcIndex(Math.max(0, fcIndex - 1)); setFcFlipped(false) }} className="btn btn-ghost btn-sm" disabled={fcIndex === 0}>← Précédente</button>
                      <button onClick={() => { setFcIndex(Math.min(flashcards.length - 1, fcIndex + 1)); setFcFlipped(false) }} className="btn btn-ghost btn-sm" disabled={fcIndex === flashcards.length - 1}>Suivante →</button>
                      <button onClick={() => { setFcIndex(0); setFcFlipped(false); setFlashcards(f => f.map(c => ({ ...c, status: 'new' as const }))) }} className="btn btn-ghost btn-sm">🔄 Recommencer</button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)', fontSize: 14 }}>Aucune flashcard — va dans &quot;Créer / Gérer&quot; pour en ajouter.</div>
                )}
              </div>
            )}

            {fcTab === 'create' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* IA generation */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
                  <div className="font-syne font-bold" style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>✨ Générer depuis mon cours</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <textarea className="input" rows={3} style={{ flex: 1, resize: 'vertical', fontSize: 13, fontStyle: 'italic', color: 'var(--t2)' }} placeholder="Colle ton cours ici — l'IA génère des flashcards Q/R sur les définitions, critères diagnostiques, scores…" value={fcCourseText} onChange={e => setFcCourseText(e.target.value)} />
                    <button onClick={generateFlashcards} disabled={fcGenerating || !fcCourseText.trim()} className="btn btn-primary" style={{ flexShrink: 0, opacity: fcGenerating ? 0.6 : 1 }}>
                      {fcGenerating ? '⏳...' : '🤖 Générer'}
                    </button>
                  </div>
                </div>

                {/* Manual creation */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
                  <div className="font-syne font-bold" style={{ fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>✏️ Ajouter une carte manuellement</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <input className="input" placeholder="Question / Recto de la carte" value={newQ} onChange={e => setNewQ(e.target.value)} />
                    <input className="input" placeholder="Réponse / Verso de la carte" value={newA} onChange={e => setNewA(e.target.value)} />
                  </div>
                  <button onClick={addFlashcard} disabled={!newQ.trim() || !newA.trim()} className="btn btn-ghost w-full" style={{ width: '100%', justifyContent: 'center', opacity: !newQ.trim() || !newA.trim() ? 0.5 : 1 }}>+ Ajouter cette carte</button>

                  {flashcards.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t2)', marginBottom: 10 }}>Cartes existantes ({flashcards.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {flashcards.map((fc, i) => (
                          <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{fc.q}</div>
                            <div style={{ flex: 1, fontSize: 12, color: 'var(--t3)' }}>{fc.a}</div>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: fc.status === 'easy' ? '#f0faf5' : fc.status === 'hard' ? '#fff5f5' : fc.status === 'ok' ? '#fffbeb' : 'var(--bg3)', color: fc.status === 'easy' ? '#2d6a4f' : fc.status === 'hard' ? '#dc2626' : fc.status === 'ok' ? '#92400e' : 'var(--t3)', fontFamily: 'DM Mono, monospace' }}>{fc.status}</span>
                            <button onClick={() => deleteFlashcard(i)} style={{ color: 'var(--border)', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onMouseOver={e => (e.currentTarget.style.color = 'var(--danger)')} onMouseOut={e => (e.currentTarget.style.color = 'var(--border)')}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ANNALES EDN ── */}
        {tab === 'annales' && (
          <div>
            <div className="font-syne font-bold" style={{ fontSize: 22, color: 'var(--t1)', marginBottom: 6 }}>Annales EDN</div>
            <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 24 }}>Questions issues des vraies annales, filtrées sur ce sujet. Réponds et vois la correction immédiatement.</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {['Tous', '2023', '2022', '2021', 'QCM', 'KFP'].map(f => (
                <button key={f} style={{ padding: '7px 16px', borderRadius: 20, fontSize: 13, border: f === 'Tous' ? '1px solid var(--accent)' : '1px solid var(--border)', background: f === 'Tous' ? 'var(--accent)' : 'var(--card)', color: f === 'Tous' ? '#fff' : 'var(--t2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{f}</button>
              ))}
            </div>

            {Object.keys(annalesAnswers).length === ANNALES.length && (
              <div style={{ background: 'rgba(45,106,79,.06)', border: '1px solid rgba(45,106,79,.2)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div className="font-syne font-bold" style={{ fontSize: 36, color: 'var(--accent)' }}>
                  {ANNALES.filter((q, i) => annalesAnswers[i] === q.correct).length}/{ANNALES.length}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)' }}>Score de la session</div>
                  <div style={{ fontSize: 13, color: 'var(--t3)' }}>{Math.round(ANNALES.filter((q, i) => annalesAnswers[i] === q.correct).length / ANNALES.length * 100)}% de réussite</div>
                </div>
                <button onClick={() => setAnnalesAnswers({})} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>🔄 Recommencer</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ANNALES.map((q, qi) => {
                const answered = annalesAnswers[qi] !== undefined
                return (
                  <div key={qi} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--t3)', flexShrink: 0 }}>{q.year}</span>
                      <span style={{ fontSize: 12, background: 'rgba(45,106,79,.08)', color: 'var(--accent)', borderRadius: 4, padding: '2px 8px' }}>{q.tag}</span>
                      {answered && <span style={{ marginLeft: 'auto', fontSize: 16 }}>{annalesAnswers[qi] === q.correct ? '✅' : '❌'}</span>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.5, marginBottom: 14 }}>{q.q}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.opts.map((opt, oi) => {
                        const isRight = oi === q.correct
                        const isChosen = annalesAnswers[qi] === oi
                        let border = '1px solid var(--border)', bg = 'var(--bg)', color = 'var(--t2)'
                        if (answered) {
                          if (isRight) { border = '1px solid var(--accent)'; bg = 'rgba(45,106,79,.08)'; color = 'var(--accent)' }
                          else if (isChosen) { border = '1px solid var(--danger)'; bg = 'rgba(220,38,38,.06)'; color = 'var(--danger)' }
                        }
                        return (
                          <button key={oi} onClick={() => !answered && setAnnalesAnswers(a => ({ ...a, [qi]: oi }))} disabled={answered}
                            style={{ padding: '11px 16px', borderRadius: 10, border, background: bg, fontSize: 14, color, cursor: answered ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 700, flexShrink: 0, width: 20 }}>{String.fromCharCode(65 + oi)}.</span>
                            <span>{opt}</span>
                            {answered && isRight && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600 }}>✓ Bonne réponse</span>}
                          </button>
                        )
                      })}
                    </div>
                    {answered && (
                      <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(45,106,79,.05)', borderLeft: '3px solid var(--accent)', borderRadius: '0 10px 10px 0', fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
                        <strong style={{ color: 'var(--t1)' }}>Correction :</strong> La réponse {String.fromCharCode(65 + q.correct)} est correcte. Voir référentiel EDN pour la justification complète.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// Sub-component for step cards
function StepCard({ i, lesson, t, activeStep, openStep, SCORE_COLORS, SCORE_BG, SCORE_BORDER }: {
  i: number; lesson: Lesson; t: string; activeStep: number | null;
  openStep: (i: number) => void;
  SCORE_COLORS: Record<number, string>; SCORE_BG: Record<number, string>; SCORE_BORDER: Record<number, string>;
}) {
  const step = lesson.steps[i] as StepEntry | null
  const ds = stepDate(lesson, i)
  const isFuture = ds && ds > t && i > 0
  const isToday = ds === t
  const isLate = ds && ds < t && !step && i > 0
  const isActive = activeStep === i

  let border = '1px solid var(--border)', bg = 'var(--card)'
  if (isActive) { border = '2px solid var(--accent)'; bg = 'rgba(45,106,79,.04)' }
  else if (step) { border = `1px solid ${SCORE_BORDER[step.score]}`; bg = SCORE_BG[step.score] }
  else if (isToday) { border = '1px solid rgba(45,106,79,.4)'; bg = 'rgba(45,106,79,.03)' }
  else if (isLate) { border = '1px solid rgba(220,38,38,.3)'; bg = 'rgba(220,38,38,.03)' }

  return (
    <div onClick={() => openStep(i)}
      style={{ border, background: bg, borderRadius: 12, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s', opacity: isFuture ? 0.45 : 1, boxShadow: isActive ? '0 0 0 3px rgba(45,106,79,.1)' : 'none' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: isToday ? 'var(--accent)' : isLate ? 'var(--danger)' : 'var(--t3)', marginBottom: 6 }}>{jLabel(i)}</div>
      {ds && <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>{fmtDate(ds)}</div>}
      {step ? (
        <>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: SCORE_COLORS[step.score], display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 16, color: '#fff', margin: '0 auto 4px' }}>{step.score}</div>
          {step.note && <div style={{ fontSize: 10, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.note}</div>}
        </>
      ) : (
        <div style={{ fontSize: 10, color: isLate ? 'var(--danger)' : isToday ? 'var(--accent)' : 'var(--t3)', fontStyle: 'italic' }}>
          {isLate ? 'Non fait' : isToday ? '📝 Aujourd\'hui' : 'À venir'}
        </div>
      )}
    </div>
  )
}
