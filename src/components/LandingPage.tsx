'use client'
// src/components/LandingPage.tsx
//
// Landing page MedRev — version refonte mai 2026 inspirée de resend.com.
// Palette claire « cabinet d'érudit moderne ». L'auth (signup/login) a été
// extraite vers /auth ; cette page n'a que du contenu marketing.

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import './landing-styles.css'

const STREAM_ITEMS = [
  { time: '14:32', tag: 'IA',    cls: 'lp-stream-tag-ai',    msg: '30 QCM générés depuis Vidéo Cardio · ', em: '1.2 min', status: 'OK' },
  { time: '14:31', tag: 'NOTE',  cls: 'lp-stream-tag-note',  msg: 'Fiche Anatomie générale notée · ',     em: '5/5',     status: '+12h étudiées' },
  { time: '14:28', tag: 'SIMU',  cls: 'lp-stream-tag-simu',  msg: 'Session simulateur 30 questions · ',  em: '87%',     status: 'examen blanc' },
  { time: '14:24', tag: 'IA',    cls: 'lp-stream-tag-ai',    msg: 'Transcript généré · vidéo SSH ',       em: '47 min',  status: 'transcript prêt' },
  { time: '14:22', tag: 'FOCUS', cls: 'lp-stream-tag-focus', msg: 'Session Focus · ',                     em: '3 fiches révisées', status: '+1 livre' },
  { time: '14:18', tag: 'NOTE',  cls: 'lp-stream-tag-note',  msg: 'Glycolyse · revue J+15 · ',            em: '4/5',     status: 'maîtrisée' },
  { time: '14:14', tag: 'IA',    cls: 'lp-stream-tag-ai',    msg: '+30 QCM ajoutés à Pharmacologie · ',   em: 'total 60', status: 'OK' },
  { time: '14:10', tag: 'SIMU',  cls: 'lp-stream-tag-simu',  msg: 'Mode angles morts · ',                 em: '20 questions ciblées', status: 'session lancée' },
  { time: '14:06', tag: 'NOTE',  cls: 'lp-stream-tag-note',  msg: 'Biophysique · J+7 · ',                 em: '3/5',     status: 'à retravailler' },
  { time: '14:02', tag: 'FOCUS', cls: 'lp-stream-tag-focus', msg: 'Bibliothèque +1 ouvrage · ',           em: 'total 47/2000', status: 'progression' },
]

export default function LandingPage() {
  return (
    <div className="lp-page">
      <MarketingNav current="home" />

      {/* HERO */}
      <section className="lp-hero">
        <span className="lp-hero-kicker">Pour les P1 · Rentrée 2026</span>
        <h1 className="lp-hero-h1">
          La P1 sans
          <span className="line2"><em>les cahiers.</em></span>
        </h1>
        <p className="lp-hero-sub">
          Importe tes cours, <strong>MedRev génère les QCM</strong>, planifie
          tes révisions, et te dit chaque jour quoi travailler. La méthode
          des prépas, sans le prix.
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
        <DashboardMockup />
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

      {/* COMMENT ÇA MARCHE */}
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

      {/* STREAM */}
      <section className="lp-stream">
        <div className="lp-stream-card">
          <div className="lp-stream-head">
            <div className="lp-stream-kicker">Sous le capot</div>
            <h2 className="lp-stream-title">Une journée P1 sur MedRev <em>en temps réel.</em></h2>
          </div>
          <div className="lp-stream-feed">
            <div className="lp-stream-list">
              {[...STREAM_ITEMS, ...STREAM_ITEMS].map((it, i) => (
                <div key={i} className="lp-stream-item">
                  <span className="lp-stream-time">{it.time}</span>
                  <span className={`lp-stream-tag ${it.cls}`}>{it.tag}</span>
                  <span className="lp-stream-msg">{it.msg}<em>{it.em}</em></span>
                  <span className="lp-stream-status">{it.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section">
        <div className="lp-section-head">
          <div className="lp-section-kicker">Ce que tu débloques</div>
          <h2 className="lp-section-h2">Un coach, <em>pas un cahier.</em></h2>
          <p className="lp-section-sub">Anki ne sait pas que tes partiels sont dans trois semaines. MedRev oui. Et il sait quoi faire à propos.</p>
        </div>
        <div className="lp-features">
          {[
            { icon: '▦', title: 'Bibliothèque vivante', desc: "Chaque fiche notée ajoute un livre à ta bibliothèque virtuelle. 2000 ouvrages à amasser, 6 trésors à débloquer." },
            { icon: '◷', title: 'Courbe J intelligente', desc: "14 paliers de J0 à J+120. Une note basse re-programme une révision automatiquement." },
            { icon: '⊕', title: 'Sessions Focus', desc: "Mode plein écran, distractions verrouillées. La bibliothèque en fond." },
            { icon: '◎', title: 'Mode angles morts', desc: "Le simulateur cible tes fiches faibles. 80 % du temps sur 20 % des notions." },
            { icon: '∿', title: 'Stats avancées', desc: "Heatmap année, sparkline 12 sem, dumbbell par matière. Vois où tu progresses." },
            { icon: '▶', title: 'Examen blanc', desc: "Type concours : timer, grille, 0 indice avant la fin. Comme le vrai jour." },
            { icon: '◆', title: 'Multi-fac auto-config', desc: "Tes matières S1 et S2 prêtes dès l'inscription, selon ta fac." },
            { icon: '◉', title: 'Données en France', desc: "Hébergé sur Supabase Europe. Aucune donnée ne quitte l'UE." },
            { icon: '∅', title: 'Aucune publicité', desc: "Jamais. C'est ce que paye ton plan Premium." },
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
            « Une P1 typique fait <strong>40 à 60 fiches</strong> dans
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
          Pré-configure ton compte en 2 minutes. Tes matières Sorbonne / Paris Cité /
          Lyon… sont déjà prêtes selon ta fac.
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
// DASHBOARD MOCKUP — visuel hero
// ============================================================
function DashboardMockup() {
  return (
    <div className="lp-hero-mockup">
      <div className="lp-hero-mockup-bar">
        <div className="lp-hero-mockup-dots">
          <span className="lp-hero-mockup-dot" />
          <span className="lp-hero-mockup-dot" />
          <span className="lp-hero-mockup-dot" />
        </div>
        <div className="lp-hero-mockup-url">med-rev.app / dashboard</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="lp-hero-mockup-stage">
        <svg viewBox="0 0 1080 608" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <rect width="1080" height="608" fill="#FAFAF7" />
          <rect x="0" y="0" width="180" height="608" fill="#F0EEE9" />
          <rect x="0" y="0" width="180" height="60" fill="#FAFAF7" />
          <text x="22" y="38" fontFamily="Cinzel,serif" fontSize="14" fill="#1B4332" letterSpacing="2.5">MED·REV</text>
          <rect x="12" y="78" width="156" height="32" rx="6" fill="rgba(45,106,79,0.10)" />
          <rect x="20" y="86" width="14" height="14" rx="2" fill="#1B4332" opacity="0.7" />
          <text x="42" y="98" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#1A1A1A" fontWeight="500">Aujourd&apos;hui</text>
          <rect x="20" y="124" width="14" height="14" rx="2" fill="#9A9A98" /><text x="42" y="136" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#5C5C5A">Mes matières</text>
          <rect x="20" y="158" width="14" height="14" rx="2" fill="#9A9A98" /><text x="42" y="170" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#5C5C5A">Calendrier</text>
          <rect x="20" y="192" width="14" height="14" rx="2" fill="#9A9A98" /><text x="42" y="204" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#5C5C5A">Simulateur</text>
          <rect x="20" y="226" width="14" height="14" rx="2" fill="#9A9A98" /><text x="42" y="238" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#5C5C5A">Statistiques</text>
          <text x="210" y="50" fontFamily="Fraunces,serif" fontSize="22" fill="#1A1A1A" fontWeight="500">Bonjour Camille</text>
          <text x="210" y="70" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="13" fill="#5C5C5A">Vendredi 8 mai · 7 fiches à réviser aujourd&apos;hui</text>
          <rect x="210" y="98" width="500" height="240" rx="12" fill="#FFFFFF" stroke="#E8E6E0" />
          <text x="228" y="124" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#1B4332" letterSpacing="2">À RÉVISER</text>
          <rect x="226" y="136" width="468" height="44" rx="8" fill="#FAFAF7" stroke="#E8E6E0" />
          <circle cx="246" cy="158" r="6" fill="#1B4332" />
          <text x="262" y="156" fontFamily="Plus Jakarta Sans" fontSize="12" fill="#1A1A1A" fontWeight="500">Anatomie · Système circulatoire</text>
          <text x="262" y="170" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="10.5" fill="#5C5C5A">J+15 · noté 4/5 il y a 7 jours</text>
          <rect x="640" y="146" width="44" height="22" rx="4" fill="#1B4332" />
          <text x="652" y="161" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#FFFFFF" fontWeight="600">RÉVISER</text>
          <rect x="226" y="186" width="468" height="44" rx="8" fill="#FAFAF7" stroke="#E8E6E0" />
          <circle cx="246" cy="208" r="6" fill="#7AA56B" />
          <text x="262" y="206" fontFamily="Plus Jakarta Sans" fontSize="12" fill="#1A1A1A" fontWeight="500">Biochimie · Glycolyse</text>
          <text x="262" y="220" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="10.5" fill="#5C5C5A">J+30 · prêt à valider</text>
          <rect x="640" y="196" width="44" height="22" rx="4" fill="#1B4332" />
          <text x="652" y="211" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#FFFFFF" fontWeight="600">RÉVISER</text>
          <rect x="226" y="236" width="468" height="44" rx="8" fill="#FAFAF7" stroke="#E8E6E0" />
          <circle cx="246" cy="258" r="6" fill="#D9B24A" />
          <text x="262" y="256" fontFamily="Plus Jakarta Sans" fontSize="12" fill="#1A1A1A" fontWeight="500">Pharmacologie · Bêta-bloquants</text>
          <text x="262" y="270" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="10.5" fill="#5C5C5A">J+7 · noté 3/5 hier</text>
          <rect x="640" y="246" width="44" height="22" rx="4" fill="#1B4332" />
          <text x="652" y="261" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#FFFFFF" fontWeight="600">RÉVISER</text>
          <rect x="210" y="354" width="500" height="200" rx="12" fill="#FFFFFF" stroke="#E8E6E0" />
          <text x="228" y="380" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#5C5C5A" letterSpacing="1.5">BIBLIOTHÈQUE · 47 / 2000</text>
          {(() => {
            const palette = ['#5A2424', '#1F2E50', '#2A4030', '#7A4A2A', '#3A2030', '#4A2840', '#3D2A14']
            return (
              <g transform="translate(228 396)">
                {Array.from({ length: 60 }).map((_, i) => {
                  const filled = i < 47
                  return (
                    <rect
                      key={i}
                      x={i * 8}
                      y={0}
                      width={6}
                      height={36 + (i % 4) * 4}
                      fill={filled ? palette[i % palette.length] : '#EBEAE5'}
                      opacity={filled ? 1 : 0.5}
                    />
                  )
                })}
              </g>
            )
          })()}
          <rect x="228" y="450" width="464" height="3" fill="#A48159" opacity="0.5" />
          <rect x="730" y="98" width="160" height="115" rx="12" fill="#FFFFFF" stroke="#E8E6E0" />
          <text x="746" y="120" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#5C5C5A" letterSpacing="1.5">RÉVISIONS</text>
          <text x="746" y="158" fontFamily="Fraunces,serif" fontSize="34" fill="#1B4332" fontWeight="500">147</text>
          <text x="746" y="180" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="11" fill="#5C5C5A">depuis octobre</text>
          <rect x="900" y="98" width="160" height="115" rx="12" fill="#FFFFFF" stroke="#E8E6E0" />
          <text x="916" y="120" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#5C5C5A" letterSpacing="1.5">SÉRIE</text>
          <text x="916" y="158" fontFamily="Fraunces,serif" fontSize="34" fill="#1B4332" fontWeight="500">14</text>
          <text x="916" y="180" fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="11" fill="#5C5C5A">jours d&apos;affilée</text>
          <rect x="730" y="229" width="330" height="125" rx="12" fill="#FFFFFF" stroke="#E8E6E0" />
          <text x="746" y="251" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#5C5C5A" letterSpacing="1.5">CETTE SEMAINE</text>
          <polyline points="746,322 770,310 794,302 818,296 842,288 866,280 890,272 914,264 938,260 962,254 986,250 1010,242 1034,236" stroke="#1B4332" strokeWidth="1.8" fill="none" />
          <rect x="730" y="370" width="330" height="184" rx="12" fill="#FFFFFF" stroke="#E8E6E0" />
          <text x="746" y="392" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#1B4332" letterSpacing="1.5">QCM IA · NOUVEAU</text>
          <text x="746" y="416" fontFamily="Fraunces,serif" fontSize="13" fill="#1A1A1A">L&apos;enzyme régulatrice de</text>
          <text x="746" y="432" fontFamily="Fraunces,serif" fontSize="13" fill="#1A1A1A">la glycolyse est :</text>
          <rect x="746" y="448" width="298" height="22" rx="4" fill="#FAFAF7" stroke="#E8E6E0" />
          <text x="756" y="463" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#5C5C5A">A. Hexokinase</text>
          <rect x="746" y="474" width="298" height="22" rx="4" fill="#DDECE3" />
          <rect x="746" y="474" width="298" height="22" rx="4" fill="none" stroke="#1B4332" strokeWidth="1" />
          <text x="756" y="489" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#1B4332" fontWeight="500">B. Phosphofructokinase ✓</text>
          <rect x="746" y="500" width="298" height="22" rx="4" fill="#FAFAF7" stroke="#E8E6E0" />
          <text x="756" y="515" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#5C5C5A">C. Pyruvate kinase</text>
          <text x="746" y="540" fontFamily="JetBrains Mono" fontSize="9" fill="#9A9A98">Source : Vidéo · 18:42</text>
        </svg>
      </div>
    </div>
  )
}
