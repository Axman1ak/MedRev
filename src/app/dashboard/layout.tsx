'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import OnboardingTour from '@/components/OnboardingTour'

// Breakpoint mobile (en dessous : sidebar slide-in avec burger).
const MOBILE_BREAKPOINT = 768

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
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [semester, setSemester] = useState<1 | 2 | 'year'>(2)

  const [tourOpen, setTourOpen] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [isReplay, setIsReplay] = useState(false)
  const [existingLessonCount, setExistingLessonCount] = useState(0)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    const s: 1 | 2 | 'year' = raw === '1' ? 1 : raw === 'year' ? 'year' : 2
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

  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('lessons').select('learn_date, steps').eq('user_id', profile.id)
      .then(({ data }) => {
        if (!data) return
        let cnt = 0
        const J = [0,1,3,5,7,15,21,30,45,60,75,90,105,120]
        data.forEach(l => {
          if (!l.learn_date) return
          const steps = l.steps as (null|object)[]
          J.forEach((off, i) => {
            const d = new Date(l.learn_date + 'T12:00:00')
            d.setDate(d.getDate() + off)
            if (d.toISOString().split('T')[0] === today && !steps[i]) cnt++
          })
        })
        setTodayCount(cnt)
      })
  }, [profile])

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = profile?.name?.slice(0, 2).toUpperCase() || '?'

  return (
    <div className="db-shell">
      <style>{`
        .db-shell {
          display: flex;
          min-height: 100vh;
          background: var(--bg-app);
          color: var(--text-primary);
          font-family: var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif;

          /* Aliases legacy → tokens globaux du design system */
          --bg: var(--bg-app);
          --card: var(--bg-card);
          --soft: var(--bg-soft);
          --dark: var(--text-primary);
          --gray: var(--text-secondary);
          --dim: var(--text-tertiary);
          --border: var(--border-subtle);
          --green: var(--accent-primary);
          --gm: var(--accent-medium);
          --gl: var(--accent-soft);
          --amber: var(--warning);
          --amber-soft: var(--warning-soft);
          --rose: var(--danger);
          --rose-soft: var(--danger-soft);
          --cream: var(--bg-soft);
          --al: var(--warning-soft);

          /* Couleurs propres à la sidebar marine (indépendantes du thème) */
          --rail: #15304E;
          --rail-2: #22507E;
          --rail-accent: #7FB0D4;
        }

        /* ===================== SIDEBAR MARINE RÉTRACTABLE ===================== */
        .db-sidebar {
          position: fixed;
          left: 0; top: 0;
          height: 100vh;
          width: 76px;
          flex-shrink: 0;
          background: var(--rail);
          color: #fff;
          display: flex;
          flex-direction: column;
          padding: 20px 0;
          overflow: hidden;
          z-index: 40;
          transition: width .24s cubic-bezier(.4,0,.2,1), box-shadow .24s ease;
        }
        .db-sidebar:hover { width: 248px; box-shadow: 22px 0 60px rgba(0,0,0,.30); }

        /* libellés qui apparaissent au survol */
        .db-lbl { opacity: 0; transition: opacity .15s ease; white-space: nowrap; }
        .db-sidebar:hover .db-lbl { opacity: 1; }

        .db-logo {
          display: flex; align-items: center;
          font-family: var(--font-bricolage), 'Bricolage Grotesque', system-ui, sans-serif;
          font-size: 22px; font-weight: 700; letter-spacing: -.01em;
          padding: 0 0 22px 26px; color: #fff; white-space: nowrap;
        }
        .db-logo .db-logo-r { color: var(--rail-accent); }

        .db-sep { border-bottom: 1px solid rgba(255,255,255,.10); margin: 0 14px 14px; }

        .db-nav-section { padding: 0; margin-bottom: 16px; }
        .db-nav-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .12em; color: rgba(255,255,255,.42);
          padding: 0 26px; margin-bottom: 6px;
        }

        .db-nav-item {
          position: relative;
          display: flex; align-items: center; gap: 16px;
          height: 46px; padding: 0 18px 0 26px;
          color: rgba(255,255,255,.64); cursor: pointer;
          font-size: 14.5px; font-weight: 500;
          text-decoration: none; white-space: nowrap;
          transition: color .15s, background .15s;
        }
        .db-nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
        .db-nav-item.active { color: #fff; }
        .db-nav-item.active::before {
          content: ''; position: absolute; left: 0; top: 0;
          width: 3px; height: 46px; background: var(--rail-accent);
          border-radius: 0 2px 2px 0;
        }
        .db-nav-item .ic {
          width: 22px; height: 22px; min-width: 22px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .db-nav-item .ic svg { width: 21px; height: 21px; stroke-width: 1.7; }
        .db-nav-item .badge {
          margin-left: auto; font-size: 10px; font-weight: 700;
          background: var(--rail-accent); color: var(--rail);
          border-radius: 20px; padding: 1px 7px;
        }

        /* SEMESTER TOGGLE — masqué quand la sidebar est repliée */
        .db-sem {
          margin: 0 14px 16px;
          background: rgba(255,255,255,.08);
          border-radius: 8px; padding: 3px;
          display: flex; gap: 2px;
          opacity: 0; max-height: 0; overflow: hidden;
          transition: opacity .18s ease, max-height .22s ease, margin .22s ease;
        }
        .db-sidebar:hover .db-sem { opacity: 1; max-height: 60px; }
        .db-sem button {
          flex: 1; padding: 6px 8px; border: none; background: transparent;
          color: rgba(255,255,255,.70); font-size: 11.5px; font-weight: 600;
          border-radius: 6px; cursor: pointer; font-family: inherit;
          letter-spacing: .02em; transition: all .15s; white-space: nowrap;
        }
        .db-sem button:hover { color: #fff; }
        .db-sem button.active { background: var(--rail-2); color: #fff; }

        .db-nav-secondary { margin-bottom: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.10); }
        .db-nav-item-btn { width: 100%; border: none; background: transparent; font-family: inherit; cursor: pointer; text-align: left; }

        /* USER CARD */
        .db-user-wrap { margin-top: auto; padding: 12px 14px 0; border-top: 1px solid rgba(255,255,255,.10); }
        .db-user-card {
          display: flex; align-items: center; gap: 12px;
          padding: 9px; border-radius: 10px; background: rgba(255,255,255,.06);
          cursor: pointer; text-decoration: none; color: inherit; transition: background .15s;
        }
        .db-user-card:hover { background: rgba(255,255,255,.10); }
        .db-user-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--rail-2); display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #fff; min-width: 32px;
        }
        .db-user-name { font-size: 13px; font-weight: 600; color: #fff; }
        .db-user-meta { font-size: 11px; color: rgba(255,255,255,.55); }
        .db-user-chev { margin-left: auto; color: rgba(255,255,255,.45); font-size: 16px; }

        /* MAIN */
        .db-main {
          flex: 1;
          margin-left: 76px;
          min-height: 100vh;
          overflow-y: auto;
          background: var(--bg-app);
        }

        /* ================ MOBILE BURGER + OVERLAY ================ */
        .db-burger {
          display: none; position: fixed; top: 14px; left: 14px; z-index: 200;
          width: 40px; height: 40px; background: var(--bg-card);
          border: 1px solid var(--border-subtle); border-radius: 8px; cursor: pointer;
          padding: 0; font-size: 18px; color: var(--text-primary);
          box-shadow: 0 2px 6px rgba(0,0,0,.06);
        }
        .db-sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(10,16,26,.5); z-index: 90; }

        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          .db-sidebar {
            position: fixed; top: 0; left: 0; width: 264px; max-width: 82vw; height: 100vh;
            transform: translateX(-100%); transition: transform .25s ease;
            z-index: 100; box-shadow: 4px 0 20px rgba(0,0,0,.18);
          }
          .db-sidebar:hover { width: 264px; box-shadow: 4px 0 20px rgba(0,0,0,.18); }
          .db-sidebar.open { transform: translateX(0); }
          /* en mobile la sidebar est pleine : on montre tout */
          .db-sidebar .db-lbl, .db-sidebar .db-nav-label { opacity: 1; }
          .db-sidebar .db-sem { opacity: 1; max-height: 60px; }

          .db-main { margin-left: 0; width: 100%; padding-top: 50px; }
          .db-burger { display: flex; align-items: center; justify-content: center; }
          .db-sidebar-overlay.open { display: block; }
        }
      `}</style>

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
      <aside className={`db-sidebar${mobileNavOpen ? ' open' : ''}`} data-tour="sidebar">
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

        {/* Réglages + Aide & tutoriel */}
        <div className="db-nav-section db-nav-secondary">
          <Link
            href="/dashboard/settings"
            className={`db-nav-item${isActive('/dashboard/settings') ? ' active' : ''}`}
            data-tour="nav-settings"
          >
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
            <span className="db-lbl">Réglages</span>
          </Link>
          <button
            type="button"
            className="db-nav-item db-nav-item-btn"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('medrev-onboarding-step')
                localStorage.removeItem('medrev-onboarding-phase')
                window.dispatchEvent(new Event('medrev-onboarding-replay'))
              }
            }}
            aria-label="Rejouer le tutoriel"
          >
            <i className="ic">?</i>
            <span className="db-lbl">Aide &amp; tutoriel</span>
          </button>
          <a
            href="mailto:medrev.fr@gmail.com?subject=Retour%20MedRev&body=Mon%20retour%20(bug%2C%20id%C3%A9e%2C%20question)%20%3A%0A%0A"
            className="db-nav-item"
          >
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg></span>
            <span className="db-lbl">Donner mon avis</span>
          </a>
        </div>

        {/* User card → Settings */}
        <div className="db-user-wrap">
          <Link href="/dashboard/settings" className="db-user-card" title="Paramètres">
            <div className="db-user-avatar">{initials}</div>
            <div className="db-lbl" style={{ minWidth: 0, flex: 1 }}>
              <div className="db-user-name">{profile?.name || '...'}</div>
              <div className="db-user-meta">
                {profile?.plan === 'pro' ? 'Premium' : 'Gratuit'}
                {profile?.fac ? ` · ${FAC_NAMES[profile.fac] || profile.fac}` : ''}
              </div>
            </div>
            <span className="db-user-chev db-lbl">›</span>
          </Link>
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
