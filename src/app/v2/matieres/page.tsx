// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Link from 'next/link'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {}

const CSS = "\n\na{color:#1E3354}a:hover{color:#0F1E36}\n.mr-row{transition:background .12s ease}\n.mr-row:hover{background:#F1EEE7}\n.mr-ghost:hover{background:#F1EEE7}\n.mr-btn:hover{filter:brightness(.88)}\n.mr-act:hover{background:#EAE5DB}\n.mr-card{transition:box-shadow .15s ease}\n.mr-card:hover{box-shadow:0 2px 4px rgba(26,29,35,.06),0 10px 24px rgba(26,29,35,.08) !important}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: 'nerfs' };
  }
  renderVals() {
    const scale = ['#ECE8E0', '#D98C7E', '#E2AE6A', '#D8C46A', '#93BC80', '#4E9A6B'];
    const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120].map((n) => n ? 'J+' + n : 'J0');
    const dates = ['12 sept.', '13 sept.', '15 sept.', '17 sept.', '19 sept.', '27 sept.', '3 oct.', '12 oct.', '27 oct.', '11 nov.', '26 nov.', '11 déc.', '26 déc.', '10 janv.'];
    const F = {
      cerveau: ['Cerveau, vascularisation', 'Anatomie spécifique', '#4F7CC9', [3, 4, 4, 5], 'Bien', '44 j de retard', true, 30, 24, '74%', '1 h 05', 'anatomie-cerveau.pdf', '38 pages'],
      nerfs: ['Nerfs crâniens', 'Anatomie spécifique', '#4F7CC9', [2, 3, 3], 'Moyen', '44 j de retard', true, 30, 18, '52%', '48 min', 'poly-nerfs-craniens.pdf', '46 pages'],
      tronc: ['Tronc cérébral', 'Anatomie spécifique', '#4F7CC9', [3, 4], 'Moyen', '42 j de retard', true, 20, 12, '55%', '31 min', 'poly-tronc.pdf', '22 pages'],
      membre: ['Membre supérieur', 'Anatomie spécifique', '#4F7CC9', [4, 4, 5, 5, 5], 'Maîtrisée', 'dans 12 j', false, 30, 26, '88%', '1 h 20', 'poly-anatomie.pdf', '46 pages'],
      pa: ['Potentiel d’action', 'Physiologie', '#8B6BB8', [3, 4, 3], 'Moyen', '36 j de retard', true, 25, 20, '71%', '52 min', 'physio-neurone.pdf', '30 pages'],
      rein: ['Fonction rénale', 'Physiologie', '#8B6BB8', [4, 5, 5, 5], 'Maîtrisée', 'dans 20 j', false, 25, 16, '84%', '1 h 10', 'physio-rein.pdf', '41 pages'],
      pk: ['Pharmacocinétique', 'Pharmacologie', '#D08A3E', [2, 3], 'Faible', '44 j de retard', true, 20, 14, '45%', '29 min', 'pharmaco-pk.pdf', '28 pages'],
      recep: ['Récepteurs et ligands', 'Pharmacologie', '#D08A3E', [3, 4, 4], 'Bien', 'aujourd’hui', false, 20, 10, '71%', '36 min', 'pharmaco-recepteurs.pdf', '19 pages'],
      optique: ['Optique géométrique', 'Biophysique', '#C4554D', [1, 3], 'Faible', '41 j de retard', true, 15, 12, '38%', '25 min', 'biophy-optique.pdf', '24 pages'],
      thermo: ['Thermodynamique', 'Biophysique', '#C4554D', [3, 4, 5, 5], 'Maîtrisée', 'dans 6 j', false, 15, 10, '80%', '44 min', 'biophy-thermo.pdf', '32 pages']
    };
    const order = [['Anatomie spécifique', '#4F7CC9', ['cerveau', 'nerfs', 'tronc', 'membre']], ['Physiologie', '#8B6BB8', ['pa', 'rein']], ['Pharmacologie', '#D08A3E', ['pk', 'recep']], ['Biophysique', '#C4554D', ['optique', 'thermo']]];
    const cur = this.state.sel;
    const groups = order.map(([name, color, ids]) => ({
      name, color, count: ids.length,
      fiches: ids.map((id) => {
        const f = F[id];
        const dots = [];
        for (let i = 0; i < 14; i++) dots.push({ bg: scale[f[3][i] || 0] });
        const chip = { 'Maîtrisée': ['#E5F0E7', '#2F6B45'], 'Bien': ['#E7EEF7', '#2F5D8A'], 'Moyen': ['#F6EEDC', '#8A6420'], 'Faible': ['#F7E4E0', '#A0443A'] }[f[4]];
        return {
          title: f[0], dots, qcm: f[9], time: f[10], level: f[4], next: f[5], nextColor: f[6] ? '#9A5A1F' : '#6B6F76',
          chipBg: chip[0], chipColor: chip[1], doneLabel: f[3].length + ' révisions sur 14', border: id === cur ? '#15304E' : 'transparent', pressed: id === cur ? 'true' : 'false',
          select: () => this.setState({ sel: id })
        };
      })
    }));
    let sel = null;
    if (cur && F[cur]) {
      const f = F[cur];
      const notes = f[3];
      const steps = J.map((j, i) => {
        const n = notes[i];
        const isNext = i === notes.length;
        return {
          j, note: n ? String(n) : '',
          date: n ? dates[i] : (isNext ? (f[6] ? 'en retard' : f[5]) : ''),
          bg: n ? scale[n] : (isNext ? '#FFFFFF' : '#F4F1EA'),
          color: n ? '#1A1D23' : '#9AA0A8',
          border: isNext ? '2px dashed #1E3354' : '0'
        };
      });
      const avg = (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1).replace('.', ',');
      sel = {
        title: f[0], subject: f[1], color: f[2], level: f[4], next: f[5], nextColor: f[6] ? '#9A5A1F' : '#6B6F76',
        nextShort: f[6] ? 'en retard' : f[5], steps, qcm: f[7] + ' questions', flash: f[8] + ' cartes',
        qcmPct: f[9], time: f[10], avg: avg + '/5',
        sources: [{ kind: 'PDF', name: f[11], meta: f[12] }, { kind: 'VID', name: 'Amphi, ' + f[0].toLowerCase(), meta: '1 h 12, transcrite' }]
      };
    }
    return { groups, sel: sel || {}, hasSel: !!sel, close: () => this.setState({ sel: null }) };
  }
}

export default function Page() {
  const v = useDC(Logic, DEFAULTS)
  return (
    <>
      <style>{CSS}</style>
    <div style={{fontFamily: "'Hanken Grotesk', system-ui, sans-serif", color: "#1A1D23", background: "#FAF8F4", minHeight: "1080px", display: "flex", flexWrap: "wrap"}}>
      <div style={{flex: "0 0 240px", display: "flex"}}>
        <Sidebar active="5" />
      </div>
      <main style={{flex: "999 1 480px", minWidth: "0", boxSizing: "border-box", padding: "48px clamp(20px, 3vw, 48px) 56px"}}>
        <div style={{display: "flex", flexDirection: "column", gap: "36px"}}>
          <header style={{display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px"}}>
            <h1 style={{margin: "0", fontSize: "34px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {"Toutes les mati\u00e8res"}
            </h1>
            <div style={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px"}}>
              <button type="button" className="mr-ghost" aria-label="Filtrer" style={{font: "inherit", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", color: "#3D424A", background: "transparent", border: "0", borderRadius: "10px", cursor: "pointer"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
              </button>
              <button type="button" className="mr-btn" style={{font: "inherit", fontSize: "15px", fontWeight: "600", color: "#FFFFFF", background: "#1E3354", border: "0", padding: "10px 18px", borderRadius: "10px", cursor: "pointer"}}>
                {"Nouvelle fiche"}
              </button>
            </div>
          </header>
          <div style={{display: "flex", flexDirection: "column", gap: "40px"}}>
            {(v.groups || []).map((g: any, i_g: number) => (
              <Fragment key={i_g}>
                <section aria-label={g.name} style={{display: "flex", flexDirection: "column", gap: "14px"}}>
                  <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                    <span style={{width: "10px", height: "10px", borderRadius: "50%", background: g.color}}></span>
                    <span style={{fontSize: "18px", fontWeight: "700"}}>
                      {g.name}
                    </span>
                    <span style={{fontSize: "15px", color: "#6B6F76"}}>
                      {g.count}{" fiches"}
                    </span>
                  </div>
                  <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px"}}>
                    {(g.fiches || []).map((f: any, i_f: number) => (
                      <Fragment key={i_f}>
                        <button type="button" className="mr-card" onClick={f.select} aria-pressed={f.pressed} style={{font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "14px", padding: "20px", borderRadius: "14px", background: "#FFFFFF", border: `2px solid ${f.border}`, boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
                          <span style={{fontSize: "17px", fontWeight: "700", lineHeight: "1.3"}}>
                            {f.title}
                          </span>
                          <span style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
                            <span style={{fontSize: "13px", fontWeight: "600", color: f.chipColor, background: f.chipBg, padding: "4px 10px", borderRadius: "999px"}}>
                              {f.level}
                            </span>
                            <span style={{fontSize: "14px", color: f.nextColor}}>
                              {f.next}
                            </span>
                          </span>
                          <span aria-label={f.doneLabel} style={{display: "flex", gap: "3px"}}>
                            {(f.dots || []).map((d: any, i_d: number) => (
                              <Fragment key={i_d}>
                                <span style={{flex: "1", height: "6px", borderRadius: "3px", background: d.bg}}></span>
                              </Fragment>
                            ))}
                          </span>
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </section>
              </Fragment>
            ))}
          </div>
        </div>
      </main>
      {v.hasSel ? (
        <>
          <aside aria-label="D\u00e9tail de la fiche" style={{flex: "0 0 500px", boxSizing: "border-box", background: "#FFFFFF", borderLeft: "1px solid #EDE9E1", padding: "40px 36px 48px", display: "flex", flexDirection: "column", gap: "30px"}}>
            <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px"}}>
              <div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
                <span style={{display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6B6F76"}}>
                  <span style={{width: "8px", height: "8px", borderRadius: "50%", background: v.sel.color}}></span>
                  {v.sel.subject}{" "}
                </span>
                <span style={{fontSize: "24px", fontWeight: "700", letterSpacing: "-.01em", lineHeight: "1.2"}}>
                  {v.sel.title}
                </span>
                <span style={{fontSize: "14px", color: v.sel.nextColor}}>
                  {v.sel.level}{", "}{v.sel.next}
                </span>
              </div>
              <button type="button" className="mr-ghost" onClick={v.close} aria-label="Fermer" hidden style={{font: "inherit", width: "36px", height: "36px", flex: "none", border: "0", borderRadius: "10px", background: "transparent", color: "#3D424A", cursor: "pointer"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px"}}>
              <Link href="/v2/session" className="mr-btn" style={{display: "flex", flexDirection: "column", gap: "2px", padding: "12px", borderRadius: "12px", background: "#1E3354", color: "#FFFFFF", textDecoration: "none"}}>
                <span style={{fontSize: "14px", fontWeight: "600"}}>
                  {"R\u00e9viser"}
                </span>
                <span style={{fontSize: "12px", opacity: ".75"}}>
                  {v.sel.nextShort}
                </span>
              </Link>
              <Link href="/v2/session" className="mr-act" style={{display: "flex", flexDirection: "column", gap: "2px", padding: "12px", borderRadius: "12px", background: "#F1EEE7", color: "#1A1D23", textDecoration: "none"}}>
                <span style={{fontSize: "14px", fontWeight: "600"}}>
                  {"QCM"}
                </span>
                <span style={{fontSize: "12px", color: "#6B6F76"}}>
                  {v.sel.qcm}
                </span>
              </Link>
              <Link href="/v2/session" className="mr-act" style={{display: "flex", flexDirection: "column", gap: "2px", padding: "12px", borderRadius: "12px", background: "#F1EEE7", color: "#1A1D23", textDecoration: "none"}}>
                <span style={{fontSize: "14px", fontWeight: "600"}}>
                  {"Flashcards"}
                </span>
                <span style={{fontSize: "12px", color: "#6B6F76"}}>
                  {v.sel.flash}
                </span>
              </Link>
            </div>
            <section aria-label="Historique des r\u00e9visions" style={{display: "flex", flexDirection: "column", gap: "14px"}}>
              <span style={{fontSize: "13px", fontWeight: "600", color: "#6B6F76"}}>
                {"R\u00e9visions"}
              </span>
              <ol style={{listStyle: "none", margin: "0", padding: "0", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "16px 4px"}}>
                {(v.sel.steps || []).map((s: any, i_s: number) => (
                  <Fragment key={i_s}>
                    <li style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"}}>
                      <span style={{width: "34px", height: "34px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", background: s.bg, color: s.color, border: s.border, boxSizing: "border-box"}}>
                        {s.note}
                      </span>
                      <span style={{fontSize: "12px", fontWeight: "600"}}>
                        {s.j}
                      </span>
                      <span style={{fontSize: "11px", color: "#6B6F76"}}>
                        {s.date}
                      </span>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </section>
            <section aria-label="Chiffres" style={{display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px"}}>
              <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <span style={{fontSize: "20px", fontWeight: "700"}}>
                  {v.sel.qcmPct}
                </span>
                <span style={{fontSize: "12px", color: "#6B6F76"}}>
                  {"r\u00e9ussite QCM"}
                </span>
              </div>
              <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <span style={{fontSize: "20px", fontWeight: "700"}}>
                  {v.sel.time}
                </span>
                <span style={{fontSize: "12px", color: "#6B6F76"}}>
                  {"temps pass\u00e9"}
                </span>
              </div>
              <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                <span style={{fontSize: "20px", fontWeight: "700"}}>
                  {v.sel.avg}
                </span>
                <span style={{fontSize: "12px", color: "#6B6F76"}}>
                  {"note moyenne"}
                </span>
              </div>
            </section>
            <section aria-label="Sources" style={{display: "flex", flexDirection: "column", gap: "6px"}}>
              <span style={{fontSize: "13px", fontWeight: "600", color: "#6B6F76", paddingBottom: "4px"}}>
                {"Sources"}
              </span>
              {(v.sel.sources || []).map((src: any, i_src: number) => (
                <Fragment key={i_src}>
                  <a href="#" className="mr-row" style={{display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "10px", textDecoration: "none", color: "#1A1D23"}}>
                    <span aria-hidden="true" style={{width: "34px", height: "34px", borderRadius: "8px", background: "#F1EEE7", color: "#1E3354", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700"}}>
                      {src.kind}
                    </span>
                    <span style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "1px"}}>
                      <span style={{fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                        {src.name}
                      </span>
                      <span style={{fontSize: "12px", color: "#6B6F76"}}>
                        {src.meta}
                      </span>
                    </span>
                  </a>
                </Fragment>
              ))}
              <button type="button" className="mr-ghost" style={{font: "inherit", display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "10px", border: "1px dashed #D9D3C7", background: "transparent", color: "#1E3354", fontSize: "14px", fontWeight: "600", cursor: "pointer", textAlign: "left", marginTop: "4px"}}>
                <span aria-hidden="true" style={{width: "34px", textAlign: "center", fontSize: "18px"}}>
                  {"+"}
                </span>
                {"Ajouter un poly ou une vid\u00e9o "}
              </button>
            </section>
          </aside>
        </>
      ) : null}
    </div>
    </>
  )
}
