'use client'
// src/app/auth/page.tsx
//
// Page d'inscription + connexion dédiée. Wizard pour le signup
// (form / fac / option Sorbonne / matières) + login + forgot password.
//
// L'étape « matières » existe parce qu'on ne connaît PAS la maquette de la
// plupart des facs : on propose, l'étudiant valide. Voir le commentaire au
// dessus de FAC_SYSTEMS.
//
// Logique d'auth identique à la version précédente intégrée dans LandingPage,
// extraite ici dans une page séparée pour matcher le pattern Resend.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MarketingNav from '@/components/MarketingNav'
import SubjectIcon from '@/components/SubjectIcon'
import MarketingFooter from '@/components/MarketingFooter'
import '@/components/landing-styles.css'
import '@/components/landing-night.css'
import { DEFAULT_YEAR } from '@/lib/year'

// Normalise une chaîne pour la recherche : minuscules + suppression des
// accents, pour que « universite » matche « Université », « cote » → « Côte ».
const normalizeText = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const FACS = [
  // Facs avec configuration détaillée des matières (mineures PASS)
  { id: 'sorbonne', name: 'Sorbonne Université', badge: 'Paris 6', hasOptions: true },
  { id: 'paris-cite', name: 'Université Paris Cité', badge: 'Paris 5', hasOptions: true },
  { id: 'sorbonne-paris-nord', name: 'Sorbonne Paris Nord', badge: 'Paris 13', hasOptions: false },
  { id: 'lyon', name: 'Université de Lyon', badge: 'Lyon', hasOptions: false },
  { id: 'montpellier', name: 'Université de Montpellier', badge: 'Montpellier', hasOptions: false },
  // Île-de-France (matières par défaut)
  { id: 'upec', name: 'UPEC · Paris-Est Créteil', badge: 'Créteil', hasOptions: false },
  { id: 'paris-saclay', name: 'Université Paris-Saclay', badge: 'Saclay', hasOptions: false },
  { id: 'uvsq', name: 'UVSQ · Simone Veil (Paris-Saclay)', badge: 'Versailles', hasOptions: false },
  // Autres facs (matières par défaut, personnalisables ensuite dans l'app)
  { id: 'aix-marseille', name: "Aix-Marseille Université", badge: 'Marseille', hasOptions: false },
  { id: 'amiens', name: "Université de Picardie Jules Verne", badge: 'Amiens', hasOptions: false },
  { id: 'angers', name: "Université d'Angers", badge: 'Angers', hasOptions: false },
  { id: 'besancon', name: "Université de Franche-Comté", badge: 'Besançon', hasOptions: false },
  { id: 'bordeaux', name: "Université de Bordeaux", badge: 'Bordeaux', hasOptions: false },
  { id: 'brest', name: "Université de Bretagne Occidentale", badge: 'Brest', hasOptions: false },
  { id: 'caen', name: "Université de Caen Normandie", badge: 'Caen', hasOptions: false },
  { id: 'clermont', name: "Université Clermont Auvergne", badge: 'Clermont-Fd', hasOptions: false },
  { id: 'dijon', name: "Université de Bourgogne", badge: 'Dijon', hasOptions: false },
  { id: 'grenoble', name: "Université Grenoble Alpes", badge: 'Grenoble', hasOptions: false },
  { id: 'lille', name: "Université de Lille", badge: 'Lille', hasOptions: false },
  { id: 'limoges', name: "Université de Limoges", badge: 'Limoges', hasOptions: false },
  { id: 'nancy', name: "Université de Lorraine", badge: 'Nancy', hasOptions: false },
  { id: 'nantes', name: "Nantes Université", badge: 'Nantes', hasOptions: false },
  { id: 'nice', name: "Université Côte d'Azur", badge: 'Nice', hasOptions: false },
  { id: 'poitiers', name: "Université de Poitiers", badge: 'Poitiers', hasOptions: false },
  { id: 'reims', name: "Université de Reims (URCA)", badge: 'Reims', hasOptions: false },
  { id: 'rennes', name: "Université de Rennes", badge: 'Rennes', hasOptions: false },
  { id: 'rouen', name: "Université de Rouen Normandie", badge: 'Rouen', hasOptions: false },
  { id: 'saint-etienne', name: "Université Jean Monnet", badge: 'St-Étienne', hasOptions: false },
  { id: 'strasbourg', name: "Université de Strasbourg", badge: 'Strasbourg', hasOptions: false },
  { id: 'toulouse', name: "Université Toulouse III - Paul Sabatier", badge: 'Toulouse', hasOptions: false },
  { id: 'tours', name: "Université de Tours", badge: 'Tours', hasOptions: false },
  { id: 'antilles', name: "Université des Antilles", badge: 'Antilles', hasOptions: false },
  { id: 'la-reunion', name: "Université de La Réunion", badge: 'La Réunion', hasOptions: false },
  { id: 'autre', name: "Autre / Je ne sais pas encore", badge: 'Autre', hasOptions: false },
]

// Facs proposées dans la recherche (toutes sauf « Autre », qui reste un
// raccourci permanent affiché sous les résultats).
const FACS_SEARCHABLE = FACS.filter(f => f.id !== 'autre')

// =============================================================
// MATIÈRES PRÉ-REMPLIES À L'INSCRIPTION
// =============================================================
// RÈGLE : on ne pré-remplit que ce qu'on peut sourcer. Une maquette inventée
// se repère en dix secondes par un étudiant ou un tutorat, et coûte bien plus
// cher en crédibilité qu'une liste courte mais juste.
//
// Trois niveaux, annoncés fac par fac dans les commentaires ci-dessous :
//   VÉRIFIÉ    relevé sur les comptes réels d'étudiants de cette fac
//   SOURCÉ     publié par le tutorat ou la fac (lien dans le commentaire)
//   PAR DÉFAUT tronc commun PASS, présenté comme tel dans l'interface
//
// IMPORTANT : ce tableau n'est lu qu'à l'inscription (handleRegister, plus
// bas). Modifier ces listes ne touche AUCUN compte existant. Les matières
// déjà créées vivent dans la table `systems` et ne sont jamais réécrites.

// Pas de champ icône : partout dans l'app, l'icône d'une matière est DÉDUITE
// de son nom par SubjectIcon (trait, 24x24). La colonne `icon` en base n'est
// plus lue par personne — la création de matière depuis Fiches y écrit déjà
// une chaîne vide. On fait pareil ici.
type Matiere = { name: string; semestre: 1 | 2 }

// Une mineure devient UNE matière portant le nom de la mineure. On ne
// prétend pas connaître le détail des UE de chaque mineure de chaque fac :
// l'étudiant renomme ou découpe ensuite en deux clics. Un dossier juste vaut
// mieux que deux dossiers inventés.
const mineure = (label: string): Matiere => ({ name: `Mineure ${label}`, semestre: 1 })

// -------------------------------------------------------------
// SORBONNE · VÉRIFIÉ SUR COMPTES RÉELS (relevé d'octobre 2026)
// -------------------------------------------------------------
// Les trois PASS Sorbonne inscrits en septembre ont chacun rempli des fiches
// dans ces matières. Preuve indépendante et non circulaire : les orthographes
// divergent d'un compte à l'autre (« PRE-RENTREE », « Pré rentrée »,
// « Biologie du developpement » sans accent), donc elles ont été tapées à la
// main et ne sont pas notre propre pré-remplissage qui nous revient en écho.
// « Pré-rentrée » est chez eux l'une des plus grosses matières : on la garde.
// « Histologie » et non « Histologie-Embryologie » : deux des trois l'ont
// renommée ainsi.
//
// Rien pour le second semestre : sur les six comptes Sorbonne de la base,
// ZÉRO fiche en S2. L'ancienne liste S2 était une déduction, elle est
// retirée. L'étudiant ajoutera ses matières de janvier en janvier.
const SORBONNE_S1: Matiere[] = [
  { name: 'Pré-rentrée', semestre: 1 },
  { name: 'Anatomie générale', semestre: 1 },
  { name: 'Biochimie', semestre: 1 },
  { name: 'Biologie cellulaire', semestre: 1 },
  { name: 'Biologie du développement', semestre: 1 },
  { name: 'Biologie de la reproduction', semestre: 1 },
  { name: 'Chimie générale et organique', semestre: 1 },
  { name: 'Histologie', semestre: 1 },
]

// UE disciplinaires Sorbonne, nommées comme les étudiants les nomment
// eux-mêmes dans l'app : UEDS côté sciences, UEDL côté lettres.
const SORBONNE_UEDS: Matiere[] = [
  { name: 'UEDS Chimie', semestre: 1 },
  { name: 'UEDS Physique', semestre: 1 },
]
const SORBONNE_UEDL: Matiere[] = [
  { name: 'UEDL ILCS', semestre: 1 },
  { name: 'UEDL ISP', semestre: 1 },
]

// -------------------------------------------------------------
// TOUTES LES AUTRES FACS · SOCLE NATIONAL
// -------------------------------------------------------------
// Les UE du programme PASS qu'on retrouve d'une fac à l'autre. Ce n'est PAS
// la maquette d'une fac précise : chaque fac découpe et nomme autrement — la
// Sorbonne éclate chimie/biochimie en deux et sépare histologie de la
// biologie cellulaire, d'autres rangent SHS en second semestre. L'écran
// d'inscription le dit explicitement et laisse tout décocher.
//
// L'ancienne liste « noyau commun » était ma déduction, sans source. Celle-ci
// vient de la maquette nationale telle que la rapportent les prépas ; ce
// n'est pas un arrêté lu de première main, d'où le ton de l'écran : une
// proposition, jamais « le programme de ta fac ».
//
// Tout en S1 : le découpage par semestre varie trop d'une fac à l'autre pour
// qu'on le devine. Une matière se déplace en S2 depuis Fiches, en deux clics.
const SOCLE_NATIONAL: Matiere[] = [
  { name: 'Chimie et biochimie', semestre: 1 },
  { name: 'Biologie cellulaire et histologie', semestre: 1 },
  { name: 'Anatomie', semestre: 1 },
  { name: 'Biophysique', semestre: 1 },
  { name: 'Biostatistiques', semestre: 1 },
  { name: 'Pharmacologie', semestre: 1 },
  { name: 'Sciences humaines et sociales', semestre: 1 },
]

// =============================================================
// MATIÈRES PROPOSÉES par (fac, option)
// =============================================================
// « Proposées » et plus « pré-remplies » : rien n'est créé sans que
// l'étudiant ait vu la liste et validé. Pour ajouter une fac ici, il faut une
// source — un relevé de comptes réels de cette fac. Pas une maquette publiée,
// pas une déduction : Paris Cité avait une maquette publiée et son seul
// compte n'a jamais saisi une fiche, donc rien ne la confirmait.
const FAC_SYSTEMS: Record<string, Record<string, Matiere[]>> = {
  sorbonne: {
    ueds: [...SORBONNE_S1, ...SORBONNE_UEDS],
    uedl: [...SORBONNE_S1, ...SORBONNE_UEDL],
  },
  'paris-cite': {
    // La maquette Paris Cité est retirée : elle n'a jamais été confrontée à un
    // compte réel. Reste le choix de la mineure, qui ne prétend rien d'autre
    // que son propre nom.
    bpc: [...SOCLE_NATIONAL, mineure('Biologie, physique, chimie')],
    biotech: [...SOCLE_NATIONAL, mineure('Biotechnologie pour la santé')],
    droit: [...SOCLE_NATIONAL, mineure('Droit')],
    'eco-gestion': [...SOCLE_NATIONAL, mineure('Économie et gestion')],
    'maths-physique': [...SOCLE_NATIONAL, mineure('Mathématiques-Physique')],
    'soin-social': [...SOCLE_NATIONAL, mineure('Métiers du soin et du social')],
    'recherche-sante': [...SOCLE_NATIONAL, mineure('Recherche en santé')],
    reeducation: [...SOCLE_NATIONAL, mineure('Rééducation et réadaptation')],
    'sante-populations': [...SOCLE_NATIONAL, mineure('Santé des populations')],
    psychologie: [...SOCLE_NATIONAL, mineure('Sciences psychologiques')],
    'sport-sante': [...SOCLE_NATIONAL, mineure('Sport et santé')],
  },
  autre: {
    default: SOCLE_NATIONAL,
  },
}

// Une liste est-elle relevée sur de vrais comptes de cette fac, ou est-ce le
// socle national proposé faute de mieux ? L'écran ne dit pas la même chose
// dans les deux cas.
const FACS_VERIFIEES = new Set(['sorbonne'])

// =============================================================
// MÉTADONNÉES UI pour l'étape « choix de l'option »
// =============================================================
// Une carte par option, avec les tags = aperçu des matières RÉELLEMENT
// ajoutées par ce choix (pas un décor). La carte cliquée devient le `option`
// dans handleRegister, qui mappe vers FAC_SYSTEMS.
type FacOption = { id: string; name: string; desc: string; tags: string[] }
const FAC_OPTIONS: Record<string, FacOption[]> = {
  sorbonne: [
    { id: 'ueds', name: 'UEDS · Sciences', desc: 'UE disciplinaire sciences',
      tags: ['UEDS Chimie', 'UEDS Physique'] },
    { id: 'uedl', name: 'UEDL · Lettres', desc: 'UE disciplinaire lettres',
      tags: ['UEDL ILCS', 'UEDL ISP'] },
  ],
  'paris-cite': [
    { id: 'bpc', name: 'Biologie, physique, chimie', desc: 'La mineure BPC', tags: ['Mineure BPC'] },
    { id: 'biotech', name: 'Biotechnologie pour la santé', desc: 'Mineure biotechnologie', tags: ['Mineure biotech'] },
    { id: 'droit', name: 'Droit', desc: 'Mineure droit', tags: ['Mineure droit'] },
    { id: 'eco-gestion', name: 'Économie et gestion', desc: 'Mineure économie-gestion', tags: ['Mineure éco-gestion'] },
    { id: 'maths-physique', name: 'Mathématiques-Physique', desc: 'Mineure maths-physique', tags: ['Mineure maths-physique'] },
    { id: 'soin-social', name: 'Métiers du soin et du social', desc: 'Mineure soin et social', tags: ['Mineure soin et social'] },
    { id: 'recherche-sante', name: 'Recherche en santé', desc: 'Mineure recherche', tags: ['Mineure recherche'] },
    { id: 'reeducation', name: 'Rééducation et réadaptation', desc: 'Mineure rééducation', tags: ['Mineure rééducation'] },
    { id: 'sante-populations', name: 'Santé des populations', desc: 'Mineure santé des populations', tags: ['Mineure santé pop.'] },
    { id: 'psychologie', name: 'Sciences psychologiques', desc: 'Mineure psychologie', tags: ['Mineure psychologie'] },
    { id: 'sport-sante', name: 'Sport et santé', desc: 'Mineure sport et santé', tags: ['Mineure sport et santé'] },
  ],
}

type Step = 'form' | 'fac' | 'option' | 'matieres'

// Wrapper pour Suspense (Next.js 14 le demande quand on utilise useSearchParams)
export default function AuthPage() {
  return (
    <Suspense fallback={<div className="lp-page"><MarketingNav /><div style={{ padding: 80, textAlign: 'center', color: '#5C5C5A' }}>Chargement…</div></div>}>
      <AuthContent />
    </Suspense>
  )
}

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Si ?mode=login dans l'URL, ouvrir directement sur l'onglet login.
  // useState initializer pour le premier render, useEffect pour catcher le
  // cas où searchParams arrive en délai (hydration Next.js).
  const initialMode = searchParams?.get('mode') === 'login' ? 'login' : 'register'

  const [activeTab, setActiveTab] = useState<'register' | 'login'>(initialMode)
  const [step, setStep] = useState<Step>('form')

  // Sync l'onglet actif avec ?mode= à chaque changement de URL.
  // - ?mode=login → onglet login
  // - ?mode=register OU pas de mode → onglet inscription (défaut)
  // Important : on reset toujours, pas seulement sur les valeurs valides,
  // sinon naviguer de /auth?mode=login vers /auth ne change pas le tab.
  useEffect(() => {
    const mode = searchParams?.get('mode')
    setActiveTab(mode === 'login' ? 'login' : 'register')
    // Reset aussi le step en cas de changement de mode
    setStep('form')
    setError(null)
    setForgotMode(false)
    setFacQuery('')
    setOptQuery('')
  }, [searchParams])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fac, setFac] = useState('')
  const [facQuery, setFacQuery] = useState('')
  const [option, setOption] = useState('')
  const [optQuery, setOptQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotMsg, setForgotMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Étape « tes matières ». `proposees` est la liste affichée (socle + ajouts
  // de l'étudiant), `retirees` les noms qu'il a décochés. On stocke les
  // décochées plutôt que les cochées pour qu'une matière ajoutée à la main
  // arrive cochée sans manipulation supplémentaire.
  const [proposees, setProposees] = useState<Matiere[]>([])
  const [retirees, setRetirees] = useState<Set<string>>(new Set())
  const [nouvelleMat, setNouvelleMat] = useState('')
  const listeMatRef = useRef<HTMLDivElement | null>(null)

  // Si l'user est déjà connecté, redirige vers le dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard')
    })
  }, [supabase, router])

  const selectedFac = FACS.find(f => f.id === fac)
  const totalSteps = selectedFac?.hasOptions ? 4 : 3
  const facVerifiee = FACS_VERIFIEES.has(fac)
  const matieresGardees = proposees.filter(m => !retirees.has(m.name))

  // Recherche de fac : on affiche les 3 premières facs correspondantes (toute
  // la France). Query vide -> 3 suggestions par défaut. On garde toujours la
  // fac sélectionnée dans la liste, même si elle sort du top 3.
  const facResults = useMemo(() => {
    const q = normalizeText(facQuery.trim())
    const pool = q
      ? FACS_SEARCHABLE.filter(f => normalizeText(`${f.name} ${f.badge}`).includes(q))
      : FACS_SEARCHABLE
    let top = pool.slice(0, 3)
    if (fac && fac !== 'autre' && !top.some(f => f.id === fac)) {
      const sel = FACS_SEARCHABLE.find(f => f.id === fac)
      if (sel) top = [sel, ...top].slice(0, 3)
    }
    return top
  }, [facQuery, fac])

  // Recherche de mineure : même principe, mais la liste est courte (2 à 6),
  // donc on n'applique pas de cap : on affiche toutes les mineures qui matchent.
  const optResults = useMemo(() => {
    const list = FAC_OPTIONS[fac] || []
    const q = normalizeText(optQuery.trim())
    if (!q) return list
    return list.filter(o =>
      normalizeText(`${o.name} ${o.desc} ${o.tags.join(' ')}`).includes(q)
    )
  }, [optQuery, fac])

  function handleContinueForm() {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Merci de remplir tous les champs.')
      return
    }
    // Validation basique côté client pour éviter à l'user de découvrir
    // l'erreur Supabase à la fin du wizard (3 étapes plus loin).
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    if (!emailLooksValid) {
      setError("Cette adresse email ne semble pas valide.")
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }
    setError(null)
    setStep('fac')
  }

  function handleContinueFac() {
    if (!fac) return
    if (selectedFac?.hasOptions) { setOptQuery(''); setStep('option') }
    else ouvrirMatieres(fac, 'default')
  }

  // Prépare et ouvre l'étape « tes matières ». Tout arrive coché : la liste
  // est une proposition à élaguer, pas un formulaire à remplir.
  function ouvrirMatieres(facId: string, opt: string) {
    const liste = FAC_SYSTEMS[facId]?.[opt] || FAC_SYSTEMS[facId]?.['default'] || FAC_SYSTEMS['autre']['default']
    setProposees(liste)
    setRetirees(new Set())
    setNouvelleMat('')
    setStep('matieres')
  }

  function basculerMatiere(nom: string) {
    setRetirees(prev => {
      const next = new Set(prev)
      if (next.has(nom)) next.delete(nom); else next.add(nom)
      return next
    })
  }

  function ajouterMatiere() {
    const nom = nouvelleMat.trim()
    if (!nom) return
    // Doublon : on ne crée pas une deuxième ligne, on se contente de
    // recocher celle qui existe déjà.
    const existante = proposees.find(m => m.name.toLowerCase() === nom.toLowerCase())
    if (existante) {
      setRetirees(prev => { const n = new Set(prev); n.delete(existante.name); return n })
    } else {
      setProposees(prev => [...prev, { name: nom, semestre: 1 }])
    }
    setNouvelleMat('')
    // La liste défile : une matière ajoutée hors du champ de vision donne
    // l'impression que le bouton n'a rien fait.
    requestAnimationFrame(() => {
      const l = listeMatRef.current
      if (l) l.scrollTop = l.scrollHeight
    })
  }

  async function handleRegister(facId: string, opt: string, matieres: Matiere[]) {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username, fac: facId, option: opt } },
      })
      if (error) throw error
      if (!data.user) throw new Error('Erreur création compte')
      await supabase.from('profiles').update({ username, fac: facId }).eq('id', data.user.id)

      if (matieres.length) {
        const { error: sysErr } = await supabase.from('systems').insert(
          matieres.map(m => ({
            user_id: data.user!.id, name: m.name, icon: '',
            semestre: m.semestre, cal_hidden: false,
            // L'inscription pré-remplit la maquette PASS, donc première année.
            // Un étudiant déjà en 2e année bascule ensuite dans les Réglages.
            year: DEFAULT_YEAR,
          }))
        )
        // L'étudiant a choisi ces matières à l'écran précédent : s'il arrive
        // sur un dashboard vide, c'est que l'insertion a échoué, pas qu'il
        // n'avait rien demandé. On le trace au lieu d'échouer en silence.
        if (sysErr) console.error('[signup] Création des matières échouée:', sysErr)
      }

      // Welcome email : on attend avec un timeout court pour ne pas bloquer
      // le signup si Resend est lent ou down. La race condition précédente
      // (fetch fire-and-forget puis window.location.href immédiat) pouvait
      // interrompre la requête avant qu'elle parte.
      await Promise.race([
        fetch('/api/welcome-email', { method: 'POST' }).catch(() => null),
        new Promise(r => setTimeout(r, 2500)),
      ])
      window.location.href = '/dashboard'
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  async function handleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  async function handleForgotPassword() {
    setForgotMsg(null)
    if (!email.trim()) {
      setForgotMsg({ kind: 'err', text: 'Entre ton adresse email.' })
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/reset-password',
      })
      if (error) throw error
      setForgotMsg({ kind: 'ok', text: 'Email envoyé. Vérifie ta boîte de réception (et tes spams).' })
    } catch (e: unknown) {
      setForgotMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Erreur inconnue' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lp-page ln-doc">
      <MarketingNav />

      <section className="ln-subhero ln-subhero-auth">
        <span className="ln-kicker">Inscription · 2 minutes</span>
        <h1 className="ln-subhero-h1">Commence à retenir<span className="ln-line2"><em>pour de bon.</em></span></h1>
        <p className="ln-subhero-sub">
          Tu choisis tes matières à l'inscription, en une étape.
          Pas de carte bleue, pas d&apos;engagement.
        </p>
      </section>

      <div className="auth-page">

        <div className="auth-grid">
          <div>
            <div className="auth-trust">
              <div className="auth-trust-row"><span className="auth-trust-check">✓</span>Gratuit pour démarrer · fiches illimitées</div>
              <div className="auth-trust-row"><span className="auth-trust-check">✓</span>Données hébergées en France 🇫🇷</div>
              <div className="auth-trust-row"><span className="auth-trust-check">✓</span>Sans publicité ni tracking</div>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab${activeTab === 'register' ? ' active' : ''}`}
                onClick={() => { setActiveTab('register'); setError(null); setStep('form'); setForgotMode(false) }}
              >
                Créer un compte
              </button>
              <button
                type="button"
                className={`auth-tab${activeTab === 'login' ? ' active' : ''}`}
                onClick={() => { setActiveTab('login'); setError(null); setStep('form'); setForgotMode(false) }}
              >
                Se connecter
              </button>
            </div>

            {error && <div className="auth-error">{error}</div>}

            {activeTab === 'register' && step === 'form' && (
              <div className="auth-pane">
                <div className="auth-progress">
                  <span className="auth-dot on" />
                  <span className="auth-dot" />
                  {totalSteps === 3 && <span className="auth-dot" />}
                </div>
                <div className="auth-form-group">
                  <label className="auth-label">Nom d&apos;utilisateur</label>
                  <input type="text" className="auth-input" placeholder="Ex: sophie_m" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div className="auth-form-group">
                  <label className="auth-label">Adresse email</label>
                  <input type="email" className="auth-input" placeholder="prenom@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="auth-form-group">
                  <label className="auth-label">Mot de passe</label>
                  <input type="password" className="auth-input" placeholder="Min. 8 caractères" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <button className="auth-submit" onClick={handleContinueForm}>Continuer →</button>
                <p className="auth-terms">
                  En créant un compte, tu acceptes nos <Link href="/cgu">CGU</Link> et notre <Link href="/confidentialite">politique de confidentialité</Link>.
                </p>
              </div>
            )}

            {activeTab === 'register' && step === 'fac' && (
              <div className="auth-pane">
                <div className="auth-progress">
                  <span className="auth-dot done" />
                  <span className="auth-dot on" />
                  <span className="auth-dot" />
                  {totalSteps === 4 && <span className="auth-dot" />}
                </div>
                <button type="button" className="auth-back-btn" onClick={() => setStep('form')}>← Retour</button>
                <div className="auth-step-title">Quelle est ta fac ?</div>
                <div className="auth-step-sub">Elle sert à te proposer une liste de matières · tu la valides à l&apos;étape suivante.</div>
                <input
                  type="text"
                  className="auth-input auth-search"
                  placeholder="Cherche ta fac (Sorbonne, Lyon, Bordeaux…)"
                  value={facQuery}
                  onChange={e => setFacQuery(e.target.value)}
                  autoFocus
                />
                <div className="auth-fac-list">
                  {facResults.map(f => (
                    <button key={f.id} type="button" className={`auth-fac-item${fac === f.id ? ' sel' : ''}`} onClick={() => setFac(f.id)}>
                      <span>{f.name}</span>
                      <span className="auth-fac-badge">{f.badge}</span>
                    </button>
                  ))}
                  {facResults.length === 0 && (
                    <div className="auth-search-empty">Aucune fac trouvée pour « {facQuery.trim()} ».</div>
                  )}
                </div>
                <button
                  type="button"
                  className={`auth-fac-other${fac === 'autre' ? ' sel' : ''}`}
                  onClick={() => setFac('autre')}
                >
                  Je ne sais pas encore / autre fac
                </button>
                <button className="auth-submit" onClick={handleContinueFac} disabled={!fac || loading}>
                  {loading ? 'Création en cours…' : 'Continuer →'}
                </button>
              </div>
            )}

            {activeTab === 'register' && step === 'option' && (
              <div className="auth-pane">
                <div className="auth-progress">
                  <span className="auth-dot done" />
                  <span className="auth-dot done" />
                  <span className="auth-dot on" />
                  <span className="auth-dot" />
                </div>
                <button type="button" className="auth-back-btn" onClick={() => setStep('fac')}>← Retour</button>
                <div className="auth-step-title">Quelle est ton option disciplinaire ?</div>
                <div className="auth-step-sub">Elle ajoute une matière à ta liste.</div>
                {(FAC_OPTIONS[fac] || []).length > 4 && (
                  <input
                    type="text"
                    className="auth-input auth-search"
                    placeholder="Cherche ton option (droit, éco, sciences…)"
                    value={optQuery}
                    onChange={e => setOptQuery(e.target.value)}
                  />
                )}
                <div className="auth-opt-list">
                  {/* Liste dynamique des mineures de la fac choisie, filtrée par
                      la recherche. La liste est courte (2 à 6) donc on n'applique
                      pas de cap : on montre toutes les mineures qui matchent. */}
                  {optResults.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`auth-opt-card${option === opt.id ? ' sel' : ''}`}
                      onClick={() => setOption(opt.id)}
                    >
                      <div className="auth-opt-card-title">{opt.name}</div>
                      <div className="auth-opt-card-desc">{opt.desc}</div>
                      <div className="auth-opt-tags">
                        {opt.tags.map(t => (
                          <span key={t} className="auth-opt-tag">{t}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                  {optResults.length === 0 && (
                    <div className="auth-search-empty">Aucune option trouvée pour « {optQuery.trim()} ».</div>
                  )}
                </div>
                <button className="auth-submit" onClick={() => ouvrirMatieres(fac, option)} disabled={!option}>
                  Continuer →
                </button>
              </div>
            )}

            {activeTab === 'register' && step === 'matieres' && (
              <div className="auth-pane">
                <div className="auth-progress">
                  <span className="auth-dot done" />
                  <span className="auth-dot done" />
                  {totalSteps === 4 && <span className="auth-dot done" />}
                  <span className="auth-dot on" />
                </div>
                <button
                  type="button"
                  className="auth-back-btn"
                  onClick={() => setStep(selectedFac?.hasOptions ? 'option' : 'fac')}
                >← Retour</button>
                <div className="auth-step-title">Tes matières</div>
                {/* Le texte change selon ce qu'on sait VRAIMENT de cette fac.
                    Promettre « la maquette de ta fac » à un étudiant de Nantes
                    serait faux : on n'a relevé que la Sorbonne. */}
                <div className="auth-step-sub">
                  {facVerifiee
                    ? <>Relevé sur de vrais comptes de ta fac. Décoche ce que tu n&apos;as pas, ajoute ce qui manque.</>
                    : <>Ce sont les UE du <em>programme national</em>. Ta fac les découpe et les nomme peut-être autrement : décoche, et ajoute les tiennes.</>}
                </div>

                <div className="auth-mat-list" ref={listeMatRef}>
                  {proposees.map(m => {
                    const gardee = !retirees.has(m.name)
                    return (
                      <button
                        key={m.name}
                        type="button"
                        className={`auth-mat-item${gardee ? ' on' : ''}`}
                        onClick={() => basculerMatiere(m.name)}
                        role="checkbox"
                        aria-checked={gardee}
                      >
                        <span className="auth-mat-box">{gardee ? '✓' : ''}</span>
                        <span className="auth-mat-ico"><SubjectIcon name={m.name} /></span>
                        <span className="auth-mat-nom">{m.name}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="auth-mat-add">
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Ajouter une matière…"
                    value={nouvelleMat}
                    onChange={e => setNouvelleMat(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterMatiere() } }}
                    maxLength={60}
                  />
                  <button type="button" className="auth-mat-add-btn" onClick={ajouterMatiere} disabled={!nouvelleMat.trim()}>
                    Ajouter
                  </button>
                </div>

                <div className="auth-mat-note">
                  Tout est en premier semestre pour l&apos;instant · tu déplaces une matière en S2 quand tu veux, depuis Fiches.
                </div>

                <button
                  className="auth-submit"
                  onClick={() => handleRegister(fac, selectedFac?.hasOptions ? option : 'default', matieresGardees)}
                  disabled={matieresGardees.length === 0 || loading}
                >
                  {loading
                    ? 'Création en cours…'
                    : `Créer mon compte gratuit · ${matieresGardees.length} matière${matieresGardees.length > 1 ? 's' : ''} →`}
                </button>
              </div>
            )}

            {activeTab === 'login' && !forgotMode && (
              <div className="auth-pane">
                <div className="auth-form-group">
                  <label className="auth-label">Adresse email</label>
                  <input type="email" className="auth-input" placeholder="prenom@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="auth-form-group">
                  <label className="auth-label">Mot de passe</label>
                  <input type="password" className="auth-input" placeholder="Ton mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <button className="auth-submit" onClick={handleLogin} disabled={loading}>
                  {loading ? 'Connexion…' : 'Se connecter →'}
                </button>
                <button type="button" className="auth-forgot" onClick={() => { setForgotMode(true); setError(null); setForgotMsg(null) }}>
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            {activeTab === 'login' && forgotMode && (
              <div className="auth-pane">
                <button type="button" className="auth-back-btn" onClick={() => { setForgotMode(false); setForgotMsg(null) }}>← Retour</button>
                <div className="auth-step-title">Mot de passe oublié</div>
                <div className="auth-step-sub">On t&apos;envoie un lien pour le réinitialiser par email.</div>
                <div className="auth-form-group">
                  <label className="auth-label">Adresse email</label>
                  <input type="email" className="auth-input" placeholder="prenom@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {forgotMsg && (
                  forgotMsg.kind === 'ok'
                    ? <div className="auth-success">{forgotMsg.text}</div>
                    : <div className="auth-error">{forgotMsg.text}</div>
                )}
                <button className="auth-submit" onClick={handleForgotPassword} disabled={loading}>
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
