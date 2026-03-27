'use client'
// src/components/QcmPanel.tsx

import { useState } from 'react'
import type { Lesson, AiQuestion } from '@/types'

interface Props {
  lesson: Lesson
  isPro: boolean
  onSave: (questions: AiQuestion[]) => Promise<void>
}

type SourceTab = 'text' | 'file'
type Format = 'mixed' | 'qcm' | 'kfp' | 'vf'
type Difficulty = 'annales' | 'concours' | 'appro'

export default function QcmPanel({ lesson, isPro, onSave }: Props) {
  const [sourceTab, setSourceTab] = useState<SourceTab>('text')
  const [courseText, setCourseText] = useState('')
  const [fileName, setFileName] = useState('')
  const [nbQ, setNbQ] = useState(10)
  const [format, setFormat] = useState<Format>('mixed')
  const [difficulty, setDifficulty] = useState<Difficulty>('annales')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<AiQuestion[]>(lesson.ai_questions || [])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setFileName(file.name)
    if (file.type === 'application/pdf') {
      setCourseText(`[PDF: ${file.name}] — L'IA va générer des questions sur le sujet "${lesson.name}" en se basant sur les référentiels officiels.`)
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        setCourseText(ev.target?.result as string)
        toast(`✅ ${file.name} — ${Math.round((ev.target?.result as string).length / 100) / 10}K caractères`)
      }
      reader.readAsText(file)
    }
  }

  async function generate() {
    setGenerating(true)
    setAnswers({})
    setShowResults(false)

    try {
      const res = await fetch('/api/generate-qcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonName: lesson.name,
          courseText: courseText.slice(0, 12000),
          nbQ,
          format,
          difficulty,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      setQuestions(data.questions)
      await onSave(data.questions)
      toast(`✨ ${data.questions.length} questions générées !`)
    } catch (err) {
      console.error(err)
      toast('❌ Erreur — vérifiez votre clé API dans les variables d\'environnement')
    }
    setGenerating(false)
  }

  function answer(qi: number, oi: number) {
    if (answers[qi] !== undefined) return
    setAnswers(prev => ({ ...prev, [qi]: oi }))
    const correct = questions[qi].correct
    if (oi === correct) toast('✅ Bonne réponse !')
    else toast('❌ Mauvaise réponse')
    if (Object.keys({ ...answers, [qi]: oi }).length === questions.length) {
      setShowResults(true)
    }
  }

  function reset() {
    setAnswers({})
    setShowResults(false)
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

  const TYPE_LABELS: Record<string, string> = { qcm: 'QCM', kfp: 'KFP', vf: 'V/F' }
  const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
    qcm: { bg: 'rgba(45,106,79,.1)', color: 'var(--accent)' },
    kfp: { bg: 'rgba(109,40,217,.1)', color: 'var(--purple)' },
    vf:  { bg: 'rgba(217,119,6,.1)', color: 'var(--gold)' },
  }

  // Score colors adapted for light mode
  const SCORE_COLORS: Record<number, string> = {
    1: '#dc2626', 2: '#ea580c', 3: '#ca8a04', 4: '#16a34a', 5: '#2d6a4f'
  }
  const SCORE_TEXT: Record<number, string> = {
    1: '#fff', 2: '#fff', 3: '#fff', 4: '#fff', 5: '#fff'
  }

  if (!isPro) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', gap: 14, background: 'rgba(109,40,217,.04)', border: '1px solid rgba(109,40,217,.12)', borderRadius: 14 }}>
        <div style={{ fontSize: 36 }}>🔒</div>
        <div className="font-syne font-bold text-base" style={{ color: 'var(--t1)' }}>QCM IA — niveau annales</div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--t3)', maxWidth: 280 }}>
          Générez des QCM précis sur vos cours, au niveau des annales EDN, avec upload de PDF.<br />
          Réservé aux membres Premium.
        </p>
        <a href="/dashboard/pricing" className="btn btn-primary" style={{ textDecoration: 'none' }}>Passer Premium →</a>
      </div>
    )
  }

  const correctCount = questions.filter((q, i) => answers[i] === q.correct).length
  const pct = questions.length ? Math.round(correctCount / questions.length * 100) : 0

  return (
    <div>
      <div className="font-syne font-bold text-base mb-4" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
        ✨ QCM IA — niveau annales EDN
        {questions.length > 0 && !generating && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t3)', fontFamily: 'DM Sans', fontWeight: 400 }}>
            {questions.length} questions sauvegardées
          </span>
        )}
      </div>

      {/* Source tabs */}
      <div className="flex gap-1 p-0.5 rounded-xl mb-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        {(['text', 'file'] as const).map(t => (
          <button key={t} onClick={() => setSourceTab(t)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer transition-all"
            style={{ background: sourceTab === t ? 'var(--accent)' : 'transparent', color: sourceTab === t ? '#fff' : 'var(--t3)', fontFamily: 'DM Sans' }}>
            {t === 'text' ? '📝 Coller le cours' : '📄 Uploader un fichier'}
          </button>
        ))}
      </div>

      {/* Source input */}
      {sourceTab === 'text' ? (
        <textarea
          className="input mb-3"
          rows={6}
          placeholder={`Colle ici le contenu de ton cours, tes notes, ou un extrait de référentiel.\n\nPlus le texte est précis et complet, plus les questions seront niveau annales EDN.`}
          value={courseText}
          onChange={e => setCourseText(e.target.value)}
          style={{ resize: 'vertical', lineHeight: 1.6, fontSize: 13 }}
        />
      ) : (
        <div>
          <label htmlFor="qcm-file-input"
            style={{ display: 'block', border: `2px dashed ${fileName ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', background: fileName ? 'rgba(45,106,79,.05)' : 'var(--bg2)', marginBottom: 12 }}>
            <div className="text-sm font-semibold mb-1" style={{ color: fileName ? 'var(--accent)' : 'var(--t2)' }}>
              {fileName ? `📄 ${fileName}` : '📤 Cliquer pour uploader'}
            </div>
            <div className="text-xs" style={{ color: 'var(--t3)' }}>
              {fileName ? 'Cliquer pour changer' : 'PDF, TXT, Markdown — max 5 Mo'}
            </div>
          </label>
          <input id="qcm-file-input" type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center p-3 rounded-xl mb-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--t3)' }}>Questions</span>
          <select className="input text-xs" style={{ width: 70, padding: '4px 8px' }} value={nbQ} onChange={e => setNbQ(+e.target.value)}>
            {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--t3)' }}>Format</span>
          <select className="input text-xs" style={{ width: 180, padding: '4px 8px' }} value={format} onChange={e => setFormat(e.target.value as Format)}>
            <option value="mixed">Mixte (QCM + KFP + V/F)</option>
            <option value="qcm">QCM classiques</option>
            <option value="kfp">KFP (vignette clinique)</option>
            <option value="vf">Vrai / Faux raisonné</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--t3)' }}>Niveau</span>
          <select className="input text-xs" style={{ width: 150, padding: '4px 8px' }} value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
            <option value="annales">Annales EDN</option>
            <option value="concours">Concours blanc</option>
            <option value="appro">Approfondi</option>
          </select>
        </div>
      </div>

      {/* Generate button */}
      <button onClick={generate} disabled={generating}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border-0 cursor-pointer transition-all mb-5"
        style={{ background: 'var(--accent)', color: '#fff', opacity: generating ? 0.5 : 1, fontFamily: 'DM Sans' }}>
        {generating ? <><div className="spinner" /> Génération en cours...</> : '🤖 Générer les questions'}
      </button>

      {/* Loading */}
      {generating && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, color: 'var(--t3)', fontSize: 13 }}>
          <div className="spinner" /> L&apos;IA analyse votre cours et génère {nbQ} questions...
        </div>
      )}

      {/* Results score */}
      {showResults && (
        <div style={{ background: 'rgba(45,106,79,.06)', border: '1px solid rgba(45,106,79,.2)', borderRadius: 12, padding: 18, textAlign: 'center', marginBottom: 20 }}>
          <div className="font-syne font-black" style={{ fontSize: 40, color: 'var(--accent)', lineHeight: 1 }}>{correctCount}/{questions.length}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
            {pct}% — {pct >= 80 ? '🎯 Excellent niveau annales !' : pct >= 60 ? '👍 Bien, continuez !' : '📚 À retravailler avant le J+'}
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs" style={{ color: 'var(--t3)' }}>
            <span>✅ {correctCount} correctes</span>
            <span>❌ {questions.length - correctCount} à revoir</span>
          </div>
          <button onClick={reset} className="btn btn-ghost btn-sm mt-3">🔄 Recommencer</button>
        </div>
      )}

      {/* Questions */}
      {!generating && questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((q, qi) => {
            const answered = answers[qi] !== undefined
            const isCorrect = answers[qi] === q.correct
            const typeStyle = TYPE_STYLES[q.type] || TYPE_STYLES.qcm

            return (
              <div key={qi} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="font-syne font-bold text-xs" style={{ color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Question {qi + 1}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em', background: typeStyle.bg, color: typeStyle.color }}>
                    {TYPE_LABELS[q.type] || 'QCM'}
                  </span>
                  {answered && (
                    <span style={{ marginLeft: 'auto', fontSize: 16 }}>{isCorrect ? '✅' : '❌'}</span>
                  )}
                </div>

                {/* Clinical vignette */}
                {q.context && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', marginBottom: 10, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 7, borderLeft: '3px solid var(--border)', lineHeight: 1.6 }}>
                    {q.context}
                  </div>
                )}

                {/* Stem */}
                <div className="text-sm font-semibold mb-3" style={{ color: 'var(--t1)', lineHeight: 1.5 }}>{q.stem}</div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {q.options.map((opt, oi) => {
                    const isAnswered = answered
                    const isChosen = answers[qi] === oi
                    const isRight = oi === q.correct

                    let borderColor = 'var(--border)'
                    let bg = 'var(--bg)'
                    let color = 'var(--t2)'
                    if (isAnswered) {
                      if (isRight) { borderColor = 'var(--accent)'; bg = 'rgba(45,106,79,.08)'; color = 'var(--accent)' }
                      else if (isChosen && !isRight) { borderColor = 'var(--danger)'; bg = 'rgba(220,38,38,.06)'; color = 'var(--danger)' }
                    }

                    return (
                      <button key={oi}
                        onClick={() => answer(qi, oi)}
                        disabled={isAnswered}
                        style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${borderColor}`, background: bg, fontSize: 13, color, cursor: isAnswered ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'DM Sans', transition: 'all .15s', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontWeight: 700, flexShrink: 0, width: 18 }}>
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        <span>{opt.replace(/^[A-D]\.\s*/, '')}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Explanation */}
                {answered && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(45,106,79,.05)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0', fontSize: 12, color: 'var(--t2)', lineHeight: 1.65 }}>
                    <strong style={{ color: 'var(--t1)' }}>Explication :</strong> {q.explanation}
                    {q.source_ref && q.source_ref !== 'null' && (
                      <span style={{ display: 'inline-block', background: 'rgba(45,106,79,.1)', color: 'var(--accent)', fontSize: 11, padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                        📖 {q.source_ref.slice(0, 60)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!generating && questions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--t3)', fontSize: 13, lineHeight: 1.7 }}>
          Collez le contenu de votre cours<br />ou uploadez un PDF, puis cliquez sur Générer.
        </div>
      )}
    </div>
  )
}
