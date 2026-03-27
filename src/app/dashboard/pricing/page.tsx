'use client'
// src/app/dashboard/pricing/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PricingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      supabase.from('profiles').select('plan').eq('id', user.id).single()
        .then(({ data }) => setPlan(data?.plan || 'free'))
    })

    // Afficher un message si retour de Stripe
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      alert('🎉 Paiement réussi ! Ton plan Premium est activé.')
      router.replace('/dashboard/pricing')
    }
    if (params.get('cancelled') === 'true') {
      alert('Paiement annulé. Tu peux réessayer quand tu veux.')
      router.replace('/dashboard/pricing')
    }
  }, [])

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) { alert(error); setLoading(false); return }
      window.location.href = url
    } catch {
      alert('Erreur lors de la redirection vers le paiement.')
      setLoading(false)
    }
  }

  const FREE_FEATURES = [
    { label: "Jusqu'à 15 fiches", included: true },
    { label: 'Révision espacée J0 → J+120', included: true },
    { label: 'Calendrier visuel', included: true },
    { label: 'Module Voyage (2 passages)', included: true },
    { label: 'Export / Import JSON', included: true },
    { label: 'QCM IA (upload cours PDF)', included: false },
    { label: 'Fiches illimitées', included: false },
    { label: 'Synchro multi-appareils', included: false },
  ]

  const PRO_FEATURES = [
    { label: 'Fiches illimitées', included: true },
    { label: 'Révision espacée J0 → J+120', included: true },
    { label: 'Calendrier visuel', included: true },
    { label: 'Module Voyage (2 passages)', included: true },
    { label: 'Export / Import JSON', included: true },
    { label: '✨ QCM IA profonds (upload PDF)', included: true },
    { label: '✨ Formats EDN : QCM, KFP, V/F', included: true },
    { label: '✨ Synchro cloud (bientôt)', included: true },
  ]

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="mb-8">
        <h1 className="font-syne font-black text-2xl" style={{ color: 'var(--t1)' }}>
          Choisir son <span style={{ color: 'var(--accent)' }}>plan</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>Commencez gratuitement. Upgradez quand vous voulez.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, maxWidth: 680 }}>

        {/* Free */}
        <div style={{ background: 'var(--card)', border: `2px solid ${plan === 'free' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 20, padding: 26 }}>
          <div className="font-syne font-bold text-base mb-1" style={{ color: 'var(--t1)' }}>Gratuit</div>
          <div className="font-syne font-black" style={{ fontSize: 38, color: 'var(--accent)', lineHeight: 1, margin: '10px 0 3px' }}>0€</div>
          <div className="text-xs mb-5" style={{ color: 'var(--t3)' }}>pour toujours</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
            {FREE_FEATURES.map(f => (
              <li key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 13, color: f.included ? 'var(--t2)' : 'var(--t3)' }}>
                <span style={{ color: f.included ? 'var(--accent2)' : 'var(--t3)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{f.included ? '✓' : '✗'}</span>
                {f.label}
              </li>
            ))}
          </ul>
          <div style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--t2)', textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
            {plan === 'free' ? 'Plan actuel ✓' : 'Plan inclus'}
          </div>
        </div>

        {/* Pro */}
        <div style={{ background: 'var(--card)', border: `2px solid ${plan === 'pro' ? 'var(--accent2)' : 'var(--gold)'}`, borderRadius: 20, padding: 26, position: 'relative' }}>
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: '#0d0f14', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            ⭐ Recommandé
          </div>
          <div className="font-syne font-bold text-base mb-1" style={{ color: 'var(--t1)' }}>Premium</div>
          <div className="font-syne font-black" style={{ fontSize: 38, color: 'var(--gold)', lineHeight: 1, margin: '10px 0 3px' }}>9,99€</div>
          <div className="text-xs mb-5" style={{ color: 'var(--t3)' }}>/mois · sans engagement</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
            {PRO_FEATURES.map(f => (
              <li key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 13, color: 'var(--t2)' }}>
                <span style={{ color: 'var(--accent2)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                {f.label}
              </li>
            ))}
          </ul>
          {plan === 'pro' ? (
            <div style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'var(--accent2)', color: '#0d0f14', textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
              Plan actuel ✓
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              style={{ width: '100%', padding: '11px', borderRadius: 10, background: loading ? 'rgba(245,158,11,0.5)' : 'var(--gold)', color: '#0d0f14', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'DM Sans', transition: 'all .2s' }}
            >
              {loading ? 'Redirection...' : 'Activer Premium →'}
            </button>
          )}
        </div>
      </div>

      <div className="text-xs mt-5" style={{ color: 'var(--t3)', maxWidth: 680 }}>
        💳 Paiement sécurisé via Stripe · Annulation à tout moment · Données hébergées en Europe (RGPD compliant)
      </div>
    </div>
  )
}
