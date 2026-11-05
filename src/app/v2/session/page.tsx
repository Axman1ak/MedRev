// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'

const DEFAULTS = {}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-ghost:hover{background:#F1EEE7}\n.mr-opt{transition:background .12s ease}\n.mr-opt:hover{background:#F1EEE7}\n.mr-btn:hover{filter:brightness(.88)}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { step: 0, checked: {}, validated: false, rating: 0, current: 2, kind: 0, card: 0, flipped: false };
  }
  renderVals() {
    const { step, checked, validated, rating, current } = this.state;
    const C = { bio: '#C4554D', ana: '#4F7CC9', phy: '#8B6BB8', stat: '#9C7148', pha: '#D08A3E', ssh: '#3E8E85' };
    const list = [
      ['Cerveau, vascularisation', 'Anatomie spécifique', C.ana, 'J+105'],
      ['Nerfs crâniens', 'Anatomie spécifique', C.ana, 'J+105'],
      ['Potentiel d’action', 'Physiologie', C.phy, 'J+21'],
      ['Pharmacocinétique', 'Pharmacologie', C.pha, 'J+105'],
      ['Tronc cérébral', 'Anatomie spécifique', C.ana, 'J+105'],
      ['Optique géométrique', 'Biophysique', C.bio, 'J+15'],
      ['Récepteurs et ligands', 'Pharmacologie', C.pha, 'J+7'],
      ['Éthique médicale', 'Santé, Société, Humanité', C.ssh, 'J+3'],
      ['Tests statistiques', 'Biostatistiques', C.stat, 'J+1']
    ];
    const queue = list.map(([title, subject, color], i) => ({
      title, subject, color,
      done: i < 2, notDone: i >= 2,
      current: i === current ? 'true' : 'false',
      bg: i === current ? '#ECE8E0' : 'transparent',
      weight: i === current ? 600 : 500,
      textColor: i < 2 ? '#9AA0A8' : '#1A1D23',
      go: () => this.setState({ current: i, step: 0, checked: {}, validated: false, rating: 0 })
    }));
    const c = list[current];
    const cur = { title: c[0], subject: c[1], color: c[2], step: c[3] };
    const labels = ['Relire', 'S’entraîner', 'Se noter'];
    const steps = labels.map((label, i) => ({
      label, go: () => this.setState({ step: i }),
      current: i === step ? 'step' : 'false',
      weight: i === step ? 600 : 500,
      color: i === step ? '#1A1D23' : '#6B6F76',
      line: i === step ? '#1E3354' : 'transparent'
    }));
    const opts = [
      ['A', 'La dépolarisation est due à une entrée de Na+.', true],
      ['B', 'La repolarisation est due à une entrée de K+.', false],
      ['C', 'Pendant la période réfractaire absolue, aucun nouveau potentiel ne peut être déclenché.', true],
      ['D', 'Son amplitude augmente avec l’intensité du stimulus.', false]
    ];
    const options = opts.map(([letter, text, ok]) => {
      const on = !!checked[letter];
      const showRight = validated && ok;
      const showWrong = validated && on && !ok;
      return {
        letter, text, pressed: on ? 'true' : 'false',
        toggle: () => { if (!validated) this.setState({ checked: { ...checked, [letter]: !on } }); },
        border: showRight ? '#93BC80' : (showWrong ? '#D98C7E' : (on ? '#1E3354' : '#E4DFD4')),
        bg: showRight ? '#F0F6EC' : (showWrong ? '#FBEFEC' : '#FFFFFF'),
        boxBg: on ? '#1E3354' : '#F1EEE7',
        boxColor: on ? '#FFFFFF' : '#3D424A',
        verdict: validated ? (ok ? 'Vrai' : 'Faux') : '',
        verdictColor: ok ? '#3E7A52' : '#9A5A1F'
      };
    });
    const rl = ['À revoir', 'Faible', 'Moyen', 'Bien', 'Maîtrisé'];
    const next = ['demain', 'dans 2 jours', 'dans 4 jours', 'dans 7 jours', 'dans 15 jours'];
    const ratings = rl.map((label, i) => ({
      n: i + 1, label, pressed: rating === i + 1 ? 'true' : 'false',
      pick: () => this.setState({ rating: i + 1 }),
      border: rating === i + 1 ? '#1E3354' : '#E4DFD4',
      bg: rating === i + 1 ? '#EEF2F8' : '#FFFFFF'
    }));
    let primaryLabel = 'Continuer';
    let primary = () => this.setState({ step: Math.min(step + 1, 2) });
    const st = this.state;
    const cards = [
      ['Quel ion entre dans la cellule pendant la dépolarisation ?', 'Le Na+, par les canaux sodiques voltage-dépendants.'],
      ['Quelle est la valeur approximative du potentiel de repos ?', 'Environ −70 mV.'],
      ['À quoi sert la période réfractaire absolue ?', 'Aucun nouveau potentiel ne peut naître, ce qui impose un seul sens de propagation.'],
      ['Que dit la loi du tout ou rien ?', 'Au-delà du seuil, l’amplitude du potentiel d’action est toujours la même.']
    ];
    const kinds = ['QCM', 'Flashcards'].map((label, i) => ({
      label, pressed: st.kind === i ? 'true' : 'false', pick: () => this.setState({ kind: i }),
      weight: st.kind === i ? 600 : 500, color: st.kind === i ? '#1A1D23' : '#6B6F76',
      bg: st.kind === i ? '#FFFFFF' : 'transparent', shadow: st.kind === i ? '0 1px 2px rgba(0,0,0,.06)' : 'none'
    }));
    const card = cards[st.card % cards.length];
    if (step === 1 && st.kind === 0 && !validated) { primaryLabel = 'Valider'; primary = () => this.setState({ validated: true }); }
    if (step === 2) { primaryLabel = 'Fiche suivante'; primary = () => this.setState({ step: 0, checked: {}, validated: false, rating: 0, current: Math.min(current + 1, list.length - 1) }); }
    return {
      kinds, isQcm: st.kind === 0, isFlash: st.kind === 1,
      trainCount: st.kind === 0 ? 'Question 1 sur 30' : 'Carte ' + (st.card % cards.length + 1) + ' sur 24',
      flipped: st.flipped, notFlipped: !st.flipped,
      cardSide: st.flipped ? 'Réponse' : 'Question',
      cardText: st.flipped ? card[1] : card[0],
      cardBg: st.flipped ? '#F4F1EA' : '#FFFFFF',
      flip: () => this.setState({ flipped: !st.flipped }),
      nextCard: () => this.setState({ card: st.card + 1, flipped: false }),
      queue, cur, steps, options, ratings, validated, primary, primaryLabel,
      isRead: step === 0, isTrain: step === 1, isRate: step === 2,
      hasRating: rating > 0,
      nextText: rating > 0 ? 'Prochaine révision ' + next[rating - 1] + '.' : ''
    };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style>{CSS}</style>
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "1080px", display: "flex", flexDirection: "column"}}>
      <header style={{display: "flex", alignItems: "center", gap: "20px", padding: "16px clamp(16px, 3vw, 32px)", borderBottom: "1px solid #EDE9E1"}}>
        <Link href="/v2" className="mr-ghost" aria-label="Quitter la session" style={{width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", color: "#3D424A", textDecoration: "none"}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <div role="progressbar" aria-label="Progression de la session" aria-valuemin="0" aria-valuemax="13" aria-valuenow="2" style={{flex: "1", height: "6px", borderRadius: "3px", background: "#ECE8E0", overflow: "hidden"}}>
          <div style={{width: "15%", height: "6px", borderRadius: "3px", background: "#1E3354"}}></div>
        </div>
        <span style={{fontSize: "14px", color: "#6B6F76", whiteSpace: "nowrap"}}>
          {"3 / 13"}
        </span>
        <span style={{fontSize: "14px", color: "#6B6F76", fontVariantNumeric: "tabular-nums"}}>
          {"4:12"}
        </span>
        <button type="button" className="mr-ghost" style={{font: "inherit", fontSize: "14px", color: "#3D424A", background: "transparent", border: "0", padding: "9px 12px", borderRadius: "10px", cursor: "pointer"}}>
          {"Pause"}
        </button>
      </header>
      <div style={{flex: "1", display: "flex", flexWrap: "wrap"}}>
        <aside aria-label="Au programme" style={{flex: "0 0 320px", boxSizing: "border-box", padding: "24px 12px", borderRight: "1px solid #EDE9E1", display: "flex", flexDirection: "column", gap: "2px"}}>
          {(v.queue || []).map((q: any, i_q: number) => (
            <Fragment key={i_q}>
              <button type="button" className="mr-opt" onClick={q.go} aria-current={q.current} style={{font: "inherit", display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", border: "0", background: q.bg, cursor: "pointer", textAlign: "left"}}>
                <span style={{width: "18px", height: "18px", flex: "none", display: "flex", alignItems: "center", justifyContent: "center"}}>
                  {q.done ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3E7A52" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    </>
                  ) : null}
                  {q.notDone ? (
                    <>
                      <span style={{width: "8px", height: "8px", borderRadius: "50%", background: q.color}}></span>
                    </>
                  ) : null}
                </span>
                <span style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "1px"}}>
                  <span style={{fontSize: "14px", fontWeight: q.weight, color: q.textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                    {q.title}
                  </span>
                  <span style={{fontSize: "12px", color: "#6B6F76", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                    {q.subject}
                  </span>
                </span>
              </button>
            </Fragment>
          ))}
        </aside>
        <main style={{flex: "999 1 520px", minWidth: "0", boxSizing: "border-box", maxWidth: "1180px", margin: "0 auto", padding: "48px clamp(20px, 4vw, 48px) 64px", display: "flex", flexDirection: "column", gap: "32px"}}>
          <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
            <span style={{display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#6B6F76"}}>
              <span style={{width: "8px", height: "8px", borderRadius: "50%", background: v.cur.color}}></span>
              {v.cur.subject}{", "}{v.cur.step}{" "}
            </span>
            <h1 style={{margin: "0", fontSize: "34px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {v.cur.title}
            </h1>
          </div>
          <nav aria-label="\u00c9tapes" style={{display: "flex", gap: "28px", borderBottom: "1px solid #EDE9E1"}}>
            {(v.steps || []).map((s: any, i_s: number) => (
              <Fragment key={i_s}>
                <button type="button" onClick={s.go} aria-current={s.current} style={{font: "inherit", fontSize: "15px", fontWeight: s.weight, color: s.color, background: "transparent", border: "0", borderBottom: `2px solid ${s.line}`, padding: "0 0 12px", marginBottom: "-1px", cursor: "pointer"}}>
                  {s.label}
                </button>
              </Fragment>
            ))}
          </nav>
          {v.isRead ? (
            <>
              <div style={{display: "flex", flexDirection: "column", gap: "18px", fontSize: "16px", lineHeight: "1.6"}}>
                <p style={{margin: "0"}}>
                  {"Inversion br\u00e8ve et locale du potentiel de membrane, qui se propage le long de l'axone. Potentiel de repos vers \u221270 mV, seuil vers \u221255 mV."}
                </p>
                <ul style={{margin: "0", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px"}}>
                  <li>
                    <strong>
                      {"D\u00e9polarisation."}
                    </strong>
                    {" Ouverture des canaux Na+ voltage-d\u00e9pendants, entr\u00e9e de Na+."}
                  </li>
                  <li>
                    <strong>
                      {"Repolarisation."}
                    </strong>
                    {" Inactivation des canaux Na+, ouverture des canaux K+, sortie de K+."}
                  </li>
                  <li>
                    <strong>
                      {"Hyperpolarisation."}
                    </strong>
                    {" Les canaux K+ se referment lentement."}
                  </li>
                  <li>
                    <strong>
                      {"P\u00e9riodes r\u00e9fractaires."}
                    </strong>
                    {" Absolue puis relative, elles imposent le sens de propagation."}
                  </li>
                </ul>
                <p style={{margin: "0", color: "#6B6F76"}}>
                  {"Loi du tout ou rien, l'amplitude ne d\u00e9pend pas de l'intensit\u00e9 du stimulus."}
                </p>
                <div style={{display: "flex", gap: "16px", fontSize: "14px"}}>
                  <a href="#">
                    {"poly p. 12"}
                  </a>
                  <a href="#">
                    {"vid\u00e9o 34:10"}
                  </a>
                </div>
              </div>
            </>
          ) : null}
          {v.isTrain ? (
            <>
              <div style={{display: "flex", flexDirection: "column", gap: "20px"}}>
                <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
                  <div role="group" aria-label="Type d'entra\u00eenement" style={{display: "flex", padding: "3px", borderRadius: "10px", background: "#F1EEE7"}}>
                    {(v.kinds || []).map((k: any, i_k: number) => (
                      <Fragment key={i_k}>
                        <button type="button" onClick={k.pick} aria-pressed={k.pressed} style={{font: "inherit", fontSize: "14px", fontWeight: k.weight, color: k.color, background: k.bg, border: "0", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", boxShadow: k.shadow}}>
                          {k.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                  <span style={{fontSize: "14px", color: "#6B6F76"}}>
                    {v.trainCount}
                  </span>
                </div>
                {v.isFlash ? (
                  <>
                    <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                      <button type="button" onClick={v.flip} aria-label="Retourner la carte" style={{font: "inherit", color: "#1A1D23", minHeight: "240px", padding: "32px", borderRadius: "16px", border: "1px solid #E4DFD4", background: v.cardBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", textAlign: "center", cursor: "pointer", boxShadow: "0 1px 2px rgba(26,29,35,.04), 0 10px 30px rgba(26,29,35,.05)"}}>
                        <span style={{fontSize: "12px", fontWeight: "600", letterSpacing: ".06em", textTransform: "uppercase", color: "#6B6F76"}}>
                          {v.cardSide}
                        </span>
                        <span style={{fontSize: "22px", fontWeight: "600", lineHeight: "1.4", maxWidth: "760px"}}>
                          {v.cardText}
                        </span>
                        {v.notFlipped ? (
                          <>
                            <span style={{fontSize: "13px", color: "#9AA0A8"}}>
                              {"Clique pour voir la r\u00e9ponse"}
                            </span>
                          </>
                        ) : null}
                      </button>
                      {v.flipped ? (
                        <>
                          <div style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px"}}>
                            <button type="button" onClick={v.nextCard} style={{font: "inherit", fontSize: "15px", fontWeight: "600", padding: "13px", borderRadius: "12px", border: "1px solid #E4DFD4", background: "#FFFFFF", color: "#9A5A1F", cursor: "pointer"}}>
                              {"\u00c0 revoir"}
                            </button>
                            <button type="button" onClick={v.nextCard} style={{font: "inherit", fontSize: "15px", fontWeight: "600", padding: "13px", borderRadius: "12px", border: "1px solid #E4DFD4", background: "#FFFFFF", color: "#3E7A52", cursor: "pointer"}}>
                              {"Je savais"}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {v.isQcm ? (
                  <>
                    <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                      <p style={{margin: "0", fontSize: "17px", fontWeight: "600"}}>
                        {"\u00c0 propos du potentiel d'action, quelles propositions sont exactes ?"}
                      </p>
                      <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                        {(v.options || []).map((o: any, i_o: number) => (
                          <Fragment key={i_o}>
                            <button type="button" className="mr-opt" onClick={o.toggle} aria-pressed={o.pressed} style={{font: "inherit", fontSize: "15px", textAlign: "left", display: "flex", alignItems: "center", gap: "14px", padding: "14px", borderRadius: "10px", border: `1px solid ${o.border}`, background: o.bg, color: "#1A1D23", cursor: "pointer"}}>
                              <span style={{width: "22px", height: "22px", borderRadius: "6px", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", background: o.boxBg, color: o.boxColor}}>
                                {o.letter}
                              </span>
                              <span style={{flex: "1"}}>
                                {o.text}
                              </span>
                              <span style={{fontSize: "13px", fontWeight: "600", color: o.verdictColor}}>
                                {o.verdict}
                              </span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                      {v.validated ? (
                        <>
                          <p style={{margin: "0", fontSize: "14px", color: "#6B6F76"}}>
                            {"R\u00e9ponse A et C. "}
                            <a href="#">
                              {"poly p. 12"}
                            </a>
                          </p>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
          {v.isRate ? (
            <>
              <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                <p style={{margin: "0", fontSize: "17px", fontWeight: "600"}}>
                  {"Comment tu la connais ?"}
                </p>
                <div style={{display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px"}}>
                  {(v.ratings || []).map((r: any, i_r: number) => (
                    <Fragment key={i_r}>
                      <button type="button" onClick={r.pick} aria-pressed={r.pressed} style={{font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "16px 8px", borderRadius: "12px", border: `1px solid ${r.border}`, background: r.bg, color: "#1A1D23", cursor: "pointer"}}>
                        <span style={{fontSize: "22px", fontWeight: "700"}}>
                          {r.n}
                        </span>
                        <span style={{fontSize: "13px", color: "#6B6F76"}}>
                          {r.label}
                        </span>
                      </button>
                    </Fragment>
                  ))}
                </div>
                {v.hasRating ? (
                  <>
                    <p style={{margin: "0", fontSize: "14px", color: "#6B6F76"}}>
                      {v.nextText}
                    </p>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "24px"}}>
            <button type="button" className="mr-ghost" style={{font: "inherit", fontSize: "14px", color: "#6B6F76", background: "transparent", border: "0", padding: "10px 12px", borderRadius: "10px", cursor: "pointer"}}>
              {"Reporter \u00e0 demain"}
            </button>
            <button type="button" className="mr-btn" onClick={v.primary} style={{font: "inherit", fontSize: "15px", fontWeight: "600", color: "#FFFFFF", background: "#1E3354", border: "0", padding: "12px 26px", borderRadius: "10px", cursor: "pointer"}}>
              {v.primaryLabel}
            </button>
          </div>
        </main>
      </div>
    </div>
    </>
  )
}
