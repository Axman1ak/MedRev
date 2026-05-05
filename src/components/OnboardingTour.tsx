'use client'
// src/components/OnboardingTour.tsx
//
// Tour guidé MedRev — 100% overlay/spotlight, aucun panneau centré.
//
// Chaque étape met en avant un élément RÉEL de l'app via querySelector
// d'un attribut data-tour, et affiche un tooltip à côté avec le contenu
// pédagogique. L'utilisateur garde le contrôle : bouton Suivant explicite
// sur les étapes walkthrough, et pour les étapes d'action on attend une
// création RÉELLE en DB (baseline capturée au début pour ne pas auto-skip
// si l'user a déjà des données).
//
// 7 étapes :
//   1. Sidebar         — Bienvenue + intro
//   2. Toggle semestres — S1/S2/Année
//   3. + Matière       — création détectée
//   4. + Nouvelle fiche — création détectée
//   5. Fiche créée     — courbe J / 14 paliers
//   6. Fiche créée     — notation 1-5
//   7. Tableau de bord — final
//
// Mounted dans dashboard/layout.tsx, persiste entre /dashboard et /fiches.
// Statut sauvegardé en localStorage 'medrev-onboarding-step' pour survivre
// aux refresh page.

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './onboarding-tour.css'

type StepKind = 'walkthrough' | 'wait-action'
type WaitTable = 'systems' | 'lessons'
type TipPos = 'right' | 'bottom' | 'top' | 'left'

interface Step {
  kind: StepKind
  selector: string
  path: string
  title: (firstName: string) => string
  body: React.ReactNode
  waitFor?: WaitTable
  tipPos?: TipPos // forcer un côté ; sinon auto
  spotPad?: number // padding du spotlight autour de l'élément
}

const STEPS: Step[] = [
  {
    kind: 'walkthrough',
    selector: '[data-tour="sidebar"]',
    path: '/dashboard',
    title: (n) => `Bienvenue, ${n}`,
    body: (
      <>
        Trois minutes pour comprendre MedRev. Tu vois ici ta navigation —{' '}
        <strong>cinq espaces</strong> pour réviser, toujours visibles.
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
        vue <strong>Année</strong> complète à tout moment. Chaque matière est
        rattachée à un semestre.
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },
  {
    kind: 'wait-action',
    selector: '[data-tour="add-system"]',
    path: '/dashboard/fiches',
    title: () => 'Ta première matière',
    body: (
      <>
        Tout commence ici. Crée une <strong>matière</strong> (Anatomie,
        Biochimie, Histologie…) — c&apos;est le conteneur qui regroupera tes
        fiches. Clique sur <strong>+ Matière</strong>.
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
        Bien joué. Maintenant une <strong>fiche</strong> dans cette matière
        (ex : « Glycolyse — étapes et régulation »). La date d&apos;apprentissage
        par défaut est aujourd&apos;hui — c&apos;est ton J0.
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
    title: () => 'La courbe J',
    body: (
      <>
        Les <strong>14 cases</strong> sous le titre de la fiche sont les{' '}
        <strong>14 paliers</strong> de la répétition espacée : J0, J1, J3, J5,
        J7, J15, J21, J30, J45, J60, J75, J90, J105, J120. À chaque échéance,
        MedRev te repropose la fiche au moment où ton cerveau est sur le point
        d&apos;oublier.
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="lesson-card"]',
    path: '/dashboard/fiches',
    title: () => 'À chaque révision, une note de 1 à 5',
    body: (
      <>
        Tu notes ta révision de <strong>1</strong> (à revoir) à{' '}
        <strong>5</strong> (acquis). Un 5 fait sauter des paliers, un 1 te
        repropose dès demain. C&apos;est ce score qui pilote la suite —
        clique sur la fiche pour ouvrir la modale de notation.
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="nav-dashboard"]',
    path: '/dashboard/fiches',
    title: () => 'Bonne révision',
    body: (
      <>
        Le <strong>Tableau de bord</strong> te montre ce qu&apos;il faut faire
        chaque jour. <strong>Calendrier</strong> liste toutes tes révisions à
        venir. <strong>Stats</strong> te montrera ta progression au fil du
        temps. À toi de jouer !
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

export default function OnboardingTour({ userId, userName, onComplete, onSkip, isReplay = false }: Props) {
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
  const baselineRef = useRef<number | null>(null)
  const firstName = (userName || 'toi').split(' ')[0]

  const cur = STEPS[stepIdx]
  const total = STEPS.length

  // ---------- Persist stepIdx ----------
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_KEY, String(stepIdx))
  }, [stepIdx])

  // ---------- Auto-route si l'étape attend un autre pathname ----------
  useEffect(() => {
    if (cur.path !== pathname) {
      router.push(cur.path)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  // ---------- Polling pour wait-action avec baseline ----------
  // En mode replay, on désactive le polling : les étapes d'action
  // deviennent de simples walkthrough (bouton Suivant explicite).
  useEffect(() => {
    if (cur.kind !== 'wait-action' || !cur.waitFor || isReplay) {
      baselineRef.current = null
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    const table = cur.waitFor

    async function setupAndPoll() {
      // 1) Capture la baseline une seule fois en entrant dans l'étape
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (cancelled) return
      baselineRef.current = count || 0

      // 2) Polling : avance dès que count > baseline
      async function poll() {
        const r = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
        if (cancelled) return
        const baseline = baselineRef.current ?? 0
        if ((r.count || 0) > baseline) {
          // Avance d'une étape
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
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
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

  // ---------- ESC handler ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (window.confirm('Quitter le tutoriel ? Tu pourras le revoir depuis Paramètres.')) {
          handleSkip()
        }
      } else if (e.key === 'ArrowRight' && (cur.kind === 'walkthrough' || isReplay)) {
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

  // Tour invisible si l'élément n'existe pas (en attente du DOM)
  if (!rect) {
    // On rend juste un overlay sombre + tooltip au centre comme fallback
    // pour que l'user ne se retrouve pas devant un écran "normal"
    return (
      <div className="ont-root" role="dialog" aria-modal="true">
        <div className="ont-dim" />
        <div className="ont-tip ont-tip-center">
          <div className="ont-tip-step">Étape {stepIdx + 1} sur {total}</div>
          <h4 className="ont-tip-title">Chargement…</h4>
          <div className="ont-tip-body" style={{ color: '#6B6F6A' }}>
            Préparation de l&apos;étape suivante…
          </div>
          <div className="ont-tip-actions">
            <button className="ont-btn-ghost" onClick={handleSkip}>Passer le tutoriel</button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Computed tooltip position ----------
  const TIP_W = 320
  const TIP_H_EST = 220 // estimation pour le clamp
  const GAP = 16
  const pad = cur.spotPad ?? 6
  let tipStyle: React.CSSProperties = { width: TIP_W }

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v))
  }

  if (typeof window !== 'undefined') {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let pos: TipPos = cur.tipPos || 'right'
    // si pas la place à droite, basculer à gauche ou en bas
    if (pos === 'right' && rect.left + rect.width + GAP + TIP_W > vw - 16) pos = 'bottom'
    if (pos === 'bottom' && rect.top + rect.height + GAP + TIP_H_EST > vh - 16) pos = 'top'
    if (pos === 'top' && rect.top - GAP - TIP_H_EST < 16) pos = 'right'

    let top = 0, left = 0
    if (pos === 'right') {
      top = clamp(rect.top, 16, vh - TIP_H_EST - 16)
      left = rect.left + rect.width + GAP
    } else if (pos === 'left') {
      top = clamp(rect.top, 16, vh - TIP_H_EST - 16)
      left = rect.left - GAP - TIP_W
    } else if (pos === 'bottom') {
      top = rect.top + rect.height + GAP
      left = clamp(rect.left, 16, vw - TIP_W - 16)
    } else {
      top = rect.top - GAP - TIP_H_EST
      left = clamp(rect.left, 16, vw - TIP_W - 16)
    }
    tipStyle = { top, left, width: TIP_W }
  }

  const isFirst = stepIdx === 0
  const isLast = stepIdx === STEPS.length - 1
  const isWaitAction = cur.kind === 'wait-action'
  // En mode replay, les wait-action se comportent comme des walkthrough
  const showWaitHint = isWaitAction && !isReplay
  const showNextBtn = !isWaitAction || isReplay

  return (
    <div className="ont-root" role="dialog" aria-modal="true" aria-label="Tutoriel d'introduction">
      {/* Spotlight + dim (single element via box-shadow) */}
      <div
        className="ont-spot"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />

      {/* Tooltip */}
      <div className="ont-tip" style={tipStyle}>
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
          <button className="ont-btn-ghost" onClick={handleSkip}>
            Passer le tutoriel
          </button>
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
