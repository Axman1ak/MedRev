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
  { href: '/dashboard/settings', label: 'Paramètres', icon: '⚙' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [todayCount, setTodayCount] = useState(0)
  const [semester, setSemester] = useState<1 | 2 | 'year'>(2)

  // Onboarding state
  // - tourOpen : tour activement affiché
  // - replayKey : sert à remonter le composant (force restart) lors d'un replay
  // - isReplay : true si l'user a déclenché le replay depuis Paramètres ;
  //              dans ce cas, les étapes wait-action passent en walkthrough
  //              (pas de polling, bouton Suivant explicite).
  const [tourOpen, setTourOpen] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [isReplay, setIsReplay] = useState(false)

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
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            const displayName =
              user.user_metadata?.username ||
              user.user_metadata?.name ||
              data.name ||
              user.email?.split('@')[0] ||
              '...'
            const enrichedProfile = { ...data, name: displayName } as Profile
            setProfile(enrichedProfile)

            // Trigger onboarding au 1er login (onboarded_at null)
            // OU si une étape est déjà commencée et qu'on a refresh
            // (récupération via localStorage côté composant)
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

  // Listen for replay events triggered from Settings
  useEffect(() => {
    function handleReplay() {
      setReplayKey(k => k + 1)
      setIsReplay(true)
      setTourOpen(true)
    }
    window.addEventListener('medrev-onboarding-replay', handleReplay)
    return () => window.removeEventListener('medrev-onboarding-replay', handleReplay)
  }, [])

  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('lessons').select('learn_date, steps').eq('user_id', profile.id)
      .then(({ data }) => {
        if (!data) return
        let cnt = 0
        const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
        data.forEach(l => {
          if (!l.learn_date) return
          const steps = l.steps as (null | object)[]
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

  // ---------- Onboarding callbacks ----------
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

  const initials = profile?.name?.slice(0, 2).toUpperCase() || '?'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#EDEAE3', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,700;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@1,400;1,500&display=swap');
        .db-nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 10px; border-radius: 7px; cursor: pointer;
          font-size: 13px; color: rgba(255,255,255,.52);
          margin-bottom: 1px; transition: all .15s;
          text-decoration: none;
        }
        .db-nav-item:hover { background: rgba(255,255,255,.08); color: white; }
        .db-nav-item.active { background: rgba(255,255,255,.08); color: white; }
        .db-nav-item .ic { width: 16px; text-align: center; font-style: normal; font-size: 13px; }
        .db-nav-item .badge { margin-left: auto; font-size: 10px; font-weight: 700; background: #2D6A4F; color: white; border-radius: 20px; padding: 1px 7px; }
        .db-sem {
          margin: 0 12px 16px;
          background: rgba(255,255,255,.04);
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
          color: rgba(255,255,255,.45);
          font-size: 11.5px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: .02em;
          transition: all .15s;
        }
        .db-sem button:hover { color: rgba(255,255,255,.8); }
        .db-sem button.active {
          background: #2D6A4F;
          color: white;
        }
      `}</style>

      {/* SIDEBAR */}
      <aside
        data-tour="sidebar"
        style={{
          width: 220, flexShrink: 0,
          background: '#111310',
          display: 'flex', flexDirection: 'column',
          padding: '22px 0',
          position: 'sticky', top: 0, height: '100vh',
          overflowY: 'auto'
        }}
      >
        {/* Logo */}
        <div style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 20, fontWeight: 700,
          padding: '0 18px 14px',
          color: 'white'
        }}>
          Med<span style={{ color: '#2D6A4F' }}>Rev</span>
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
        <div style={{ borderBottom: '1px solid rgba(255,255,255,.07)', margin: '0 12px 12px' }} />

        {/* Navigation */}
        <div style={{ padding: '0 9px', marginBottom: 20 }}>
          <div style={{
            fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.1em', color: 'rgba(255,255,255,.27)',
            padding: '0 9px', marginBottom: 5
          }}>Navigation</div>

          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              data-tour={n.href === '/dashboard' ? 'nav-dashboard' : undefined}
              className={`db-nav-item${isActive(n.href, n.exact) ? ' active' : ''}`}
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

        {/* User card — clic → Paramètres (logout y est accessible) */}
        <div style={{
          marginTop: 'auto', padding: '14px 9px 0',
          borderTop: '1px solid rgba(255,255,255,.07)'
        }}>
          <Link
            href="/dashboard/settings"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: 9, borderRadius: 9,
              background: 'rgba(255,255,255,.05)',
              cursor: 'pointer',
              position: 'relative',
              textDecoration: 'none',
              transition: 'background .15s'
            }}
            title="Voir les paramètres"
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.09)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.05)' }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#2D6A4F',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white', minWidth: 30
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.name || '...'}
              </div>
              <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,.35)' }}>
                {profile?.plan === 'pro' ? 'Premium' : 'Gratuit'}
                {profile?.fac ? ` · ${profile.fac}` : ''}
              </div>
            </div>
            <span style={{
              fontSize: 14,
              color: 'rgba(255,255,255,.35)',
              marginLeft: 'auto',
              flexShrink: 0
            }}>{'›'}</span>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main data-tour="page-main" style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>

      {/* ONBOARDING TOUR — overlay full-screen */}
      {tourOpen && profile && (
        <OnboardingTour
          key={replayKey}
          userId={profile.id}
          userName={profile.name || ''}
          isReplay={isReplay}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </div>
  )
}
