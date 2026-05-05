'use client'
// src/components/OnboardingTour.tsx
//
// Tour guidé maison MedRev — 2 phases :
//
//   PHASE 1 — Concepts (3 modals centrés sur fond dimmé)
//     1. Welcome
//     2. Courbe J (avec SVG)
//     3. Scoring 1-5 (5 cartes colorées)
//
//   PHASE 2 — Actions sur la vraie page /dashboard/fiches
//     4. Spotlight sur "+ Matière" → polling Supabase, avance quand systems > 0
//     5. Spotlight sur "+ Nouvelle fiche" → polling, avance quand lessons > 0
//
//   PHASE 3 — Final
//     6. Modal centré "Bravo, voici ce qui se passe maintenant"
//
// Mounted dans dashboard/layout.tsx, persiste entre /dashboard et /dashboard/fiches.
// Statut sauvegardé en localStorage (key 'medrev-onboarding-phase') pour survivre
// aux refresh page. À la complétion ou skip, parent appelle onComplete/onSkip
// qui mettent profile.onboarded_at = now() en DB.

import { useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './onboarding-tour.css'

type Phase = 'concepts' | 'actions-system' | 'actions-lesson' | 'final'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
  onSkip: () => void
}

interface Rect { top: number; left: number; width: number; height: number }

const LS_KEY = 'medrev-onboarding-phase'

export default function OnboardingTour({ userId, userName, onComplete, onSkip }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === 'undefined') return 'concepts'
    const v = localStorage.getItem(LS_KEY)
    if (v === 'actions-system') return 'actions-system'
    if (v === 'actions-lesson') return 'actions-lesson'
    if (v === 'final') return 'final'
    return 'concepts'
  })
  const [conceptIdx, setConceptIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const firstName = (userName || 'toi').split(' ')[0]

  const concepts: Concept[] = [
    {
      title: `Bienvenue, ${firstName}.`,
      body: (
        <>
          Trois minutes pour comprendre comment MedRev fonctionne. On va voir le
          principe de la <strong>répétition espacée</strong>, le système de
          notation, puis on créera ta première matière ensemble. Tu pourras
          toujours revoir ce tutoriel depuis <strong>Paramètres</strong>.
        </>
      ),
      illustration: <WelcomeMark />,
    },
    {
      title: 'La courbe J',
      body: (
        <>
          Chaque fiche que tu apprends suit un planning automatique en{' '}
          <strong>14 paliers</strong> : J0, J1, J3, J5, J7, J15, J21, J30, J45,
          J60, J75, J90, J105, J120.
          <br />
          <br />
          On te repropose la fiche au moment précis où ton cerveau est sur le
          point d&apos;oublier. Mémoire long terme avec un effort minimal — la
          science derrière toutes les méthodes qui marchent.
        </>
      ),
      illustration: <JCurveSvg />,
    },
    {
      title: 'À chaque révision, une note de 1 à 5',
      body: (
        <>
          Ce score pilote la suite. Un <strong>5</strong> et on saute des
          paliers. Un <strong>1</strong> et on te repropose dès demain. Tu peux
          toujours revenir sur une note plus tard.
        </>
      ),
      illustration: <ScoringMini />,
    },
  ]

  // ---------- Concept navigation ----------
  function nextConcept() {
    if (conceptIdx < concepts.length - 1) {
      setConceptIdx(conceptIdx + 1)
    } else {
      // Last concept → start action phase on /dashboard/fiches
      transitionTo('actions-system')
      router.push('/dashboard/fiches')
    }
  }
  function prevConcept() {
    if (conceptIdx > 0) setConceptIdx(conceptIdx - 1)
  }
  function transitionTo(p: Phase) {
    setPhase(p)
    if (typeof window !== 'undefined') {
      if (p === 'concepts') localStorage.removeItem(LS_KEY)
      else localStorage.setItem(LS_KEY, p)
    }
  }

  // ---------- Polling Supabase pendant les phases d'action ----------
  useEffect(() => {
    if (phase !== 'actions-system' && phase !== 'actions-lesson') return
    let cancelled = false
    const table = phase === 'actions-system' ? 'systems' : 'lessons'

    async function poll() {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (cancelled) return
      if ((count || 0) > 0) {
        if (phase === 'actions-system') {
          transitionTo('actions-lesson')
        } else {
          transitionTo('final')
        }
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => { cancelled = true; clearInterval(id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, userId])

  // ---------- Compute spotlight rect (action phase only) ----------
  const computeRect = useCallback(() => {
    if (phase !== 'actions-system' && phase !== 'actions-lesson') {
      setRect(null)
      return
    }
    if (typeof document === 'undefined') return
    const sel = phase === 'actions-system'
      ? '[data-tour="add-system"]'
      : '[data-tour="add-lesson"]'
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [phase])

  useLayoutEffect(() => {
    computeRect()
    // re-compute après que la page se stabilise (fonts, layout, navigation)
    const t1 = setTimeout(computeRect, 100)
    const t2 = setTimeout(computeRect, 500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [computeRect, pathname])

  useEffect(() => {
    if (phase !== 'actions-system' && phase !== 'actions-lesson') return
    const onResize = () => computeRect()
    const onScroll = () => computeRect()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    const id = setInterval(computeRect, 700)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      clearInterval(id)
    }
  }, [phase, computeRect])

  // ---------- ESC handler ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (window.confirm('Quitter le tutoriel ? Tu pourras le revoir depuis Paramètres.')) {
          handleSkip()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSkip() {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY)
    onSkip()
  }
  function handleFinish() {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY)
    onComplete()
    router.push('/dashboard')
  }

  // En phase action : ne render que sur /dashboard/fiches (sinon on cache,
  // l'user a navigué ailleurs — le tour reprendra au retour).
  if ((phase === 'actions-system' || phase === 'actions-lesson') && pathname !== '/dashboard/fiches') {
    return null
  }

  return (
    <div className="ont-root" role="dialog" aria-modal="true" aria-label="Tutoriel d'introduction">
      {/* PHASE CONCEPTS — full dim + centered modal */}
      {phase === 'concepts' && (
        <>
          <div className="ont-dim" />
          <div className="ont-modal-wrap">
            <ConceptModal
              concept={concepts[conceptIdx]}
              total={concepts.length}
              idx={conceptIdx}
              onPrev={prevConcept}
              onNext={nextConcept}
              onSkip={handleSkip}
              isLast={conceptIdx === concepts.length - 1}
            />
          </div>
        </>
      )}

      {/* PHASE ACTIONS — spotlight visuel sur le vrai bouton + tooltip */}
      {(phase === 'actions-system' || phase === 'actions-lesson') && (
        <>
          {rect && (
            <div
              className="ont-spot"
              style={{
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
              }}
            />
          )}
          <ActionTip
            phase={phase}
            rect={rect}
            firstName={firstName}
            onSkip={handleSkip}
          />
        </>
      )}

      {/* PHASE FINAL — modal de complétion */}
      {phase === 'final' && (
        <>
          <div className="ont-dim" />
          <div className="ont-modal-wrap">
            <FinalModal firstName={firstName} onFinish={handleFinish} />
          </div>
        </>
      )}
    </div>
  )
}

// =================================================================
// Sub-components
// =================================================================

interface Concept {
  title: string
  body: React.ReactNode
  illustration?: React.ReactNode
}

interface ConceptModalProps {
  concept: Concept
  total: number
  idx: number
  isLast: boolean
  onPrev: () => void
  onNext: () => void
  onSkip: () => void
}

function ConceptModal({ concept, total, idx, isLast, onPrev, onNext, onSkip }: ConceptModalProps) {
  return (
    <div className="ont-modal">
      <div className="ont-modal-head">
        <div className="ont-modal-step">
          <span className="ont-pill">Onboarding</span>
          <em className="ont-modal-step-x">étape {idx + 1} sur {total}</em>
        </div>
        <button className="ont-modal-close" onClick={onSkip} aria-label="Fermer">×</button>
      </div>

      {concept.illustration && (
        <div className="ont-illust">{concept.illustration}</div>
      )}

      <h3 className="ont-modal-title">{concept.title}</h3>
      <div className="ont-modal-body">{concept.body}</div>

      <ProgressBars count={total} active={idx} />

      <div className="ont-modal-actions">
        <button className="ont-btn-ghost" onClick={onSkip}>Passer le tutoriel</button>
        <div className="ont-modal-actions-right">
          {idx > 0 && (
            <button className="ont-btn-ghost" onClick={onPrev}>← Précédent</button>
          )}
          <button className="ont-btn-primary" onClick={onNext}>
            {isLast ? 'Créer ma 1ère matière →' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ActionTipProps {
  phase: 'actions-system' | 'actions-lesson'
  rect: Rect | null
  firstName: string
  onSkip: () => void
}

function ActionTip({ phase, rect, firstName, onSkip }: ActionTipProps) {
  // Tooltip positionné par rapport au rect du bouton
  const TIP_W = 320
  const TIP_GAP = 16
  let style: React.CSSProperties = {}
  if (rect) {
    // Par défaut sous le bouton, aligné à droite
    let left = rect.left + rect.width - TIP_W
    let top = rect.top + rect.height + TIP_GAP
    if (typeof window !== 'undefined') {
      // clamp left pour ne pas sortir de la fenêtre
      if (left < 16) left = 16
      const maxLeft = window.innerWidth - TIP_W - 16
      if (left > maxLeft) left = maxLeft
      // si pas la place en bas, placer au-dessus
      if (top + 200 > window.innerHeight) {
        top = rect.top - 200 - TIP_GAP
      }
    }
    style = { top, left, width: TIP_W }
  } else {
    // bouton introuvable (page pas chargée) — tooltip centré
    style = { top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: TIP_W }
  }

  const isSystem = phase === 'actions-system'
  const stepNum = isSystem ? 4 : 5
  const total = 6

  return (
    <div className="ont-tip" style={style}>
      <div className="ont-tip-step">Étape {stepNum} sur {total}</div>
      <h4 className="ont-tip-title">
        {isSystem ? `À toi, ${firstName} !` : 'Maintenant, une fiche'}
      </h4>
      <div className="ont-tip-body">
        {isSystem ? (
          <>
            Clique sur <strong>+ Matière</strong> pour créer ta première matière
            (Anatomie, Biochimie, Histologie...). Tu pourras ajouter des fiches
            dedans ensuite.
          </>
        ) : (
          <>
            Bien joué. Maintenant clique sur <strong>+ Nouvelle fiche</strong>{' '}
            et donne-lui un titre. La date d&apos;apprentissage par défaut est
            aujourd&apos;hui (J0).
          </>
        )}
      </div>
      <div className="ont-tip-hint">
        <span className="ont-tip-pulse" /> En attente de ton clic…
      </div>
      <div className="ont-tip-actions">
        <button className="ont-btn-ghost" onClick={onSkip}>Passer le tutoriel</button>
      </div>
    </div>
  )
}

function FinalModal({ firstName, onFinish }: { firstName: string; onFinish: () => void }) {
  return (
    <div className="ont-modal">
      <div className="ont-modal-head">
        <div className="ont-modal-step">
          <span className="ont-pill ont-pill-done">Tutoriel terminé</span>
        </div>
      </div>

      <div className="ont-illust">
        <CheckMark />
      </div>

      <h3 className="ont-modal-title">Bravo, {firstName}.</h3>

      <div className="ont-modal-body">
        Voici ce qui se passe maintenant :
        <ul className="ont-list">
          <li>Ta fiche apparaît dans <strong>Aujourd&apos;hui</strong> (J0)</li>
          <li>Demain elle reviendra à J1, puis J3, J5, J7…</li>
          <li>Le <strong>Calendrier</strong> affichera toutes tes révisions à venir</li>
          <li>Tes <strong>Statistiques</strong> se rempliront au fil des notes</li>
        </ul>
        Dès que tu as <strong>5 ou 6 fiches</strong>, le simulateur d&apos;examen
        et les autres outils prendront tout leur sens.
      </div>

      <div className="ont-modal-actions">
        <span />
        <button className="ont-btn-primary" onClick={onFinish}>
          Aller au tableau de bord →
        </button>
      </div>
    </div>
  )
}

function ProgressBars({ count, active }: { count: number; active: number }) {
  const bars: number[] = []
  for (let i = 0; i < count; i++) bars.push(i)
  return (
    <div className="ont-bars">
      {bars.map(i => (
        <span key={i} className={`ont-bar${i < active ? ' done' : ''}${i === active ? ' cur' : ''}`} />
      ))}
    </div>
  )
}

// =================================================================
// Illustrations (inline SVG)
// =================================================================

function WelcomeMark() {
  return (
    <svg viewBox="0 0 220 110" width="220" height="110" aria-hidden="true">
      <text
        x="110" y="78"
        textAnchor="middle"
        fontFamily="Fraunces, serif"
        fontSize="72"
        fontWeight="400"
        fill="#1B4332"
      >MedRev</text>
      <line x1="40" y1="92" x2="180" y2="92" stroke="#2D6A4F" strokeWidth="1.4" />
    </svg>
  )
}

function JCurveSvg() {
  return (
    <svg viewBox="0 0 460 200" width="460" height="200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ont-curveg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1B4332" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1B4332" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="40" y1="40" x2="450" y2="40" stroke="#E1DDD3" strokeDasharray="2,4" />
      <line x1="40" y1="100" x2="450" y2="100" stroke="#E1DDD3" strokeDasharray="2,4" />
      <line x1="40" y1="160" x2="450" y2="160" stroke="#E1DDD3" strokeDasharray="2,4" />
      <text x="32" y="44" textAnchor="end" fontSize="9" fill="#6B6F6A">100%</text>
      <text x="32" y="104" textAnchor="end" fontSize="9" fill="#6B6F6A">50%</text>
      <text x="32" y="164" textAnchor="end" fontSize="9" fill="#6B6F6A">0%</text>
      <path d="M40,40 Q90,180 200,182 T440,178" stroke="#C75050" strokeWidth="1.5" fill="none" strokeDasharray="3,3" opacity="0.55" />
      <text x="430" y="172" fontFamily="Cormorant Garamond, serif" fontSize="11" fontStyle="italic" fill="#C75050" textAnchor="end">sans révision</text>
      <path d="M40,40 Q60,80 80,55 Q100,90 120,50 Q150,80 180,45 Q220,70 260,42 Q310,60 360,40 L440,40" stroke="#1B4332" strokeWidth="2.4" fill="none" />
      <path d="M40,40 Q60,80 80,55 Q100,90 120,50 Q150,80 180,45 Q220,70 260,42 Q310,60 360,40 L440,40 L440,180 L40,180 Z" fill="url(#ont-curveg)" />
      <g fontSize="9" fill="#6B6F6A" fontFamily="Plus Jakarta Sans, sans-serif">
        <g><circle cx="40" cy="40" r="4" fill="#1B4332" /><text x="40" y="195" textAnchor="middle">J0</text></g>
        <g><circle cx="80" cy="55" r="3.5" fill="#1B4332" /><text x="80" y="195" textAnchor="middle">J1</text></g>
        <g><circle cx="120" cy="50" r="3.5" fill="#1B4332" /><text x="120" y="195" textAnchor="middle">J3</text></g>
        <g><circle cx="180" cy="45" r="3.5" fill="#1B4332" /><text x="180" y="195" textAnchor="middle">J7</text></g>
        <g><circle cx="260" cy="42" r="3.5" fill="#1B4332" /><text x="260" y="195" textAnchor="middle">J21</text></g>
        <g><circle cx="360" cy="40" r="3.5" fill="#1B4332" /><text x="360" y="195" textAnchor="middle">J60</text></g>
        <g><circle cx="430" cy="40" r="3.5" fill="#1B4332" /><text x="430" y="195" textAnchor="middle">J120</text></g>
      </g>
    </svg>
  )
}

function ScoringMini() {
  const scores: { n: number; label: string; cls: string }[] = [
    { n: 1, label: 'Bloqué', cls: 's1' },
    { n: 2, label: 'Difficile', cls: 's2' },
    { n: 3, label: 'Moyen', cls: 's3' },
    { n: 4, label: 'Bon', cls: 's4' },
    { n: 5, label: 'Acquis', cls: 's5' },
  ]
  return (
    <div className="ont-scores">
      {scores.map(s => (
        <div key={s.n} className={`ont-score ${s.cls}`}>
          <div className="ont-score-bar"></div>
          <div className="ont-score-n">{s.n}</div>
          <div className="ont-score-l">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function CheckMark() {
  return (
    <svg viewBox="0 0 110 110" width="90" height="90" aria-hidden="true">
      <circle cx="55" cy="55" r="48" fill="#D8EAE0" />
      <path d="M35,57 L50,72 L78,40" stroke="#1B4332" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
