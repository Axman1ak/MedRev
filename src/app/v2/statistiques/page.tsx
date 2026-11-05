// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-row{transition:background .12s ease}\n.mr-row:hover{background:#F6F4EF}\n.mr-card{transition:box-shadow .15s ease}\n.mr-card:hover{box-shadow:0 2px 4px rgba(26,29,35,.06),0 10px 24px rgba(26,29,35,.08) !important}\n.mr-bar:hover span.b{filter:brightness(.9)}\n.mr-btn:hover{filter:brightness(.9)}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { period: 1, metric: 0, day: null, open: 'pha' };
  }
  renderVals() {
    const st = this.state;
    const p = st.period;
    const C = { ana: '#4F7CC9', phy: '#8B6BB8', pha: '#D08A3E', bio: '#C4554D', stat: '#9C7148', ssh: '#3E8E85' };
    const scale = ['#ECE8E0', '#D98C7E', '#E2AE6A', '#D8C46A', '#93BC80', '#4E9A6B'];
    const periods = ['7 jours', '30 jours', 'Semestre'].map((label, i) => ({
      label, pressed: p === i ? 'true' : 'false', pick: () => this.setState({ period: i, day: null }),
      weight: p === i ? 600 : 500, color: p === i ? '#1A1D23' : '#6B6F76',
      bg: p === i ? '#FFFFFF' : 'transparent', shadow: p === i ? '0 1px 2px rgba(0,0,0,.06)' : 'none'
    }));
    const pool = [['Nerfs crâniens', C.ana], ['Potentiel d’action', C.phy], ['Pharmacocinétique', C.pha], ['Optique géométrique', C.bio], ['Membre supérieur', C.ana], ['Thermodynamique', C.bio], ['Récepteurs et ligands', C.pha], ['Fonction rénale', C.phy]];
    const n = p === 0 ? 7 : (p === 1 ? 30 : 64);
    const today = new Date(2026, 10, 4);
    const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const days = [];
    for (let i = 0; i < n; i++) {
      const r = Math.abs(Math.sin((n - i + 3) * 9.17)) % 1;
      const active = r > 0.42 || i === n - 1;
      const d = new Date(today); d.setDate(today.getDate() - (n - 1 - i));
      const mins = active ? Math.round(40 + r * 110) : 0;
      const nf = active ? 1 + Math.round(r * 4) : 0;
      const qcm = active ? Math.round(52 + r * 38) : 0;
      const note = active ? 2 + r * 2.6 : 0;
      const onTime = active ? Math.round(55 + r * 45) : 0;
      const fiches = [];
      for (let k = 0; k < Math.min(nf, 4); k++) {
        const f = pool[(i + k * 3) % pool.length];
        const nt = 1 + ((i + k) * 7) % 5;
        fiches.push({ title: f[0], color: f[1], note: String(nt), noteBg: scale[nt], qcm: (50 + ((i * 13 + k * 7) % 45)) + '% QCM' });
      }
      days.push({ date: jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()], mins, nf, qcm, note, onTime, active, fiches });
    }
    const act = days.filter((d) => d.active);
    const sum = (k) => act.reduce((a, d) => a + d[k], 0);
    const hm = (m) => m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min';
    const avg = (k) => act.length ? sum(k) / act.length : 0;
    const K = [
      ['Temps de révision', hm(sum('mins')), '+18% vs avant', '#2F6B45', 'mins', (v) => hm(v)],
      ['Fiches révisées', String(sum('nf')), '+6 vs avant', '#2F6B45', 'nf', (v) => v + ' fiches'],
      ['Réussite QCM', Math.round(avg('qcm')) + '%', '+4 pts', '#2F6B45', 'qcm', (v) => v + '%'],
      ['Ressenti moyen', avg('note').toFixed(1).replace('.', ',') + '/5', '−0,2', '#B4533A', 'note', (v) => v.toFixed(1).replace('.', ',') + '/5'],
      ['Révisions à l’heure', Math.round(avg('onTime')) + '%', '−9 pts', '#B4533A', 'onTime', (v) => v + '%']
    ];
    const kpis = K.map(([label, value, delta, dc], i) => {
      const on = st.metric === i;
      return { label, value, delta, deltaColor: on ? (dc === '#2F6B45' ? '#9BD3AE' : '#F2B4A4') : dc, pressed: on ? 'true' : 'false', bg: on ? '#15304E' : '#FFFFFF', fg: on ? '#FFFFFF' : '#1A1D23', pick: () => this.setState({ metric: i }) };
    });
    const km = K[st.metric];
    const key = km[4];
    const max = Math.max(...days.map((d) => d[key]), 1);
    const selIdx = st.day === null ? n - 1 : st.day;
    const bars = days.map((d, i) => ({
      h: Math.round(d[key] / max * 100) + '%',
      bg: i === selIdx ? '#15304E' : (d.active ? '#A9BFDB' : '#ECE8E0'),
      title: d.date + ', ' + (d.active ? km[5](d[key]) : 'rien'),
      pick: () => this.setState({ day: i })
    }));
    const sd = days[selIdx];
    const day = { date: sd.date, active: sd.active, inactive: !sd.active, mins: hm(sd.mins), nf: String(sd.nf), qcm: sd.qcm + '%', fiches: sd.fiches };
    const risk = [['Pharmacocinétique', 34], ['Optique géométrique', 41], ['Nerfs crâniens', 48], ['Tronc cérébral', 57]].map(([title, v]) => ({ title, pct: v + '%', color: v < 45 ? '#F2B4A4' : '#F3D49A' }));
    const calib = [['Anatomie', 72, 70, C.ana], ['Physiologie', 74, 66, C.phy], ['Pharmacologie', 46, 70, C.pha], ['Biophysique', 41, 50, C.bio], ['SSH', 88, 80, C.ssh]].map(([name, q, f, color]) => {
      const g = f - q;
      return { name, color, qcm: q + '%', feel: f + '%', gap: Math.abs(g) < 6 ? 'juste' : (g > 0 ? 'surestimé' : 'sous-estimé'), gapColor: Math.abs(g) < 6 ? '#2F6B45' : (g > 0 ? '#B4533A' : '#2F5D8A') };
    });
    const heat = ['#ECE8E0', '#D3DEEC', '#A9BFDB', '#6F8FBA', '#2F5D8A'];
    const slotDefs = [['Matin', [4, 3, 4, 0, 4, 3, 2]], ['Midi', [2, 0, 3, 2, 0, 2, 0]], ['Après-m.', [2, 2, 0, 3, 2, 1, 1]], ['Soir', [1, 2, 1, 1, 0, 0, 1]]];
    const slots = slotDefs.map(([label, v]) => ({ label, cells: v.map((x) => ({ bg: heat[x], t: x ? (50 + x * 8) + '% de réussite' : 'pas de données' })) }));
    const S = [
      ['ana', 'Anatomie spécifique', C.ana, '60%', '70%', '8 h 10', 3, '13,9', [['Nerfs crâniens', '52% en QCM, 44 j de retard'], ['Tronc cérébral', '55% en QCM, 42 j de retard'], ['Cerveau, vascularisation', '74% en QCM']]],
      ['phy', 'Physiologie', C.phy, '67%', '74%', '4 h 20', 1, '14,1', [['Potentiel d’action', '71% en QCM, 36 j de retard'], ['Fonction rénale', '84% en QCM'], ['Cœur', '79% en QCM']]],
      ['pha', 'Pharmacologie', C.pha, '50%', '46%', '2 h 05', 1, '10,9', [['Pharmacocinétique', '45% en QCM, 44 j de retard'], ['Récepteurs et ligands', '71% en QCM'], ['Interactions', 'jamais révisée']]],
      ['bio', 'Biophysique', C.bio, '50%', '41%', '1 h 50', 1, '8,6', [['Optique géométrique', '38% en QCM, 41 j de retard'], ['Thermodynamique', '80% en QCM'], ['Radioactivité', 'jamais révisée']]],
      ['ssh', 'Santé, Société, Humanité', C.ssh, '100%', '88%', '2 h 30', 0, '—', [['Éthique médicale', '91% en QCM'], ['Santé publique', '86% en QCM'], ['Histoire de la médecine', '88% en QCM']]],
      ['stat', 'Biostatistiques', C.stat, '0%', '—', '0 min', 0, '—', [['Tests statistiques', 'jamais révisée'], ['Probabilités', 'jamais révisée'], ['Intervalles de confiance', 'jamais révisée']]]
    ];
    const subjects = S.map(([id, name, color, mastery, qcm, time, late, sim, weak]) => {
      const open = st.open === id;
      const simN = parseFloat(sim.replace(',', '.'));
      return {
        name, color, mastery, qcm, time, late: late ? late + ' fiches' : 'aucune', lateColor: late ? '#9A5A1F' : '#6B6F76',
        sim: sim === '—' ? '—' : sim + '/20', simColor: isNaN(simN) ? '#9AA0A8' : (simN < 10 ? '#B4533A' : '#1A1D23'),
        open, expanded: open ? 'true' : 'false', weak: weak.map(([title, info]) => ({ title, info })),
        toggle: () => this.setState({ open: open ? null : id })
      };
    });
    const loadN = [5, 4, 2, 3, 6, 9, 4, 3, 5, 2, 3, 7, 4, 6];
    const dn = ['J', 'V', 'S', 'D', 'L', 'M', 'M', 'J', 'V', 'S', 'D', 'L', 'M', 'M'];
    const load = loadN.map((v, i) => ({ n: String(v), d: dn[i], h: Math.round(v / 9 * 80) + '%', bg: v >= 8 ? '#D08A3E' : '#A9BFDB', t: v + ' fiches' }));
    load[7].d = 'M';
    const activeCount = act.length;
    return {
      periods, kpis, bars, day, risk, calib, slots, subjects, load,
      gap: n > 40 ? '3px' : (n > 10 ? '6px' : '14px'),
      chartTitle: km[0],
      regular: activeCount + ' jours actifs sur ' + n,
      firstLabel: days[0].date
    };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style>{CSS}</style>
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "1080px", display: "flex"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="2" />
      </div>
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 64px", display: "flex", flexDirection: "column", gap: "28px"}}>
        <header style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px"}}>
          <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
            {"Statistiques"}
          </h1>
          <div role="group" aria-label="P\u00e9riode" style={{display: "flex", padding: "4px", borderRadius: "12px", background: "#F1EEE7"}}>
            {(v.periods || []).map((p: any, i_p: number) => (
              <Fragment key={i_p}>
                <button type="button" onClick={p.pick} aria-pressed={p.pressed} style={{font: "inherit", fontSize: "15px", fontWeight: p.weight, color: p.color, background: p.bg, border: "0", padding: "9px 18px", borderRadius: "9px", cursor: "pointer", boxShadow: p.shadow}}>
                  {p.label}
                </button>
              </Fragment>
            ))}
          </div>
        </header>
        <div style={{display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "16px"}}>
          {(v.kpis || []).map((k: any, i_k: number) => (
            <Fragment key={i_k}>
              <button type="button" className="mr-card" onClick={k.pick} aria-pressed={k.pressed} style={{font: "inherit", color: k.fg, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "6px", padding: "22px", borderRadius: "16px", background: k.bg, border: "0", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
                <span style={{fontSize: "15px", opacity: ".72"}}>
                  {k.label}
                </span>
                <span style={{fontSize: "34px", fontWeight: "700", letterSpacing: "-.02em"}}>
                  {k.value}
                </span>
                <span style={{fontSize: "14px", fontWeight: "600", color: k.deltaColor}}>
                  {k.delta}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
        <div style={{display: "flex", gap: "20px", alignItems: "stretch"}}>
          <section aria-label="\u00c9volution" style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "18px", padding: "26px 28px", borderRadius: "18px", background: "#FFFFFF"}}>
            <div style={{display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px"}}>
              <span style={{fontSize: "18px", fontWeight: "700"}}>
                {v.chartTitle}
              </span>
              <span style={{fontSize: "15px", color: "#6B6F76"}}>
                {v.regular}
              </span>
            </div>
            <div style={{display: "flex", alignItems: "flex-end", gap: v.gap, height: "220px", borderBottom: "1px solid #EDE9E1"}}>
              {(v.bars || []).map((b: any, i_b: number) => (
                <Fragment key={i_b}>
                  <button type="button" className="mr-bar" onClick={b.pick} title={b.title} style={{font: "inherit", flex: "1", height: "100%", display: "flex", alignItems: "flex-end", padding: "0", border: "0", background: "transparent", cursor: "pointer"}}>
                    <span className="b" style={{display: "block", width: "100%", height: b.h, minHeight: "3px", borderRadius: "4px 4px 0 0", background: b.bg}}></span>
                  </button>
                </Fragment>
              ))}
            </div>
            <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#9AA0A8"}}>
              <span>
                {v.firstLabel}
              </span>
              <span>
                {"aujourd\u2019hui"}
              </span>
            </div>
          </section>
          <aside aria-label="D\u00e9tail du jour" style={{flex: "0 0 420px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "18px", padding: "26px 28px", borderRadius: "18px", background: "#FFFFFF"}}>
            <span style={{fontSize: "18px", fontWeight: "700", textTransform: "capitalize"}}>
              {v.day.date}
            </span>
            {v.day.active ? (
              <>
                <div style={{display: "flex", flexDirection: "column", gap: "18px"}}>
                  <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px"}}>
                    <div style={{display: "flex", flexDirection: "column"}}>
                      <span style={{fontSize: "24px", fontWeight: "700"}}>
                        {v.day.mins}
                      </span>
                      <span style={{fontSize: "14px", color: "#6B6F76"}}>
                        {"r\u00e9vis\u00e9es"}
                      </span>
                    </div>
                    <div style={{display: "flex", flexDirection: "column"}}>
                      <span style={{fontSize: "24px", fontWeight: "700"}}>
                        {v.day.nf}
                      </span>
                      <span style={{fontSize: "14px", color: "#6B6F76"}}>
                        {"fiches"}
                      </span>
                    </div>
                    <div style={{display: "flex", flexDirection: "column"}}>
                      <span style={{fontSize: "24px", fontWeight: "700"}}>
                        {v.day.qcm}
                      </span>
                      <span style={{fontSize: "14px", color: "#6B6F76"}}>
                        {"QCM"}
                      </span>
                    </div>
                  </div>
                  <div style={{display: "flex", flexDirection: "column"}}>
                    {(v.day.fiches || []).map((f: any, i_f: number) => (
                      <Fragment key={i_f}>
                        <Link href="/v2/matieres" className="mr-row" style={{display: "flex", alignItems: "center", gap: "12px", padding: "11px 8px", borderRadius: "8px", borderBottom: "1px solid #F1EEE7", textDecoration: "none", color: "inherit", fontSize: "15px"}}>
                          <span style={{width: "9px", height: "9px", borderRadius: "50%", background: f.color}}></span>
                          <span style={{flex: "1", fontWeight: "600"}}>
                            {f.title}
                          </span>
                          <span style={{fontSize: "14px", color: "#6B6F76"}}>
                            {f.qcm}
                          </span>
                          <span style={{width: "26px", height: "26px", borderRadius: "50%", background: f.noteBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700"}}>
                            {f.note}
                          </span>
                        </Link>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {v.day.inactive ? (
              <>
                <span style={{fontSize: "16px", color: "#6B6F76"}}>
                  {"Pas de r\u00e9vision ce jour l\u00e0."}
                </span>
              </>
            ) : null}
          </aside>
        </div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px"}}>
          <section aria-label="\u00c0 risque d'oubli" style={{display: "flex", flexDirection: "column", gap: "14px", padding: "26px 28px", borderRadius: "18px", background: "#15304E", color: "#FFFFFF"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "18px", fontWeight: "700"}}>
                {"\u00c0 risque d\u2019oubli"}
              </span>
              <span style={{fontSize: "14px", color: "rgba(255,255,255,.65)"}}>
                {"M\u00e9moire estim\u00e9e aujourd\u2019hui"}
              </span>
            </span>
            {(v.risk || []).map((r: any, i_r: number) => (
              <Fragment key={i_r}>
                <Link href="/v2/session" style={{display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", textDecoration: "none", color: "#FFFFFF", fontSize: "15px"}}>
                  <span style={{flex: "1", fontWeight: "600"}}>
                    {r.title}
                  </span>
                  <span style={{width: "90px", height: "6px", borderRadius: "3px", background: "rgba(255,255,255,.16)", overflow: "hidden"}}>
                    <span style={{display: "block", height: "6px", width: r.pct, background: r.color}}></span>
                  </span>
                  <span style={{width: "40px", textAlign: "right", fontWeight: "700"}}>
                    {r.pct}
                  </span>
                </Link>
              </Fragment>
            ))}
          </section>
          <section aria-label="Ressenti et QCM" style={{display: "flex", flexDirection: "column", gap: "14px", padding: "26px 28px", borderRadius: "18px", background: "#FFFFFF"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "18px", fontWeight: "700"}}>
                {"Ton ressenti face aux QCM"}
              </span>
              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                {"Ta note perso compar\u00e9e aux QCM"}
              </span>
            </span>
            {(v.calib || []).map((c: any, i_c: number) => (
              <Fragment key={i_c}>
                <div style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "15px"}}>
                  <span style={{width: "120px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                    {c.name}
                  </span>
                  <span style={{flex: "1", position: "relative", height: "8px", borderRadius: "4px", background: "#F1EEE7"}}>
                    <span style={{position: "absolute", left: "0", top: "0", height: "8px", borderRadius: "4px", width: c.qcm, background: c.color}}></span>
                    <span title="Ton ressenti" style={{position: "absolute", top: "-4px", left: c.feel, width: "3px", height: "16px", marginLeft: "-1px", borderRadius: "2px", background: "#1A1D23"}}></span>
                  </span>
                  <span style={{width: "110px", textAlign: "right", fontSize: "14px", fontWeight: "600", color: c.gapColor}}>
                    {c.gap}
                  </span>
                </div>
              </Fragment>
            ))}
            <span style={{fontSize: "13px", color: "#9AA0A8"}}>
              {"Barre color\u00e9e, r\u00e9ussite QCM. Trait noir, ton ressenti."}
            </span>
          </section>
          <section aria-label="Tes meilleurs moments" style={{display: "flex", flexDirection: "column", gap: "14px", padding: "26px 28px", borderRadius: "18px", background: "#FFFFFF"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "18px", fontWeight: "700"}}>
                {"Quand tu retiens le mieux"}
              </span>
              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                {"R\u00e9ussite QCM par moment"}
              </span>
            </span>
            <div style={{display: "grid", gridTemplateColumns: "80px repeat(7, minmax(0, 1fr))", gap: "5px", alignItems: "center", fontSize: "13px", color: "#6B6F76"}}>
              <span></span>
              <span style={{textAlign: "center"}}>
                {"L"}
              </span>
              <span style={{textAlign: "center"}}>
                {"M"}
              </span>
              <span style={{textAlign: "center"}}>
                {"M"}
              </span>
              <span style={{textAlign: "center"}}>
                {"J"}
              </span>
              <span style={{textAlign: "center"}}>
                {"V"}
              </span>
              <span style={{textAlign: "center"}}>
                {"S"}
              </span>
              <span style={{textAlign: "center"}}>
                {"D"}
              </span>
              {(v.slots || []).map((s: any, i_s: number) => (
                <Fragment key={i_s}>
                  <span>
                    {s.label}
                  </span>
                  {(s.cells || []).map((c: any, i_c: number) => (
                    <Fragment key={i_c}>
                      <span title={c.t} style={{height: "30px", borderRadius: "6px", background: c.bg}}></span>
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </div>
            <span style={{fontSize: "15px", fontWeight: "600"}}>
              {"Le matin, 78% de r\u00e9ussite. Le soir, 54%."}
            </span>
          </section>
        </div>
        <div style={{display: "flex", gap: "20px", alignItems: "flex-start"}}>
          <section aria-label="Par mati\u00e8re" style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", padding: "14px 16px", borderRadius: "18px", background: "#FFFFFF"}}>
            <div style={{display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr) repeat(4, minmax(0, 1fr))", gap: "16px", padding: "12px", fontSize: "14px", color: "#6B6F76"}}>
              <span>
                {"Mati\u00e8re"}
              </span>
              <span>
                {"Ma\u00eetrise"}
              </span>
              <span>
                {"QCM"}
              </span>
              <span>
                {"Temps"}
              </span>
              <span>
                {"En retard"}
              </span>
              <span>
                {"Partiel blanc"}
              </span>
            </div>
            {(v.subjects || []).map((s: any, i_s: number) => (
              <Fragment key={i_s}>
                <div style={{display: "flex", flexDirection: "column", borderTop: "1px solid #F1EEE7"}}>
                  <button type="button" className="mr-row" onClick={s.toggle} aria-expanded={s.expanded} style={{font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr) repeat(4, minmax(0, 1fr))", gap: "16px", alignItems: "center", padding: "15px 12px", border: "0", borderRadius: "10px", background: "transparent", fontSize: "16px"}}>
                    <span style={{display: "flex", alignItems: "center", gap: "10px", fontWeight: "600"}}>
                      <span style={{width: "10px", height: "10px", borderRadius: "50%", background: s.color}}></span>
                      {s.name}
                    </span>
                    <span style={{display: "flex", alignItems: "center", gap: "10px"}}>
                      <span style={{flex: "1", height: "7px", borderRadius: "4px", background: "#F1EEE7", overflow: "hidden"}}>
                        <span style={{display: "block", height: "7px", width: s.mastery, background: s.color}}></span>
                      </span>
                      <span style={{width: "40px", fontWeight: "600"}}>
                        {s.mastery}
                      </span>
                    </span>
                    <span>
                      {s.qcm}
                    </span>
                    <span>
                      {s.time}
                    </span>
                    <span style={{color: s.lateColor}}>
                      {s.late}
                    </span>
                    <span style={{fontWeight: "600", color: s.simColor}}>
                      {s.sim}
                    </span>
                  </button>
                  {s.open ? (
                    <>
                      <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", padding: "4px 12px 18px"}}>
                        {(s.weak || []).map((w: any, i_w: number) => (
                          <Fragment key={i_w}>
                            <Link href="/v2/matieres" style={{display: "flex", flexDirection: "column", gap: "4px", padding: "14px 16px", borderRadius: "12px", background: "#FAF8F4", textDecoration: "none", color: "inherit"}}>
                              <span style={{fontSize: "15px", fontWeight: "600"}}>
                                {w.title}
                              </span>
                              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                                {w.info}
                              </span>
                            </Link>
                          </Fragment>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </Fragment>
            ))}
          </section>
          <section aria-label="Charge \u00e0 venir" style={{flex: "0 0 420px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "18px", padding: "26px 28px", borderRadius: "18px", background: "#FFFFFF"}}>
            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
              <span style={{fontSize: "18px", fontWeight: "700"}}>
                {"Les 14 prochains jours"}
              </span>
              <span style={{fontSize: "14px", color: "#6B6F76"}}>
                {"Fiches pr\u00e9vues par jour"}
              </span>
            </span>
            <div style={{display: "flex", alignItems: "flex-end", gap: "6px", height: "140px"}}>
              {(v.load || []).map((l: any, i_l: number) => (
                <Fragment key={i_l}>
                  <span title={l.t} style={{flex: "1", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "4px"}}>
                    <span style={{fontSize: "12px", fontWeight: "600", color: "#6B6F76"}}>
                      {l.n}
                    </span>
                    <span style={{width: "100%", height: l.h, borderRadius: "4px 4px 0 0", background: l.bg}}></span>
                  </span>
                </Fragment>
              ))}
            </div>
            <div style={{display: "flex", gap: "6px"}}>
              {(v.load || []).map((l: any, i_l: number) => (
                <Fragment key={i_l}>
                  <span style={{flex: "1", textAlign: "center", fontSize: "12px", color: "#9AA0A8"}}>
                    {l.d}
                  </span>
                </Fragment>
              ))}
            </div>
            <span style={{fontSize: "15px", fontWeight: "600"}}>
              {"Mardi prochain est charg\u00e9, 9 fiches."}
            </span>
          </section>
        </div>
      </main>
    </div>
    </>
  )
}
