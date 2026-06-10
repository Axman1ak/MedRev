// src/app/manifesto/page.tsx
//
// Page Manifesto — positionnement émotionnel.
// Server component, content-only.

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import '@/components/landing-styles.css'

export const metadata = {
  title: 'Manifesto — MedRev',
  description: 'La médecine devrait être méritocratique. Pourquoi MedRev existe.',
}

export default function ManifestoPage() {
  return (
    <div className="lp-page">
      <MarketingNav current="manifesto" />

      <div className="manifesto-wrap">
        <span className="manifesto-kicker">Manifesto</span>
        <h1 className="manifesto-h1">
          La médecine<br />devrait être<br /><em>méritocratique.</em>
        </h1>
        <p className="manifesto-lede">
          En France, la P1 décide qui sera médecin. Elle devrait départager
          <strong> les élèves sur leur travail, peu importe leur budget familial.</strong>
        </p>

        <section className="manifesto-section">
          <div className="manifesto-num">01 · Le constat</div>
          <h2 className="manifesto-h2">Une <em>barrière financière</em> qui ne devrait pas exister.</h2>
          <p className="manifesto-p">
            Aujourd&apos;hui, beaucoup d&apos;étudiants en P1 investissent entre
            <strong> 3 000 et 8 000 €</strong> dans une prépa privée. Pour ceux qui
            le peuvent, ces structures apportent un cadre, des polys et un
            encadrement qui font la différence. Le problème, ce n&apos;est pas
            la prépa en elle-même : c&apos;est que <strong>tout le monde n&apos;y a
            pas accès</strong>.
          </p>
          <p className="manifesto-p">
            Les boursiers, les enfants de classes populaires, celles et ceux
            dont les parents ne peuvent pas suivre cet effort financier passent
            les mêmes épreuves avec moins d&apos;heures encadrées. La médecine
            devrait recruter ses futurs praticiens <strong>sur la rigueur,
            pas sur le compte bancaire</strong>.
          </p>
          <div className="manifesto-quote">
            « Payer plusieurs milliers d&apos;euros par an pour préparer une
            année de fac publique est devenu la norme pour beaucoup. On voulait que
            ça ne soit plus <strong>une condition d&apos;accès</strong>. »
          </div>
        </section>

        <section className="manifesto-section">
          <div className="manifesto-num">02 · Notre réponse</div>
          <h2 className="manifesto-h2">Un outil <em>accessible</em>, en complément ou en alternative.</h2>
          <p className="manifesto-p">
            MedRev est gratuit pour démarrer. <strong>Vraiment gratuit</strong> :
            matières et fiches illimitées, courbe J, calendrier, sessions
            Focus, bibliothèque virtuelle. Pas de version « démo » dégradée
            pour pousser à payer.
          </p>
          <p className="manifesto-p">
            Le Premium démarre à <strong>5,75 €/mois</strong> (69 €/an) ou
            <strong> 9,99 €/mois</strong> sans engagement. Il débloque l&apos;IA
            en illimité et le mode Examen blanc. Tu paies ce que tu utilises.
          </p>
          <p className="manifesto-p">
            Que tu sois <strong>déjà en prépa</strong> et que tu cherches un
            outil pour mieux organiser ton travail, ou que tu prépares la P1
            sans encadrement supplémentaire, MedRev s&apos;adapte à ton
            contexte. L&apos;objectif : que le budget ne décide plus de qui
            travaille bien.
          </p>
          <div className="manifesto-numbers">
            <div className="manifesto-num-stat"><div className="manifesto-num-stat-num">69 €</div><div className="manifesto-num-stat-lbl">L&apos;année complète</div></div>
            <div className="manifesto-num-stat"><div className="manifesto-num-stat-num">14</div><div className="manifesto-num-stat-lbl">Paliers J</div></div>
            <div className="manifesto-num-stat"><div className="manifesto-num-stat-num">0 €</div><div className="manifesto-num-stat-lbl">Pour démarrer</div></div>
          </div>
        </section>

        <section className="manifesto-section">
          <div className="manifesto-num">03 · Nos engagements</div>
          <h2 className="manifesto-h2">Pas de pub. Pas de tracking. <em>Pas de revente.</em></h2>
          <p className="manifesto-p">
            Tes données d&apos;apprentissage sont parmi les plus intimes que
            tu produis : ce que tu sais, ce que tu rates, ce qui te coûte.
            Personne ne devrait <em>vendre ça</em> ni s&apos;en servir pour
            te cibler avec des pubs de bouquins.
          </p>
          <p className="manifesto-p">
            MedRev tourne sans pub, sans Google Analytics, sans Facebook
            Pixel, sans cookies tiers. Tes données utilisateur (fiches,
            cours uploadés, profil) sont stockées en Union Européenne
            sur <strong>Supabase Paris</strong>. L&apos;infrastructure web
            passe par Vercel, avec des transferts strictement encadrés par
            les Clauses Contractuelles Types de la Commission européenne.
          </p>
          <p className="manifesto-p">
            Si on coule un jour, on n&apos;ouvre pas la porte aux <em>data
            brokers</em>. On donne aux users 30 jours pour exporter leurs
            fiches, puis on supprime.
          </p>
        </section>

        <section className="manifesto-section">
          <div className="manifesto-num">04 · Pourquoi maintenant ?</div>
          <h2 className="manifesto-h2">Parce que <em>l&apos;IA bien faite</em>, ça change tout.</h2>
          <p className="manifesto-p">
            Il y a 5 ans, on n&apos;aurait pas pu te générer 30 QCM en 90
            secondes depuis ta vidéo de cours pour 1 centime de coût.
            Aujourd&apos;hui, oui. Et ce qui demandait des moyens conséquents
            (banques de QCM, tuteurs disponibles, planning personnalisé)
            devient <strong>accessible plus largement</strong>.
          </p>
          <p className="manifesto-p">
            MedRev n&apos;est pas un cours en plus. C&apos;est <strong>l&apos;outil
            qui transforme tes propres cours</strong> (ceux que ta fac
            t&apos;a donnés, ceux que tes profs ont enregistrés) en QCM, en
            planning, en progression mesurable.
          </p>
        </section>

        <div className="manifesto-sign">
          <div className="manifesto-sign-avatar">M</div>
          <div>
            <div className="manifesto-sign-name">L&apos;équipe MedRev</div>
            <div className="manifesto-sign-role">
              On a construit MedRev parce que personne ne construisait
              l&apos;outil qu&apos;on aurait voulu pour la P1.
            </div>
          </div>
        </div>
      </div>

      <section className="lp-cta" style={{ padding: '60px 32px 100px' }}>
        <h2 className="lp-cta-h2" style={{ fontSize: 'clamp(28px, 4.5vw, 44px)' }}>
          Si tu lis ça, <em>tu fais déjà partie</em> de la solution.
        </h2>
        <p className="lp-cta-sub">
          Crée ton compte gratuit, charge ton premier cours, et commence à
          réviser autrement.
        </p>
        <div className="lp-cta-buttons">
          <Link href="/auth" className="lp-btn-primary">Créer mon compte →</Link>
          <Link href="/methode" className="lp-btn-secondary">Voir la méthode</Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
