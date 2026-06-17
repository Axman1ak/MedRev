'use client'
// src/components/ReportQuestion.tsx
//
// Bouton "signaler cette question" sur un QCM.
// Un clic ouvre 4 motifs ; choisir un motif enregistre un signalement dans
// public.question_reports (RLS : insert/select limités au user). Objectif :
// qu'un QCM douteux remonte en un geste, pour protéger le bouche-à-oreille.
//
// Autonome : styles inline, aucune dépendance CSS. Réutilisable tel quel dans
// le simulateur (passer source="simulateur").

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AiQuestion } from '@/types'

const REASONS: { key: string; label: string }[] = [
  { key: 'wrong_answer', label: 'Réponse fausse' },
  { key: 'unclear', label: 'Pas claire' },
  { key: 'off_topic', label: 'Hors programme' },
  { key: 'other', label: 'Autre' },
]

type Status = 'idle' | 'open' | 'sending' | 'done' | 'error'

const S: Record<string, CSSProperties> = {
  trigger: {
    background: 'none', border: 'none', color: '#9A9E98', fontSize: 12,
    cursor: 'pointer', textDecoration: 'underline', padding: '6px 0',
  },
  note: { fontSize: 12, color: '#6B6F6A', padding: '6px 0' },
  wrap: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    padding: '6px 0',
  },
  q: { fontSize: 12, color: '#6B6F6A' },
  reason: {
    background: '#fff', border: '1px solid #E1DDD3', borderRadius: 999,
    padding: '4px 10px', fontSize: 12, color: '#111310', cursor: 'pointer',
  },
  cancel: {
    background: 'none', border: 'none', color: '#9A9E98', fontSize: 12,
    cursor: 'pointer',
  },
}

export default function ReportQuestion({
  lessonId,
  source,
  questionIndex,
  question,
}: {
  lessonId: string | null
  source: string
  questionIndex: number
  question: AiQuestion
}) {
  const supabase = createClient()
  const [status, setStatus] = useState<Status>('idle')

  async function submit(reason: string) {
    setStatus('sending')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('error'); return }
      const { error } = await supabase.from('question_reports').insert({
        user_id: user.id,
        lesson_id: lessonId,
        source,
        question_index: questionIndex,
        question_text: question.question ?? '',
        options: question.options ?? [],
        answer: question.answer ?? null,
        reason,
      })
      setStatus(error ? 'error' : 'done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return <div style={S.note}>Question signalée, merci. On vérifie.</div>
  }

  if (status === 'error') {
    return <div style={S.note}>Signalement impossible pour le moment.</div>
  }

  if (status === 'idle') {
    return (
      <button type="button" style={S.trigger} onClick={() => setStatus('open')}>
        Signaler cette question
      </button>
    )
  }

  // status === 'open' || 'sending'
  return (
    <div style={S.wrap}>
      <span style={S.q}>Un souci avec cette question&nbsp;?</span>
      {REASONS.map(r => (
        <button
          key={r.key}
          type="button"
          style={S.reason}
          disabled={status === 'sending'}
          onClick={() => submit(r.key)}
        >
          {r.label}
        </button>
      ))}
      <button
        type="button"
        style={S.cancel}
        disabled={status === 'sending'}
        onClick={() => setStatus('idle')}
      >
        Annuler
      </button>
    </div>
  )
}
