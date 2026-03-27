// src/app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
 
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
 
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
 
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: 'price_1TFcVZ4I71YTpOUICTvhUcwJ', quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://med-rev-eight.vercel.app' : 'http://localhost:3000'}/dashboard/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://med-rev-eight.vercel.app' : 'http://localhost:3000'}/dashboard/pricing?cancelled=true`,
    customer_email: user.email,
    metadata: { user_id: user.id },
  })
 
  return NextResponse.json({ url: session.url })
}
