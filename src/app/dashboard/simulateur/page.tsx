'use client'
// src/app/dashboard/simulateur/page.tsx

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Config officielle Sorbonne 2025-2026
const SORBONNE_CONFIG = {
  fac: 'Sorbonne Université',
  bareme: { correct: 0.2, incorrect: -0.1, abstention: 0 },
  semestres: [
    {
      id: 's1',
      label: 'Semestre 1 — Décembre',
      matieres: [
        { id: 'biochimie', name: 'Biochimie', emoji: '🧬', duree: 60, calculatrice: false, nbQcm: 20, description: 'Métabolisme, bioénergétique, enzymologie' },
        { id: 'biologie-cell', name: 'Biologie cellulaire', emoji: '🔬', duree: 90, calculatrice: false, nbQcm: 30, description: 'Cellule, tissus, histologie' },
        { id: 'anatomie', name: 'Anatomie générale', emoji: '🦴', duree: 45, calculatrice: false, nbQcm: 15, description: 'Morphologie et fonctions' },
        { id: 'physique', name: 'Physique', emoji: '⚡', duree: 45, calculatrice: true, nbQcm: 15, description: 'Mécanique, optique, électricité' },
        { id: 'chimie', name: 'Chimie', emoji: '⚗️', duree: 60, calculatrice: false, nbQcm: 20, description: 'Chimie organique et générale' },
      ]
    },
    {
      id: 's2',
      label: 'Semestre 2 — Mai',
      matieres: [
        { id: 'biophysique', name: 'Biophysique', emoji: '🌊', duree: 60, calculatrice: true, nbQcm: 20, description: 'Physique appliquée au vivant' },
        { id: 'physiologie', name: 'Physiologie', emoji: '❤️', duree: 45, calculatrice: false, nbQcm: 15, description: 'Fonctions des grands appareils' },
        { id: 'biostat', name: 'Biostatistiques', emoji: '📊', duree: 60, calculatrice: true, nbQcm: 20, description: 'Statistiques médicales' },
        { id: 'pharmaco', name: 'Pharmacologie', emoji: '💊', duree: 60, calculatrice: false, nbQcm: 20, description: 'Mécanismes et classes thérapeutiques' },
        { id: 'ssh', name: 'Santé, Société, Humanité', emoji: '🌍', duree: 60, calculatrice: false, nbQcm: 20, description: 'Sciences humaines et sociales' },
        { id: 'anatomie-spec', name: 'Anatomie spécifique', emoji: '🫀', duree: 45, calculatrice: false, nbQcm: 15, description: 'Anatomie des systèmes' },
      ]
    }
  ]
}

type Phase = 'select' | 'confirm' | 'exam' | 'results'

interface VFAnswer { a: boolean | null; b: boolean | null; c: boolean | null; d: boolean | null; e: boolean | null }
interface Question {
  stem: string
  context?: string
  items: { a: string; b: string; c: string; d: string; e: string }
  correct: { a: boolean; b: boolean; c: boolean; d: boolean; e: boolean }
  explanation: string
}
interface ExamResult {
  total: number; max: number; pct: number
  byItem: { correct: number; incorrect: number; abstention: number }
  questions: { q: Question; answer: VFAnswer; score: number }[]
}

export default function SimulateurPage() {
  const router = useRouter()
  const supabase = createClient()
  const [phase, setPhase] = useState<Phase>('select')
  const [semestre, setSemestre] = useState('s1')
  const [selectedMatiere, setSelectedMatiere] = useState<typeof SORBONNE_CONFIG.semestres[0]['matieres'][0] | null>(null)
  const [userFac, setUserFac] = useState('sorbonne')

  // Exam state
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<VFAnswer[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [results, setResults] = useState<ExamResult | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      const { data } = await supabase.from('profiles').select('fac').eq('id', user.id).single()
      if (data?.fac) setUserFac(data.fac)
    })
  }, [])

  const finishExam = useCallback((qs: Question[], ans: VFAnswer[]) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const bareme = SORBONNE_CONFIG.bareme
    let total = 0
    const byItem = { correct: 0, incorrect: 0, abstention: 0 }
    const detailed = qs.map((q, qi) => {
      const a = ans[qi] || { a: null, b: null, c: null, d: null, e: null }
      let score = 0
      const letters = ['a','b','c','d','e'] as const
      letters.forEach(l => {
        if (a[l] === null) { byItem.abstention++; score += bareme.abstention }
        else if (a[l] === q.correct[l]) { byItem.correct++; score += bareme.correct }
        else { byItem.incorrect++; score += bareme.incorrect }
      })
      score = Math.max(0, score)
      total += score
      return { q, answer: a, score: Math.round(score * 100) / 100 }
    })
    const max = qs.length * 5 * bareme.correct
    setResults({ total: Math.round(total * 100) / 100, max: Math.round(max * 100) / 100, pct: Math.round(total / max * 100), byItem, questions: detailed })
    setPhase('results')
  }, [])

  const startExam = async () => {
    if (!selectedMatiere) return
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/generate-pass-qcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matiere: selectedMatiere.name,
          nbQ: selectedMatiere.nbQcm,
          fac: 'Sorbonne Université',
          semestre: semestre === 's1' ? 1 : 2,
        })
      })
      const data = await res.json()
      if (!res.ok || !data.questions?.length) throw new Error(data.error || 'Erreur génération')
      setQuestions(data.questions)
      setAnswers(data.questions.map(() => ({ a: null, b: null, c: null, d: null, e: null })))
      setCurrentQ(0)
      setTimeLeft(selectedMatiere.duree * 60)
      setPhase('exam')
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            finishExam(data.questions, answers)
            return 0
          }
          return t - 1
        })
      }, 1000)
    } catch (e: any) {
      setGenError(e.message)
    }
    setGenerating(false)
  }

  const setVF = (item: keyof VFAnswer, val: boolean) => {
    setAnswers(prev => {
      const next = [...prev]
      const cur = { ...next[currentQ] }
      cur[item] = cur[item] === val ? null : val
      next[currentQ] = cur
      return next
    })
  }

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) setCurrentQ(q => q + 1)
    else finishExam(questions, answers)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const isUrgent = timeLeft < 300
  const progress = questions.length ? ((currentQ) / questions.length) * 100 : 0
  const sem = SORBONNE_CONFIG.semestres.find(s => s.id === semestre)!

  // ── PHASE: SELECT ──
  if (phase === 'select') return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-syne font-bold" style={{ fontSize: 28, color: 'var(--t1)', marginBottom: 6 }}>
          Simulateur d&apos;examen
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t3)', lineHeight: 1.6 }}>
          Conditions réelles · Barème officiel Sorbonne · Format 5 items Vrai/Faux
        </p>
      </div>

      {/* Fac badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '10px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <span style={{ fontSize: 16 }}>🎓</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>Sorbonne Université · PASS</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Barème : +0,2 correct · −0,1 incorrect · 0 abstention</div>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: 'var(--t3)', cursor: 'pointer' }}>
          Changer de fac →
        </button>
      </div>

      {/* Semestre tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 10, padding: 4, marginBottom: 24, maxWidth: 400 }}>
        {SORBONNE_CONFIG.semestres.map(s => (
          <button key={s.id} onClick={() => { setSemestre(s.id); setSelectedMatiere(null) }}
            style={{ flex: 1, padding: '9px 12px', borderRadius: 7, fontSize: 13, cursor: 'pointer', border: semestre === s.id ? '1px solid var(--border)' : 'none', background: semestre === s.id ? 'var(--card)' : 'transparent', color: semestre === s.id ? 'var(--accent)' : 'var(--t3)', fontWeight: semestre === s.id ? 500 : 400, fontFamily: 'DM Sans, sans-serif', transition: 'all .15s' }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Matières grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {sem.matieres.map(m => (
          <div key={m.id} onClick={() => setSelectedMatiere(m)}
            style={{ background: selectedMatiere?.id === m.id ? 'rgba(45,106,79,.04)' : 'var(--card)', border: `${selectedMatiere?.id === m.id ? '2px solid var(--accent)' : '1px solid var(--border)'}`, borderRadius: 14, padding: '18px 16px', cursor: 'pointer', transition: 'all .15s', boxShadow: selectedMatiere?.id === m.id ? '0 0 0 3px rgba(45,106,79,.1)' : 'none' }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>{m.emoji}</div>
            <div className="font-syne font-bold" style={{ fontSize: 15, color: 'var(--t1)', marginBottom: 4 }}>{m.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{m.description}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--t2)', fontFamily: 'DM Mono, monospace' }}>
                {m.duree} min
              </span>
              <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--t2)', fontFamily: 'DM Mono, monospace' }}>
                {m.nbQcm} QCM
              </span>
              {m.calculatrice && (
                <span style={{ background: 'rgba(45,106,79,.08)', border: '1px solid rgba(45,106,79,.2)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>
                  🖩 calc.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Launch panel */}
      {selectedMatiere && (
        <div style={{ background: 'var(--card)', border: '2px solid var(--accent)', borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 32 }}>{selectedMatiere.emoji}</div>
          <div style={{ flex: 1 }}>
            <div className="font-syne font-bold" style={{ fontSize: 18, color: 'var(--t1)', marginBottom: 4 }}>{selectedMatiere.name}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--t3)' }}>
              <span>⏱ {selectedMatiere.duree} minutes</span>
              <span>📝 {selectedMatiere.nbQcm} questions · 5 items V/F chacune</span>
              <span>{selectedMatiere.calculatrice ? '🖩 Calculatrice autorisée' : '🚫 Sans calculatrice'}</span>
            </div>
          </div>
          <button onClick={() => setPhase('confirm')} className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 15, flexShrink: 0 }}>
            Lancer ▶
          </button>
        </div>
      )}

      {genError && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 10, fontSize: 13, color: 'var(--danger)' }}>
          ❌ {genError}
        </div>
      )}
    </div>
  )

  // ── PHASE: CONFIRM ──
  if (phase === 'confirm') return (
    <div style={{ padding: '60px 40px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
      <h2 className="font-syne font-bold" style={{ fontSize: 24, color: 'var(--t1)', marginBottom: 12 }}>
        Prêt·e à commencer ?
      </h2>
      <p style={{ fontSize: 15, color: 'var(--t3)', lineHeight: 1.7, marginBottom: 32 }}>
        Tu vas simuler l&apos;épreuve <strong style={{color:'var(--t1)'}}>{selectedMatiere?.name}</strong> dans les conditions réelles du concours Sorbonne.
      </p>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 28, textAlign: 'left' }}>
        {[
          ['⏱', 'Durée', `${selectedMatiere?.duree} minutes chrono`],
          ['📝', 'Format', `${selectedMatiere?.nbQcm} QCM · 5 items Vrai/Faux par question`],
          ['📊', 'Barème', '+0,2 correct · −0,1 incorrect · 0 abstention'],
          ['🚫', 'Règle', 'Impossible de revenir à une question précédente'],
          [selectedMatiere?.calculatrice ? '🖩' : '🚫', 'Calculatrice', selectedMatiere?.calculatrice ? 'Autorisée' : 'Non autorisée'],
        ].map(([icon, label, value]) => (
          <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
            <span style={{ fontSize: 13, color: 'var(--t3)', width: 100 }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button onClick={() => setPhase('select')} className="btn btn-ghost" style={{ padding: '12px 24px' }}>
          ← Annuler
        </button>
        <button onClick={startExam} disabled={generating} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15, opacity: generating ? .6 : 1 }}>
          {generating ? '⏳ Génération des questions…' : '🚀 Démarrer l\'examen'}
        </button>
      </div>
    </div>
  )

  // ── PHASE: EXAM ──
  if (phase === 'exam' && questions.length > 0) {
    const q = questions[currentQ]
    const a = answers[currentQ]
    const answeredItems = Object.values(a).filter(v => v !== null).length

    return (
      <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
        {/* Exam topbar */}
        <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div className="font-syne font-bold" style={{ fontSize: 16, color: 'var(--t1)' }}>{selectedMatiere?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Sorbonne · PASS · {semestre.toUpperCase()}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: isUrgent ? 'rgba(220,38,38,.06)' : 'var(--bg2)', border: `1px solid ${isUrgent ? 'rgba(220,38,38,.3)' : 'var(--border)'}`, borderRadius: 10, padding: '8px 16px' }}>
            <span style={{ fontSize: 22, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: isUrgent ? 'var(--danger)' : 'var(--t1)' }}>
              {formatTime(timeLeft)}
            </span>
            <span style={{ fontSize: 11, color: isUrgent ? 'var(--danger)' : 'var(--t3)' }}>restantes</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
            QCM {currentQ + 1}/{questions.length}
          </span>
          <div style={{ flex: 1, height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${progress}%`, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
            {answeredItems}/5 items
          </span>
        </div>

        {/* Question body */}
        <div style={{ padding: '32px 40px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span> Examen en cours · Impossible de revenir en arrière · Barème dégressif appliqué
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Question {currentQ + 1}
            </span>
            <span style={{ background: 'rgba(45,106,79,.1)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
              5 items V/F
            </span>
          </div>

          {q.context && (
            <div style={{ fontSize: 14, color: 'var(--t2)', fontStyle: 'italic', marginBottom: 14, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 8, borderLeft: '3px solid var(--border)', lineHeight: 1.65 }}>
              {q.context}
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.55, marginBottom: 24 }}>{q.stem}</div>

          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12, fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Pour chaque item, indiquer Vrai ou Faux
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {(['a','b','c','d','e'] as const).map(letter => (
              <div key={letter} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--t3)', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                  {letter.toUpperCase()}
                </span>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--t1)', lineHeight: 1.5 }}>
                  {q.items[letter]}
                </span>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setVF(letter, true)}
                    style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `2px solid ${a[letter] === true ? 'var(--accent)' : 'var(--border)'}`, background: a[letter] === true ? 'rgba(45,106,79,.1)' : 'var(--bg2)', color: a[letter] === true ? 'var(--accent)' : 'var(--t2)', fontFamily: 'DM Sans, sans-serif', transition: 'all .15s' }}>
                    Vrai
                  </button>
                  <button onClick={() => setVF(letter, false)}
                    style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `2px solid ${a[letter] === false ? 'var(--danger)' : 'var(--border)'}`, background: a[letter] === false ? 'rgba(220,38,38,.08)' : 'var(--bg2)', color: a[letter] === false ? 'var(--danger)' : 'var(--t2)', fontFamily: 'DM Sans, sans-serif', transition: 'all .15s' }}>
                    Faux
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => finishExam(questions, answers)} className="btn btn-ghost btn-sm">
              Terminer l&apos;examen
            </button>
            <button onClick={nextQuestion} className="btn btn-primary" style={{ padding: '11px 28px', fontSize: 14 }}>
              {currentQ < questions.length - 1 ? 'Question suivante →' : 'Terminer et voir les résultats'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── PHASE: RESULTS ──
  if (phase === 'results' && results) {
    const scoreColor = results.pct >= 70 ? 'var(--accent)' : results.pct >= 50 ? 'var(--gold)' : 'var(--danger)'
    const scoreMsg = results.pct >= 70 ? '🎯 Excellent niveau !' : results.pct >= 50 ? '👍 Bien, continue !' : '📚 À retravailler'

    return (
      <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
        {/* Score header */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '32px 36px', marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 8, fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            {selectedMatiere?.name} · Sorbonne PASS
          </div>
          <div className="font-syne font-bold" style={{ fontSize: 64, color: scoreColor, lineHeight: 1, marginBottom: 8 }}>
            {results.total}/{results.max}
          </div>
          <div style={{ fontSize: 18, color: 'var(--t2)', marginBottom: 20 }}>
            {results.pct}% · {scoreMsg}
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            {[
              { label: 'Items corrects', val: results.byItem.correct, color: 'var(--accent)', bg: 'rgba(45,106,79,.08)' },
              { label: 'Items incorrects', val: results.byItem.incorrect, color: 'var(--danger)', bg: 'rgba(220,38,38,.06)' },
              { label: 'Abstentions', val: results.byItem.abstention, color: 'var(--t3)', bg: 'var(--bg2)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
                <div className="font-syne font-bold" style={{ fontSize: 28, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <button onClick={() => { setPhase('select'); setSelectedMatiere(null); setQuestions([]); setAnswers([]); setResults(null) }} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
            ← Choisir une autre matière
          </button>
          <button onClick={() => setPhase('confirm')} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
            🔄 Recommencer {selectedMatiere?.name}
          </button>
        </div>

        {/* Détail par question */}
        <div className="font-syne font-bold" style={{ fontSize: 18, marginBottom: 16, color: 'var(--t1)' }}>
          Correction détaillée
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {results.questions.map((r, qi) => (
            <div key={qi} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Question {qi + 1}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: r.score > 0 ? 'var(--accent)' : r.score === 0 ? 'var(--t3)' : 'var(--danger)' }}>
                  {r.score > 0 ? '+' : ''}{r.score} pt
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 14, lineHeight: 1.5 }}>{r.q.stem}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {(['a','b','c','d','e'] as const).map(letter => {
                  const isCorrect = r.answer[letter] === r.q.correct[letter]
                  const wasNull = r.answer[letter] === null
                  return (
                    <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: wasNull ? 'var(--bg2)' : isCorrect ? 'rgba(45,106,79,.06)' : 'rgba(220,38,38,.04)', border: `1px solid ${wasNull ? 'var(--border)' : isCorrect ? 'rgba(45,106,79,.2)' : 'rgba(220,38,38,.2)'}` }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: 'var(--t3)', width: 16 }}>{letter.toUpperCase()}</span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--t2)' }}>{r.q.items[letter]}</span>
                      <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: wasNull ? 'var(--t3)' : isCorrect ? 'var(--accent)' : 'var(--danger)' }}>
                        {wasNull ? '—' : r.answer[letter] ? 'Vrai' : 'Faux'} → {r.q.correct[letter] ? 'Vrai ✓' : 'Faux ✓'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(45,106,79,.04)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0', fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
                <strong style={{ color: 'var(--t1)' }}>Explication :</strong> {r.q.explanation}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
}
