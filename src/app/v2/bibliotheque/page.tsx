// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-book{font:inherit;position:relative;display:block;padding:0;border:0;background:transparent;cursor:pointer;transform-origin:left bottom;transition:transform .35s cubic-bezier(.2,.8,.2,1)}\n.mr-book:hover{transform:perspective(700px) rotateY(-22deg) translateY(-8px)}\n.mr-book:active{transform:perspective(700px) rotateY(-28deg) translateY(-10px) scale(1.02)}\n.mr-book .shadow{transition:transform .35s ease, opacity .35s ease}\n.mr-book:hover .shadow{transform:scaleX(.9);opacity:.6}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-drop{0%{opacity:0;transform:translateY(-26px)}70%{opacity:1;transform:translateY(3px)}100%{transform:none}}\n@keyframes mr-fill{from{width:0}}\n@keyframes mr-sheen{0%{background-position:-160% 0}55%,100%{background-position:260% 0}}\n@keyframes mr-badge{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-drop{animation:mr-drop .55s cubic-bezier(.2,.8,.2,1) both}\n.mr-bar{animation:mr-fill 1.2s cubic-bezier(.2,.8,.2,1) .3s both}\n.mr-foil{background:linear-gradient(110deg,transparent 35%,rgba(255,244,210,.28) 50%,transparent 65%);background-size:250% 100%;animation:mr-sheen 3.6s ease-in-out infinite}\n.mr-badge{animation:mr-badge 1.8s ease-in-out infinite}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: '0-1' };
  }
  renderVals() {
    const st = this.state;
    const mix = (hex, k, to) => { const n = parseInt(hex.slice(1), 16); const t = to === 'w' ? 255 : 0; const f = (c) => Math.round(c + (t - c) * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
    const scale = ['#ECE8E0', '#D98C7E', '#E2AE6A', '#D8C46A', '#93BC80', '#4E9A6B'];
    const SUB = [
      ['Anatomie spécifique', 'ANATOMIE', '#3F6DB8', [['Cerveau, vascularisation', 6], ['Nerfs crâniens', 4], ['Tronc cérébral', 3], ['Membre supérieur', 11], ['Membre inférieur', 9], ['Moelle épinière', 5], ['Bassin', 7], ['Thorax', 13], ['Abdomen', 8], ['Cou', 2], ['Face', 6], ['Cœur', 10], ['Rachis', 4], ['Crâne', 12], ['Œil', 1]]],
      ['Physiologie', 'PHYSIOLOGIE', '#7556A8', [['Potentiel d\x27action', 5], ['Fonction rénale', 12], ['Respiration', 7]]],
      ['Santé, Société, Humanité', 'SSH', '#2F7D71', [['Éthique médicale', 14], ['Santé publique', 9], ['Épidémiologie', 6]]],
      ['Biophysique', 'BIOPHYSIQUE', '#B0473F', [['Optique géométrique', 3], ['Thermodynamique', 10]]],
      ['Pharmacologie', 'PHARMACO', '#B8742E', [['Pharmacocinétique', 3], ['Récepteurs et ligands', 6]]],
      ['Biostatistiques', 'BIOSTATS', '#86603C', [['Tests statistiques', 1]]]
    ];
    const isNew = { '0-1': true, '1-0': true, '0-7': true, '4-1': true };
    const paper = 'repeating-linear-gradient(90deg, #FDFBF6 0, #FDFBF6 1.5px, #D8CFBF 1.5px, #D8CFBF 2.5px)';
    const gilt = 'repeating-linear-gradient(90deg, #FBE3A0 0, #FBE3A0 1px, #E2AE45 1px, #E2AE45 2px)';
    let total = 0, pagesAll = 0, gold = 0, sel = null;
    let d = 0;
    const shelves = SUB.map(([name, short, color, list], si) => {
      let sp = 0;
      const books = list.map(([title, count], i) => {
        const id = si + '-' + i;
        const mastered = count >= 9;
        total++; pagesAll += count; sp += count; if (mastered) gold++;
        const on = st.sel === id;
        const pw = 8 + Math.round(count * 1.6);
        const tone = ((i * 37) % 5) / 5;
        const base = tone < .4 ? mix(color, tone * 0.3, 'w') : mix(color, (tone - .4) * 0.3, 'b');
        const cover = 'linear-gradient(150deg, ' + mix(base, 0.16, 'w') + ' 0%, ' + base + ' 45%, ' + mix(base, 0.28, 'b') + ' 100%)';
        const notes = Array.from({ length: count }, (_, k) => Math.min(5, 2 + Math.floor(k / 3) + (k % 2)));
        const avg = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
        if (on) sel = {
          title, short, count: String(count), avg: avg.toFixed(1).replace('.', ',') + '/5', cover,
          pages: mastered ? gilt : paper, bigPw: (12 + Math.round(count * 2.2)) + 'px', bigW: (156 + 12 + Math.round(count * 2.2)) + 'px',
          rule: mastered ? '#F2C14E' : 'rgba(255,255,255,.7)', titleColor: mastered ? '#FFE7A3' : '#FFFFFF',
          state: mastered ? 'Livre doré, fiche maîtrisée' : 'Encore ' + (9 - count) + ' révisions pour le dorer',
          stateColor: mastered ? '#B07A10' : '#6B6F76',
          steps: Array.from({ length: 14 }, (_, k) => ({ bg: k < count ? scale[notes[k]] : '#F1EEE7' }))
        };
        return {
          title, short, count: String(count), label: title + ', ' + count + ' pages', cover,
          pw: pw + 'px', totalW: (96 + pw) + 'px', pages: mastered ? gilt : paper, gold: mastered,
          rule: mastered ? '#F2C14E' : 'rgba(255,255,255,.7)', titleColor: mastered ? '#FFE7A3' : '#FFFFFF',
          ring: on ? '0 0 0 3px #FFFFFF, 0 0 0 5px #15304E' : '0 0 0 0 transparent',
          pressed: on ? 'true' : 'false', isNew: !!isNew[id], delay: (0.1 + (d++) * 0.035).toFixed(2) + 's',
          pick: () => this.setState({ sel: id })
        };
      });
      return { name, color, count: books.length, pages: sp, books, delay: (si * 0.06) + 's' };
    });
    const stats = [{ v: String(total), plus: '', l: 'livres' }, { v: String(pagesAll), plus: ' +9', l: 'pages' }, { v: String(gold), plus: '', l: 'livres dorés' }];
    return { shelves, stats, sel: sel || {} };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="3" />
      </div>
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 64px", display: "flex", gap: "32px", alignItems: "flex-start"}}>
        <div style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px"}}>
          <header style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "6px"}}>
              <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
                {"Biblioth\u00e8que"}
              </h1>
              <span style={{fontSize: "16px", color: "#6B6F76"}}>
                {"Un livre par fiche. Chaque r\u00e9vision lui ajoute des pages, une fiche ma\u00eetris\u00e9e se dore."}
              </span>
            </span>
            <span style={{display: "flex", gap: "12px"}}>
              {(v.stats || []).map((s: any, i_s: number) => (
                <Fragment key={i_s}>
                  <span style={{display: "flex", flexDirection: "column", gap: "2px", padding: "12px 18px", borderRadius: "14px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", minWidth: "110px"}}>
                    <span style={{fontSize: "24px", fontWeight: "700"}}>
                      {s.v}
                      <span style={{fontSize: "14px", fontWeight: "700", color: "#C98A12"}}>
                        {s.plus}
                      </span>
                    </span>
                    <span style={{fontSize: "13px", color: "#6B6F76"}}>
                      {s.l}
                    </span>
                  </span>
                </Fragment>
              ))}
            </span>
          </header>
          {(v.shelves || []).map((sh: any, i_sh: number) => (
            <Fragment key={i_sh}>
              <section className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "6px", padding: "22px 28px 0", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: sh.delay}}>
                <span style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", fontWeight: "700"}}>
                    <span style={{width: "10px", height: "10px", borderRadius: "50%", background: sh.color}}></span>
                    {sh.name}
                  </span>
                  <span style={{fontSize: "15px", color: "#6B6F76"}}>
                    {sh.count}{" livres, "}{sh.pages}{" pages"}
                  </span>
                </span>
                <div style={{display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "28px 26px", padding: "30px 6px 0"}}>
                  {(sh.books || []).map((b: any, i_b: number) => (
                    <Fragment key={i_b}>
                      <div className={"mr-drop"} style={{position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", animationDelay: b.delay}}>
                        {b.isNew ? (
                          <>
                            <span className={"mr-badge"} style={{position: "absolute", top: "-26px", left: "50%", marginLeft: "-20px", zIndex: "2", width: "40px", textAlign: "center", fontSize: "12px", fontWeight: "700", color: "#8A5A08", background: "#FDF0CC", borderRadius: "999px", padding: "3px 0"}}>
                              {"+1"}
                            </span>
                          </>
                        ) : null}
                        <button type={"button"} className={"mr-book"} onClick={b.pick} aria-label={b.label} aria-pressed={b.pressed} style={{width: b.totalW, height: "144px"}}>
                          <span style={{position: "absolute", left: "96px", top: "4px", bottom: "3px", width: b.pw, borderRadius: "0 4px 4px 0", background: b.pages, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.10), 2px 3px 6px rgba(26,29,35,.12)"}}></span>
                          <span style={{position: "absolute", left: "0", top: "0", width: "102px", height: "144px", borderRadius: "3px 7px 7px 3px", background: b.cover, boxShadow: `${b.ring}, 0 6px 14px rgba(26,29,35,.18)`, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "14px 10px 12px 20px", boxSizing: "border-box", textAlign: "left"}}>
                            <span style={{position: "absolute", left: "0", top: "0", bottom: "0", width: "11px", background: "linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,.08) 70%, rgba(255,255,255,.18))"}}></span>
                            <span style={{position: "absolute", left: "11px", top: "0", bottom: "0", width: "1px", background: "rgba(255,255,255,.25)"}}></span>
                            {b.gold ? (
                              <>
                                <span className={"mr-foil"} style={{position: "absolute", inset: "0"}}></span>
                              </>
                            ) : null}
                            <span style={{position: "relative", fontSize: "10px", fontWeight: "700", letterSpacing: ".1em", color: "rgba(255,255,255,.75)"}}>
                              {b.short}
                            </span>
                            <span style={{position: "relative", display: "flex", flexDirection: "column", gap: "10px"}}>
                              <span style={{height: "2px", width: "26px", background: b.rule}}></span>
                              <span style={{fontSize: "13px", fontWeight: "700", lineHeight: "1.2", color: b.titleColor, hyphens: "auto", overflowWrap: "break-word", display: "-webkit-box", WebkitLineClamp: "4", WebkitBoxOrient: "vertical", overflow: "hidden"}}>
                                {b.title}
                              </span>
                            </span>
                          </span>
                        </button>
                        <span className={"shadow"} style={{display: "block", width: b.totalW, height: "10px", marginTop: "2px", borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(26,29,35,.22), rgba(26,29,35,0) 70%)"}}></span>
                        <span style={{marginTop: "6px", fontSize: "13px", color: "#6B6F76"}}>
                          {b.count}{" pages"}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
                <div style={{height: "22px"}}></div>
              </section>
            </Fragment>
          ))}
        </div>
        <aside style={{flex: "0 0 330px", position: "sticky", top: "44px", display: "flex", flexDirection: "column", gap: "18px"}}>
          <section className={"mr-rise"} aria-label={"Livre choisi"} style={{display: "flex", flexDirection: "column", gap: "18px", padding: "28px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
            <div style={{alignSelf: "center", position: "relative", width: v.sel.bigW, height: "230px"}}>
              <span style={{position: "absolute", left: "156px", top: "6px", bottom: "5px", width: v.sel.bigPw, borderRadius: "0 5px 5px 0", background: v.sel.pages, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)"}}></span>
              <span style={{position: "absolute", left: "0", top: "0", width: "164px", height: "230px", borderRadius: "4px 10px 10px 4px", background: v.sel.cover, boxShadow: "0 12px 26px rgba(26,29,35,.22)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px 16px 18px 28px", boxSizing: "border-box"}}>
                <span style={{position: "absolute", left: "0", top: "0", bottom: "0", width: "14px", background: "linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,.08) 70%, rgba(255,255,255,.18))"}}></span>
                <span style={{position: "relative", fontSize: "11px", fontWeight: "700", letterSpacing: ".1em", color: "rgba(255,255,255,.75)"}}>
                  {v.sel.short}
                </span>
                <span style={{position: "relative", display: "flex", flexDirection: "column", gap: "12px"}}>
                  <span style={{height: "2px", width: "32px", background: v.sel.rule}}></span>
                  <span style={{fontSize: "20px", fontWeight: "700", lineHeight: "1.2", color: v.sel.titleColor}}>
                    {v.sel.title}
                  </span>
                </span>
              </span>
            </div>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "20px", fontWeight: "700"}}>
                {v.sel.title}
              </span>
              <span style={{fontSize: "14px", fontWeight: "600", color: v.sel.stateColor}}>
                {v.sel.state}
              </span>
            </span>
            <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
              <span style={{display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#6B6F76"}}>
                <span>
                  {v.sel.count}{" pages sur 14"}
                </span>
                <span>
                  {"moyenne "}{v.sel.avg}
                </span>
              </span>
              <span style={{display: "flex", gap: "3px"}}>
                {(v.sel.steps || []).map((p: any, i_p: number) => (
                  <Fragment key={i_p}>
                    <span style={{flex: "1", height: "8px", borderRadius: "3px", background: p.bg}}></span>
                  </Fragment>
                ))}
              </span>
            </div>
            <Link href={"/v2/matieres"} className={"mr-btn"} style={{textAlign: "center", fontSize: "16px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", padding: "14px", borderRadius: "12px", textDecoration: "none"}}>
              {"Ouvrir la fiche"}
            </Link>
          </section>
        </aside>
      </main>
    </div>
    </>
  )
}
