// src/lib/qcmMissed.ts
//
// Deux choses autour des QCM ratés d'une fiche :
//
// 1. Savoir quelles questions sont « ratées » à l'instant T, pour proposer
//    « Refaire les ratées » dès l'ouverture de la fiche (avant, il fallait
//    finir une session entière). Une question est ratée quand sa DERNIÈRE
//    tentative était fausse (champ last_correct). Les questions répondues
//    avant l'ajout de ce champ n'ont que des compteurs cumulés : on les
//    considère ratées si elles ont été ratées au moins une fois. Dès qu'on
//    y répond à nouveau, last_correct prend le relais.
//
// 2. Fabriquer des flashcards à partir des erreurs. Une carte par
//    proposition mal jugée (cochée alors que fausse, ou vraie et oubliée) :
//    recto = l'énoncé + la proposition, verso = Vrai ou Faux (+ la
//    justification de la proposition quand la question en a une).

import type { AiQuestion, Flashcard } from '@/types'
import { normalizeAnswer } from '@/types'
import { whyFor } from '@/lib/qcmText'

export function isMissed(q: AiQuestion): boolean {
  if (typeof q.last_correct === 'boolean') return !q.last_correct
  const attempts = q.attempts || 0
  return attempts > 0 && (q.correct || 0) < attempts
}

export function missedIndices(qs: AiQuestion[] | null | undefined): number[] {
  if (!Array.isArray(qs)) return []
  return qs.map((q, i) => (isMissed(q) ? i : -1)).filter(i => i >= 0)
}

function stripLetter(s: string): string {
  return s.replace(/^\s*[A-E][.)]\s*/, '').trim()
}

// Clé stable d'une proposition : même question + même proposition = même
// carte. Évite de recréer la carte à chaque fois qu'on se retrompe.
function keyFor(question: string, option: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  return norm(question) + '||' + norm(option)
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

/**
 * Ajoute au paquet les cartes des propositions mal jugées. Renvoie le
 * nouveau paquet et le nombre de cartes réellement ajoutées.
 */
export function addCardsFromMistakes(
  existing: Flashcard[],
  mistakes: { q: AiQuestion; selected: number[] }[],
): { cards: Flashcard[]; added: number } {
  const known = new Set(existing.map(c => c.qkey).filter(Boolean) as string[])
  const now = new Date().toISOString()
  const fresh: Flashcard[] = []

  for (const { q, selected } of mistakes) {
    const correct = normalizeAnswer(q.answer)
    q.options.forEach((opt, i) => {
      const isTrue = correct.includes(i)
      const wasChecked = selected.includes(i)
      if (isTrue === wasChecked) return // proposition bien jugée
      const prop = stripLetter(opt)
      if (!prop) return
      const qkey = keyFor(q.question, prop)
      if (known.has(qkey)) return
      known.add(qkey)
      const why = whyFor(q, i, q.options.length)
      fresh.push({
        id: makeId(),
        front: `${q.question.trim()}\n${prop}`,
        back: why ? `${isTrue ? 'Vrai' : 'Faux'}\n${why}` : (isTrue ? 'Vrai' : 'Faux'),
        created_at: now,
        origin: 'qcm',
        stem: q.question.trim(),
        prop,
        verdict: isTrue,
        why: why || undefined,
        qkey,
      })
    })
  }
  return { cards: [...existing, ...fresh], added: fresh.length }
}
