// src/app/api/account/delete/route.ts
//
// Suppression définitive du compte user — droit à l'effacement RGPD (art. 17).
//
// Sécurité :
//   - Auth via cookie Supabase (RLS check ownership)
//   - Re-vérification du mot de passe (signInWithPassword) pour éviter qu'un
//     attaquant ayant volé une session puisse détruire le compte sans
//     re-authentification.
//   - Vérification du texte de confirmation "SUPPRIMER" envoyé par le client.
//
// Ordre de suppression (FK-safe) :
//   1. Annule l'abonnement Stripe si Pro (le webhook propagera, mais on
//      cancel à l'avance pour ne pas continuer à facturer après destruction
//      des données).
//   2. Supprime les fichiers Storage (lesson-media : vidéos + PDF).
//   3. Supprime voyage_checks (lié à lessons par lesson_id).
//   4. Supprime lessons.
//   5. Supprime systems.
//   6. Supprime profiles.
//   7. Supprime auth.users via la service_role key (requis : SUPABASE_SERVICE_ROLE_KEY).
//
// NOTE setup : pour que l'étape 7 fonctionne, ajouter SUPABASE_SERVICE_ROLE_KEY
// dans Vercel → Settings → Environment Variables. Sans cette var, le compte
// auth reste actif mais toutes les données sont vidées (le user verra un
// "compte vide" s'il se reconnecte — pas idéal mais pas dramatique).

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { password, confirmation } = body as { password?: string; confirmation?: string }

    // 1. Le texte de confirmation doit être exactement "SUPPRIMER".
    if (confirmation !== 'SUPPRIMER') {
      return NextResponse.json(
        { error: 'Tape exactement "SUPPRIMER" en majuscules pour confirmer.' },
        { status: 400 }
      )
    }

    // 2. Re-vérification du mot de passe : on tente un signInWithPassword.
    if (!password) {
      return NextResponse.json({ error: 'Mot de passe requis.' }, { status: 400 })
    }
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    if (authErr) {
      return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 })
    }

    // 3. Récupère profile + lessons pour préparer les suppressions
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id')
      .eq('id', user.id)
      .single()

    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, media')
      .eq('user_id', user.id)

    const lessonIds = (lessons || []).map(l => l.id)

    // 4. Annule l'abonnement Stripe si Pro (best-effort, on continue en cas d'erreur)
    if (profile?.plan === 'pro' && profile.stripe_customer_id && stripe) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active',
          limit: 5,
        })
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id)
        }
      } catch (e) {
        console.warn('[account/delete] Stripe cancel échoué (non bloquant):', e)
      }
    }

    // 5. Supprime les fichiers Storage (lesson-media)
    const storagePaths: string[] = []
    for (const l of lessons || []) {
      const media = (l.media ?? {}) as { video_path?: string; pdf_path?: string }
      if (media.video_path) storagePaths.push(media.video_path)
      if (media.pdf_path) storagePaths.push(media.pdf_path)
    }
    if (storagePaths.length > 0) {
      const { error: storErr } = await supabase.storage.from('lesson-media').remove(storagePaths)
      if (storErr) console.warn('[account/delete] Storage cleanup partial:', storErr.message)
    }

    // 6. Supprime voyage_checks (si la table existe et a des entrées)
    if (lessonIds.length > 0) {
      await supabase.from('voyage_checks').delete().in('lesson_id', lessonIds)
    }

    // 7. Supprime lessons
    await supabase.from('lessons').delete().eq('user_id', user.id)

    // 8. Supprime systems
    await supabase.from('systems').delete().eq('user_id', user.id)

    // 9. Supprime profile
    await supabase.from('profiles').delete().eq('id', user.id)

    // 10. Supprime auth.users via la service_role key
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { error: delAuthErr } = await admin.auth.admin.deleteUser(user.id)
        if (delAuthErr) {
          console.warn('[account/delete] auth.admin.deleteUser échoué:', delAuthErr.message)
        }
      } catch (e) {
        console.warn('[account/delete] Service role delete user error:', e)
      }
    } else {
      console.warn('[account/delete] SUPABASE_SERVICE_ROLE_KEY non configurée — le compte auth ne sera pas supprimé, mais toutes les données métier sont vidées.')
    }

    // 11. Sign out côté cookie pour invalider la session courante
    await supabase.auth.signOut()

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[account/delete] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
