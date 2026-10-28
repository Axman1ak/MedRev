// src/lib/quotas.ts
//
// Limites mensuelles d'usage de l'IA (bêta, octobre 2026).
//
// Pendant la bêta, MedRev est gratuit et rien n'est en vente
// (src/lib/offres.ts). Pour garder les coûts d'IA sous contrôle quand de
// nouveaux étudiants arrivent, chaque compte Gratuit a 10 créations par mois
// et par type. Le compteur repart à zéro le 1er du mois.
//
// Pour augmenter les limites, il suffit de changer FREE_MONTHLY ci-dessous :
// les routes API, la modale de limite et les Réglages lisent tous ces valeurs.
//
// Où sont stockés les compteurs :
//   · QCM (et extraction d'annales) : profiles.ai_generations_month_count,
//     incrémenté par la RPC try_increment_ai_generations_monthly ;
//   · synthèses et transcriptions : profiles.usage (jsonb), incrémenté par la
//     RPC try_use_quota. Les deux colonnes sont protégées par un trigger :
//     un utilisateur ne peut pas les remettre à zéro lui-même.

export type QuotaKind = 'qcm' | 'synthese' | 'transcription'

export const FREE_MONTHLY: Record<QuotaKind, number> = { qcm: 10, synthese: 10, transcription: 10 }
export const PRO_MONTHLY: Record<QuotaKind, number> = { qcm: 100, synthese: 100, transcription: 50 }

export const QUOTA_LABEL: Record<QuotaKind, string> = {
  qcm: 'Créations de QCM',
  synthese: 'Fiches de synthèse',
  transcription: 'Transcriptions de vidéos',
}

// Parrainage : chaque ami inscrit avec ton lien qui crée au moins une fiche
// te donne +5 créations par mois (QCM et synthèses), jusqu'à 4 amis. L'ami
// reçoit aussi +5 dès son inscription. Transcriptions non concernées.
export const REFERRAL_BONUS = 5
export const REFERRAL_MAX_FRIENDS = 4

export type ReferralInfo = { code?: string; referred?: boolean; invited?: number; active?: number } | null

export function referralBonus(r: ReferralInfo): number {
  if (!r) return 0
  return REFERRAL_BONUS * (Math.min(r.active ?? 0, REFERRAL_MAX_FRIENDS) + (r.referred ? 1 : 0))
}

export function monthlyLimit(plan: string | null | undefined, kind: QuotaKind, r: ReferralInfo = null): number {
  if (plan === 'pro') return PRO_MONTHLY[kind]
  return FREE_MONTHLY[kind] + (kind === 'transcription' ? 0 : referralBonus(r))
}

/** Lit l'état du parrainage du compte connecté (RPC my_referral). */
export async function fetchReferral(supabase: { rpc: (fn: string) => PromiseLike<{ data: unknown }> }): Promise<ReferralInfo> {
  try {
    const { data } = await supabase.rpc('my_referral')
    return (data && typeof data === 'object' ? data : null) as ReferralInfo
  } catch { return null }
}

/** Mois courant à l'heure de Paris, au format « 2026-10 » (même clé que la RPC). */
export function monthKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(d)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  return `${y}-${m}`
}

type ProfileLike = {
  usage?: unknown
  ai_generations_month_count?: number | null
  ai_generations_month_started_at?: string | null
}

/** Combien de créations de ce type ce mois-ci. */
export function usedThisMonth(p: ProfileLike, kind: QuotaKind): number {
  if (kind === 'qcm') {
    const s = p.ai_generations_month_started_at ? new Date(p.ai_generations_month_started_at) : null
    const now = new Date()
    const same = !!s && s.getUTCFullYear() === now.getUTCFullYear() && s.getUTCMonth() === now.getUTCMonth()
    return same ? p.ai_generations_month_count ?? 0 : 0
  }
  const u = (p.usage && typeof p.usage === 'object' ? (p.usage as Record<string, { m?: string; n?: number }>)[kind] : undefined)
  return u && u.m === monthKey() ? u.n ?? 0 : 0
}

const NOUN: Record<QuotaKind, [string, string]> = {
  qcm: ['création de QCM', 'créations de QCM'],
  synthese: ['fiche de synthèse', 'fiches de synthèse'],
  transcription: ['transcription de vidéo', 'transcriptions de vidéos'],
}

/** Corps de réponse 403 quand la limite du mois est atteinte. */
export function quotaExceeded(kind: QuotaKind, used: number, limit: number) {
  const noun = NOUN[kind][limit > 1 ? 1 : 0]
  const invite = kind === 'transcription' ? '' : ` Invite un ami de ta promo pour en gagner ${REFERRAL_BONUS} de plus chaque mois.`
  return {
    error: `Tu as utilisé tes ${limit} ${noun} de ce mois. Le compteur repart à zéro le 1er du mois prochain.${invite}`,
    code: 'quota_exceeded',
    quota: kind === 'qcm' ? 'ai_generations' : kind,
    limit,
    used,
  }
}
