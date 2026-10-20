// src/components/HomeLanding.tsx
//
// Page d'accueil publique (refonte octobre 2026). Server Component, sans JS :
// toutes les animations sont en CSS (animation-timeline: view()), donc elles
// tournent au défilement sans rien charger. Sur un navigateur qui ne sait pas
// faire, chaque scène s'affiche directement dans son état final.
//
// Les classes sont toutes préfixées hl- pour ne jamais entrer en collision
// avec les autres styles.css de l'appli (Next.js ne décharge pas les CSS).
// L'ancienne landing (LandingPage.tsx + landing-styles.css) n'est plus
// utilisée par la page d'accueil, mais landing-styles.css reste nécessaire
// pour /auth, /methode, /cgu, etc.

import Link from 'next/link'
import type { CSSProperties } from 'react'
import MedRevMark from '@/components/MedRevMark'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import ScrollFallback from '@/components/ScrollFallback'
import './home-landing.css'

export default function HomeLanding() {
  return (
    <div className="hl-mr-root" style={{ '--acc': '#22507E' } as CSSProperties}>
      <MarketingNav current="home" />

      {/* HERO */}
      <section id="haut" className="hl-hr">
        <div>
          <span className="hl-jt hl-hr-in" style={{ '--dl': '.05s' } as CSSProperties}>
            <i></i>Pour la P1 : PASS et LAS
          </span>
          <h1 className="hl-mr-h hl-hr-t hl-hr-in" style={{ '--dl': '.12s' } as CSSProperties}>
            Ta P1, organisée <span className="hl-mr-acc">toute seule.</span>
          </h1>
          <p className="hl-hr-s hl-hr-in" style={{ '--dl': '.22s' } as CSSProperties}>
            Tes cours deviennent des fiches, des QCM et un planning de révision. Sur ordinateur et sur téléphone.
          </p>
          <div className="hl-hr-ctas hl-hr-in" style={{ '--dl': '.32s' } as CSSProperties}>
            <Link className="hl-mr-btn" href="/auth">
              Commencer gratuitement
            </Link>
            <a className="hl-mr-btn hl-mr-btn-ghost" href="#pourquoi">
              Voir comment ça marche
            </a>
          </div>
          <p className="hl-hr-meta hl-hr-in" style={{ '--dl': '.4s' } as CSSProperties}>
            Gratuit pour commencer, sans carte bancaire.
          </p>
        </div>

        <div className="hl-dv" role="img" aria-label="MedRev sur ordinateur et sur téléphone : les fiches du jour à réviser">
          <div className="hl-lt" aria-hidden="true">
            <div className="hl-lt-lid">
              <div className="hl-lt-scr">
                <div className="hl-db">
                  <div className="hl-db-rail">
                    <MedRevMark bg="#22507E" fg="#fff" size={22} />
                    <div className="hl-db-ri hl-on">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 11l8-7 8 7v9H4z"></path>
                      </svg>
                    </div>
                    <div className="hl-db-ri">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7FB0D4" strokeWidth="2">
                        <rect x="5" y="3" width="14" height="18" rx="2"></rect>
                      </svg>
                    </div>
                    <div className="hl-db-ri">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7FB0D4" strokeWidth="2">
                        <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                        <path d="M3 10h18"></path>
                      </svg>
                    </div>
                    <div className="hl-db-ri">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7FB0D4" strokeWidth="2" strokeLinecap="round">
                        <path d="M5 20v-6M12 20V5M19 20v-9"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="hl-db-main">
                    <div className="hl-db-kick">Lundi 19 octobre</div>
                    <div className="hl-db-hi">Bonjour Léa</div>
                    <div className="hl-db-grid">
                      <div className="hl-pn">
                        <div className="hl-pn-h">
                          <div className="hl-pn-ic">
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 6v14M5 8v11a1 1 0 0 0 1 1h6M19 8v11a1 1 0 0 1-1 1h-6M5 8a3 3 0 0 1 3-3 4 4 0 0 1 4 3 4 4 0 0 1 4-3 3 3 0 0 1 3 3"></path>
                            </svg>
                          </div>
                          <div>
                            <div className="hl-pn-t">Fiches du jour</div>
                            <div className="hl-pn-s">
                              <b>5 fiches</b> à réviser
                            </div>
                          </div>
                          <span className="hl-pn-go">Commencer</span>
                        </div>
                        <div className="hl-fl">
                          <div className="hl-fi hl-hot">
                            <span className="hl-fi-tag" style={{ '--c': '#B5643C' } as CSSProperties}>
                              B
                            </span>
                            <div className="hl-fi-mid">
                              <div className="hl-fi-nm">Enzymologie</div>
                              <div className="hl-fi-sub">
                                Biochimie<span className="hl-fi-j">J+7</span>
                              </div>
                            </div>
                            <span className="hl-fi-late">en retard, 2 j</span>
                          </div>
                          <div className="hl-fi hl-hot">
                            <span className="hl-fi-tag" style={{ '--c': '#3E6F9C' } as CSSProperties}>
                              B
                            </span>
                            <div className="hl-fi-mid">
                              <div className="hl-fi-nm">Thermodynamique</div>
                              <div className="hl-fi-sub">
                                Biophysique<span className="hl-fi-j">J+15</span>
                              </div>
                            </div>
                            <span className="hl-fi-late">en retard, 1 j</span>
                          </div>
                          <div className="hl-fi">
                            <span className="hl-fi-tag" style={{ '--c': '#7A5BA6' } as CSSProperties}>
                              A
                            </span>
                            <div className="hl-fi-mid">
                              <div className="hl-fi-nm">Membre supérieur</div>
                              <div className="hl-fi-sub">
                                Anatomie<span className="hl-fi-j">J+3</span>
                              </div>
                            </div>
                            <span className="hl-fi-due">aujourd'hui</span>
                          </div>
                          <div className="hl-fi">
                            <span className="hl-fi-tag" style={{ '--c': '#2E8B6A' } as CSSProperties}>
                              B
                            </span>
                            <div className="hl-fi-mid">
                              <div className="hl-fi-nm">Cycle cellulaire</div>
                              <div className="hl-fi-sub">
                                Biologie cellulaire<span className="hl-fi-j">J+15</span>
                              </div>
                            </div>
                            <span className="hl-fi-due">aujourd'hui</span>
                          </div>
                          <div className="hl-fi">
                            <span className="hl-fi-tag" style={{ '--c': '#C08A2E' } as CSSProperties}>
                              H
                            </span>
                            <div className="hl-fi-mid">
                              <div className="hl-fi-nm">Épithéliums</div>
                              <div className="hl-fi-sub">
                                Histologie<span className="hl-fi-j">J+30</span>
                              </div>
                            </div>
                            <span className="hl-fi-due">aujourd'hui</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' } as CSSProperties}>
                        <div className="hl-pn">
                          <div className="hl-pn-t" style={{ fontSize: '11px', marginBottom: '4px' } as CSSProperties}>
                            À faire
                          </div>
                          <div className="hl-td hl-ok">
                            <i></i>
                            <span>Imprimer le poly d'anatomie</span>
                          </div>
                          <div className="hl-td">
                            <i></i>
                            <span>TD Chimie, mardi 14 h</span>
                          </div>
                          <div className="hl-td">
                            <i></i>
                            <span>Refaire l'annale 2025</span>
                          </div>
                        </div>
                        <div className="hl-pn">
                          <div className="hl-pn-t" style={{ fontSize: '11px' } as CSSProperties}>
                            Cette semaine
                          </div>
                          <div className="hl-wk">
                            <div>
                              <b className="hl-now" style={{ '--h': '72%' } as CSSProperties}></b>L
                            </div>
                            <div>
                              <b style={{ '--h': '54%' } as CSSProperties}></b>M
                            </div>
                            <div>
                              <b style={{ '--h': '86%' } as CSSProperties}></b>M
                            </div>
                            <div>
                              <b style={{ '--h': '40%' } as CSSProperties}></b>J
                            </div>
                            <div>
                              <b style={{ '--h': '62%' } as CSSProperties}></b>V
                            </div>
                            <div>
                              <b style={{ '--h': '28%' } as CSSProperties}></b>S
                            </div>
                            <div>
                              <b style={{ '--h': '20%' } as CSSProperties}></b>D
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hl-lt-base"></div>
          </div>

          <div className="hl-hp" aria-hidden="true">
            <div className="hl-ph">
              <div className="hl-ph-screen">
                <div className="hl-ph-cam"></div>
                <div className="hl-ph-top">
                  <b>MedRev</b>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M4 12h16M4 17h16"></path>
                  </svg>
                </div>
                <div className="hl-ph-body">
                  <div className="hl-ph-kick">Lundi 19 octobre</div>
                  <div className="hl-ph-hi">Bonjour Léa</div>
                  <div className="hl-pn">
                    <div className="hl-pn-h">
                      <div className="hl-pn-ic">
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 6v14M5 8v11a1 1 0 0 0 1 1h6M19 8v11a1 1 0 0 1-1 1h-6M5 8a3 3 0 0 1 3-3 4 4 0 0 1 4 3 4 4 0 0 1 4-3 3 3 0 0 1 3 3"></path>
                        </svg>
                      </div>
                      <div>
                        <div className="hl-pn-t">Fiches du jour</div>
                        <div className="hl-pn-s">
                          <b>5 fiches</b> à réviser
                        </div>
                      </div>
                    </div>
                    <div className="hl-fl">
                      <div className="hl-fi hl-hot">
                        <span className="hl-fi-tag" style={{ '--c': '#B5643C' } as CSSProperties}>
                          B
                        </span>
                        <div className="hl-fi-mid">
                          <div className="hl-fi-nm">Enzymologie</div>
                          <div className="hl-fi-sub">
                            Biochimie<span className="hl-fi-j">J+7</span>
                          </div>
                        </div>
                      </div>
                      <div className="hl-fi hl-hot">
                        <span className="hl-fi-tag" style={{ '--c': '#3E6F9C' } as CSSProperties}>
                          B
                        </span>
                        <div className="hl-fi-mid">
                          <div className="hl-fi-nm">Thermodynamique</div>
                          <div className="hl-fi-sub">
                            Biophysique<span className="hl-fi-j">J+15</span>
                          </div>
                        </div>
                      </div>
                      <div className="hl-fi">
                        <span className="hl-fi-tag" style={{ '--c': '#7A5BA6' } as CSSProperties}>
                          A
                        </span>
                        <div className="hl-fi-mid">
                          <div className="hl-fi-nm">Membre supérieur</div>
                          <div className="hl-fi-sub">
                            Anatomie<span className="hl-fi-j">J+3</span>
                          </div>
                        </div>
                      </div>
                      <div className="hl-fi">
                        <span className="hl-fi-tag" style={{ '--c': '#2E8B6A' } as CSSProperties}>
                          B
                        </span>
                        <div className="hl-fi-mid">
                          <div className="hl-fi-nm">Cycle cellulaire</div>
                          <div className="hl-fi-sub">
                            Biologie cellulaire<span className="hl-fi-j">J+15</span>
                          </div>
                        </div>
                      </div>
                      <div className="hl-fi">
                        <span className="hl-fi-tag" style={{ '--c': '#C08A2E' } as CSSProperties}>
                          H
                        </span>
                        <div className="hl-fi-mid">
                          <div className="hl-fi-nm">Épithéliums</div>
                          <div className="hl-fi-sub">
                            Histologie<span className="hl-fi-j">J+30</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* J0 : POURQUOI (fond sombre) */}
      <section id="pourquoi" className="hl-wy" data-r0="-12.8" data-r1="107.2">
        <div
          className="hl-wy-stage"
          role="img"
          aria-label="En début de P1, des dizaines de chapitres à apprendre. MedRev les remet dans l&#x27;ordre, une fiche après l&#x27;autre."
        >
          <div aria-hidden="true">
            <span className="hl-wy-w" style={{ '--x': '5', '--y': '9', '--fs': '26px', '--o': '.5' } as CSSProperties}>
              Glycolyse
            </span>
            <span className="hl-wy-w" style={{ '--x': '38', '--y': '5', '--fs': '19px', '--o': '.35' } as CSSProperties}>
              Mitose
            </span>
            <span className="hl-wy-w" style={{ '--x': '60', '--y': '11', '--fs': '23px', '--o': '.45' } as CSSProperties}>
              Potentiel d'action
            </span>
            <span className="hl-wy-w" style={{ '--x': '80', '--y': '22', '--fs': '18px', '--o': '.3' } as CSSProperties}>
              Génétique
            </span>
            <span className="hl-wy-w" style={{ '--x': '3', '--y': '23', '--fs': '18px', '--o': '.3' } as CSSProperties}>
              Acides aminés
            </span>
            <span className="hl-wy-w" style={{ '--x': '72', '--y': '3', '--fs': '16px', '--o': '.28' } as CSSProperties}>
              Atomistique
            </span>
            <span className="hl-wy-w" style={{ '--x': '24', '--y': '17', '--fs': '22px', '--o': '.4' } as CSSProperties}>
              Embryologie
            </span>
            <span className="hl-wy-w" style={{ '--x': '46', '--y': '21', '--fs': '16px', '--o': '.28' } as CSSProperties}>
              Statistiques
            </span>
            <span className="hl-wy-w" style={{ '--x': '88', '--y': '35', '--fs': '20px', '--o': '.35' } as CSSProperties}>
              Rein
            </span>
            <span className="hl-wy-w" style={{ '--x': '2', '--y': '40', '--fs': '20px', '--o': '.35' } as CSSProperties}>
              Lipides
            </span>
            <span className="hl-wy-w" style={{ '--x': '76', '--y': '44', '--fs': '17px', '--o': '.3' } as CSSProperties}>
              Ostéologie
            </span>
            <span className="hl-wy-w" style={{ '--x': '10', '--y': '57', '--fs': '28px', '--o': '.45' } as CSSProperties}>
              ADN
            </span>
            <span className="hl-wy-w" style={{ '--x': '64', '--y': '60', '--fs': '19px', '--o': '.35' } as CSSProperties}>
              Santé publique
            </span>
            <span className="hl-wy-w" style={{ '--x': '28', '--y': '71', '--fs': '18px', '--o': '.3' } as CSSProperties}>
              Pharmacologie
            </span>
            <span className="hl-wy-w" style={{ '--x': '50', '--y': '76', '--fs': '19px', '--o': '.35' } as CSSProperties}>
              Mécanique des fluides
            </span>
            <span className="hl-wy-w" style={{ '--x': '84', '--y': '71', '--fs': '17px', '--o': '.3' } as CSSProperties}>
              Éthique
            </span>
            <span className="hl-wy-w" style={{ '--x': '6', '--y': '75', '--fs': '22px', '--o': '.4' } as CSSProperties}>
              Cœur
            </span>
            <span className="hl-wy-w" style={{ '--x': '34', '--y': '87', '--fs': '20px', '--o': '.35' } as CSSProperties}>
              Liaisons chimiques
            </span>
            <span className="hl-wy-w" style={{ '--x': '70', '--y': '88', '--fs': '24px', '--o': '.45' } as CSSProperties}>
              Optique
            </span>
            <span className="hl-wy-w" style={{ '--x': '12', '--y': '92', '--fs': '16px', '--o': '.28' } as CSSProperties}>
              Enzymes
            </span>

            <div className="hl-wy-li" style={{ '--x': '56', '--y': '29', '--i': '0' } as CSSProperties}>
              <span className="hl-bx">
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animationRange: 'contain 38% contain 40%' } as CSSProperties}>
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    fill="none"
                    stroke="#9CC4E8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              Enzymologie<span className="hl-jj">J+7</span>
            </div>
            <div className="hl-wy-li" style={{ '--x': '4', '--y': '64', '--i': '1' } as CSSProperties}>
              <span className="hl-bx">
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animationRange: 'contain 42% contain 44%' } as CSSProperties}>
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    fill="none"
                    stroke="#9CC4E8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              Thermodynamique<span className="hl-jj">J+15</span>
            </div>
            <div className="hl-wy-li" style={{ '--x': '58', '--y': '66', '--i': '2' } as CSSProperties}>
              <span className="hl-bx">
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animationRange: 'contain 46% contain 48%' } as CSSProperties}>
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    fill="none"
                    stroke="#9CC4E8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              Membre supérieur<span className="hl-jj">J+3</span>
            </div>
            <div className="hl-wy-li" style={{ '--x': '18', '--y': '31', '--i': '3' } as CSSProperties}>
              <span className="hl-bx">
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animationRange: 'contain 50% contain 52%' } as CSSProperties}>
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    fill="none"
                    stroke="#9CC4E8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              Cycle cellulaire<span className="hl-jj">J+15</span>
            </div>
            <div className="hl-wy-li" style={{ '--x': '70', '--y': '50', '--i': '4' } as CSSProperties}>
              <span className="hl-bx">
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animationRange: 'contain 54% contain 56%' } as CSSProperties}>
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    fill="none"
                    stroke="#9CC4E8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              Épithéliums<span className="hl-jj">J+30</span>
            </div>
            <div className="hl-wy-li" style={{ '--x': '30', '--y': '80', '--i': '5' } as CSSProperties}>
              <span className="hl-bx">
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animationRange: 'contain 58% contain 60%' } as CSSProperties}>
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    fill="none"
                    stroke="#9CC4E8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              Optique géométrique<span className="hl-jj">J+1</span>
            </div>

            <div className="hl-wy-a">
              <p className="hl-wy-kick">J0, première semaine de P1</p>
              <p className="hl-wy-t">
                Tout est à apprendre.
                <br />
                <em>Par quoi commencer ?</em>
              </p>
            </div>
            <div className="hl-wy-b">
              <p className="hl-wy-t" style={{ fontSize: 'clamp(28px, 4.4cqw, 50px)' } as CSSProperties}>
                MedRev met tout <em>dans l'ordre.</em>
              </p>
            </div>
            <div className="hl-wy-glow"></div>
            <div className="hl-wy-end">
              <MedRevMark bg="#22507E" fg="#fff" className="hl-wy-logo" />
              <div className="hl-wy-name">MedRev</div>
              <div className="hl-wy-tag">Ta P1, dans le bon ordre.</div>
            </div>
          </div>
        </div>
      </section>

      {/* J+1 : LA NOTE */}
      <section id="comment" className="hl-sn hl-sn-1" data-r0="-53.8" data-r1="208.8">
        <div className="hl-sn-stage">
          <div className="hl-sn-txt">
            <span className="hl-jt">
              <i></i>J+1, la note
            </span>
            <h2 className="hl-mr-h hl-sn-t">
              Tu te notes, <span className="hl-mr-acc">MedRev planifie.</span>
            </h2>
            <div className="hl-sn-cap">
              <p className="hl-c1">Après chaque révision, tu te notes de 1 à 5.</p>
              <p className="hl-c2">La note s'inscrit sur ta fiche, et la révision suivante est déjà prévue.</p>
            </div>
          </div>
          <div className="hl-sn-vis">
            <div
              className="hl-rm"
              role="img"
              aria-label="Après la révision J+1, l'étudiant choisit la note 4, Bien. La pastille J+1 devient verte et la prochaine révision est prévue à J+3"
            >
              <div aria-hidden="true">
                <div className="hl-rm-head">
                  <div>
                    <div className="hl-rm-kick">Session de révision</div>
                    <div className="hl-rm-title">Membre supérieur</div>
                    <div className="hl-rm-meta">Anatomie, J+1 prévue aujourd'hui</div>
                  </div>
                  <span className="hl-rm-x">×</span>
                </div>
                <div className="hl-rm-jp">
                  <div className="hl-rm-js">
                    <span className="hl-rm-jl">J+0</span>
                    <span className="hl-rm-st hl-s4"></span>
                    <span className="hl-rm-jst">Fait, 4/5</span>
                  </div>
                  <div className="hl-rm-js hl-s2-jbox">
                    <span className="hl-rm-jl">J+1</span>
                    <span className="hl-rm-st hl-s4 hl-s2-st"></span>
                    <span className="hl-rm-jst">
                      <span className="hl-s2-st1" style={{ position: 'absolute', left: '0', right: '0', opacity: 0 } as CSSProperties}>
                        Aujour­d'hui
                      </span>
                      <span className="hl-s2-st2">Fait, 4/5</span>
                    </span>
                  </div>
                  <div className="hl-rm-js hl-lock">
                    <span className="hl-rm-jl">J+3</span>
                    <span className="hl-rm-st hl-fu"></span>
                    <span className="hl-rm-jst">Dans 2 j</span>
                  </div>
                  <div className="hl-rm-js hl-lock">
                    <span className="hl-rm-jl">J+5</span>
                    <span className="hl-rm-st hl-fu"></span>
                    <span className="hl-rm-jst">Dans 4 j</span>
                  </div>
                  <div className="hl-rm-js hl-lock">
                    <span className="hl-rm-jl">J+7</span>
                    <span className="hl-rm-st hl-fu"></span>
                    <span className="hl-rm-jst">Dans 6 j</span>
                  </div>
                  <div className="hl-rm-js hl-lock">
                    <span className="hl-rm-jl">J+15</span>
                    <span className="hl-rm-st hl-fu"></span>
                    <span className="hl-rm-jst">Dans 14 j</span>
                  </div>
                  <div className="hl-rm-js hl-lock">
                    <span className="hl-rm-jl">J+21</span>
                    <span className="hl-rm-st hl-fu"></span>
                    <span className="hl-rm-jst">Dans 20 j</span>
                  </div>
                </div>
                <div className="hl-rm-div"></div>
                <div className="hl-rm-ask">Quelle note ?</div>
                <div className="hl-rm-sc">
                  <div className="hl-rm-s" style={{ '--c': '#C75050' } as CSSProperties}>
                    <b>1</b>
                    <span>À revoir</span>
                  </div>
                  <div className="hl-rm-s" style={{ '--c': '#E08B3C' } as CSSProperties}>
                    <b>2</b>
                    <span>Faible</span>
                  </div>
                  <div className="hl-rm-s" style={{ '--c': '#B8932E' } as CSSProperties}>
                    <b>3</b>
                    <span>Moyen</span>
                  </div>
                  <div
                    className="hl-rm-s hl-s2-s4"
                    style={{ '--c': '#5E8C50', borderColor: '#7AA56B', background: '#EEF4EA' } as CSSProperties}
                  >
                    <b>4</b>
                    <span>Bien</span>
                  </div>
                  <div className="hl-rm-s" style={{ '--c': '#1B4332' } as CSSProperties}>
                    <b>5</b>
                    <span>Maîtrisé</span>
                  </div>
                </div>
                <div className="hl-rm-toast hl-s2-toast">
                  <i></i>Note 4/5 enregistrée pour J+1. Prochaine révision : J+3.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* J+3 : LES QCM (le cours arrive, MedRev génère, on répond) */}
      <section id="qcm" className="hl-sn hl-sn-2" data-r0="-1.1" data-r1="126.2">
        <div className="hl-sn-stage">
          <div className="hl-sn-txt">
            <span className="hl-jt">
              <i></i>J+3, les QCM
            </span>
            <h2 className="hl-mr-h hl-sn-t">
              Ton cours devient <span className="hl-mr-acc">des QCM.</span>
            </h2>
            <div className="hl-sn-cap">
              <p className="hl-c1">Ajoute le poly ou la vidéo de l'amphi à ta fiche.</p>
              <p className="hl-c2">MedRev en tire 30 QCM, corrigés avec la page du cours.</p>
            </div>
          </div>
          <div className="hl-sn-vis">
            <div
              className="hl-qz"
              role="img"
              aria-label="On ajoute le poly du cours, MedRev génère 30 QCM, puis on répond à une question sur le nerf radial : trois bonnes réponses cochées, corrigées avec la page du poly"
            >
              <div className="hl-qz-file" aria-hidden="true">
                <i>PDF</i>poly-anatomie.pdf
              </div>

              {/* 1. la fiche reçoit le cours et lance la génération */}
              <div className="hl-qz-gen" aria-hidden="true" style={{ opacity: 0 }}>
                <div className="hl-rm-kick">Fiche</div>
                <div className="hl-rm-title">Membre supérieur</div>
                <div className="hl-rm-meta">Anatomie</div>
                <div className="hl-rm-div"></div>
                <div className="hl-rm-lbl">Cours</div>
                <div className="hl-rm-cours">
                  <div className="hl-rm-add hl-qz-add">
                    <span className="hl-rm-plus">+</span>Ajouter mon cours<em>PDF ou vidéo</em>
                  </div>
                  <div className="hl-rm-row hl-qz-pdf">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C47B2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"></path>
                      <path d="M14 3v5h5"></path>
                    </svg>
                    poly.pdf<em>46 pages</em>
                  </div>
                </div>
                <div className="hl-rm-div"></div>
                <div className="hl-qz-genbox">
                  <span className="hl-rm-cta hl-qz-btn">Générer 30 QCM</span>
                  <div className="hl-qz-load">
                    <div style={{ fontSize: '12px', color: '#5F5F58' }}>Génération… (30-60 s)</div>
                    <div className="hl-rm-prog">
                      <i></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. la question, comme dans l'appli */}
              <div className="hl-qz-q" aria-hidden="true">
                <div className="hl-qz-top">
                  <span>Membre supérieur</span>
                  <div className="hl-qz-bar">
                    <i></i>
                  </div>
                  <span className="hl-qz-n">1 / 30</span>
                </div>
                <div className="hl-qz-kick">
                  Question 1<span>QCM · plusieurs bonnes réponses</span>
                </div>
                <div className="hl-qz-stem">À propos du nerf radial :</div>
                <div className="hl-qz-opts">
                  <div className="hl-qz-o hl-ok" style={{ '--a': '49.8%', '--b': '53.6%' } as CSSProperties}>
                    <span className="hl-qz-ck"><i>✓</i><b>✓</b></span>
                    <span className="hl-qz-t">A. Il innerve le muscle triceps brachial.<em>Vrai · tu l'as cochée</em></span>
                  </div>
                  <div className="hl-qz-o hl-no">
                    <span className="hl-qz-ck"></span>
                    <span className="hl-qz-t">B. Il passe dans le canal carpien.<em>Faux</em></span>
                  </div>
                  <div className="hl-qz-o hl-ok" style={{ '--a': '57.5%', '--b': '61.3%' } as CSSProperties}>
                    <span className="hl-qz-ck"><i>✓</i><b>✓</b></span>
                    <span className="hl-qz-t">C. Sa paralysie donne une main tombante.<em>Vrai · tu l'as cochée</em></span>
                  </div>
                  <div className="hl-qz-o hl-no">
                    <span className="hl-qz-ck"></span>
                    <span className="hl-qz-t">D. Sa paralysie donne une main en griffe.<em>Faux</em></span>
                  </div>
                  <div className="hl-qz-o hl-ok" style={{ '--a': '65.1%', '--b': '68.9%' } as CSSProperties}>
                    <span className="hl-qz-ck"><i>✓</i><b>✓</b></span>
                    <span className="hl-qz-t">E. Il innerve les extenseurs de l'avant-bras.<em>Vrai · tu l'as cochée</em></span>
                  </div>
                </div>
                <div className="hl-qz-end">
                  <div className="hl-qz-fb">
                    <b>Bonne réponse</b>
                    <span className="hl-qz-src">
                      <i>poly p. 12</i>
                      <i className="hl-v">vidéo 34:10</i>
                    </span>
                  </div>
                  <span className="hl-qz-val" style={{ opacity: 0 }}>Valider (3 cochées) →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* J+7 : LA LISTE */}
      <section className="hl-sn hl-sn-3" data-r0="-38.0" data-r1="152.9">
        <div className="hl-sn-stage">
          <div className="hl-sn-txt">
            <span className="hl-jt">
              <i></i>J+7, la liste
            </span>
            <h2 className="hl-mr-h hl-sn-t">
              Chaque matin, <span className="hl-mr-acc">ta liste.</span>
            </h2>
            <div className="hl-sn-cap">
              <p className="hl-c1">Chaque matin, MedRev prépare tes fiches du jour.</p>
              <p className="hl-c2">Les retards d'abord. Une fiche révisée sort de la liste.</p>
            </div>
          </div>
          <div className="hl-sn-vis">
            <div
              className="hl-bp"
              role="img"
              aria-label="Le panneau Fiches du jour : deux fiches en retard sont révisées et sortent de la liste, il en reste trois"
            >
              <div aria-hidden="true">
                <div className="hl-pn-h">
                  <div className="hl-pn-ic">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 6v14M5 8v11a1 1 0 0 0 1 1h6M19 8v11a1 1 0 0 1-1 1h-6M5 8a3 3 0 0 1 3-3 4 4 0 0 1 4 3 4 4 0 0 1 4-3 3 3 0 0 1 3 3"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="hl-pn-t">Fiches du jour</div>
                    <div className="hl-pn-s">
                      <b>
                        <span className="hl-cnt"></span> fiches
                      </b>{' '}
                      à réviser
                    </div>
                  </div>
                  <span className="hl-pn-go">Commencer</span>
                </div>
                <div className="hl-fl">
                  <div className="hl-fi hl-hot hl-s3-r1 hl-gone">
                    <span className="hl-fi-tag" style={{ '--c': '#B5643C' } as CSSProperties}>
                      B
                    </span>
                    <div className="hl-fi-mid">
                      <div className="hl-fi-nm">Enzymologie</div>
                      <div className="hl-fi-sub">
                        Biochimie<span className="hl-fi-j">J+7</span>
                      </div>
                    </div>
                    <span className="hl-fi-late">en retard, 2 j</span>
                  </div>
                  <div className="hl-fi hl-hot hl-s3-r2 hl-gone">
                    <span className="hl-fi-tag" style={{ '--c': '#3E6F9C' } as CSSProperties}>
                      B
                    </span>
                    <div className="hl-fi-mid">
                      <div className="hl-fi-nm">Thermodynamique</div>
                      <div className="hl-fi-sub">
                        Biophysique<span className="hl-fi-j">J+15</span>
                      </div>
                    </div>
                    <span className="hl-fi-late">en retard, 1 j</span>
                  </div>
                  <div className="hl-fi">
                    <span className="hl-fi-tag" style={{ '--c': '#7A5BA6' } as CSSProperties}>
                      A
                    </span>
                    <div className="hl-fi-mid">
                      <div className="hl-fi-nm">Membre supérieur</div>
                      <div className="hl-fi-sub">
                        Anatomie<span className="hl-fi-j">J+7</span>
                      </div>
                    </div>
                    <span className="hl-fi-due">aujourd'hui</span>
                  </div>
                  <div className="hl-fi">
                    <span className="hl-fi-tag" style={{ '--c': '#2E8B6A' } as CSSProperties}>
                      B
                    </span>
                    <div className="hl-fi-mid">
                      <div className="hl-fi-nm">Cycle cellulaire</div>
                      <div className="hl-fi-sub">
                        Biologie cellulaire<span className="hl-fi-j">J+15</span>
                      </div>
                    </div>
                    <span className="hl-fi-due">aujourd'hui</span>
                  </div>
                  <div className="hl-fi">
                    <span className="hl-fi-tag" style={{ '--c': '#C08A2E' } as CSSProperties}>
                      H
                    </span>
                    <div className="hl-fi-mid">
                      <div className="hl-fi-nm">Épithéliums</div>
                      <div className="hl-fi-sub">
                        Histologie<span className="hl-fi-j">J+30</span>
                      </div>
                    </div>
                    <span className="hl-fi-due">aujourd'hui</span>
                  </div>
                </div>
                <div className="hl-bp-done">
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="7" fill="#22507E"></circle>
                    <path
                      d="M4.8 8.2l2 2 4.4-4.6"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                  2 fiches révisées ce matin
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* J+15 : LE PARTIEL */}
      <section className="hl-sn hl-sn-4" data-r0="-1.1" data-r1="126.2">
        <div className="hl-sn-stage">
          <div className="hl-sn-txt">
            <span className="hl-jt">
              <i></i>J+15, le partiel
            </span>
            <h2 className="hl-mr-h hl-sn-t">
              Prêt pour <span className="hl-mr-acc">le partiel.</span>
            </h2>
            <div className="hl-sn-cap">
              <p className="hl-c1">Entre la date de ton examen.</p>
              <p className="hl-c2">Tu vois ce qui est solide, et ce qu'il reste à reprendre.</p>
            </div>
          </div>
          <div className="hl-sn-vis">
            <div
              className="hl-pt"
              role="img"
              aria-label="Partiel dans 23 jours : Biologie cellulaire 91 %, Biochimie 82 %, Anatomie 64 %, Biophysique 47 %, 4 fiches à reprendre"
            >
              <div className="hl-pt-a" aria-hidden="true">
                <div>
                  <div className="hl-pt-lbl">Partiel du 1er semestre</div>
                  <div style={{ marginTop: '5px', fontSize: '14px', opacity: '.85' } as CSSProperties}>11 novembre</div>
                </div>
                <div className="hl-pt-num"></div>
              </div>
              <div className="hl-pt-b" aria-hidden="true">
                <div className="hl-pt-row hl-pt-r1">
                  <div className="hl-pt-rl">
                    <span>Biologie cellulaire</span>
                    <span>91 %</span>
                  </div>
                  <div className="hl-pt-bar">
                    <i style={{ '--w': '91%' } as CSSProperties}></i>
                  </div>
                </div>
                <div className="hl-pt-row hl-pt-r2">
                  <div className="hl-pt-rl">
                    <span>Biochimie</span>
                    <span>82 %</span>
                  </div>
                  <div className="hl-pt-bar">
                    <i style={{ '--w': '82%' } as CSSProperties}></i>
                  </div>
                </div>
                <div className="hl-pt-row hl-pt-r3">
                  <div className="hl-pt-rl">
                    <span>Anatomie</span>
                    <span>64 %</span>
                  </div>
                  <div className="hl-pt-bar">
                    <i style={{ '--w': '64%' } as CSSProperties}></i>
                  </div>
                </div>
                <div className="hl-pt-row hl-pt-r4">
                  <div className="hl-pt-rl">
                    <span>Biophysique</span>
                    <span style={{ color: '#C0564B' } as CSSProperties}>47 %</span>
                  </div>
                  <div className="hl-pt-bar">
                    <i style={{ '--w': '47%', background: '#C0564B' } as CSSProperties}></i>
                  </div>
                </div>
              </div>
              <div className="hl-pt-alert" aria-hidden="true">
                <i>
                  <svg width="16" height="16" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8.5" fill="none" stroke="#C0564B" strokeWidth="1.8"></circle>
                    <path d="M10 5.5v5.2" stroke="#C0564B" strokeWidth="2" strokeLinecap="round"></path>
                    <circle cx="10" cy="13.8" r="1.2" fill="#C0564B"></circle>
                  </svg>
                </i>
                <div>
                  <b>4 fiches à reprendre</b>, déjà dans ta liste de demain.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FIN */}
      <section id="fin" className="hl-en">
        <div>
          <span className="hl-jt">
            <i></i>Ta première fiche
          </span>
          <h2 className="hl-mr-h hl-en-t" style={{ marginTop: '16px' } as CSSProperties}>
            Commence ta P1 <span className="hl-mr-acc">dans le bon ordre.</span>
          </h2>
          <p className="hl-en-s">Gratuit pour commencer, sans carte bancaire.</p>
        </div>
        <Link className="hl-mr-btn" href="/auth">
          Créer ma première fiche
        </Link>
      </section>

      <MarketingFooter />
      <ScrollFallback />
    </div>
  )
}
