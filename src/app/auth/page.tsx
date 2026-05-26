'use client'
// src/app/auth/page.tsx
//
// Page d'inscription + connexion dédiée. Wizard 3 étapes pour le signup
// (form / fac / option Sorbonne) + login + forgot password.
//
// Logique d'auth identique à la version précédente intégrée dans LandingPage,
// extraite ici dans une page séparée pour matcher le pattern Resend.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import './styles.css'

const FACS = [
  { id: 'sorbonne', name: 'Sorbonne Université', badge: 'Paris 6', hasOptions: true },
  { id: 'paris-cite', name: 'Université Paris Cité', badge: 'Paris 5', hasOptions: true },
  { id: 'sorbonne-paris-nord', name: 'Sorbonne Paris Nord', badge: 'Paris 13', hasOptions: true },
  // UPEC : seule fac d'IDF sans PASS, propose uniquement LAS/LSPS.
  // Du coup pas de choix de "mineure disciplinaire" au sens PASS — on
  // pré-config un set neutre de matières santé.
  { id: 'upec', name: 'UPEC Créteil', badge: 'Créteil', hasOptions: false },
  { id: 'lyon', name: 'Université de Lyon', badge: 'Lyon', hasOptions: true },
  { id: 'montpellier', name: 'Université de Montpellier', badge: 'Montpellier', hasOptions: true },
  { id: 'autre', name: 'Autre faculté', badge: 'Autre', hasOptions: false },
]

// =============================================================
// BLOCS DE MATIÈRES — composer chaque (fac, mineure) sans dupliquer
// =============================================================
// La "majeure santé" est commune à toutes les facs PASS (Biochimie, Bio cell,
// Anatomie, Biophysique, Physiologie, Biostat, Pharmaco, SSH, etc.). On la
// définit une fois ici, puis on l'étend avec les matières spécifiques à la
// mineure choisie.
const BASE_S1 = [
  { name: 'Biochimie', icon: '🧪', semestre: 1 as const },
  { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 as const },
  { name: 'Anatomie générale', icon: '🦴', semestre: 1 as const },
]
const BASE_S2 = [
  { name: 'Biophysique', icon: '📊', semestre: 2 as const },
  { name: 'Physiologie', icon: '❤️', semestre: 2 as const },
  { name: 'Biostatistiques', icon: '📈', semestre: 2 as const },
  { name: 'Pharmacologie', icon: '💊', semestre: 2 as const },
  { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 as const },
  { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 as const },
]

// Variante Paris Cité : SSH est en S1 d'après la maquette officielle
// (UE7 - Sciences humaines et sociales en première partie de la majeure).
// On retire SSH de la base S2 et on ajoute une matière équivalente en S1.
const BASE_S2_PC = BASE_S2.filter(m => m.name !== 'Santé, Société, Humanité')
const BASE_S1_PC = [
  ...BASE_S1,
  { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 1 as const },
]

// Matières spécifiques à chaque mineure disciplinaire.
const MIN_SCIENCES = [
  { name: 'Physique', icon: '⚡', semestre: 1 as const },
  { name: 'Chimie', icon: '🔭', semestre: 1 as const },
]
const MIN_LETTRES = [
  { name: 'Sociolinguistique', icon: '📚', semestre: 1 as const },
  { name: 'Linguistique', icon: '🗣️', semestre: 1 as const },
]
const MIN_DROIT = [
  { name: 'Droit constitutionnel', icon: '⚖️', semestre: 1 as const },
  { name: 'Introduction au droit', icon: '📜', semestre: 2 as const },
]
const MIN_ECO = [
  { name: 'Microéconomie', icon: '📉', semestre: 1 as const },
  { name: 'Macroéconomie', icon: '💰', semestre: 2 as const },
]
const MIN_PSY = [
  { name: 'Psychologie générale', icon: '🧠', semestre: 1 as const },
  { name: 'Psychologie cognitive', icon: '💭', semestre: 2 as const },
]
const MIN_STAPS = [
  { name: 'Anatomie fonctionnelle', icon: '🏃', semestre: 1 as const },
  { name: 'Physiologie de l\'exercice', icon: '💪', semestre: 2 as const },
]
const MIN_MATHS = [
  { name: 'Mathématiques', icon: '🔢', semestre: 1 as const },
  { name: 'Mathématiques avancées', icon: '∑', semestre: 2 as const },
]
const MIN_SOC = [
  { name: 'Sociologie de la santé', icon: '👥', semestre: 1 as const },
  { name: 'Politiques de santé', icon: '🏛️', semestre: 2 as const },
]

// =============================================================
// MATIÈRES PRÉ-CONFIG par (fac, mineure)
// =============================================================
// Sources officielles consultées en mai 2026 :
//   - Paris Cité : 11 mineures officielles. On garde les 5 les plus communes.
//   - Sorbonne Paris Nord : 6 mineures internes Bobigny/Villetaneuse.
//   - Lyon 1 (Claude Bernard) : sciences vie, chimie, physique, maths, STAPS.
//   - Montpellier : sciences vie, physique-chimie, maths, droit, économie, psy.
// Si une fac change ses mineures, ajuster ici sans toucher au reste du code.
const FAC_SYSTEMS: Record<string, Record<string, { name: string; icon: string; semestre: number }[]>> = {
  sorbonne: {
    sciences: [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    lettres: [...BASE_S1, ...MIN_LETTRES, ...BASE_S2],
  },
  'paris-cite': {
    // À PC, SSH est en S1 (pas en S2 comme à Sorbonne). On utilise les bases
    // adaptées BASE_S1_PC / BASE_S2_PC pour refléter ça correctement.
    bpc: [...BASE_S1_PC, ...MIN_SCIENCES, ...BASE_S2_PC],
    droit: [...BASE_S1_PC, ...MIN_DROIT, ...BASE_S2_PC],
    'eco-gestion': [...BASE_S1_PC, ...MIN_ECO, ...BASE_S2_PC],
    psychologie: [...BASE_S1_PC, ...MIN_PSY, ...BASE_S2_PC],
    'sport-sante': [...BASE_S1_PC, ...MIN_STAPS, ...BASE_S2_PC],
  },
  'sorbonne-paris-nord': {
    'sciences-vie': [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    'eco-gestion': [...BASE_S1, ...MIN_ECO, ...BASE_S2],
    droit: [...BASE_S1, ...MIN_DROIT, ...BASE_S2],
    'physique-chimie': [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    staps: [...BASE_S1, ...MIN_STAPS, ...BASE_S2],
    'sciences-sociales': [...BASE_S1, ...MIN_SOC, ...BASE_S2],
  },
  upec: {
    // LAS/LSPS — pas de mineure PASS standard.
    default: [...BASE_S1, ...BASE_S2],
  },
  lyon: {
    'sciences-vie': [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    chimie: [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    physique: [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    maths: [...BASE_S1, ...MIN_MATHS, ...BASE_S2],
    staps: [...BASE_S1, ...MIN_STAPS, ...BASE_S2],
  },
  montpellier: {
    'sciences-vie': [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    'physique-chimie': [...BASE_S1, ...MIN_SCIENCES, ...BASE_S2],
    maths: [...BASE_S1, ...MIN_MATHS, ...BASE_S2],
    droit: [...BASE_S1, ...MIN_DROIT, ...BASE_S2],
    economie: [...BASE_S1, ...MIN_ECO, ...BASE_S2],
    psychologie: [...BASE_S1, ...MIN_PSY, ...BASE_S2],
  },
  autre: {
    default: [...BASE_S1, ...BASE_S2],
  },
}

// =============================================================
// MÉTADONNÉES UI pour le step "choix de la mineure" au signup
// =============================================================
// Une carte par mineure dans la liste, avec un titre, une description
// courte et les tags = aperçu des principales matières. La carte cliquée
// devient le `option` dans handleRegister, qui mappe vers FAC_SYSTEMS.
type FacOption = { id: string; name: string; desc: string; tags: string[] }
const FAC_OPTIONS: Record<string, FacOption[]> = {
  sorbonne: [
    { id: 'sciences', name: 'Option Sciences', desc: 'Bio · Chimie · Physique · Mineure Sciences',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie', 'Biostat', 'Pharmaco', 'SSH'] },
    { id: 'lettres', name: 'Option Lettres', desc: 'Sciences du langage · Mineure Lettres',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Sociolinguistique', 'Linguistique', 'Biophysique', 'Physiologie', 'Biostat', 'Pharmaco'] },
  ],
  'paris-cite': [
    { id: 'bpc', name: 'Mineure BPC', desc: 'Biologie · Physique · Chimie · La voie classique',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie', 'Pharmaco'] },
    { id: 'droit', name: 'Mineure Droit', desc: 'Droit constitutionnel · Introduction au droit',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Droit constit.', 'Intro droit', 'Biophysique', 'Physiologie'] },
    { id: 'eco-gestion', name: 'Mineure Économie-Gestion', desc: 'Microéconomie · Macroéconomie',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Microéconomie', 'Macroéconomie', 'Biophysique', 'Physiologie'] },
    { id: 'psychologie', name: 'Sciences psychologiques', desc: 'Psychologie générale et cognitive',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Psy générale', 'Psy cognitive', 'Biophysique', 'Physiologie'] },
    { id: 'sport-sante', name: 'Sport et santé', desc: 'STAPS · Anatomie fonctionnelle · Physio exercice',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Anat. fonct.', 'Physio exercice', 'Biophysique', 'Physiologie'] },
  ],
  'sorbonne-paris-nord': [
    { id: 'sciences-vie', name: 'Sciences de la vie', desc: 'Bobigny · Biologie · Physique · Chimie',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie'] },
    { id: 'eco-gestion', name: 'Économie-Gestion', desc: 'Villetaneuse · Micro/Macroéconomie',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Microéconomie', 'Macroéconomie', 'Biophysique', 'Physiologie'] },
    { id: 'droit', name: 'Droit', desc: 'Villetaneuse · Droit constitutionnel',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Droit constit.', 'Intro droit', 'Biophysique', 'Physiologie'] },
    { id: 'physique-chimie', name: 'Physique-Chimie', desc: 'Villetaneuse · Voie scientifique',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie'] },
    { id: 'staps', name: 'STAPS', desc: 'Bobigny · Anatomie fonctionnelle · Physio exercice',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Anat. fonct.', 'Physio exercice', 'Biophysique', 'Physiologie'] },
    { id: 'sciences-sociales', name: 'Sciences sanitaires et sociales', desc: 'Bobigny · Sociologie · Politiques de santé',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Sociologie santé', 'Politiques santé', 'Biophysique', 'Physiologie'] },
  ],
  lyon: [
    { id: 'sciences-vie', name: 'Sciences de la vie', desc: 'Voie scientifique classique',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie'] },
    { id: 'chimie', name: 'Chimie', desc: 'Spécialité chimie',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie'] },
    { id: 'physique', name: 'Physique', desc: 'Spécialité physique',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie'] },
    { id: 'maths', name: 'Mathématiques', desc: 'Maths · Maths avancées',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Mathématiques', 'Maths avancées', 'Biophysique', 'Physiologie'] },
    { id: 'staps', name: 'STAPS', desc: 'Anatomie fonctionnelle · Physio exercice',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Anat. fonct.', 'Physio exercice', 'Biophysique', 'Physiologie'] },
  ],
  montpellier: [
    { id: 'sciences-vie', name: 'Sciences de la vie', desc: 'Voie scientifique classique',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie'] },
    { id: 'physique-chimie', name: 'Physique-Chimie', desc: 'Spécialité scientifique',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie'] },
    { id: 'maths', name: 'Mathématiques', desc: 'Maths · Maths avancées',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Mathématiques', 'Maths avancées', 'Biophysique', 'Physiologie'] },
    { id: 'droit', name: 'Droit', desc: 'Droit constitutionnel · Introduction au droit',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Droit constit.', 'Intro droit', 'Biophysique', 'Physiologie'] },
    { id: 'economie', name: 'Économie', desc: 'Microéconomie · Macroéconomie',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Microéconomie', 'Macroéconomie', 'Biophysique', 'Physiologie'] },
    { id: 'psychologie', name: 'Psychologie', desc: 'Psychologie générale et cognitive',
      tags: ['Biochimie', 'Bio cell.', 'Anatomie', 'Psy générale', 'Psy cognitive', 'Biophysique', 'Physiologie'] },
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
  }, [searchParams])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fac, setFac] = useState('')
  const [option, setOption] = useState('')
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
    if (selectedFac?.hasOptions) setStep('option')
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
        await supabase.from('systems').insert(
          matieres.map(m => ({
            user_id: data.user!.id, name: m.name, icon: m.icon,
            semestre: m.semestre, cal_hidden: false,
          }))
        )
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
    <div className="lp-page">
      <MarketingNav />

      <div className="auth-page">
        <div className="auth-page-head">
          <span className="lp-hero-kicker">Inscription · 2 minutes</span>
          <h1 className="auth-h1">Commence à retenir<br /><em>pour de bon.</em></h1>
          <p className="auth-sub">
            Crée ton compte en 2 minutes. Tes matières du S1 et S2 sont
            déjà pré-configurées selon ta fac. Pas de carte bleue, pas
            d&apos;engagement.
          </p>
        </div>

        <div className="auth-grid">
          <div>
            <div className="auth-trust">
              <div className="auth-trust-row"><span className="auth-trust-check">✓</span>Gratuit pour démarrer (matières / fiches illimitées)</div>
              <div className="auth-trust-row"><span className="auth-trust-check">✓</span>Auto-config matières dès l&apos;inscription</div>
              <div className="auth-trust-row"><span className="auth-trust-check">✓</span>Données sur Supabase Paris 🇫🇷</div>
              <div className="auth-trust-row"><span className="auth-trust-check">✓</span>Aucune publicité, aucun tracking tiers</div>
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
                <div className="auth-step-sub">On pré-configure tes matières S1 et S2 automatiquement.</div>
                <div className="auth-fac-list">
                  {FACS.map(f => (
                    <button key={f.id} type="button" className={`auth-fac-item${fac === f.id ? ' sel' : ''}`} onClick={() => setFac(f.id)}>
                      <span>{f.name}</span>
                      <span className="auth-fac-badge">{f.badge}</span>
                    </button>
                  ))}
                </div>
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
                <div className="auth-step-title">Quelle est ta mineure disciplinaire ?</div>
                <div className="auth-step-sub">
                  Choisis ta mineure pour pré-configurer tes matières. La
                  répartition S1/S2 ci-dessous est <em>indicative</em> — elle
                  est basée sur les programmes officiels mais peut varier
                  d&apos;une année à l&apos;autre. Tu pourras déplacer une
                  matière entre S1 et S2 (ou la renommer, la supprimer)
                  depuis la page Mes cours après inscription.
                </div>
                <div className="auth-opt-list">
                  {/* Liste dynamique des mineures de la fac choisie. Si pas de
                      mineures définies, fallback vide (mais on n'arrive ici
                      que si hasOptions === true côté fac, donc une liste
                      devrait toujours exister). */}
                  {(FAC_OPTIONS[fac] || []).map(opt => (
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
