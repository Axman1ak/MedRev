'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

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
  const [semester, setSemester] = useState<1 | 2>(2)

  // Load persisted semester on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    const s = raw === '1' ? 1 : 2
    setSemester(s)
  }, [])

  function chooseSemester(s: 1 | 2) {
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
            setProfile({ ...data, name: displayName })
          }
        })
    })
  }, [])

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

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = profile?.name?.slice(0, 2).toUpperCase() || '?'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#EDEAE3', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,700;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
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
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#111310',
        display: 'flex', flexDirection: 'column',
        padding: '22px 0',
        position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto'
      }}>
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
        <div className="db-sem">
          <button
            className={semester === 1 ? 'active' : ''}
            onClick={() => chooseSemester(1)}
          >
            Sem 1
          </button>
          <button
            className={semester === 2 ? 'active' : ''}
            onClick={() => chooseSemester(2)}
          >
            Sem 2
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

        {/* User card */}
        <div style={{
          marginTop: 'auto', padding: '14px 9px 0',
          borderTop: '1px solid rgba(255,255,255,.07)'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: 9, borderRadius: 9,
            background: 'rgba(255,255,255,.05)',
            cursor: 'pointer',
            position: 'relative'
          }}
            onClick={logout}
            title="Se déconnecter"
          >
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#2D6A4F',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white', minWidth: 30
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'white' }}>
                {profile?.name || '...'}
              </div>
              <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,.35)' }}>
                {profile?.plan === 'pro' ? 'Premium' : 'Gratuit'}
                {profile?.fac ? ` · ${profile.fac}` : ''}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
