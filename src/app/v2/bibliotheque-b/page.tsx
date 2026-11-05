// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-spine{position:relative;display:flex;flex-direction:column;padding:0;border:0;cursor:pointer;overflow:visible;transform-origin:bottom center;transition:transform .25s cubic-bezier(.2,.8,.2,1)}\n.mr-spine:hover{transform:translateY(-14px);z-index:3}\n.mr-spine::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 10px);transform:translate(-50%,6px);white-space:nowrap;background:#15304E;color:#fff;font:600 13px 'Hanken Grotesk',system-ui,sans-serif;padding:7px 11px;border-radius:9px;opacity:0;pointer-events:none;transition:opacity .15s ease, transform .15s ease}\n.mr-spine:hover::after{opacity:1;transform:translate(-50%,0)}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-slide{from{opacity:0;transform:translateY(-18px)}to{opacity:1;transform:none}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-slot{animation:mr-slide .45s cubic-bezier(.2,.8,.2,1) both}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: '2-0' };
  }
  renderVals() {
    const st = this.state;
    const F = [['Nerfs crâniens', 'ANATOMIE', '#3F6DB8'], ['Thorax', 'ANATOMIE', '#3F6DB8'], ['Membre supérieur', 'ANATOMIE', '#3F6DB8'], ['Crâne', 'ANATOMIE', '#3F6DB8'], ['Bassin', 'ANATOMIE', '#3F6DB8'], ['Fonction rénale', 'PHYSIOLOGIE', '#7556A8'], ['Potentiel d\x27action', 'PHYSIOLOGIE', '#7556A8'], ['Éthique médicale', 'SSH', '#2F7D71'], ['Santé publique', 'SSH', '#2F7D71'], ['Thermodynamique', 'BIOPHYSIQUE', '#B0473F'], ['Optique géométrique', 'BIOPHYSIQUE', '#B0473F'], ['Pharmacocinétique', 'PHARMACO', '#B8742E'], ['Récepteurs et ligands', 'PHARMACO', '#B8742E']];
    const J = ['J0', 'J+1', 'J+3', 'J+5', 'J+7', 'J+15', 'J+21', 'J+30'];
    const M = [['Novembre', 39, 'nov.', 4], ['Octobre', 98, 'oct.', 31], ['Septembre', 40, 'sept.', 30]];
    let total = 0, gold = 0, d = 0, sel = null;
    const months = M.map(([name, count, ab, days], mi) => {
      let g = 0;
      const books = Array.from({ length: count }, (_, i) => {
        const r = Math.abs(Math.sin((i + 1) * 12.9898 + mi * 78.233)) % 1;
        const f = F[Math.floor(r * F.length)];
        const note = 2 + Math.floor(((r * 31) % 1) * 4);
        const isGold = note === 5;
        if (isGold) g++;
        const day = Math.max(1, days - Math.floor(i * days / count));
        const id = mi + '-' + i;
        const on = st.sel === id;
        const step = J[Math.floor(((r * 17) % 1) * J.length)];
        if (on) sel = { title: f[0], short: f[1], color: f[2], band: isGold ? '#F6E3A6' : '#F5EFE3', dot: isGold ? '#F2C14E' : '#F5EFE3', step, date: day + ' ' + ab, note: note + '/5', qcm: (55 + Math.round(r * 40)) + ' %', time: (15 + Math.round(r * 35)) + ' min' };
        return {
          title: f[0], color: f[2], band: isGold ? '#F6E3A6' : '#F5EFE3', dot: isGold ? '#F2C14E' : 'rgba(255,255,255,.55)',
          w: (22 + Math.round(((r * 7) % 1) * 8)) + 'px', h: (148 + Math.round(((r * 13) % 1) * 18)) + 'px',
          tip: f[0] + ', ' + step + ', ' + note + '/5', pressed: on ? 'true' : 'false',
          ring: on ? '0 0 0 2px #FFFFFF, 0 0 0 4px #15304E' : 'inset 2px 0 0 rgba(0,0,0,.12)',
          delay: Math.min(0.1 + (d++) * 0.006, 1.2).toFixed(3) + 's',
          pick: () => this.setState({ sel: id })
        };
      });
      total += count; gold += g;
      return { name, count, gold: g, books, delay: (mi * 0.08) + 's' };
    });
    const stats = [{ v: String(total), plus: '', l: 'livres' }, { v: '39', plus: ' +9', l: 'ce mois' }, { v: String(gold), plus: '', l: 'notés 5/5' }];
    return { months, stats, sel: sel || {} };
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
                {"Chaque r\u00e9vision ajoute un livre. Une \u00e9tag\u00e8re par mois."}
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
          {(v.months || []).map((m: any, i_m: number) => (
            <Fragment key={i_m}>
              <section className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "14px", padding: "22px 28px 26px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: m.delay}}>
                <span style={{display: "flex", alignItems: "baseline", justifyContent: "space-between"}}>
                  <span style={{fontSize: "20px", fontWeight: "700"}}>
                    {m.name}
                  </span>
                  <span style={{fontSize: "15px", color: "#6B6F76"}}>
                    {m.count}{" livres, dont "}{m.gold}{" dor\u00e9s"}
                  </span>
                </span>
                <div style={{display: "flex", flexWrap: "wrap", alignItems: "flex-end", alignContent: "flex-start", rowGap: "22px", columnGap: "2px", padding: "26px 8px 8px", backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 166px, #E6DBC8 166px, #E6DBC8 174px, transparent 174px, transparent 188px)", backgroundPosition: "0 26px"}}>
                  {(m.books || []).map((b: any, i_b: number) => (
                    <Fragment key={i_b}>
                      <span className={"mr-slot"} style={{display: "flex", alignItems: "flex-end", height: "166px", animationDelay: b.delay}}>
                        <button type={"button"} className={"mr-spine"} data-tip={b.tip} onClick={b.pick} aria-label={b.tip} aria-pressed={b.pressed} style={{width: b.w, height: b.h, background: b.color, borderRadius: "2px 2px 1px 1px", boxShadow: b.ring}}>
                          <span style={{flex: "0 0 20px", width: "100%"}}></span>
                          <span style={{flex: "1", width: "100%", background: b.band, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"}}>
                            <span style={{writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "11px", color: "#1A1D23", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxHeight: "100%"}}>
                              {b.title}
                            </span>
                          </span>
                          <span style={{flex: "0 0 22px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center"}}>
                            <span style={{width: "8px", height: "8px", borderRadius: "50%", background: b.dot}}></span>
                          </span>
                        </button>
                      </span>
                    </Fragment>
                  ))}
                </div>
              </section>
            </Fragment>
          ))}
        </div>
        <aside style={{flex: "0 0 320px", position: "sticky", top: "44px"}}>
          <section className={"mr-rise"} aria-label={"Révision choisie"} style={{display: "flex", flexDirection: "column", gap: "18px", padding: "28px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
            <div style={{alignSelf: "center", width: "150px", height: "214px", borderRadius: "3px 6px 6px 3px", background: v.sel.color, boxShadow: "0 10px 22px rgba(26,29,35,.2)", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative"}}>
              <span style={{flex: "0 0 48px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", letterSpacing: ".16em", color: "rgba(255,255,255,.85)"}}>
                {v.sel.short}
              </span>
              <span style={{flex: "1", background: v.sel.band, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", padding: "10px 14px", textAlign: "center"}}>
                <span style={{fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "19px", lineHeight: "1.2", color: "#1A1D23"}}>
                  {v.sel.title}
                </span>
                <span style={{width: "30px", height: "1px", background: v.sel.color}}></span>
                <span style={{fontSize: "12px", color: "#6B6F76"}}>
                  {v.sel.step}
                </span>
              </span>
              <span style={{flex: "0 0 42px", display: "flex", alignItems: "center", justifyContent: "center"}}>
                <span style={{width: "12px", height: "12px", borderRadius: "50%", background: v.sel.dot}}></span>
              </span>
              <span style={{position: "absolute", left: "0", top: "0", bottom: "0", width: "5px", background: "rgba(0,0,0,.14)"}}></span>
            </div>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "20px", fontWeight: "700"}}>
                {v.sel.title}
              </span>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {"R\u00e9vis\u00e9e le "}{v.sel.date}
              </span>
            </span>
            <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", paddingTop: "14px", borderTop: "1px solid #F1EEE7"}}>
              <span style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <span style={{fontSize: "22px", fontWeight: "700"}}>
                  {v.sel.note}
                </span>
                <span style={{fontSize: "13px", color: "#6B6F76"}}>
                  {"ta note"}
                </span>
              </span>
              <span style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <span style={{fontSize: "22px", fontWeight: "700"}}>
                  {v.sel.qcm}
                </span>
                <span style={{fontSize: "13px", color: "#6B6F76"}}>
                  {"QCM"}
                </span>
              </span>
              <span style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <span style={{fontSize: "22px", fontWeight: "700"}}>
                  {v.sel.time}
                </span>
                <span style={{fontSize: "13px", color: "#6B6F76"}}>
                  {"dur\u00e9e"}
                </span>
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
