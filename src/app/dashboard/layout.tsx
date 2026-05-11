'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import OnboardingTour from '@/components/OnboardingTour'

const NAV = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '⌂', exact: true },
  { href: '/dashboard/calendar', label: 'Calendrier', icon: '▦' },
  { href: '/dashboard/fiches', label: 'Mes matières', icon: '▤' },
  { href: '/dashboard/simulateur', label: 'Simulateur', icon: '▶' },
  { href: '/dashboard/stats', label: 'Statistiques', icon: '◈' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [semester, setSemester] = useState<1 | 2 | 'year'>(2)

  // Onboarding state — overlay tour piloté depuis Settings (event 'medrev-onboarding-replay')
  // ou auto-déclenché au 1er login (onboarded_at null).
  const [tourOpen, setTourOpen] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [isReplay, setIsReplay] = useState(false)
  const [existingLessonCount, setExistingLessonCount] = useState(0)

  // Load persisted semester on mount
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
      // Charge en parallèle profile + count des lessons (toujours, pour que
      // le tour ait la bonne valeur même au replay).
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

          // Auto-open du tour : 1er login (onboarded_at null) OU étape déjà
          // commencée (refresh en plein milieu du tour).
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

  // Listener pour le replay déclenché depuis Settings → "Revoir le tutoriel".
  // L'event 'medrev-onboarding-replay' est dispatché par settings/page.tsx.
  useEffect(() => {
    async function handleReplay() {
      // Refresh le count des lessons : si l'user a créé des fiches depuis
      // le 1er login, le tour ne doit pas re-forcer la création.
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

  // Onboarding callbacks : marquer onboarded_at en DB et fermer l'overlay.
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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,700;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');

        /* Scope page wrapper — pas de couleur hardcodée, tout via tokens.
           Les aliases ci-dessous permettent aux feuilles de styles scopées
           des pages enfants (.dash-, .fi-, .cal-, .qcm-, .set-, .rmod-, .srcl-,
           .ont-) de recevoir automatiquement les bonnes couleurs sans avoir
           à redéfinir leurs tokens locaux. */
        .db-shell {
          display: flex;
          min-height: 100vh;
          background: var(--bg-app);
          color: var(--text-primary);
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;

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
        }

        /* SIDEBAR */
        .db-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--sb-bg);
          color: var(--sb-text);
          display: flex;
          flex-direction: column;
          padding: 22px 0;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          border-right: 1px solid var(--sb-border);
          transition: background-color .25s ease, color .25s ease, border-color .25s ease;
        }
        .db-logo {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 20px;
          font-weight: 700;
          padding: 0 18px 14px;
          color: var(--sb-text);
        }
        .db-logo span { color: var(--sb-accent); }

        .db-sep {
          border-bottom: 1px solid var(--sb-border);
          margin: 0 12px 12px;
        }

        .db-nav-section {
          padding: 0 9px;
          margin-bottom: 20px;
        }
        .db-nav-label {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .1em;
          color: var(--sb-text-dim);
          padding: 0 9px;
          margin-bottom: 5px;
        }

        .db-nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 10px; border-radius: 7px; cursor: pointer;
          font-size: 13px; color: var(--sb-text-muted);
          margin-bottom: 1px; transition: all .15s;
          text-decoration: none;
        }
        .db-nav-item:hover { background: var(--sb-hover); color: var(--sb-text); }
        .db-nav-item.active { background: var(--sb-active); color: var(--sb-text); }
        .db-nav-item .ic { width: 16px; text-align: center; font-style: normal; font-size: 13px; }
        .db-nav-item .badge {
          margin-left: auto;
          font-size: 10px;
          font-weight: 700;
          background: var(--sb-accent);
          color: white;
          border-radius: 20px;
          padding: 1px 7px;
        }

        /* SEMESTER TOGGLE */
        .db-sem {
          margin: 0 12px 16px;
          background: var(--sb-hover);
          border-radius: 8px;
          padding: 3px;
          display: flex;
          gap: 2px;
        }
        .db-sem button {
          flex: 1;
          padding: 6px 8px;
          border: none;
          background: transparent;
          color: var(--sb-text-muted);
          font-size: 11.5px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: .02em;
          transition: all .15s;
        }
        .db-sem button:hover { color: var(--sb-text); }
        .db-sem button.active {
          background: var(--sb-accent);
          color: white;
        }

        /* USER CARD (en bas) */
        .db-user-wrap {
          margin-top: auto;
          padding: 14px 9px 0;
          border-top: 1px solid var(--sb-border);
        }
        .db-user-card {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px;
          border-radius: 9px;
          background: var(--sb-hover);
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          transition: background .15s;
        }
        .db-user-card:hover { background: var(--sb-active); }
        .db-user-avatar {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: var(--sb-accent);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: white;
          min-width: 30px;
        }
        .db-user-name {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--sb-text);
        }
        .db-user-meta {
          font-size: 10.5px;
          color: var(--sb-text-dim);
        }
        .db-user-chev {
          margin-left: auto;
          color: var(--sb-text-dim);
          font-size: 14px;
        }

        /* MAIN content */
        .db-main {
          flex: 1;
          overflow-y: auto;
          background: var(--bg-app);
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="db-sidebar" data-tour="sidebar">
        {/* Logo */}
        <div className="db-logo">
          Med<span>·Rev</span>
        </div>

        {/* Semester toggle */}
        <div className="db-sem" data-tour="sem-toggle">
          <button
            className={semester === 1 ? 'active' : ''}
            onClick={() => chooseSemester(1)}
          >
            S1
          </button>
          <button
            className={semester === 2 ? 'active' : ''}
            onClick={() => chooseSemester(2)}
          >
            S2
          </button>
          <button
            className={semester === 'year' ? 'active' : ''}
            onClick={() => chooseSemester('year')}
            title="Vue année (toutes matières S1 + S2)"
          >
            Année
          </button>
        </div>

        {/* Separator */}
        <div className="db-sep" />

        {/* Navigation */}
        <div className="db-nav-section">
          <div className="db-nav-label">Navigation</div>

          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`db-nav-item${isActive(n.href, n.exact) ? ' active' : ''}`}
              data-tour={`nav-${n.href.split('/').pop() || 'dashboard'}`}
            >
              <i className="ic">{n.icon}</i>
              {n.label}
              {n.href === '/dashboard/calendar' && todayCount > 0 && (
                <span className="badge">{todayCount}</span>
              )}
            </Link>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User card → redirige vers Settings */}
        <div className="db-user-wrap">
          <Link
            href="/dashboard/settings"
            className="db-user-card"
            title="Paramètres"
          >
            <div className="db-user-avatar">{initials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="db-user-name">{profile?.name || '...'}</div>
              <div className="db-user-meta">
                {profile?.plan === 'pro' ? 'Premium' : 'Gratuit'}
                {profile?.fac ? ` · ${profile.fac}` : ''}
              </div>
            </div>
            <span className="db-user-chev">›</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="db-main" data-tour="page-main">
        {children}
      </main>

      {/* ONBOARDING TOUR — overlay full-screen piloté par Settings ou 1er login */}
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
