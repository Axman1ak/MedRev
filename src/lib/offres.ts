// src/lib/offres.ts
//
// Interrupteur unique des offres payantes.
//
// POURQUOI C'EST COUPÉ (octobre 2026)
// -----------------------------------
// Vendre un service depuis un site, même accessoirement, fait de l'éditeur un
// « éditeur professionnel » au sens de l'article 6-III de la LCEN. Il doit
// alors publier son adresse, son SIRET, son numéro de TVA ou sa mention
// d'exonération, et désigner un médiateur de la consommation dans ses CGV.
// MedRev n'a pas encore de structure immatriculée, donc rien de tout ça ne peut
// être écrit sans l'inventer.
//
// Tant que le service est entièrement gratuit, l'éditeur reste un particulier
// qui ne monétise pas : les mentions légales se limitent à son identité et à
// l'hébergeur, et tout est exact.
//
// Le coût de cette coupure est nul : au moment de la décision, aucun
// abonnement n'avait jamais été vendu. Les quatre comptes Premium existants ne
// sont pas touchés, ils restent sur leur plan.
//
// POUR RALLUMER
// -------------
// Passer cette constante à true. Rien d'autre à faire côté code : les deux
// pages de tarifs, la modale de quota et la route de paiement s'alignent
// dessus. À faire UNIQUEMENT une fois la structure immatriculée, et en
// remettant à jour au même moment :
//   · src/app/mentions-legales/page.tsx  (adresse, SIRET, TVA)
//   · src/app/cgu/page.tsx               (article 4, et le médiateur conso)

export const OFFRES_PAYANTES_OUVERTES = false

/** Adresse de contact unique du service, reprise partout. */
export const CONTACT_EMAIL = 'medrev.fr@gmail.com'
