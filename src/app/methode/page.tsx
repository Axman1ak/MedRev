// src/app/methode/page.tsx
//
// Page Méthode — explique en profondeur comment MedRev fait travailler les P1.
// Vise l'autorité (SEO) et la conversion en montrant la rigueur pédagogique.
//
// Server component, content-heavy, peu d'interactivité. Utilise les classes
// .lp-* du landing-styles.css pour la cohérence visuelle.

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import '@/components/landing-styles.css'

export const metadata = {
  title: 'La méthode — MedRev',
  description: 'Courbe d\'Ebbinghaus, 14 paliers J0 → J+120, génération QCM par IA, mode angles morts. La méthode MedRev expliquée en détail.',
}

export default function MethodePage() {
  return (
    <div className="lp-page">
      <MarketingNav current="methode" />

      {/* Hero */}
      <section className="lp-hero" style={{ paddingBottom: 60 }}>
        <span className="lp-hero-kicker">La méthode</span>
        <h1 className="lp-hero-h1" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Une P1, c&apos;est <em>environ 200 fiches à oublier</em>
          <span className="line2" style={{ fontStyle: 'normal', color: 'var(--lp-text)' }}>
            quatre fois.
          </span>
        </h1>
        <p className="lp-hero-sub">
          MedRev s&apos;appuie sur 140 ans de psychologie cognitive pour
          décider <strong>quoi te faire réviser, quand, et pourquoi</strong>.
          Voici comment.
        </p>
      </section>

      {/* Section 1 — La courbe d'oubli */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-method-block">
          <div className="lp-method-text">
            <div className="lp-section-kicker">01 · Le problème</div>
            <h2 className="lp-section-h2" style={{ textAlign: 'left', margin: '0 0 18px' }}>
              La courbe d&apos;<em>Ebbinghaus.</em>
            </h2>
            <p className="lp-method-p">
              En 1885, Hermann Ebbinghaus a mesuré ce qu&apos;il appelle <em>la
              courbe de l&apos;oubli</em>. Sans révision, on perd <strong>environ
              50 % de ce qu&apos;on a appris en 1 jour</strong>, et 80 % en
              1 semaine.
            </p>
            <p className="lp-method-p">
              Mais à chaque fois qu&apos;on revoit la même chose au bon
              moment, la courbe s&apos;aplatit. Au bout de 5-7 révisions
              espacées, l&apos;oubli devient quasi-nul.
            </p>
            <p className="lp-method-p">
              C&apos;est ce qu&apos;on appelle la <strong>répétition
              espacée</strong>. C&apos;est ce que font les bons étudiants.
              Beaucoup d&apos;outils l&apos;automatisent, mais imparfaitement,
              parce qu&apos;ils ne savent pas que tes partiels arrivent dans
              3 semaines.
            </p>
          </div>
          <div className="lp-method-visual">
            <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
              <rect width="400" height="280" fill="#FAFAF7" rx="12" />
              <line x1="40" y1="240" x2="370" y2="240" stroke="#9A9A98" strokeWidth="1" />
              <line x1="40" y1="40" x2="40" y2="240" stroke="#9A9A98" strokeWidth="1" />
              <text x="40" y="265" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#9A9A98">J0</text>
              <text x="120" y="265" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#9A9A98">J+1</text>
              <text x="200" y="265" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#9A9A98">J+7</text>
              <text x="280" y="265" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#9A9A98">J+30</text>
              <text x="345" y="265" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#9A9A98">J+120</text>
              <text x="15" y="50" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#9A9A98">100%</text>
              <text x="20" y="240" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#9A9A98">0%</text>

              {/* Sans révision (rouge) */}
              <path d="M 40 50 Q 80 130, 120 180 T 200 215 T 370 235" stroke="#C75050" strokeWidth="2" fill="none" />
              <text x="285" y="225" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="11" fill="#C75050">Sans révision</text>

              {/* Avec MedRev (vert) — points */}
              <circle cx="40" cy="50" r="4" fill="#1B4332" />
              <circle cx="80" cy="55" r="4" fill="#1B4332" />
              <circle cx="120" cy="60" r="4" fill="#1B4332" />
              <circle cx="160" cy="62" r="4" fill="#1B4332" />
              <circle cx="200" cy="65" r="4" fill="#1B4332" />
              <circle cx="240" cy="66" r="4" fill="#1B4332" />
              <circle cx="280" cy="68" r="4" fill="#1B4332" />
              <circle cx="320" cy="70" r="4" fill="#1B4332" />
              <circle cx="360" cy="71" r="4" fill="#1B4332" />
              <path d="M 40 50 L 80 55 L 120 60 L 160 62 L 200 65 L 240 66 L 280 68 L 320 70 L 360 71" stroke="#1B4332" strokeWidth="2" fill="none" />
              <text x="240" y="55" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="11" fill="#1B4332">Avec MedRev</text>
            </svg>
          </div>
        </div>
      </section>

      {/* Section 2 — Les 14 paliers */}
      <section className="lp-section" style={{ paddingTop: 40 }}>
        <div className="lp-method-block reverse">
          <div className="lp-method-text">
            <div className="lp-section-kicker">02 · La solution</div>
            <h2 className="lp-section-h2" style={{ textAlign: 'left', margin: '0 0 18px' }}>
              <em>14 paliers</em> de J0 à J+120.
            </h2>
            <p className="lp-method-p">
              MedRev divise l&apos;apprentissage en <strong>14 paliers</strong> :
              J0, J+1, J+3, J+5, J+7, J+15, J+21, J+30, J+45, J+60, J+75,
              J+90, J+105, J+120.
            </p>
            <p className="lp-method-p">
              À chaque palier, tu te notes <strong>de 1 à 5</strong> sur ta
              maîtrise du sujet. Note basse = la prochaine révision est
              re-programmée plus tôt. Note haute = on espace.
            </p>
            <p className="lp-method-p">
              Pas de boîte de Leitner. Pas de courbe à calculer. Tu ouvres
              ton dashboard le matin, MedRev te dit <strong>« voici les 7
              fiches à réviser aujourd&apos;hui »</strong>.
            </p>
          </div>
          <div className="lp-method-visual">
            <div className="lp-method-stamps">
              {[
                { j: 'J0', s: 5 }, { j: 'J+1', s: 4 }, { j: 'J+3', s: 4 },
                { j: 'J+5', s: 5 }, { j: 'J+7', s: 4 }, { j: 'J+15', s: 5 },
                { j: 'J+21', s: 5 }, { j: 'J+30', s: 4 }, { j: 'J+45', s: 5 },
                { j: 'J+60', s: 0 }, { j: 'J+75', s: 0 }, { j: 'J+90', s: 0 },
                { j: 'J+105', s: 0 }, { j: 'J+120', s: 0 },
              ].map((p, i) => (
                <div key={i} className="lp-method-stamp-col">
                  <div className={`lp-method-stamp s${p.s}`}>{p.s > 0 ? p.s : '·'}</div>
                  <div className="lp-method-stamp-lbl">{p.j}</div>
                </div>
              ))}
            </div>
            <div className="lp-method-stamps-note">
              9 paliers déjà notés sur cette fiche · les 5 derniers attendent leur tour
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — IA */}
      <section className="lp-section" style={{ paddingTop: 40 }}>
        <div className="lp-method-block">
          <div className="lp-method-text">
            <div className="lp-section-kicker">03 · L&apos;IA</div>
            <h2 className="lp-section-h2" style={{ textAlign: 'left', margin: '0 0 18px' }}>
              <em>30 QCM</em> en 90 secondes.
            </h2>
            <p className="lp-method-p">
              Tu charges la <strong>vidéo de la rediffusion</strong> du cours
              et le <strong>poly PDF</strong>. MedRev les envoie à Gemini
              (Google), qui transcrit l&apos;audio puis génère 30 QCM type
              concours.
            </p>
            <p className="lp-method-p">
              Chaque question vient avec un <strong>retour direct vers la
              source</strong> : si tu te trompes, tu vois le timestamp dans
              la vidéo ou la page exacte du PDF. Pas besoin de fouiller.
            </p>
            <p className="lp-method-p">
              Format strict : 5 options A-E, niveau annales EDN. Mix de QCS
              (une seule bonne réponse) et de QCM (plusieurs bonnes), comme
              au vrai concours. Les options sont mélangées aléatoirement après
              génération pour casser le biais des LLM (qui placent souvent
              la bonne en B/C).
            </p>
            <p className="lp-method-p" style={{ fontFamily: 'var(--lp-fi)', fontStyle: 'italic', color: 'var(--lp-text-soft)' }}>
              Coût pour toi : 0 € pour 10 générations en gratuit, illimité
              en Premium. Coût pour nous : ~1 centime par génération.
              Transparent.
            </p>
          </div>
          <div className="lp-method-visual">
            <div className="lp-method-qcm">
              <div className="lp-method-qcm-source">
                <span className="lp-method-source-icon">▶</span>
                cours-glycolyse.mp4 · 47 min
              </div>
              <div className="lp-method-qcm-arrow">↓</div>
              <div className="lp-method-qcm-card">
                <div className="lp-method-qcm-kicker">Question 12 / 30</div>
                <div className="lp-method-qcm-q">
                  L&apos;enzyme régulatrice de la glycolyse, dont l&apos;activité
                  est inhibée par l&apos;ATP, est :
                </div>
                <div className="lp-method-qcm-opts">
                  <div className="lp-method-qcm-opt">A. Hexokinase</div>
                  <div className="lp-method-qcm-opt ok">B. Phosphofructokinase ✓</div>
                  <div className="lp-method-qcm-opt">C. Pyruvate kinase</div>
                  <div className="lp-method-qcm-opt">D. Aldolase</div>
                  <div className="lp-method-qcm-opt">E. Énolase</div>
                </div>
                <div className="lp-method-qcm-source-ref">
                  <span className="lp-method-source-icon" style={{ fontSize: 9 }}>▶</span>
                  Source : Vidéo · 18:42
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 — Mode angles morts */}
      <section className="lp-section" style={{ paddingTop: 40 }}>
        <div className="lp-method-block reverse">
          <div className="lp-method-text">
            <div className="lp-section-kicker">04 · Le mode angles morts</div>
            <h2 className="lp-section-h2" style={{ textAlign: 'left', margin: '0 0 18px' }}>
              <em>80 % du temps</em> sur 20 % du programme.
            </h2>
            <p className="lp-method-p">
              Le simulateur peut tourner en deux modes : <strong>aléatoire</strong>
              (toutes tes fiches au hasard) ou <strong>angles morts</strong>
              (cible automatiquement les fiches où tu as les notes les plus
              basses).
            </p>
            <p className="lp-method-p">
              L&apos;algo est simple : on pondère chaque question par
              <em> max(0.5, 5 − moyenne_de_la_fiche)</em>. Une fiche notée
              2/5 a 3 fois plus de chances de tomber qu&apos;une fiche notée
              4,5/5.
            </p>
            <p className="lp-method-p">
              Résultat : tu passes ton temps sur <strong>les notions où tu
              perds le concours</strong>, pas sur celles que tu maîtrises
              déjà.
            </p>
          </div>
          <div className="lp-method-visual">
            <div className="lp-method-bars">
              <div className="lp-method-bar-row">
                <span className="lp-method-bar-name">Glycolyse</span>
                <span className="lp-method-bar-track"><span className="lp-method-bar-fill s5" style={{ width: '92%' }} /></span>
                <span className="lp-method-bar-val">4.6</span>
                <span className="lp-method-bar-weight">×0.5</span>
              </div>
              <div className="lp-method-bar-row">
                <span className="lp-method-bar-name">Lipides</span>
                <span className="lp-method-bar-track"><span className="lp-method-bar-fill s4" style={{ width: '78%' }} /></span>
                <span className="lp-method-bar-val">3.9</span>
                <span className="lp-method-bar-weight">×1.1</span>
              </div>
              <div className="lp-method-bar-row weak">
                <span className="lp-method-bar-name">Acides aminés</span>
                <span className="lp-method-bar-track"><span className="lp-method-bar-fill s2" style={{ width: '38%' }} /></span>
                <span className="lp-method-bar-val">1.9</span>
                <span className="lp-method-bar-weight">×3.1</span>
              </div>
              <div className="lp-method-bar-row weak">
                <span className="lp-method-bar-name">Cycle de Krebs</span>
                <span className="lp-method-bar-track"><span className="lp-method-bar-fill s2" style={{ width: '44%' }} /></span>
                <span className="lp-method-bar-val">2.2</span>
                <span className="lp-method-bar-weight">×2.8</span>
              </div>
              <div className="lp-method-bar-row">
                <span className="lp-method-bar-name">Photosynthèse</span>
                <span className="lp-method-bar-track"><span className="lp-method-bar-fill s4" style={{ width: '82%' }} /></span>
                <span className="lp-method-bar-val">4.1</span>
                <span className="lp-method-bar-weight">×0.9</span>
              </div>
            </div>
            <div className="lp-method-stamps-note">
              Mode angles morts · les fiches faibles tirées 3× plus souvent
            </div>
          </div>
        </div>
      </section>

      {/* Section 5 — Bibliothèque */}
      <section className="lp-section" style={{ paddingTop: 40 }}>
        <div className="lp-method-block">
          <div className="lp-method-text">
            <div className="lp-section-kicker">05 · La bibliothèque</div>
            <h2 className="lp-section-h2" style={{ textAlign: 'left', margin: '0 0 18px' }}>
              Une <em>gamification</em> qui ne te trahit pas.
            </h2>
            <p className="lp-method-p">
              À chaque <strong>révision notée</strong> (J0, J1, J3, J7… les
              14 paliers que chaque fiche traverse), tu ajoutes
              <strong> un livre</strong> à ta bibliothèque virtuelle. Sur
              l&apos;année, ça correspond à <strong>2000 livres</strong> et
              autant d&apos;heures d&apos;études cumulées.
            </p>
            <p className="lp-method-p">
              <strong>6 trésors</strong> se débloquent à 100, 300, 600, 900,
              1200 et 1500 livres : un buste d&apos;Hippocrate, un sablier
              en laiton, un chandelier sur des manuscrits, un globe terrestre,
              une plume sur des manuscrits, un codex sur lutrin.
            </p>
            <p className="lp-method-p">
              Pas de <em>streaks anxiogènes</em>, pas de XP à farmer, pas
              de <em>« ne casse pas ta série ! »</em>. Juste une bibliothèque
              qui s&apos;étoffe, à ton rythme. Tu peux la regarder pendant
              tes sessions Focus.
            </p>
          </div>
          <div className="lp-method-visual">
            <div className="lp-method-biblio">
              <div className="lp-method-biblio-shelves">
                {[0, 1, 2, 3, 4].map(shelf => (
                  <div key={shelf} className="lp-method-biblio-shelf">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const palette = ['#5A2424', '#1F2E50', '#2A4030', '#7A4A2A', '#3A2030', '#4A2840', '#3D2A14']
                      const filled = shelf < 3 || (shelf === 3 && i < 12)
                      return (
                        <span
                          key={i}
                          className="lp-method-biblio-book"
                          style={{
                            background: filled ? palette[(shelf * 28 + i) % palette.length] : '#EBEAE5',
                            opacity: filled ? 1 : 0.5,
                            height: 26 + (i % 4) * 2,
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="lp-method-biblio-meta">
                <span><strong>96</strong> ouvrages · 2000 max</span>
                <span style={{ color: 'var(--lp-gold)' }}>Prochain trésor : 100 livres</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="lp-cta">
        <h2 className="lp-cta-h2">
          Prêt·e à tester <em>la méthode ?</em>
        </h2>
        <p className="lp-cta-sub">
          Crée ton compte gratuit, charge ton premier cours, et regarde MedRev
          générer 30 QCM en 90 secondes.
        </p>
        <div className="lp-cta-buttons">
          <Link href="/auth" className="lp-btn-primary">Commencer gratuit →</Link>
          <Link href="/pricing" className="lp-btn-secondary">Voir les tarifs</Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
