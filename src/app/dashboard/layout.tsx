'use client'
// src/app/dashboard/layout.tsx
//
// Layout partagé pour /dashboard ET toutes ses sous-routes
// (/dashboard/calendar, /dashboard/fiches, /dashboard/focus, etc.).
// Contient le rail d'icônes (expand au survol), le toggle thème,
// la barre d'onglets mobile. Le {children} de chaque page s'insère
// dans .main.

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './styles.css'

const ICONS = {
  home: <><path d="M3 12l2-2 7-7 7 7 2 2" /><path d="M5 10v10h14V10" /></>,
  cal: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  list: <path d="M4 6h16M4 12h16M4 18h10" />,
  check: <><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 6-6" /></>,
  sun: <><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></>,
  play: <path d="M5 3l14 9-14 9V3z" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
} as const

type IconKey = keyof typeof ICONS

const NAV = [
  { key: 'dashboard', label: 'Tableau de bord', icon: 'home' as IconKey, href: '/dashboard' },
  { key: 'calendar', label: 'Calendrier', icon: 'cal' as IconKey, href: '/dashboard/calendar', badge: true },
  { key: 'courses', label: 'Mes cours', icon: 'list' as IconKey, href: '/dashboard/fiches' },
  { key: 'simulator', label: 'Simulateur', icon: 'check' as IconKey, href: '/dashboard/simulateur' },
  { key: 'stats', label: 'Statistiques', icon: 'chart' as IconKey, href: '/dashboard/stats' },
] as const

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [activeNav, setActiveNav] = useState<string>('dashboard')
  const [activeTab, setActiveTab] = useState<'home' | 'cal' | 'courses' | 'stats'>('home')
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  const Icon = (k: IconKey) => <svg viewBox="0 0 24 24" aria-hidden>{ICONS[k]}</svg>

  return (
    <div className="dash-root" data-theme={theme}>
      <div className="bg-fx" />
      <div className="scan" />

      <div className="app">
        {/* RAIL — partagé entre toutes les sous-routes du dashboard */}
        <aside className="rail">
          <div className="rail-brand"><span className="bx"><i /></span><span className="txt">MedRev</span></div>
          {NAV.map(n => (
            <Link
              href={n.href}
              key={n.key}
              className={'rail-i' + (activeNav === n.key ? ' active' : '')}
              onClick={() => setActiveNav(n.key)}
            >
              {Icon(n.icon)}
              {('badge' in n && n.badge) && <span className="bdg" />}
              <span className="tip">{n.label}</span>
            </Link>
          ))}
          <div className="rail-sp" />
          <button
            type="button"
            className="rail-i"
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Bascule thème"
            style={{ background: 'transparent', border: 'none', font: 'inherit', textAlign: 'left' }}
          >
            {Icon(theme === 'dark' ? 'sun' : 'moon')}
            <span className="tip">Thème clair / sombre</span>
          </button>
          <Link href="/aide" className="rail-i">
            {Icon('help')}
            <span className="tip">Aide & tutoriel</span>
          </Link>
          <button
            type="button"
            className="rail-i"
            onClick={handleLogout}
            aria-label="Se déconnecter"
            style={{ background: 'transparent', border: 'none', font: 'inherit', textAlign: 'left' }}
          >
            {Icon('logout')}
            <span className="tip">Se déconnecter</span>
          </button>
          {/* TODO: tirer initiales + nom + plan depuis le profil Supabase */}
          <Link href="/settings" className="rail-avatar">
            <span className="av">LO</span>
            <span className="txt">lou<small>Premium · Sorbonne</small></span>
          </Link>
        </aside>

        {/* MAIN — accueille le contenu de chaque page */}
        <main className="main">{children}</main>
      </div>

      {/* TABBAR MOBILE — visible uniquement sous 760px (cf @media dans styles.css) */}
      <nav className="tabbar" aria-label="Navigation principale">
        <Link
          href="/dashboard"
          className={'tab' + (activeTab === 'home' ? ' active' : '')}
          onClick={() => setActiveTab('home')}
        >
          {Icon('home')}<span>Accueil</span>
        </Link>
        <Link
          href="/dashboard/calendar"
          className={'tab' + (activeTab === 'cal' ? ' active' : '')}
          onClick={() => setActiveTab('cal')}
        >
          {Icon('cal')}<span>Agenda</span><span className="dot-badge" />
        </Link>
        <Link href="/dashboard/focus" className="tab-go" aria-label="Démarrer la session">
          {Icon('play')}<span>Démarrer</span>
        </Link>
        <Link
          href="/dashboard/fiches"
          className={'tab' + (activeTab === 'courses' ? ' active' : '')}
          onClick={() => setActiveTab('courses')}
        >
          {Icon('list')}<span>Cours</span>
        </Link>
        <Link
          href="/dashboard/stats"
          className={'tab' + (activeTab === 'stats' ? ' active' : '')}
          onClick={() => setActiveTab('stats')}
        >
          {Icon('chart')}<span>Stats</span>
        </Link>
      </nav>
    </div>
  )
}
