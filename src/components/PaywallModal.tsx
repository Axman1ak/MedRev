'use client'
// src/components/PaywallModal.tsx
//
// Modale affichée quand l'API renvoie code='quota_exceeded'.
// Réutilisable pour tous les quotas Free :
//   - ai_generations       (5 générations QCM IA)
//   - simulator_sessions   (1 session simulateur)
//   - video_size           (vidéo > 100 Mo)
//   - pdf_size              (PDF > 20 Mo) — pas encore enforced côté upload
//
// Usage typique (côté simulateur ou QCM caller) :
//
//   const [paywall, setPaywall] = useState<PaywallInfo | null>(null)
//   ...
//   const data = await resp.json()
//   if (resp.status === 403 && data?.code === 'quota_exceeded') {
//     setPaywall({ quota: data.quota, used: data.used, limit: data.limit, message: data.error })
//     return
//   }
//   ...
//   {paywall && <PaywallModal {...paywall} onClose={() => setPaywall(null)} />}
//
// Le composant gère l'overlay, l'animation d'entrée, l'esc/click-outside,
// et l'affichage adaptatif selon le type de quota.

import { useEffect } from 'react'
import './paywall-modal.css'

export type PaywallQuota = 'ai_generations' | 'simulator_sessions' | 'video_size' | 'pdf_size'

export type PaywallInfo = {
  quota: PaywallQuota
  used?: number
  limit?: number
  message?: string
}

type PaywallModalProps = PaywallInfo & {
  onClose: () => void
}

// Contenu textuel selon le type de quota
const QUOTA_COPY: Record<PaywallQuota, { title: string; intro: string; icon: string }> = {
  ai_generations: {
    title: 'Plus de générations IA',
    intro: "Tu as utilisé tes 5 générations QCM IA gratuites. Le Premium les rend illimitées.",
    icon: '✦',
  },
  simulator_sessions: {
    title: 'Plus de sessions simulateur',
    intro: "Tu as utilisé ta session simulateur gratuite. Le Premium ouvre les sessions illimitées + le mode Examen blanc.",
    icon: '◆',
  },
  video_size: {
    title: 'Vidéo trop longue pour le Gratuit',
    intro: "Le mode Gratuit limite à 30 minutes (~100 Mo). Le Premium accepte jusqu'à 250 Mo par vidéo.",
    icon: '▶',
  },
  pdf_size: {
    title: 'PDF trop lourd pour le Gratuit',
    intro: "Le mode Gratuit limite à 20 Mo par PDF. Le Premium retire cette limite.",
    icon: '📄',
  },
}

const PREMIUM_BENEFITS = [
  'Générations QCM IA illimitées',
  'Sessions simulateur illimitées + mode Examen blanc',
  'Vidéos jusqu\'à 250 Mo, PDF sans limite',
  'Stats avancées (heatmap, sparkline 12 sem, dumbbell)',
]

export default function PaywallModal({ quota, used, limit, message, onClose }: PaywallModalProps) {
  const copy = QUOTA_COPY[quota] ?? QUOTA_COPY.ai_generations
  const showProgress = typeof used === 'number' && typeof limit === 'number' && limit > 0

  // ESC pour fermer + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="pw-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-title"
      onClick={onClose}
    >
      <div
        className="pw-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="pw-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>

        <div className="pw-icon" aria-hidden="true">{copy.icon}</div>

        <div className="pw-kicker">Limite Gratuite atteinte</div>
        <h2 id="pw-title" className="pw-title">{copy.title}</h2>

        <p className="pw-intro">{message || copy.intro}</p>

        {showProgress && (
          <div className="pw-progress" aria-hidden="true">
            <div className="pw-progress-row">
              <span className="pw-progress-lbl">Utilisé</span>
              <span className="pw-progress-num">
                <strong>{used}</strong> / {limit}
              </span>
            </div>
            <div className="pw-progress-bar">
              <div className="pw-progress-fill" />
            </div>
          </div>
        )}

        <div className="pw-benefits">
          <div className="pw-benefits-h">Avec Premium tu débloques</div>
          <ul className="pw-benefits-list">
            {PREMIUM_BENEFITS.map((b) => (
              <li key={b}>
                <span className="pw-benefits-mark" aria-hidden="true">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pw-soon">
          Le plan Premium arrive bientôt. On te préviendra dès qu&apos;il sera disponible.
        </div>

        <div className="pw-actions">
          <button
            type="button"
            className="pw-btn pw-btn-ghost"
            onClick={onClose}
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  )
}
