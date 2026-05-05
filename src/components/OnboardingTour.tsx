'use client'
// src/components/OnboardingTour.tsx
//
// Tour MedRev — 100% spotlight/coachmark, 15 étapes structurées en 3 phases :
//
//   PHASE 1 — Accueil
//     1. Sidebar              — Welcome + intro
//     2. Toggle semestres     — S1/S2/Année
//
//   PHASE 2 — Mes matières (le principal, on commence ici)
//     3. nav-fiches           — "On commence par Mes matières"
//     4. + Matière            — ACTION (clic forcé pour créer)
//     5. + Nouvelle fiche     — ACTION
//     6. Carte fiche          — Courbe J 14 paliers + notation 1-5
//     7. Carte fiche          — ACTION : clic pour ouvrir la modale
//     8. Picker J             — choisir le palier à noter
//     9. Sources vidéo/PDF    — upload + Premium (30 min / 20 Mo en Free)
//    10. QCM IA               — génération + Premium (5 free)
//
//   PHASE 3 — Tour des autres onglets (les répercussions)
//    11. nav-dashboard        — "Voici ton Tableau de bord, ta fiche apparaît dans Aujourd'hui"
//    12. nav-calendar         — "Programmée à J0, J1, J3..."
//    13. nav-focus            — "Bibliothèque gamifiée"
//    14. nav-simu             — Simulateur + Premium (1 session free)
//    15. nav-stats            — Stats + Premium (heatmap, dumbbell)
//
// Sur les wait-action (4, 5, 7), aucun bouton "Passer" — l'user doit faire
// l'action. ESC reste comme sortie d'urgence (avec confirm).
//
// Mounted dans dashboard/layout.tsx, persiste entre toutes les pages.

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './onboarding-tour.css'

type StepKind = 'walkthrough' | 'wait-action'
type WaitCondition = 'systems' | 'lessons' | 'modal-open'
type TipPos = 'right' | 'bottom' | 'top' | 'left'

interface Step {
  kind: StepKind
  selector: string
  path: string
  title: (firstName: string) => string
  body: React.ReactNode
  waitFor?: WaitCondition
  tipPos?: TipPos
  spotPad?: number
}

const STEPS: Step[] = [
  // ============== PHASE 1 — ACCUEIL ==============
  {
    kind: 'walkthrough',
    selector: '[data-tour="sidebar"]',
    path: '/dashboard',
    title: (n) => `Bienvenue, ${n}`,
    body: (
      <>
        Trois minutes pour comprendre MedRev. Tu vois ici ta navigation —{' '}
        <strong>six espaces</strong> pour réviser, toujours visibles.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="sem-toggle"]',
    path: '/dashboard',
    title: () => 'Tes semestres',
    body: (
      <>
        Tu peux basculer entre <strong>S1</strong>, <strong>S2</strong> et la
        vue <strong>Année</strong> à tout moment. Chaque matière est rattachée
        à un semestre.
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },

  // ============== PHASE 2 — MES MATIÈRES (le principal) ==============
  {
    kind: 'walkthrough',
    selector: '[data-tour="nav-fiches"]',
    path: '/dashboard',
    title: () => 'On commence par Mes matières',
    body: (
      <>
        C&apos;est <strong>l&apos;onglet principal</strong> — c&apos;est ici
        que tu crées tes matières et toutes tes fiches. Tout le reste de
        MedRev se construit autour de ces fiches.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'wait-action',
    selector: '[data-tour="add-system"]',
    path: '/dashboard/fiches',
    title: () => 'Ta première matière',
    body: (
      <>
        Crée une <strong>matière</strong> (Anatomie, Biochimie, Histologie…) —
        c&apos;est le conteneur qui regroupera tes fiches. Clique sur{' '}
        <strong>+ Matière</strong>.
      </>
    ),
    waitFor: 'systems',
    tipPos: 'bottom',
    spotPad: 6,
  },
  {
    kind: 'wait-action',
    selector: '[data-tour="add-lesson"]',
    path: '/dashboard/fiches',
    title: () => 'Ta première fiche',
    body: (
      <>
        Maintenant une <strong>fiche</strong> dans cette matière (ex : «
        Glycolyse — étapes »). La date d&apos;apprentissage par défaut est
        aujourd&apos;hui — c&apos;est ton J0.
      </>
    ),
    waitFor: 'lessons',
    tipPos: 'bottom',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="lesson-card"]',
    path: '/dashboard/fiches',
    title: () => 'La courbe J et la notation',
    body: (
      <>
        Les <strong>14 cases</strong> sous le titre sont les 14 paliers : J0,
        J1, J3, J5, J7, J15, J21, J30, J45, J60, J75, J90, J105, J120. À chaque
        échéance, tu notes ta révision de <strong>1</strong> (à revoir) à{' '}
        <strong>5</strong> (acquis). Un 5 fait sauter des paliers, un 1 te
        repropose dès demain.
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
  },
  {
    kind: 'wait-action',
    selector: '[data-tour="lesson-card"]',
    path: '/dashboard/fiches',
    title: () => 'Ouvre ta fiche',
    body: (
      <>
        Clique sur ta fiche pour découvrir tout ce qu&apos;elle peut contenir :
        sources vidéo/PDF, QCM générés par IA, et la modale de notation.
      </>
    ),
    waitFor: 'modal-open',
    tipPos: 'right',
    spotPad: 8,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="picker-j"]',
    path: '/dashboard/fiches',
    title: () => 'Le picker J',
    body: (
      <>
        Voici les 14 paliers de cette fiche. Les J <strong>passés ou
        aujourd&apos;hui</strong> sont notables. Les J <strong>futurs</strong>{' '}
        sont verrouillés — ils se débloquent à la bonne date.
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="sources"]',
    path: '/dashboard/fiches',
    title: () => 'Vidéo et PDF du cours',
    body: (
      <>
        Upload ta <strong>vidéo</strong> (cours filmé) et le{' '}
        <strong>PDF</strong> du polycopié. C&apos;est ce qui sert de base à
        l&apos;IA pour générer tes QCM.
        <br />
        <br />
        <em className="ont-premium-note">
          Plan Gratuit : 30 min de vidéo, 20 Mo de PDF, 1 par fiche.{' '}
          <strong>Premium</strong> : sans limite.
        </em>
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="qcm-section"]',
    path: '/dashboard/fiches',
    title: () => 'QCM générés par IA',
    body: (
      <>
        Dès qu&apos;une source est uploadée, MedRev peut générer{' '}
        <strong>30 QCM</strong> automatiquement. Lance une session de révision
        quand tu veux.
        <br />
        <br />
        <em className="ont-premium-note">
          Plan Gratuit : 5 générations IA totales sur tout le compte.{' '}
          <strong>Premium</strong> : illimité.
        </em>
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },

  // ============== PHASE 3 — RÉPERCUSSIONS SUR LES AUTRES ONGLETS ==============
  {
    kind: 'walkthrough',
    selector: '[data-tour="nav-dashboard"]',
    path: '/dashboard',
    title: () => 'Le Tableau de bord',
    body: (
      <>
        Ta fiche apparaît automatiquement dans <strong>Aujourd&apos;hui</strong>{' '}
        si elle est due. Tu y verras aussi ton <strong>point faible</strong>,
        ta <strong>régularité</strong> et ta <strong>charge à venir</strong>.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="nav-calendar"]',
    path: '/dashboard/calendar',
    title: () => 'Le Calendrier',
    body: (
      <>
        Ta fiche est <strong>programmée automatiquement</strong> à J0, J1, J3,
        J5, J7… jusqu&apos;à J120. Vue semaine groupée par matière, max 10
        fiches par jour pour ne pas être noyé.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="nav-focus"]',
    path: '/dashboard/focus',
    title: () => 'La Bibliothèque',
    body: (
      <>
        Une session <strong>focus gamifiée</strong> qui enchaîne tes fiches
        dues. Chaque fiche notée ajoute <strong>1 livre</strong> à ta
        bibliothèque (1 livre = 1h d&apos;étude). Objectif :{' '}
        <strong>1500 livres</strong> pour boucler la P1.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="nav-simu"]',
    path: '/dashboard/simulateur',
    title: () => 'Le Simulateur',
    body: (
      <>
        QCM <strong>type concours</strong>. Deux modes :{' '}
        <strong>Apprentissage</strong> (avec corrections) ou{' '}
        <strong>Examen blanc</strong> (timer, grille concours, ressenti).
        <br />
        <br />
        <em className="ont-premium-note">
          Plan Gratuit : 1 session totale en Apprentissage.{' '}
          <strong>Premium</strong> : sessions illimitées + Examen blanc.
        </em>
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="nav-stats"]',
    path: '/dashboard/stats',
    title: () => 'Tes Statistiques',
    body: (
      <>
        Bilan annuel : nombre de révisions, jours actifs, fiches maîtrisées,
        régularité. Tout se remplit au fil de tes notes.
        <br />
        <br />
        <em className="ont-premium-note">
          <strong>Premium</strong> : heatmap année 52 sem, sparkline 12 sem,
          dumbbell par matière (comparaison 1 mois vs maintenant).
        </em>
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
]

const LS_KEY = 'medrev-onboarding-step'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
  onSkip: () => void
  isReplay?: boolean
}

interface Rect { top: number; left: number; width: number; height: number }

export default function OnboardingTour({ userId, userName, onComplete, onSkip }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [stepIdx, setStepIdx] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const v = localStorage.getItem(LS_KEY)
    const n = v ? parseInt(v, 10) : 0
    if (isNaN(n) || n < 0 || n >= STEPS.length) return 0
    return n
  })
  const [rect, setRect] = useState<Rect | null>(null)

  // Mesure réelle du tooltip pour clamper la position et éviter overflow
  const tipRef = useRef<HTMLDivElement | null>(null)
  const [tipDims, setTipDims] = useState<{ w: number; h: number } | null>(null)

  const baselineRef = useRef<number | null>(null)
  const firstName = (userName || 'toi').split(' ')[0]

  const cur = STEPS[stepIdx]
  const total = STEPS.length

  // L'utilisateur a explicitement demandé : toujours attendre le clic réel
  // pour créer matière/fiche, même en mode replay. Plus de bypass.
  const isWaitAction = cur.kind === 'wait-action'

  // ---------- Persist stepIdx ----------
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_KEY, String(stepIdx))
  }, [stepIdx])

  // ---------- Auto-route ----------
  useEffect(() => {
    if (cur.path !== pathname) {
      router.push(cur.path)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  // ---------- Polling pour wait-action ----------
  useEffect(() => {
    if (!isWaitAction || !cur.waitFor) {
      baselineRef.current = null
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    if (cur.waitFor === 'modal-open') {
      intervalId = setInterval(() => {
        if (cancelled) return
        if (typeof document === 'undefined') return
        if (document.querySelector('[data-tour="review-modal"]')) {
          setStepIdx(i => Math.min(STEPS.length - 1, i + 1))
        }
      }, 300)
      return () => {
        cancelled = true
        if (intervalId) clearInterval(intervalId)
      }
    }

    const table = cur.waitFor

    async function setupAndPoll() {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (cancelled) return
      baselineRef.current = count || 0

      async function poll() {
        const r = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
        if (cancelled) return
        const baseline = baselineRef.current ?? 0
        if ((r.count || 0) > baseline) {
          setStepIdx(i => Math.min(STEPS.length - 1, i + 1))
        }
      }
      intervalId = setInterval(poll, 1500)
    }

    setupAndPoll()
    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      baselineRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, userId])

  // ---------- Compute spotlight rect ----------
  const computeRect = useCallback(() => {
    if (typeof document === 'undefined') return
    const el = document.querySelector(cur.selector) as HTMLElement | null
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [cur.selector])

  useLayoutEffect(() => {
    computeRect()
    const t1 = setTimeout(computeRect, 100)
    const t2 = setTimeout(computeRect, 350)
    const t3 = setTimeout(computeRect, 800)
    const t4 = setTimeout(computeRect, 1500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [computeRect, pathname])

  useEffect(() => {
    const onResize = () => computeRect()
    const onScroll = () => computeRect()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    const id = setInterval(computeRect, 800)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      clearInterval(id)
    }
  }, [computeRect])

  // ---------- Mesure du tooltip (post-render) ----------
  useLayoutEffect(() => {
    if (!tipRef.current) return
    const r = tipRef.current.getBoundingClientRect()
    setTipDims({ w: r.width, h: r.height })
  }, [stepIdx, rect])

  // ---------- ESC handler ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (window.confirm('Quitter le tutoriel ? Tu pourras le revoir depuis Paramètres.')) {
          handleSkip()
        }
      } else if (e.key === 'ArrowRight' && !isWaitAction) {
        next()
      } else if (e.key === 'ArrowLeft' && stepIdx > 0) {
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  function next() {
    if (stepIdx >= STEPS.length - 1) {
      handleComplete()
      return
    }
    setStepIdx(stepIdx + 1)
  }
  function prev() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1)
  }
  function handleSkip() {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY)
    onSkip()
  }
  function handleComplete() {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY)
    onComplete()
  }

  // ---------- Fallback chargement ----------
  if (!rect) {
    return (
      <div className="ont-root" role="dialog" aria-modal="true">
        <div className="ont-dim" />
        <div className="ont-tip ont-tip-center" ref={tipRef}>
          <div className="ont-tip-step">Étape {stepIdx + 1} sur {total}</div>
          <h4 className="ont-tip-title">Chargement…</h4>
          <div className="ont-tip-body" style={{ color: '#6B6F6A' }}>
            Préparation de l&apos;étape suivante…
          </div>
          <div className="ont-tip-actions">
            {!isWaitAction && (
              <button className="ont-btn-ghost" onClick={handleSkip}>
                Passer le tutoriel
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------- Tooltip position avec dims réelles ----------
  const TIP_W_PREF = 340
  const tipW = tipDims?.w || TIP_W_PREF
  const tipH = tipDims?.h || 360 // estimation initiale large
  const GAP = 16
  const MARGIN = 16
  const pad = cur.spotPad ?? 6

  function clamp(v: number, min: number, max: number) {
    if (max < min) return min
    return Math.max(min, Math.min(max, v))
  }

  let tipStyle: React.CSSProperties = { width: TIP_W_PREF }

  if (typeof window !== 'undefined') {
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Choix de la position : test pos préférée → fallback
    const candidates: TipPos[] = [cur.tipPos || 'right', 'right', 'bottom', 'left', 'top']
    let chosen: TipPos = candidates[0]
    for (const c of candidates) {
      if (c === 'right' && rect.left + rect.width + GAP + tipW <= vw - MARGIN) { chosen = c; break }
      if (c === 'left' && rect.left - GAP - tipW >= MARGIN) { chosen = c; break }
      if (c === 'bottom' && rect.top + rect.height + GAP + tipH <= vh - MARGIN) { chosen = c; break }
      if (c === 'top' && rect.top - GAP - tipH >= MARGIN) { chosen = c; break }
    }

    let top = MARGIN, left = MARGIN
    if (chosen === 'right') {
      top = clamp(rect.top, MARGIN, vh - tipH - MARGIN)
      left = rect.left + rect.width + GAP
    } else if (chosen === 'left') {
      top = clamp(rect.top, MARGIN, vh - tipH - MARGIN)
      left = rect.left - GAP - tipW
    } else if (chosen === 'bottom') {
      top = rect.top + rect.height + GAP
      left = clamp(rect.left, MARGIN, vw - tipW - MARGIN)
    } else if (chosen === 'top') {
      top = rect.top - GAP - tipH
      left = clamp(rect.left, MARGIN, vw - tipW - MARGIN)
    }

    // Clamp final pour garantir aucune sortie
    top = clamp(top, MARGIN, Math.max(MARGIN, vh - tipH - MARGIN))
    left = clamp(left, MARGIN, Math.max(MARGIN, vw - tipW - MARGIN))

    tipStyle = { top, left, width: TIP_W_PREF }
  }

  const isFirst = stepIdx === 0
  const isLast = stepIdx === STEPS.length - 1
  const showWaitHint = isWaitAction
  const showNextBtn = !isWaitAction
  const showSkipBtn = !isWaitAction

  return (
    <div className="ont-root" role="dialog" aria-modal="true" aria-label="Tutoriel d'introduction">
      <div
        className="ont-spot"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />

      <div className="ont-tip" ref={tipRef} style={tipStyle}>
        <div className="ont-tip-step">
          Étape {stepIdx + 1} sur {total}
        </div>
        <h4 className="ont-tip-title">{cur.title(firstName)}</h4>
        <div className="ont-tip-body">{cur.body}</div>

        {showWaitHint && (
          <div className="ont-tip-hint">
            <span className="ont-tip-pulse" /> En attente de ton clic…
          </div>
        )}

        <ProgressBars count={total} active={stepIdx} />

        <div className="ont-tip-actions">
          {showSkipBtn ? (
            <button className="ont-btn-ghost" onClick={handleSkip}>
              Passer le tutoriel
            </button>
          ) : (
            <span />
          )}
          <div className="ont-tip-actions-right">
            {!isFirst && (
              <button className="ont-btn-ghost" onClick={prev}>
                ← Préc.
              </button>
            )}
            {showNextBtn && (
              <button className="ont-btn-primary" onClick={next}>
                {isLast ? 'Terminer' : 'Suivant →'}
              </button>
            )}
          </div>
        </div>
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
