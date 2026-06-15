'use client'
// src/app/dashboard/fiches/[lessonId]/cartes/page.tsx
//
// Flashcards maison (recto/verso) par fiche — création manuelle uniquement.
// 2 modes : gestion (liste + ajout/édition/suppression) et révision
// (flip recto→verso, "Je savais" / "À revoir", boucle sur les ratées).
// Stockage : colonne lessons.flashcards (jsonb), même pattern que ai_questions.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Lesson, System, Flashcard } from '@/types'
import './styles.css'

type Phase = 'loading' | 'manage' | 'review' | 'end'

// Identifiant local unique. crypto.randomUUID est dispo dans tous les
// navigateurs modernes ; fallback simple au cas où (vieux Safari).
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// Mélange Fisher-Yates (même implémentation que la session QCM).
function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp
  }
  return a
}

function readCards(l: Lesson | null): Flashcard[] {
  if (!l) return []
  const raw = (l as { flashcards?: unknown }).flashcards
  return Array.isArray(raw) ? (raw as Flashcard[]) : []
}

export default function CartesPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [system, setSystem] = useState<System | null>(null)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Formulaire d'ajout
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')

  // Édition inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  // Session de révision
  const [deck, setDeck] = useState<Flashcard[]>([])
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})

  // Reset scroll au montage (cohérent avec les autres pages dashboard)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [])

  // Load lesson + system
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: les, error: lesErr } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .eq('user_id', user.id)
        .single()

      if (cancelled) return
      if (lesErr || !les) { router.push('/dashboard/fiches'); return }

      const { data: sys } = await supabase
        .from('systems')
        .select('*')
        .eq('id', les.system_id)
        .single()

      if (cancelled) return
      setLesson(les as Lesson)
      setSystem((sys as System) ?? null)
      setCards(readCards(les as Lesson))
      setPhase('manage')
    }
    load()
    return () => { cancelled = true }
  }, [lessonId, router, supabase])

  // Persiste le tableau complet en DB, met à jour le state local.
  // On ne touche qu'à la colonne flashcards — jamais à steps.
  const saveCards = useCallback(async (next: Flashcard[]): Promise<boolean> => {
    if (!lesson) return false
    setSaveError(null)
    const { error } = await supabase
      .from('lessons')
      .update({ flashcards: next })
      .eq('id', lesson.id)
    if (error) {
      console.error('[saveCards] update failed:', error)
      setSaveError(error.message)
      return false
    }
    setCards(next)
    setLesson(prev => (prev ? { ...prev, flashcards: next } : prev))
    return true
  }, [lesson, supabase])

  // ---- Gestion des cartes ----
  async function addCard() {
    const front = newFront.trim()
    const back = newBack.trim()
    if (!front || !back) return
    const card: Flashcard = {
      id: makeId(),
      front,
      back,
      created_at: new Date().toISOString(),
    }
    const ok = await saveCards([...cards, card])
    if (ok) { setNewFront(''); setNewBack('') }
  }

  function openEdit(c: Flashcard) {
    setEditingId(c.id)
    setEditFront(c.front)
    setEditBack(c.back)
  }

  async function saveEdit() {
    if (!editingId) return
    const front = editFront.trim()
    const back = editBack.trim()
    if (!front || !back) return
    const ok = await saveCards(cards.map(c =>
      c.id === editingId ? { ...c, front, back } : c
    ))
    if (ok) setEditingId(null)
  }

  async function deleteCard(id: string) {
    const ok = await saveCards(cards.filter(c => c.id !== id))
    if (ok && editingId === id) setEditingId(null)
  }

  // ---- Session de révision ----
  function startReview(subset?: Flashcard[]) {
    const pool = subset ?? cards
    if (pool.length === 0) return
    setDeck(shuffleArr(pool))
    setPos(0)
    setFlipped(false)
    setResults({})
    setPhase('review')
  }

  async function mark(known: boolean) {
    const card = deck[pos]
    if (!card) return
    const nextResults = { ...results, [card.id]: known }
    setResults(nextResults)
    if (pos < deck.length - 1) {
      setPos(pos + 1)
      setFlipped(false)
      return
    }
    // Fin de session : on cumule les compteurs sur les cartes vues
    // puis on persiste en une seule requête.
    const now = new Date().toISOString()
    const next = cards.map(c => {
      const r = nextResults[c.id]
      if (r === undefined) return c
      return {
        ...c,
        reviews: (c.reviews || 0) + 1,
        known: (c.known || 0) + (r ? 1 : 0),
        last_reviewed_at: now,
      }
    })
    await saveCards(next)
    setPhase('end')
  }

  // ---- Dérivées ----
  if (phase === 'loading' || !lesson) {
    return <div className="fc-page"><div className="fc-loading">Chargement…</div></div>
  }

  const sysName = system?.name ?? ''
  const current = deck[pos] ?? null
  const knownCount = Object.values(results).filter(Boolean).length
  const missedCards = deck.filter(c => results[c.id] === false)

  return (
    <div className="fc-page">

      {/* HEADER */}
      <div className="fc-head">
        <div className="fc-head-left">
          <Link href="/dashboard/fiches" className="fc-back">{'←'} Fiches</Link>
          <h1 className="fc-title">{lesson.name}</h1>
          <div className="fc-sub">
            {sysName && <>{sysName} · </>}
            {cards.length} carte{cards.length > 1 ? 's' : ''} recto/verso
          </div>
        </div>
        {phase === 'manage' && cards.length > 0 && (
          <button className="fc-btn-primary" onClick={() => startReview()}>
            Réviser les {cards.length} carte{cards.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {saveError && (
        <div className="fc-error">Sauvegarde impossible : {saveError}</div>
      )}

      {/* ================= MODE GESTION ================= */}
      {phase === 'manage' && (
        <>
          {/* Formulaire d'ajout */}
          <div className="fc-add">
            <div className="fc-add-fields">
              <label className="fc-field">
                <span className="fc-field-label">Recto · question</span>
                <textarea
                  className="fc-ta"
                  rows={2}
                  placeholder="ex : Quelles sont les 3 étapes irréversibles de la glycolyse ?"
                  value={newFront}
                  onChange={e => setNewFront(e.target.value)}
                />
              </label>
              <label className="fc-field">
                <span className="fc-field-label">Verso · réponse</span>
                <textarea
                  className="fc-ta"
                  rows={2}
                  placeholder="ex : Hexokinase, PFK-1, pyruvate kinase"
                  value={newBack}
                  onChange={e => setNewBack(e.target.value)}
                />
              </label>
            </div>
            <button
              className="fc-btn-primary"
              onClick={addCard}
              disabled={!newFront.trim() || !newBack.trim()}
            >
              + Ajouter la carte
            </button>
          </div>

          {/* Liste */}
          {cards.length === 0 ? (
            <div className="fc-empty">
              <div className="fc-empty-title">Aucune carte pour cette fiche</div>
              <p className="fc-empty-text">
                Une carte = une question au recto, la réponse au verso.
                Idéal pour les définitions, les valeurs seuils, les listes à connaître par cœur.
              </p>
            </div>
          ) : (
            <div className="fc-list">
              {cards.map((c, i) => (
                <div key={c.id} className="fc-row">
                  {editingId === c.id ? (
                    <div className="fc-row-edit">
                      <textarea
                        className="fc-ta"
                        rows={2}
                        value={editFront}
                        onChange={e => setEditFront(e.target.value)}
                      />
                      <textarea
                        className="fc-ta"
                        rows={2}
                        value={editBack}
                        onChange={e => setEditBack(e.target.value)}
                      />
                      <div className="fc-row-edit-actions">
                        <button className="fc-btn-ghost" onClick={() => setEditingId(null)}>Annuler</button>
                        <button
                          className="fc-btn-primary"
                          onClick={saveEdit}
                          disabled={!editFront.trim() || !editBack.trim()}
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="fc-row-num">{i + 1}</span>
                      <div className="fc-row-faces">
                        <div className="fc-row-front">{c.front}</div>
                        <div className="fc-row-back">{c.back}</div>
                      </div>
                      {(c.reviews || 0) > 0 && (
                        <span
                          className="fc-row-stat"
                          title={`${c.known || 0} fois sue sur ${c.reviews} révisions`}
                        >
                          {c.known || 0}/{c.reviews}
                        </span>
                      )}
                      <div className="fc-row-actions">
                        <button className="fc-btn-ghost" onClick={() => openEdit(c)}>Modifier</button>
                        <button className="fc-btn-ghost fc-btn-danger" onClick={() => deleteCard(c.id)}>Supprimer</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ================= MODE RÉVISION ================= */}
      {phase === 'review' && current && (
        <div className="fc-session">
          <div className="fc-progress">
            <span>Carte {pos + 1} / {deck.length}</span>
            <div className="fc-progress-bar">
              <div className="fc-progress-fill" style={{ width: `${((pos) / deck.length) * 100}%` }} />
            </div>
          </div>

          <button
            type="button"
            className={`fc-card${flipped ? ' fc-flipped' : ''}`}
            onClick={() => setFlipped(f => !f)}
            aria-label={flipped ? 'Voir le recto' : 'Voir la réponse'}
          >
            <span className="fc-card-side">{flipped ? 'Verso · réponse' : 'Recto · question'}</span>
            <span className="fc-card-text">{flipped ? current.back : current.front}</span>
            <span className="fc-card-hint">
              {flipped ? 'Clique pour revoir la question' : 'Clique pour révéler la réponse'}
            </span>
          </button>

          {flipped ? (
            <div className="fc-judge">
              <button className="fc-judge-btn fc-judge-no" onClick={() => mark(false)}>
                À revoir
              </button>
              <button className="fc-judge-btn fc-judge-yes" onClick={() => mark(true)}>
                Je savais
              </button>
            </div>
          ) : (
            <div className="fc-judge-placeholder">
              Réponds dans ta tête avant de retourner la carte.
            </div>
          )}

          <button className="fc-quit" onClick={() => setPhase('manage')}>
            Quitter la session
          </button>
        </div>
      )}

      {/* ================= FIN DE SESSION ================= */}
      {phase === 'end' && (
        <div className="fc-end">
          <div className="fc-end-score">
            <span className="fc-end-big">{knownCount}</span>
            <span className="fc-end-total">/ {deck.length} sue{knownCount > 1 ? 's' : ''}</span>
          </div>
          <p className="fc-end-text">
            {missedCards.length === 0
              ? 'Toutes les cartes sont sues. Beau travail.'
              : `${missedCards.length} carte${missedCards.length > 1 ? 's' : ''} à retravailler.`}
          </p>

          {missedCards.length > 0 && (
            <div className="fc-end-missed">
              {missedCards.map(c => (
                <div key={c.id} className="fc-end-missed-row">
                  <span className="fc-end-missed-front">{c.front}</span>
                  <span className="fc-end-missed-back">{c.back}</span>
                </div>
              ))}
            </div>
          )}

          <div className="fc-end-actions">
            {missedCards.length > 0 && (
              <button className="fc-btn-primary" onClick={() => startReview(missedCards)}>
                Revoir les {missedCards.length} ratée{missedCards.length > 1 ? 's' : ''}
              </button>
            )}
            <button className="fc-btn-ghost" onClick={() => startReview()}>
              Refaire tout le paquet
            </button>
            <button className="fc-btn-ghost" onClick={() => setPhase('manage')}>
              Retour aux cartes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
