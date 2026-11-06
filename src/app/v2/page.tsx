// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"fiches": "beaucoup"}

const CSS = "\n\na{color:#15304E}a:hover{color:#0F1E36}\n.mr-row{transition:background .12s ease}\n.mr-row:hover{background:#F6F4EF}\n.mr-ghost:hover{background:#F1EEE7 !important}\n.mr-menu:hover{background:#F4F1EA}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}\n.mr-btn:active{transform:scale(.97)}\n.mr-tile{transition:transform .15s ease}\n.mr-tile:hover{transform:scale(1.25)}\n@keyframes mr-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\n@keyframes mr-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-pop{animation:mr-pop .35s cubic-bezier(.2,.8,.2,1) both}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { more: false, filterOpen: false, lateOnly: false, off: [] };
  }
  renderVals() {
    const st = this.state;
    const mode = this.props.fiches ?? 'beaucoup';
    const C = { bio: '#C4554D', ana: '#4F7CC9', phy: '#8B6BB8', stat: '#9C7148', pha: '#D08A3E', ssh: '#3E8E85' };
    const all = [
      ['Cerveau, vascularisation', 'Anatomie spécifique', C.ana, '44 j de retard'],
      ['Nerfs crâniens', 'Anatomie spécifique', C.ana, '44 j de retard'],
      ['Pharmacocinétique', 'Pharmacologie', C.pha, '44 j de retard'],
      ['Tronc cérébral', 'Anatomie spécifique', C.ana, '42 j de retard'],
      ['Optique géométrique', 'Biophysique', C.bio, '41 j de retard'],
      ['Potentiel d’action', 'Physiologie', C.phy, '36 j de retard'],
      ['Récepteurs et ligands', 'Pharmacologie', C.pha, 'J+7'],
      ['Éthique médicale', 'Santé, Société, Humanité', C.ssh, 'J+3'],
      ['Tests statistiques', 'Biostatistiques', C.stat, 'J+1'],
      ['Fonction rénale', 'Physiologie', C.phy, 'J+15'],
      ['Membre supérieur', 'Anatomie spécifique', C.ana, 'J+21'],
      ['Membre inférieur', 'Anatomie spécifique', C.ana, 'J+7'],
      ['Lipides', 'Physiologie', C.phy, 'J+3'],
      ['Santé publique', 'Santé, Société, Humanité', C.ssh, 'J+15'],
      ['Thermodynamique', 'Biophysique', C.bio, 'J+5'],
      ['Cycle cellulaire', 'Anatomie spécifique', C.ana, 'J+1'],
      ['Embryologie', 'Anatomie spécifique', C.ana, 'J+30'],
      ['Moelle épinière', 'Anatomie spécifique', C.ana, 'J+45'],
      ['Épistémologie', 'Santé, Société, Humanité', C.ssh, 'J+7'],
      ['Interactions médicamenteuses', 'Pharmacologie', C.pha, 'J+3'],
      ['Plexus brachial', 'Anatomie spécifique', C.ana, 'J+21'],
      ['Électrophysiologie', 'Physiologie', C.phy, 'J+60']
    ];
    const base = mode === 'beaucoup' ? all : (mode === 'peu' ? all.slice(6, 9) : []);
    const list = base.filter((f) => !st.off.includes(f[1]) && (!st.lateOnly || f[3].indexOf('retard') > -1));
    const SUBJ = [['Anatomie spécifique', C.ana], ['Physiologie', C.phy], ['Santé, Société, Humanité', C.ssh], ['Biophysique', C.bio], ['Pharmacologie', C.pha], ['Biostatistiques', C.stat]];
    const subjOpts = SUBJ.map(([name, color]) => ({
      name, color, count: base.filter((f) => f[1] === name).length, on: !st.off.includes(name),
      toggle: () => this.setState({ off: st.off.includes(name) ? st.off.filter((x) => x !== name) : st.off.concat(name) })
    }));
    const nFilters = st.off.length + (st.lateOnly ? 1 : 0);
    const fiches = list.map(([title, subject, color, tag], i) => {
      const late = tag.indexOf('retard') > -1;
      return { title, subject, color, tag, tagBg: late ? '#F6EEDC' : '#EEF2F8', tagColor: late ? '#8A6420' : '#2F5D8A', delay: (0.1 + i * 0.04).toFixed(2) + 's' };
    });
    const n = list.length;
    const stats = [['4 j', 'd’affilée'], ['6 h 40', 'cette semaine'], ['16/26', 'fiches maîtrisées']].map(([v, l], i) => ({ v, l, bg: i === 0 ? '#15304E' : '#FDFCFA', fg: i === 0 ? '#FFFFFF' : '#1A1D23' }));
    const shades = ['#EEEAE2', '#C9D6E8', '#8EA8CC', '#4F72A3', '#15304E'];
    const heat = Array.from({ length: 112 }, (_, i) => {
      const r = Math.abs(Math.sin((i + 1) * 7.31)) % 1;
      const recent = i / 112;
      let lvl = r < 0.28 ? 0 : Math.min(4, Math.floor(r * 4 + recent * 1.6));
      if (i > 107) lvl = 0;
      if (i === 107) lvl = 3;
      const mins = [0, 25, 50, 80, 110][lvl];
      return { bg: shades[lvl], t: mins ? mins + ' min de révision' : 'pas de session', d: (0.2 + i * 0.004).toFixed(3) + 's' };
    });
    const tasks = [
      { title: 'Imprimer le poly de pharmaco', when: 'aujourd’hui' },
      { title: 'Rendre le TD de biophysique', when: 'ven.' },
      { title: 'Relire les annales d’anatomie', when: 'sam.' }
    ];
    return {
      fiches, stats, heat, tasks, subjOpts,
      mainH: st.more ? 'auto' : '100vh',
      listWrap: st.more ? 'nowrap' : 'wrap',
      hasMore: n > 6, moreLabel: st.more ? 'Voir moins' : 'Voir plus',
      toggleMore: () => this.setState({ more: !st.more }),
      filterOpen: st.filterOpen, filterExpanded: st.filterOpen ? 'true' : 'false',
      toggleFilter: () => this.setState({ filterOpen: !st.filterOpen }),
      filterLabel: nFilters ? 'Filtres (' + nFilters + ')' : 'Filtrer', filterBg: nFilters ? '#EEF2F8' : '#F1EEE7',
      lateOnly: st.lateOnly, toggleLate: () => this.setState({ lateOnly: !st.lateOnly }),
      title: n ? n + (n > 1 ? ' fiches à réviser' : ' fiche à réviser') : 'Rien à réviser aujourd’hui',
      sub: n ? (mode === 'beaucoup' && !nFilters ? 'Dont 6 en retard, commence par elles' : 'Environ 1 h') : 'Profites en pour avancer sur ta liste à faire'
    };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="0" />
      </div>
      <main style={{flex: "1", minWidth: "0", height: v.mainH, boxSizing: "border-box", padding: "44px 56px 40px", display: "flex", flexDirection: "column", gap: "28px"}}>
        <header className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "3.4px"}}>
          <span style={{fontSize: "12.7px", color: "#6B6F76"}}>
            {"Jeudi 5 novembre"}
          </span>
          <h1 style={{margin: "0", fontSize: "30.5px", fontWeight: "700", letterSpacing: "-.02em"}}>
            {"Bonjour Lou"}
          </h1>
        </header>
        <div style={{flex: "1", minHeight: "0", display: "flex", gap: "23.7px", alignItems: "stretch"}}>
          <section aria-label={"À réviser aujourd'hui"} className={"mr-rise"} style={{flex: "1", minWidth: "0", minHeight: "0", display: "flex", flexDirection: "column", padding: "23.7px 25.4px 10px", borderRadius: "16.9px", background: "#FDFCFA", boxShadow: "0 0 0 1px #ECE8DF", animationDelay: ".05s"}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16.9px", paddingBottom: "15.3px"}}>
              <span style={{display: "flex", flexDirection: "column", gap: "3.4px"}}>
                <span style={{fontSize: "22px", fontWeight: "700", letterSpacing: "-.01em"}}>
                  {v.title}
                </span>
                <span style={{fontSize: "12.7px", color: "#6B6F76"}}>
                  {v.sub}
                </span>
              </span>
              <span style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <span style={{position: "relative"}}>
                  <button type={"button"} className={"mr-ghost"} onClick={v.toggleFilter} aria-expanded={v.filterExpanded} aria-label={"Filtrer"} style={{font: "inherit", height: "40px", display: "flex", alignItems: "center", gap: "7px", padding: "0 12px", border: "0", borderRadius: "10px", background: v.filterBg, color: "#3D424A", fontSize: "13.5px", fontWeight: "600", cursor: "pointer"}}>
                    <svg width={"16"} height={"16"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.9"} strokeLinecap={"round"} aria-hidden={"true"}>
                      <path d={"M4 6h16M7 12h10M10 18h4"} />
                    </svg>
                    {v.filterLabel}{" "}
                  </button>
                  {v.filterOpen ? (
                    <>
                      <div role={"menu"} style={{position: "absolute", right: "0", top: "46px", zIndex: "5", width: "260px", padding: "6px", borderRadius: "12px", background: "#FFFFFF", boxShadow: "0 8px 28px rgba(26,29,35,.14), 0 0 0 1px rgba(26,29,35,.06)", display: "flex", flexDirection: "column"}}>
                        <label className={"mr-menu"} style={{display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "8px", fontSize: "13.5px", cursor: "pointer"}}>
                          <input type={"checkbox"} checked={v.lateOnly} onChange={v.toggleLate} style={{margin: "0", width: "15px", height: "15px", accentColor: "#15304E"}} />
                          <span style={{flex: "1", fontWeight: "600"}}>
                            {"En retard seulement"}
                          </span>
                        </label>
                        <span style={{height: "1px", background: "#EDE9E1", margin: "4px 6px"}}></span>
                        {(v.subjOpts || []).map((o: any, i_o: number) => (
                          <Fragment key={i_o}>
                            <label className={"mr-menu"} style={{display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "8px", fontSize: "13.5px", cursor: "pointer"}}>
                              <input type={"checkbox"} checked={o.on} onChange={o.toggle} style={{margin: "0", width: "15px", height: "15px", accentColor: "#15304E"}} />
                              <span style={{width: "8px", height: "8px", borderRadius: "50%", background: o.color}}></span>
                              <span style={{flex: "1"}}>
                                {o.name}
                              </span>
                              <span style={{color: "#6B6F76"}}>
                                {o.count}
                              </span>
                            </label>
                          </Fragment>
                        ))}
                      </div>
                    </>
                  ) : null}
                </span>
                <Link href={"/v2/session"} className={"mr-btn"} style={{fontSize: "14.4px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", padding: "12.7px 25.4px", borderRadius: "10.1px", textDecoration: "none"}}>
                  {"Commencer"}
                </Link>
              </span>
            </div>
            <div style={{flex: "1", minHeight: "0", display: "flex", flexDirection: "column", flexWrap: v.listWrap, alignContent: "flex-start", overflow: "hidden"}}>
              {(v.fiches || []).map((f: any, i_f: number) => (
                <Fragment key={i_f}>
                  <Link href={"/v2/session"} className={"mr-row mr-rise"} style={{flex: "none", width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: "13.5px", padding: "12.7px 10.1px", borderTop: "1px solid #F1EEE7", borderRadius: "8.5px", textDecoration: "none", color: "inherit", animationDelay: f.delay}}>
                    <span style={{width: "8.5px", height: "8.5px", borderRadius: "50%", background: f.color, flex: "none"}}></span>
                    <span style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px"}}>
                      <span style={{fontSize: "13.5px", fontWeight: "600"}}>
                        {f.title}
                      </span>
                      <span style={{fontSize: "11.9px", color: "#6B6F76"}}>
                        {f.subject}
                      </span>
                    </span>
                    <span style={{fontSize: "11.9px", fontWeight: "600", color: f.tagColor, background: f.tagBg, padding: "4.2px 9.3px", borderRadius: "845.6px", whiteSpace: "nowrap"}}>
                      {f.tag}
                    </span>
                  </Link>
                </Fragment>
              ))}
            </div>
            {v.hasMore ? (
              <>
                <div style={{flex: "none", borderTop: "1px solid #F1EEE7", paddingTop: "8px"}}>
                  <button type={"button"} className={"mr-ghost"} onClick={v.toggleMore} style={{font: "inherit", width: "100%", padding: "9px", border: "0", borderRadius: "8px", background: "transparent", color: "#15304E", fontSize: "13.5px", fontWeight: "600", cursor: "pointer"}}>
                    {v.moreLabel}
                  </button>
                </div>
              </>
            ) : null}
          </section>
          <aside style={{flex: "0 0 355.5px", alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: "16.9px"}}>
            <div className={"mr-rise"} style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10.1px", animationDelay: ".1s"}}>
              {(v.stats || []).map((s: any, i_s: number) => (
                <Fragment key={i_s}>
                  <Link href={"/v2/statistiques"} style={{display: "flex", flexDirection: "column", gap: "3.4px", padding: "15.3px", borderRadius: "13.5px", background: s.bg, color: s.fg, textDecoration: "none", boxShadow: "0 0 0 1px #ECE8DF"}}>
                    <span style={{fontSize: "22px", fontWeight: "700", letterSpacing: "-.01em"}}>
                      {s.v}
                    </span>
                    <span style={{fontSize: "11px", opacity: ".72"}}>
                      {s.l}
                    </span>
                  </Link>
                </Fragment>
              ))}
            </div>
            <section aria-label={"Ton activité"} className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "11.9px", padding: "18.6px 20.3px", borderRadius: "15.3px", background: "#FDFCFA", boxShadow: "0 0 0 1px #ECE8DF", animationDelay: ".15s"}}>
              <span style={{display: "flex", justifyContent: "space-between", alignItems: "baseline"}}>
                <span style={{fontSize: "14.4px", fontWeight: "700"}}>
                  {"Ton activit\u00e9"}
                </span>
                <span style={{fontSize: "11px", color: "#6B6F76"}}>
                  {"16 derni\u00e8res semaines"}
                </span>
              </span>
              <div style={{display: "flex", gap: "6.8px"}}>
                <div style={{display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "1px 0", fontSize: "9.3px", color: "#9AA0A8"}}>
                  <span>
                    {"L"}
                  </span>
                  <span>
                    {"M"}
                  </span>
                  <span>
                    {"V"}
                  </span>
                  <span>
                    {"D"}
                  </span>
                </div>
                <div style={{flex: "1", display: "grid", gridTemplateColumns: "repeat(16, minmax(0, 1fr))", gridAutoFlow: "column", gridTemplateRows: "repeat(7, 11.9px)", gap: "3.4px"}}>
                  {(v.heat || []).map((h: any, i_h: number) => (
                    <Fragment key={i_h}>
                      <span className={"mr-tile mr-pop"} title={h.t} style={{borderRadius: "3px", background: h.bg, animationDelay: h.d}}></span>
                    </Fragment>
                  ))}
                </div>
              </div>
              <span style={{display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "3.4px", fontSize: "10.1px", color: "#9AA0A8"}}>
                {"Moins "}
                <span style={{width: "9.3px", height: "9.3px", borderRadius: "3px", background: "#EEEAE2"}}></span>
                <span style={{width: "9.3px", height: "9.3px", borderRadius: "3px", background: "#C9D6E8"}}></span>
                <span style={{width: "9.3px", height: "9.3px", borderRadius: "3px", background: "#8EA8CC"}}></span>
                <span style={{width: "9.3px", height: "9.3px", borderRadius: "3px", background: "#4F72A3"}}></span>
                <span style={{width: "9.3px", height: "9.3px", borderRadius: "3px", background: "#15304E"}}></span>
                {"Plus"}
              </span>
            </section>
            <section aria-label={"À faire"} className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "2px", padding: "18.6px 20.3px 11.9px", borderRadius: "15.3px", background: "#FDFCFA", boxShadow: "0 0 0 1px #ECE8DF", animationDelay: ".2s"}}>
              <span style={{fontSize: "14.4px", fontWeight: "700", paddingBottom: "6.8px"}}>
                {"\u00c0 faire"}
              </span>
              {(v.tasks || []).map((t: any, i_t: number) => (
                <Fragment key={i_t}>
                  <label className={"mr-row"} style={{display: "flex", alignItems: "center", gap: "10.1px", padding: "8.5px 6.8px", borderRadius: "6.8px", fontSize: "12.7px", cursor: "pointer"}}>
                    <input type={"checkbox"} style={{margin: "0", width: "14.4px", height: "14.4px", accentColor: "#15304E"}} />
                    <span style={{flex: "1"}}>
                      {t.title}
                    </span>
                    <span style={{fontSize: "11px", color: "#6B6F76"}}>
                      {t.when}
                    </span>
                  </label>
                </Fragment>
              ))}
              <label style={{display: "flex", alignItems: "center", gap: "10.1px", padding: "8.5px 6.8px", fontSize: "12.7px", color: "#6B6F76"}}>
                <span aria-hidden={"true"} style={{width: "14.4px", textAlign: "center", fontSize: "15.3px", lineHeight: "1"}}>
                  {"+"}
                </span>
                <input type={"text"} aria-label={"Ajouter une tâche"} placeholder={"Ajouter une tâche"} style={{font: "inherit", border: "0", background: "transparent", outline: "none", flex: "1", minWidth: "0", color: "#1A1D23"}} />
              </label>
            </section>
          </aside>
        </div>
      </main>
    </div>
    </>
  )
}
