// src/app/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');
        :root {
          --bg: #0b0f1a;
          --surface: #111827;
          --surface2: #1a2235;
          --border: rgba(255,255,255,0.07);
          --border2: rgba(255,255,255,0.12);
          --blue: #3b82f6;
          --blue-dim: rgba(59,130,246,0.15);
          --purple: #8b5cf6;
          --green: #10b981;
          --amber: #f59e0b;
          --text: #f1f5f9;
          --text-muted: #64748b;
          --text-dim: #94a3b8;
        }
        html { scroll-behavior: smooth; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--text);
          overflow-x: hidden;
          margin: 0; padding: 0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* NAV */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 60px;
          background: rgba(11,15,26,0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        .lp-nav-logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--text); text-decoration: none; line-height: 1; }
        .lp-nav-logo span { color: var(--blue); }
        .lp-nav-sub { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; display: block; }
        .lp-nav-links { display: flex; gap: 32px; }
        .lp-nav-links a { font-size: 14px; color: var(--text-dim); text-decoration: none; transition: color .2s; }
        .lp-nav-links a:hover { color: var(--text); }
        .lp-nav-cta { background: var(--blue); color: white; border: none; border-radius: 8px; padding: 10px 22px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; transition: background .2s, transform .1s; font-family: 'DM Sans', sans-serif; }
        .lp-nav-cta:hover { background: #2563eb; transform: translateY(-1px); }

        /* HERO */
        .lp-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 120px 40px 80px; position: relative; overflow: hidden; }
        .lp-hero-glow { position: absolute; width: 700px; height: 700px; background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 60%); top: 50%; left: 50%; transform: translate(-50%,-55%); pointer-events: none; }
        .lp-hero-glow2 { position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 60%); top: 60%; left: 65%; transform: translate(-50%,-50%); pointer-events: none; }
        .lp-hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 100px; padding: 7px 16px; margin-bottom: 28px; font-size: 13px; color: #93c5fd; font-family: 'DM Mono', monospace; }
        .lp-hero-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--blue); box-shadow: 0 0 8px rgba(59,130,246,0.8); animation: lp-pulse 2s infinite; }
        @keyframes lp-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .lp-hero h1 { font-family: 'Syne', sans-serif; font-size: clamp(42px, 6vw, 78px); font-weight: 800; line-height: 1.05; max-width: 820px; margin-bottom: 24px; }
        .lp-hero h1 em { color: var(--blue); font-style: normal; }
        .lp-hero-sub { font-size: 18px; color: var(--text-dim); max-width: 500px; line-height: 1.7; margin-bottom: 44px; font-weight: 300; }
        .lp-hero-actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; justify-content: center; margin-bottom: 60px; }
        .lp-btn-primary { background: var(--blue); color: white; border: none; border-radius: 10px; padding: 15px 32px; font-size: 16px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all .2s; font-family: 'DM Sans', sans-serif; display: inline-flex; align-items: center; gap: 8px; }
        .lp-btn-primary:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 8px 30px rgba(59,130,246,0.3); }
        .lp-btn-ghost { background: transparent; border: 1px solid var(--border2); color: var(--text-dim); border-radius: 10px; padding: 15px 28px; font-size: 15px; cursor: pointer; text-decoration: none; transition: all .2s; font-family: 'DM Sans', sans-serif; }
        .lp-btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: var(--text); }
        .lp-hero-stats { display: flex; gap: 48px; align-items: center; border-top: 1px solid var(--border); padding-top: 32px; width: 100%; max-width: 600px; justify-content: center; }
        .lp-stat-num { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: var(--text); display: block; }
        .lp-stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; font-family: 'DM Mono', monospace; letter-spacing: 1px; text-transform: uppercase; }

        /* BROWSER MOCK */
        .lp-browser { width: 100%; max-width: 900px; margin: 0 auto 60px; border-radius: 14px; border: 1px solid var(--border2); overflow: hidden; box-shadow: 0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05); animation: lp-float 4s ease-in-out infinite; }
        @keyframes lp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .lp-browser-bar { background: #1e2433; padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border); }
        .lp-browser-dots { display: flex; gap: 6px; }
        .lp-browser-dot { width: 12px; height: 12px; border-radius: 50%; }
        .lp-browser-url { flex: 1; background: #111827; border-radius: 6px; padding: 5px 12px; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-muted); }

        /* DASHBOARD MOCK */
        .lp-dash { background: var(--bg); display: flex; min-height: 380px; }
        .lp-sidebar { width: 170px; background: #0f1522; border-right: 1px solid var(--border); padding: 16px; flex-shrink: 0; }
        .lp-s-logo { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; }
        .lp-s-logo span { color: var(--blue); }
        .lp-s-sub { font-size: 9px; color: var(--text-muted); font-family: 'DM Mono', monospace; letter-spacing: 1.5px; }
        .lp-s-badge { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.25); border-radius: 6px; padding: 8px 10px; margin: 14px 0; font-size: 11px; color: #93c5fd; }
        .lp-s-navlabel { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; margin: 14px 0 8px; font-family: 'DM Mono', monospace; }
        .lp-s-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 2px; color: var(--text-dim); }
        .lp-s-item.active { background: rgba(59,130,246,0.15); color: var(--blue); }
        .lp-matieres { width: 160px; background: #111827; border-right: 1px solid var(--border); padding: 12px; flex-shrink: 0; }
        .lp-mat-title { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-family: 'DM Mono', monospace; }
        .lp-mat-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; font-size: 11px; margin-bottom: 2px; }
        .lp-mat-item.active { background: rgba(59,130,246,0.1); }
        .lp-mat-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
        .lp-mat-count { margin-left: auto; font-size: 10px; color: var(--text-muted); }
        .lp-main { flex: 1; padding: 20px; }
        .lp-main-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 14px; }
        .lp-main-title span { color: var(--blue); }
        .lp-search { background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 9px 14px; font-size: 11px; color: var(--text-muted); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .lp-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
        .lp-tab { padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid var(--border); color: var(--text-dim); }
        .lp-tab.active { background: var(--blue); color: white; border-color: transparent; }
        .lp-cards { display: flex; gap: 12px; flex-wrap: wrap; }
        .lp-card { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; padding: 16px; max-width: 260px; }
        .lp-card-title { font-size: 13px; font-weight: 600; margin-bottom: 12px; }
        .lp-fiche { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .lp-fiche-name { background: rgba(59,130,246,0.15); color: #93c5fd; border-radius: 5px; padding: 4px 10px; font-size: 11px; }
        .lp-score { background: #10b981; color: white; border-radius: 5px; padding: 4px 9px; font-size: 11px; font-weight: 600; }
        .lp-steps { display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 8px; }
        .lp-step { width: 22px; height: 22px; border-radius: 4px; background: var(--surface2); font-size: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
        .lp-step.done { background: rgba(16,185,129,0.2); color: var(--green); }
        .lp-step.today { background: rgba(59,130,246,0.25); color: var(--blue); border: 1px solid rgba(59,130,246,0.4); }
        .lp-date { font-size: 10px; color: var(--text-muted); }

        /* SECTIONS */
        .lp-section { padding: 100px 60px; max-width: 1200px; margin: 0 auto; }
        .lp-badge { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--blue); margin-bottom: 12px; display: block; }
        .lp-title { font-family: 'Syne', sans-serif; font-size: clamp(32px, 4vw, 52px); font-weight: 800; line-height: 1.1; margin-bottom: 20px; }
        .lp-title em { color: var(--blue); font-style: normal; }
        .lp-sub { font-size: 17px; color: var(--text-dim); max-width: 520px; line-height: 1.75; font-weight: 300; }

        /* FEATURES */
        .lp-feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; margin-top: 60px; }
        .lp-feat-grid.rev { direction: rtl; }
        .lp-feat-grid.rev > * { direction: ltr; }
        .lp-feat-tag { display: inline-block; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 100px; padding: 5px 14px; font-size: 12px; color: #93c5fd; font-family: 'DM Mono', monospace; margin-bottom: 20px; }
        .lp-feat-h3 { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
        .lp-feat-h3 em { color: var(--blue); font-style: normal; }
        .lp-feat-p { font-size: 16px; color: var(--text-dim); line-height: 1.75; font-weight: 300; margin-bottom: 24px; }
        .lp-feat-list { list-style: none; }
        .lp-feat-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text-dim); margin-bottom: 10px; line-height: 1.5; }
        .lp-feat-list li::before { content: '✓'; color: var(--green); font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .lp-mockup-wrap { border-radius: 14px; overflow: hidden; border: 1px solid var(--border2); box-shadow: 0 20px 80px rgba(0,0,0,0.5); }

        /* QCM MOCK */
        .lp-qcm { background: var(--bg); display: flex; min-height: 360px; }
        .lp-qcm-left { width: 190px; background: #0f1522; border-right: 1px solid var(--border); padding: 16px; flex-shrink: 0; }
        .lp-qcm-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; font-family: 'DM Mono', monospace; }
        .lp-qcm-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; }
        .lp-qcm-box { aspect-ratio: 1; border-radius: 6px; background: var(--surface2); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 7px; color: var(--text-muted); }
        .lp-qcm-box.today { background: rgba(59,130,246,0.25); color: var(--blue); border: 1px solid rgba(59,130,246,0.4); }
        .lp-qcm-right { flex: 1; padding: 20px; }
        .lp-qcm-header { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--amber); margin-bottom: 14px; }
        .lp-qcm-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
        .lp-qcm-tab { flex: 1; padding: 8px; border-radius: 6px; text-align: center; font-size: 11px; }
        .lp-qcm-tab.on { background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.35); color: #c4b5fd; }
        .lp-qcm-tab.off { background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); }
        .lp-qcm-textarea { background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 12px; font-size: 11px; color: var(--text-muted); min-height: 72px; margin-bottom: 10px; line-height: 1.6; }
        .lp-qcm-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
        .lp-qcm-sel { background: var(--surface); border: 1px solid var(--border2); border-radius: 6px; padding: 5px 10px; font-size: 10px; color: var(--text-dim); font-family: 'DM Mono', monospace; }
        .lp-qcm-btn { width: 100%; background: linear-gradient(135deg, #7c3aed, #8b5cf6); border: none; border-radius: 8px; padding: 10px; color: white; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: 'DM Sans', sans-serif; }
        .lp-qcm-q { background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 12px; margin-top: 10px; }
        .lp-qcm-qt { font-size: 12px; font-weight: 500; margin-bottom: 8px; }
        .lp-qcm-opt { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-bottom: 4px; border: 1px solid var(--border); }
        .lp-qcm-opt.ok { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #6ee7b7; }
        .lp-qcm-opt.no { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); color: #fca5a5; }
        .lp-radio { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid currentColor; flex-shrink: 0; }
        .lp-qcm-opt.ok .lp-radio { background: #10b981; border-color: #10b981; }
        .lp-qcm-opt.no .lp-radio { background: #ef4444; border-color: #ef4444; }

        /* CAL MOCK */
        .lp-cal { background: var(--bg); padding: 20px; }
        .lp-cal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .lp-cal-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; font-size: 11px; color: var(--text-dim); cursor: pointer; }
        .lp-cal-range { font-size: 13px; font-weight: 600; }
        .lp-cal-week { display: grid; grid-template-columns: repeat(7,1fr); gap: 6px; }
        .lp-cal-day { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 6px; min-height: 100px; }
        .lp-cal-day.today { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.05); }
        .lp-cal-dn { font-size: 8px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-family: 'DM Mono', monospace; }
        .lp-cal-num { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
        .lp-cal-day.today .lp-cal-num { color: var(--blue); }
        .lp-cal-ev { border-radius: 5px; padding: 4px 6px; font-size: 9px; margin-bottom: 3px; }
        .lp-cal-ev.planned { background: rgba(59,130,246,0.15); color: #93c5fd; }
        .lp-cal-ev.done { background: rgba(16,185,129,0.15); color: #6ee7b7; }
        .lp-cal-ev.up { background: rgba(139,92,246,0.15); color: #c4b5fd; }

        /* STEPS */
        .lp-steps { padding: 100px 60px; max-width: 1100px; margin: 0 auto; }
        .lp-steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 32px; margin-top: 60px; }
        .lp-step-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 32px; position: relative; }
        .lp-step-num { font-family: 'Syne', sans-serif; font-size: 56px; font-weight: 800; color: rgba(59,130,246,0.12); line-height: 1; margin-bottom: 14px; }
        .lp-step-icon { font-size: 28px; margin-bottom: 12px; display: block; }
        .lp-step-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 10px; }
        .lp-step-desc { font-size: 14px; color: var(--text-dim); line-height: 1.7; font-weight: 300; }
        .lp-step-arrow { position: absolute; right: -17px; top: 40px; width: 34px; height: 2px; background: var(--border2); z-index: 1; }
        .lp-step-arrow::after { content: ''; position: absolute; right: -4px; top: -3px; border: 4px solid transparent; border-left-color: var(--border2); }

        /* PRICING */
        .lp-pricing-section { padding: 100px 60px; background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .lp-pricing-inner { max-width: 1100px; margin: 0 auto; }
        .lp-pricing-header { text-align: center; margin-bottom: 60px; }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 800px; margin: 0 auto; }
        .lp-pc { background: var(--bg); border: 1px solid var(--border2); border-radius: 16px; padding: 36px; }
        .lp-pc.featured { border-color: rgba(59,130,246,0.4); }
        .lp-pc-badge { text-align: center; margin-bottom: -14px; position: relative; z-index: 1; }
        .lp-pc-badge span { display: inline-block; background: var(--amber); color: #451a03; border-radius: 100px; padding: 5px 16px; font-size: 12px; font-weight: 700; }
        .lp-pc-plan { font-size: 14px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1.5px; font-family: 'DM Mono', monospace; }
        .lp-pc-price { font-family: 'Syne', sans-serif; font-size: 52px; font-weight: 800; color: var(--text); line-height: 1; margin-bottom: 4px; }
        .lp-pc-price.free { color: var(--green); }
        .lp-pc-period { font-size: 13px; color: var(--text-muted); margin-bottom: 28px; }
        .lp-pc-div { border: none; border-top: 1px solid var(--border); margin-bottom: 24px; }
        .lp-pc-feat { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; margin-bottom: 12px; color: var(--text-dim); }
        .lp-pc-feat.on { color: var(--text); }
        .lp-pc-feat.off { opacity: .4; text-decoration: line-through; }
        .lp-pc-check { color: var(--green); font-weight: 700; flex-shrink: 0; }
        .lp-pc-cross { color: var(--text-muted); flex-shrink: 0; }
        .lp-pc-cta { width: 100%; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 500; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; margin-top: 28px; transition: all .2s; }
        .lp-pc-cta.free { background: var(--surface2); color: var(--text); border: 1px solid var(--border2); }
        .lp-pc-cta.prem { background: var(--blue); color: white; }
        .lp-pc-cta.prem:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(59,130,246,0.3); }

        /* AUTH */
        .lp-auth-section { padding: 100px 60px; display: flex; align-items: center; justify-content: center; }
        .lp-auth-container { display: grid; grid-template-columns: 1fr 1fr; gap: 0; max-width: 960px; width: 100%; background: var(--surface); border: 1px solid var(--border2); border-radius: 20px; overflow: hidden; }
        .lp-auth-left { padding: 60px 50px; background: linear-gradient(135deg, #0f1a35 0%, #111827 100%); display: flex; flex-direction: column; justify-content: space-between; }
        .lp-auth-lt { font-family: 'Syne', sans-serif; font-size: 34px; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
        .lp-auth-lt em { color: var(--blue); font-style: normal; }
        .lp-auth-lsub { font-size: 15px; color: var(--text-dim); line-height: 1.7; font-weight: 300; margin-bottom: 40px; }
        .lp-auth-testi { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
        .lp-auth-testi-text { font-size: 14px; color: var(--text-dim); font-style: italic; line-height: 1.6; margin-bottom: 12px; }
        .lp-auth-testi-author { font-size: 12px; color: var(--text-muted); font-family: 'DM Mono', monospace; }
        .lp-auth-stars { color: var(--amber); margin-bottom: 8px; font-size: 14px; }
        .lp-auth-right { padding: 60px 50px; }
        .lp-auth-tabs { display: flex; background: var(--bg); border-radius: 10px; padding: 4px; margin-bottom: 32px; }
        .lp-auth-tab { flex: 1; padding: 10px; text-align: center; border-radius: 7px; font-size: 14px; cursor: pointer; transition: all .2s; border: none; background: transparent; font-family: 'DM Sans', sans-serif; color: var(--text-muted); }
        .lp-auth-tab.active { background: var(--blue); color: white; font-weight: 500; }
        .lp-form-group { margin-bottom: 18px; }
        .lp-label { font-size: 13px; color: var(--text-dim); margin-bottom: 7px; display: block; }
        .lp-input { width: 100%; padding: 12px 14px; background: var(--bg); border: 1px solid var(--border2); border-radius: 9px; color: var(--text); font-size: 14px; font-family: 'DM Sans', sans-serif; transition: border-color .2s; outline: none; }
        .lp-input:focus { border-color: var(--blue); }
        .lp-input::placeholder { color: var(--text-muted); }
        .lp-auth-submit { width: 100%; padding: 14px; background: var(--blue); border: none; border-radius: 10px; color: white; font-size: 15px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .2s; margin-top: 8px; }
        .lp-auth-submit:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(59,130,246,0.3); }
        .lp-auth-div { text-align: center; font-size: 12px; color: var(--text-muted); margin: 18px 0; position: relative; }
        .lp-auth-div::before, .lp-auth-div::after { content: ''; position: absolute; top: 50%; width: 42%; height: 1px; background: var(--border); }
        .lp-auth-div::before { left: 0; }
        .lp-auth-div::after { right: 0; }
        .lp-auth-terms { font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 16px; line-height: 1.6; }
        .lp-auth-terms a { color: var(--blue); }

        /* FOOTER */
        .lp-footer { border-top: 1px solid var(--border); padding: 40px 60px; display: flex; align-items: center; justify-content: space-between; max-width: 1200px; margin: 0 auto; }
        .lp-footer-logo { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; }
        .lp-footer-logo span { color: var(--blue); }
        .lp-footer-copy { font-size: 13px; color: var(--text-muted); }
        .lp-footer-links { display: flex; gap: 24px; }
        .lp-footer-links a { font-size: 13px; color: var(--text-muted); text-decoration: none; }
        .lp-footer-links a:hover { color: var(--text); }

        @media(max-width:900px){
          .lp-nav { padding: 16px 24px; }
          .lp-nav-links { display: none; }
          .lp-section, .lp-steps { padding: 60px 24px; }
          .lp-feat-grid { grid-template-columns: 1fr; }
          .lp-feat-grid.rev { direction: ltr; }
          .lp-pricing-grid { grid-template-columns: 1fr; max-width: 420px; }
          .lp-auth-container { grid-template-columns: 1fr; }
          .lp-auth-left { display: none; }
          .lp-steps-grid { grid-template-columns: 1fr; }
          .lp-hero { padding: 100px 24px 60px; }
          .lp-hero-stats { flex-wrap: wrap; gap: 24px; }
          .lp-step-arrow { display: none; }
          .lp-footer { flex-direction: column; gap: 20px; text-align: center; padding: 40px 24px; }
          .lp-pricing-section { padding: 60px 24px; }
          .lp-auth-section { padding: 60px 24px; }
          .lp-auth-right { padding: 40px 24px; }
          .lp-cal-week { grid-template-columns: repeat(4,1fr); }
        }
      `}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <a href="#" className="lp-nav-logo">
          Med<span>Rev</span>
          <span className="lp-nav-sub">Révision Médicale IA</span>
        </a>
        <div className="lp-nav-links">
          <a href="#features">Fonctionnalités</a>
          <a href="#how">Comment ça marche</a>
          <a href="#pricing">Tarifs</a>
        </div>
        <a href="#auth" className="lp-nav-cta">Commencer gratuitement →</a>
      </nav>

      {/* HERO */}
      <div className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="lp-hero-glow2" />
        <div className="lp-hero-badge">
          <div className="lp-hero-dot" />
          Conçu pour l&apos;EDN &amp; le PASS
        </div>
        <h1>Révise moins,<br /><em>retiens plus.</em></h1>
        <p className="lp-hero-sub">La seule app de révision médicale avec génération de QCM par IA, planifiée automatiquement en révision espacée J0→J+120.</p>
        <div className="lp-hero-actions">
          <a href="#auth" className="lp-btn-primary">Créer mon compte gratuit →</a>
          <a href="#features" className="lp-btn-ghost">Voir les fonctionnalités</a>
        </div>

        {/* Dashboard mockup */}
        <div className="lp-browser">
          <div className="lp-browser-bar">
            <div className="lp-browser-dots">
              <div className="lp-browser-dot" style={{background:'#ef4444'}} />
              <div className="lp-browser-dot" style={{background:'#f59e0b'}} />
              <div className="lp-browser-dot" style={{background:'#22c55e'}} />
            </div>
            <div className="lp-browser-url">med-rev-eight.vercel.app/dashboard</div>
          </div>
          <div className="lp-dash">
            <div className="lp-sidebar">
              <div className="lp-s-logo">Med<span>Rev</span></div>
              <div className="lp-s-sub">Révision médicale IA</div>
              <div className="lp-s-badge">2 à réviser aujourd&apos;hui</div>
              <div className="lp-s-navlabel">Navigation</div>
              <div className="lp-s-item active">📋 Fiches</div>
              <div className="lp-s-item">📅 Calendrier</div>
              <div className="lp-s-item">✈️ Voyage</div>
              <div className="lp-s-item">📊 Statistiques</div>
              <div className="lp-s-item">⭐ Premium</div>
            </div>
            <div className="lp-matieres">
              <div className="lp-mat-title">Matières</div>
              <div className="lp-mat-item active"><div className="lp-mat-dot" style={{background:'#3b82f6'}} />Toutes<span className="lp-mat-count">8</span></div>
              <div className="lp-mat-item"><div className="lp-mat-dot" style={{background:'#f59e0b'}} />Cardio<span className="lp-mat-count">3</span></div>
              <div className="lp-mat-item"><div className="lp-mat-dot" style={{background:'#10b981'}} />Pneumo<span className="lp-mat-count">2</span></div>
              <div className="lp-mat-item"><div className="lp-mat-dot" style={{background:'#8b5cf6'}} />Neuro<span className="lp-mat-count">3</span></div>
              <div style={{marginTop:'8px',opacity:.6,fontSize:'11px',color:'#3b82f6'}}>+ Ajouter</div>
            </div>
            <div className="lp-main">
              <div className="lp-main-title">Toutes les <span>fiches</span></div>
              <div className="lp-search">🔍 Rechercher une fiche…</div>
              <div className="lp-tabs">
                <div className="lp-tab active">Toutes</div>
                <div className="lp-tab">Non démarrées</div>
                <div className="lp-tab">En cours</div>
              </div>
              <div className="lp-cards">
                <div className="lp-card">
                  <div className="lp-card-title">❤️ Cardio</div>
                  <div className="lp-fiche">
                    <div className="lp-fiche-name">✏️ Insuffisance cardiaque</div>
                    <div className="lp-score">7/10</div>
                  </div>
                  <div className="lp-steps">
                    <div className="lp-step done">J0</div>
                    <div className="lp-step done">J1</div>
                    <div className="lp-step today">J3</div>
                    <div className="lp-step">J7</div>
                    <div className="lp-step">J15</div>
                    <div className="lp-step">J30</div>
                  </div>
                  <div className="lp-date">📅 J3 · Aujourd&apos;hui</div>
                </div>
                <div className="lp-card">
                  <div className="lp-card-title">🫁 Pneumo</div>
                  <div className="lp-fiche">
                    <div className="lp-fiche-name">✏️ Asthme sévère</div>
                    <div className="lp-score" style={{background:'#f59e0b'}}>5/10</div>
                  </div>
                  <div className="lp-steps">
                    <div className="lp-step done">J0</div>
                    <div className="lp-step done">J1</div>
                    <div className="lp-step done">J3</div>
                    <div className="lp-step today">J7</div>
                    <div className="lp-step">J15</div>
                  </div>
                  <div className="lp-date">📅 J7 · Demain</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-hero-stats">
          <div style={{textAlign:'center'}}>
            <span className="lp-stat-num">J0→J+120</span>
            <span className="lp-stat-label">Révision espacée</span>
          </div>
          <div style={{textAlign:'center',borderLeft:'1px solid var(--border)',paddingLeft:'48px'}}>
            <span className="lp-stat-num">IA</span>
            <span className="lp-stat-label">QCM générés</span>
          </div>
          <div style={{textAlign:'center',borderLeft:'1px solid var(--border)',paddingLeft:'48px'}}>
            <span className="lp-stat-num">RGPD</span>
            <span className="lp-stat-label">Données en France</span>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="lp-steps" id="how">
        <span className="lp-badge">Comment ça marche</span>
        <h2 className="lp-title">De zéro à une fiche révisée<br /><em>en 60 secondes.</em></h2>
        <div className="lp-steps-grid">
          <div className="lp-step-card">
            <div className="lp-step-num">01</div>
            <span className="lp-step-icon">📋</span>
            <div className="lp-step-title">Crée ta fiche</div>
            <div className="lp-step-desc">Donne un nom, choisis une matière. MedRev planifie automatiquement 14 étapes de révision espacée de J0 à J+120, calibrées sur la courbe d&apos;oubli d&apos;Ebbinghaus.</div>
            <div className="lp-step-arrow" />
          </div>
          <div className="lp-step-card">
            <div className="lp-step-num">02</div>
            <span className="lp-step-icon">✨</span>
            <div className="lp-step-title">Génère les questions</div>
            <div className="lp-step-desc">Colle ton cours ou uploade un PDF. L&apos;IA génère instantanément des QCM, KFP et V/F niveau annales EDN — personnalisés sur ton contenu, pas des questions génériques.</div>
            <div className="lp-step-arrow" />
          </div>
          <div className="lp-step-card">
            <div className="lp-step-num">03</div>
            <span className="lp-step-icon">📅</span>
            <div className="lp-step-title">Révise au bon moment</div>
            <div className="lp-step-desc">Le calendrier te dit chaque jour quelles fiches réviser. Note ta session de 1 à 5 — MedRev ajuste automatiquement ton score de progression sur toutes les étapes.</div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="lp-section" id="features">
        <span className="lp-badge">Fonctionnalité 1</span>
        <div className="lp-feat-grid">
          <div>
            <div className="lp-feat-tag">QCM IA</div>
            <h3 className="lp-feat-h3">Des questions <em>niveau annales EDN</em> sur ton cours.</h3>
            <p className="lp-feat-p">Colle le contenu de ton cours, tes notes, ou un extrait de référentiel. MedRev génère des questions QCM, KFP et Vrai/Faux calibrées sur le niveau des vraies annales EDN — en quelques secondes.</p>
            <ul className="lp-feat-list">
              <li>Choisis le nombre de questions (5 à 20)</li>
              <li>3 formats : QCM, KFP, Vrai/Faux ou Mix</li>
              <li>Niveau ajustable : entraînement ou annales EDN</li>
              <li>Upload PDF de cours supporté (Premium)</li>
            </ul>
          </div>
          <div className="lp-mockup-wrap">
            <div className="lp-qcm">
              <div className="lp-qcm-left">
                <div className="lp-qcm-label">14 étapes de révision</div>
                <div className="lp-qcm-grid">
                  {['J0','J1','J3','J7','J15','J21','J30','J45','J60','J75','J90','J105','J120'].map((j,i)=>(
                    <div key={j} className={`lp-qcm-box${i===1?' today':''}`}>
                      <span style={{fontSize:'7px'}}>{j}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lp-qcm-right">
                <div className="lp-qcm-header">✨ QCM IA — niveau annales EDN</div>
                <div className="lp-qcm-tabs">
                  <div className="lp-qcm-tab on">📋 Coller le cours</div>
                  <div className="lp-qcm-tab off">📄 Uploader un PDF</div>
                </div>
                <div className="lp-qcm-textarea">Insuffisance cardiaque aiguë : défaillance brutale de la fonction de pompe du cœur. Étiologies : SCA, poussée HTA, arythmie, valvulopathie. Clinique : dyspnée aiguë, OAP…</div>
                <div className="lp-qcm-controls">
                  <span style={{fontSize:'10px',color:'var(--text-muted)'}}>Questions</span>
                  <div className="lp-qcm-sel">10 ▾</div>
                  <span style={{fontSize:'10px',color:'var(--text-muted)'}}>Format</span>
                  <div className="lp-qcm-sel">Mixte ▾</div>
                  <span style={{fontSize:'10px',color:'var(--text-muted)'}}>Niveau</span>
                  <div className="lp-qcm-sel">Annales EDN ▾</div>
                </div>
                <div className="lp-qcm-btn">🤖 Générer les questions</div>
                <div className="lp-qcm-q">
                  <div className="lp-qcm-qt">Quelle est la 1ère cause d&apos;insuffisance cardiaque aiguë en France ?</div>
                  <div className="lp-qcm-opt ok"><div className="lp-radio" />Syndrome coronarien aigu</div>
                  <div className="lp-qcm-opt no"><div className="lp-radio" />Fibrillation atriale</div>
                  <div className="lp-qcm-opt"><div className="lp-radio" />Poussée hypertensive</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2 : CALENDRIER */}
      <section className="lp-section">
        <div className="lp-feat-grid rev">
          <div className="lp-mockup-wrap">
            <div className="lp-cal">
              <div className="lp-cal-header">
                <div className="lp-cal-btn">← Préc.</div>
                <div className="lp-cal-range">24 – 30 mars 2026</div>
                <div className="lp-cal-btn">Suiv. →</div>
                <div className="lp-cal-btn" style={{background:'rgba(59,130,246,0.15)',color:'#93c5fd'}}>Aujourd&apos;hui</div>
                <div style={{marginLeft:'auto',fontSize:'10px',color:'var(--text-muted)',display:'flex',gap:'10px',alignItems:'center'}}>
                  <span style={{display:'flex',alignItems:'center',gap:'4px'}}><span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#ef4444',display:'inline-block'}} />Non fait</span>
                  <span style={{display:'flex',alignItems:'center',gap:'4px'}}><span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#3b82f6',display:'inline-block'}} />Planifiée</span>
                  <span style={{display:'flex',alignItems:'center',gap:'4px'}}><span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#10b981',display:'inline-block'}} />Faite</span>
                </div>
              </div>
              <div className="lp-cal-week">
                <div className="lp-cal-day"><div className="lp-cal-dn">LUN</div><div className="lp-cal-num">24</div><div className="lp-cal-ev done">Cardio · J3</div></div>
                <div className="lp-cal-day"><div className="lp-cal-dn">MAR</div><div className="lp-cal-num">25</div><div className="lp-cal-ev done">Pneumo · J1</div><div className="lp-cal-ev done">Neuro · J0</div></div>
                <div className="lp-cal-day"><div className="lp-cal-dn">MER</div><div className="lp-cal-num">26</div></div>
                <div className="lp-cal-day today"><div className="lp-cal-dn">JEU</div><div className="lp-cal-num">27</div><div className="lp-cal-ev planned">Cardio · J7</div><div className="lp-cal-ev planned">Dermato · J1</div></div>
                <div className="lp-cal-day"><div className="lp-cal-dn">VEN</div><div className="lp-cal-num">28</div><div className="lp-cal-ev up">Pneumo · J3</div></div>
                <div className="lp-cal-day"><div className="lp-cal-dn">SAM</div><div className="lp-cal-num">29</div><div className="lp-cal-ev up">Neuro · J3</div></div>
                <div className="lp-cal-day"><div className="lp-cal-dn">DIM</div><div className="lp-cal-num">30</div></div>
              </div>
            </div>
          </div>
          <div>
            <div className="lp-feat-tag">Calendrier de révision</div>
            <h3 className="lp-feat-h3">Sache exactement<br /><em>quoi réviser chaque jour.</em></h3>
            <p className="lp-feat-p">Plus jamais de &quot;j&apos;ai oublié de réviser ça&quot;. Le calendrier de MedRev calcule automatiquement toutes tes échéances et les affiche jour par jour.</p>
            <ul className="lp-feat-list">
              <li>Vue hebdomadaire avec toutes tes fiches planifiées</li>
              <li>Code couleur : Faite · Planifiée · Non faite</li>
              <li>Clic sur une fiche → accès direct à la révision</li>
              <li>Badge &quot;à réviser aujourd&apos;hui&quot; dans la sidebar</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <div className="lp-pricing-section" id="pricing">
        <div className="lp-pricing-inner">
          <div className="lp-pricing-header">
            <span className="lp-badge" style={{display:'block',textAlign:'center',marginBottom:'12px'}}>Tarifs</span>
            <h2 className="lp-title" style={{textAlign:'center'}}>Simple. <em>Sans engagement.</em></h2>
            <p className="lp-sub" style={{margin:'0 auto',textAlign:'center'}}>Commence gratuitement. Passe Premium quand tu es prêt·e.</p>
          </div>
          <div className="lp-pricing-grid">
            <div className="lp-pc">
              <div className="lp-pc-plan">Gratuit</div>
              <div className="lp-pc-price free">0€</div>
              <div className="lp-pc-period">pour toujours</div>
              <hr className="lp-pc-div" />
              <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Jusqu&apos;à 15 fiches</div>
              <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Révision espacée J0→J+120</div>
              <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Calendrier de révision</div>
              <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Module Voyage (2 passages)</div>
              <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Export / Import JSON</div>
              <div className="lp-pc-feat off"><span className="lp-pc-cross">✗</span> QCM IA (upload cours PDF)</div>
              <div className="lp-pc-feat off"><span className="lp-pc-cross">✗</span> Fiches illimitées</div>
              <div className="lp-pc-feat off"><span className="lp-pc-cross">✗</span> Synchro multi-appareils</div>
              <a href="#auth"><button className="lp-pc-cta free">Commencer gratuitement</button></a>
            </div>
            <div>
              <div className="lp-pc-badge"><span>⭐ Recommandé</span></div>
              <div className="lp-pc featured">
                <div className="lp-pc-plan">Premium</div>
                <div className="lp-pc-price">9,99€</div>
                <div className="lp-pc-period">/mois · sans engagement</div>
                <hr className="lp-pc-div" />
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Fiches illimitées</div>
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Révision espacée J0→J+120</div>
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Calendrier de révision</div>
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Module Voyage (2 passages)</div>
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> Export / Import JSON</div>
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> ✨ QCM IA profonds (upload PDF)</div>
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> ✨ Formats EDN : QCM, KFP, V/F</div>
                <div className="lp-pc-feat on"><span className="lp-pc-check">✓</span> ✨ Synchro cloud (bientôt)</div>
                <a href="#auth"><button className="lp-pc-cta prem">Passer Premium →</button></a>
              </div>
            </div>
          </div>
          <p style={{textAlign:'center',fontSize:'13px',color:'var(--text-muted)',marginTop:'24px'}}>
            🔒 Données hébergées en France (RGPD) · Annulation à tout moment
          </p>
        </div>
      </div>

      {/* AUTH */}
      <div className="lp-auth-section" id="auth">
        <div className="lp-auth-container">
          <div className="lp-auth-left">
            <div>
              <div className="lp-auth-lt">Commence à retenir<br /><em>pour de bon.</em></div>
              <p className="lp-auth-lsub">Rejoins les étudiants en médecine qui utilisent MedRev pour préparer l&apos;EDN sans stress.</p>
            </div>
            <div className="lp-auth-testi">
              <div className="lp-auth-stars">★★★★★</div>
              <div className="lp-auth-testi-text">&quot;J&apos;ai arrêté de relire mes cours en boucle. MedRev me dit exactement quoi réviser chaque matin — j&apos;ai gagné 2h par jour.&quot;</div>
              <div className="lp-auth-testi-author">— Étudiante, P2 · Faculté de Lyon</div>
            </div>
          </div>
          <div className="lp-auth-right">
            <div className="lp-auth-tabs" id="lp-auth-tabs">
              <button className="lp-auth-tab active" id="lp-tab-register" onClick={() => {}}>Créer un compte</button>
              <button className="lp-auth-tab" id="lp-tab-login" onClick={() => {}}>Se connecter</button>
            </div>
            <div id="lp-form-register">
              <div className="lp-form-group">
                <label className="lp-label">Adresse email</label>
                <input type="email" className="lp-input" placeholder="prenom@univ-medecine.fr" />
              </div>
              <div className="lp-form-group">
                <label className="lp-label">Mot de passe</label>
                <input type="password" className="lp-input" placeholder="Minimum 8 caractères" />
              </div>
              <button className="lp-auth-submit" onClick={() => { window.location.href = '/auth?mode=register' }}>
                Créer mon compte gratuit →
              </button>
              <p className="lp-auth-terms">En créant un compte, tu acceptes nos <a href="/privacy">CGU</a>. Données hébergées en France 🇫🇷 (RGPD).</p>
            </div>
            <div id="lp-form-login" style={{display:'none'}}>
              <div className="lp-form-group">
                <label className="lp-label">Adresse email</label>
                <input type="email" className="lp-input" placeholder="ton@email.fr" />
              </div>
              <div className="lp-form-group">
                <label className="lp-label">Mot de passe</label>
                <input type="password" className="lp-input" placeholder="••••••••" />
              </div>
              <button className="lp-auth-submit" onClick={() => { window.location.href = '/auth?mode=login' }}>
                Se connecter →
              </button>
              <div className="lp-auth-div">ou</div>
              <p style={{textAlign:'center',fontSize:'13px',color:'var(--text-muted)'}}>
                Pas encore de compte ?{' '}
                <a href="#auth" style={{color:'var(--blue)'}}>Créer un compte gratuit</a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div>
          <div className="lp-footer-logo">Med<span>Rev</span></div>
          <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'4px'}}>Révision médicale intelligente</div>
        </div>
        <div className="lp-footer-copy">© 2026 MedRev · Données hébergées en France 🇫🇷 · RGPD</div>
        <div className="lp-footer-links">
          <a href="/privacy">Mentions légales</a>
          <a href="/privacy">CGU</a>
          <Link href="/auth">Contact</Link>
        </div>
      </footer>

      {/* Tab switching script */}
      <script dangerouslySetInnerHTML={{__html: `
        document.addEventListener('DOMContentLoaded', function() {
          var tabReg = document.getElementById('lp-tab-register');
          var tabLog = document.getElementById('lp-tab-login');
          var formReg = document.getElementById('lp-form-register');
          var formLog = document.getElementById('lp-form-login');
          if(tabReg) tabReg.addEventListener('click', function(){
            tabReg.className='lp-auth-tab active'; tabLog.className='lp-auth-tab';
            formReg.style.display='block'; formLog.style.display='none';
          });
          if(tabLog) tabLog.addEventListener('click', function(){
            tabLog.className='lp-auth-tab active'; tabReg.className='lp-auth-tab';
            formLog.style.display='block'; formReg.style.display='none';
          });
        });
      `}} />
    </>
  )
}
