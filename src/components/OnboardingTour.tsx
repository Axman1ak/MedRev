'use client'
// src/components/OnboardingTour.tsx
//
// Tour MedRev — 25 étapes en 3 phases.
// L'utilisateur clique LUI-MÊME chaque lien/bouton pour naviguer.
//
// Étape matière (5+6) : le bouton "Créer la matière" est BLOQUÉ pendant le
// tour. L'user doit cliquer Annuler pour avancer (étape 6).
//
// Étape fiche (8) : la création est FORCÉE via waitForCreate='lesson'. Le
// tour avance uniquement quand l'event medrev-lesson-created fire. Si l'user
// clique Annuler, fallback "Réouvre le formulaire" sans Suivant.
//
// Cas spécial : si l'user n'a aucune matière (a annulé l'étape 5), le
// fallback fiche affiche un message "Pas de matière disponible" + Suivant
// qui saute toute la phase fiche jusqu'à Calendrier (idx 13).
//
//   PHASE 1 — Accueil
//     1. Sidebar              — Welcome
//     2. Toggle semestres
//     3. Clic Mes matières (nav)
//
//   PHASE 2 — Mes matières (avec spot sur les formulaires qui apparaissent)
//     4. Clic + Matière
//     5. Spot sur le formulaire matière qui s'ouvre — explique les champs
//     6. Clic + Nouvelle fiche
//     7. Spot sur le formulaire fiche — explique les champs
//     8. Carte fiche — courbe J + notation
//     9. Clic carte fiche (ouvre la modale détaillée)
//    10. Picker J
//    11. Sources vidéo/PDF + Premium
//    12. QCM IA + Premium + dépendance Simulateur
//    13. Clic croix pour fermer la modale
//
//   PHASE 3 — Tour des onglets (l'élève clique chaque nav link lui-même)
//    14. Clic Calendrier (nav)
//    15. Calendrier — J auto
//    16. Clic Tableau de bord (nav)
//    17. Tableau de bord — centralise quotidien
//    18. Clic zone Bibliothèque
//    19. Bibliothèque — 1500 livres
//    20. Clic Simulateur (nav)
//    21. Simulateur — utilise les QCM générés + Premium
//    22. Clic Statistiques (nav)
//    23. Statistiques — Premium
//
// 3 kinds d'étapes :
//  - walkthrough  : spot + voile léger contrôlé + tooltip à côté + Suivant
//  - wait-click   : spot + voile + tooltip + avance au clic de l'élément
//  - tooltip-only : aucun spot, aucun voile, tooltip en haut à droite

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import './onboarding-tour.css'

type StepKind = 'walkthrough' | 'wait-click' | 'tooltip-only' | 'celebration'
type TipPos = 'right' | 'bottom' | 'top' | 'left'

interface Step {
  kind: StepKind
  selector?: string
  path?: string  // informatif seulement (plus d'auto-route)
  title: (firstName: string) => string
  body: React.ReactNode
  tipPos?: TipPos
  spotPad?: number
  dimmed?: boolean // par défaut true pour walkthrough/wait-click, false pour tooltip-only
  blockTargetClicks?: boolean // si true, bloque les clics à l'intérieur du target pendant cette étape
  blockSelectors?: string[] // sélecteurs additionnels à bloquer pendant cette étape (ex: bouton Créer pendant l'explication du form)
  // Si true, le tour avance automatiquement quand le selector disparaît du DOM
  // (ex: le user crée OU annule la matière → le form se ferme → on avance)
  autoAdvanceOnUnmount?: boolean
  // Force la création réelle d'une matière/fiche : le tour avance UNIQUEMENT
  // quand l'event correspondant est dispatché. Si l'user clique Annuler,
  // le fallback "Réouvre le formulaire" s'affiche sans Suivant disponible.
  waitForCreate?: 'system' | 'lesson'
}

const STEPS: Step[] = [
  // ============ PHASE 1 — ACCUEIL ============
  {
    kind: 'walkthrough',
    selector: '[data-tour="sidebar"]',
    title: (n) => `Bienvenue, ${n}`,
    body: (
      <>
        Trois minutes pour comprendre MedRev. Tu vois ici ta navigation —{' '}
        <strong>cinq espaces</strong> pour réviser.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="sem-toggle"]',
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
  {
    kind: 'wait-click',
    selector: '[data-tour="nav-fiches"]',
    title: () => 'Va sur Mes matières',
    body: (
      <>
        Clique sur <strong>Mes matières</strong> dans la sidebar — c&apos;est
        l&apos;onglet principal, tout part de là.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },

  // ============ PHASE 2 — MES MATIÈRES ============
  {
    kind: 'wait-click',
    selector: '[data-tour="add-system"]',
    title: () => 'Crée une matière',
    body: (
      <>
        Clique sur <strong>+ Matière</strong> pour ouvrir le formulaire.
      </>
    ),
    tipPos: 'bottom',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="matiere-form"]',
    title: () => 'Le formulaire de matière',
    body: (
      <>
        <strong>Nom</strong> — Anatomie, Biochimie, Histologie...
        <br />
        <strong>Couleur</strong> — pour distinguer la matière dans le calendrier.
        <br />
        <strong>Semestre</strong> — pour t&apos;organiser entre S1 et S2.
        <br /><br />
        Pendant le tutoriel, le bouton <strong>Créer la matière</strong> est
        désactivé. Clique sur <strong>Annuler</strong> pour continuer le tour.
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
    blockSelectors: ['[data-tour="matiere-create"]'],
  },
  {
    // Forcer Annuler pour fermer le form proprement
    kind: 'wait-click',
    selector: '[data-tour="matiere-cancel"]',
    title: () => 'Ferme le formulaire',
    body: (
      <>
        Clique sur <strong>Annuler</strong> pour fermer le formulaire et
        continuer le tour.
      </>
    ),
    tipPos: 'top',
    spotPad: 6,
  },
  {
    kind: 'wait-click',
    selector: '[data-tour="add-lesson"]',
    title: () => 'Ajoute une fiche',
    body: (
      <>
        Clique sur <strong>+ Nouvelle fiche</strong> pour découvrir le
        formulaire d&apos;ajout.
      </>
    ),
    tipPos: 'bottom',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="fiche-form"]',
    title: () => 'Crée ta première fiche',
    body: (
      <>
        Saisis un <strong>titre</strong> (ex : « Glycolyse — étapes et
        régulation »), vérifie la <strong>matière</strong>, et garde la{' '}
        <strong>date d&apos;apprentissage</strong> sur aujourd&apos;hui (c&apos;est
        ton J0).
        <br /><br />
        Puis clique <strong>Créer la fiche</strong> pour continuer le tour. À
        partir de J0, MedRev programme automatiquement les J1, J3, J5, J7...
        jusqu&apos;à J120.
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
    waitForCreate: 'lesson',
  },
  {
    // Étape fusionnée : explication courbe J + notation, ET clic pour ouvrir la modale
    kind: 'wait-click',
    selector: '[data-tour="lesson-card"]',
    title: () => 'La courbe J et la notation',
    body: (
      <>
        Chaque fiche affiche <strong>14 cases</strong> : les paliers J0, J1,
        J3, J5, J7, J15, J21, J30, J45, J60, J75, J90, J105, J120. À chaque
        échéance, tu notes ta révision de <strong>1</strong> (à revoir) à{' '}
        <strong>5</strong> (acquis).
        <br /><br />
        <strong>Clique sur la fiche</strong> pour ouvrir sa modale détaillée
        (picker des paliers, sources vidéo/PDF, QCM générés par IA).
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="picker-j"]',
    title: () => 'Le picker des paliers J',
    body: (
      <>
        Voici les 14 paliers de cette fiche. Les J <strong>passés ou
        d&apos;aujourd&apos;hui</strong> sont notables. Les J{' '}
        <strong>futurs</strong> sont verrouillés — ils se débloquent à la bonne date.
        <br /><br />
        (Pendant le tutoriel, ces paliers sont juste pour la démo —
        clique <strong>Suivant</strong> pour continuer.)
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
    blockTargetClicks: true,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="sources"]',
    title: () => 'Vidéo et PDF du cours',
    body: (
      <>
        Upload ta <strong>vidéo</strong> du cours filmé et le{' '}
        <strong>PDF</strong> du polycopié. C&apos;est ce qui sert de base à
        l&apos;IA pour générer tes QCM.
        <br /><br />
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
    title: () => 'QCM générés par IA',
    body: (
      <>
        MedRev génère automatiquement <strong>30 QCM</strong> par fiche dès
        qu&apos;une source est uploadée. Lance des sessions de révision ici.
        <br /><br />
        Important : <strong>ces QCM alimentent aussi le Simulateur</strong> —
        sans QCM générés, pas d&apos;examen blanc possible.
        <br /><br />
        <em className="ont-premium-note">
          Plan Gratuit : 5 générations IA totales sur tout le compte.{' '}
          <strong>Premium</strong> : illimité.
        </em>
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },
  {
    kind: 'wait-click',
    selector: '[data-tour="rmod-close"]',
    title: () => 'Ferme la modale',
    body: (
      <>
        Clique sur la <strong>croix</strong> en haut à droite pour fermer la
        modale et continuer le tour.
      </>
    ),
    tipPos: 'left',
    spotPad: 6,
  },

  // ============ PHASE 3 — TOUR DES ONGLETS ============
  {
    kind: 'wait-click',
    selector: '[data-tour="nav-calendar"]',
    title: () => 'Va sur Calendrier',
    body: (
      <>
        Clique sur <strong>Calendrier</strong> dans la sidebar.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'tooltip-only',
    title: () => 'Le Calendrier',
    body: (
      <>
        Tes fiches sont <strong>programmées automatiquement</strong> à tous les
        paliers J — J0, J1, J3, J5, J7, J15, J21, J30, J45, J60, J75, J90,
        J105, J120. Vue semaine groupée par matière, max 10 fiches par jour
        pour ne pas être noyé.
      </>
    ),
  },
  {
    kind: 'wait-click',
    selector: '[data-tour="nav-dashboard"]',
    title: () => 'Va sur Tableau de bord',
    body: (
      <>
        Clique sur <strong>Tableau de bord</strong> dans la sidebar.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'tooltip-only',
    title: () => 'Le Tableau de bord',
    body: (
      <>
        Tout ton travail quotidien est <strong>centralisé ici</strong> :
        <br />
        — la queue d&apos;<strong>aujourd&apos;hui</strong> (les fiches dues),
        <br />
        — ton <strong>point faible</strong> du moment,
        <br />
        — ta <strong>régularité</strong> (streak de jours actifs),
        <br />
        — ta <strong>charge à venir</strong> sur 4 semaines.
      </>
    ),
  },
  {
    kind: 'wait-click',
    selector: '[data-tour="bib-cta"]',
    title: () => 'Lance la session focus',
    body: (
      <>
        Clique sur le bouton vert <strong>Démarrer</strong> (ou{' '}
        <strong>Voir la session focus</strong> si tu n&apos;as pas encore de
        fiche due) pour découvrir la session focus gamifiée.
      </>
    ),
    tipPos: 'left',
    spotPad: 6,
  },
  {
    kind: 'tooltip-only',
    title: () => 'L’objectif : 1500 livres',
    body: (
      <>
        La <strong>session focus</strong> enchaîne tes fiches dues. Chaque
        fiche notée ajoute <strong>1 livre</strong> à ta bibliothèque (1 livre
        = 1h d&apos;étude). <strong>6 trésors</strong> à débloquer au fil des
        livres. Objectif : 1500 livres pour boucler la P1.
      </>
    ),
  },
  {
    // Quitter la session focus avant de passer au Simulateur
    kind: 'wait-click',
    selector: '[data-tour="focus-quit"]',
    title: () => 'Quitte la session focus',
    body: (
      <>
        Clique sur la <strong>croix</strong> en haut à droite de la session
        focus pour revenir au tableau de bord et continuer le tour.
      </>
    ),
    tipPos: 'left',
    spotPad: 6,
  },
  {
    kind: 'wait-click',
    selector: '[data-tour="nav-simu"]',
    title: () => 'Va sur Simulateur',
    body: (
      <>
        Clique sur <strong>Simulateur</strong> dans la sidebar.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'tooltip-only',
    title: () => 'Le Simulateur',
    body: (
      <>
        QCM <strong>type concours</strong>, tirés directement des{' '}
        <strong>QCM générés sur tes fiches</strong>. Pense à en générer
        plusieurs pour avoir des sessions variées.
        <br /><br />
        Mode <strong>Apprentissage</strong> avec corrections, ou{' '}
        <strong>Examen blanc</strong> avec timer et grille concours.
        <br /><br />
        <em className="ont-premium-note">
          Plan Gratuit : 1 session totale en Apprentissage.{' '}
          <strong>Premium</strong> : sessions illimitées + Examen blanc.
        </em>
      </>
    ),
  },
  {
    kind: 'wait-click',
    selector: '[data-tour="nav-stats"]',
    title: () => 'Va sur Statistiques',
    body: (
      <>
        Clique sur <strong>Statistiques</strong> dans la sidebar.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'tooltip-only',
    title: () => 'Les Statistiques',
    body: (
      <>
        Bilan annuel : nombre de révisions, jours actifs, fiches maîtrisées,
        régularité.
        <br /><br />
        <em className="ont-premium-note">
          <strong>Premium</strong> : heatmap année 52 sem, sparkline 12 sem,
          dumbbell par matière (comparaison 1 mois vs maintenant).
        </em>
      </>
    ),
  },

  // ============ FÉLICITATIONS ============
  {
    kind: 'celebration',
    title: (n) => `Bravo ${n} !`,
    body: (
      <>
        Tu as fait le tour de MedRev. Maintenant, à toi de jouer : crée tes
        matières, ajoute tes fiches, note tes révisions au fil des paliers J,
        et regarde ta <strong>bibliothèque se remplir</strong> jour après
        jour.
        <br /><br />
        Tu peux revoir ce tutoriel à tout moment depuis tes Paramètres.
        <br /><br />
        <strong>Bonne P1.</strong>
      </>
    ),
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

export default function OnboardingTour({ userId: _userId, userName, onComplete, onSkip }: Props) {
  const pathname = usePathname()

  const [stepIdx, setStepIdx] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const v = localStorage.getItem(LS_KEY)
    const n = v ? parseInt(v, 10) : 0
    if (isNaN(n) || n < 0 || n >= STEPS.length) return 0
    return n
  })
  const [rect, setRect] = useState<Rect | null>(null)

  const tipRef = useRef<HTMLDivElement | null>(null)
  const [tipDims, setTipDims] = useState<{ w: number; h: number } | null>(null)

  const firstName = (userName || 'toi').split(' ')[0]

  const cur = STEPS[stepIdx]
  const total = STEPS.length

  const isWaitClick = cur.kind === 'wait-click'
  const isTooltipOnly = cur.kind === 'tooltip-only'
  const isWalkthrough = cur.kind === 'walkthrough'
  const isCelebration = cur.kind === 'celebration'
  // Voile léger : par défaut sur walkthrough/wait-click, off pour tooltip-only.
  // Override possible via cur.dimmed.
  const dimmed = cur.dimmed ?? (!isTooltipOnly && !isCelebration)

  // ---------- Persist stepIdx ----------
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_KEY, String(stepIdx))
  }, [stepIdx])

  // (PAS d'auto-route — l'utilisateur clique chaque nav link lui-même)

  // ---------- Click listener (wait-click uniquement) ----------
  useEffect(() => {
    if (!isWaitClick || !cur.selector) return

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      const matched = target.closest(cur.selector!)
      if (matched) {
        setStepIdx(i => Math.min(STEPS.length - 1, i + 1))
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  // ---------- Listener events de création ----------
  // Sur les steps avec waitForCreate, on n'avance QUE si l'event de création
  // est dispatché (medrev-system-created / medrev-lesson-created depuis fiches-page).
  // L'utilisateur DOIT créer pour avancer — pas de skip possible.
  useEffect(() => {
    if (!cur.waitForCreate) return
    const eventName =
      cur.waitForCreate === 'system' ? 'medrev-system-created' : 'medrev-lesson-created'
    function onCreated() {
      setStepIdx(i => Math.min(STEPS.length - 1, i + 1))
    }
    window.addEventListener(eventName, onCreated)
    return () => window.removeEventListener(eventName, onCreated)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  // ---------- Click blocker pour les walkthrough avec interactions sensibles ----------
  // Deux mécanismes :
  //   - blockTargetClicks=true : bloque tout clic à l'intérieur du target principal
  //     (ex: étape picker-j — cliquer un palier ferait basculer la modale en notation)
  //   - blockSelectors=[...] : bloque les clics matchant ces sélecteurs spécifiques
  //     (ex: étape matiere-form — bloquer le bouton "Créer la matière" pour forcer
  //     l'utilisateur à passer par "Annuler")
  useEffect(() => {
    const targetBlocked = cur.blockTargetClicks && cur.selector
    const selectorsBlocked = cur.blockSelectors && cur.blockSelectors.length > 0
    if (!targetBlocked && !selectorsBlocked) return

    function blockClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      // Bloque si le target match
      if (targetBlocked && target.closest(cur.selector!)) {
        e.stopPropagation()
        e.preventDefault()
        return
      }
      // Bloque si l'un des blockSelectors match
      if (selectorsBlocked) {
        for (const sel of cur.blockSelectors!) {
          if (target.closest(sel)) {
            e.stopPropagation()
            e.preventDefault()
            return
          }
        }
      }
    }
    document.addEventListener('click', blockClick, true)
    return () => document.removeEventListener('click', blockClick, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  // ---------- Compute spotlight rect ----------
  const computeRect = useCallback(() => {
    if (typeof document === 'undefined') return
    if (isTooltipOnly || !cur.selector) {
      setRect(null)
      return
    }
    const el = document.querySelector(cur.selector) as HTMLElement | null
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [cur.selector, isTooltipOnly])

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

  // ---------- Mesure tooltip ----------
  useLayoutEffect(() => {
    if (!tipRef.current) return
    const r = tipRef.current.getBoundingClientRect()
    setTipDims({ w: r.width, h: r.height })
  }, [stepIdx, rect])

  // ---------- ESC ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (window.confirm('Quitter le tutoriel ? Tu pourras le revoir depuis Paramètres.')) {
          handleSkip()
        }
      } else if (e.key === 'ArrowRight' && !isWaitClick && !cur.waitForCreate) {
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

  // =================================================================
  //                       RENDU PAR KIND
  // =================================================================

  // --- CELEBRATION : popup centré final avec confettis CSS ---
  if (isCelebration) {
    return (
      <div className="ont-root" role="dialog" aria-modal="true" aria-label="Félicitations">
        <div className="ont-celebration-overlay">
          <div className="ont-confetti" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className={`ont-confetti-piece c-${i % 6}`} style={{ left: `${(i * 5.5) % 100}%`, animationDelay: `${(i % 7) * 0.15}s` }} />
            ))}
          </div>
          <div className="ont-celebration-card" ref={tipRef}>
            <div className="ont-celebration-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" width="64" height="64">
                <circle cx="32" cy="32" r="28" fill="#D8EAE0" />
                <path d="M20 33 L29 42 L46 22" stroke="#1B4332" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="ont-celebration-title">{cur.title(firstName)}</h3>
            <div className="ont-celebration-body">{cur.body}</div>
            <button className="ont-btn-primary ont-celebration-btn" onClick={handleComplete}>
              C&apos;est parti
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- TOOLTIP-ONLY : tooltip en haut à droite, aucun voile ---
  if (isTooltipOnly) {
    return (
      <div className="ont-root" role="dialog" aria-modal="true" aria-label="Tutoriel">
        <div
          className="ont-tip ont-tip-corner"
          ref={tipRef}
          style={{ top: 24, right: 24, width: 340 }}
        >
          <div className="ont-tip-step">Étape {stepIdx + 1} sur {total}</div>
          <h4 className="ont-tip-title">{cur.title(firstName)}</h4>
          <div className="ont-tip-body">{cur.body}</div>
          <ProgressBars count={total} active={stepIdx} />
          <div className="ont-tip-actions">
            <button className="ont-btn-ghost" onClick={handleSkip}>
              Passer le tutoriel
            </button>
            <div className="ont-tip-actions-right">
              {stepIdx > 0 && (
                <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
              )}
              <button className="ont-btn-primary" onClick={next}>
                {stepIdx === STEPS.length - 1 ? 'Terminer' : 'Suivant →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Fallback (élément introuvable) : tooltip dans le coin, pas de voile ---
  if (!rect) {
    // Cas spécial 1 : step waitForCreate, l'user a fermé le form sans créer.
    // PAS d'échappatoire — l'utilisateur doit créer pour avancer.
    // Seules issues de secours : Précédent ou Passer le tutoriel (skip total).
    if (cur.waitForCreate) {
      const itemLabel = cur.waitForCreate === 'system' ? 'matière' : 'fiche'
      const buttonLabel = cur.waitForCreate === 'system' ? '+ Matière' : '+ Nouvelle fiche'
      return (
        <div className="ont-root" role="dialog" aria-modal="true">
          <div
            className="ont-tip ont-tip-corner"
            ref={tipRef}
            style={{ top: 24, right: 24, width: 360 }}
          >
            <div className="ont-tip-step">Étape {stepIdx + 1} sur {total}</div>
            <h4 className="ont-tip-title">Réouvre le formulaire</h4>
            <div className="ont-tip-body">
              Tu as fermé le formulaire sans créer de {itemLabel}. Pour
              continuer le tutoriel, tu dois créer une {itemLabel}.
              <br /><br />
              Clique à nouveau sur <strong>{buttonLabel}</strong> en haut à
              droite pour rouvrir le formulaire.
            </div>
            <div className="ont-tip-hint">
              <span className="ont-tip-pulse" /> En attente de la création…
            </div>
            <ProgressBars count={total} active={stepIdx} />
            <div className="ont-tip-actions">
              <button className="ont-btn-ghost" onClick={handleSkip}>
                Passer le tutoriel
              </button>
              <div className="ont-tip-actions-right">
                {stepIdx > 0 && (
                  <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
                )}
                {/* Aucun bouton Suivant — la création est obligatoire */}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Cas spécial 2 : utilisateur sans fiche encore créée. La phase lesson-card
    // (étapes 9-13, indices 8-12) ne peut pas s'afficher. On consolide ces 5
    // étapes en un aperçu unique et on saute directement à la phase 3 (Calendrier).
    const inLessonRange = stepIdx >= 8 && stepIdx <= 12
    const onFichesPage = pathname === '/dashboard/fiches'
    const noLessonCardInDom =
      typeof document !== 'undefined' &&
      !document.querySelector('[data-tour="lesson-card"]')

    if (inLessonRange && onFichesPage && noLessonCardInDom) {
      return (
        <div className="ont-root" role="dialog" aria-modal="true">
          <div
            className="ont-tip ont-tip-corner"
            ref={tipRef}
            style={{ top: 24, right: 24, width: 360 }}
          >
            <div className="ont-tip-step">
              Aperçu (étapes {stepIdx + 1} à 14)
            </div>
            <h4 className="ont-tip-title">Aucune fiche encore créée</h4>
            <div className="ont-tip-body">
              Tu n&apos;as pas encore de fiche. Voici un aperçu de ce que tu
              trouveras une fois que tu en auras créé une :
              <br /><br />
              <strong>Carte fiche</strong> — 14 cases représentent les 14
              paliers J0 → J120. Notation de <strong>1</strong> (à revoir) à{' '}
              <strong>5</strong> (acquis) à chaque échéance.
              <br /><br />
              <strong>Modale détaillée</strong> (clic sur une fiche) :
              <br />• picker des paliers J pour noter
              <br />• upload <strong>vidéo</strong> + <strong>PDF</strong> du cours
              <br />• <strong>QCM générés par IA</strong> à partir des sources
              <br /><br />
              On passe directement au reste du tour.
            </div>
            <ProgressBars count={total} active={stepIdx} />
            <div className="ont-tip-actions">
              <button className="ont-btn-ghost" onClick={handleSkip}>
                Passer le tutoriel
              </button>
              <div className="ont-tip-actions-right">
                {stepIdx > 0 && (
                  <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
                )}
                <button
                  className="ont-btn-primary"
                  onClick={() => setStepIdx(13)}
                >
                  Continuer le tour →
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="ont-root" role="dialog" aria-modal="true">
        <div
          className="ont-tip ont-tip-corner"
          ref={tipRef}
          style={{ top: 24, right: 24, width: 340 }}
        >
          <div className="ont-tip-step">Étape {stepIdx + 1} sur {total}</div>
          <h4 className="ont-tip-title">{cur.title(firstName)}</h4>
          <div className="ont-tip-body" style={{ color: '#6B6F6A' }}>
            {cur.body}
          </div>
          <ProgressBars count={total} active={stepIdx} />
          <div className="ont-tip-actions">
            <button className="ont-btn-ghost" onClick={handleSkip}>
              Passer le tutoriel
            </button>
            <div className="ont-tip-actions-right">
              {stepIdx > 0 && (
                <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
              )}
              <button className="ont-btn-primary" onClick={next}>
                {stepIdx === STEPS.length - 1 ? 'Terminer' : 'Suivant →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Tooltip position ----------
  const TIP_W_PREF = 340
  const tipW = tipDims?.w || TIP_W_PREF
  const tipH = tipDims?.h || 360
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

    top = clamp(top, MARGIN, Math.max(MARGIN, vh - tipH - MARGIN))
    left = clamp(left, MARGIN, Math.max(MARGIN, vw - tipW - MARGIN))

    tipStyle = { top, left, width: TIP_W_PREF }
  }

  const isFirst = stepIdx === 0
  const isLast = stepIdx === STEPS.length - 1
  const isWaitingForCreate = !!cur.waitForCreate
  const spotClassName = `ont-spot${dimmed ? ' ont-spot-dim' : ''}`

  return (
    <div className="ont-root" role="dialog" aria-modal="true" aria-label="Tutoriel">
      <div
        className={spotClassName}
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

        {(isWaitClick || isWaitingForCreate) && (
          <div className="ont-tip-hint">
            <span className="ont-tip-pulse" />{' '}
            {isWaitingForCreate ? 'En attente de la création…' : 'En attente de ton clic…'}
          </div>
        )}

        <ProgressBars count={total} active={stepIdx} />

        <div className="ont-tip-actions">
          {isWalkthrough ? (
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
            {isWalkthrough && !isWaitingForCreate && (
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
