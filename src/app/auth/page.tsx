'use client'
// src/app/auth/page.tsx
//
// Page d'inscription + connexion dédiée. Wizard 3 étapes pour le signup
// (form / fac / option Sorbonne) + login + forgot password.
//
// Logique d'auth identique à la version précédente intégrée dans LandingPage,
// extraite ici dans une page séparée pour matcher le pattern Resend.

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MarketingNav from '@/components/MarketingNav'
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

type Matiere = { name: string; icon: string; semestre: 1 | 2 }

// Une mineure devient UNE matière portant le nom de la mineure. On ne
// prétend pas connaître le détail des UE de chaque mineure de chaque fac :
// l'étudiant renomme ou découpe ensuite en deux clics. Un dossier juste vaut
// mieux que deux dossiers inventés.
const mineure = (label: string): Matiere => ({ name: `Mineure ${label}`, icon: '🎓', semestre: 1 })

// -------------------------------------------------------------
// SORBONNE · VÉRIFIÉ (septembre 2026)
// -------------------------------------------------------------
// Relevé sur les comptes de trois PASS Sorbonne inscrits début septembre
// 2026, qui ont saisi une centaine de fiches chacun. Les trois listes
// concordent, à l'abréviation près (BDD = biologie du développement,
// BDR = biologie de la reproduction).
// « Pré-rentrée » est chez eux l'une des plus grosses matières : on la garde.
const SORBONNE_S1: Matiere[] = [
  { name: 'Pré-rentrée', icon: '🎒', semestre: 1 },
  { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
  { name: 'Biochimie', icon: '🧪', semestre: 1 },
  { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
  { name: 'Biologie du développement', icon: '🧬', semestre: 1 },
  { name: 'Biologie de la reproduction', icon: '🍼', semestre: 1 },
  { name: 'Chimie générale et organique', icon: '⚗️', semestre: 1 },
  { name: 'Histologie-Embryologie', icon: '🧫', semestre: 1 },
]

// S2 NON VÉRIFIÉ. Au moment du relevé, aucun des trois comptes n'avait
// commencé le second semestre (il démarre en janvier) : leurs matières S2
// étaient encore celles pré-remplies par l'ancienne version, donc elles ne
// prouvent rien. On met ici le tronc commun le plus consensuel et l'interface
// dit que c'est ajustable. À faire confirmer par le TSSU avant de présenter
// ça comme « la maquette Sorbonne ».
const SORBONNE_S2: Matiere[] = [
  { name: 'Anatomie', icon: '🫀', semestre: 2 },
  { name: 'Biophysique', icon: '📊', semestre: 2 },
  { name: 'Physiologie', icon: '❤️', semestre: 2 },
  { name: 'Biostatistiques', icon: '📈', semestre: 2 },
  { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
]

// UE disciplinaires Sorbonne, nommées comme les étudiants les nomment
// eux-mêmes dans l'app : UEDS côté sciences, UEDL côté lettres.
const SORBONNE_UEDS: Matiere[] = [
  { name: 'UEDS Chimie', icon: '⚗️', semestre: 1 },
  { name: 'UEDS Physique', icon: '⚡', semestre: 1 },
]
const SORBONNE_UEDL: Matiere[] = [
  { name: 'UEDL ILCS', icon: '📚', semestre: 1 },
  { name: 'UEDL ISP', icon: '🗣️', semestre: 1 },
]

// -------------------------------------------------------------
// PARIS CITÉ · SOURCÉ (A2SUP, le tutorat de la fac)
// -------------------------------------------------------------
// Source : https://www.a2sup.fr/staticpages/3 (majeure santé 48 ECTS en
// 12 UE, plus la liste officielle des onze mineures à 12 ECTS).
// Particularité PC : SHS et Santé publique sont en première partie (S1) ;
// Anatomie, Biophysique, ICM et Maths-Biostatistiques en seconde partie (S2).
// Pas encore recoupé avec un compte étudiant réel : à confirmer auprès
// d'A2SUP au premier contact.
const PARIS_CITE_S1: Matiere[] = [
  { name: 'Biochimie', icon: '🧪', semestre: 1 },
  { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
  { name: 'Chimie', icon: '⚗️', semestre: 1 },
  { name: 'Physique', icon: '⚡', semestre: 1 },
  { name: 'Histologie et Embryologie', icon: '🧫', semestre: 1 },
  { name: 'Santé publique', icon: '🏥', semestre: 1 },
  { name: 'Sciences humaines et sociales', icon: '🌍', semestre: 1 },
]
const PARIS_CITE_S2: Matiere[] = [
  { name: 'Anatomie', icon: '🫀', semestre: 2 },
  { name: 'Biophysique', icon: '📊', semestre: 2 },
  { name: 'Mathématiques-Biostatistiques', icon: '📈', semestre: 2 },
  { name: 'Initiation à la connaissance du médicament', icon: '💊', semestre: 2 },
]

// -------------------------------------------------------------
// TOUTES LES AUTRES FACS · PAR DÉFAUT
// -------------------------------------------------------------
// Ce qu'on peut affirmer sans source fac par fac : le noyau que partagent la
// quasi-totalité des PASS. L'interface le présente comme une base de départ
// à ajuster, jamais comme « le programme de ta fac ».
// Pour ajouter une fac ici, il faut une source : une maquette publiée, ou le
// relevé d'un compte étudiant de cette fac. Pas une déduction.
const DEFAUT_S1: Matiere[] = [
  { name: 'Anatomie', icon: '🦴', semestre: 1 },
  { name: 'Biochimie', icon: '🧪', semestre: 1 },
  { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
  { name: 'Chimie générale et organique', icon: '⚗️', semestre: 1 },
  { name: 'Histologie-Embryologie', icon: '🧫', semestre: 1 },
]
const DEFAUT_S2: Matiere[] = [
  { name: 'Biophysique', icon: '📊', semestre: 2 },
  { name: 'Physiologie', icon: '❤️', semestre: 2 },
  { name: 'Biostatistiques', icon: '📈', semestre: 2 },
  { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
]

// =============================================================
// MATIÈRES PRÉ-REMPLIES par (fac, option)
// =============================================================
const FAC_SYSTEMS: Record<string, Record<string, Matiere[]>> = {
  sorbonne: {
    ueds: [...SORBONNE_S1, ...SORBONNE_UEDS, ...SORBONNE_S2],
    uedl: [...SORBONNE_S1, ...SORBONNE_UEDL, ...SORBONNE_S2],
  },
  'paris-cite': {
    bpc: [...PARIS_CITE_S1, mineure('Biologie, physique, chimie'), ...PARIS_CITE_S2],
    biotech: [...PARIS_CITE_S1, mineure('Biotechnologie pour la santé'), ...PARIS_CITE_S2],
    droit: [...PARIS_CITE_S1, mineure('Droit'), ...PARIS_CITE_S2],
    'eco-gestion': [...PARIS_CITE_S1, mineure('Économie et gestion'), ...PARIS_CITE_S2],
    'maths-physique': [...PARIS_CITE_S1, mineure('Mathématiques-Physique'), ...PARIS_CITE_S2],
    'soin-social': [...PARIS_CITE_S1, mineure('Métiers du soin et du social'), ...PARIS_CITE_S2],
    'recherche-sante': [...PARIS_CITE_S1, mineure('Recherche en santé'), ...PARIS_CITE_S2],
    reeducation: [...PARIS_CITE_S1, mineure('Rééducation et réadaptation'), ...PARIS_CITE_S2],
    'sante-populations': [...PARIS_CITE_S1, mineure('Santé des populations'), ...PARIS_CITE_S2],
    psychologie: [...PARIS_CITE_S1, mineure('Sciences psychologiques'), ...PARIS_CITE_S2],
    'sport-sante': [...PARIS_CITE_S1, mineure('Sport et santé'), ...PARIS_CITE_S2],
  },
  autre: {
    default: [...DEFAUT_S1, ...DEFAUT_S2],
  },
}

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

type Step = 'form' | 'fac' | 'option'

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

  // Si l'user est déjà connecté, redirige vers le dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard')
    })
  }, [supabase, router])

  const selectedFac = FACS.find(f => f.id === fac)
  const totalSteps = selectedFac?.hasOptions ? 3 : 2

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
    else handleRegister(fac, 'default')
  }

  async function handleRegister(facId: string, opt: string) {
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

      const matieres = FAC_SYSTEMS[facId]?.[opt] || FAC_SYSTEMS[facId]?.['default'] || FAC_SYSTEMS['autre']['default']
      if (matieres?.length) {
        const { error: sysErr } = await supabase.from('systems').insert(
          matieres.map(m => ({
            user_id: data.user!.id, name: m.name, icon: m.icon,
            semestre: m.semestre, cal_hidden: false,
            // L'inscription pré-remplit la maquette PASS, donc première année.
            // Un étudiant déjà en 2e année bascule ensuite dans les Réglages.
            year: DEFAULT_YEAR,
          }))
        )
        // Un compte sans matière pré-remplie est un compte inutilisable, et
        // l'utilisateur ne le voit qu'une fois arrivé sur un dashboard vide.
        // On le trace pour pouvoir diagnostiquer au lieu d'échouer en silence.
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
          Tes matières du S1 et du S2 sont pré-configurées selon ta fac.
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
                  {totalSteps === 3 && <span className="auth-dot" />}
                </div>
                <button type="button" className="auth-back-btn" onClick={() => setStep('form')}>← Retour</button>
                <div className="auth-step-title">Quelle est ta fac ?</div>
                <div className="auth-step-sub">On te met une liste de matières pour démarrer · tu l&apos;ajustes ensuite en deux clics.</div>
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
                </div>
                <button type="button" className="auth-back-btn" onClick={() => setStep('fac')}>← Retour</button>
                <div className="auth-step-title">Quelle est ton option disciplinaire ?</div>
                <div className="auth-step-sub">Elle ajoute une matière à ta liste · tu renommes et découpes comme tu veux ensuite.</div>
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
                <button className="auth-submit" onClick={() => handleRegister(fac, option)} disabled={!option || loading}>
                  {loading ? 'Création en cours…' : 'Créer mon compte gratuit →'}
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
