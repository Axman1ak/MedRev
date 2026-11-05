// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-book{position:relative;cursor:pointer;border:0;padding:0;transform-origin:bottom center;transition:transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease}\n.mr-book:hover{transform:translateY(-14px);box-shadow:0 14px 22px rgba(26,29,35,.22);z-index:3}\n.mr-book:active{transform:translateY(-18px) scale(1.03)}\n.mr-slot{display:flex;align-items:flex-end}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}\n@keyframes mr-fill{from{width:0}}\n@keyframes mr-pull{0%{transform:translateY(24px);opacity:0}100%{transform:none;opacity:1}}\n@keyframes mr-shimmer{0%{background-position:-120% 0}60%,100%{background-position:220% 0}}\n@keyframes mr-plus{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(-4px)}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-grow{transform-origin:bottom;animation:mr-grow .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-bar{animation:mr-fill 1.2s cubic-bezier(.2,.8,.2,1) .3s both}\n.mr-pull{animation:mr-pull .45s cubic-bezier(.2,.8,.2,1) both}\n.mr-gilt::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(105deg,transparent 30%,rgba(255,236,170,.55) 50%,transparent 70%);background-size:220% 100%;animation:mr-shimmer 3.2s ease-in-out infinite;pointer-events:none}\n.mr-new{animation:mr-plus 1.6s ease-in-out infinite}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: '0-1' };
  }
  renderVals() {
    const st = this.state;
    const mix = (hex, k, to) => { const n = parseInt(hex.slice(1), 16); const t = to === 'w' ? 255 : 0; const f = (c) => Math.round(c + (t - c) * k); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; };
    const scale = ['#ECE8E0', '#D98C7E', '#E2AE6A', '#D8C46A', '#93BC80', '#4E9A6B'];
    const SUB = [
      ['Anatomie spécifique', 'ANATOMIE', '#4F7CC9', [['Cerveau, vascularisation', 6], ['Nerfs crâniens', 4], ['Tronc cérébral', 3], ['Membre supérieur', 11], ['Membre inférieur', 9], ['Moelle épinière', 5], ['Bassin', 7], ['Thorax', 13], ['Abdomen', 8], ['Cou', 2], ['Face', 6], ['Cœur, anatomie', 10], ['Rachis', 4], ['Crâne', 12], ['Œil', 1]]],
      ['Physiologie', 'PHYSIOLOGIE', '#8B6BB8', [['Potentiel d\x27action', 5], ['Fonction rénale', 12], ['Respiration', 7]]],
      ['Santé, Société, Humanité', 'SSH', '#3E8E85', [['Éthique médicale', 14], ['Santé publique', 9], ['Épidémiologie', 6]]],
      ['Biophysique', 'BIOPHYSIQUE', '#C4554D', [['Optique géométrique', 3], ['Thermodynamique', 10]]],
      ['Pharmacologie', 'PHARMACOLOGIE', '#D08A3E', [['Pharmacocinétique', 3], ['Récepteurs et ligands', 6]]],
      ['Biostatistiques', 'BIOSTATISTIQUES', '#9C7148', [['Tests statistiques', 1]]]
    ];
    const isNew = { '0-1': true, '1-0': true, '0-7': true, '4-1': true };
    let pages = 0, gilded = 0, books = 0, sel = null;
    const shelves = SUB.map(([name, short, color, list], si) => {
      let sp = 0;
      const bks = list.map(([title, count], i) => {
        const r = Math.abs(Math.sin((i + 1) * 12.9898 + si * 78.233)) % 1;
        const notes = Array.from({ length: count }, (_, k) => Math.min(5, 2 + Math.floor(((r * (k + 3) * 7) % 1) * 2) + Math.floor(k / 4)));
        const avg = notes.reduce((a, b) => a + b, 0) / count;
        const mastered = count >= 9;
        pages += count; sp += count; books++; if (mastered) gilded++;
        const base = mix(color, 0.05 + r * 0.18, 'w');
        const dark = mix(color, 0.28, 'b');
        const light = mix(color, 0.3, 'w');
        const id = si + '-' + i;
        const on = st.sel === id;
        const h = 190 + Math.round(r * 40);
        const band = mastered ? '#F2C14E' : 'rgba(255,255,255,.35)';
        if (on) sel = {
          title, subject: name, short, count: String(count), avg: avg.toFixed(1).replace('.', ',') + '/5',
          state: mastered ? 'livre doré' : (count >= 7 ? 'presque doré' : 'en cours'),
          cover: 'linear-gradient(135deg, ' + light + ', ' + color + ' 55%, ' + dark + ')', band: mastered ? '#F2C14E' : 'rgba(255,255,255,.7)',
          steps: Array.from({ length: 14 }, (_, k) => ({ bg: k < count ? scale[notes[k]] : '#F1EEE7' }))
        };
        return {
          title, count: String(count), label: title + ', ' + count + ' pages',
          w: (30 + count * 5) + 'px', h: h + 'px', textMax: (h - 70) + 'px',
          bg: 'linear-gradient(90deg, ' + dark + ' 0%, ' + base + ' 18%, ' + light + ' 46%, ' + base + ' 78%, ' + dark + ' 100%)',
          band, gilt: mastered ? 'mr-gilt' : '',
          shadow: on ? '0 0 0 3px #FFFFFF, 0 0 0 5px #15304E' : (mastered ? 'inset 0 0 0 2px rgba(242,193,78,.85)' : 'none'),
          pressed: on ? 'true' : 'false', isNew: !!isNew[id],
          delay: (0.12 + si * 0.08 + i * 0.04).toFixed(2) + 's',
          pick: () => this.setState({ sel: id })
        };
      });
      return { name, color, count: bks.length, pages: sp, books: bks, delay: (0.1 + si * 0.06) + 's' };
    });
    return { shelves, pages: String(pages), gilded: String(gilded), books: String(books), rankPct: Math.min(100, Math.round(pages / 300 * 100)) + '%', sel: sel || {} };
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
          <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
            {"Biblioth\u00e8que"}
          </h1>
          <section aria-label={"Résumé"} className={"mr-rise"} style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px"}}>
            <div style={{display: "flex", flexDirection: "column", gap: "6px", padding: "24px 26px", borderRadius: "18px", background: "#15304E", color: "#FFFFFF"}}>
              <span style={{fontSize: "15px", color: "rgba(255,255,255,.65)"}}>
                {"Pages \u00e9crites"}
              </span>
              <span style={{display: "flex", alignItems: "baseline", gap: "10px"}}>
                <span style={{fontSize: "40px", fontWeight: "700", letterSpacing: "-.02em"}}>
                  {v.pages}
                </span>
                <span className={"mr-new"} style={{fontSize: "16px", fontWeight: "700", color: "#F4C35A"}}>
                  {"+9 aujourd\u2019hui"}
                </span>
              </span>
              <span style={{fontSize: "14px", color: "rgba(255,255,255,.65)"}}>
                {"Chaque r\u00e9vision ajoute une page \u00e0 son livre"}
              </span>
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: "6px", padding: "24px 26px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {"Livres dor\u00e9s"}
              </span>
              <span style={{fontSize: "40px", fontWeight: "700", letterSpacing: "-.02em"}}>
                {v.gilded}
                <span style={{fontSize: "18px", color: "#9AA0A8", fontWeight: "500"}}>
                  {" sur "}{v.books}
                </span>
              </span>
              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                {"Une fiche ma\u00eetris\u00e9e se dore"}
              </span>
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: "10px", padding: "24px 26px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
              <span style={{display: "flex", justifyContent: "space-between", fontSize: "15px", color: "#6B6F76"}}>
                <span>
                  {"Ton rang"}
                </span>
                <span>
                  {v.pages}{" / 300 pages"}
                </span>
              </span>
              <span style={{fontSize: "28px", fontWeight: "700"}}>
                {"Lettr\u00e9"}
              </span>
              <span style={{height: "8px", borderRadius: "4px", background: "#F1EEE7", overflow: "hidden"}}>
                <span className={"mr-bar"} style={{display: "block", height: "8px", width: v.rankPct, borderRadius: "4px", background: "#15304E"}}></span>
              </span>
              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                {"Prochain rang, \u00c9rudit"}
              </span>
            </div>
          </section>
          <section className={"mr-rise"} aria-label={"Tes livres"} style={{display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "36px 44px", padding: "30px 32px 34px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".1s"}}>
            {(v.shelves || []).map((s: any, i_s: number) => (
              <Fragment key={i_s}>
                <div style={{display: "flex", flexDirection: "column", gap: "14px"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: "700"}}>
                    <span style={{width: "9px", height: "9px", borderRadius: "50%", background: s.color}}></span>
                    {s.name}
                    <span style={{fontWeight: "500", color: "#9AA0A8"}}>
                      {s.pages}{" pages"}
                    </span>
                  </span>
                  <div style={{display: "flex", alignItems: "flex-end", gap: "5px", height: "270px", boxSizing: "border-box", padding: "30px 10px 0", borderBottom: "10px solid #E6DBC8", borderRadius: "0 0 4px 4px"}}>
                    {(s.books || []).map((b: any, i_b: number) => (
                      <Fragment key={i_b}>
                        <span className={"mr-slot mr-grow"} style={{animationDelay: b.delay, position: "relative"}}>
                          <button type={"button"} className={`mr-book ${b.gilt}`} onClick={b.pick} aria-label={b.label} aria-pressed={b.pressed} style={{width: b.w, height: b.h, borderRadius: "4px 4px 2px 2px", background: b.bg, boxShadow: b.shadow, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "12px 0 10px", boxSizing: "border-box", overflow: "hidden"}}>
                            <span style={{width: "100%", height: "4px", background: b.band}}></span>
                            <span style={{writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: "14px", fontWeight: "700", color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxHeight: b.textMax, textShadow: "0 1px 1px rgba(0,0,0,.18)"}}>
                              {b.title}
                            </span>
                            <span style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "100%"}}>
                              <span style={{width: "100%", height: "4px", background: b.band}}></span>
                              <span style={{fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,.85)"}}>
                                {b.count}
                              </span>
                            </span>
                          </button>
                          {b.isNew ? (
                            <>
                              <span className={"mr-new"} style={{position: "absolute", top: "-26px", left: "50%", marginLeft: "-18px", width: "36px", textAlign: "center", fontSize: "13px", fontWeight: "700", color: "#C98A12", background: "#FDF3DC", borderRadius: "999px", padding: "2px 0"}}>
                                {"+1"}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </Fragment>
            ))}
          </section>
        </div>
        <aside style={{flex: "0 0 340px", position: "sticky", top: "44px"}}>
          <section className={"mr-pull"} aria-label={"Livre choisi"} style={{display: "flex", flexDirection: "column", gap: "20px", padding: "28px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
            <div style={{alignSelf: "center", width: "170px", minHeight: "220px", borderRadius: "6px 14px 14px 6px", background: v.sel.cover, boxShadow: "inset 12px 0 0 rgba(0,0,0,.14), 0 14px 28px rgba(26,29,35,.18)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "14px", padding: "22px 18px 20px 28px", boxSizing: "border-box", color: "#FFFFFF"}}>
              <span style={{fontSize: "11px", fontWeight: "700", opacity: ".8", letterSpacing: ".08em"}}>
                {v.sel.short}
              </span>
              <span style={{fontSize: "20px", fontWeight: "700", lineHeight: "1.2", overflowWrap: "anywhere"}}>
                {v.sel.title}
              </span>
              <span style={{height: "4px", width: "50px", background: v.sel.band, borderRadius: "2px"}}></span>
            </div>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "21px", fontWeight: "700"}}>
                {v.sel.title}
              </span>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {v.sel.subject}{", "}{v.sel.state}
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
