'use client'
// src/components/OnboardingTour.tsx
//
// Tour MedRev — 26 étapes en 3 phases.
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
//    18. Clic zone Progression
//    19. La session de travail
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
import { usePathname, useRouter } from 'next/navigation'
import './onboarding-tour.css'

type StepKind = 'walkthrough' | 'wait-click' | 'tooltip-only' | 'celebration'
type TipPos = 'right' | 'bottom' | 'top' | 'left'

interface Step {
  kind: StepKind
  selector?: string
  // Page sur laquelle la cible de cette étape existe. Si l'élève n'y est
  // plus, le tour l'y ramène tout seul : sans ça, un clic de travers suffit à
  // laisser le tutoriel pointer un élément absent, sans rien proposer.
  // On ne la met PAS sur les étapes « clique sur tel onglet » : la cible y est
  // un lien de la barre latérale, présent partout, et c'est l'élève qui doit
  // faire le geste.
  route?: string
  // L'étape parle d'une fiche existante. Si aucune carte n'est à l'écran, le
  // tour demande à la page Fiches d'en montrer une avant de renoncer.
  besoinFiche?: boolean
  title: (firstName: string) => string
  body: React.ReactNode
  // Title et body alternatifs utilisés UNIQUEMENT pour les steps avec
  // waitForCreate quand l'user a déjà des fiches (existingLessonCount > 0).
  // Permet d'afficher un tooltip différent qui ne demande pas de créer.
  titleAlt?: (firstName: string) => string
  bodyAlt?: React.ReactNode
  tipPos?: TipPos
  spotPad?: number
  // Forme du spotlight : rect (par défaut) ou circle (utile pour les boutons
  // ronds comme la croix de fermeture). Si circle, force un carré dont le
  // côté = max(width, height) + 2*spotPad et applique border-radius: 50%.
  spotShape?: 'rect' | 'circle'
  dimmed?: boolean // par défaut true pour walkthrough/wait-click, false pour tooltip-only
  // Si true, le tour avance automatiquement quand le selector disparaît du DOM
  // (ex: le user crée OU annule la matière → le form se ferme → on avance)
  autoAdvanceOnUnmount?: boolean
  // Si true, le tour avance après 800ms si le selector n'est PAS trouvé dans
  // le DOM. Utile pour les steps qui ne s'appliquent qu'à certains users
  // (ex: clic Annuler qui n'a pas lieu pour les new users qui ont créé).
  autoAdvanceIfTargetMissing?: boolean
  // Force la création réelle d'une matière/fiche : le tour avance UNIQUEMENT
  // quand l'event correspondant est dispatché. Si l'user clique Annuler,
  // le fallback "Réouvre le formulaire" s'affiche sans Suivant disponible.
  // NB : la "force" ne s'applique que si l'user n'a pas déjà l'item en DB.
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
        Trois minutes pour comprendre MedRev. Tu vois ici ta navigation,{' '}
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
    title: () => 'Va sur Fiches',
    body: (
      <>
        Clique sur <strong>Fiches</strong> dans la sidebar. C&apos;est
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
    route: '/dashboard/fiches',
    title: () => 'Crée une matière',
    body: (
      <>
        Clique sur l&apos;icône <strong>Matière</strong> (le classeur) pour ouvrir le formulaire.
      </>
    ),
    tipPos: 'bottom',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="matiere-form"]',
    route: '/dashboard/fiches',
    title: () => 'Le formulaire de matière',
    body: (
      <>
        <strong>Nom</strong> : Anatomie, Biochimie, Histologie...
        <br />
        <strong>Couleur</strong> : pour distinguer la matière dans le calendrier.
        <br />
        <strong>Semestre</strong> : pour t&apos;organiser entre S1 et S2.
        <br /><br />
        Tu peux la créer maintenant si tu veux, ou passer : le tour continue
        dans les deux cas.
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
  },
  // Note 2026-05-15 : l'ancien step "Ferme le formulaire matière" a été retiré
  // pour raccourcir le tour. Le formulaire matière se ferme via autoAdvance
  // (form unmount) ou l'user clique Suivant manuellement.
  {
    kind: 'wait-click',
    selector: '[data-tour="add-lesson"]',
    route: '/dashboard/fiches',
    title: () => 'Ajoute une fiche',
    body: (
      <>
        Clique sur l&apos;icône <strong>Fiche</strong> (la feuille, en bleu)
        pour découvrir le formulaire d&apos;ajout.
      </>
    ),
    tipPos: 'bottom',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="fiche-form"]',
    route: '/dashboard/fiches',
    title: () => 'Crée ta première fiche',
    body: (
      <>
        Saisis un <strong>titre</strong> (ex : « Glycolyse, étapes et
        régulation »), vérifie la <strong>matière</strong>, et garde la{' '}
        <strong>date d&apos;apprentissage</strong> sur aujourd&apos;hui (c&apos;est
        ton J0). Le <strong>chapitre</strong> est optionnel : il regroupe tes
        fiches selon le découpage de ta fac ou de ta prépa.
        <br /><br />
        Puis clique <strong>Créer la fiche</strong> pour continuer le tour. À
        partir de J0, MedRev programme automatiquement les J1, J3, J5, J7...
        jusqu&apos;à J120.
      </>
    ),
    // Tooltip alternatif si l'user a déjà des fiches (replay) : on ne
    // demande PAS de créer, on explique juste le formulaire.
    titleAlt: () => 'Le formulaire de fiche',
    bodyAlt: (
      <>
        Voici le formulaire pour créer une nouvelle fiche :
        <br />
        <strong>Titre</strong> : « Glycolyse, étapes et régulation »
        <br />
        <strong>Matière</strong> : où la fiche est rangée
        <br />
        <strong>Date d&apos;apprentissage (J0)</strong> : à partir de cette
        date, les J1, J3, J5, J7... jusqu&apos;à J120 se programment
        automatiquement.
        <br /><br />
        Tu as déjà des fiches en compte, donc tu n&apos;as pas besoin d&apos;en
        créer une nouvelle. Clique sur <strong>Annuler</strong> ou{' '}
        <strong>Suivant</strong> pour continuer le tour.
      </>
    ),
    tipPos: 'right',
    spotPad: 8,
    waitForCreate: 'lesson',
  },
  // Note 2026-05-15 : l'ancien step "Ferme le formulaire fiche" a été retiré
  // pour raccourcir le tour. Le formulaire se ferme via Créer (new user) ou
  // l'user clique Annuler/Suivant lui-même (returning user).
  {
    // Étape fusionnée : explication courbe J + notation, ET clic pour ouvrir la modale
    kind: 'wait-click',
    selector: '[data-tour="lesson-card"]',
    route: '/dashboard/fiches',
    besoinFiche: true,
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
    route: '/dashboard/fiches',
    besoinFiche: true,
    title: () => 'Le picker des paliers J',
    body: (
      <>
        Voici les 14 paliers de cette fiche. Les J <strong>passés ou
        d&apos;aujourd&apos;hui</strong> sont notables. Les J{' '}
        <strong>futurs</strong> sont verrouillés. Ils se débloquent à la bonne date.
        <br /><br />
        Essaie d'en noter un si tu veux, ou passe à la suite.
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },
  {
    kind: 'walkthrough',
    selector: '[data-tour="sources"]',
    route: '/dashboard/fiches',
    besoinFiche: true,
    title: () => 'Vidéo et PDF du cours',
    body: (
      <>
        Upload ta <strong>vidéo</strong> du cours filmé et le{' '}
        <strong>PDF</strong> du polycopié. C&apos;est ce qui sert de base à
        l&apos;IA pour générer tes QCM.
        <br /><br />
        <em className="ont-premium-note">
          Plan Gratuit : 100 Mo de vidéo (~30 min), 20 Mo de PDF, 1 par fiche.{' '}
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
    route: '/dashboard/fiches',
    besoinFiche: true,
    title: () => 'QCM générés par IA',
    body: (
      <>
        MedRev crée des QCM à partir de ton cours : <strong>10, 20 ou 30</strong>,
        tu choisis combien. Lance des sessions de révision ici.
        <br /><br />
        Important : <strong>ces QCM alimentent aussi le Simulateur</strong>.
        Sans QCM générés, pas d&apos;examen blanc possible.
        <br /><br />
        Juste en dessous : tes <strong>flashcards recto/verso</strong>, à créer
        toi-même pour les définitions et valeurs à connaître par cœur.
        <br /><br />
        <em className="ont-premium-note">
          Pendant la bêta : 5 créations de QCM et 5 fiches de synthèse
          par mois, remises à zéro le 1er du mois.
        </em>
      </>
    ),
    tipPos: 'right',
    spotPad: 6,
  },
  // Note 2026-05-15 : l'ancien step "Ferme la modale" (clic sur la croix) a
  // été retiré. Fermer un modal est un geste évident que les users savent
  // faire — pas besoin de leur dire.

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
    route: '/dashboard/calendar',
    title: () => 'Le Calendrier',
    body: (
      <>
        Tes fiches sont <strong>programmées automatiquement</strong> à tous les
        paliers J, de J0 à J+120. Ajoute aussi tes <strong>TD et cours de
        fac</strong> avec le bouton <strong>+ TD</strong> (répétables chaque
        semaine), et <strong>imprime ta semaine</strong> d&apos;un clic pour
        l&apos;avoir sur ton bureau.
      </>
    ),
  },
  {
    kind: 'wait-click',
    selector: '[data-tour="nav-dashboard"]',
    title: () => "Va sur Aujourd'hui",
    body: (
      <>
        Clique sur <strong>Aujourd&apos;hui</strong> dans la sidebar.
      </>
    ),
    tipPos: 'right',
    spotPad: 4,
  },
  {
    kind: 'tooltip-only',
    route: '/dashboard',
    title: () => "Aujourd'hui, ton tableau de bord",
    body: (
      <>
        Tout ton travail quotidien est <strong>centralisé ici</strong> :
        les <strong>fiches du jour</strong> (triées par urgence), tes{' '}
        <strong>TD du jour</strong>, ta <strong>to-do</strong> et ta{' '}
        <strong>progression</strong> semaine après semaine.
      </>
    ),
  },
  // Session de travail : un seul tooltip explicatif au lieu de
  // forcer l'user à lancer puis quitter la session focus pendant le tour
  // (3 étapes économisées). L'user découvrira la session focus lui-même
  // depuis le dashboard quand il aura quelques fiches notées.
  {
    kind: 'tooltip-only',
    route: '/dashboard',
    title: () => 'La session de travail',
    body: (
      <>
        Le bouton <strong>Démarrer la session</strong> enchaîne tes fiches du
        jour, chacune en trois étapes : <strong>relire</strong> une fiche de
        synthèse courte et tes pièges, <strong>t&apos;entraîner</strong> sur 10
        QCM du cours, puis <strong>te noter</strong> avec ton résultat sous les
        yeux. Chaque erreur devient une flashcard. Ton temps de travail et ta
        maîtrise par matière s&apos;affichent dans la carte{' '}
        <strong>Ta progression</strong>.
      </>
    ),
  },
  {
    kind: 'wait-click',
    // La barre pose data-tour={`nav-${href.split('/').pop()}`}, donc
    // « nav-simulateur » et non « nav-simu » : avec l'ancien nom, aucun élément
    // ne correspondait. Le projecteur ne se posait nulle part, la bulle
    // tombait dans le coin, et le clic sur Simulateur ne faisait pas avancer
    // le tour, puisqu'il est détecté par ce même sélecteur.
    selector: '[data-tour="nav-simulateur"]',
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
    route: '/dashboard/simulateur',
    title: () => 'Le Simulateur',
    body: (
      <>
        Trois sources au choix : tes <strong>QCM générés</strong>, «{' '}
        <strong>Ce que j&apos;ai raté</strong> » (tes points faibles), ou tes{' '}
        <strong>annales en PDF</strong> : importe un vrai sujet, les questions
        en sont extraites automatiquement.
        <br /><br />
        Mode <strong>Apprentissage</strong> avec corrections, ou{' '}
        <strong>Examen blanc</strong> avec timer et grille officielle.
        <br /><br />
        <em className="ont-premium-note">
          Plan Gratuit : 3 sessions totales en Apprentissage.{' '}
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
    route: '/dashboard/stats',
    title: () => 'Les Statistiques',
    body: (
      <>
        Où tu en es, matière par matière : tes fiches{' '}
        <strong>maîtrisées</strong>, celles <strong>en retard</strong>, ta
        réussite aux <strong>QCM</strong> et ton temps de travail. Les fiches
        les plus faibles sont listées pour les retravailler en un clic.
        <br /><br />
        Juste en dessous, la <strong>Bibliothèque</strong> : chaque révision
        notée y ajoute un livre, et ton <strong>rang</strong> monte avec.
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
        et regarde ta <strong>progression</strong> monter semaine après
        semaine.
        <br /><br />
        Tu peux revoir ce tutoriel à tout moment depuis tes Réglages.
        <br /><br />
        <strong>Bonne première année.</strong>
      </>
    ),
  },
]

// Bornes de la phase qui a besoin d'une fiche existante. Calculées depuis
// STEPS : elles étaient écrites en dur (9 à 13) et sont devenues fausses au
// premier réordonnancement — le tour proposait alors son résumé « aucune
// fiche » sur les étapes du calendrier.
const PREMIERE_FICHE = STEPS.findIndex(s => s.besoinFiche)
const DERNIERE_FICHE = STEPS.map(s => !!s.besoinFiche).lastIndexOf(true)
const APRES_FICHES = DERNIERE_FICHE + 1

const LS_KEY = 'medrev-onboarding-step'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
  onSkip: () => void
  isReplay?: boolean
  existingLessonCount?: number // si > 0, l'user a déjà des fiches → pas de force creation
}

interface Rect { top: number; left: number; width: number; height: number }

export default function OnboardingTour({
  userId: _userId,
  userName,
  onComplete,
  onSkip,
  existingLessonCount = 0,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  // Dans une ref, jamais en dépendance d'effet : l'objet rendu par useRouter
  // change d'identité à chaque mise à jour du contexte de navigation, et un
  // effet qui en dépend se relance en boucle — son minuteur n'arrive alors
  // jamais à terme. Même piège que le `rect` du projecteur, plus bas.
  const routerRef = useRef(router)
  routerRef.current = router

  const [stepIdx, setStepIdx] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const v = localStorage.getItem(LS_KEY)
    const n = v ? parseInt(v, 10) : 0
    if (isNaN(n) || n < 0 || n >= STEPS.length) return 0
    return n
  })
  const [rect, setRect] = useState<Rect | null>(null)
  // Y a-t-il une carte de fiche à l'écran ? Gardé en état, et non lu au vol
  // pendant le rendu : la page Fiches peut en faire apparaître une APRÈS
  // (voir l'effet « faire apparaître une fiche »), et un test fait pendant le
  // rendu ne serait jamais refait — le tour restait bloqué sur son message
  // « aucune fiche encore créée » alors qu'une carte était là.
  const [carteFiche, setCarteFiche] = useState(false)

  const tipRef = useRef<HTMLDivElement | null>(null)
  const [tipDims, setTipDims] = useState<{ w: number; h: number } | null>(null)

  const firstName = (userName || 'toi').split(' ')[0]

  const cur = STEPS[stepIdx]
  const total = STEPS.length

  const isWaitClick = cur.kind === 'wait-click'
  const isTooltipOnly = cur.kind === 'tooltip-only'
  const isCelebration = cur.kind === 'celebration'
  const isWaitingForCreate = !!cur.waitForCreate
  // shouldForceCreate : on force la création UNIQUEMENT si l'user n'a pas
  // déjà de fiche existante. Sinon le tour propose Suivant pour skipper.
  const shouldForceCreate = isWaitingForCreate && existingLessonCount === 0
  // Pour les steps waitForCreate, si l'user n'est pas forcé (a déjà des
  // fiches), on utilise le tooltip alternatif (ne demande pas de créer).
  const useAltContent = isWaitingForCreate && !shouldForceCreate && cur.bodyAlt
  const stepTitle = useAltContent && cur.titleAlt ? cur.titleAlt(firstName) : cur.title(firstName)
  const stepBody = useAltContent && cur.bodyAlt ? cur.bodyAlt : cur.body
  // Voile léger : par défaut sur walkthrough/wait-click, off pour tooltip-only.
  // Override possible via cur.dimmed.
  const dimmed = cur.dimmed ?? (!isTooltipOnly && !isCelebration)

  // ---------- Persist stepIdx ----------
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_KEY, String(stepIdx))
  }, [stepIdx])

  // (PAS d'auto-route — l'utilisateur clique chaque nav link lui-même)

  // ---------- Ramener l'élève sur la page de l'étape ----------
  // Le tour laissait l'élève se perdre : un clic ailleurs, et l'étape pointait
  // un élément absent de la page, sans jamais y revenir. Chaque étape sait
  // maintenant où vit sa cible ; si on n'y est plus, on y retourne.
  // Le délai laisse la page finir de se monter avant qu'on la déclare perdue.
  useEffect(() => {
    if (!cur.route || pathname === cur.route) return
    const cible = cur.route
    // Le délai laisse la page finir de se monter avant qu'on la déclare perdue.
    // D'abord la navigation douce du routeur, qui garde l'état de la page.
    const doux = setTimeout(() => routerRef.current.push(cible), 450)
    // Puis le filet. Mesuré : `router.push` reste parfois sans effet, l'URL ne
    // bouge pas et le tour continue de désigner un élément absent — soit
    // exactement la panne qu'on répare. Au bout de deux secondes on recharge
    // pour de bon : c'est moins élégant, ça aboutit toujours, et l'étape en
    // cours est dans localStorage, donc le tour reprend où il en était.
    const dur = setTimeout(() => {
      if (window.location.pathname !== cible) window.location.assign(cible)
    }, 2000)
    return () => { clearTimeout(doux); clearTimeout(dur) }
  }, [stepIdx, cur.route, pathname])

  // ---------- Faire apparaître une fiche quand l'étape en parle ----------
  // Une carte de fiche peut manquer à l'écran sans que l'élève y soit pour
  // rien : sa matière sélectionnée n'en a aucune, ou ses fiches sont dans
  // l'autre semestre. On demande alors à la page Fiches d'en montrer une.
  // Une seule demande par étape, sinon on lutterait contre l'élève qui
  // change de matière pendant que le tour tourne.
  const ficheDemandee = useRef<number | null>(null)
  useEffect(() => {
    // Pas de garde sur le nombre de fiches connu : il vient d'une requête du
    // layout qui peut ne rien avoir renvoyé. Si l'étudiant n'a vraiment aucune
    // fiche, la demande ne trouve rien à montrer et le repli « aucune fiche »
    // prend le relais — ça ne coûte rien, et ça évite de dépendre d'un
    // compteur pour une décision qu'on peut lire dans le DOM.
    if (!cur.besoinFiche) return
    if (pathname !== '/dashboard/fiches') return
    if (ficheDemandee.current === stepIdx) return
    const id = setTimeout(() => {
      if (document.querySelector('[data-tour="lesson-card"]')) return
      ficheDemandee.current = stepIdx
      window.dispatchEvent(new CustomEvent('medrev-tour-voir-fiche'))
    }, 500)
    return () => clearTimeout(id)
  }, [stepIdx, cur.besoinFiche, pathname])

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

  // ---------- Auto-advance si le target est introuvable ----------
  // Utilisé par exemple pour le step "Clique Annuler" qui n'a pas lieu
  // pour les new users (form déjà fermé via Créer). On skip après 800ms.
  useEffect(() => {
    if (!cur.autoAdvanceIfTargetMissing || !cur.selector) return
    const id = setTimeout(() => {
      if (typeof document === 'undefined') return
      if (!document.querySelector(cur.selector!)) {
        setStepIdx(i => Math.min(STEPS.length - 1, i + 1))
      }
    }, 800)
    return () => clearTimeout(id)
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

  // ---------- La barre reste dépliée quand le tour la désigne ----------
  // Le rail fait 76 px et ne s'ouvre qu'au survol. Dès qu'on éloignait la
  // souris pour cliquer « Suivant », il se repliait : la cible changeait de
  // taille, donc le projecteur et la bulle sautaient. On le force ouvert
  // pendant les étapes qui parlent de la barre.
  // Volontairement SANS `rect` dans les dépendances : le projecteur se
  // recalcule toutes les 800 ms avec un nouvel objet, donc l'effet se
  // rejouerait aussi souvent, et son nettoyage retirerait la classe une image
  // sur deux — le rail clignoterait. On relit la cible à intervalle court à la
  // place, et classList.toggle avec la même valeur ne fait rien.
  useEffect(() => {
    const rail = document.querySelector('.db-sidebar')
    if (!rail) return
    const appliquer = () => {
      const cible = cur.selector ? document.querySelector(cur.selector) : null
      rail.classList.toggle('tour-open', !!cible && rail.contains(cible))
    }
    appliquer()
    const id = setInterval(appliquer, 400)
    return () => { clearInterval(id); rail.classList.remove('tour-open') }
  }, [stepIdx, cur.selector])

  // ---------- Compute spotlight rect ----------
  const computeRect = useCallback(() => {
    if (typeof document === 'undefined') return
    setCarteFiche(!!document.querySelector('[data-tour="lesson-card"]'))
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
        // Avant : window.confirm(). Une boîte de dialogue native au milieu
        // d'une interface soignée fait bricolage, et elle demandait une
        // confirmation pour une action sans conséquence. Échap met le tour
        // en pause, comme le bouton « Plus tard » : la position est gardée,
        // on reprend là où on s'était arrêté.
        pauseTour()
      } else if (e.key === 'ArrowRight' && !isWaitClick) {
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
  // Deux façons de sortir, et c'est la distinction qui manquait.
  //
  // « Plus tard » met en PAUSE : l'étape courante reste en mémoire et le tour
  // reprend là où on l'a laissé à la prochaine visite. Avant, le seul bouton
  // disponible effaçait la progression, donc tout étudiant qui voulait juste
  // regarder une fiche perdait le tutoriel pour de bon.
  function pauseTour() {
    // On ne touche pas à LS_KEY : il contient déjà l'étape courante,
    // réécrite à chaque changement d'étape.
    onSkip()
  }

  // « Ne plus me le montrer » abandonne vraiment.
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
                <path d="M20 33 L29 42 L46 22" stroke="#1B3A5B" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
            <button className="ont-btn-ghost" onClick={pauseTour}>
              Plus tard
            </button>
            <button className="ont-btn-quit" onClick={handleSkip}>
              Ne plus me le montrer
            </button>
            <div className="ont-tip-actions-right">
              {stepIdx > 0 && (
                <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
              )}
              <button className="ont-btn-primary" onClick={next}>
                {stepIdx === STEPS.length - 1 ? 'Terminer' : 'Suivant'}
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
    // - shouldForceCreate=true (nouveau compte) : pas de Suivant, doit créer.
    // - sinon (user a déjà des fiches) : Suivant disponible pour skipper.
    if (cur.waitForCreate) {
      const itemLabel = cur.waitForCreate === 'system' ? 'matière' : 'fiche'
      const buttonLabel = cur.waitForCreate === 'system' ? 'Matière' : 'Fiche'
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
              Tu as fermé le formulaire sans créer de {itemLabel}.
              {shouldForceCreate ? (
                <>
                  {' '}Tu peux le rouvrir avec l&apos;icône <strong>{buttonLabel}</strong> en
                  haut à droite, ou passer cette étape : le tour continue dans
                  les deux cas.
                </>
              ) : (
                <>
                  {' '}Tu peux soit cliquer à nouveau sur l&apos;icône{' '}
                  <strong>{buttonLabel}</strong> pour le rouvrir, soit passer
                  cette étape (tu as déjà des fiches existantes).
                </>
              )}
            </div>
            {shouldForceCreate && (
              <div className="ont-tip-hint">
                <span className="ont-tip-pulse" /> Le tour reprend tout seul si tu la crées.
              </div>
            )}
            <ProgressBars count={total} active={stepIdx} />
            <div className="ont-tip-actions">
              <button className="ont-btn-ghost" onClick={pauseTour}>
                Plus tard
              </button>
              <button className="ont-btn-quit" onClick={handleSkip}>
                Ne plus me le montrer
              </button>
              <div className="ont-tip-actions-right">
                {stepIdx > 0 && (
                  <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
                )}
                {/* « Suivant » est désormais TOUJOURS disponible, même sur
                    l'étape qui demandait de créer une matière. Une visite
                    guidée qui refuse d'avancer tant qu'on n'a pas fait le
                    geste attendu n'est plus une visite, c'est un formulaire.
                    L'étape reste là, elle propose, elle n'impose plus. */}
                <button className="ont-btn-primary" onClick={next}>
                  {shouldForceCreate ? 'Plus tard, continuer' : 'Suivant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Cas spécial 2 : utilisateur sans fiche encore créée. La phase lesson-card
    // (étapes 10-14, indices 9-13) ne peut pas s'afficher. On consolide ces 5
    // étapes en un aperçu unique et on saute directement à la phase 3 (Calendrier).
    const inLessonRange = stepIdx >= PREMIERE_FICHE && stepIdx <= DERNIERE_FICHE
    const onFichesPage = pathname === '/dashboard/fiches'
    if (inLessonRange && onFichesPage && !carteFiche) {
      return (
        <div className="ont-root" role="dialog" aria-modal="true">
          <div
            className="ont-tip ont-tip-corner"
            ref={tipRef}
            style={{ top: 24, right: 24, width: 360 }}
          >
            <div className="ont-tip-step">
              Aperçu (étapes {stepIdx + 1} à {DERNIERE_FICHE + 1})
            </div>
            <h4 className="ont-tip-title">Aucune fiche encore créée</h4>
            <div className="ont-tip-body">
              Tu n&apos;as pas encore de fiche. Voici un aperçu de ce que tu
              trouveras une fois que tu en auras créé une :
              <br /><br />
              <strong>Carte fiche</strong> : 14 cases représentent les 14
              paliers de J0 à J120. Notation de <strong>1</strong> (à revoir) à{' '}
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
              <button className="ont-btn-ghost" onClick={pauseTour}>
                Plus tard
              </button>
              <button className="ont-btn-quit" onClick={handleSkip}>
                Ne plus me le montrer
              </button>
              <div className="ont-tip-actions-right">
                {stepIdx > 0 && (
                  <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
                )}
                <button
                  className="ont-btn-primary"
                  onClick={() => setStepIdx(APRES_FICHES)}
                >
                  Continuer le tour
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
          <h4 className="ont-tip-title">{stepTitle}</h4>
          <div className="ont-tip-body" style={{ color: '#6B6F6A' }}>
            {stepBody}
          </div>
          {/* Filet visible : le retour sur la bonne page est automatique, mais
              si la navigation n'a pas abouti l'élève a le geste sous la main
              au lieu d'une bulle qui désigne le vide. */}
          {cur.route && pathname !== cur.route && (
            <button className="ont-btn-ghost ont-btn-emmener" onClick={() => window.location.assign(cur.route!)}>
              M&apos;y emmener
            </button>
          )}
          <ProgressBars count={total} active={stepIdx} />
          <div className="ont-tip-actions">
            <button className="ont-btn-ghost" onClick={pauseTour}>
              Plus tard
            </button>
            <button className="ont-btn-quit" onClick={handleSkip}>
              Ne plus me le montrer
            </button>
            <div className="ont-tip-actions-right">
              {stepIdx > 0 && (
                <button className="ont-btn-ghost" onClick={prev}>← Préc.</button>
              )}
              <button className="ont-btn-primary" onClick={next}>
                {stepIdx === STEPS.length - 1 ? 'Terminer' : 'Suivant'}
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
  const spotClassName = `ont-spot${dimmed ? ' ont-spot-dim' : ''}`

  // Pour spotShape='circle' : on force un carré (côté = max(w,h) + 2*pad)
  // centré sur le centre du rect, avec border-radius: 50%.
  let spotStyle: React.CSSProperties
  if (cur.spotShape === 'circle') {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const size = Math.max(rect.width, rect.height) + pad * 2
    spotStyle = {
      top: cy - size / 2,
      left: cx - size / 2,
      width: size,
      height: size,
      borderRadius: '50%',
    }
  } else {
    spotStyle = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    }
  }

  return (
    <div className="ont-root" role="dialog" aria-modal="true" aria-label="Tutoriel">
      <div className={spotClassName} style={spotStyle} />

      <div className="ont-tip" ref={tipRef} style={tipStyle}>
        <div className="ont-tip-step">
          Étape {stepIdx + 1} sur {total}
        </div>
        <h4 className="ont-tip-title">{stepTitle}</h4>
        <div className="ont-tip-body">{stepBody}</div>

        {/* Une proposition, plus une attente. Le tour avance tout seul si tu
            cliques l'élément, et « Suivant » marche quand même. */}
        {(isWaitClick || shouldForceCreate) && (
          <div className="ont-tip-hint">
            <span className="ont-tip-pulse" />{' '}
            {shouldForceCreate
              ? 'Crée-la si tu veux, ou passe avec Suivant.'
              : 'Clique dessus, ou passe avec Suivant.'}
          </div>
        )}

        <ProgressBars count={total} active={stepIdx} />

        {/* LE PIED DE BULLE EST LE MÊME À TOUTES LES ÉTAPES.
            Avant, une étape « wait-click » n'affichait NI « Plus tard », NI
            « Ne plus me le montrer », NI « Suivant » : le seul chemin était de
            cliquer précisément l'élément désigné. C'était ça, le tutoriel
            rigide — pas le bouton de sortie, qui existait déjà ailleurs.
            Cliquer l'élément reste la bonne façon de faire, et le petit point
            qui clignote au-dessus le propose toujours. Mais ce n'est plus la
            seule : « Suivant » marche partout. */}
        <div className="ont-tip-actions">
          <span className="ont-tip-exit">
            <button className="ont-btn-ghost" onClick={pauseTour}>
              Plus tard
            </button>
            <button className="ont-btn-quit" onClick={handleSkip}>
              Ne plus me le montrer
            </button>
          </span>
          <div className="ont-tip-actions-right">
            {!isFirst && (
              <button className="ont-btn-ghost" onClick={prev}>
                ← Préc.
              </button>
            )}
            <button className="ont-btn-primary" onClick={next}>
              {isLast ? 'Terminer' : 'Suivant'}
            </button>
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
