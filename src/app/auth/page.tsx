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
import '@/components/landing-styles.css'

const FACS = [
  { id: 'sorbonne', name: 'Sorbonne Université', badge: 'Paris 6', hasOptions: true },
  { id: 'paris-cite', name: 'Université Paris Cité', badge: 'Paris 5', hasOptions: false },
  { id: 'sorbonne-paris-nord', name: 'Sorbonne Paris Nord', badge: 'Paris 13', hasOptions: false },
  { id: 'upec', name: 'UPEC Créteil', badge: 'Créteil', hasOptions: false },
  { id: 'lyon', name: 'Université de Lyon', badge: 'Lyon', hasOptions: false },
  { id: 'montpellier', name: 'Université de Montpellier', badge: 'Montpellier', hasOptions: false },
  { id: 'autre', name: 'Autre faculté', badge: 'Autre', hasOptions: false },
]

const FAC_SYSTEMS: Record<string, Record<string, { name: string; icon: string; semestre: number }[]>> = {
  sorbonne: {
    sciences: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Physique', icon: '⚡', semestre: 1 },
      { name: 'Chimie', icon: '🔭', semestre: 1 }, { name: 'Biophysique', icon: '📊', semestre: 2 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 }, { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 }, { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
      { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
    ],
    lettres: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Sociolinguistique', icon: '📚', semestre: 1 },
      { name: 'Linguistique', icon: '🗣️', semestre: 1 }, { name: 'Biophysique', icon: '📊', semestre: 2 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 }, { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 }, { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
      { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
    ],
  },
  'paris-cite': { default: [
    { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
    { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Physique', icon: '⚡', semestre: 1 },
    { name: 'Chimie', icon: '🔭', semestre: 1 }, { name: 'Biophysique', icon: '📊', semestre: 2 },
    { name: 'Physiologie', icon: '❤️', semestre: 2 }, { name: 'Biostatistiques', icon: '📈', semestre: 2 },
    { name: 'Pharmacologie', icon: '💊', semestre: 2 }, { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
    { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
  ] },
  'sorbonne-paris-nord': { default: [
    { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
    { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Physique', icon: '⚡', semestre: 1 },
    { name: 'Chimie', icon: '🔭', semestre: 1 }, { name: 'Biophysique', icon: '📊', semestre: 2 },
    { name: 'Physiologie', icon: '❤️', semestre: 2 }, { name: 'Biostatistiques', icon: '📈', semestre: 2 },
    { name: 'Pharmacologie', icon: '💊', semestre: 2 }, { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
    { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
  ] },
  upec: { default: [
    { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
    { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
    { name: 'Physiologie', icon: '❤️', semestre: 2 }, { name: 'Biostatistiques', icon: '📈', semestre: 2 },
    { name: 'Pharmacologie', icon: '💊', semestre: 2 },
  ] },
  lyon: { default: [
    { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
    { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Physiologie', icon: '❤️', semestre: 2 },
    { name: 'Biostatistiques', icon: '📈', semestre: 2 }, { name: 'Pharmacologie', icon: '💊', semestre: 2 },
    { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
  ] },
  montpellier: { default: [
    { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
    { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Physiologie', icon: '❤️', semestre: 2 },
    { name: 'Biostatistiques', icon: '📈', semestre: 2 }, { name: 'Pharmacologie', icon: '💊', semestre: 2 },
    { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
  ] },
  autre: { default: [
    { name: 'Biochimie', icon: '🧪', semestre: 1 }, { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
    { name: 'Anatomie générale', icon: '🦴', semestre: 1 }, { name: 'Physiologie', icon: '❤️', semestre: 2 },
    { name: 'Biostatistiques', icon: '📈', semestre: 2 }, { name: 'Pharmacologie', icon: '💊', semestre: 2 },
    { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
  ] },
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
                <div className="auth-step-title">Quelle est ton option ?</div>
                <div className="auth-step-sub">Sorbonne PASS/LAS : choisis ta mineure pour pré-configurer les matières.</div>
                <div className="auth-opt-list">
                  <button type="button" className={`auth-opt-card${option === 'sciences' ? ' sel' : ''}`} onClick={() => setOption('sciences')}>
                    <div className="auth-opt-card-title">Option Sciences</div>
                    <div className="auth-opt-card-desc">Bio · Chimie · Physique · Mineure Sciences</div>
                    <div className="auth-opt-tags">
                      {['Biochimie', 'Bio cell.', 'Anatomie', 'Physique', 'Chimie', 'Biophysique', 'Physiologie', 'Biostat', 'Pharmaco', 'SSH'].map(m => (
                        <span key={m} className="auth-opt-tag">{m}</span>
                      ))}
                    </div>
                  </button>
                  <button type="button" className={`auth-opt-card${option === 'lettres' ? ' sel' : ''}`} onClick={() => setOption('lettres')}>
                    <div className="auth-opt-card-title">Option Lettres</div>
                    <div className="auth-opt-card-desc">Sciences du langage · Mineure Lettres</div>
                    <div className="auth-opt-tags">
                      {['Biochimie', 'Bio cell.', 'Anatomie', 'Sociolinguistique', 'Linguistique', 'Biophysique', 'Physiologie', 'Biostat', 'Pharmaco'].map(m => (
                        <span key={m} className="auth-opt-tag">{m}</span>
                      ))}
                    </div>
                  </button>
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
