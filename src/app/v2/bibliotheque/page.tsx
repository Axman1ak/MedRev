// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"panelDefault": false}

const CSS = "\n\n\na{color:#15304E}a:hover{color:#0F1E36}\n.mr-book{transition:transform .12s ease, filter .12s ease}\n.mr-bk{position:relative}\n.mr-bk:hover{z-index:10}\n.mr-bk:focus-visible{z-index:10;outline:2px solid #15304E;outline-offset:2px;border-radius:2px}\n.mr-bk:hover .mr-book,.mr-bk:focus-visible .mr-book{transform:translateY(-6px);filter:brightness(.92)}\n.mr-tip{opacity:0;visibility:hidden;transform:translate(-50%,4px);transition:opacity .12s ease, transform .12s ease, visibility .12s}\n.mr-bk:hover .mr-tip,.mr-bk:focus-visible .mr-tip{opacity:1;visibility:visible;transform:translate(-50%,0)}\n.mr-chip:hover{background:#EAE5DB}\n.mr-ghost:hover{background:#F1EEE7}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { open: null };
  }
  renderVals() {
    const open = this.state.open ?? !!this.props.panelDefault;
    const OBJ = {
      book: 'M5 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5zM19 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
      sablier: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
      chandelier: 'M12 2c1.4 1.8 1.4 3.2 0 4.2c-1.4-1-1.4-2.4 0-4.2zM10.5 8h3v10h-3zM6 18h12M8 21h8',
      globe: 'M12 3a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15zM4.5 10.5h15M12 3c2.3 2.8 2.3 12.2 0 15M12 3c-2.3 2.8-2.3 12.2 0 15M12 18v2M8 21h8',
      buste: 'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM6 21c0-5 2.7-8 6-8s6 3 6 8zM9 21h6',
      codex: 'M4 7l8-3 8 3-8 3zM4 7v6l8 3 8-3V7M12 10v6M8 16l-2 5M16 16l2 5'
    };
    const subs = [
      ['Anatomie spécifique', '#4F7CC9', 120, 'sablier', 'Le sablier'],
      ['Physiologie', '#8B6BB8', 64, 'chandelier', 'Le chandelier'],
      ['Santé, Société, Humanité', '#3E8E85', 48, 'globe', 'Le globe'],
      ['Biophysique', '#C4554D', 35, null, ''],
      ['Pharmacologie', '#D08A3E', 30, null, ''],
      ['Biostatistiques', '#9C7148', 20, null, '']
    ];
    const FICHES = {
      'Anatomie spécifique': ['Cerveau, vascularisation', 'Nerfs crâniens', 'Tronc cérébral', 'Membre supérieur', 'Membre inférieur', 'Moelle épinière', 'Thorax', 'Abdomen', 'Bassin', 'Tête et cou', 'Cœur', 'Système veineux', 'Plexus brachial', 'Œil et orbite', 'Oreille'],
      'Physiologie': ['Potentiel d’action', 'Fonction rénale', 'Lipides'],
      'Santé, Société, Humanité': ['Éthique médicale', 'Santé publique', 'Épistémologie'],
      'Biophysique': ['Optique géométrique', 'Thermodynamique'],
      'Pharmacologie': ['Pharmacocinétique', 'Récepteurs et ligands'],
      'Biostatistiques': ['Tests statistiques']
    };
    const STEPS = ['J0', 'J+1', 'J+3', 'J+5', 'J+7', 'J+15', 'J+21', 'J+30', 'J+45', 'J+60', 'J+75', 'J+90', 'J+105', 'J+120'];
    const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const NOTE = ['#C4554D', '#D08A3E', '#D4A93C', '#8DB86B', '#3E8E5A'];
    const shade = (hex, k) => {
      const n = parseInt(hex.slice(1), 16);
      const f = (c) => Math.round(c + (255 - c) * k);
      return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
    };
        const shelves = subs.map(([name, color, count, obj, objectName], si) => {
      const books = [];
      for (let i = 0; i < count; i++) {
        const r = Math.abs(Math.sin((i + 1) * 12.9898 + si * 78.233)) % 1;
        const gold = (i * 7 + si * 3) % 9 === 0;
        books.push({
          w: ((6 + Math.round(r * 5)) * 0.846).toFixed(1) + 'px',
          h: ((44 + Math.round(((r * 7) % 1) * 20)) * 0.846).toFixed(1) + 'px',
          bg: shade(color, 0.1 + ((r * 13) % 1) * 0.3),
          top: 'transparent',
          label: '',
          fiche: '', when: '', result: '', noteColor: ''
        });
        const b = books[books.length - 1];
        const list = FICHES[name];
        const fiche = list[i % list.length];
        const step = Math.floor(i / list.length);
        const daysAgo = Math.max(1, Math.round((count - i) * 62 / count));
        const d = new Date(2026, 10, 5 - daysAgo);
        const note = 1 + Math.floor(((r * 31) % 1) * 5);
        const qcm = 40 + Math.round(((r * 17) % 1) * 55);
        b.fiche = fiche;
        b.when = (STEPS[step] || 'J+' + (step * 30)) + ', le ' + d.getDate() + ' ' + MOIS[d.getMonth()];
        b.result = 'Note ' + note + '/5, QCM ' + qcm + '%';
        b.noteColor = NOTE[note - 1];
        b.label = fiche + ', ' + b.when + ', ' + b.result;
      }
      return { name, color, count, books, hasObject: !!obj, objectPath: obj ? OBJ[obj] : '', objectName };
    });
    const R = [
      ['Apprenti', 'Ta première étagère', 0, 'book'],
      ['Copiste', 'Le sablier, 30 livres', 30, 'sablier'],
      ['Scribe', 'Le chandelier, 100 livres', 100, 'chandelier'],
      ['Lettré', 'Le globe, 250 livres', 250, 'globe'],
      ['Érudit', 'Le buste d’Hippocrate, encore 183 livres', 500, 'buste'],
      ['Maître', 'Le codex sur lutrin, 1000 livres', 1000, 'codex']
    ];
    const ranks = R.map(([name, detail, at, ic], i) => {
      const reached = 317 >= at;
      const current = name === 'Lettré';
      return {
        name, detail, icon: OBJ[ic],
        circleBg: current ? '#F6EBCF' : (reached ? '#F4F1EA' : '#FAF8F4'),
        iconColor: reached ? '#9A7420' : '#B8BCC2',
        ring: current ? '0 0 0 2px #D4A93C' : 'none',
        color: reached ? '#1A1D23' : '#9AA0A8',
        lineColor: i === R.length - 1 ? 'transparent' : (317 >= R[i + 1][2] ? '#D4A93C' : '#E4DFD4')
      };
    });
    return {
      shelves, ranks, panelOpen: open, panelExpanded: open ? 'true' : 'false',
      openPanel: () => this.setState({ open: true }),
      closePanel: () => this.setState({ open: false })
    };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div style={{position: "relative", fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex", flexWrap: "wrap"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="3" />
      </div>
      <main style={{flex: "999 1 560px", minWidth: "0", boxSizing: "border-box", padding: "48px clamp(20px, 4vw, 56px) 56px", display: "flex", flexDirection: "column"}}>
        <div style={{flex: "1", display: "flex", flexDirection: "column", gap: "16.9px"}}>
          <header style={{display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "13.5px"}}>
            <div style={{display: "flex", flexDirection: "column", gap: "3.4px"}}>
              <h1 style={{margin: "0", fontSize: "28.8px", fontWeight: "700", letterSpacing: "-.02em"}}>
                {" Ta biblioth\u00e8que "}
              </h1>
              <span style={{fontSize: "12.7px", color: "#6B6F76"}}>
                {" 317 livres, +3 cette semaine "}
              </span>
            </div>
            <button type={"button"} className={"mr-chip"} onClick={v.openPanel} aria-expanded={v.panelExpanded} style={{font: "inherit", display: "flex", alignItems: "center", gap: "11.9px", padding: "8.5px 13.5px 8.5px 8.5px", border: "0", borderRadius: "11.9px", background: "#F1EEE7", color: "#1A1D23", cursor: "pointer", textAlign: "left"}}>
              <span aria-hidden={"true"} style={{width: "33.9px", height: "33.9px", borderRadius: "50%", background: "#F6EBCF", color: "#9A7420", display: "flex", alignItems: "center", justifyContent: "center"}}>
                <svg width={"20"} height={"20"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.7"} strokeLinecap={"round"}>
                  <circle cx={"12"} cy={"12"} r={"9"} />
                  <path d={"M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"} />
                </svg>
              </span>
              <span style={{display: "flex", flexDirection: "column", gap: "5.1px", width: "127px"}}>
                <span style={{display: "flex", justifyContent: "space-between", fontSize: "12.7px"}}>
                  <strong>
                    {" Lettr\u00e9 "}
                  </strong>
                  <span style={{color: "#6B6F76", fontSize: "11px"}}>
                    {" 317 / 500 "}
                  </span>
                </span>
                <span style={{height: "3.4px", borderRadius: "2px", background: "#E2DCCF", overflow: "hidden"}}>
                  <span style={{display: "block", width: "27%", height: "3.4px", background: "#D4A93C"}}></span>
                </span>
              </span>
            </button>
          </header>
          <div style={{flex: "1", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "25.4px"}}>
            {(v.shelves || []).map((s: any, i_s: number) => (
              <Fragment key={i_s}>
                <div style={{display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "10.1px 20.3px", padding: "20.3px 23.7px 18.6px", borderRadius: "15.3px", background: "#FDFCFA", boxShadow: "0 0 0 1px #ECE8DF"}}>
                  <div style={{width: "152.4px", display: "flex", flexDirection: "column", gap: "2px", paddingTop: "20.3px"}}>
                    <span style={{display: "flex", alignItems: "center", gap: "6.8px", fontSize: "11.9px", fontWeight: "600"}}>
                      <span style={{width: "6.8px", height: "6.8px", borderRadius: "50%", background: s.color, flex: "none"}}></span>
                      {" "}{s.name}{" "}
                    </span>
                    <span style={{fontSize: "11px", color: "#6B6F76", paddingLeft: "13.5px"}}>
                      {" "}{s.count}{" livres "}
                    </span>
                  </div>
                  <div style={{flex: "1 1 355.5px", minWidth: "0", display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: "15.3px 2px", padding: "0 6.8px", backgroundImage: "linear-gradient(to bottom, transparent 59.2px, #DCCFBA 59.2px, #DCCFBA 65.1px, transparent 65.1px)", backgroundSize: "100% 80.4px", borderRadius: "2px"}}>
                    {(s.books || []).map((b: any, i_b: number) => (
                      <Fragment key={i_b}>
                        <Link href={"/v2/matieres"} className={"mr-bk"} aria-label={b.label} style={{flex: "none", height: "65.1px", display: "flex", alignItems: "flex-end", paddingBottom: "5.9px", boxSizing: "border-box", textDecoration: "none", color: "inherit"}}>
                          <span className={"mr-book"} style={{flex: "none", width: b.w, height: b.h, borderRadius: "2px 2px 1px 1px", background: b.bg, borderTop: `3px solid ${b.top}`, boxSizing: "border-box"}}></span>
                          <span className={"mr-tip"} role={"tooltip"} style={{position: "absolute", left: "50%", bottom: "64.3px", width: "177.7px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "3px", padding: "8.5px 10.1px", borderRadius: "8.5px", background: "#1A1D23", color: "#FFFFFF", fontSize: "11px", lineHeight: "1.35", pointerEvents: "none", boxShadow: "0 5.1px 16.9px rgba(26,29,35,.18)"}}>
                            <span style={{fontSize: "11.9px", fontWeight: "700"}}>
                              {b.fiche}
                            </span>
                            <span style={{color: "rgba(255,255,255,.7)"}}>
                              {b.when}
                            </span>
                            <span style={{display: "flex", alignItems: "center", gap: "6.8px"}}>
                              <span style={{width: "6.8px", height: "6.8px", borderRadius: "50%", background: b.noteColor}}></span>
                              {b.result}
                            </span>
                          </span>
                        </Link>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </main>
      {v.panelOpen ? (
        <>
          <div onClick={v.closePanel} style={{position: "absolute", inset: "0", background: "rgba(26,29,35,.18)"}}></div>
          <aside role={"dialog"} aria-label={"Rangs"} style={{position: "absolute", top: "0", right: "0", bottom: "0", width: "380px", maxWidth: "100%", boxSizing: "border-box", background: "#FFFFFF", boxShadow: "-12px 0 40px rgba(26,29,35,.12)", padding: "32px 28px", display: "flex", flexDirection: "column", gap: "28px", overflowY: "auto"}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <span style={{fontSize: "22px", fontWeight: "700"}}>
                {" Rangs "}
              </span>
              <button type={"button"} className={"mr-ghost"} onClick={v.closePanel} aria-label={"Fermer"} style={{font: "inherit", width: "36px", height: "36px", border: "0", borderRadius: "10px", background: "transparent", color: "#3D424A", cursor: "pointer"}}>
                <svg width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"2"} strokeLinecap={"round"} aria-hidden={"true"}>
                  <path d={"M6 6l12 12M18 6L6 18"} />
                </svg>
              </button>
            </div>
            <ol style={{listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column"}}>
              {(v.ranks || []).map((r: any, i_r: number) => (
                <Fragment key={i_r}>
                  <li style={{display: "flex", gap: "16px"}}>
                    <div style={{display: "flex", flexDirection: "column", alignItems: "center", width: "44px", flex: "none"}}>
                      <span aria-hidden={"true"} style={{width: "44px", height: "44px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: r.circleBg, color: r.iconColor, boxShadow: r.ring}}>
                        <svg width={"22"} height={"22"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.6"} strokeLinecap={"round"} strokeLinejoin={"round"}>
                          <path d={r.icon} />
                        </svg>
                      </span>
                      <span style={{flex: "1", width: "2px", minHeight: "18px", background: r.lineColor}}></span>
                    </div>
                    <div style={{display: "flex", flexDirection: "column", gap: "2px", padding: "10px 0 22px"}}>
                      <span style={{fontSize: "16px", fontWeight: "700", color: r.color}}>
                        {" "}{r.name}{" "}
                      </span>
                      <span style={{fontSize: "13px", color: "#6B6F76"}}>
                        {" "}{r.detail}{" "}
                      </span>
                    </div>
                  </li>
                </Fragment>
              ))}
            </ol>
          </aside>
        </>
      ) : null}
    </div>
    </>
  )
}
