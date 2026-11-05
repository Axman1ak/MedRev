// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#15304E}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-n{cursor:pointer;outline:none}\n.mr-n .core{transform-box:fill-box;transform-origin:center;transition:transform .25s cubic-bezier(.2,.8,.2,1)}\n.mr-n:hover .core, .mr-n:focus .core{transform:scale(1.6)}\n.mr-n .lbl{opacity:0;transition:opacity .2s ease}\n.mr-n:hover .lbl, .mr-n:focus .lbl{opacity:1}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-twinkle{0%,100%{opacity:.15}50%{opacity:.8}}\n@keyframes mr-breathe{0%,100%{opacity:.55}50%{opacity:1}}\n@keyframes mr-pulse{from{stroke-dashoffset:180}to{stroke-dashoffset:0}}\n@keyframes mr-ring{0%{transform:scale(1);opacity:.9}100%{transform:scale(3.2);opacity:0}}\n@keyframes mr-appear{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}\n@keyframes mr-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}\n@keyframes mr-fill{from{width:0}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-dust{animation:mr-twinkle 3s ease-in-out infinite}\n.mr-glow{animation:mr-breathe 3.4s ease-in-out infinite}\n.mr-spark{stroke-dasharray:5 175;animation:mr-pulse 2.6s linear infinite}\n.mr-new{transform-box:fill-box;transform-origin:center;animation:mr-ring 2s ease-out infinite}\n.mr-in{transform-box:fill-box;transform-origin:center;animation:mr-appear .6s cubic-bezier(.2,.8,.2,1) both}\n.mr-link{stroke-dasharray:1;animation:mr-draw 1.2s ease both}\n.mr-bar{animation:mr-fill 1.2s cubic-bezier(.2,.8,.2,1) .3s both}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: '0-1' };
  }
  renderVals() {
    const st = this.state;
    const mix = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.round(c + (255 - c) * k); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; };
    const scale = ['#ECE8E0', '#D98C7E', '#E2AE6A', '#D8C46A', '#93BC80', '#4E9A6B'];
    const SUB = [
      ['ANATOMIE', 'Anatomie spécifique', '#7FA6EA', 330, 380, 230, [['Cerveau, vascularisation', 6], ['Nerfs crâniens', 4], ['Tronc cérébral', 3], ['Membre supérieur', 11], ['Membre inférieur', 9], ['Moelle épinière', 5], ['Bassin', 7], ['Thorax', 13], ['Abdomen', 8], ['Cou', 2], ['Face', 6], ['Cœur, anatomie', 10], ['Rachis', 4], ['Crâne', 12], ['Œil', 1]]],
      ['PHYSIOLOGIE', 'Physiologie', '#B49BE0', 760, 190, 95, [['Potentiel d\x27action', 5], ['Fonction rénale', 12], ['Respiration', 7]]],
      ['SSH', 'Santé, Société, Humanité', '#6CC9B8', 910, 420, 95, [['Éthique médicale', 14], ['Santé publique', 9], ['Épidémiologie', 6]]],
      ['BIOPHYSIQUE', 'Biophysique', '#F08C80', 700, 590, 80, [['Optique géométrique', 3], ['Thermodynamique', 10]]],
      ['PHARMACO', 'Pharmacologie', '#F2B26B', 960, 640, 70, [['Pharmacocinétique', 3], ['Récepteurs et ligands', 6]]],
      ['BIOSTATS', 'Biostatistiques', '#D2B08A', 560, 110, 55, [['Tests statistiques', 1]]]
    ];
    const isNew = { '0-1': true, '1-0': true, '0-7': true, '4-1': true };
    const nodes = [], links = [], sparks = [], labels = [], halos = [], grads = [];
    let gold = 0, total = 0, conn = 0, sel = null;
    grads.push({ id: 'gGold', c: '#F4C35A' });
    SUB.forEach(([lab, name, color, cx, cy, R, list], si) => {
      grads.push({ id: 'g' + si, c: color });
      labels.push({ name: lab, x: cx, y: cy - R - 22 });
      halos.push({ x: cx, y: cy, r: R + 40, color });
      const pts = list.map(([title, count], i) => {
        const n = list.length;
        const rr = n === 1 ? 0 : R * Math.sqrt((i + 0.5) / n);
        const a = i * 2.39996 + si;
        const x = Math.round(cx + rr * Math.cos(a));
        const y = Math.round(cy + rr * Math.sin(a) * 0.82);
        return { title, count, x, y, i };
      });
      pts.forEach((p, i) => {
        const id = si + '-' + i;
        const mastered = p.count >= 9;
        total++; if (mastered) gold++;
        const r = 4 + p.count * 0.75;
        const on = st.sel === id;
        const notes = Array.from({ length: p.count }, (_, k) => Math.min(5, 2 + Math.floor(k / 3) + (k % 2)));
        const avg = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
        nodes.push({
          x: p.x, y: p.y, r: r.toFixed(1), glowR: (r * (2.2 + p.count * 0.18)).toFixed(1),
          grad: mastered ? 'gGold' : 'g' + si,
          fill: mastered ? '#F4C35A' : mix(color, 0.15 + p.count * 0.05),
          stroke: on ? '#FFFFFF' : (mastered ? '#FFF3D0' : 'none'), sw: on ? 3 : (mastered ? 1.5 : 0),
          title: p.title, ly: p.y - r - 12, label: p.title + ', ' + p.count + ' révisions',
          isNew: !!isNew[id], delay: (0.1 + nodes.length * 0.04).toFixed(2) + 's',
          pick: () => this.setState({ sel: id })
        });
        if (on) sel = {
          title: p.title, subject: name, count: String(p.count), avg: avg.toFixed(1).replace('.', ',') + '/5',
          swatch: mastered ? '#F4C35A' : color, glow: mastered ? '#F4C35A' : color,
          state: mastered ? 'Neurone doré' : (p.count >= 6 ? 'Brille de plus en plus' : 'Encore faible, à renforcer'),
          stateColor: mastered ? '#B07A10' : (p.count >= 6 ? '#2F6B45' : '#B4533A'),
          hint: mastered ? 'Il reste allumé, les révisions espacées le gardent en or.' : 'Encore ' + (9 - p.count) + ' révisions pour qu’il passe en or.',
          steps: Array.from({ length: 14 }, (_, k) => ({ bg: k < p.count ? scale[notes[k]] : '#F1EEE7' }))
        };
        const near = pts.filter((q) => q.i < i).map((q) => ({ q, d: Math.hypot(q.x - p.x, q.y - p.y) })).sort((a, b) => a.d - b.d).slice(0, 2);
        near.forEach(({ q }, k) => {
          const strong = Math.min(p.count, q.count);
          conn++;
          links.push({ x1: q.x, y1: q.y, x2: p.x, y2: p.y, color: strong >= 9 ? '#F4C35A' : color, w: (1 + strong * 0.22).toFixed(1), o: (0.18 + strong * 0.05).toFixed(2), delay: (0.3 + links.length * 0.03).toFixed(2) + 's' });
          if (strong >= 6) sparks.push({ x1: q.x, y1: q.y, x2: p.x, y2: p.y, delay: ((links.length * 0.37) % 2.6).toFixed(2) + 's', dur: (2 + (links.length % 4) * 0.5) + 's' });
        });
      });
    });
    const dust = Array.from({ length: 70 }, (_, i) => {
      const r = Math.abs(Math.sin((i + 1) * 91.7)) % 1, s = Math.abs(Math.sin((i + 1) * 47.3)) % 1;
      return { x: Math.round(r * 1100), y: Math.round(s * 720), r: (0.6 + ((r * 7) % 1) * 1.2).toFixed(1), delay: ((s * 5) % 3).toFixed(2) + 's', dur: (2.5 + ((r * 13) % 1) * 3).toFixed(1) + 's' };
    });
    const stats = [{ v: String(total), plus: '', l: 'neurones' }, { v: String(conn), plus: '', l: 'connexions' }, { v: String(gold), plus: ' +1', l: 'dorés' }];
    return { nodes, links, sparks, labels, halos, grads, dust, stats, sel: sel || {}, gold: String(gold), capPct: Math.round(gold / 13 * 100) + '%' };
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
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "40px 56px 56px", display: "flex", gap: "28px", alignItems: "flex-start"}}>
        <div style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "20px"}}>
          <header style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "6px"}}>
              <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
                {"Ta m\u00e9moire"}
              </h1>
              <span style={{fontSize: "16px", color: "#6B6F76"}}>
                {"Chaque fiche est un neurone. Chaque r\u00e9vision le fait briller un peu plus."}
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
          <section className={"mr-rise"} aria-label={"Carte de ta mémoire"} style={{position: "relative", borderRadius: "24px", overflow: "hidden", background: "radial-gradient(ellipse at 35% 45%, #1F4068 0%, #15304E 45%, #0C1E33 100%)", boxShadow: "0 20px 50px rgba(12,30,51,.25)"}}>
            <svg viewBox={"0 0 1100 720"} width={"100%"} role={"img"} aria-label={"Réseau de tes fiches"} style={{display: "block"}}>
              {(v.dust || []).map((d: any, i_d: number) => (
                <Fragment key={i_d}>
                  <circle className={"mr-dust"} cx={d.x} cy={d.y} r={d.r} fill={"#FFFFFF"} style={{animationDelay: d.delay, animationDuration: d.dur}} />
                </Fragment>
              ))}
              {(v.halos || []).map((h: any, i_h: number) => (
                <Fragment key={i_h}>
                  <circle cx={h.x} cy={h.y} r={h.r} fill={h.color} opacity={".035"} />
                </Fragment>
              ))}
              {(v.links || []).map((l: any, i_l: number) => (
                <Fragment key={i_l}>
                  <line className={"mr-link"} pathLength={"1"} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={l.w} strokeOpacity={l.o} strokeLinecap={"round"} style={{animationDelay: l.delay}} />
                </Fragment>
              ))}
              {(v.sparks || []).map((l: any, i_l: number) => (
                <Fragment key={i_l}>
                  <line className={"mr-spark"} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={"#FFE7A3"} strokeWidth={"3"} strokeLinecap={"round"} style={{animationDelay: l.delay, animationDuration: l.dur}} />
                </Fragment>
              ))}
              {(v.labels || []).map((t: any, i_t: number) => (
                <Fragment key={i_t}>
                  <text x={t.x} y={t.y} textAnchor={"middle"} fill={"rgba(255,255,255,.55)"} fontFamily={"Hanken Grotesk, system-ui, sans-serif"} fontSize={"15"} fontWeight={"700"} letterSpacing={"1.5"}>
                    {t.name}
                  </text>
                </Fragment>
              ))}
              {(v.nodes || []).map((n: any, i_n: number) => (
                <Fragment key={i_n}>
                  <g className={"mr-n"} role={"button"} tabIndex={"0"} aria-label={n.label} onClick={n.pick}>
                    <circle className={"mr-glow"} cx={n.x} cy={n.y} r={n.glowR} fill={`url(#${n.grad})`} style={{animationDelay: n.delay}} />
                    {n.isNew ? (
                      <>
                        <circle className={"mr-new"} cx={n.x} cy={n.y} r={n.r} fill={"none"} stroke={"#FFE7A3"} strokeWidth={"2"} />
                      </>
                    ) : null}
                    <circle className={"core mr-in"} cx={n.x} cy={n.y} r={n.r} fill={n.fill} stroke={n.stroke} strokeWidth={n.sw} style={{animationDelay: n.delay}} />
                    <text className={"lbl"} x={n.x} y={n.ly} textAnchor={"middle"} fill={"#FFFFFF"} fontFamily={"Hanken Grotesk, system-ui, sans-serif"} fontSize={"14"} fontWeight={"700"}>
                      {n.title}
                    </text>
                  </g>
                </Fragment>
              ))}
              <defs>
                {(v.grads || []).map((g: any, i_g: number) => (
                  <Fragment key={i_g}>
                    <radialGradient id={g.id}>
                      <stop offset={"0"} stopColor={g.c} stopOpacity={".75"} />
                      <stop offset={"1"} stopColor={g.c} stopOpacity={"0"} />
                    </radialGradient>
                  </Fragment>
                ))}
              </defs>
            </svg>
            <div style={{position: "absolute", left: "24px", bottom: "20px", display: "flex", gap: "18px", fontSize: "13px", color: "rgba(255,255,255,.7)"}}>
              <span style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <span style={{width: "10px", height: "10px", borderRadius: "50%", background: "#FFFFFF", opacity: ".5"}}></span>
                {"Peu r\u00e9vis\u00e9e"}
              </span>
              <span style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <span style={{width: "14px", height: "14px", borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 0 10px #FFFFFF"}}></span>
                {"Bien r\u00e9vis\u00e9e"}
              </span>
              <span style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <span style={{width: "14px", height: "14px", borderRadius: "50%", background: "#F4C35A", boxShadow: "0 0 10px #F4C35A"}}></span>
                {"Ma\u00eetris\u00e9e, elle s\u2019allume en or"}
              </span>
            </div>
          </section>
        </div>
        <aside style={{flex: "0 0 340px", position: "sticky", top: "40px", display: "flex", flexDirection: "column", gap: "18px"}}>
          <section className={"mr-rise"} aria-label={"Neurone choisi"} style={{display: "flex", flexDirection: "column", gap: "18px", padding: "26px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
            <span style={{display: "flex", alignItems: "center", gap: "14px"}}>
              <span style={{width: "46px", height: "46px", borderRadius: "50%", background: v.sel.swatch, boxShadow: `0 0 18px ${v.sel.glow}`, flex: "none"}}></span>
              <span style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <span style={{fontSize: "20px", fontWeight: "700"}}>
                  {v.sel.title}
                </span>
                <span style={{fontSize: "14px", color: "#6B6F76"}}>
                  {v.sel.subject}
                </span>
              </span>
            </span>
            <span style={{fontSize: "15px", fontWeight: "600", color: v.sel.stateColor}}>
              {v.sel.state}
            </span>
            <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
              <span style={{display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#6B6F76"}}>
                <span>
                  {v.sel.count}{" r\u00e9visions sur 14"}
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
            <span style={{fontSize: "14px", color: "#6B6F76"}}>
              {v.sel.hint}
            </span>
            <Link href={"/v2/matieres"} className={"mr-btn"} style={{textAlign: "center", fontSize: "16px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", padding: "14px", borderRadius: "12px", textDecoration: "none"}}>
              {"Ouvrir la fiche"}
            </Link>
          </section>
          <section className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "10px", padding: "22px 26px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".1s"}}>
            <span style={{display: "flex", justifyContent: "space-between", fontSize: "15px"}}>
              <span style={{fontWeight: "700"}}>
                {"Prochain cap"}
              </span>
              <span style={{color: "#6B6F76"}}>
                {v.gold}{" / 13 neurones dor\u00e9s"}
              </span>
            </span>
            <span style={{height: "8px", borderRadius: "4px", background: "#F1EEE7", overflow: "hidden"}}>
              <span className={"mr-bar"} style={{display: "block", height: "8px", width: v.capPct, borderRadius: "4px", background: "#F4C35A"}}></span>
            </span>
            <span style={{fontSize: "14px", color: "#6B6F76"}}>
              {"\u00c0 13, la moiti\u00e9 de ton cerveau brille en or."}
            </span>
          </section>
        </aside>
      </main>
    </div>
    </>
  )
}
