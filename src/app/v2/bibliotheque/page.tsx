// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-slot{position:relative;display:flex;align-items:flex-end;height:84px}\n.mr-book{position:relative;cursor:pointer;border:0;padding:0;transform-origin:bottom center;transition:transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s ease}\n.mr-book:hover{transform:translateY(-12px) rotate(-4deg);box-shadow:0 10px 16px rgba(26,29,35,.22);z-index:3}\n.mr-book:active{transform:translateY(-16px) rotate(-6deg) scale(1.05)}\n.mr-book::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 10px);transform:translate(-50%,6px);white-space:nowrap;background:#15304E;color:#fff;font:600 13px 'Hanken Grotesk',system-ui,sans-serif;padding:7px 11px;border-radius:9px;opacity:0;pointer-events:none;transition:opacity .15s ease, transform .15s ease}\n.mr-book:hover::after{opacity:1;transform:translate(-50%,0) rotate(4deg)}\n.mr-medal{transition:transform .25s cubic-bezier(.2,.8,.2,1)}\n.mr-medal:hover{transform:translateY(-4px) rotate(-6deg) scale(1.08)}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}\n@keyframes mr-fill{from{width:0}}\n@keyframes mr-pull{0%{transform:translateY(30px) rotate(-8deg);opacity:0}60%{transform:translateY(-6px) rotate(2deg);opacity:1}100%{transform:none}}\n@keyframes mr-shine{0%,100%{filter:drop-shadow(0 0 0 rgba(244,195,90,0))}50%{filter:drop-shadow(0 0 14px rgba(244,195,90,.7))}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-grow{transform-origin:bottom;animation:mr-grow .45s cubic-bezier(.2,.8,.2,1) both}\n.mr-bar{animation:mr-fill 1.2s cubic-bezier(.2,.8,.2,1) .3s both}\n.mr-pull{animation:mr-pull .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-current{animation:mr-shine 2.6s ease-in-out infinite}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: '0-3' };
  }
  renderVals() {
    const st = this.state;
    const RK = [['Novice', '/v2/assets/rang-novice.svg'], ['Apprenti', '/v2/assets/rang-apprenti.svg'], ['Studieux', '/v2/assets/rang-studieux.svg'], ['Lettré', '/v2/assets/rang-lettre.svg'], ['Érudit', '/v2/assets/rang-erudit.svg'], ['Sage', '/v2/assets/rang-sage.svg']];
    const ranks = RK.map(([name, img], i) => ({ name, img, filter: i <= 3 ? 'none' : 'grayscale(1) opacity(.35)', weight: i === 3 ? 700 : 500, color: i === 3 ? '#FFFFFF' : 'rgba(255,255,255,.6)' }));
    const mix = (hex, k, to) => { const n = parseInt(hex.slice(1), 16); const t = to === 'w' ? 255 : 0; const f = (c) => Math.round(c + (t - c) * k); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; };
    const SUB = [
      ['Anatomie spécifique', 'ANATOMIE', '#4F7CC9', 120, ['Nerfs crâniens', 'Cerveau, vascularisation', 'Tronc cérébral', 'Membre supérieur', 'Moelle épinière', 'Bassin', 'Membre inférieur']],
      ['Physiologie', 'PHYSIOLOGIE', '#8B6BB8', 64, ['Potentiel d’action', 'Fonction rénale', 'Cœur', 'Respiration']],
      ['Santé, Société, Humanité', 'SSH', '#3E8E85', 48, ['Éthique médicale', 'Santé publique', 'Épidémiologie']],
      ['Biophysique', 'BIOPHYSIQUE', '#C4554D', 35, ['Optique géométrique', 'Thermodynamique', 'Radioactivité']],
      ['Pharmacologie', 'PHARMACOLOGIE', '#D08A3E', 30, ['Pharmacocinétique', 'Récepteurs et ligands', 'Interactions']],
      ['Biostatistiques', 'BIOSTATISTIQUES', '#9C7148', 20, ['Tests statistiques', 'Probabilités']]
    ];
    const J = ['J0', 'J+1', 'J+3', 'J+5', 'J+7', 'J+15', 'J+21', 'J+30', 'J+45', 'J+60'];
    const days = ['12 sept.', '14 sept.', '19 sept.', '23 sept.', '30 sept.', '7 oct.', '15 oct.', '22 oct.', '28 oct.', '3 nov.'];
    let total = 0;
    let selInfo = null;
    const shelves = SUB.map(([name, short, color, count, titles], si) => {
      total += count;
      const books = [];
      for (let i = 0; i < count; i++) {
        const r = Math.abs(Math.sin((i + 1) * 12.9898 + si * 78.233)) % 1;
        const note = 1 + Math.floor(((r * 31) % 1) * 5);
        const title = titles[i % titles.length];
        const step = J[Math.floor(i / titles.length) % J.length];
        const date = days[Math.floor(i / titles.length) % days.length];
        const base = mix(color, ((r * 13) % 1) * 0.28, 'w');
        const dark = mix(color, 0.3, 'b');
        const light = mix(color, 0.35, 'w');
        const band = note === 5 ? '#F2C14E' : (note === 4 ? 'rgba(255,255,255,.55)' : 'transparent');
        const bands = 'linear-gradient(to bottom, transparent 10%, ' + band + ' 10%, ' + band + ' 14%, transparent 14%, transparent 84%, ' + band + ' 84%, ' + band + ' 88%, transparent 88%)';
        const bg = bands + ', linear-gradient(90deg, ' + dark + ' 0%, ' + base + ' 22%, ' + light + ' 45%, ' + base + ' 70%, ' + dark + ' 100%)';
        const id = si + '-' + i;
        const on = st.sel === id;
        if (on) selInfo = { title, subject: name, subjectShort: short, note: note + '/5', step, date: 'révisée le ' + date, cover: 'linear-gradient(135deg, ' + light + ', ' + color + ' 55%, ' + dark + ')', band: note === 5 ? '#F2C14E' : 'rgba(255,255,255,.7)' };
        books.push({
          w: (12 + Math.round(r * 7)) + 'px', h: (54 + Math.round(((r * 7) % 1) * 28)) + 'px', bg,
          tip: title + ', ' + step + ', ' + note + '/5', pressed: on ? 'true' : 'false',
          shadow: on ? '0 0 0 3px #FFFFFF, 0 0 0 5px #15304E' : 'none',
          delay: Math.min(0.15 + si * 0.06 + i * 0.006, 1.4).toFixed(3) + 's',
          pick: () => this.setState({ sel: id })
        });
      }
      return { name, color, count, books, delay: (0.1 + si * 0.06) + 's' };
    });
    return { ranks, shelves, total: String(total), sel: selInfo || {} };
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
          <header style={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "24px"}}>
            <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {"Biblioth\u00e8que"}
            </h1>
            <span style={{fontSize: "16px", color: "#6B6F76"}}>
              {v.total}{" livres, un par fiche r\u00e9vis\u00e9e"}
            </span>
          </header>
          <section aria-label={"Ton rang"} className={"mr-rise"} style={{display: "flex", alignItems: "center", gap: "36px", padding: "28px 36px", borderRadius: "20px", background: "#15304E", color: "#FFFFFF"}}>
            <img className={"mr-current"} src={"/v2/assets/rang-lettre.svg"} alt={"Médaille Lettré"} style={{width: "92px", height: "108px"}} />
            <span style={{display: "flex", flexDirection: "column", gap: "6px", minWidth: "240px"}}>
              <span style={{fontSize: "15px", color: "rgba(255,255,255,.65)"}}>
                {"Ton rang"}
              </span>
              <span style={{fontSize: "34px", fontWeight: "700", letterSpacing: "-.02em"}}>
                {"Lettr\u00e9"}
              </span>
              <span style={{fontSize: "15px", color: "rgba(255,255,255,.75)"}}>
                {"Encore 183 livres pour devenir \u00c9rudit"}
              </span>
            </span>
            <div style={{flex: "1", display: "flex", flexDirection: "column", gap: "14px"}}>
              <span style={{height: "10px", borderRadius: "5px", background: "rgba(255,255,255,.14)", overflow: "hidden"}}>
                <span className={"mr-bar"} style={{display: "block", height: "10px", width: "63%", borderRadius: "5px", background: "#F4C35A"}}></span>
              </span>
              <div style={{display: "flex", justifyContent: "space-between"}}>
                {(v.ranks || []).map((r: any, i_r: number) => (
                  <Fragment key={i_r}>
                    <span style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"}}>
                      <img className={"mr-medal"} src={r.img} alt={r.name} style={{width: "44px", height: "52px", filter: r.filter}} />
                      <span style={{fontSize: "13px", fontWeight: r.weight, color: r.color}}>
                        {r.name}
                      </span>
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
          </section>
          {(v.shelves || []).map((s: any, i_s: number) => (
            <Fragment key={i_s}>
              <section className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "14px", padding: "22px 26px 26px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: s.delay}}>
                <span style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", fontWeight: "700"}}>
                    <span style={{width: "10px", height: "10px", borderRadius: "50%", background: s.color}}></span>
                    {s.name}
                  </span>
                  <span style={{fontSize: "15px", color: "#6B6F76"}}>
                    {s.count}{" livres"}
                  </span>
                </span>
                <div style={{display: "flex", flexWrap: "wrap", alignContent: "flex-start", rowGap: "14px", columnGap: "3px", marginTop: "16px", paddingBottom: "6px", backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 84px, #E6DBC8 84px, #E6DBC8 90px, transparent 90px, transparent 98px)", backgroundPosition: "0 0"}}>
                  {(s.books || []).map((b: any, i_b: number) => (
                    <Fragment key={i_b}>
                      <span className={"mr-slot mr-grow"} style={{animationDelay: b.delay}}>
                        <button type={"button"} className={"mr-book"} data-tip={b.tip} onClick={b.pick} aria-label={b.tip} aria-pressed={b.pressed} style={{width: b.w, height: b.h, borderRadius: "3px 3px 1px 1px", background: b.bg, boxShadow: b.shadow}}></button>
                      </span>
                    </Fragment>
                  ))}
                </div>
              </section>
            </Fragment>
          ))}
        </div>
        <aside style={{flex: "0 0 340px", position: "sticky", top: "44px", display: "flex", flexDirection: "column", gap: "18px"}}>
          <section className={"mr-pull"} aria-label={"Livre choisi"} style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", padding: "30px 28px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
            <div style={{width: "150px", height: "200px", borderRadius: "6px 12px 12px 6px", background: v.sel.cover, boxShadow: "inset 10px 0 0 rgba(0,0,0,.14), 0 12px 24px rgba(26,29,35,.18)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "22px 18px 18px 26px", boxSizing: "border-box", color: "#FFFFFF"}}>
              <span style={{fontSize: "12px", opacity: ".8", letterSpacing: ".06em"}}>
                {v.sel.subjectShort}
              </span>
              <span style={{fontSize: "19px", fontWeight: "700", lineHeight: "1.2"}}>
                {v.sel.title}
              </span>
              <span style={{height: "3px", width: "46px", background: v.sel.band, borderRadius: "2px"}}></span>
            </div>
            <span style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center"}}>
              <span style={{fontSize: "20px", fontWeight: "700"}}>
                {v.sel.title}
              </span>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {v.sel.subject}
              </span>
            </span>
            <div style={{width: "100%", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", paddingTop: "4px", borderTop: "1px solid #F1EEE7"}}>
              <span style={{display: "flex", flexDirection: "column", gap: "2px", paddingTop: "12px"}}>
                <span style={{fontSize: "22px", fontWeight: "700"}}>
                  {v.sel.note}
                </span>
                <span style={{fontSize: "13px", color: "#6B6F76"}}>
                  {"ta note"}
                </span>
              </span>
              <span style={{display: "flex", flexDirection: "column", gap: "2px", paddingTop: "12px"}}>
                <span style={{fontSize: "22px", fontWeight: "700"}}>
                  {v.sel.step}
                </span>
                <span style={{fontSize: "13px", color: "#6B6F76"}}>
                  {v.sel.date}
                </span>
              </span>
            </div>
            <Link href={"/v2/matieres"} className={"mr-btn"} style={{width: "100%", textAlign: "center", fontSize: "16px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", padding: "14px", borderRadius: "12px", textDecoration: "none"}}>
              {"Ouvrir la fiche"}
            </Link>
          </section>
          <span style={{fontSize: "14px", color: "#6B6F76", textAlign: "center", padding: "0 12px"}}>
            {"Bandes dor\u00e9es, livres not\u00e9s 5/5"}
          </span>
        </aside>
      </main>
    </div>
    </>
  )
}
