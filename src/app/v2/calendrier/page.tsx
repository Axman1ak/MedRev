// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-item{transition:background .12s ease}\n.mr-item:hover{background:#F1EEE7}\n.mr-ghost:hover{background:#F1EEE7}\n.mr-btn:hover{filter:brightness(.88)}\n.mr-menu:hover{background:#F4F1EA}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { menuOpen: false };
  }
  renderVals() {
    const C = { bio: '#C4554D', ana: '#4F7CC9', phy: '#8B6BB8', stat: '#9C7148', pha: '#D08A3E', ssh: '#3E8E85' };
    const done = (t, c) => ({ title: t, dot: c, color: '#9AA0A8', opacity: 0.45 });
    const todo = (t, c) => ({ title: t, dot: c, color: '#1A1D23', opacity: 1 });
    const exam = (time, title) => ({ time, title, line: '#1E3354' });
    const cls = (time, title) => ({ time, title, line: '#A9BFDB' });
    const raw = [
      ['lun.', '2', 'past', [cls('8h', 'Amphi anatomie')], [done('Membre supérieur', C.ana), done('Thermodynamique', C.bio)], 0],
      ['mar.', '3', 'past', [], [done('Fonction rénale', C.phy)], 0],
      ['mer.', '4', 'today', [cls('14h', 'TD biophysique')], [todo('Cerveau, vascularisation', C.ana), todo('Nerfs crâniens', C.ana), todo('Pharmacocinétique', C.pha), todo('Tronc cérébral', C.ana)], 9],
      ['jeu.', '5', 'future', [], [todo('Potentiel d’action', C.phy), todo('Récepteurs et ligands', C.pha), todo('Tests statistiques', C.stat), todo('Cycle cellulaire', C.ana)], 0],
      ['ven.', '6', 'future', [exam('14h', 'Partiel blanc anatomie')], [todo('Éthique médicale', C.ssh), todo('Thermodynamique', C.bio), todo('Embryologie', C.ana)], 0],
      ['sam.', '7', 'future', [], [todo('Membre inférieur', C.ana), todo('Lipides', C.phy)], 0],
      ['dim.', '8', 'future', [], [todo('Santé publique', C.ssh)], 0]
    ];
    const days = raw.map(([name, num, kind, events, items, more], i) => ({
      name, num, events, items,
      hasMore: more > 0, more: '+' + more + ' autres',
      border: i === 0 ? '0' : '1px solid #EDE9E1',
      bg: kind === 'today' ? '#F4F1EA' : 'transparent',
      numBg: kind === 'today' ? '#1E3354' : 'transparent',
      numColor: kind === 'today' ? '#FFFFFF' : (kind === 'past' ? '#9AA0A8' : '#1A1D23')
    }));
    const menu = [
      { label: 'Ajouter un cours', hint: 'Poly PDF ou vidéo, MedRev crée la fiche', icon: 'M12 16V4M7 9l5-5 5 5M5 20h14' },
      { label: 'Événement', hint: 'Partiel, amphi, TD, colle', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
      { label: 'Importer mon emploi du temps', hint: 'Fichier .ics ou lien ADE', icon: 'M4 4h16v16H4zM8 12h8M12 8v8' }
    ];
    const open = this.state.menuOpen;
    return {
      days, menu, menuOpen: open, menuExpanded: open ? 'true' : 'false',
      toggleMenu: () => this.setState({ menuOpen: !open })
    };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style>{CSS}</style>
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex", flexWrap: "wrap"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="1" />
      </div>
      <main style={{flex: "999 1 560px", minWidth: "0", boxSizing: "border-box", padding: "48px clamp(20px, 4vw, 56px) 0", display: "flex", flexDirection: "column"}}>
        <div style={{flex: "1", width: "100%", display: "flex", flexDirection: "column", gap: "32px"}}>
          <header style={{display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px"}}>
            <h1 style={{margin: "0", fontSize: "34px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {"Novembre "}
              <span style={{color: "#9AA0A8", fontWeight: "500"}}>
                {"2 au 8"}
              </span>
            </h1>
            <div style={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px"}}>
              <div role="group" aria-label="Vue" style={{display: "flex", padding: "3px", borderRadius: "10px", background: "#F1EEE7"}}>
                <button type="button" aria-pressed="true" style={{font: "inherit", fontSize: "14px", fontWeight: "600", color: "#1A1D23", background: "#FFFFFF", border: "0", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,.06)"}}>
                  {"Semaine"}
                </button>
                <button type="button" aria-pressed="false" style={{font: "inherit", fontSize: "14px", color: "#6B6F76", background: "transparent", border: "0", padding: "7px 14px", borderRadius: "8px", cursor: "pointer"}}>
                  {"Mois"}
                </button>
              </div>
              <button type="button" className="mr-ghost" aria-label="Semaine pr\u00e9c\u00e9dente" style={{font: "inherit", width: "40px", height: "40px", color: "#3D424A", background: "transparent", border: "0", borderRadius: "10px", cursor: "pointer", fontSize: "18px"}}>
                {"\u2039"}
              </button>
              <button type="button" className="mr-ghost" style={{font: "inherit", fontSize: "14px", color: "#3D424A", background: "transparent", border: "0", padding: "10px 12px", borderRadius: "10px", cursor: "pointer"}}>
                {"Aujourd'hui"}
              </button>
              <button type="button" className="mr-ghost" aria-label="Semaine suivante" style={{font: "inherit", width: "40px", height: "40px", color: "#3D424A", background: "transparent", border: "0", borderRadius: "10px", cursor: "pointer", fontSize: "18px"}}>
                {"\u203a"}
              </button>
              <div style={{position: "relative"}}>
                <button type="button" className="mr-btn" onClick={v.toggleMenu} aria-expanded={v.menuExpanded} style={{font: "inherit", fontSize: "15px", fontWeight: "600", color: "#FFFFFF", background: "#1E3354", border: "0", padding: "10px 18px", borderRadius: "10px", cursor: "pointer"}}>
                  {"+ Ajouter"}
                </button>
                {v.menuOpen ? (
                  <>
                    <div role="menu" style={{position: "absolute", right: "0", top: "48px", zIndex: "5", width: "300px", padding: "6px", borderRadius: "12px", background: "#FFFFFF", boxShadow: "0 8px 28px rgba(26,29,35,.14), 0 0 0 1px rgba(26,29,35,.06)", display: "flex", flexDirection: "column"}}>
                      {(v.menu || []).map((m: any, i_m: number) => (
                        <Fragment key={i_m}>
                          <button type="button" role="menuitem" className="mr-menu" onClick={v.toggleMenu} style={{font: "inherit", display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "8px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", color: "#1A1D23"}}>
                            <span aria-hidden="true" style={{width: "32px", height: "32px", borderRadius: "8px", background: "#F1EEE7", display: "flex", alignItems: "center", justifyContent: "center", color: "#1E3354"}}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d={m.icon} />
                              </svg>
                            </span>
                            <span style={{display: "flex", flexDirection: "column", gap: "1px"}}>
                              <span style={{fontSize: "14px", fontWeight: "600"}}>
                                {m.label}
                              </span>
                              <span style={{fontSize: "12px", color: "#6B6F76"}}>
                                {m.hint}
                              </span>
                            </span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </header>
          <div style={{flex: "1", display: "flex", overflowX: "auto"}}>
            <div style={{flex: "1", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", minWidth: "880px", borderTop: "1px solid #EDE9E1"}}>
              {(v.days || []).map((d: any, i_d: number) => (
                <Fragment key={i_d}>
                  <div style={{minHeight: "560px", padding: "16px 8px 24px", borderLeft: d.border, background: d.bg, display: "flex", flexDirection: "column", gap: "12px"}}>
                    <div style={{display: "flex", alignItems: "center", gap: "8px", padding: "0 6px"}}>
                      <span style={{fontSize: "13px", fontWeight: "500", color: "#6B6F76"}}>
                        {d.name}
                      </span>
                      <span style={{fontSize: "15px", fontWeight: "600", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: d.numBg, color: d.numColor}}>
                        {d.num}
                      </span>
                    </div>
                    <div style={{display: "flex", flexDirection: "column", gap: "1px"}}>
                      {(d.items || []).map((it: any, i_it: number) => (
                        <Fragment key={i_it}>
                          <Link href="/v2/session" className="mr-item" style={{display: "flex", alignItems: "center", gap: "8px", padding: "6px", borderRadius: "8px", textDecoration: "none", color: it.color, fontSize: "13px", lineHeight: "1.3"}}>
                            <span style={{width: "7px", height: "7px", borderRadius: "50%", background: it.dot, flex: "none", opacity: it.opacity, margin: "0 3px"}}></span>
                            <span style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                              {it.title}
                            </span>
                          </Link>
                        </Fragment>
                      ))}
                      {d.hasMore ? (
                        <>
                          <button type="button" className="mr-ghost" style={{font: "inherit", fontSize: "13px", color: "#1E3354", background: "transparent", border: "0", padding: "6px", borderRadius: "8px", cursor: "pointer", textAlign: "left"}}>
                            {d.more}
                          </button>
                        </>
                      ) : null}
                    </div>
                    <div style={{marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px"}}>
                      {(d.events || []).map((e: any, i_e: number) => (
                        <Fragment key={i_e}>
                          <div style={{display: "flex", alignItems: "baseline", gap: "8px", padding: "7px 8px", borderRadius: "8px", borderLeft: `3px solid ${e.line}`, background: "#F1EEE7", fontSize: "13px", lineHeight: "1.3"}}>
                            <span style={{color: "#6B6F76", flex: "none"}}>
                              {e.time}
                            </span>
                            <span style={{fontWeight: "500"}}>
                              {e.title}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
    </>
  )
}
