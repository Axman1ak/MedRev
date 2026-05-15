'use client'
// src/app/dashboard/settings/page.tsx
//
// Page Paramètres : édition du profil (nom, username, fac), changement de
// mot de passe, déconnexion. Plan affiché en lecture seule (le flow d'upgrade
// vers Pro n'est pas branché pour le moment).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { FREE_AI_GENERATIONS_LIMIT, FREE_SIMULATOR_SESSIONS_LIMIT, PREMIUM_MONTHLY_AI_CAP } from '@/types'
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

  // Stripe Customer Portal — bouton de gestion d'abonnement pour les Pro
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  // Mot de passe
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Suppression du compte (RGPD — droit à l'effacement)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Apparence (mode clair / sombre)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('medrev-theme')
    const t: 'light' | 'dark' = stored === 'dark' ? 'dark' : 'light'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  function chooseTheme(t: 'light' | 'dark') {
    setTheme(t)
    if (typeof window !== 'undefined') {
      localStorage.setItem('medrev-theme', t)
      document.documentElement.setAttribute('data-theme', t)
    }
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
      // Compte supprimé — on redirige vers l'accueil avec un signal pour
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

  const planLabel = profile.plan === 'pro' ? 'Premium' : 'Gratuit'

  return (
    <div className="set-page">
      <div className="set-wrap">
        <div className="set-head">
          <h1 className="set-h1">Paramètres</h1>
          <p className="set-sub">Gère ton compte, ton profil et ton mot de passe.</p>
        </div>

        {/* PROFIL */}
        <section className="set-card">
          <div className="set-card-h">Profil</div>

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
              <option value="">— Choisir —</option>
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

        {/* COMPTE */}
        <section className="set-card">
          <div className="set-card-h">Compte</div>

          <div className="set-row">
            <label className="set-label">Email</label>
            <div className="set-static">{email}</div>
            <p className="set-hint">
              L&apos;email est utilisé pour la connexion. Pour le changer,
              écris à <a href="mailto:loubonnefoypc@gmail.com">loubonnefoypc@gmail.com</a>.
            </p>
          </div>

          <div className="set-row">
            <label className="set-label">Plan actuel</label>
            <div className="set-plan">
              <span className={`set-plan-badge ${profile.plan === 'pro' ? 'pro' : 'free'}`}>{planLabel}</span>
              {profile.plan !== 'pro' && (
                <Link href="/dashboard/pricing" className="set-plan-link">
                  Voir les formules Premium →
                </Link>
              )}
            </div>
          </div>

          {profile.plan === 'pro' && (() => {
            // Calcul du compteur mensuel effectif (reset à la volée si nouveau mois)
            const startedAt = profile.ai_generations_month_started_at
              ? new Date(profile.ai_generations_month_started_at)
              : null
            const now = new Date()
            const inSameMonth = !!startedAt
              && startedAt.getUTCFullYear() === now.getUTCFullYear()
              && startedAt.getUTCMonth() === now.getUTCMonth()
            const monthCount = inSameMonth ? (profile.ai_generations_month_count ?? 0) : 0
            // On affiche la barre seulement si l'user s'approche du cap (>50%)
            // pour éviter de stresser inutilement les users normaux.
            const showMonthlyCap = monthCount > PREMIUM_MONTHLY_AI_CAP * 0.5
            return (
              <>
                {showMonthlyCap && (
                  <div className="set-row">
                    <label className="set-label">Usage IA ce mois-ci</label>
                    <div className="set-quotas">
                      <QuotaBar
                        label="Générations QCM IA"
                        used={monthCount}
                        limit={PREMIUM_MONTHLY_AI_CAP}
                      />
                    </div>
                    <p className="set-hint">
                      Le compteur se reset le 1er du mois prochain. Cette
                      limite haute protège l&apos;infrastructure des usages
                      excessifs — tu ne devrais jamais l&apos;atteindre en
                      utilisation normale.
                    </p>
                  </div>
                )}
                {/* Gestion d'abonnement : on ne montre le bouton "Gérer mon
                    abonnement" QUE si l'user a un stripe_customer_id (= a payé
                    via Stripe). Sinon (Premium offert manuellement via DB),
                    le bouton est inutile et le portail Stripe répondrait avec
                    une erreur. On affiche une note explicative à la place. */}
                {profile.stripe_customer_id ? (
                  <div className="set-row">
                    <label className="set-label">Gestion de l&apos;abonnement</label>
                    <p className="set-hint">
                      Mets à jour ta carte, télécharge tes factures ou résilie ton
                      abonnement. Tu seras redirigé vers le portail sécurisé de Stripe.
                    </p>
                    {portalError && (
                      <div className="set-msg err" style={{ marginTop: 8 }}>{portalError}</div>
                    )}
                    <div className="set-actions">
                      <button
                        className="set-btn ghost"
                        onClick={openCustomerPortal}
                        disabled={portalLoading}
                      >
                        {portalLoading ? 'Ouverture…' : 'Gérer mon abonnement →'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="set-row">
                    <label className="set-label">Accès Premium</label>
                    <p className="set-hint">
                      Tu bénéficies d&apos;un accès Premium offert. Il n&apos;y a
                      pas d&apos;abonnement à gérer côté facturation. Pour toute
                      question sur ton compte, écris à{' '}
                      <a href="mailto:loubonnefoypc@gmail.com">loubonnefoypc@gmail.com</a>.
                    </p>
                  </div>
                )}
              </>
            )
          })()}

          {profile.plan !== 'pro' && (
            <div className="set-row">
              <label className="set-label">Quotas Gratuit</label>
              <div className="set-quotas">
                <QuotaBar
                  label="Générations QCM IA"
                  used={profile.ai_generations_count ?? 0}
                  limit={FREE_AI_GENERATIONS_LIMIT}
                />
                <QuotaBar
                  label="Sessions simulateur"
                  used={profile.simulator_sessions_count ?? 0}
                  limit={FREE_SIMULATOR_SESSIONS_LIMIT}
                />
              </div>
              <p className="set-hint">
                En Premium, tous les quotas sont illimités. Les vidéos
                jusqu&apos;à 250 Mo et les PDF sans limite de taille seront
                débloqués. <Link href="/dashboard/pricing" className="set-plan-inline-link">Voir les formules</Link>.
              </p>
            </div>
          )}
        </section>

        {/* MOT DE PASSE */}
        <section className="set-card">
          <div className="set-card-h">Mot de passe</div>

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
        </section>

        {/* APPARENCE */}
        <section className="set-card">
          <div className="set-card-h">Apparence</div>

          <div className="set-row">
            <label className="set-label">Thème</label>
            <p className="set-hint">
              Choisis le mode clair pour le confort en journée, ou le mode
              sombre pour les sessions de révision tardives.
            </p>
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
        </section>

        {/* AIDE */}
        <section className="set-card">
          <div className="set-card-h">Aide</div>

          <div className="set-row">
            <label className="set-label">Tutoriel d&apos;introduction</label>
            <p className="set-hint">
              Revoir le tour guidé qui présente la courbe J, le système de notation
              et la création de tes premières fiches.
            </p>
          </div>

          <div className="set-actions">
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

        {/* DÉCONNEXION */}
        <section className="set-card set-card-danger">
          <div className="set-card-h">Session</div>
          <p className="set-hint">Tu peux te déconnecter sans risque : tes données restent en place et tu pourras te reconnecter à tout moment.</p>
          <div className="set-actions">
            <button className="set-btn ghost-rose" onClick={logout}>
              Se déconnecter
            </button>
          </div>
        </section>

        {/* SUPPRIMER MON COMPTE — droit à l'effacement RGPD */}
        <section className="set-card set-card-danger">
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
// QuotaBar — barre de progression compacte pour les compteurs Free
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
