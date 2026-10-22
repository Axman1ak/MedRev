// src/app/guides/organiser-sa-p1/page.tsx
//
// Guide « Comment organiser sa P1 ». Page de contenu pour Google : elle
// répond à ce que les étudiants cherchent avant de connaître MedRev
// (« organiser sa P1 », « planning révision PASS », « méthode des J »…),
// puis renvoie vers l'inscription.
//
// Règles du site : pas de tiret cadratin, pas d'emoji, aucun concurrent cité.
// Classes de la page préfixées gd- (styles.css), le reste vient du style des
// pages publiques (site-public.css).

import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import '@/components/landing-styles.css'
import '@/components/landing-night.css'
import { SITE_URL } from '@/lib/site'
import './styles.css'

const URL = SITE_URL + '/guides/organiser-sa-p1'
const TITLE = 'Comment organiser sa P1 de médecine (PASS, LAS) : la méthode jour par jour'
const DESCRIPTION =
  "Le guide pour organiser sa première année de santé : apprendre une fois, revoir au bon moment (J+1, J+3, J+7…), une liste chaque matin, une semaine type et la préparation du concours."

export const metadata: Metadata = {
  title: 'Comment organiser sa P1 (PASS, LAS) : la méthode jour par jour',
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // Hors de Google pour l'instant : seul l'accueil doit sortir quand on cherche MedRev.
  robots: { index: false, follow: true },
  openGraph: { type: 'article', url: URL, title: TITLE, description: DESCRIPTION },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DESCRIPTION,
  inLanguage: 'fr-FR',
  datePublished: '2026-10-19',
  dateModified: '2026-10-19',
  mainEntityOfPage: URL,
  author: { '@type': 'Organization', name: 'MedRev', url: SITE_URL + '/' },
  publisher: { '@type': 'Organization', name: 'MedRev', logo: { '@type': 'ImageObject', url: SITE_URL + '/icon-512.png' } },
}

const SOMMAIRE = [
  ['probleme', 'Le vrai problème de la P1'],
  ['principe', 'Le principe : revoir au bon moment'],
  ['j0', 'Le jour du cours'],
  ['matin', 'Chaque matin, une liste'],
  ['note', 'Se noter honnêtement'],
  ['qcm', "Les QCM, dès le début"],
  ['semaine', 'Une semaine type'],
  ['concours', 'Le mois avant le concours'],
  ['erreurs', 'Les erreurs qui coûtent cher'],
  ['questions', 'Questions fréquentes'],
]

export default function GuideOrganiserP1() {
  return (
    <div className="lp-page ln-doc">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <MarketingNav current="guide" />

      <section className="ln-subhero">
        <span className="ln-kicker">Pour la P1 : PASS et LAS</span>
        <h1 className="ln-subhero-h1">
          Comment organiser sa P1 : <em>la méthode jour par jour.</em>
        </h1>
        <p className="ln-subhero-sub">
          PASS ou LAS, le problème est le même : des dizaines de chapitres, et
          pas de mode d&apos;emploi pour s&apos;en souvenir le jour du concours.
          Voici une méthode simple, à appliquer dès la première semaine.
        </p>
      </section>

      <div className="gd-wrap">
        <nav className="gd-toc" aria-label="Sommaire">
          <div className="gd-toc-t">Sommaire</div>
          <ol>
            {SOMMAIRE.map(([id, label]) => (
              <li key={id}><a href={`#${id}`}>{label}</a></li>
            ))}
          </ol>
        </nav>

        <article className="gd-art">
          <p className="gd-lead">
            La P1 ne se joue pas sur l&apos;intelligence. Elle se joue sur
            l&apos;organisation : savoir chaque jour quoi revoir, et ne rien laisser
            filer jusqu&apos;au concours. Une méthode régulière bat presque toujours
            les grosses révisions de dernière minute.
          </p>

          <h2 id="probleme">Le vrai problème de la P1 : le volume</h2>
          <p>
            Pris un par un, la plupart des cours de P1 sont accessibles. Ce qui
            rend l&apos;année difficile, c&apos;est leur nombre : biochimie, biologie
            cellulaire, anatomie, physique, chimie, santé publique… Chaque
            semaine apporte de nouveaux chapitres, et les anciens s&apos;effacent
            pendant ce temps.
          </p>
          <p>
            Sans révision, on oublie vite : la moitié de ce qu&apos;on vient
            d&apos;apprendre peut disparaître en quelques jours. C&apos;est ce
            qu&apos;on appelle la <strong>courbe de l&apos;oubli</strong>. Relire
            tout le programme juste avant le concours ne suffit pas : il y en a
            trop, et ce qui a été oublié doit presque être réappris.
          </p>

          <h2 id="principe">Le principe : apprendre une fois, revoir au bon moment</h2>
          <p>
            La solution porte un nom : la <strong>répétition espacée</strong>.
            On revoit un cours juste au moment où on commence à l&apos;oublier, et
            chaque révision fait tenir le souvenir plus longtemps que la
            précédente. Les écarts entre deux révisions peuvent donc grandir.
          </p>
          <p>
            En P1, on parle souvent de <strong>la méthode des J</strong> : le jour
            où tu découvres un cours est J0, puis tu le revois à des dates
            fixées à l&apos;avance. Un exemple courant :
          </p>
          <div className="gd-js" role="list" aria-label="Exemple de paliers de révision">
            {[
              ['J0', 'le cours'],
              ['J+1', 'le lendemain'],
              ['J+3', '3 jours après'],
              ['J+7', '1 semaine'],
              ['J+15', '2 semaines'],
              ['J+30', '1 mois'],
            ].map(([j, t]) => (
              <div className="gd-j" role="listitem" key={j}>
                <b>{j}</b>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <p>
            Il n&apos;y a pas de calendrier magique : l&apos;important est de
            choisir des paliers et de <strong>les tenir</strong>. Une révision à
            J+3 prend beaucoup moins de temps que de réapprendre le chapitre
            trois semaines plus tard.
          </p>

          <h2 id="j0">Le jour du cours (J0) : une fiche, pas un roman</h2>
          <p>
            Le soir même, ou le lendemain au plus tard, transforme le cours en
            une fiche courte. Une fiche ne recopie pas le poly : elle garde ce
            qui tombe aux examens (définitions, mécanismes, chiffres, schémas)
            et ce que tu as du mal à retenir.
          </p>
          <ul>
            <li>Une fiche par chapitre, pas par heure de cours.</li>
            <li>Des titres clairs, pour la relire en quelques minutes.</li>
            <li>Note la date du jour : c&apos;est ton J0, il sert à placer les révisions suivantes.</li>
          </ul>

          <h2 id="matin">Chaque matin, une liste (et les retards d&apos;abord)</h2>
          <p>
            Le plus difficile avec la méthode des J n&apos;est pas de réviser, c&apos;est
            de savoir quoi réviser aujourd&apos;hui. Avec trente chapitres en
            cours, les dates se croisent vite. Fais une liste chaque matin :
            toutes les fiches dont le palier tombe aujourd&apos;hui.
          </p>
          <p>
            Si tu as pris du retard (et ça arrivera), commence par les fiches
            en retard. Une fiche en retard de deux jours est plus fragile
            qu&apos;une fiche qui tombe aujourd&apos;hui. Et ne cherche pas à tout
            rattraper en un soir : étale les retards sur quelques jours.
          </p>

          <h2 id="note">Se noter honnêtement, de 1 à 5</h2>
          <p>
            Après chaque révision, donne-toi une note : 1 si tu as presque tout
            oublié, 5 si tu maîtrises sans hésiter. Ces notes servent à deux
            choses :
          </p>
          <ul>
            <li>repérer les fiches à revoir plus tôt que prévu (celles notées 1 ou 2) ;</li>
            <li>savoir, à l&apos;approche du concours, quelles matières sont solides et lesquelles ne le sont pas.</li>
          </ul>
          <p>
            Une note n&apos;est utile que si elle est honnête. Mieux vaut un 2 vrai
            qu&apos;un 4 rassurant qui cache un trou le jour du concours.
          </p>

          <h2 id="qcm">Les QCM, dès le début et pas seulement à la fin</h2>
          <p>
            Relire une fiche donne l&apos;impression de savoir. Répondre à une
            question montre si on sait vraiment. S&apos;entraîner sur des QCM dès
            les premières semaines, chapitre par chapitre, fait gagner
            énormément de temps : on repère tout de suite ce qui ne tient pas.
          </p>
          <ul>
            <li>Fais quelques QCM sur un chapitre quelques jours après l&apos;avoir appris.</li>
            <li>Lis la correction de chaque proposition, même celles que tu as eues justes.</li>
            <li>Garde les annales de ta fac pour les dernières semaines : elles montrent le format exact du concours.</li>
          </ul>

          <h2 id="semaine">Une semaine type</h2>
          <p>
            À adapter à ton emploi du temps. L&apos;idée : chaque jour a sa part de
            nouveau (J0), sa part de révisions (les J) et un peu
            d&apos;entraînement.
          </p>
          <div className="gd-table-wrap">
            <table className="gd-table">
              <thead>
                <tr><th>Jour</th><th>Journée</th><th>Soir</th></tr>
              </thead>
              <tbody>
                <tr><td>Lundi</td><td>Cours en amphi ou en vidéo</td><td>Fiches des cours du jour (J0) + liste des J</td></tr>
                <tr><td>Mardi</td><td>Cours, TD</td><td>Fiches J0 + liste des J</td></tr>
                <tr><td>Mercredi</td><td>Cours</td><td>Fiches J0 + liste des J + quelques QCM</td></tr>
                <tr><td>Jeudi</td><td>Cours, TD</td><td>Fiches J0 + liste des J</td></tr>
                <tr><td>Vendredi</td><td>Cours</td><td>Fiches J0 + liste des J + QCM</td></tr>
                <tr><td>Samedi</td><td>Retards de la semaine</td><td>QCM sur les chapitres de la semaine</td></tr>
                <tr><td>Dimanche</td><td>Repos (vraiment)</td><td>Liste des J du jour, légère</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Le repos fait partie de la méthode. Le sommeil aide à fixer ce
            qu&apos;on apprend, et une année entière ne se tient pas sans pauses.
          </p>

          <h2 id="concours">Le mois avant le concours : ne pas tout recommencer</h2>
          <p>
            Si tu as tenu tes J, tu n&apos;as pas à tout relire depuis le début.
            Le dernier mois sert à consolider :
          </p>
          <ul>
            <li>Note la date du concours et compte les jours qui restent.</li>
            <li>Reprends en priorité les fiches les moins bien notées, matière par matière.</li>
            <li>Passe aux annales et aux examens blancs dans les conditions réelles (temps limité).</li>
            <li>Garde ta liste des J en parallèle : ce qui est solide doit le rester.</li>
          </ul>

          <h2 id="erreurs">Les erreurs qui coûtent cher</h2>
          <ul>
            <li><strong>Recopier le poly</strong> au lieu de faire une fiche : des heures perdues, et rien de plus retenu.</li>
            <li><strong>Relire sans se tester</strong> : on a l&apos;impression de savoir, jusqu&apos;au QCM.</li>
            <li><strong>Repousser les retards</strong> : ils s&apos;accumulent, et la liste devient décourageante.</li>
            <li><strong>Garder son planning dans sa tête</strong> : au-delà de dix chapitres, plus personne ne sait ce qui tombe aujourd&apos;hui.</li>
            <li><strong>Ne jamais faire de pause</strong> : la fatigue fait perdre plus de temps qu&apos;un jour de repos.</li>
          </ul>

          <h2 id="questions">Questions fréquentes</h2>
          <h3>La méthode marche-t-elle en PASS comme en LAS ?</h3>
          <p>
            Oui. Les matières et le nombre d&apos;heures changent, mais le problème
            reste le même : beaucoup de chapitres à garder en tête jusqu&apos;aux
            examens. Le gouvernement a annoncé en avril 2026 une première année
            de santé unique à partir de la rentrée 2027, à la place du PASS et
            de la LAS. La façon de s&apos;organiser, elle, ne change pas.
          </p>
          <h3>Et si je commence en retard, en plein semestre ?</h3>
          <p>
            Commence aujourd&apos;hui : fais les fiches des cours de la semaine,
            puis reprends les anciens chapitres un ou deux par jour, en leur
            donnant un J0 à la date où tu les reprends. Pas besoin de tout
            rattraper d&apos;un coup.
          </p>
          <h3>Combien de temps par jour ?</h3>
          <p>
            Ça dépend de ton emploi du temps et de ta fac. Ce qui compte, c&apos;est
            la régularité : une liste tenue tous les jours vaut mieux que de
            longues journées irrégulières.
          </p>

          <div className="gd-cta">
            <div>
              <div className="gd-cta-k">Avec MedRev</div>
              <p className="gd-cta-t">
                MedRev applique cette méthode pour toi : tes cours deviennent des
                fiches et des QCM, et chaque matin tu as ta liste du jour, retards
                d&apos;abord.
              </p>
            </div>
            <div className="gd-cta-b">
              <Link href="/auth" className="gd-btn">Commencer gratuitement</Link>
              <Link href="/methode" className="gd-btn gd-btn-g">Voir la méthode</Link>
            </div>
          </div>
        </article>
      </div>

      <MarketingFooter />
    </div>
  )
}
