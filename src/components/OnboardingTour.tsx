'use client'
// src/components/OnboardingTour.tsx
//
// Tour MedRev étendu — 100% spotlight/coachmark, 14 étapes couvrant
// l'ensemble des fonctionnalités du site.
//
// 1.  Sidebar               — Welcome + 5 espaces
// 2.  Toggle semestres      — S1/S2/Année
// 3.  + Matière             — ACTION (pas de Passer, clic forcé)
// 4.  + Nouvelle fiche      — ACTION
// 5.  Carte fiche           — Courbe J 14 paliers + notation 1-5
// 6.  Carte fiche           — ACTION : clic pour ouvrir la modale
// 7.  Picker J (dans modale) — choisir le palier à noter
// 8.  Sources vidéo/PDF     — upload + mention Premium (limites Free)
// 9.  QCM générés par IA    — génération + mention Premium (5 free)
// 10. Page Focus            — La Bibliothèque gamifiée
// 11. Page Calendrier       — vue semaine groupée
// 12. Page Simulateur       — modes + Premium (1 session free)
// 13. Page Stats            — base + Premium (heatmap, dumbbell)
// 14. Retour Dashboard      — final, bonne révision
//
// Sur les étapes wait-action (3, 4, 6), le bouton "Passer le tutoriel"
// est volontairement absent — l'user doit accomplir l'action. ESC reste
// disponible en sortie d'urgence (avec confirm).
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
  // 1 — Sidebar
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
  // 2 — Toggle semestres
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
  // 3 — Action création matière
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
  // 4 — Action création fiche
  {
    kind: 'wait-action',
    selector: '[data-tour="add-lesson"]',
    path: '/dashboard/fiches',
    title: () => 'Ta première fiche',
    body: (
      <>
        Bien joué. Maintenant une <strong>fiche</strong> dans cette matière (ex
        : « Glycolyse — étapes et régulation »). La date d&apos;apprentissage
        par défaut est aujourd&apos;hui — c&apos;est ton J0.
      </>
    ),
    waitFor: 'lessons',
    tipPos: 'bottom',
    spotPad: 6,
  },
  // 5 — Carte fiche : courbe J + notation
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
  // 6 — Action : ouvrir la modale
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
  // 7 — Picker J dans modale
  {
    kind: 'walkthrough',
    selector: '[data-tour="picker-j"]',
    path: '/dashboard/fiches',
    title: () => 'Le picker J',
    body: (
      <>
        Voici les 14 paliers de cette fiche. Les J <strong>passés ou
        d&apos;aujourd&apos;hui</strong> sont notables. Les J{' '}
        <strong>futurs</strong> sont verrouillés — ils se débloquent à la bonne
        date.
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },
  // 8 — Sources vidéo/PDF + Premium mention
  {
    kind: 'walkthrough',
    selector: '[data-tour="sources"]',
    path: '/dashboard/fiches',
    title: () => 'Vidéo et PDF du cours',
    body: (
      <>
        Upload ta <strong>vidéo</strong> (cours filmé) et le <strong>PDF</strong>{' '}
        du polycopié. C&apos;est ce qui sert de base à l&apos;IA pour générer
        tes QCM.
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
  // 9 — QCM IA + Premium mention
  {
    kind: 'walkthrough',
    selector: '[data-tour="qcm-section"]',
    path: '/dashboard/fiches',
    title: () => 'QCM générés par IA',
    body: (
      <>
        Dès que tu as ajouté une source, MedRev peut générer{' '}
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
  // 10 — Page Focus / Bibliothèque
  {
    kind: 'walkthrough',
    selector: '[data-tour="page-main"]',
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
    tipPos: 'left',
    spotPad: 0,
  },
  // 11 — Page Calendrier
  {
    kind: 'walkthrough',
    selector: '[data-tour="page-main"]',
    path: '/dashboard/calendar',
    title: () => 'Le Calendrier',
    body: (
      <>
        Vue <strong>semaine</strong> par défaut, groupée par matière. Max 10
        fiches par jour pour ne pas être noyé. Clique sur n&apos;importe quelle
        ligne pour ouvrir la modale de notation, comme depuis Mes matières.
      </>
    ),
    tipPos: 'left',
    spotPad: 0,
  },
  // 12 — Page Simulateur + Premium
  {
    kind: 'walkthrough',
    selector: '[data-tour="page-main"]',
    path: '/dashboard/simulateur',
    title: () => 'Le Simulateur',
    body: (
      <>
        QCM <strong>type concours</strong>. Deux modes :{' '}
        <strong>Apprentissage</strong> (avec corrections après chaque question)
        ou <strong>Examen blanc</strong> (timer, grille type concours, ressenti
        par question).
        <br />
        <br />
        <em className="ont-premium-note">
          Plan Gratuit : 1 session totale en Apprentissage.{' '}
          <strong>Premium</strong> : sessions illimitées + mode Examen blanc.
        </em>
      </>
    ),
    tipPos: 'left',
    spotPad: 0,
  },
  // 13 — Page Stats + Premium
  {
    kind: 'walkthrough',
    selector: '[data-tour="page-main"]',
    path: '/dashboard/stats',
    title: () => 'Tes Statistiques',
    body: (
      <>
        Bilan annuel : nombre de révisions, jours actifs, fiches maîtrisées,
        régularité.
        <br />
        <br />
        <em className="ont-premium-note">
          <strong>Premium</strong> : heatmap année 52 semaines, sparkline 12
          sem, dumbbell par matière (comparaison 1 mois vs maintenant).
        </em>
      </>
    ),
    tipPos: 'left',
    spotPad: 0,
  },
  // 14 — Final sur Tableau de bord
  {
    kind: 'walkthrough',
    selector: '[data-tour="page-main"]',
    path: '/dashboard',
    title: () => 'Bonne révision !',
    body: (
      <>
        Tu as fait le tour. Le <strong>Tableau de bord</strong> te montre ce
        qu&apos;il faut faire chaque jour : ta queue d&apos;aujourd&apos;hui,
        ton point faible, ta régularité, ta charge à venir. À toi de jouer — et
        bonne P1 !
      </>
    ),
    tipPos: 'left',
    spotPad: 0,
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

  // En replay : les wait-action 'systems' et 'lessons' deviennent walkthrough
  // (l'user a déjà des données, pas besoin de forcer création).
  // 'modal-open' reste un wait-action même en replay (le DOM doit avoir
  // la modale ouverte pour que les étapes 7-9 fonctionnent).
  const canBypassInReplay =
    cur.waitFor === 'systems' || cur.waitFor === 'lessons'
  const isEffectiveWaitAction =
    cur.kind === 'wait-action' && !(isReplay && canBypassInReplay)

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

  // ---------- Polling pour wait-action ----------
  useEffect(() => {
    if (!isEffectiveWaitAction || !cur.waitFor) {
      baselineRef.current = null
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    if (cur.waitFor === 'modal-open') {
      // Polling DOM : avance dès que [data-tour="review-modal"] apparaît
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

    // Polling Supabase avec baseline (systems / lessons)
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
  }, [stepIdx, userId, isEffectiveWaitAction])

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

  // ---------- ESC handler (sortie d'urgence) ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (window.confirm('Quitter le tutoriel ? Tu pourras le revoir depuis Paramètres.')) {
          handleSkip()
        }
      } else if (e.key === 'ArrowRight' && !isEffectiveWaitAction) {
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

  // ---------- Fallback chargement si l'élément n'est pas (encore) trouvé ----------
  if (!rect) {
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
            {/* Sur les wait-action, pas de bouton Passer (forcé). Sinon bouton dispo */}
            {!isEffectiveWaitAction && (
              <button className="ont-btn-ghost" onClick={handleSkip}>
                Passer le tutoriel
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------- Tooltip position ----------
  const TIP_W = 340
  const TIP_H_EST = 240
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
    if (pos === 'right' && rect.left + rect.width + GAP + TIP_W > vw - 16) pos = 'left'
    if (pos === 'left' && rect.left - GAP - TIP_W < 16) pos = 'bottom'
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
  const showWaitHint = isEffectiveWaitAction
  const showNextBtn = !isEffectiveWaitAction
  const showSkipBtn = !isEffectiveWaitAction // jamais sur les wait-action

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
          {showSkipBtn ? (
            <button className="ont-btn-ghost" onClick={handleSkip}>
              Passer le tutoriel
            </button>
          ) : (
            <span /> // espace réservé pour garder l'alignement flex
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
