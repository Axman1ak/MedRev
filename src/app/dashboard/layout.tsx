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
  { href: '/dashboard', label: 'Tableau de bord', icon: '⌂', exact: true },
  { href: '/dashboard/calendar', label: 'Calendrier', icon: '▦' },
  { href: '/dashboard/fiches', label: 'Mes cours', icon: '▤' },
  { href: '/dashboard/simulateur', label: 'Simulateur', icon: '▶' },
  { href: '/dashboard/stats', label: 'Statistiques', icon: '◈' },
]
// Note : "Paramètres" n'est PAS dans NAV — l'accès se fait via la card user
// en bas de sidebar (cliquable, avec name + plan + fac visibles). Le bouton
// "Aide & tutoriel" en dessous est la seule entrée secondaire restante.

// Mapping id fac → nom affichable. Aligné avec auth-page.tsx + settings-page.tsx.
// À factoriser dans @/types un jour si on l'utilise dans encore plus d'endroits.
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

  // Onboarding state — overlay tour piloté depuis Settings (event 'medrev-onboarding-replay')
  // ou auto-déclenché au 1er login (onboarded_at null).
  const [tourOpen, setTourOpen] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [isReplay, setIsReplay] = useState(false)
  const [existingLessonCount, setExistingLessonCount] = useState(0)

  // Mobile : sidebar masquée par défaut, ouverte via le bouton burger.
  // On ferme automatiquement la sidebar quand on change de route (sinon
  // l'user clique un lien et la sidebar reste ouverte par-dessus le contenu).
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

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
        /* Note : les fonts Fraunces et Plus Jakarta Sans sont déjà chargées
           via next/font/google dans app/layout.tsx. Pas d'@import ici — ça
           dupliquerait la requête et bloquerait le render. Si tu vois "Plus
           Jakarta Sans" non-rendered, vérifier que layout.tsx applique bien
           les variables CSS (--font-jakarta, etc.). */

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
          font-family: 'Cinzel', 'Fraunces', Georgia, serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
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

        /* Section secondaire (Paramètres + Aide) : moins prominente */
        .db-nav-secondary {
          margin-bottom: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--sb-border);
        }
        .db-nav-secondary .db-nav-item {
          font-size: 12.5px;
          color: var(--sb-text-dim);
        }
        .db-nav-secondary .db-nav-item:hover {
          color: var(--sb-text-muted);
        }

        /* Bouton "Aide & tutoriel" : ressemble à un nav item mais c'est un <button> */
        .db-nav-item-btn {
          width: 100%;
          border: none;
          background: transparent;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
        }
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

        /* ================ MOBILE BURGER + OVERLAY ================ */
        /* Bouton burger : caché en desktop, visible en mobile uniquement.
           Position fixed pour rester accessible quand on scrolle. */
        .db-burger {
          display: none;
          position: fixed;
          top: 14px;
          left: 14px;
          z-index: 200;
          width: 40px;
          height: 40px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          cursor: pointer;
          padding: 0;
          font-size: 18px;
          color: var(--text-primary);
          box-shadow: 0 2px 6px rgba(0,0,0,.06);
        }

        /* Overlay sombre derrière la sidebar mobile pour fermer en cliquant */
        .db-sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(20,22,20,.45);
          z-index: 90;
        }

        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          /* Sidebar : passe en off-canvas, slide depuis la gauche.
             Toujours dans le DOM (les ancres data-tour fonctionnent) mais
             translatée hors écran sauf si .open. */
          .db-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: 260px;
            max-width: 80vw;
            height: 100vh;
            transform: translateX(-100%);
            transition: transform .25s ease;
            z-index: 100;
            box-shadow: 4px 0 20px rgba(0,0,0,.12);
          }
          .db-sidebar.open {
            transform: translateX(0);
          }

          /* Main occupe toute la largeur (la sidebar est par-dessus) */
          .db-main {
            width: 100%;
            padding-top: 50px; /* laisse de la place au burger qui flotte */
          }

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

        {/* Bouton Aide isolé — la card user juste en dessous mène déjà aux
            Paramètres, donc on n'ajoute QUE le bouton de relance du tour ici
            pour éviter de doubler les liens. */}
        <div className="db-nav-section db-nav-secondary">
          <button
            type="button"
            className="db-nav-item db-nav-item-btn"
            onClick={() => {
              // Replay du tour — même event que celui dispatché depuis Settings,
              // pour partager le même listener côté layout.
              if (typeof window !== 'undefined') {
                localStorage.removeItem('medrev-onboarding-step')
                localStorage.removeItem('medrev-onboarding-phase')
                window.dispatchEvent(new Event('medrev-onboarding-replay'))
              }
            }}
            aria-label="Rejouer le tutoriel"
          >
            <i className="ic">?</i>
            Aide & tutoriel
          </button>
        </div>

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
                {profile?.fac ? ` · ${FAC_NAMES[profile.fac] || profile.fac}` : ''}
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
