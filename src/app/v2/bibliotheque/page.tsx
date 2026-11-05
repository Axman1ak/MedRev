// @ts-nocheck
'use client'
import { Fragment } from 'react'
import { DCLogic, useDC } from '@/app/v2/_ui/dc'
import Sidebar from '@/app/v2/_ui/Sidebar'

const DEFAULTS = {"onglet": "collection"}

const CSS = "\n\na{color:#15304E}\n.mr-tab:hover{color:#1A1D23}\n.mr-btn{transition:transform .15s ease, filter .15s ease}\n.mr-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}\n.mr-btn:active{transform:scale(.96)}\n.mr-lift{transition:transform .2s ease, box-shadow .2s ease}\n.mr-lift:hover{transform:translateY(-3px);box-shadow:0 2px 4px rgba(26,29,35,.06),0 14px 30px rgba(26,29,35,.09) !important}\n.mr-book{transition:transform .15s ease}\n.mr-book:hover{transform:translateY(-6px)}\n@keyframes mr-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n@keyframes mr-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}\n@keyframes mr-fill{from{width:0}}\n@keyframes mr-pop{0%{transform:scale(.9)}50%{transform:scale(1.08)}100%{transform:scale(1)}}\n@keyframes mr-flicker{0%,100%{transform:scale(1,1) rotate(-2deg)}50%{transform:scale(1.05,.95) rotate(2deg)}}\n@keyframes mr-count{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}\n.mr-rise{animation:mr-up .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-grow{transform-origin:bottom;animation:mr-grow .5s cubic-bezier(.2,.8,.2,1) both}\n.mr-bar{animation:mr-fill 1.2s cubic-bezier(.2,.8,.2,1) .3s both}\n.mr-bought{animation:mr-pop .45s ease both}\n.mr-fl path{transform-origin:50% 100%;animation:mr-flicker 1.8s ease-in-out infinite}\n.mr-bump{animation:mr-count .45s ease both}\n"

class Logic extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { tab: null, owned: { gel: true, orange: true, creme: true }, active: { flame: 'orange', theme: 'creme' }, spent: 0, last: null };
  }
  renderVals() {
    const st = this.state;
    const tab = st.tab ?? (this.props.onglet === 'boutique' ? 1 : 0);
    const tabs = ['Ma collection', 'Boutique'].map((label, i) => ({
      label, go: () => this.setState({ tab: i }), current: tab === i ? 'page' : 'false',
      weight: tab === i ? 700 : 500, color: tab === i ? '#1A1D23' : '#6B6F76', line: tab === i ? '#15304E' : 'transparent'
    }));
    const RN = ['Novice', 'Apprenti', 'Studieux', 'Lettré', 'Érudit', 'Sage'];
    const ranks = RN.map((name, i) => ({
      name, mark: i < 3 ? '✓' : String(i + 1),
      bg: i < 3 ? 'rgba(255,255,255,.16)' : (i === 3 ? '#F4C35A' : 'transparent'), fg: i === 3 ? '#15304E' : '#FFFFFF',
      border: i > 3 ? '2px solid rgba(255,255,255,.25)' : '0', weight: i === 3 ? 700 : 500, color: i === 3 ? '#FFFFFF' : 'rgba(255,255,255,.6)'
    }));
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.round(c + (255 - c) * k); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; };
    const subs = [['Anatomie spécifique', '#4F7CC9', 120], ['Physiologie', '#8B6BB8', 64], ['Santé, Société, Humanité', '#3E8E85', 48], ['Biophysique', '#C4554D', 35], ['Pharmacologie', '#D08A3E', 30], ['Biostatistiques', '#9C7148', 20]];
    const shelves = subs.map(([name, color, count], si) => {
      const books = [];
      for (let i = 0; i < Math.min(count, 70); i++) {
        const r = Math.abs(Math.sin((i + 1) * 12.9898 + si * 78.233)) % 1;
        books.push({ w: (7 + Math.round(r * 5)) + 'px', h: (44 + Math.round(((r * 7) % 1) * 24)) + 'px', bg: shade(color, 0.05 + ((r * 13) % 1) * 0.35), label: name, delay: (0.2 + si * 0.08 + i * 0.008).toFixed(3) + 's' });
      }
      return { name, color, count, books, delay: (si * 0.06) + 's' };
    });
    const balance = 240 - st.spent;
    const G = [
      { title: 'Protections', sub: 'Pour garder ta flamme allumée', items: [['gel', 'Gel de flamme', 'Protège ta flamme un jour sans session', 50, 'icon', '❄', '#4F7CC9', '#EEF3FA', true]] },
      { title: 'Flammes', sub: 'La couleur de ta flamme sur le parcours', items: [['orange', 'Classique', 'Ta flamme de départ', 0, 'flame', '#F49A2E', '', '#FDF3DC'], ['bleue', 'Bleu glacier', '', 120, 'flame', '#5B9BE0', '', '#EEF3FA'], ['verte', 'Émeraude', '', 120, 'flame', '#3FA37A', '', '#EAF5EF'], ['violette', 'Améthyste', '', 150, 'flame', '#8B6BB8', '', '#F2EEF8']] },
      { title: 'Thèmes', sub: 'Les couleurs de toute l’application', items: [['creme', 'Crème', 'Le thème de base', 0, 'theme', ['#FAF8F4', '#15304E', '#F49A2E'], '', '#F1EEE7'], ['nuit', 'Nuit', 'Pour réviser le soir', 200, 'theme', ['#0F1A2A', '#22344F', '#F4C35A'], '', '#1A2638'], ['sauge', 'Sauge', '', 200, 'theme', ['#F3F6F1', '#2F5A47', '#E2A04A'], '', '#E6EDE4'], ['lavande', 'Lavande', '', 200, 'theme', ['#F6F4FA', '#3B3366', '#E58FA0'], '', '#ECE8F5']] }
    ];
    let k = 0;
    const shop = G.map((g) => ({
      title: g.title, sub: g.sub,
      items: g.items.map(([id, name, desc, price, kind, a, b, previewBg, consumable]) => {
        const owned = !!st.owned[id];
        const group = kind === 'flame' ? 'flame' : (kind === 'theme' ? 'theme' : null);
        const active = group && st.active[group] === id;
        const afford = balance >= price;
        let btn, btnBg, btnFg, cursor = 'pointer', buy;
        if (consumable) {
          btn = price + ' ◆'; btnBg = afford ? '#15304E' : '#ECE8E0'; btnFg = afford ? '#FFFFFF' : '#9AA0A8';
          buy = () => afford && this.setState({ spent: st.spent + price, owned: { ...st.owned, [id]: true }, last: id });
        } else if (active) { btn = 'Utilisé'; btnBg = '#E8F1EA'; btnFg = '#2F6B45'; cursor = 'default'; buy = () => {}; }
        else if (owned) { btn = 'Utiliser'; btnBg = '#F1EEE7'; btnFg = '#15304E'; buy = () => this.setState({ active: { ...st.active, [group]: id }, last: id }); }
        else { btn = price + ' ◆'; btnBg = afford ? '#15304E' : '#ECE8E0'; btnFg = afford ? '#FFFFFF' : '#9AA0A8'; buy = () => afford && this.setState({ spent: st.spent + price, owned: { ...st.owned, [id]: true }, active: { ...st.active, [group]: id }, last: id }); }
        return {
          name, desc: consumable && owned ? desc + '. 1 en réserve' : desc, previewBg, btn, btnBg, btnFg, cursor, buy,
          border: active ? '#15304E' : 'transparent', anim: st.last === id ? 'mr-bought' : '', delay: (k++ * 0.05) + 's',
          isFlame: kind === 'flame', isTheme: kind === 'theme', isIcon: kind === 'icon',
          flame: kind === 'flame' ? a : '', swatches: kind === 'theme' ? a.map((c) => ({ c })) : [], icon: kind === 'icon' ? a : '', iconColor: b
        };
      })
    }));
    return { tabs, ranks, shelves, shop, isCollection: tab === 0, isShop: tab === 1, balance: String(balance), balanceAnim: st.spent ? 'mr-bump' : '' };
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
      <main style={{flex: "1", minWidth: "0", boxSizing: "border-box", padding: "44px 56px 64px", display: "flex", flexDirection: "column", gap: "28px"}}>
        <header style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", borderBottom: "1px solid #EDE9E1"}}>
          <div style={{display: "flex", flexDirection: "column", gap: "22px"}}>
            <h1 style={{margin: "0", fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
              {"Biblioth\u00e8que"}
            </h1>
            <nav aria-label={"Sections"} style={{display: "flex", gap: "36px"}}>
              {(v.tabs || []).map((t: any, i_t: number) => (
                <Fragment key={i_t}>
                  <button type={"button"} className={"mr-tab"} onClick={t.go} aria-current={t.current} style={{font: "inherit", fontSize: "17px", fontWeight: t.weight, color: t.color, background: "transparent", border: "0", borderBottom: `3px solid ${t.line}`, padding: "0 0 14px", marginBottom: "-1px", cursor: "pointer"}}>
                    {t.label}
                  </button>
                </Fragment>
              ))}
            </nav>
          </div>
          <span style={{display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px", marginBottom: "14px", borderRadius: "14px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)"}}>
            <span style={{width: "34px", height: "34px", borderRadius: "10px", background: "#FDF3DC", color: "#C98A12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px"}}>
              {"\u25c6"}
            </span>
            <span className={v.balanceAnim} style={{fontSize: "22px", fontWeight: "700", display: "inline-block"}}>
              {v.balance}
              <span style={{fontSize: "15px", fontWeight: "500", color: "#6B6F76"}}>
                {" \u00e9clats"}
              </span>
            </span>
          </span>
        </header>
        {v.isCollection ? (
          <>
            <div style={{display: "flex", flexDirection: "column", gap: "24px"}}>
              <section aria-label={"Ton rang"} className={"mr-rise"} style={{display: "flex", alignItems: "center", gap: "40px", padding: "30px 36px", borderRadius: "20px", background: "#15304E", color: "#FFFFFF"}}>
                <span style={{display: "flex", flexDirection: "column", gap: "6px", minWidth: "260px"}}>
                  <span style={{fontSize: "15px", color: "rgba(255,255,255,.65)"}}>
                    {"Ton rang"}
                  </span>
                  <span style={{fontSize: "36px", fontWeight: "700", letterSpacing: "-.02em"}}>
                    {"Lettr\u00e9"}
                  </span>
                  <span style={{fontSize: "15px", color: "rgba(255,255,255,.75)"}}>
                    {"317 livres, encore 183 pour devenir \u00c9rudit"}
                  </span>
                </span>
                <div style={{flex: "1", display: "flex", flexDirection: "column", gap: "16px"}}>
                  <span style={{height: "10px", borderRadius: "5px", background: "rgba(255,255,255,.14)", overflow: "hidden"}}>
                    <span className={"mr-bar"} style={{display: "block", height: "10px", width: "63%", borderRadius: "5px", background: "#F4C35A"}}></span>
                  </span>
                  <div style={{display: "flex", justifyContent: "space-between"}}>
                    {(v.ranks || []).map((r: any, i_r: number) => (
                      <Fragment key={i_r}>
                        <span style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "8px"}}>
                          <span style={{width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: r.bg, color: r.fg, border: r.border, boxSizing: "border-box", fontSize: "15px", fontWeight: "700"}}>
                            {r.mark}
                          </span>
                          <span style={{fontSize: "14px", fontWeight: r.weight, color: r.color}}>
                            {r.name}
                          </span>
                        </span>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </section>
              <span style={{fontSize: "16px", color: "#6B6F76"}}>
                {"Chaque fiche not\u00e9e 4 ou 5 ajoute un livre \u00e0 l'\u00e9tag\u00e8re de sa mati\u00e8re."}
              </span>
              <div style={{display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "20px"}}>
                {(v.shelves || []).map((s: any, i_s: number) => (
                  <Fragment key={i_s}>
                    <section className={"mr-rise mr-lift"} style={{display: "flex", flexDirection: "column", gap: "16px", padding: "24px 26px 22px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", animationDelay: s.delay}}>
                      <span style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                        <span style={{display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", fontWeight: "700"}}>
                          <span style={{width: "10px", height: "10px", borderRadius: "50%", background: s.color}}></span>
                          {s.name}
                        </span>
                        <span style={{fontSize: "15px", color: "#6B6F76"}}>
                          {s.count}{" livres"}
                        </span>
                      </span>
                      <div style={{display: "flex", alignItems: "flex-end", gap: "3px", height: "72px", overflow: "hidden", borderBottom: "3px solid #ECE7DD", padding: "0 2px"}}>
                        {(s.books || []).map((b: any, i_b: number) => (
                          <Fragment key={i_b}>
                            <span className={"mr-book mr-grow"} title={b.label} style={{flex: "none", width: b.w, height: b.h, borderRadius: "3px 3px 0 0", background: b.bg, animationDelay: b.delay}}></span>
                          </Fragment>
                        ))}
                      </div>
                    </section>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        ) : null}
        {v.isShop ? (
          <>
            <div style={{display: "flex", flexDirection: "column", gap: "32px"}}>
              {(v.shop || []).map((g: any, i_g: number) => (
                <Fragment key={i_g}>
                  <section style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                    <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
                      <span style={{fontSize: "20px", fontWeight: "700"}}>
                        {g.title}
                      </span>
                      <span style={{fontSize: "15px", color: "#6B6F76"}}>
                        {g.sub}
                      </span>
                    </span>
                    <div style={{display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "18px"}}>
                      {(g.items || []).map((it: any, i_it: number) => (
                        <Fragment key={i_it}>
                          <div className={`mr-rise mr-lift ${it.anim}`} style={{display: "flex", flexDirection: "column", gap: "16px", padding: "22px", borderRadius: "18px", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(26,29,35,.05)", border: `2px solid ${it.border}`, animationDelay: it.delay}}>
                            <div style={{height: "110px", borderRadius: "14px", background: it.previewBg, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"}}>
                              {it.isFlame ? (
                                <>
                                  <svg className={"mr-fl"} width={"54"} height={"62"} viewBox={"0 0 120 140"} aria-hidden={"true"}>
                                    <path fill={it.flame} d={"M60 4C66 30 98 44 98 88a38 38 0 0 1-76 0c0-20 10-32 18-42 1 12 7 20 14 22-2-22 0-44 6-64z"} />
                                  </svg>
                                </>
                              ) : null}
                              {it.isTheme ? (
                                <>
                                  {(it.swatches || []).map((w: any, i_w: number) => (
                                    <Fragment key={i_w}>
                                      <span style={{width: "34px", height: "34px", borderRadius: "10px", background: w.c, boxShadow: "0 0 0 2px rgba(255,255,255,.7)"}}></span>
                                    </Fragment>
                                  ))}
                                </>
                              ) : null}
                              {it.isIcon ? (
                                <>
                                  <span style={{fontSize: "44px", lineHeight: "1", color: it.iconColor}}>
                                    {it.icon}
                                  </span>
                                </>
                              ) : null}
                            </div>
                            <span style={{display: "flex", flexDirection: "column", gap: "4px"}}>
                              <span style={{fontSize: "17px", fontWeight: "700"}}>
                                {it.name}
                              </span>
                              <span style={{fontSize: "14px", color: "#6B6F76", minHeight: "20px"}}>
                                {it.desc}
                              </span>
                            </span>
                            <button type={"button"} className={"mr-btn"} onClick={it.buy} style={{font: "inherit", fontSize: "15px", fontWeight: "700", color: it.btnFg, background: it.btnBg, border: "0", padding: "12px", borderRadius: "12px", cursor: it.cursor}}>
                              {it.btn}
                            </button>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </section>
                </Fragment>
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
    </>
  )
}
