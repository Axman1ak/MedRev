// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-row{transition:background .12s ease}\n.mr-row:hover{background:#F1EEE7}\n.mr-btn:hover{filter:brightness(.9)}\n.mr-tab:hover{color:#1A1D23}\n.mr-card{transition:box-shadow .15s ease, transform .15s ease}\n.mr-card:hover{box-shadow:0 2px 4px rgba(26,29,35,.06),0 12px 28px rgba(26,29,35,.08)}\n.mr-opt:hover{border-color:#1E3354 !important}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { tab: 0, mode: 0, sel: 'ana', joined: false, err: 'all' };
  }
  renderVals() {
    const st = this.state;
    const tabDefs = ['Partiels blancs', 'Concours de la fac', 'Mes erreurs'];
    const tabs = tabDefs.map((label, i) => ({
      label, go: () => this.setState({ tab: i }), current: st.tab === i ? 'page' : 'false',
      weight: st.tab === i ? 700 : 500, color: st.tab === i ? '#1A1D23' : '#6B6F76', line: st.tab === i ? '#15304E' : 'transparent'
    }));
    const E = [
      ['all', 'Semestre complet', '#15304E', '180 QCM, 4 h 30', [11.2, 12.1, 12.8], ''],
      ['ana', 'Anatomie', '#4F7CC9', '30 QCM, 45 min', [10.4, 11.8, 12.6, 13.9], ''],
      ['phy', 'Physiologie', '#8B6BB8', '30 QCM, 45 min', [12.5, 14.1], ''],
      ['pha', 'Pharmacologie', '#D08A3E', '20 QCM, 30 min', [9.8, 11.2, 10.9], ''],
      ['bio', 'Biophysique', '#C4554D', '30 QCM, 1 h', [8.6], ''],
      ['stat', 'Biostatistiques', '#9C7148', '20 QCM, 45 min', [], ''],
      ['ssh', 'SSH', '#3E8E85', 'QCM et QROC, 1 h', [], '']
    ];
    const fmt = (n) => n.toFixed(1).replace('.', ',');
    const epreuves = E.map(([id, name, color, format, scores]) => {
      const on = st.sel === id;
      const n = scores.length;
      const diff = n > 1 ? scores[n - 1] - scores[n - 2] : null;
      return {
        name, color, format,
        last: n ? fmt(scores[n - 1]) : 'Pas encore fait', unit: n ? '/20' : '',
        trend: diff === null ? '' : (diff >= 0 ? '+' : '') + fmt(diff),
        trendColor: diff !== null && diff < 0 ? '#B4533A' : '#2F6B45',
        border: on ? '#15304E' : 'transparent', pressed: on ? 'true' : 'false',
        span: id === 'all' ? 'span 3' : 'auto',
        pick: () => this.setState({ sel: id })
      };
    });
    epreuves.forEach((e) => { if (e.unit === '') e.last = '—'; });
    const cur = E.find((e) => e[0] === st.sel) || E[0];
    const dates = ['14 oct.', '21 oct.', '28 oct.', '2 nov.'];
    const sc = cur[4].slice(-4);
    const bars = sc.map((s, i) => ({ score: fmt(s), h: Math.round(s / 20 * 80) + '%', bg: i === sc.length - 1 ? cur[2] : '#E4DFD4', date: dates[4 - sc.length + i] }));
    const sel = { name: cur[1], color: cur[2], format: cur[3], bars, hasHistory: sc.length > 0, noHistory: sc.length === 0 };
    const modeDefs = [['Conditions réelles', 'Chrono, correction à la fin'], ['Entraînement', 'Sans chrono, correction à chaque question']];
    const modes = modeDefs.map(([label, desc], i) => {
      const on = st.mode === i;
      return { label, desc, pressed: on ? 'true' : 'false', pick: () => this.setState({ mode: i }), bg: on ? '#F4F6FA' : '#FFFFFF', border: on ? '#15304E' : '#E4DFD4', ring: on ? '#15304E' : '#C9C3B8', dot: on ? '#15304E' : 'transparent' };
    });
    const counts = [2, 4, 9, 18, 31, 52, 74, 96, 112, 118, 104, 88, 64, 41, 27, 12, 5, 2, 1, 0];
    const hist = counts.map((c, i) => ({ h: Math.round(c / 118 * 100) + '%', bg: i === 13 ? '#15304E' : '#D3DEEC', label: i + ' à ' + (i + 1) + ', ' + c + ' étudiants' }));
    const names = ['camille.r', 'yanis_b', 'lea.m', 'hugo.p', 'ines.d'];
    const scoresB = ['18,9', '18,4', '18,1', '17,8', '17,6'];
    const board = names.map((n, i) => ({ rank: (i + 1) + '', name: n, score: scoresB[i], bg: 'transparent', weight: 500, rankColor: i === 0 ? '#9A7420' : '#1A1D23' }));
    board.push({ rank: '…', name: '', score: '', bg: 'transparent', weight: 500, rankColor: '#9AA0A8' });
    board.push({ rank: '142', name: 'Toi', score: '13,4', bg: '#EEF2F8', weight: 700, rankColor: '#15304E' });
    const ERR = [
      ['ana', '#4F7CC9', 'Le nerf facial (VII) assure la motricité des muscles masticateurs.', 'Nerfs crâniens', 'poly p. 18'],
      ['ana', '#4F7CC9', 'Le nerf abducens (VI) innerve le muscle oblique supérieur.', 'Nerfs crâniens', 'poly p. 11'],
      ['pha', '#D08A3E', 'La demi-vie d’élimination dépend uniquement de la clairance.', 'Pharmacocinétique', 'poly p. 7'],
      ['bio', '#C4554D', 'La vergence d’une lentille divergente est positive.', 'Optique géométrique', 'vidéo 22:40'],
      ['phy', '#8B6BB8', 'La repolarisation est due à une entrée de K+.', 'Potentiel d’action', 'poly p. 12']
    ];
    const filterDefs = [['all', 'Tout', '#1A1D23', 34], ['ana', 'Anatomie', '#4F7CC9', 14], ['pha', 'Pharmacologie', '#D08A3E', 9], ['bio', 'Biophysique', '#C4554D', 7], ['phy', 'Physiologie', '#8B6BB8', 4]];
    const errFilters = filterDefs.map(([id, label, color, count]) => ({
      label, color, count, pressed: st.err === id ? 'true' : 'false',
      border: st.err === id ? '#15304E' : '#E4DFD4', bg: st.err === id ? '#EEF2F8' : '#FFFFFF',
      pick: () => this.setState({ err: id })
    }));
    const errors = ERR.filter((e) => st.err === 'all' || e[0] === st.err).map(([, color, stem, fiche, ref]) => ({ color, stem, fiche, ref }));
    const errCount = filterDefs.find((f) => f[0] === st.err)[3];
    return {
      tabs, epreuves, sel, modes, hist, board, errFilters, errors,
      isEpreuves: st.tab === 0, isConcours: st.tab === 1, isErreurs: st.tab === 2,
      errTitle: errCount + ' questions à retravailler',
      registered: st.joined ? 413 : 412,
      joinLabel: st.joined ? 'Inscrit ✓' : 'Je m’inscris',
      joinBg: st.joined ? '#E8F1EA' : '#FFFFFF',
      joinColor: st.joined ? '#2F6B45' : '#15304E',
      joinedPressed: st.joined ? 'true' : 'false',
      toggleJoin: () => this.setState({ joined: !st.joined })
    };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style>{CSS}</style>
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "100vh", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="4" />
      </div>
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 56px", display: "flex", flexDirection: "column", gap: "32px"}}>
        <header style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", borderBottom: "1px solid #EDE9E1"}}>
          <div style={{display: "flex", flexDirection: "column", gap: "22px"}}>
            <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {"Simulateur"}
            </h1>
            <nav aria-label="Sections du simulateur" style={{display: "flex", gap: "36px"}}>
              {(v.tabs || []).map((t: any, i_t: number) => (
                <Fragment key={i_t}>
                  <button type="button" className="mr-tab" onClick={t.go} aria-current={t.current} style={{font: "inherit", fontSize: "17px", fontWeight: t.weight, color: t.color, background: "transparent", border: "0", borderBottom: `3px solid ${t.line}`, padding: "0 0 14px", marginBottom: "-1px", cursor: "pointer"}}>
                    {t.label}
                  </button>
                </Fragment>
              ))}
            </nav>
          </div>
        </header>
        {v.isEpreuves ? (
          <>
            <div style={{display: "flex", gap: "48px", alignItems: "flex-start"}}>
              <div style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "20px"}}>
                <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px"}}>
                  {(v.epreuves || []).map((e: any, i_e: number) => (
                    <Fragment key={i_e}>
                      <button type="button" className="mr-card" onClick={e.pick} aria-pressed={e.pressed} style={{font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "18px", padding: "24px", borderRadius: "16px", background: "#FFFFFF", border: `2px solid ${e.border}`, boxShadow: "0 1px 2px rgba(26,29,35,.05)", gridColumn: e.span}}>
                        <span style={{display: "flex", alignItems: "center", gap: "10px"}}>
                          <span style={{width: "12px", height: "12px", borderRadius: "50%", background: e.color}}></span>
                          <span style={{fontSize: "20px", fontWeight: "700"}}>
                            {e.name}
                          </span>
                        </span>
                        <span style={{fontSize: "16px", color: "#6B6F76"}}>
                          {e.format}
                        </span>
                        <span style={{display: "flex", alignItems: "baseline", gap: "10px"}}>
                          <span style={{fontSize: "38px", fontWeight: "700", letterSpacing: "-.02em"}}>
                            {e.last}
                          </span>
                          <span style={{fontSize: "16px", color: "#9AA0A8"}}>
                            {e.unit}
                          </span>
                          <span style={{fontSize: "16px", fontWeight: "600", color: e.trendColor}}>
                            {e.trend}
                          </span>
                        </span>
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
              <aside aria-label="Lancer un partiel blanc" style={{flex: "0 0 440px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "28px", padding: "32px", borderRadius: "20px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05), 0 10px 30px rgba(26,29,35,.06)"}}>
                <div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "10px", fontSize: "26px", fontWeight: "700"}}>
                    <span style={{width: "12px", height: "12px", borderRadius: "50%", background: v.sel.color}}></span>
                    {v.sel.name}
                  </span>
                  <span style={{fontSize: "16px", color: "#6B6F76"}}>
                    {v.sel.format}
                  </span>
                </div>
                <div role="radiogroup" aria-label="Mode" style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                  {(v.modes || []).map((m: any, i_m: number) => (
                    <Fragment key={i_m}>
                      <button type="button" role="radio" className="mr-opt" onClick={m.pick} aria-checked={m.pressed} style={{font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", borderRadius: "14px", background: m.bg, border: `2px solid ${m.border}`}}>
                        <span style={{width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${m.ring}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", flex: "none"}}>
                          <span style={{width: "10px", height: "10px", borderRadius: "50%", background: m.dot}}></span>
                        </span>
                        <span style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                          <span style={{fontSize: "17px", fontWeight: "600"}}>
                            {m.label}
                          </span>
                          <span style={{fontSize: "15px", color: "#6B6F76"}}>
                            {m.desc}
                          </span>
                        </span>
                      </button>
                    </Fragment>
                  ))}
                </div>
                <button type="button" className="mr-btn" style={{font: "inherit", fontSize: "18px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", border: "0", padding: "18px", borderRadius: "14px", cursor: "pointer"}}>
                  {"Lancer le partiel blanc"}
                </button>
                {v.sel.hasHistory ? (
                  <>
                    <div style={{display: "flex", flexDirection: "column", gap: "14px"}}>
                      <span style={{fontSize: "15px", fontWeight: "600", color: "#3D424A"}}>
                        {"Tes derni\u00e8res notes"}
                      </span>
                      <div style={{display: "flex", alignItems: "flex-end", gap: "12px", height: "110px"}}>
                        {(v.sel.bars || []).map((b: any, i_b: number) => (
                          <Fragment key={i_b}>
                            <a href="#" title="Revoir la copie" style={{flex: "1", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "6px", textDecoration: "none", color: "#1A1D23"}}>
                              <span style={{fontSize: "14px", fontWeight: "700"}}>
                                {b.score}
                              </span>
                              <span style={{width: "100%", height: b.h, borderRadius: "6px 6px 0 0", background: b.bg}}></span>
                            </a>
                          </Fragment>
                        ))}
                      </div>
                      <div style={{display: "flex", gap: "12px"}}>
                        {(v.sel.bars || []).map((b: any, i_b: number) => (
                          <Fragment key={i_b}>
                            <span style={{flex: "1", textAlign: "center", fontSize: "13px", color: "#6B6F76"}}>
                              {b.date}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
                {v.sel.noHistory ? (
                  <>
                    <span style={{fontSize: "16px", color: "#6B6F76"}}>
                      {"Pas encore de partiel blanc dans cette UE."}
                    </span>
                  </>
                ) : null}
              </aside>
            </div>
          </>
        ) : null}
        {v.isConcours ? (
          <>
            <div style={{display: "flex", gap: "48px", alignItems: "flex-start"}}>
              <div style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "40px"}}>
                <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", padding: "32px 36px", borderRadius: "20px", background: "#15304E", color: "#FFFFFF"}}>
                  <span style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                    <span style={{fontSize: "16px", color: "rgba(255,255,255,.7)"}}>
                      {"Prochain concours blanc"}
                    </span>
                    <span style={{fontSize: "32px", fontWeight: "700", letterSpacing: "-.01em"}}>
                      {"Samedi 22 novembre, 14h"}
                    </span>
                    <span style={{fontSize: "16px", color: "rgba(255,255,255,.7)"}}>
                      {"Toutes les UE, 4 h 30. "}{v.registered}{" \u00e9tudiants inscrits."}
                    </span>
                  </span>
                  <button type="button" onClick={v.toggleJoin} aria-pressed={v.joinedPressed} style={{font: "inherit", flex: "none", fontSize: "17px", fontWeight: "700", color: v.joinColor, background: v.joinBg, border: "0", padding: "16px 28px", borderRadius: "14px", cursor: "pointer"}}>
                    {v.joinLabel}
                  </button>
                </div>
                <section aria-label="Ton dernier concours" style={{display: "flex", flexDirection: "column", gap: "20px"}}>
                  <span style={{fontSize: "20px", fontWeight: "700"}}>
                    {"Ton dernier concours, 18 octobre"}
                  </span>
                  <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px"}}>
                    <div style={{display: "flex", flexDirection: "column", gap: "4px", padding: "22px", borderRadius: "16px", background: "#FFFFFF"}}>
                      <span style={{fontSize: "36px", fontWeight: "700"}}>
                        {"13,4"}
                        <span style={{fontSize: "18px", color: "#9AA0A8"}}>
                          {"/20"}
                        </span>
                      </span>
                      <span style={{fontSize: "15px", color: "#6B6F76"}}>
                        {"ta note"}
                      </span>
                    </div>
                    <div style={{display: "flex", flexDirection: "column", gap: "4px", padding: "22px", borderRadius: "16px", background: "#FFFFFF"}}>
                      <span style={{fontSize: "36px", fontWeight: "700"}}>
                        {"142"}
                        <span style={{fontSize: "18px", color: "#9AA0A8"}}>
                          {"e sur 860"}
                        </span>
                      </span>
                      <span style={{fontSize: "15px", color: "#6B6F76"}}>
                        {"ton classement"}
                      </span>
                    </div>
                    <div style={{display: "flex", flexDirection: "column", gap: "4px", padding: "22px", borderRadius: "16px", background: "#FFFFFF"}}>
                      <span style={{fontSize: "36px", fontWeight: "700", color: "#2F6B45"}}>
                        {"Top 17%"}
                      </span>
                      <span style={{fontSize: "15px", color: "#6B6F76"}}>
                        {"de ta promo"}
                      </span>
                    </div>
                  </div>
                  <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                    <div style={{display: "flex", alignItems: "flex-end", gap: "5px", height: "160px", borderBottom: "1px solid #E4DFD4"}}>
                      {(v.hist || []).map((b: any, i_b: number) => (
                        <Fragment key={i_b}>
                          <span title={b.label} style={{flex: "1", height: b.h, borderRadius: "4px 4px 0 0", background: b.bg}}></span>
                        </Fragment>
                      ))}
                    </div>
                    <div style={{display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#9AA0A8"}}>
                      <span>
                        {"0"}
                      </span>
                      <span>
                        {"Notes de la promo"}
                      </span>
                      <span>
                        {"20"}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
              <aside aria-label="Classement" style={{flex: "0 0 400px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "14px", padding: "28px", borderRadius: "20px", background: "#FFFFFF"}}>
                <span style={{fontSize: "18px", fontWeight: "700"}}>
                  {"Classement de la fac"}
                </span>
                <ol style={{listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column"}}>
                  {(v.board || []).map((b: any, i_b: number) => (
                    <Fragment key={i_b}>
                      <li style={{display: "flex", alignItems: "center", gap: "14px", padding: "12px", borderRadius: "10px", background: b.bg, fontSize: "16px"}}>
                        <span style={{width: "40px", fontWeight: "700", color: b.rankColor}}>
                          {b.rank}
                        </span>
                        <span style={{flex: "1", fontWeight: b.weight}}>
                          {b.name}
                        </span>
                        <span style={{color: "#6B6F76", fontVariantNumeric: "tabular-nums"}}>
                          {b.score}
                        </span>
                      </li>
                    </Fragment>
                  ))}
                </ol>
                <a href="#" style={{fontSize: "15px", fontWeight: "600", textDecoration: "none", padding: "4px 12px"}}>
                  {"Voir tes anciens concours"}
                </a>
              </aside>
            </div>
          </>
        ) : null}
        {v.isErreurs ? (
          <>
            <div style={{display: "flex", flexDirection: "column", gap: "28px"}}>
              <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", padding: "28px 32px", borderRadius: "20px", background: "#FFFFFF"}}>
                <span style={{display: "flex", flexDirection: "column", gap: "6px"}}>
                  <span style={{fontSize: "30px", fontWeight: "700"}}>
                    {v.errTitle}
                  </span>
                </span>
                <button type="button" className="mr-btn" style={{font: "inherit", flex: "none", fontSize: "17px", fontWeight: "700", color: "#FFFFFF", background: "#15304E", border: "0", padding: "16px 28px", borderRadius: "14px", cursor: "pointer"}}>
                  {"Les refaire"}
                </button>
              </div>
              <div style={{display: "flex", flexWrap: "wrap", gap: "10px"}}>
                {(v.errFilters || []).map((f: any, i_f: number) => (
                  <Fragment key={i_f}>
                    <button type="button" onClick={f.pick} aria-pressed={f.pressed} style={{font: "inherit", display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "999px", border: `1px solid ${f.border}`, background: f.bg, fontSize: "15px", fontWeight: "500", color: "#1A1D23", cursor: "pointer"}}>
                      <span style={{width: "9px", height: "9px", borderRadius: "50%", background: f.color}}></span>
                      {f.label}
                      <span style={{color: "#6B6F76"}}>
                        {f.count}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </div>
              <div style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px"}}>
                {(v.errors || []).map((q: any, i_q: number) => (
                  <Fragment key={i_q}>
                    <div style={{display: "flex", flexDirection: "column", gap: "12px", padding: "22px 24px", borderRadius: "16px", background: "#FFFFFF"}}>
                      <span style={{display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#6B6F76"}}>
                        <span style={{width: "9px", height: "9px", borderRadius: "50%", background: q.color}}></span>
                        {q.fiche}
                      </span>
                      <span style={{fontSize: "17px", lineHeight: "1.45"}}>
                        {q.stem}
                      </span>
                      <a href="#" style={{fontSize: "15px", fontWeight: "600", textDecoration: "none"}}>
                        {"Voir dans le cours, "}{q.ref}
                      </a>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
    </>
  )
}
