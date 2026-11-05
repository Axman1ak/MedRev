// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"session": "à faire"}

const CSS = "\n\na{color:#15304E}a:hover{color:#0F1E36}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}\n.mr-btn:active{transform:scale(.97)}\n.mr-node{transition:transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s ease}\n.mr-node:hover{transform:scale(1.1)}\n.mr-node:active{transform:scale(.95)}\n.mr-lift{transition:transform .2s ease, box-shadow .2s ease}\n.mr-lift:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(26,29,35,.06),0 12px 28px rgba(26,29,35,.08) !important}\n@keyframes mr-in{from{opacity:0;transform:translateY(16px) scale(.9)}to{opacity:1;transform:none}}\n@keyframes mr-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\n@keyframes mr-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}\n@keyframes mr-halo{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.8);opacity:0}}\n@keyframes mr-card{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}\n@keyframes mr-fill{from{width:0}}\n@keyframes mr-flicker{0%,100%{transform:scale(1,1) rotate(-2deg)}50%{transform:scale(1.06,.94) rotate(2deg)}}\n@keyframes mr-ignite{0%{transform:scale(.2);opacity:0}60%{transform:scale(1.25);opacity:1}100%{transform:scale(1)}}\n@keyframes mr-ring{from{stroke-dashoffset:276}}\n@keyframes mr-wiggle{0%,80%,100%{transform:rotate(0)}84%{transform:rotate(-8deg)}88%{transform:rotate(8deg)}92%{transform:rotate(-5deg)}96%{transform:rotate(4deg)}}\n@keyframes mr-shine{0%,100%{box-shadow:0 0 0 0 rgba(244,195,90,.0)}50%{box-shadow:0 0 0 10px rgba(244,195,90,.25)}}\n@keyframes mr-pop{0%{transform:scale(.6);opacity:0}50%{transform:scale(1.2);opacity:1}100%{transform:scale(1)}}\n@keyframes mr-float{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(-60px);opacity:0}}\n@keyframes mr-count{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}\n.mr-enter{animation:mr-in .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-line{stroke-dasharray:1;animation:mr-draw 1.4s cubic-bezier(.4,0,.2,1) .15s both}\n.mr-halo{animation:mr-halo 2.2s ease-out infinite}\n.mr-card-in{animation:mr-card .45s cubic-bezier(.2,.8,.2,1) .5s both}\n.mr-bar{animation:mr-fill 1.2s cubic-bezier(.2,.8,.2,1) .5s both}\n.mr-lit{animation:mr-ignite .8s cubic-bezier(.2,.8,.2,1) both}\n.mr-lit path{transform-origin:50% 100%;animation:mr-flicker 1.6s ease-in-out .8s infinite}\n.mr-ringfill{animation:mr-ring 1.4s cubic-bezier(.2,.8,.2,1) .4s both}\n.mr-ready{animation:mr-wiggle 2.6s ease-in-out infinite, mr-shine 2.6s ease-in-out infinite}\n.mr-opened{animation:mr-pop .6s cubic-bezier(.2,.8,.2,1) both}\n.mr-gain{animation:mr-float 1.8s ease-out both}\n.mr-bump{animation:mr-count .5s ease both}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: 'today', old: false, opened: false };
  }
  renderVals() {
    const st = this.state;
    const done = this.props.session === 'faite';
    const C = { bio: '#C4554D', ana: '#4F7CC9', phy: '#8B6BB8', stat: '#9C7148', pha: '#D08A3E', ssh: '#3E8E85' };
    const pool = [['Nerfs crâniens', C.ana], ['Pharmacocinétique', C.pha], ['Potentiel d’action', C.phy], ['Optique géométrique', C.bio], ['Éthique médicale', C.ssh], ['Tests statistiques', C.stat], ['Membre supérieur', C.ana], ['Fonction rénale', C.phy], ['Récepteurs et ligands', C.pha]];
    const ICON = {
      check: ['0 0 24 24', 'M5 12.5l4.5 4.5L19 7.5'],
      flame: ['0 0 120 140', 'M60 4C66 30 98 44 98 88a38 38 0 0 1-76 0c0-20 10-32 18-42 1 12 7 20 14 22-2-22 0-44 6-64z'],
      chest: ['0 0 24 24', 'M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10l1.5-5h13L20 10M10 13h4'],
      open: ['0 0 24 24', 'M4 12h16v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 9l3-5 14 3-1 5M10 15h4'],
      flag: ['0 0 24 24', 'M6 21V4M6 4h11l-2 4 2 4H6'],
      dot: ['0 0 24 24', 'M12 12h.01'],
      dash: ['0 0 24 24', 'M8 12h8']
    };
    const older = [
      { band: true, title: 'Semaine 8', sub: '4 sessions sur 6' },
      { id: 'o1', date: 'Mer. 21 oct.', kind: 'done', n: 6, qcm: '66%', note: '3,4' },
      { id: 'o2', date: 'Jeu. 22 oct.', kind: 'missed', n: 4 },
      { id: 'o3', date: 'Ven. 23 oct.', kind: 'done', n: 5, qcm: '62%', note: '3,1' },
      { id: 'oc', date: 'Coffre', kind: 'chestOpen' },
      { id: 'o4', date: 'Sam. 24 oct.', kind: 'done', n: 2, qcm: '80%', note: '4,0' },
      { band: true, title: 'Semaine 9', sub: '5 sessions sur 6' },
      { id: 'o5', date: 'Lun. 26 oct.', kind: 'done', n: 6, qcm: '58%', note: '3,0' },
      { id: 'o6', date: 'Mar. 27 oct.', kind: 'done', n: 4, qcm: '75%', note: '3,8' },
      { id: 'o7', date: 'Mer. 28 oct.', kind: 'done', n: 5, qcm: '69%', note: '3,6' },
      { id: 'o8', date: 'Jeu. 29 oct.', kind: 'done', n: 7, qcm: '64%', note: '3,2' },
      { id: 'o9', date: 'Ven. 30 oct.', kind: 'missed', n: 5 },
      { id: 'o10', date: 'Sam. 31 oct.', kind: 'done', n: 3, qcm: '82%', note: '4,1' },
      { id: 'o11', date: 'Dim. 1 nov.', kind: 'rest' },
      { band: true, title: 'Semaine 10', sub: 'en cours' }
    ];
    const current = [
      { id: 'p2', date: 'Lun. 2', kind: 'done', n: 4, qcm: '71%', note: '3,5' },
      { id: 'p1', date: 'Mar. 3', kind: 'done', n: 6, qcm: '78%', note: '3,9' },
      { id: 'today', date: 'Aujourd’hui', kind: 'today', n: 9 },
      { id: 'chest', date: 'Coffre', kind: 'chest' },
      { id: 'f1', date: 'Jeu. 5', kind: 'future', n: 5 },
      { id: 'f2', date: 'Ven. 6', kind: 'future', n: 3 },
      { id: 'f3', date: 'Sam. 7', kind: 'future', n: 2 },
      { id: 'f4', date: 'Dim. 8', kind: 'rest' },
      { band: true, title: 'Semaine 11', sub: 'à venir' },
      { id: 'f5', date: 'Lun. 9', kind: 'future', n: 6 },
      { id: 'f6', date: 'Mar. 10', kind: 'future', n: 4 },
      { id: 'goal', date: 'Concours blanc', kind: 'goal' }
    ];
    const items = older.concat(current);
    const CX = 300, AMP = 130, STEP = 118;
    let y = 50, k = 0;
    const pts = [], nodes = [], bands = [];
    let todayPt = null, todayIdx = 0;
    items.forEach((d) => {
      if (d.band) { bands.push({ top: (y - 6) + 'px', title: d.title, sub: d.sub, delay: (nodes.length * 0.04) + 's' }); y += 64; return; }
      const cx = Math.round(CX + AMP * Math.sin(k * 0.85));
      k++;
      const big = d.kind === 'today';
      const cy = y + (big ? 30 : 0);
      y += big ? STEP + 60 : STEP;
      pts.push([cx, cy]);
      if (big) { todayPt = [cx, cy]; todayIdx = pts.length - 1; }
      const on = st.sel === d.id;
      let kind = d.kind;
      if (kind === 'today' && done) kind = 'todayDone';
      if (kind === 'chest') kind = !done ? 'chestLocked' : (st.opened ? 'chestOpen' : 'chestReady');
      const ring = on ? '0 0 0 4px #FAF8F4, 0 0 0 7px #15304E' : '0 2px 6px rgba(26,29,35,.08)';
      const S = { done: 64, today: 88, todayDone: 88, missed: 56, rest: 40, future: 60, chestLocked: 76, chestReady: 82, chestOpen: 76, goal: 72 }[kind];
      const ic = (name, size, fill, stroke, w, cls) => ({ viewBox: ICON[name][0], icon: ICON[name][1], iconSize: String(size), iconFill: fill, iconStroke: stroke, iconStrokeW: String(w), iconClass: cls || '' });
      const sub = d.n ? d.n + ' fiches' : '';
      let n = {
        left: (cx - S / 2) + 'px', top: (cy - S / 2) + 'px', size: S + 'px', delay: (nodes.length * 0.05) + 's',
        label: d.date, pressed: on ? 'true' : 'false', pick: () => this.setState({ sel: d.id }),
        date: d.date, sub, dateWeight: 500, dateColor: '#9AA0A8', radius: '50%', halo: false, haloColor: 'transparent',
        showRing: false, ringOffset: '276', anim: '', gain: false, border: '0', shadow: ring,
        showImg: false, showSvg: true, img: '', imgSize: '0px', imgFilter: 'none', anchor: d.kind === 'today' ? 'aujourdhui' : 'n-' + d.id
      };
      const im = (src, size, filter, cls) => ({ showImg: true, showSvg: false, img: src, imgSize: size + 'px', imgFilter: filter || 'none', iconClass: cls || '' });
      if (kind === 'done') n = { ...n, bg: '#15304E', fg: '#FFFFFF', ...ic('check', 28, 'none', 'currentColor', 3), dateColor: '#3D424A', dateWeight: 600 };
      if (kind === 'today') n = { ...n, bg: '#15304E', fg: '#FFFFFF', ...im('/v2/assets/flame-off.svg', 46, 'brightness(1.6)'), halo: true, haloColor: 'rgba(21,48,78,.22)', showRing: true, date: 'Aujourd’hui', dateColor: '#15304E', dateWeight: 700, sub: '' };
      if (kind === 'todayDone') n = { ...n, bg: '#15304E', fg: '#FFFFFF', ...im('/v2/assets/flame.svg', 50, 'none', 'mr-lit'), halo: true, haloColor: 'rgba(244,154,46,.35)', showRing: true, ringOffset: '0', date: 'Aujourd’hui', dateColor: '#15304E', dateWeight: 700, sub: 'session faite' };
      if (kind === 'missed') n = { ...n, bg: '#FAF8F4', fg: '#B9B3A8', border: '2px dashed #D9D3C7', shadow: on ? ring : 'none', ...ic('dash', 22, 'none', 'currentColor', 2.5) };
      if (kind === 'rest') n = { ...n, bg: '#ECE8E0', fg: '#9AA0A8', shadow: on ? ring : 'none', ...ic('dot', 16, 'none', 'currentColor', 6), sub: 'repos' };
      if (kind === 'future') n = { ...n, bg: '#FFFFFF', fg: '#B9B3A8', border: '2px solid #E4DFD4', shadow: on ? ring : 'none', ...ic('check', 24, 'none', 'currentColor', 2.5), dateColor: '#6B6F76' };
      if (kind === 'chestLocked') n = { ...n, radius: '18px', bg: 'transparent', fg: '#B9B3A8', shadow: 'none', ...im('/v2/assets/chest.svg', 76, 'grayscale(1) opacity(.45)'), sub: 'après ta session' };
      if (kind === 'chestReady') n = { ...n, radius: '22px', bg: 'transparent', fg: '#7A5208', anim: 'mr-ready', shadow: 'none', ...im('/v2/assets/chest.svg', 82), dateColor: '#7A5208', dateWeight: 700, sub: 'clique pour ouvrir', pick: () => this.setState({ opened: true, sel: d.id }) };
      if (kind === 'chestOpen') n = { ...n, radius: '18px', bg: 'transparent', fg: '#C98A12', shadow: 'none', anim: d.id === 'chest' ? 'mr-opened' : '', ...im('/v2/assets/chest-open.svg', 76, d.id === 'chest' ? 'none' : 'saturate(.6)'), sub: '+25 éclats', gain: d.id === 'chest' };
      if (kind === 'goal') n = { ...n, radius: '20px', bg: '#FFFFFF', fg: '#15304E', border: '2px solid #15304E', ...ic('flag', 30, 'none', 'currentColor', 2), dateColor: '#15304E', dateWeight: 700, sub: 'sam. 22 nov.' };
      nodes.push(n);
    });
    const curve = (arr) => arr.map((p, i) => {
      if (i === 0) return 'M' + p[0] + ' ' + p[1];
      const q = arr[i - 1]; const my = (q[1] + p[1]) / 2;
      return 'C' + q[0] + ' ' + my + ' ' + p[0] + ' ' + my + ' ' + p[0] + ' ' + p[1];
    }).join(' ');
    const doneUpTo = done ? (st.opened ? todayIdx + 1 : todayIdx) : todayIdx;
    const card = {
      left: (Math.max(...pts.map((p) => p[0])) + 90) + 'px', top: (todayPt[1] - 96) + 'px',
      kicker: done ? 'Session faite' : 'Session du jour',
      title: done ? 'Bravo, à demain' : '9 fiches à revoir',
      sub: done ? (st.opened ? 'Coffre ouvert, +25 éclats' : 'Ton coffre est prêt à être ouvert') : 'Anatomie, Pharmaco et 3 autres',
      cta: done ? 'Continuer à réviser' : 'Commencer', btnBg: done ? '#F1EEE7' : '#15304E', btnFg: done ? '#15304E' : '#FFFFFF'
    };
    const all = items.filter((x) => !x.band);
    const dd = all.find((x) => x.id === st.sel) || all.find((x) => x.id === 'today');
    const fiches = (n, right) => Array.from({ length: Math.min(n, 5) }, (_, i) => { const p = pool[(i * 2 + n) % pool.length]; return { title: p[0], color: p[1], right: right(i) }; });
    let sel;
    if (dd.kind === 'today' && !done) sel = { kicker: 'Au programme', date: 'Aujourd’hui', hasStats: false, stats: [], fiches: fiches(dd.n, (i) => ['J+3', 'Rattrapage', 'J+7', 'J+1', 'J+15'][i]) };
    else if (dd.kind === 'today') sel = { kicker: 'Session faite', date: 'Aujourd’hui', hasStats: true, stats: [{ v: '9', l: 'fiches' }, { v: '74%', l: 'QCM' }, { v: '3,8', l: 'note' }], fiches: fiches(9, (i) => ['3/5', '4/5', '4/5', '3/5', '5/5'][i]) };
    else if (dd.kind === 'done') sel = { kicker: 'Session faite', date: dd.date, hasStats: true, stats: [{ v: String(dd.n), l: 'fiches' }, { v: dd.qcm, l: 'QCM' }, { v: dd.note, l: 'note' }], fiches: fiches(dd.n, (i) => ['4/5', '3/5', '5/5', '3/5', '4/5'][i]) };
    else if (dd.kind === 'missed') sel = { kicker: 'Session manquée', date: dd.date, hasStats: false, stats: [], fiches: fiches(dd.n, () => 'reportée') };
    else if (dd.kind === 'rest') sel = { kicker: 'Jour de repos', date: dd.date, hasStats: false, stats: [], fiches: [] };
    else if (dd.kind === 'chest' || dd.kind === 'chestOpen') sel = { kicker: 'Coffre', date: (dd.kind === 'chestOpen' || st.opened) ? '+25 éclats gagnés' : (done ? 'Prêt à ouvrir' : 'Fais ta session pour l’ouvrir'), hasStats: false, stats: [], fiches: [] };
    else if (dd.kind === 'goal') sel = { kicker: 'Objectif', date: 'Concours blanc, sam. 22 nov.', hasStats: false, stats: [], fiches: [{ title: 'Toutes les UE, 4 h 30', color: '#15304E', right: '' }, { title: '412 inscrits de ta fac', color: '#15304E', right: '' }] };
    else sel = { kicker: 'À venir', date: dd.date, hasStats: false, stats: [], fiches: fiches(dd.n, () => 'prévue') };
    const quests = [['Faire 5 sessions', '3/5', 60, '#15304E', 30], ['Rattraper tes retards', '4/6', 67, '#F49A2E', 20], ['80% à un QCM', '1/1', 100, '#4E9A6B', 10]].map(([title, count, p, color, reward]) => ({ title, count, pct: p + '%', color, reward }));
    return {
      nodes, bands, card, sel, quests,
      fullPath: curve(pts), donePath: curve(pts.slice(0, doneUpTo + 1)),
      totalH: (y + 10) + 'px', svgH: String(y + 10),
      balance: st.opened ? '265' : '240', balanceAnim: st.opened ? 'mr-bump' : ''
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
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "40px 56px 40px", display: "flex", gap: "56px", alignItems: "flex-start"}}>
        <section aria-label={"Ton parcours"} style={{flex: "1", minWidth: "0", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0"}}>
          <div className={"mr-rise"} style={{flex: "none", width: "860px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", padding: "22px 28px", borderRadius: "18px", background: "#15304E", color: "#FFFFFF"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "13px", color: "rgba(255,255,255,.6)", letterSpacing: ".06em"}}>
                {"SEMAINE 10"}
              </span>
              <span style={{fontSize: "22px", fontWeight: "700"}}>
                {"Du 2 au 8 novembre"}
              </span>
            </span>
            <span style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", color: "rgba(255,255,255,.8)"}}>
              <span style={{display: "flex", gap: "5px"}}>
                <span style={{width: "9px", height: "9px", borderRadius: "50%", background: "#4F7CC9"}}></span>
                <span style={{width: "9px", height: "9px", borderRadius: "50%", background: "#8B6BB8"}}></span>
                <span style={{width: "9px", height: "9px", borderRadius: "50%", background: "#D08A3E"}}></span>
              </span>
              {"Anatomie, Physiologie, Pharmaco "}
            </span>
          </div>
          <div style={{flex: "1", minHeight: "0", width: "100%", overflowY: "auto", display: "flex", justifyContent: "center", paddingTop: "24px", scrollbarWidth: "none"}}>
            <div style={{position: "relative", width: "860px", height: v.totalH}}>
              <svg width={"860"} height={v.totalH} viewBox={`0 0 860 ${v.svgH}`} aria-hidden={"true"} style={{position: "absolute", left: "0", top: "0", overflow: "visible"}}>
                <path d={v.fullPath} fill={"none"} stroke={"#ECE7DD"} strokeWidth={"14"} strokeLinecap={"round"} strokeLinejoin={"round"} />
                <path className={"mr-line"} pathLength={"1"} d={v.donePath} fill={"none"} stroke={"#15304E"} strokeWidth={"14"} strokeLinecap={"round"} strokeLinejoin={"round"} />
              </svg>
              {(v.bands || []).map((w: any, i_w: number) => (
                <Fragment key={i_w}>
                  <div className={"mr-rise"} style={{position: "absolute", left: "0", right: "0", top: w.top, display: "flex", alignItems: "center", gap: "18px", fontSize: "15px", fontWeight: "600", color: "#9AA0A8", animationDelay: w.delay}}>
                    <span style={{flex: "1", height: "1px", background: "#E4DFD4"}}></span>
                    <span style={{padding: "6px 16px", borderRadius: "999px", background: "#FAF8F4", border: "1px solid #E4DFD4"}}>
                      {w.title}
                      <span style={{fontWeight: "500"}}>
                        {" \u00b7 "}{w.sub}
                      </span>
                    </span>
                    <span style={{flex: "1", height: "1px", background: "#E4DFD4"}}></span>
                  </div>
                </Fragment>
              ))}
              {(v.nodes || []).map((n: any, i_n: number) => (
                <Fragment key={i_n}>
                  <div className={"mr-enter"} id={n.anchor} style={{position: "absolute", left: n.left, top: n.top, width: n.size, height: n.size, animationDelay: n.delay}}>
                    {n.halo ? (
                      <>
                        <span className={"mr-halo"} style={{position: "absolute", inset: "0", borderRadius: n.radius, background: n.haloColor}}></span>
                      </>
                    ) : null}
                    <button type={"button"} className={`mr-node ${n.anim}`} onClick={n.pick} aria-label={n.label} aria-pressed={n.pressed} style={{font: "inherit", position: "relative", width: "100%", height: "100%", borderRadius: n.radius, border: n.border, background: n.bg, color: n.fg, boxShadow: n.shadow, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0"}}>
                      {n.showRing ? (
                        <>
                          <svg width={"104"} height={"104"} viewBox={"0 0 104 104"} aria-hidden={"true"} style={{position: "absolute", left: "-8px", top: "-8px", transform: "rotate(-90deg)"}}>
                            <circle cx={"52"} cy={"52"} r={"44"} fill={"none"} stroke={"#E4DFD4"} strokeWidth={"5"} />
                            <circle className={"mr-ringfill"} cx={"52"} cy={"52"} r={"44"} fill={"none"} stroke={"#F49A2E"} strokeWidth={"5"} strokeLinecap={"round"} strokeDasharray={"276"} strokeDashoffset={n.ringOffset} />
                          </svg>
                        </>
                      ) : null}
                      {n.showImg ? (
                        <>
                          <img src={n.img} alt={""} className={n.iconClass} style={{width: n.imgSize, height: n.imgSize, filter: n.imgFilter, pointerEvents: "none"}} />
                        </>
                      ) : null}
                      {n.showSvg ? (
                        <>
                          <svg className={n.iconClass} width={n.iconSize} height={n.iconSize} viewBox={n.viewBox} fill={n.iconFill} stroke={n.iconStroke} strokeWidth={n.iconStrokeW} strokeLinecap={"round"} strokeLinejoin={"round"} aria-hidden={"true"}>
                            <path d={n.icon} />
                          </svg>
                        </>
                      ) : null}
                    </button>
                    <span style={{position: "absolute", top: "50%", right: "calc(100% + 22px)", transform: "translateY(-50%)", whiteSpace: "nowrap", textAlign: "right", display: "flex", flexDirection: "column", gap: "2px"}}>
                      <span style={{fontSize: "15px", fontWeight: n.dateWeight, color: n.dateColor}}>
                        {n.date}
                      </span>
                      <span style={{fontSize: "13px", color: "#9AA0A8"}}>
                        {n.sub}
                      </span>
                    </span>
                    {n.gain ? (
                      <>
                        <span className={"mr-gain"} style={{position: "absolute", left: "50%", top: "-14px", marginLeft: "-40px", width: "80px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "18px", fontWeight: "700", color: "#3F4CC9"}}>
                          {"+25 "}
                          <img src={"/v2/assets/eclat.svg"} alt={""} style={{width: "20px", height: "20px"}} />
                        </span>
                      </>
                    ) : null}
                  </div>
                </Fragment>
              ))}
              <div className={"mr-card-in"} style={{position: "absolute", left: v.card.left, top: v.card.top, width: "320px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "6px", padding: "22px 24px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.06), 0 16px 40px rgba(26,29,35,.10)"}}>
                <span style={{fontSize: "14px", color: "#6B6F76"}}>
                  {v.card.kicker}
                </span>
                <span style={{fontSize: "24px", fontWeight: "700", letterSpacing: "-.01em"}}>
                  {v.card.title}
                </span>
                <span style={{fontSize: "15px", color: "#6B6F76"}}>
                  {v.card.sub}
                </span>
                <Link href={"/v2/session"} className={"mr-btn"} style={{marginTop: "12px", textAlign: "center", fontSize: "17px", fontWeight: "700", color: v.card.btnFg, background: v.card.btnBg, padding: "14px", borderRadius: "12px", textDecoration: "none"}}>
                  {v.card.cta}
                </Link>
              </div>
            </div>
          </div>
        </section>
        <aside style={{flex: "0 0 360px", display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "40px"}}>
          <Link href={"/v2/boutique"} className={"mr-rise mr-lift"} style={{display: "flex", alignItems: "center", gap: "16px", padding: "20px 24px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", textDecoration: "none", color: "#1A1D23"}}>
            <img src={"/v2/assets/eclat.svg"} alt={""} style={{width: "44px", height: "44px"}} />
            <span style={{flex: "1", display: "flex", flexDirection: "column", gap: "2px"}}>
              <span className={v.balanceAnim} style={{fontSize: "24px", fontWeight: "700", display: "inline-block", transformOrigin: "left center"}}>
                {v.balance}
                <span style={{fontSize: "15px", fontWeight: "500", color: "#6B6F76"}}>
                  {" \u00e9clats"}
                </span>
              </span>
              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                {"Voir la boutique"}
              </span>
            </span>
            <span style={{fontSize: "20px", color: "#9AA0A8"}}>
              {"\u2192"}
            </span>
          </Link>
          <section aria-label={"Détail"} className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "16px", padding: "24px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".1s"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                {v.sel.kicker}
              </span>
              <span style={{fontSize: "22px", fontWeight: "700"}}>
                {v.sel.date}
              </span>
            </span>
            {v.sel.hasStats ? (
              <>
                <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px"}}>
                  {(v.sel.stats || []).map((s: any, i_s: number) => (
                    <Fragment key={i_s}>
                      <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                        <span style={{fontSize: "22px", fontWeight: "700"}}>
                          {s.v}
                        </span>
                        <span style={{fontSize: "13px", color: "#6B6F76"}}>
                          {s.l}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            ) : null}
            <div style={{display: "flex", flexDirection: "column"}}>
              {(v.sel.fiches || []).map((f: any, i_f: number) => (
                <Fragment key={i_f}>
                  <div style={{display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderTop: "1px solid #F1EEE7", fontSize: "15px"}}>
                    <span style={{width: "9px", height: "9px", borderRadius: "50%", background: f.color}}></span>
                    <span style={{flex: "1", fontWeight: "600"}}>
                      {f.title}
                    </span>
                    <span style={{fontSize: "14px", color: "#6B6F76"}}>
                      {f.right}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
          <section aria-label={"Défis de la semaine"} className={"mr-rise"} style={{display: "flex", flexDirection: "column", gap: "18px", padding: "24px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: ".2s"}}>
            <span style={{fontSize: "18px", fontWeight: "700"}}>
              {"D\u00e9fis de la semaine"}
            </span>
            {(v.quests || []).map((q: any, i_q: number) => (
              <Fragment key={i_q}>
                <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                  <span style={{display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "15px"}}>
                    <span style={{fontWeight: "600"}}>
                      {q.title}
                    </span>
                    <span style={{display: "flex", alignItems: "center", gap: "4px", color: "#3F4CC9", fontWeight: "700", whiteSpace: "nowrap"}}>
                      {"+"}{q.reward}{" "}
                      <img src={"/v2/assets/eclat.svg"} alt={""} style={{width: "16px", height: "16px"}} />
                    </span>
                  </span>
                  <span style={{display: "flex", alignItems: "center", gap: "10px"}}>
                    <span style={{flex: "1", height: "8px", borderRadius: "4px", background: "#F1EEE7", overflow: "hidden"}}>
                      <span className={"mr-bar"} style={{display: "block", height: "8px", borderRadius: "4px", width: q.pct, background: q.color}}></span>
                    </span>
                    <span style={{fontSize: "13px", color: "#6B6F76", width: "36px", textAlign: "right"}}>
                      {q.count}
                    </span>
                  </span>
                </div>
              </Fragment>
            ))}
          </section>
        </aside>
      </main>
    </div>
    </>
  )
}
