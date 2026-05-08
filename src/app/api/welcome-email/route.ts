// src/app/api/welcome-email/route.ts
//
// Envoie un email de bienvenue à un user qui vient de s'inscrire.
// Appelé depuis LandingPage.tsx juste après supabase.auth.signUp réussi.
//
// Setup côté Resend (https://resend.com) :
//   1. Créer un compte (free jusqu'à 3000 emails/mois)
//   2. (Optionnel) Vérifier un domaine d'envoi (medrev.fr) dans Domains.
//      Sans ça, on utilise onboarding@resend.dev qui marche pour le testing
//      mais arrive en spam pour des users réels.
//   3. Settings → API Keys → Create API Key → copier
//   4. Vercel → Settings → Environment Variables :
//      - RESEND_API_KEY = la clé copiée
//      - WELCOME_EMAIL_FROM = l'adresse d'envoi (ex: "MedRev <hello@medrev.fr>"
//        ou "MedRev <onboarding@resend.dev>" en attendant)
//
// Si RESEND_API_KEY n'est pas configurée, l'endpoint répond OK mais ne fait
// rien — l'inscription continue normalement, on perd juste le mail.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = process.env.WELCOME_EMAIL_FROM || 'MedRev <onboarding@resend.dev>'

export async function POST() {
  try {
    // Auth requise pour éviter qu'un attaquant envoie des emails à n'importe qui.
    // L'user doit être authentifié au moment de l'appel (juste après signUp).
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Si Resend pas configuré, on échoue silencieusement (200 OK avec
    // skipped: true) pour ne pas bloquer le flow d'inscription.
    if (!RESEND_API_KEY) {
      console.warn('[welcome-email] RESEND_API_KEY non configurée, skip envoi')
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Lecture du nom pour personnaliser
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', user.id)
      .single()
    const firstName = (profile?.name || profile?.username || '').split(' ')[0] || 'futur médecin'

    // Envoi via l'API REST Resend (pas besoin du SDK pour un seul appel)
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [user.email],
        subject: `Bienvenue sur MedRev, ${firstName}`,
        html: buildHtml(firstName),
        text: buildText(firstName),
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[welcome-email] Resend error:', resp.status, errText.slice(0, 300))
      // On retourne 200 quand même pour ne pas casser le flow signup
      return NextResponse.json({ ok: false, error: 'Email pas envoyé' })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[welcome-email] error:', err)
    // Même logique : on n'échoue pas le signup pour un email raté
    return NextResponse.json({ ok: false, error: 'Erreur interne' })
  }
}

// ============================================================
// Templates email (HTML + plain text)
// ============================================================
// Style sobre, maximum readable. Pas de couleurs criardes, fonts système
// pour pas dépendre de Google Fonts qui ne charge pas dans tous les clients
// mail (Outlook notamment).

function buildHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bienvenue sur MedRev</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1A1A1A;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAFAF7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="540" style="max-width:540px;background:#FFFFFF;border:1px solid #E8E6E0;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 36px 0;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#2D6A4F;margin-bottom:14px;">MedRev</div>
          <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:500;letter-spacing:-0.01em;color:#1A1A1A;line-height:1.2;">
            Bienvenue, ${escapeHtml(firstName)}.
          </h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#5C5C5A;">
            Tu viens de créer ton compte MedRev. La méthode est simple : tu charges tes cours, l'IA génère des QCM, et l'app te dit quoi réviser chaque jour pour que tu retiennes pour de bon.
          </p>
        </td></tr>

        <tr><td style="padding:0 36px 8px;">
          <h2 style="margin:24px 0 12px;font-family:Georgia,serif;font-size:17px;font-weight:500;color:#1A1A1A;">Pour bien démarrer</h2>
          <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#1A1A1A;">
            <li><strong>Crée ta première fiche</strong> dans une matière (déjà pré-configurées selon ta fac).</li>
            <li><strong>Upload une vidéo de cours et/ou un PDF</strong>. MedRev en extrait le contenu et te génère 30 QCM en 1 minute.</li>
            <li><strong>Note la fiche au jour J</strong> sur 1 à 5. La courbe d'oubli prend le relais et te programme les révisions suivantes.</li>
          </ol>
        </td></tr>

        <tr><td style="padding:24px 36px 8px;">
          <a href="https://med-rev-eight.vercel.app/dashboard" style="display:inline-block;background:#1B4332;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:9px;letter-spacing:0.01em;">
            Aller sur mon dashboard →
          </a>
        </td></tr>

        <tr><td style="padding:18px 36px 32px;">
          <p style="margin:18px 0 0;font-family:Georgia,serif;font-style:italic;font-size:14px;color:#5C5C5A;line-height:1.5;">
            Tout est gratuit pour démarrer (matières et fiches illimitées, courbe J, calendrier, bibliothèque). L'IA et le simulateur ont quelques limites en gratuit ; tu peux passer Premium quand tu en auras vraiment besoin.
          </p>
        </td></tr>

        <tr><td style="border-top:1px solid #E8E6E0;padding:18px 36px;">
          <p style="margin:0;font-size:12px;color:#9A9A98;line-height:1.5;">
            Une question, un bug, une idée ? Réponds simplement à ce mail.
            <br />
            <span style="color:#C4C2BA;">© 2026 MedRev · Hébergé en France</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildText(firstName: string): string {
  return `Bienvenue, ${firstName}.

Tu viens de créer ton compte MedRev. La méthode est simple : tu charges tes cours, l'IA génère des QCM, et l'app te dit quoi réviser chaque jour pour que tu retiennes pour de bon.

Pour bien démarrer :

1. Crée ta première fiche dans une matière (déjà pré-configurées selon ta fac).
2. Upload une vidéo de cours et/ou un PDF. MedRev en extrait le contenu et te génère 30 QCM en 1 minute.
3. Note la fiche au jour J sur 1 à 5. La courbe d'oubli prend le relais et te programme les révisions suivantes.

Aller sur mon dashboard : https://med-rev-eight.vercel.app/dashboard

Tout est gratuit pour démarrer (matières et fiches illimitées, courbe J, calendrier, bibliothèque). L'IA et le simulateur ont quelques limites en gratuit ; tu peux passer Premium quand tu en auras vraiment besoin.

Une question, un bug, une idée ? Réponds simplement à ce mail.

— MedRev · Hébergé en France
`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
