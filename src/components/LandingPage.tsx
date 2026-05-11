'use client'
// src/components/LandingPage.tsx
//
// Landing page MedRev — version simplifiée mai 2026.
// Suite au feedback : H1 plus concret, hero épuré (1 mockup focalisé au
// lieu du dashboard dense), stream "Sous le capot" supprimée, features
// réduites de 9 à 6.

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import './landing-styles.css'

export default function LandingPage() {
  return (
    <div className="lp-page">
      <MarketingNav current="home" />

      {/* HERO — simplifié */}
      <section className="lp-hero">
        <span className="lp-hero-kicker">Pour les P1 · Rentrée 2026</span>
        <h1 className="lp-hero-h1">
          Tes cours, tes QCM,
          <span className="line2"><em>ton planning.</em></span>
        </h1>
        <p className="lp-hero-sub">
          Importe ta vidéo de cours et ton poly. <strong>MedRev génère 30
          QCM</strong>, programme tes 14 paliers de révision, et te dit
          chaque jour quoi travailler. <em>La méthode des prépas, sans
          le prix.</em>
        </p>
        <div className="lp-hero-ctas">
          <Link href="/auth" className="lp-btn-primary">Commencer gratuit →</Link>
          <Link href="/methode" className="lp-btn-secondary">▶ Voir la méthode</Link>
        </div>
        <div className="lp-trust-row">
          <span><span className="lp-trust-dot" />Gratuit pour démarrer</span>
          <span><span className="lp-trust-dot" />Données en France</span>
          <span><span className="lp-trust-dot" />Sans pub, sans engagement</span>
        </div>

        {/* Mockup focal : un seul card QCM avec source vidéo, pas le dashboard
            entier. Communique en un coup d'œil ce que MedRev fait. */}
        <FocusedMockup />
      </section>

      {/* FACS */}
      <section className="lp-facs">
        <div className="lp-facs-label">Conçu pour les P1 françaises</div>
        <div className="lp-facs-grid">
          <div className="lp-fac-name">Sorbonne Université<em>Paris 6</em></div>
          <div className="lp-fac-name">Université Paris Cité<em>Paris 5</em></div>
          <div className="lp-fac-name">Sorbonne Paris Nord<em>Paris 13</em></div>
          <div className="lp-fac-name">UPEC<em>Créteil</em></div>
          <div className="lp-fac-name">Université de Lyon<em>Lyon</em></div>
          <div className="lp-fac-name">Montpellier<em>Hérault</em></div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE — gardé tel quel, c'est clair */}
      <section className="lp-section">
        <div className="lp-section-head">
          <div className="lp-section-kicker">La méthode</div>
          <h2 className="lp-section-h2">Trois gestes, <em>zéro organisation manuelle.</em></h2>
          <p className="lp-section-sub">
            Tu donnes tes cours. MedRev fait le reste : QCM, planning, sessions
            de révision et statistiques pour mesurer ta progression.
          </p>
        </div>
        <div className="lp-steps">
          <div className="lp-step">
            <span className="lp-step-num">01</span>
            <h3 className="lp-step-title">Importe ton cours</h3>
            <p className="lp-step-desc">Vidéo de la rediffusion ou poly PDF. Glisse-dépose, c&apos;est tout.</p>
            <div className="lp-step-mockup">
              <div className="lp-mockup-import">
                <div className="lp-mockup-file"><span className="lp-mockup-file-icon">▶</span>cours-cardio.mp4<span className="lp-mockup-file-meta">142 Mo</span></div>
                <div className="lp-mockup-file"><span className="lp-mockup-file-icon">P</span>poly-cardio-2026.pdf<span className="lp-mockup-file-meta">8 Mo</span></div>
              </div>
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step-num">02</span>
            <h3 className="lp-step-title">L&apos;IA génère 30 QCM</h3>
            <p className="lp-step-desc">Type concours, avec retour direct vers le passage source.</p>
            <div className="lp-step-mockup">
              <div style={{ width: '100%' }}>
                <div className="lp-mockup-qcm-q">L&apos;enzyme régulatrice de la glycolyse est :</div>
                <div className="lp-mockup-qcm-opts">
                  <div className="lp-mockup-qcm-opt">A. Hexokinase</div>
                  <div className="lp-mockup-qcm-opt ok">B. Phosphofructokinase ✓</div>
                  <div className="lp-mockup-qcm-opt">C. Pyruvate kinase</div>
                </div>
              </div>
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step-num">03</span>
            <h3 className="lp-step-title">Le planning J se construit</h3>
            <p className="lp-step-desc">14 paliers J0 → J+120 basés sur la courbe d&apos;Ebbinghaus.</p>
            <div className="lp-step-mockup">
              <div className="lp-mockup-cal">
                <span className="lp-mockup-cal-stamp s5">5</span>
                <span className="lp-mockup-cal-stamp s4">4</span>
                <span className="lp-mockup-cal-stamp s5">5</span>
                <span className="lp-mockup-cal-stamp s3">3</span>
                <span className="lp-mockup-cal-stamp s4">4</span>
                <span className="lp-mockup-cal-stamp s5">5</span>
                <span className="lp-mockup-cal-stamp future">·</span>
                <span className="lp-mockup-cal-stamp future">·</span>
                <span className="lp-mockup-cal-stamp future">·</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES — 6 au lieu de 9 */}
      <section className="lp-section">
        <div className="lp-section-head">
          <div className="lp-section-kicker">Ce que tu débloques</div>
          <h2 className="lp-section-h2">Un coach, <em>pas un cahier.</em></h2>
          <p className="lp-section-sub">
            Tes fiches en vrac ne savent pas que tes partiels sont dans trois semaines.
            MedRev oui. Et il sait quoi faire à propos.
          </p>
        </div>
        <div className="lp-features">
          {[
            { icon: '▦', title: 'Bibliothèque vivante', desc: "Chaque fiche notée ajoute un livre. 2000 ouvrages à amasser sur l'année, 6 trésors à débloquer aux paliers 100, 300, 600, 900, 1200 et 1500." },
            { icon: '◷', title: 'Courbe J intelligente', desc: "14 paliers de J0 à J+120. Une note basse re-programme une révision automatiquement. Une note haute t'épargne." },
            { icon: '⊕', title: 'Sessions Focus', desc: "Mode plein écran, distractions verrouillées. La bibliothèque en fond, tu coches tes fiches du jour. Apaisant." },
            { icon: '◎', title: 'Mode angles morts', desc: "Le simulateur cible tes fiches faibles automatiquement. 80 % du temps sur 20 % des notions à problème." },
            { icon: '∿', title: 'Stats avancées', desc: "Heatmap année 52 sem, sparkline 12 sem, dumbbell par matière. Vois où tu progresses, où tu stagnes." },
            { icon: '▶', title: 'Examen blanc', desc: "Type concours : timer, grille de réponses, 0 indice avant la fin. Avec corrigé détaillé après. Comme le vrai jour." },
          ].map((f) => (
            <div key={f.title} className="lp-feature">
              <div className="lp-feature-icon">{f.icon}</div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROOF */}
      <section className="lp-section">
        <div className="lp-proof">
          <p className="lp-proof-quote">
            « Une P1 typique fait <strong>environ 200 fiches</strong> dans
            l&apos;année. MedRev les organise toutes pour toi, te génère
            <strong> 1200+ QCM</strong> sur tes vrais cours, et te demande
            chaque jour <strong>quoi réviser</strong>. »
          </p>
          <div className="lp-proof-stats">
            <div><div className="lp-proof-stat-num">1200+</div><div className="lp-proof-stat-lbl">QCM générés</div></div>
            <div><div className="lp-proof-stat-num">14</div><div className="lp-proof-stat-lbl">Paliers J</div></div>
            <div><div className="lp-proof-stat-num">6</div><div className="lp-proof-stat-lbl">Trésors</div></div>
            <div><div className="lp-proof-stat-num">100 %</div><div className="lp-proof-stat-lbl">Auto-organisé</div></div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-cta">
        <h2 className="lp-cta-h2">
          La P1 commence.<br />
          <em>Tu commences avec elle.</em>
        </h2>
        <p className="lp-cta-sub">
          Pré-configure ton compte en 2 minutes. Tes matières Sorbonne /
          Paris Cité / Lyon… sont déjà prêtes selon ta fac.
        </p>
        <div className="lp-cta-buttons">
          <Link href="/auth" className="lp-btn-primary">Créer mon compte →</Link>
          <Link href="/pricing" className="lp-btn-secondary">Voir les tarifs détaillés</Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

// ============================================================
// FOCUSED MOCKUP — visualise « ta vidéo → l'IA → 1 QCM avec source »
// Beaucoup plus simple que le dashboard complet : une seule chose à
// regarder, on comprend en 1 seconde ce que MedRev fait.
// ============================================================
function FocusedMockup() {
  return (
    <div className="lp-focus-mockup">
      <div className="lp-focus-source">
        <span className="lp-focus-icon">▶</span>
        <span className="lp-focus-source-name">cours-glycolyse.mp4</span>
        <span className="lp-focus-source-meta">47 min · uploadé</span>
      </div>

      <div className="lp-focus-arrow">
        <div className="lp-focus-arrow-label">L&apos;IA en 90 secondes</div>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="lp-focus-card">
        <div className="lp-focus-card-kicker">Question 12 / 30</div>
        <div className="lp-focus-card-q">
          L&apos;enzyme régulatrice de la glycolyse, dont l&apos;activité est
          inhibée par l&apos;ATP, est :
        </div>
        <div className="lp-focus-card-opts">
          <div className="lp-focus-card-opt">A. Hexokinase</div>
          <div className="lp-focus-card-opt ok">B. Phosphofructokinase ✓</div>
          <div className="lp-focus-card-opt">C. Pyruvate kinase</div>
          <div className="lp-focus-card-opt">D. Aldolase</div>
          <div className="lp-focus-card-opt">E. Énolase</div>
        </div>
        <div className="lp-focus-card-source">
          <span className="lp-focus-icon-small">▶</span>
          Source : Vidéo · 18:42
        </div>
      </div>
    </div>
  )
}
