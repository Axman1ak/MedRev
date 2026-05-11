// src/app/api/stripe/checkout/route.ts
//
// Crée une session Stripe Checkout pour upgrader vers Premium.
// Supporte 2 plans : 'monthly' (9,99 €/mois) et 'yearly' (69 €/an).
//
// Le price ID de chaque plan est lu via env vars :
//   - STRIPE_PRICE_MONTHLY  (existant, le 9,99 €/mois)
//   - STRIPE_PRICE_YEARLY   (à créer dans Stripe dashboard puis ajouter en
//                            env var Vercel : Settings → Environment Variables)
//
// Si STRIPE_PRICE_YEARLY n'est pas configurée, le plan 'yearly' fallback sur
// le mensuel pour ne pas casser le flow.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

// Price IDs lus dans l'env. AUCUN fallback hardcodé : si l'env var disparaît
// d'un déploiement (mauvaise config, preview branch sans secrets), on préfère
// échouer fort et clair plutôt que de facturer sur un mauvais price ID.
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY
const STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY

// Allowlist des plans acceptés. Si on ajoute "lifetime" un jour, l'ajouter ici.
const VALID_PLANS = ['monthly', 'yearly'] as const
type StripePlan = typeof VALID_PLANS[number]

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Lecture du plan demandé (défaut : monthly pour rétro-compat avec l'ancien
  // appel qui ne passait pas de body)
  const body = await req.json().catch(() => ({}))
  const requestedPlan: StripePlan = (VALID_PLANS as readonly string[]).includes(body?.plan)
    ? body.plan
    : 'monthly'

  // Mappe vers le price ID Stripe
  let priceId: string
  if (requestedPlan === 'yearly') {
    if (!STRIPE_PRICE_YEARLY) {
      // Le product Annuel n'a pas encore été créé dans Stripe → on retourne
      // une erreur claire plutôt que de fallback silencieusement sur le mensuel
      // (ça créerait une confusion de facturation).
      return NextResponse.json(
        { error: 'Le plan annuel n\'est pas encore disponible. Choisis le mensuel pour le moment.' },
        { status: 400 }
      )
    }
    priceId = STRIPE_PRICE_YEARLY
  } else {
    if (!STRIPE_PRICE_MONTHLY) {
      // Pas de fallback hardcodé : si l'env var manque, on bloque le paiement
      // côté serveur. Mieux qu'un mauvais price facturé en silence.
      console.error('[stripe/checkout] STRIPE_PRICE_MONTHLY env var manquante')
      return NextResponse.json(
        { error: 'Le paiement est temporairement indisponible. Réessaie dans un instant ou contacte le support.' },
        { status: 500 }
      )
    }
    priceId = STRIPE_PRICE_MONTHLY
  }

  // URL de redirection après paiement / annulation. Détermine le domaine
  // depuis la requête elle-même : marche sur prod, preview, localhost, et
  // domaine custom sans config manuelle. NE PAS utiliser process.env.VERCEL_URL
  // qui pointe sur l'URL spécifique du deployment (med-rev-abc123.vercel.app)
  // au lieu du domaine alias où sont les cookies de session Supabase.
  const baseUrl = req.headers.get('origin') || new URL(req.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/pricing?success=true`,
    cancel_url: `${baseUrl}/dashboard/pricing?cancelled=true`,
    customer_email: user.email,
    metadata: {
      user_id: user.id,
      plan: requestedPlan,
    },
    // Permet à Stripe d'afficher un récap clair côté checkout
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
