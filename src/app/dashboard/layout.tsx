'use client'
// src/app/dashboard/layout.tsx

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const NAV = [
  { href: '/dashboard', label: 'Fiches', icon: '📚', exact: true },
  { href: '/dashboard/calendar', label: 'Calendrier', icon: '📅' },
  { href: '/dashboard/voyage', label: 'Voyage', icon: '🧳' },
  { href: '/dashboard/stats', label: 'Statistiques', icon: '📊' },
  { href: '/dashboard/pricing', label: 'Premium', icon: '⭐' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [todayCount, setTodayCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
  }, [])

  // Count today's pending revisions
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
    router.push('/auth')
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = profile?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?'

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <nav className="flex flex-col" style={{ width: 220, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

        {/* Logo */}
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="font-syne font-black text-xl" style={{ letterSpacing: '-0.03em' }}>
            Med<span style={{ color: 'var(--accent)' }}>Rev</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--t3)', fontFamily: 'DM Mono', letterSpacing: '0.05em' }}>RÉVISION MÉDICALE IA</div>
        </div>

        {/* Today banner */}
        {todayCount > 0 && (
          <Link href="/dashboard/calendar" style={{ margin: '10px 8px 0', padding: '8px 12px', background: 'rgba(79,142,247,.08)', border: '1px solid rgba(79,142,247,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{todayCount}</span>
            <span className="text-xs" style={{ color: 'var(--t2)' }}>à réviser aujourd'hui</span>
          </Link>
        )}

        {/* Nav section */}
        <div className="text-xs font-bold uppercase mt-4" style={{ padding: '0 14px 6px', color: 'var(--t3)', fontFamily: 'Syne', letterSpacing: '0.1em' }}>Navigation</div>
        <div className="flex flex-col" style={{ padding: '0 4px' }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={`nav-item ${isActive(n.href, n.exact) ? 'active' : ''}`}>
              <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
              <span>{n.label}</span>
              {n.href === '/dashboard/pricing' && profile?.plan === 'pro' && (
                <span className="badge-pro ml-auto">PRO</span>
              )}
            </Link>
          ))}
        </div>

        {/* Subjects managed by page */}
        <div id="sidebar-subjects" className="flex-1" />

        {/* Footer */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
          {/* Import/Export */}
          <div className="flex gap-1.5 mb-2">
            <button id="trigger-import" className="btn btn-ghost btn-xs flex-1" style={{ fontSize: 11 }}>📂 Import</button>
            <button id="trigger-export" className="btn btn-ghost btn-xs flex-1" style={{ fontSize: 11 }}>💾 Export</button>
          </div>

          {/* User block */}
          <div className="relative group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer' }} className="hover:bg-bg3 transition-colors">
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'Syne', flexShrink: 0 }}>{initials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{profile?.name || '...'}</div>
                <div className="text-xs" style={{ color: profile?.plan === 'pro' ? 'var(--gold)' : 'var(--t3)' }}>
                  {profile?.plan === 'pro' ? 'Plan Premium' : 'Plan Gratuit'}
                </div>
              </div>
            </div>
            {/* Dropdown */}
            <div className="absolute bottom-full left-0 right-0 mb-1 hidden group-hover:block z-50" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
              <button onClick={logout} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-bg3 transition-colors cursor-pointer border-0 bg-transparent" style={{ color: 'var(--danger)' }}>
                🚪 Déconnexion
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Freemium upgrade bar */}
        <div id="upgrade-bar" style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '9px 28px', background: 'rgba(245,158,11,.07)', borderBottom: '1px solid rgba(245,158,11,.12)', fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: 'var(--t2)' }}>🔒 <strong style={{ color: 'var(--gold)' }}>Limite gratuite atteinte</strong> — Passez Premium pour des fiches illimitées et les QCM IA.</span>
          <Link href="/dashboard/pricing" className="btn btn-gold btn-sm">Débloquer →</Link>
        </div>
        {children}
      </main>
    </div>
  )
}
