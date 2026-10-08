// src/app/privacy/page.tsx
//
// Cette page était une SECONDE politique de confidentialité, orpheline :
// aucun lien du site n'y menait, elle datait de mars 2026, elle gardait les
// couleurs d'un ancien design sombre, et surtout elle se contredisait avec
// les deux autres pages légales (elle annonçait Supabase « Frankfurt,
// Allemagne » quand le projet tourne à Paris, et les CGU disent Vercel
// États-Unis pour l'application).
//
// Deux politiques de confidentialité qui ne disent pas la même chose, c'est
// exactement ce qu'on ne veut pas laisser traîner quand on démarche une
// association. On ne garde que /confidentialite, et cette URL y redirige pour
// ne casser aucun lien déjà partagé ou indexé.

import { redirect } from 'next/navigation'

export default function PrivacyPage() {
  redirect('/confidentialite')
}
