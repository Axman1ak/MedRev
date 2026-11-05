// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"panelDefault": false}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-book{transition:transform .12s ease}\n.mr-book:hover{transform:translateY(-4px)}\n.mr-chip:hover{background:#EAE5DB}\n.mr-ghost:hover{background:#F1EEE7}\n"

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
    const shade = (hex, k) => {
      const n = parseInt(hex.slice(1), 16);
      const f = (c) => Math.round(c + (255 - c) * k);
      return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
    };
    const cap = 110;
    const shelves = subs.map(([name, color, count, obj, objectName], si) => {
      const books = [];
      for (let i = 0; i < Math.min(count, cap); i++) {
        const r = Math.abs(Math.sin((i + 1) * 12.9898 + si * 78.233)) % 1;
        const gold = (i * 7 + si * 3) % 9 === 0;
        books.push({
          w: (6 + Math.round(r * 5)) + 'px',
          h: (44 + Math.round(((r * 7) % 1) * 20)) + 'px',
          bg: shade(color, 0.1 + ((r * 13) % 1) * 0.3),
          top: 'transparent',
          label: name + ', révision ' + (i + 1)
        });
      }
      return { name, color, count, books, hasMore: count > cap, more: '+' + (count - cap), hasObject: !!obj, objectPath: obj ? OBJ[obj] : '', objectName };
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
      <style>{CSS}</style>
    <div style={{position: "relative", fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "1080px", display: "flex", flexWrap: "wrap"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="3" />
      </div>
      <main style={{flex: "999 1 560px", minWidth: "0", boxSizing: "border-box", padding: "48px clamp(20px, 4vw, 56px) 56px", display: "flex", flexDirection: "column"}}>
        <div style={{flex: "1", display: "flex", flexDirection: "column", gap: "48px"}}>
          <header style={{display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px"}}>
            <div style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <h1 style={{margin: "0", fontSize: "34px", fontWeight: "700", letterSpacing: "-.02em"}}>
                {"Ta biblioth\u00e8que"}
              </h1>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {"317 livres, +3 cette semaine"}
              </span>
            </div>
            <button type="button" className="mr-chip" onClick={v.openPanel} aria-expanded={v.panelExpanded} style={{font: "inherit", display: "flex", alignItems: "center", gap: "14px", padding: "10px 16px 10px 10px", border: "0", borderRadius: "14px", background: "#F1EEE7", color: "#1A1D23", cursor: "pointer", textAlign: "left"}}>
              <span aria-hidden="true" style={{width: "40px", height: "40px", borderRadius: "50%", background: "#F6EBCF", color: "#9A7420", display: "flex", alignItems: "center", justifyContent: "center"}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
                </svg>
              </span>
              <span style={{display: "flex", flexDirection: "column", gap: "6px", width: "150px"}}>
                <span style={{display: "flex", justifyContent: "space-between", fontSize: "15px"}}>
                  <strong>
                    {"Lettr\u00e9"}
                  </strong>
                  <span style={{color: "#6B6F76", fontSize: "13px"}}>
                    {"317 / 500"}
                  </span>
                </span>
                <span style={{height: "4px", borderRadius: "2px", background: "#E2DCCF", overflow: "hidden"}}>
                  <span style={{display: "block", width: "27%", height: "4px", background: "#D4A93C"}}></span>
                </span>
              </span>
            </button>
          </header>
          <div style={{flex: "1", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "30px"}}>
            {(v.shelves || []).map((s: any, i_s: number) => (
              <Fragment key={i_s}>
                <div style={{display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 24px"}}>
                  <div style={{width: "180px", display: "flex", flexDirection: "column", gap: "2px", paddingBottom: "10px"}}>
                    <span style={{display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "600"}}>
                      <span style={{width: "8px", height: "8px", borderRadius: "50%", background: s.color, flex: "none"}}></span>
                      {s.name}{" "}
                    </span>
                    <span style={{fontSize: "13px", color: "#6B6F76", paddingLeft: "16px"}}>
                      {s.count}{" livres"}
                    </span>
                  </div>
                  <div style={{flex: "1 1 420px", minWidth: "0", display: "flex", flexDirection: "column"}}>
                    <div style={{display: "flex", alignItems: "flex-end", gap: "2px", height: "70px", overflow: "hidden", padding: "0 8px"}}>
                      {(s.books || []).map((b: any, i_b: number) => (
                        <Fragment key={i_b}>
                          <span className="mr-book" title={b.label} style={{flex: "none", width: b.w, height: b.h, borderRadius: "2px 2px 1px 1px", background: b.bg, borderTop: `3px solid ${b.top}`, boxSizing: "border-box"}}></span>
                        </Fragment>
                      ))}
                      {s.hasMore ? (
                        <>
                          <span style={{flex: "none", fontSize: "12px", color: "#6B6F76", padding: "0 0 4px 8px"}}>
                            {s.more}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <div style={{height: "7px", borderRadius: "2px", background: "#DCCFBA", boxShadow: "0 3px 6px rgba(120,95,60,.18)"}}></div>
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
          <aside role="dialog" aria-label="Rangs" style={{position: "absolute", top: "0", right: "0", bottom: "0", width: "380px", maxWidth: "100%", boxSizing: "border-box", background: "#FFFFFF", boxShadow: "-12px 0 40px rgba(26,29,35,.12)", padding: "32px 28px", display: "flex", flexDirection: "column", gap: "28px", overflowY: "auto"}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <span style={{fontSize: "22px", fontWeight: "700"}}>
                {"Rangs"}
              </span>
              <button type="button" className="mr-ghost" onClick={v.closePanel} aria-label="Fermer" style={{font: "inherit", width: "36px", height: "36px", border: "0", borderRadius: "10px", background: "transparent", color: "#3D424A", cursor: "pointer"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <ol style={{listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column"}}>
              {(v.ranks || []).map((r: any, i_r: number) => (
                <Fragment key={i_r}>
                  <li style={{display: "flex", gap: "16px"}}>
                    <div style={{display: "flex", flexDirection: "column", alignItems: "center", width: "44px", flex: "none"}}>
                      <span aria-hidden="true" style={{width: "44px", height: "44px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: r.circleBg, color: r.iconColor, boxShadow: r.ring}}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d={r.icon} />
                        </svg>
                      </span>
                      <span style={{flex: "1", width: "2px", minHeight: "18px", background: r.lineColor}}></span>
                    </div>
                    <div style={{display: "flex", flexDirection: "column", gap: "2px", padding: "10px 0 22px"}}>
                      <span style={{fontSize: "16px", fontWeight: "700", color: r.color}}>
                        {r.name}
                      </span>
                      <span style={{fontSize: "13px", color: "#6B6F76"}}>
                        {r.detail}
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
