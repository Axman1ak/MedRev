'use client'
// src/app/dashboard/settings/page.tsx
//
// Page Réglages v2 : l'abonnement d'abord (carte héro vendeuse), puis des
// sections consolidées et expliquées : Profil, Compte (email + mot de passe +
// déconnexion), Apparence (thème + sons), Aide, et la zone de suppression.

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ScoringSystemId } from '@/types'
import { FREE_AI_GENERATIONS_LIMIT, FREE_SIMULATOR_SESSIONS_LIMIT, PREMIUM_MONTHLY_AI_CAP, SCORING_SYSTEMS } from '@/types'
import { soundsEnabled, setSoundsEnabled } from '@/lib/sounds'
import { getStoredTheme, setTheme as setStoredTheme } from '@/lib/theme'
import { YEARS, DEFAULT_YEAR, normalizeYear, yearLabel } from '@/lib/year'
import './styles.css'
import PageLoader from '@/components/PageLoader'
import { OFFRES_PAYANTES_OUVERTES, CONTACT_EMAIL } from '@/lib/offres'

// Une seule page d'accueil, puis un écran par sujet, comme un réglage Apple :
// la photo en haut, puis des listes groupées de lignes cliquables. On y entre,
// on en ressort par « Réglages » en haut à gauche. Plus d'onglets, plus de
// sous-onglets, plus de carte posée sous une autre.
type Vue =
  | 'profil' | 'securite' | 'abonnement'
  | 'annee' | 'bareme'
  | 'apparence' | 'aide' | 'contact'

// Le titre affiché en haut d'un écran, une fois qu'on y est entré.
const TITRES: Record<Vue, string> = {
  profil: 'Informations personnelles',
  securite: 'Connexion et sécurité',
  abonnement: 'Abonnement',
  annee: "Année d'études",
  bareme: 'Barème du simulateur',
  apparence: 'Apparence',
  aide: 'Aide et tutoriel',
  contact: 'Nous contacter',
}

// Ce que le menu de compte de la barre latérale peut demander (?s=... ou
// l'évènement medrev-settings-tab). « reglages » veut dire la page d'accueil.
const DEPUIS_MENU: Record<string, Vue | null> = {
  reglages: null,
  aide: 'aide',
  securite: 'securite',
  contact: 'contact',
  abonnement: 'abonnement',
  profil: 'profil',
}

// Icônes au trait, dessinées au même gabarit (24, trait 1.7) pour que la
// colonne de gauche soit régulière. Une pastille de couleur par famille.
const ICONES: Record<Vue, ReactNode> = {
  profil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  securite: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  abonnement: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
  ),
  annee: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
    </svg>
  ),
  bareme: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" /><path d="M5 7h14" /><path d="m5 7-3 7h6Z" /><path d="m19 7-3 7h6Z" />
    </svg>
  ),
  apparence: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  aide: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M9.2 9.2a2.8 2.8 0 1 1 3.8 2.6c-.6.3-1 .9-1 1.6v.3" /><path d="M12 17.2h.01" />
    </svg>
  ),
  contact: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="m3 7 9 6 9-6" />
    </svg>
  ),
}

/** Date lisible pour la ligne "tu es passé en P2 le ...". */
function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Accord simple. "1 matière" et non "1 matières". */
function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`
}

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

  // null = la page d'accueil (photo + listes). Sinon, l'écran ouvert.
  // Le menu de compte de la barre latérale pose ?s=securite dans l'URL : sans
  // ça, cliquer « Sécurité » dans le menu atterrirait sur l'accueil et il
  // faudrait recliquer.
  const [vue, setVue] = useState<Vue | null>(() => {
    if (typeof window === 'undefined') return null
    const s = new URLSearchParams(window.location.search).get('s')
    return (s && s in DEPUIS_MENU) ? DEPUIS_MENU[s] : null
  })

  // Le menu peut demander un autre écran alors que la page est déjà ouverte :
  // Next ne remonte pas le composant, donc on écoute l'évènement.
  useEffect(() => {
    function onJump(e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (id in DEPUIS_MENU) setVue(DEPUIS_MENU[id])
    }
    window.addEventListener('medrev-settings-tab', onJump)
    return () => window.removeEventListener('medrev-settings-tab', onJump)
  }, [])

  // On remonte en haut en entrant dans un écran : arriver au milieu d'une page
  // parce qu'on avait fait défiler l'accueil est désorientant.
  useEffect(() => { window.scrollTo({ top: 0 }) }, [vue])

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

  // Année d'études. currentYear est l'année affichée dans toute l'application ;
  // yearCounts sert à montrer que les autres années sont toujours là, ce qui est
  // la seule chose qui rend le bouton "changer d'année" rassurant à cliquer.
  const [currentYear, setCurrentYear] = useState<string>(DEFAULT_YEAR)
  const [yearCounts, setYearCounts] = useState<Record<string, { systems: number; lessons: number }>>({})
  const [switchingYear, setSwitchingYear] = useState<string | null>(null)
  const [yearMsg, setYearMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Le thème est déjà posé sur la page par le script d'amorçage du layout.
    // Ici on ne fait que refléter le choix enregistré dans les boutons.
    setTheme(getStoredTheme())
    setSounds(soundsEnabled())
    setScoringPref(localStorage.getItem('medrev-scoring') || '')
  }, [])

  function chooseTheme(t: 'light' | 'dark') {
    setTheme(t)
    // Enregistre ET applique : data-theme, les contrôles natifs et la couleur
    // des barres de Safari, tout en un (voir src/lib/theme.ts).
    setStoredTheme(t)
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

      const [{ data }, { data: sys }, { data: les }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('systems').select('id, year').eq('user_id', user.id),
        supabase.from('lessons').select('system_id').eq('user_id', user.id),
      ])
      if (cancelled) return
      if (data) {
        setProfile(data as Profile)
        setName(data.name || '')
        setUsername(data.username || '')
        setFac(data.fac || '')
        setCurrentYear(normalizeYear((data as Profile).current_year))
      }
      // Combien de matières et de fiches dorment dans chaque année.
      {
        const yearOfSystem = new Map<string, string>()
        const counts: Record<string, { systems: number; lessons: number }> = {}
        for (const s of (sys as { id: string; year?: string }[] | null) ?? []) {
          const y = normalizeYear(s.year)
          yearOfSystem.set(s.id, y)
          counts[y] = counts[y] || { systems: 0, lessons: 0 }
          counts[y].systems++
        }
        for (const l of (les as { system_id: string }[] | null) ?? []) {
          const y = yearOfSystem.get(l.system_id)
          if (!y) continue
          counts[y] = counts[y] || { systems: 0, lessons: 0 }
          counts[y].lessons++
        }
        setYearCounts(counts)
      }
      setEmail(user.email || '')
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router])

  // ------------ CHANGER D'ANNÉE ------------
  // Ne touche qu'à profiles.current_year. Aucune matière, aucune fiche, aucun
  // QCM et aucun palier n'est supprimé ni modifié : on déplace la fenêtre de
  // lecture, c'est tout. Revenir sur l'année précédente retrouve tout intact.
  async function switchYear(next: string) {
    const target = normalizeYear(next)
    if (!profile || target === currentYear || switchingYear) return
    setYearMsg(null)
    setSwitchingYear(target)
    try {
      const stamp = new Date().toISOString()
      const { error } = await supabase
        .from('profiles')
        .update({ current_year: target, year_changed_at: stamp })
        .eq('id', profile.id)
      if (error) throw error
      setCurrentYear(target)
      setProfile({ ...profile, current_year: target, year_changed_at: stamp } as Profile)
      // Le layout du dashboard ne se démonte pas entre deux pages : sans ce
      // signal, la sidebar et le badge resteraient sur l'année précédente
      // jusqu'au prochain rechargement complet.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('medrev-year-change', { detail: target }))
        // On repasse la vue sur "Année". Sinon un toggle resté sur S2 afficherait
        // "aucune matière pour le semestre 2" juste après avoir promis que tout
        // était bien là, ce qui est exactement la frayeur qu'on veut éviter.
        localStorage.setItem('medrev-sem', 'year')
        window.dispatchEvent(new CustomEvent('medrev-sem-change', { detail: 'year' }))
      }
      const has = yearCounts[target]?.systems || 0
      setYearMsg({
        kind: 'ok',
        text: has > 0
          ? `Te voilà en ${yearLabel(target)}. ${has === 1 ? 'Ta matière de cette année est de retour' : `Tes ${has} matières de cette année sont de retour`}.`
          : `Te voilà en ${yearLabel(target)}. Cette année est vide pour l'instant : crée tes matières dans Fiches. Tout le reste est conservé.`,
      })
    } catch (e: unknown) {
      setYearMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Le changement a échoué.' })
    } finally {
      setSwitchingYear(null)
    }
  }

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
        <PageLoader label="Chargement de tes réglages…" />
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

  // L'identité en haut de l'accueil. Pas de photo à téléverser pour l'instant,
  // donc les initiales, comme dans la barre latérale : c'est déjà le repère
  // visuel du compte partout ailleurs dans l'application.
  const nomAffiche = (profile.name || username || email.split('@')[0] || 'Mon compte').trim()
  const initiales = nomAffiche.slice(0, 2).toUpperCase()

  // Les listes de l'accueil. Chaque ligne porte sa valeur courante à droite :
  // on lit son réglage sans avoir à entrer dedans, ce qui évite la moitié des
  // allers-retours.
  const GROUPES: {
    titre: string
    lignes: { id: Vue; sous: string; valeur?: string; teinte: string }[]
  }[] = [
    {
      titre: 'Compte',
      lignes: [
        { id: 'profil', sous: 'Prénom, nom d’utilisateur, faculté', teinte: 'bleu' },
        { id: 'securite', sous: 'Email, mot de passe, suppression', teinte: 'gris' },
        { id: 'abonnement', sous: 'Formule et quotas', valeur: isPro ? 'Premium' : 'Gratuit', teinte: 'or' },
      ],
    },
    {
      titre: 'Mes études',
      lignes: [
        { id: 'annee', sous: 'Celle que tu révises en ce moment', valeur: yearLabel(currentYear), teinte: 'bleu' },
        {
          id: 'bareme',
          sous: 'Comment le simulateur compte les points',
          valeur: scoringPref ? SCORING_SYSTEMS[scoringPref as ScoringSystemId].label : 'Automatique',
          teinte: 'bleu',
        },
      ],
    },
    {
      titre: 'Application',
      lignes: [
        { id: 'apparence', sous: 'Thème et sons', valeur: theme === 'dark' ? 'Sombre' : 'Clair', teinte: 'violet' },
        { id: 'aide', sous: 'Revoir la prise en main', teinte: 'gris' },
        { id: 'contact', sous: 'Une question, un bug, un QCM à signaler', teinte: 'gris' },
      ],
    },
  ]

  return (
    <div className="set-page">
      <div className="set-wrap">
        {/* ============ ACCUEIL (photo + listes groupées) ============ */}
        {vue === null ? (
          <>
            <header className="set-id">
              <div className="set-id-avatar" aria-hidden="true">{initiales}</div>
              <h1 className="set-id-nom">{nomAffiche}</h1>
              <p className="set-id-mail">{email}</p>
            </header>

            {GROUPES.map(groupe => (
              <section key={groupe.titre} className="set-groupe" aria-label={groupe.titre}>
                <h2 className="set-groupe-h">{groupe.titre}</h2>
                <div className="set-liste">
                  {groupe.lignes.map(ligne => (
                    <button
                      key={ligne.id}
                      type="button"
                      className="set-ligne"
                      onClick={() => setVue(ligne.id)}
                    >
                      <span className={`set-ligne-ico ${ligne.teinte}`} aria-hidden="true">
                        {ICONES[ligne.id]}
                      </span>
                      <span className="set-ligne-txt">
                        <strong>{TITRES[ligne.id]}</strong>
                        <em>{ligne.sous}</em>
                      </span>
                      {ligne.valeur ? <span className="set-ligne-val">{ligne.valeur}</span> : null}
                      <span className="set-ligne-chev" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <button type="button" className="set-deco" onClick={logout}>
              Se déconnecter
            </button>
          </>
        ) : (
          /* En-tête d'un écran : le chemin du retour d'abord, le titre ensuite.
             C'est le seul endroit par où on ressort, donc il est toujours au
             même pixel, quelle que soit la rubrique. */
          <div className="set-head">
            <button type="button" className="set-retour" onClick={() => setVue(null)}>
              <span aria-hidden="true">‹</span> Réglages
            </button>
            <h1 className="set-h1">{TITRES[vue]}</h1>
          </div>
        )}

        {/* ============ ABONNEMENT (carte héro) ============ */}
        {vue === 'abonnement' && (
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
              {/* Tant que les offres payantes sont coupées (src/lib/offres.ts),
                  Réglages ne doit pas rester le dernier endroit du site qui
                  vend un Premium qu'on ne vend pas. Les jauges de quota, elles,
                  restent utiles : elles disent où on en est. */}
              <p className="set-abo-pitch">
                {OFFRES_PAYANTES_OUVERTES
                  ? "Le plan Gratuit te donne accès au cœur de la méthode. Premium enlève toutes les limites pour réviser sans jamais t'arrêter."
                  : "MedRev est gratuit, sans abonnement en vente et sans publicité. Tu as accès à tout : tes fiches, ton planning, tes QCM et le simulateur."}
              </p>

              {OFFRES_PAYANTES_OUVERTES && (
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
              )}

              <div className="set-abo-quotas">
                <div className="set-abo-quotas-lbl">Où tu en es sur tes quotas</div>
                <QuotaBar label="Générations QCM IA" used={aiUsed} limit={FREE_AI_GENERATIONS_LIMIT} />
                <QuotaBar label="Sessions simulateur" used={simUsed} limit={FREE_SIMULATOR_SESSIONS_LIMIT} />
              </div>

              <div className="set-abo-cta-row">
                {OFFRES_PAYANTES_OUVERTES ? (
                  <>
                    <Link href="/dashboard/pricing" className="set-abo-cta">
                      Passer à Premium →
                    </Link>
                    <span className="set-abo-cta-note">Sans engagement, résiliable en deux clics.</span>
                  </>
                ) : (
                  <span className="set-abo-cta-note">
                    Si l&apos;une de ces limites te bloque dans tes révisions, écris à{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> et on la lève sur ton compte.
                  </span>
                )}
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
                  <a href="mailto:medrev.fr@gmail.com">medrev.fr@gmail.com</a>.
                </p>
              )}
            </>
          )}
        </section>
        )}

        {/* ============ ANNÉE D'ÉTUDES ============ */}
        {vue === 'annee' && (
        <section className="set-card" id="set-annee">

          <div className="set-year-current">
            <span className="set-year-current-badge">{yearLabel(currentYear)}</span>
            <span className="set-year-current-txt">
              Année en cours
              {yearCounts[currentYear]?.systems
                ? ` · ${plural(yearCounts[currentYear].systems, 'matière')}, ${plural(yearCounts[currentYear].lessons, 'fiche')}`
                : ' · aucune matière pour l\'instant'}
              {profile?.year_changed_at && (
                <><br />Tu es passé en {yearLabel(currentYear)} le {formatDay(profile.year_changed_at)}.</>
              )}
            </span>
          </div>

          {yearMsg && <div className={`set-msg ${yearMsg.kind}`}>{yearMsg.text}</div>}

          <div className="set-year-grid">
            {YEARS.map(y => {
              const c = yearCounts[y.id]
              const on = y.id === currentYear
              return (
                <button
                  key={y.id}
                  type="button"
                  className={`set-year-opt${on ? ' on' : ''}`}
                  onClick={() => switchYear(y.id)}
                  disabled={on || switchingYear !== null}
                  aria-current={on ? 'true' : undefined}
                >
                  <span className="set-year-opt-top">
                    <strong>{y.label}</strong>
                    {on && <em className="set-year-tag">en cours</em>}
                    {!on && c?.systems ? <em className="set-year-tag saved">{plural(c.systems, 'matière')} gardée{c.systems > 1 ? 's' : ''}</em> : null}
                  </span>
                  <span>{y.hint}</span>
                  {switchingYear === y.id && <span className="set-year-loading">Changement…</span>}
                </button>
              )
            })}
          </div>

        </section>
        )}

        {/* ============ PROFIL ============ */}
        {vue === 'profil' && (
        <section className="set-card" id="set-profil">

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
        )}

        {/* ============ COMPTE (email + mot de passe + session) ============ */}
        {vue === 'securite' && (
        <section className="set-card" id="set-compte">

          <div className="set-row">
            <label className="set-label">Email de connexion</label>
            <div className="set-static">{email}</div>
            <p className="set-hint">
              Pour changer d&apos;email, écris à{' '}
              <a href="mailto:medrev.fr@gmail.com">medrev.fr@gmail.com</a>.
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
        </section>
        )}

        {/* ============ APPARENCE ============ */}
        {vue === 'apparence' && (
        <section className="set-card" id="set-apparence">

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
        )}

        {/* ============ AIDE ============ */}
        {vue === 'contact' && (
        <section className="set-card" id="set-contact">

          <div className="set-row">
            <label className="set-label">Une question, un bug, une idée</label>
            <p className="set-hint">
              Une seule adresse, lue par la personne qui développe MedRev :{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              Pour un bug, dis sur quel écran et sur quel appareil : ça fait
              gagner un aller-retour.
            </p>
          </div>

          <div className="set-row">
            <label className="set-label">Une question de QCM qui cloche</label>
            <p className="set-hint">
              C&apos;est le signalement le plus utile. Sous chaque QCM, le lien
              « Signaler cette question » envoie le motif en un clic, sans quitter
              ta session.
            </p>
          </div>

          <div className="set-row">
            <label className="set-label">Tu es au bureau d&apos;un tutorat</label>
            <p className="set-hint">
              MedRev ne produit aucun contenu de cours et ne remplace ni vos polys
              ni vos khôlles. Écris à la même adresse, on te montre l&apos;outil.
            </p>
          </div>
        </section>
        )}

        {vue === 'aide' && (
        <section className="set-card" id="set-aide">

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
        )}

        {/* ============ SUPPRIMER (RGPD) ============ */}
        {vue === 'bareme' && (
        <section className="set-card" id="set-bareme">
          <p className="set-card-sub">Par défaut, le barème standard. Change-le si ta fac en utilise un autre.</p>
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
        )}

        {vue === 'securite' && (
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
        )}

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
