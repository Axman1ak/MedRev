'use client'
// src/app/r/[code]/page.tsx
//
// Lien de parrainage : medrev.fr/r/ABC123. On garde le code dans le
// navigateur, puis on envoie vers l'inscription. Le rattachement au parrain
// se fait une fois le compte créé (voir dashboard/layout.tsx, claim_referral).

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ReferralLanding({ params }: { params: { code: string } }) {
  const router = useRouter()
  useEffect(() => {
    const code = String(params.code || '').trim().toUpperCase().slice(0, 12)
    try { if (code) localStorage.setItem('medrev-ref', code) } catch { /* navigation privée */ }
    router.replace('/auth?mode=register&invite=1')
  }, [params.code, router])
  return null
}
