'use client'
// Bannière du tableau de bord qui pousse au parrainage. Visible pour les
// comptes Gratuits uniquement ; la croix la ferme pour de bon sur ce navigateur.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { REFERRAL_BONUS } from '@/lib/quotas'
import './referral-banner.css'

const KEY = 'medrev-ref-banner-off'

export default function ReferralBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try { if (localStorage.getItem(KEY)) return } catch { /* stockage bloqué */ }
    const supabase = createClient()
    let alive = true
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
      if (alive && (data as { plan?: string } | null)?.plan !== 'pro') setShow(true)
    })
    return () => { alive = false }
  }, [])

  if (!show) return null

  function close() {
    setShow(false)
    try { localStorage.setItem(KEY, new Date().toISOString()) } catch { /* rien */ }
  }

  return (
    <div className="refb" role="region" aria-label="Inviter des amis">
      <span className="refb-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
      </span>
      <p className="refb-txt">
        <b>Invite un ami de ta promo</b>
        <span>Vous gagnez chacun {REFERRAL_BONUS} QCM et {REFERRAL_BONUS} synthèses de plus par mois.</span>
      </p>
      <Link href="/dashboard/settings?s=parrainage" className="refb-go">Inviter</Link>
      <button type="button" className="refb-x" aria-label="Fermer" onClick={close}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  )
}
