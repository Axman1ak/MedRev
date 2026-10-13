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
//      - WELCOME_EMAIL_FROM = l'adresse d'envoi (ex: "MedRev <medrev.fr@gmail.com>"
//        ou "MedRev <onboarding@resend.dev>" en attendant)
//
// Si RESEND_API_KEY n'est pas configurée, l'endpoint répond OK mais ne fait
// rien — l'inscription continue normalement, on perd juste le mail.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = process.env.WELCOME_EMAIL_FROM || 'MedRev <onboarding@resend.dev>'
// URL de l'app utilisée dans les liens du mail. Le repli est le domaine de
// production : il pointait sur l'URL vercel.app, donc un étudiant qui cliquait
// depuis son mail atterrissait ailleurs que sur le site.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medrev.fr'

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
    const firstName = prenomLisible(profile?.name || profile?.username || '')

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
// Styles écrits en ligne, polices système, aucune image : un client mail ne
// lit pas de feuille de style externe, et la plupart bloquent les images par
// défaut. Le seul visuel, la bande des 14 paliers, est donc dessiné en cases
// de tableau pour que tout le monde le voie.

// Palette, reprise de la landing : bleu nuit, crème, bleu clair. Écrite en
// dur, un client mail ne lit ni variables CSS ni feuille externe.
const NUIT = '#17304F'
const NUIT_PROFOND = '#0E1D33'
const CREME = '#F3EFE7'
const BLEU = '#9AC4E0'
const BLEU_TEXTE = '#6E9CC4'
const GRIS = '#5B6B7C'

/**
 * Le prénom à afficher, ou rien.
 *
 * Le pseudo d'inscription n'est pas toujours un prénom : « bonnefoy.l »
 * donnait « Bienvenue, bonnefoy.l », ce qui sonne comme un mail automatique
 * mal réglé. Dès que la chaîne ressemble à un identifiant (point, tiret bas,
 * chiffre), on préfère ne pas nommer la personne du tout.
 */
function prenomLisible(brut: string): string {
  const mot = (brut || '').trim().split(/\s+/)[0] || ''
  if (!mot || /[._\-0-9@]/.test(mot) || mot.length > 20) return ''
  return mot.charAt(0).toUpperCase() + mot.slice(1)
}

/**
 * Un bloc : illustration, numéro, titre, texte, lien. L'illustration alterne
 * de côté d'un bloc à l'autre, et passe au-dessus du texte sur téléphone.
 *
 * Les illustrations sont des PNG servis par le site lui-même (public/email/).
 * Si le client mail bloque les images, il reste le numéro, le titre, le texte
 * et le lien : la colonne de texte porte tout le message à elle seule.
 */
function bloc(o: { num: string; img: string; alt: string; titre: string; accent: string; texte: string; lien: string; href: string; imageAGauche: boolean }): string {
  const visuel = `<td class="col" width="250" valign="middle">
      <img src="${APP_URL}/email/${o.img}" width="250" alt="${o.alt}" style="display:block;width:250px;max-width:100%;height:auto;border:0;border-radius:16px;" /></td>`
  const espace = '<td class="gap" width="28">&nbsp;</td>'
  const texte = `<td class="col" valign="middle">
      <div style="font:700 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.18em;color:${BLEU};margin-bottom:10px;">${o.num}</div>
      <div style="font:700 19px/1.3 Helvetica,Arial,sans-serif;color:${NUIT};margin-bottom:8px;">${o.titre} <em style="font-style:italic;font-weight:400;color:${BLEU_TEXTE};">${o.accent}</em></div>
      <div style="font:14px/1.65 Helvetica,Arial,sans-serif;color:${GRIS};margin-bottom:12px;">${o.texte}</div>
      <a href="${o.href}" style="font:700 13px/1 Helvetica,Arial,sans-serif;color:${NUIT};text-decoration:none;border-bottom:2px solid ${BLEU};padding-bottom:3px;">${o.lien} &rarr;</a></td>`
  const ordre = o.imageAGauche ? visuel + espace + texte : texte + espace + visuel
  return `<tr><td style="padding:26px 30px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${ordre}</tr></table></td></tr>`
}

function buildHtml(firstName: string): string {
  const salut = firstName
    ? `Bienvenue,<br /><em style="font-style:italic;font-weight:400;color:${BLEU};">${escapeHtml(firstName)}</em>`
    : `<em style="font-style:italic;font-weight:400;color:${BLEU};">Bienvenue</em>`
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>Bienvenue sur MedRev</title>
<style>@media (max-width:480px){.col{display:block!important;width:100%!important;padding:0 0 14px!important;}.gap{display:none!important;}.hero{font-size:34px!important;}}</style>
</head>
<body style="margin:0;padding:0;background:${CREME};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Ton compte est ouvert. Voilà par quoi commencer.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CREME};">

<!-- Bandeau d'accueil pleine largeur : il sort de la colonne de 560 px et
     touche les deux bords de la fenêtre, comme le haut de la landing. Le
     contenu, lui, reste centré sur la même largeur que la suite. -->
<tr><td align="center" style="background:${NUIT_PROFOND};padding:0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;">
    <tr><td align="center" style="padding:30px 24px 44px;">
      <div style="font:700 13px/1 Helvetica,Arial,sans-serif;letter-spacing:.34em;color:${BLEU};padding-bottom:28px;">MEDREV</div>
      <div class="hero" style="font:700 40px/1.1 Helvetica,Arial,sans-serif;color:#FFFFFF;letter-spacing:-.02em;">${salut}</div>
      <div style="font:15px/1.6 Helvetica,Arial,sans-serif;color:#A9BDD2;padding-top:18px;max-width:380px;">Ton compte est ouvert. Voilà les trois choses que MedRev va faire pour toi cette année.</div>
    </td></tr>
  </table>
</td></tr>

<tr><td align="center" style="padding:10px 12px 34px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;">

  ${bloc({ num: '01', img: 'bloc1.png', alt: 'Une fiche de cours importée dans MedRev', titre: 'Importe ton cours,', accent: 'l&rsquo;IA écrit tes QCM', texte: 'Dépose ton poly ou la rediffusion. Trente questions au format concours, tirées de tes supports à toi, en une minute.', lien: 'Créer ma première fiche', href: `${APP_URL}/dashboard/fiches`, imageAGauche: true })}
  ${bloc({ num: '02', img: 'bloc2.png', alt: 'Les paliers de révision, de J0 à J120', titre: 'La courbe J', accent: 'planifie tes révisions', texte: 'Quatorze paliers se programment seuls, de J1 à J120. Tu n&rsquo;as plus à décider quoi réviser le matin.', lien: 'Voir mon calendrier', href: `${APP_URL}/dashboard/calendar`, imageAGauche: false })}
  ${bloc({ num: '03', img: 'bloc3.png', alt: 'Les rangs, d&rsquo;Apprenti à Maître', titre: 'D&rsquo;Apprenti', accent: 'à Maître', texte: 'Ton indice de préparation monte avec ta maîtrise et ton assiduité. Dix minutes de révision suffisent à valider ta journée.', lien: 'Ouvrir mon tableau de bord', href: `${APP_URL}/dashboard`, imageAGauche: true })}

  <tr><td align="center" style="padding:16px 30px 8px;">
    <a href="${APP_URL}/dashboard/fiches" style="display:inline-block;background:${BLEU};color:${NUIT_PROFOND};text-decoration:none;font:700 15px/1 Helvetica,Arial,sans-serif;padding:16px 32px;border-radius:12px;">Charger mon premier cours &rarr;</a>
  </td></tr>

  <tr><td align="center" style="padding:22px 30px 0;">
    <p style="margin:0;font:14px/1.6 Helvetica,Arial,sans-serif;color:${GRIS};">Une question, un bug, une idée ? Réponds à ce mail. C&rsquo;est lu, et par quelqu&rsquo;un.</p>
  </td></tr>

  <tr><td align="center" style="padding:22px 30px 0;">
    <p style="margin:0;font:11px/1.6 Helvetica,Arial,sans-serif;color:#9AA7B4;">MedRev &middot; gratuit pour démarrer &middot; données hébergées en France</p>
  </td></tr>

</table></td></tr></table>
</body>
</html>`
}

function buildText(firstName: string): string {
  return `${firstName ? `Bienvenue, ${firstName}.` : 'Bienvenue sur MedRev.'}

Ton compte est ouvert. Voilà les trois choses que MedRev va faire pour toi
cette année.

01 — IMPORTE TON COURS, L'IA ÉCRIT TES QCM
Dépose ton poly ou la rediffusion. Trente questions au format concours,
tirées de tes supports à toi, en une minute.
${APP_URL}/dashboard/fiches

02 — LA COURBE J PLANIFIE TES RÉVISIONS
Quatorze paliers se programment seuls, de J1 à J120. Tu n'as plus à décider
quoi réviser le matin.
${APP_URL}/dashboard/calendar

03 — D'APPRENTI À MAÎTRE
Ton indice de préparation monte avec ta maîtrise et ton assiduité. Dix
minutes de révision suffisent à valider ta journée.
${APP_URL}/dashboard

Une question, un bug, une idée ? Réponds à ce mail. C'est lu, et par
quelqu'un.

MedRev, gratuit pour démarrer, données hébergées en France
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
