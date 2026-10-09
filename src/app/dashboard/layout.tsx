'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { toDateStr, todayStr } from '@/types'
import { normalizeYear, yearLabel } from '@/lib/year'
import { makeScheduleResolver } from '@/lib/schedule'
import OnboardingTour from '@/components/OnboardingTour'
import { currentSemestre } from '@/lib/semestre'
import './layout.css'

// Breakpoint mobile (en dessous : sidebar slide-in avec burger).

type SystemRow = { id: string; year?: string; semestre?: number; schedule?: number[] | null }

// "Déjà noté" au sens du calendrier : seul un score officiel compte. Un
// temp_score posé via "retravailler plus tard" laisse le palier à faire.
function hasOfficialScore(step: unknown): boolean {
  if (!step || typeof step !== 'object') return false
  const sc = (step as { score?: number }).score
  if (typeof sc === 'number' && sc >= 1 && sc <= 5) return true
  return typeof (step as { ok?: boolean }).ok === 'boolean'
}

const NAV = [
  { href: '/dashboard', label: "Aujourd'hui", exact: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 11l9-8 9 8M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ) },
  { href: '/dashboard/fiches', label: 'Fiches', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16" strokeLinecap="round"/></svg>
  ) },
  { href: '/dashboard/calendar', label: 'Calendrier', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4" strokeLinecap="round"/></svg>
  ) },
  { href: '/dashboard/stats', label: 'Statistiques', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round"/></svg>
  ) },
  { href: '/dashboard/simulateur', label: 'Simulateur', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>
  ) },
]

const FAC_NAMES: Record<string, string> = {
  'sorbonne': 'Sorbonne',
  'paris-cite': 'Paris Cité',
  'sorbonne-paris-nord': 'Paris 13',
  'upec': 'UPEC',
  'lyon': 'Lyon',
  'montpellier': 'Montpellier',
  'autre': 'Autre',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // MENU DE COMPTE
  // Avant, la carte utilisateur était un simple lien vers Réglages, et tout
  // (études, mot de passe, tutoriel, suppression de compte) se retrouvait
  // empilé derrière une seule porte. On ouvre maintenant un menu, comme dans
  // une app bancaire : chaque intention a son entrée, et chaque entrée mène
  // à la rubrique qui porte le même nom.
  const [menuOuvert, setMenuOuvert] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOuvert) return
    function dehors(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOuvert(false)
    }
    function echap(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', echap)
    }
  }, [menuOuvert])

  // Si on est déjà sur Réglages, Next ne remonte pas la page : on prévient
  // l'écran par un évènement plutôt que de compter sur un remontage.
  function allerReglages(section: string) {
    setMenuOuvert(false)
    if (pathname === '/dashboard/settings') {
      window.dispatchEvent(new CustomEvent('medrev-settings-tab', { detail: section }))
    } else {
      router.push(`/dashboard/settings?s=${section}`)
    }
  }

  async function seDeconnecter() {
    setMenuOuvert(false)
    await supabase.auth.signOut()
    router.push('/')
  }
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [semester, setSemester] = useState<1 | 2 | 'year'>(currentSemestre)

  const [tourOpen, setTourOpen] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [isReplay, setIsReplay] = useState(false)
  const [existingLessonCount, setExistingLessonCount] = useState(0)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    const s: 1 | 2 | 'year' = raw === '1' ? 1 : raw === '2' ? 2 : raw === 'year' ? 'year' : currentSemestre()
    setSemester(s)
  }, [])

  function chooseSemester(s: 1 | 2 | 'year') {
    setSemester(s)
    if (typeof window !== 'undefined') {
      localStorage.setItem('medrev-sem', String(s))
      window.dispatchEvent(new CustomEvent('medrev-sem-change', { detail: s }))
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]).then(([profileRes, lessonsRes]) => {
        const data = profileRes.data
        setExistingLessonCount(lessonsRes.count || 0)
        if (data) {
          const displayName =
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            data.name ||
            user.email?.split('@')[0] ||
            '...'
          setProfile({ ...data, name: displayName })

          const lsStep = typeof window !== 'undefined'
            ? localStorage.getItem('medrev-onboarding-step')
            : null
          if (!data.onboarded_at || lsStep) {
            setTourOpen(true)
          }
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function handleReplay() {
      if (profile) {
        const { count } = await supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
        setExistingLessonCount(count || 0)
      }
      setReplayKey(k => k + 1)
      setIsReplay(true)
      setTourOpen(true)
    }
    window.addEventListener('medrev-onboarding-replay', handleReplay)
    return () => window.removeEventListener('medrev-onboarding-replay', handleReplay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function markOnboarded() {
    if (!profile) return
    await supabase.from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', profile.id)
    setProfile({ ...profile, onboarded_at: new Date().toISOString() } as Profile)
  }
  async function handleTourComplete() {
    await markOnboarded()
    setTourOpen(false)
  }
  async function handleTourSkip() {
    await markOnboarded()
    setTourOpen(false)
  }

  // Changement d'année depuis les Réglages : on met à jour le profil en mémoire,
  // ce qui rafraîchit le libellé de la carte utilisateur et relance le calcul du
  // badge, sans attendre un rechargement de page.
  useEffect(() => {
    function onYearChange(e: Event) {
      const next = (e as CustomEvent<string>).detail
      if (typeof next !== 'string') return
      setProfile(p => (p ? ({ ...p, current_year: next } as Profile) : p))
    }
    window.addEventListener('medrev-year-change', onYearChange)
    return () => window.removeEventListener('medrev-year-change', onYearChange)
  }, [])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    const today = todayStr()
    // Le badge ne compte que l'année d'études en cours. Sinon une fiche de P1
    // dont un palier tombe aujourd'hui viendrait gonfler le compteur d'un
    // étudiant passé en P2.
    const year = normalizeYear(profile.current_year)
    ;(async () => {
      const [{ data: sys }, { data }] = await Promise.all([
        supabase.from('systems').select('id, year, semestre, schedule').eq('user_id', profile.id),
        supabase.from('lessons')
          .select('learn_date, steps, skips, postpones, system_id')
          .eq('user_id', profile.id),
      ])
      if (cancelled || !data) return
      // Ce badge est posé sur l'onglet Calendrier : il doit compter exactement
      // ce que le calendrier affiche. Mêmes paliers par matière, mêmes paliers
      // annulés, mêmes reports, même définition de "déjà noté", même semestre.
      // Un badge qui annonce 3 quand la page en montre 0 use la confiance plus
      // vite que n'importe quel bug visible.
      const yearSystems = ((sys as SystemRow[] | null) ?? [])
        .filter(s => normalizeYear(s.year) === year)
        .filter(s => semester === 'year' || s.semestre === semester)
      const ids = new Set(yearSystems.map(s => s.id))
      const scheduleFor = makeScheduleResolver(yearSystems)
      let cnt = 0
      data.forEach(l => {
        if (!l.learn_date) return
        const sid = l.system_id as string
        if (!ids.has(sid)) return
        const steps = (l.steps as unknown[]) || []
        const skips = Array.isArray(l.skips) ? (l.skips as number[]) : []
        const postpones = (l.postpones && typeof l.postpones === 'object')
          ? (l.postpones as Record<string, string>)
          : {}
        scheduleFor(sid).forEach((off, i) => {
          if (skips.includes(i)) return              // palier annulé
          if (hasOfficialScore(steps[i])) return     // déjà noté ce jour J
          const d = new Date(l.learn_date + 'T12:00:00')
          d.setDate(d.getDate() + off)
          // Un palier reporté est dû à sa nouvelle date, pas à la date théorique.
          const due = postpones[String(i)] ?? toDateStr(d)
          if (due === today) cnt++
        })
      })
      setTodayCount(cnt)
    })()
    return () => { cancelled = true }
  }, [profile, semester, supabase])

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = profile?.name?.slice(0, 2).toUpperCase() || '?'

  return (
    <div className="db-shell">

      {/* MOBILE — bouton burger + overlay */}
      <button
        type="button"
        className="db-burger"
        onClick={() => setMobileNavOpen(o => !o)}
        aria-label={mobileNavOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {mobileNavOpen ? '✕' : '☰'}
      </button>
      <div
        className={`db-sidebar-overlay${mobileNavOpen ? ' open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      {/* SIDEBAR */}
      <aside className={`db-sidebar${mobileNavOpen ? ' open' : ''}${menuOuvert ? ' menu-open' : ''}`} data-tour="sidebar">
        {/* Logo */}
        <div className="db-logo">
          <span className="db-logo-m">M</span><span className="db-lbl">ed<span className="db-logo-r">·Rev</span></span>
        </div>

        {/* Semester toggle */}
        <div className="db-sem" data-tour="sem-toggle">
          <button className={semester === 1 ? 'active' : ''} onClick={() => chooseSemester(1)}>S1</button>
          <button className={semester === 2 ? 'active' : ''} onClick={() => chooseSemester(2)}>S2</button>
          <button className={semester === 'year' ? 'active' : ''} onClick={() => chooseSemester('year')} title="Vue année (toutes matières S1 + S2)">Année</button>
        </div>

        <div className="db-sep" />

        {/* Navigation */}
        <div className="db-nav-section">
          <div className="db-nav-label db-lbl">Navigation</div>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`db-nav-item${isActive(n.href, n.exact) ? ' active' : ''}`}
              data-tour={`nav-${n.href.split('/').pop() || 'dashboard'}`}
            >
              <span className="ic">{n.icon}</span>
              <span className="db-lbl">{n.label}</span>
              {n.href === '/dashboard/calendar' && todayCount > 0 && (
                <span className="badge">{todayCount}</span>
              )}
            </Link>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* La section « Réglages / Aide / Donner mon avis » qui se trouvait ici a
            été retirée : le menu de compte, ouvert depuis l'avatar juste en
            dessous, couvre exactement les mêmes destinations. Deux chemins vers
            le même endroit, à dix pixels d'écart, c'est ce qui donnait
            l'impression de fouillis. */}

        {/* Carte utilisateur → menu de compte */}
        <div className="db-user-wrap" ref={menuRef}>
          {/* DEUX ENTRÉES, PAS SIX.
              Aide, Sécurité et Nous contacter étaient ici ET dans la page
              Réglages, qui les liste déjà avec cinq autres rubriques. Deux
              listes du même contenu à deux endroits, c'est le fouillis qu'on
              essayait de retirer. La page est la carte complète ; le menu ne
              garde que la porte d'entrée et la seule action qui n'a pas sa
              place dans une liste de réglages. */}
          {menuOuvert && (
            <div className="db-usermenu" role="menu" aria-label="Menu du compte">
              <button type="button" role="menuitem" className="db-usermenu-item" onClick={() => allerReglages('reglages')}>
                <span className="db-usermenu-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </span>
                <span><strong>Réglages</strong></span>
              </button>
              <div className="db-usermenu-sep" />
              <button type="button" role="menuitem" className="db-usermenu-item danger" onClick={seDeconnecter}>
                <span className="db-usermenu-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
                </span>
                <span><strong>Se déconnecter</strong></span>
              </button>
            </div>
          )}
          <button
            type="button"
            className="db-user-card"
            onClick={() => setMenuOuvert(v => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOuvert}
            title="Mon compte"
          >
            <div className="db-user-avatar">{initials}</div>
            <div className="db-lbl" style={{ minWidth: 0, flex: 1 }}>
              <div className="db-user-name">{profile?.name || '...'}</div>
              <div className="db-user-meta">
                {profile?.current_year ? `${yearLabel(profile.current_year)} · ` : ''}
                {profile ? (profile.plan === 'pro' ? 'Premium' : 'Gratuit') : ''}
                {profile?.fac ? ` · ${FAC_NAMES[profile.fac] || profile.fac}` : ''}
              </div>
            </div>
            <span className="db-user-chev db-lbl">{menuOuvert ? '⌄' : '›'}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="db-main" data-tour="page-main">
        {children}
      </main>

      {/* ONBOARDING TOUR */}
      {tourOpen && profile && (
        <OnboardingTour
          key={replayKey}
          userId={profile.id}
          userName={profile.name || ''}
          isReplay={isReplay}
          existingLessonCount={existingLessonCount}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </div>
  )
}
