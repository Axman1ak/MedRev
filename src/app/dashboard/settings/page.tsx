'use client'
// src/app/dashboard/settings/page.tsx
//
// Page Réglages v2 : l'abonnement d'abord (carte héro vendeuse), puis des
// sections consolidées et expliquées : Profil, Compte (email + mot de passe +
// déconnexion), Apparence (thème + sons), Aide, et la zone de suppression.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ScoringSystemId } from '@/types'
import { FREE_AI_GENERATIONS_LIMIT, FREE_SIMULATOR_SESSIONS_LIMIT, PREMIUM_MONTHLY_AI_CAP, SCORING_SYSTEMS } from '@/types'
import { soundsEnabled, setSoundsEnabled } from '@/lib/sounds'
import './styles.css'

const FACS = [
  { id: 'sorbonne', name: 'Sorbonne Université' },
  { id: 'paris-cite', name: 'Université Paris Cité' },
  { id: 'sorbonne-paris-nord', name: 'Sorbonne Paris Nord' },
  { id: 'upec', name: 'UPEC Créteil' },
  { id: 'lyon', name: 'Université de Lyon' },
  { id: 'montpellier', name: 'Université de Montpellier' },
  { id: 'autre', name: 'Autre faculté' },
]

// Arguments Premium affichés dans la carte abonnement (free users).
const PREMIUM_PERKS = [
  { title: 'Générations IA illimitées', sub: 'QCM, flashcards et extractions sans compteur' },
  { title: 'Simulateur illimité', sub: "Autant de sessions d'entraînement que tu veux" },
  { title: 'Vidéos jusqu\'à 250 Mo', sub: 'Tes cours filmés, transcrits et transformés en QCM' },
  { title: 'PDF sans limite de taille', sub: 'Polys complets, annales, diapos de cours' },
]

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [fac, setFac] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Stripe Customer Portal, bouton de gestion d'abonnement pour les Pro
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  // Mot de passe
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Suppression du compte (RGPD, droit à l'effacement)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Apparence (mode clair / sombre)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  // Sons de la bibliothèque (Web Audio, localStorage 'medrev-sounds')
  const [sounds, setSounds] = useState(true)
  // Barème du simulateur ('' = auto selon la fac, sinon un ScoringSystemId), localStorage 'medrev-scoring'
  const [scoringPref, setScoringPref] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('medrev-theme')
    const t: 'light' | 'dark' = stored === 'dark' ? 'dark' : 'light'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    setSounds(soundsEnabled())
    setScoringPref(localStorage.getItem('medrev-scoring') || '')
  }, [])

  function chooseTheme(t: 'light' | 'dark') {
    setTheme(t)
    if (typeof window !== 'undefined') {
      localStorage.setItem('medrev-theme', t)
      document.documentElement.setAttribute('data-theme', t)
    }
  }

  function toggleSounds() {
    const next = !sounds
    setSounds(next)
    setSoundsEnabled(next)
  }

  function chooseScoring(v: string) {
    setScoringPref(v)
    if (typeof window === 'undefined') return
    if (v) localStorage.setItem('medrev-scoring', v)
    else localStorage.removeItem('medrev-scoring')
  }

  // ------------ LOAD ------------
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      if (data) {
        setProfile(data as Profile)
        setName(data.name || '')
        setUsername(data.username || '')
        setFac(data.fac || '')
      }
      setEmail(user.email || '')
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router])

  // ------------ SAVE PROFILE ------------
  async function saveProfile() {
    if (!profile) return
    setProfileMsg(null)
    setSavingProfile(true)
    try {
      const trimmedName = name.trim()
      const trimmedUsername = username.trim()
      if (!trimmedName) throw new Error('Le nom ne peut pas être vide.')
      if (!trimmedUsername) throw new Error('Le nom d\'utilisateur ne peut pas être vide.')

      const { error } = await supabase
        .from('profiles')
        .update({
          name: trimmedName,
          username: trimmedUsername,
          fac: fac || null,
        })
        .eq('id', profile.id)
      if (error) throw error

      setProfile({ ...profile, name: trimmedName, username: trimmedUsername, fac: fac || null })
      setProfileMsg({ kind: 'ok', text: 'Profil mis à jour.' })
    } catch (e: unknown) {
      setProfileMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Erreur inconnue' })
    } finally {
      setSavingProfile(false)
    }
  }

  // ------------ CHANGE PASSWORD ------------
  async function changePassword() {
    setPasswordMsg(null)
    if (newPassword.length < 8) {
      setPasswordMsg({ kind: 'err', text: 'Le mot de passe doit faire au moins 8 caractères.' })
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordMsg({ kind: 'err', text: 'Les deux mots de passe ne correspondent pas.' })
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setNewPasswordConfirm('')
      setPasswordMsg({ kind: 'ok', text: 'Mot de passe modifié.' })
    } catch (e: unknown) {
      setPasswordMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Erreur inconnue' })
    } finally {
      setSavingPassword(false)
    }
  }

  // ------------ STRIPE CUSTOMER PORTAL ------------
  async function openCustomerPortal() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        setPortalError(json?.error || 'Impossible d\'ouvrir le portail.')
        setPortalLoading(false)
        return
      }
      window.location.href = json.url as string
    } catch {
      setPortalError('Connexion impossible. Réessaie dans un instant.')
      setPortalLoading(false)
    }
  }

  // ------------ LOGOUT ------------
  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ------------ DELETE ACCOUNT ------------
  async function deleteAccount() {
    setDeleteError(null)
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(json?.error || 'Suppression impossible. Réessaie.')
        setDeleting(false)
        return
      }
      // Compte supprimé, on redirige vers l'accueil avec un signal pour
      // éventuellement afficher un message côté landing.
      window.location.href = '/?deleted=1'
    } catch {
      setDeleteError('Connexion impossible. Réessaie dans un instant.')
      setDeleting(false)
    }
  }

  // Reset l'état de la modal quand on la ferme
  function closeDeleteModal() {
    setShowDeleteModal(false)
    setDeletePassword('')
    setDeleteConfirmation('')
    setDeleteError(null)
  }

  const canConfirmDelete = deletePassword.length > 0 && deleteConfirmation === 'SUPPRIMER'

  if (!profile) {
    return (
      <div className="set-page">
        <div className="set-loading">Chargement…</div>
      </div>
    )
  }

  const isPro = profile.plan === 'pro'

  // Compteur mensuel Premium (reset à la volée si nouveau mois)
  const monthStartedAt = profile.ai_generations_month_started_at
    ? new Date(profile.ai_generations_month_started_at)
    : null
  const nowDate = new Date()
  const inSameMonth = !!monthStartedAt
    && monthStartedAt.getUTCFullYear() === nowDate.getUTCFullYear()
    && monthStartedAt.getUTCMonth() === nowDate.getUTCMonth()
  const monthCount = inSameMonth ? (profile.ai_generations_month_count ?? 0) : 0
  const showMonthlyCap = monthCount > PREMIUM_MONTHLY_AI_CAP * 0.5

  const aiUsed = profile.ai_generations_count ?? 0
  const simUsed = profile.simulator_sessions_count ?? 0

  return (
    <div className="set-page">
      <div className="set-wrap">
        <div className="set-head">
          <h1 className="set-h1">Réglages</h1>
          <nav className="set-anchors" aria-label="Sections des réglages">
            <a href="#set-abo">Abonnement</a>
            <a href="#set-profil">Profil</a>
            <a href="#set-compte">Compte</a>
            <a href="#set-apparence">Apparence</a>
            <a href="#set-bareme">Barème</a>
            <a href="#set-aide">Aide</a>
            <a href="#set-danger" className="set-anchor-danger">Supprimer</a>
          </nav>
        </div>

        {/* ============ ABONNEMENT (carte héro) ============ */}
        <section className={`set-abo${isPro ? ' pro' : ''}`} id="set-abo">
          <div className="set-abo-glow" aria-hidden="true" />
          <div className="set-abo-head">
            <div>
              <div className="set-abo-kicker">Ton abonnement</div>
              <h2 className="set-abo-title">
                {isPro ? 'Med·Rev Premium' : 'Med·Rev Gratuit'}
              </h2>
            </div>
            <span className={`set-abo-badge${isPro ? ' pro' : ''}`}>
              {isPro ? 'Premium actif' : 'Gratuit'}
            </span>
          </div>

          {!isPro && (
            <>
              <p className="set-abo-pitch">
                Le plan Gratuit te donne accès au cœur de la méthode. Premium
                enlève toutes les limites pour réviser sans jamais t&apos;arrêter.
              </p>

              <div className="set-abo-perks">
                {PREMIUM_PERKS.map(p => (
                  <div key={p.title} className="set-abo-perk">
                    <span className="set-abo-perk-check" aria-hidden="true">✓</span>
                    <div>
                      <strong>{p.title}</strong>
                      <span>{p.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="set-abo-quotas">
                <div className="set-abo-quotas-lbl">Où tu en es sur tes quotas Gratuit</div>
                <QuotaBar label="Générations QCM IA" used={aiUsed} limit={FREE_AI_GENERATIONS_LIMIT} />
                <QuotaBar label="Sessions simulateur" used={simUsed} limit={FREE_SIMULATOR_SESSIONS_LIMIT} />
              </div>

              <div className="set-abo-cta-row">
                <Link href="/dashboard/pricing" className="set-abo-cta">
                  Passer à Premium →
                </Link>
                <span className="set-abo-cta-note">Sans engagement, résiliable en deux clics.</span>
              </div>
            </>
          )}

          {isPro && (
            <>
              <p className="set-abo-pitch">
                Merci de soutenir Med·Rev. Tout est illimité : générations IA,
                simulateur, vidéos jusqu&apos;à 250 Mo et PDF sans limite.
              </p>

              {showMonthlyCap && (
                <div className="set-abo-quotas">
                  <div className="set-abo-quotas-lbl">Usage IA ce mois-ci</div>
                  <QuotaBar label="Générations QCM IA" used={monthCount} limit={PREMIUM_MONTHLY_AI_CAP} />
                  <p className="set-abo-note">
                    Le compteur se remet à zéro le 1er du mois. Cette limite haute
                    protège l&apos;infrastructure, tu ne devrais jamais l&apos;atteindre
                    en utilisation normale.
                  </p>
                </div>
              )}

              {portalError && (
                <div className="set-msg err" style={{ marginTop: 10 }}>{portalError}</div>
              )}

              {profile.stripe_customer_id ? (
                <div className="set-abo-cta-row">
                  <button
                    type="button"
                    className="set-abo-cta ghost"
                    onClick={openCustomerPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? 'Ouverture…' : 'Gérer mon abonnement →'}
                  </button>
                  <span className="set-abo-cta-note">
                    Factures, carte bancaire et résiliation via le portail sécurisé Stripe.
                  </span>
                </div>
              ) : (
                <p className="set-abo-note">
                  Tu bénéficies d&apos;un accès Premium offert : il n&apos;y a pas
                  d&apos;abonnement à gérer. Pour toute question, écris à{' '}
                  <a href="mailto:loubonnefoypc@gmail.com">loubonnefoypc@gmail.com</a>.
                </p>
              )}
            </>
          )}
        </section>

        {/* ============ PROFIL ============ */}
        <section className="set-card" id="set-profil">
          <div className="set-card-h">Profil</div>
          <p className="set-card-sub">Ton identité dans l&apos;application : nom affiché, pseudo et faculté.</p>

          <div className="set-row">
            <label className="set-label">Nom</label>
            <input
              className="set-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ton nom"
            />
          </div>

          <div className="set-row">
            <label className="set-label">Nom d&apos;utilisateur</label>
            <input
              className="set-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ex: sophie_m"
            />
          </div>

          <div className="set-row">
            <label className="set-label">Faculté</label>
            <select
              className="set-input"
              value={fac}
              onChange={e => setFac(e.target.value)}
            >
              <option value="">· Choisir ·</option>
              {FACS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {profileMsg && (
            <div className={`set-msg ${profileMsg.kind}`}>{profileMsg.text}</div>
          )}

          <div className="set-actions">
            <button
              className="set-btn primary"
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </section>

        {/* ============ COMPTE (email + mot de passe + session) ============ */}
        <section className="set-card" id="set-compte">
          <div className="set-card-h">Compte et sécurité</div>
          <p className="set-card-sub">Ton email de connexion, ton mot de passe et ta session.</p>

          <div className="set-row">
            <label className="set-label">Email de connexion</label>
            <div className="set-static">{email}</div>
            <p className="set-hint">
              Pour changer d&apos;email, écris à{' '}
              <a href="mailto:loubonnefoypc@gmail.com">loubonnefoypc@gmail.com</a>.
            </p>
          </div>

          <div className="set-divider" aria-hidden="true" />

          <div className="set-row">
            <label className="set-label">Nouveau mot de passe</label>
            <input
              className="set-input"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 8 caractères"
              autoComplete="new-password"
            />
          </div>

          <div className="set-row">
            <label className="set-label">Confirmer le nouveau mot de passe</label>
            <input
              className="set-input"
              type="password"
              value={newPasswordConfirm}
              onChange={e => setNewPasswordConfirm(e.target.value)}
              placeholder="Retape le même"
              autoComplete="new-password"
            />
          </div>

          {passwordMsg && (
            <div className={`set-msg ${passwordMsg.kind}`}>{passwordMsg.text}</div>
          )}

          <div className="set-actions">
            <button
              className="set-btn primary"
              onClick={changePassword}
              disabled={savingPassword || !newPassword || !newPasswordConfirm}
            >
              {savingPassword ? 'Modification…' : 'Modifier le mot de passe'}
            </button>
          </div>

          <div className="set-divider" aria-hidden="true" />

          <div className="set-row set-row-inline">
            <div>
              <label className="set-label">Session</label>
              <p className="set-hint">
                Tes données restent en place : tu pourras te reconnecter à tout moment.
              </p>
            </div>
            <button className="set-btn" onClick={logout}>
              Se déconnecter
            </button>
          </div>
        </section>

        {/* ============ APPARENCE ============ */}
        <section className="set-card" id="set-apparence">
          <div className="set-card-h">Apparence et ambiance</div>
          <p className="set-card-sub">Le thème de l&apos;interface et les sons de la bibliothèque.</p>

          <div className="set-row">
            <label className="set-label">Thème</label>
            <div className="set-theme-grid">
              <button
                type="button"
                className={`set-theme-card${theme === 'light' ? ' on' : ''}`}
                onClick={() => chooseTheme('light')}
                aria-pressed={theme === 'light'}
              >
                <div className="set-theme-preview light">
                  <span className="ttp-bg" />
                  <span className="ttp-card" />
                  <span className="ttp-line a" />
                  <span className="ttp-line b" />
                </div>
                <div className="set-theme-meta">
                  <strong>Clair</strong>
                  <span>Fond off-white doux</span>
                </div>
              </button>

              <button
                type="button"
                className={`set-theme-card${theme === 'dark' ? ' on' : ''}`}
                onClick={() => chooseTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                <div className="set-theme-preview dark">
                  <span className="ttp-bg" />
                  <span className="ttp-card" />
                  <span className="ttp-line a" />
                  <span className="ttp-line b" />
                </div>
                <div className="set-theme-meta">
                  <strong>Sombre</strong>
                  <span>Anthracite reposant</span>
                </div>
              </button>
            </div>
          </div>

          <div className="set-divider" aria-hidden="true" />

          <div className="set-row set-row-inline">
            <div>
              <label className="set-label">Sons de la bibliothèque</label>
              <p className="set-hint">
                Petits bruitages feutrés pendant les sessions : livre qui
                s&apos;ouvre, tampon de cire, rangement sur l&apos;étagère.
              </p>
            </div>
            <button
              type="button"
              className={`set-switch${sounds ? ' on' : ''}`}
              onClick={toggleSounds}
              role="switch"
              aria-checked={sounds}
              aria-label="Activer ou couper les sons de la bibliothèque"
            >
              <span className="set-switch-knob" />
            </button>
          </div>
        </section>

        {/* ============ AIDE ============ */}
        <section className="set-card" id="set-aide">
          <div className="set-card-h">Aide</div>
          <p className="set-card-sub">Besoin de te rafraîchir la mémoire sur le fonctionnement du site ?</p>

          <div className="set-row set-row-inline">
            <div>
              <label className="set-label">Tutoriel d&apos;introduction</label>
              <p className="set-hint">
                Revoir le tour guidé : la courbe J, la notation, les fiches,
                le simulateur et la bibliothèque.
              </p>
            </div>
            <button
              className="set-btn"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // Reset le state local du tour pour repartir de zéro
                  localStorage.removeItem('medrev-onboarding-step')
                  localStorage.removeItem('medrev-onboarding-phase') // legacy
                  window.dispatchEvent(new Event('medrev-onboarding-replay'))
                }
              }}
            >
              Revoir le tutoriel
            </button>
          </div>
        </section>

        {/* ============ SUPPRIMER (RGPD) ============ */}
        <section className="set-card" id="set-bareme">
          <div className="set-card-h">Barème du simulateur</div>
          <p className="set-card-sub">Comment les QCM du simulateur sont notés. Par défaut on applique le barème standard ; change-le si ta fac utilise un autre système.</p>
          <div className="set-bareme-grid">
            <button type="button" className={`set-bareme-opt${scoringPref === '' ? ' on' : ''}`} onClick={() => chooseScoring('')}>
              <strong>Automatique</strong>
              <span>Barème standard, selon ta faculté</span>
            </button>
            {(Object.keys(SCORING_SYSTEMS) as ScoringSystemId[]).map(id => (
              <button key={id} type="button" className={`set-bareme-opt${scoringPref === id ? ' on' : ''}`} onClick={() => chooseScoring(id)}>
                <strong>{SCORING_SYSTEMS[id].label}</strong>
                <span>{SCORING_SYSTEMS[id].desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="set-card set-card-danger" id="set-danger">
          <div className="set-card-h">Supprimer mon compte</div>
          <p className="set-hint">
            La suppression est <strong>définitive et immédiate</strong> : toutes
            tes fiches, tes notes, tes QCM, ta bibliothèque et ton historique
            sont effacés sans possibilité de récupération. Si tu as un
            abonnement Premium actif, il sera automatiquement annulé.
          </p>
          <div className="set-actions">
            <button
              className="set-btn ghost-rose"
              onClick={() => setShowDeleteModal(true)}
            >
              Supprimer mon compte…
            </button>
          </div>
        </section>

      </div>

      {/* MODAL CONFIRMATION SUPPRESSION */}
      {showDeleteModal && (
        <div
          className="set-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-title"
          onClick={() => { if (!deleting) closeDeleteModal() }}
        >
          <div className="set-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="del-title" className="set-modal-title">Supprimer mon compte</h2>
            <p className="set-modal-intro">
              Cette action est <strong>définitive</strong>. On supprime
              tes fiches, tes notes, ta bibliothèque, tes QCM générés, et
              on annule l&apos;abonnement Premium si tu en as un.
            </p>

            <div className="set-row" style={{ marginTop: 18 }}>
              <label className="set-label">Tape <strong>SUPPRIMER</strong> en majuscules pour confirmer</label>
              <input
                className="set-input"
                type="text"
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                placeholder="SUPPRIMER"
                autoComplete="off"
                disabled={deleting}
              />
            </div>

            <div className="set-row">
              <label className="set-label">Mot de passe (pour re-vérification)</label>
              <input
                className="set-input"
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Ton mot de passe actuel"
                autoComplete="current-password"
                disabled={deleting}
              />
            </div>

            {deleteError && (
              <div className="set-msg err" style={{ marginTop: 12 }}>{deleteError}</div>
            )}

            <div className="set-modal-actions">
              <button
                type="button"
                className="set-btn"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                type="button"
                className="set-btn ghost-rose"
                onClick={deleteAccount}
                disabled={!canConfirmDelete || deleting}
              >
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// QuotaBar, barre de progression compacte pour les compteurs Free
// ============================================================
function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const safeUsed = Math.max(0, Math.min(used, limit))
  const pct = limit > 0 ? Math.round((safeUsed / limit) * 100) : 0
  const exhausted = safeUsed >= limit
  return (
    <div className={`set-quota${exhausted ? ' exhausted' : ''}`}>
      <div className="set-quota-row">
        <span className="set-quota-lbl">{label}</span>
        <span className="set-quota-num">
          <strong>{safeUsed}</strong> / {limit}
        </span>
      </div>
      <div className="set-quota-bar" aria-hidden="true">
        <div className="set-quota-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
