// src/app/api/stripe/portal/route.ts
//
// Crée une session Stripe Customer Portal pour qu'un user Pro puisse :
//   - Voir / télécharger ses factures
//   - Mettre à jour sa carte
//   - Résilier son abonnement (la résiliation déclenche le webhook
//     'customer.subscription.deleted' qui flippe profile.plan à 'free')
//
// Le Customer Portal Stripe doit être configuré une fois côté dashboard :
//   Stripe Dashboard → Settings → Customer Portal → Activate
//   (par défaut Stripe propose une config raisonnable)

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Lire le stripe_customer_id stocké par le webhook checkout.session.completed
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('stripe_customer_id, plan')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 500 })
  }
  if (!profile.stripe_customer_id) {
    return NextResponse.json(
      { error: "Tu n'as pas encore d'abonnement actif. Passe Premium d'abord." },
      { status: 400 }
    )
  }

  // Domaine de retour : dérivé de la requête (cf. /api/stripe/checkout)
  const baseUrl = req.headers.get('origin') || new URL(req.url).origin

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id as string,
      return_url: `${baseUrl}/dashboard/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e: unknown) {
    // Erreur Stripe la plus courante : Customer Portal pas configuré
    // (Settings → Billing → Customer Portal → Activate)
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[stripe/portal] error:', msg)
    return NextResponse.json(
      { error: `Le portail client n'est pas accessible. ${msg}` },
      { status: 500 }
    )
  }
}
