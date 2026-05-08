// src/app/api/simulator/start/route.ts
//
// Endpoint appelé par simulateur-page AVANT de lancer une session.
// Vérifie le quota Free (1 session totale) et incrémente le compteur si OK.
// Pour les comptes Premium ('pro'), passe sans incrément.
//
// Pourquoi un endpoint serveur plutôt qu'un check côté client :
//   - le client peut être manipulé (devtools, edit du JS) → quota bypassable
//   - le serveur est seul source de vérité sur le plan + le compteur
//
// Le client lit la réponse :
//   - 200 OK { used, limit, plan } → autorise launchSession()
//   - 403 quota_exceeded { used, limit } → affiche le paywall texte

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const FREE_SIMULATOR_SESSIONS_LIMIT = 1

export async function POST() {
  try {
    // 1. Auth
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // 2. Lecture du plan + compteur
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan, simulator_sessions_count')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 500 })
    }

    // 3. Premium passe direct sans incrément (compteur reste informatif si on
    // veut un jour tracker les usages Premium — pas grave de le laisser à 0).
    if (profile.plan === 'pro') {
      return NextResponse.json({
        ok: true,
        plan: 'pro',
        used: profile.simulator_sessions_count ?? 0,
        limit: null,
      })
    }

    // 4. Free : check du quota
    const used = profile.simulator_sessions_count ?? 0
    if (used >= FREE_SIMULATOR_SESSIONS_LIMIT) {
      return NextResponse.json(
        {
          error: `Limite atteinte : ${FREE_SIMULATOR_SESSIONS_LIMIT} session simulateur en mode Gratuit. Passe en Premium pour des sessions illimitées.`,
          code: 'quota_exceeded',
          quota: 'simulator_sessions',
          limit: FREE_SIMULATOR_SESSIONS_LIMIT,
          used,
        },
        { status: 403 }
      )
    }

    // 5. Incrément atomique via RPC (évite race condition si le user
    // double-clique sur "Lancer la session").
    const { data: incData, error: incErr } = await supabase.rpc('increment_simulator_sessions', { uid: user.id })
    if (incErr) {
      console.warn('[simulator/start] increment_simulator_sessions RPC failed:', incErr.message)
      // On laisse passer même si l'incrément échoue : le user a son droit,
      // c'est juste qu'il pourra peut-être lancer une 2e session par erreur.
      // Logged pour Sentry/monitoring.
    }

    return NextResponse.json({
      ok: true,
      plan: 'free',
      used: typeof incData === 'number' ? incData : used + 1,
      limit: FREE_SIMULATOR_SESSIONS_LIMIT,
    })
  } catch (error) {
    console.error('[simulator/start] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
