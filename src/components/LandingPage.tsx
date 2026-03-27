'use client'
// src/components/LandingPage.tsx

import { useState } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register')

  const goToAuth = (mode: string) => {
    window.location.href = `/auth?mode=${mode}`
  }

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
          --green: #10b981;
          --amber: #f59e0b;
          --text: #f1f5f9;
          --text-muted: #64748b;
          --text-dim: #94a3b8;
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; margin: 0; padding: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 18px 60px; background: rgba(11,15,26,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        .lp-logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--text); text-decoration: none; line-height: 1; }
        .lp-logo span { color: var(--blue); }
        .lp-logo-sub { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; display: block; }
        .lp-nav-links { display: flex; gap: 32px; }
        .lp-nav-links a { font-size: 14px; color: var(--text-dim); text-decoration: none; transition: color .2s; }
        .lp-nav-links a:hover { color: var(--text); }
        .lp-nav-cta { background: var(--blue); color: white; border: none; border-radius: 8px; padding: 10px 22px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; font-family: 'DM Sans', sans-serif; }
        .lp-nav-cta:hover { background: #2563eb; }

        .lp-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 120px 40px 80px; position: relative; overflow: hidden; }
        .lp-glow { position: absolute; width: 700px; height: 700px; background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 60%); top: 50%; left: 50%; transform: translate(-50%,-55%); pointer-events: none; }
        .lp-glow2 { position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 60%); top: 60%; left: 65%; transform: translate(-50%,-50%); pointer-events: none; }
        .lp-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 100px; padding: 7px 16px; margin-bottom: 28px; font-size: 13px; color: #93c5fd; font-family: 'DM Mono', monospace; }
        .lp-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--blue); box-shadow: 0 0 8px rgba(59,130,246,0.8); animation: lp-pulse 2s infinite; }
        @keyframes lp-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .lp-h1 { font-family: 'Syne', sans-serif; font-size: clamp(42px, 6vw, 78px); font-weight: 800; line-height: 1.05; max-width: 820px; margin-bottom: 24px; }
        .lp-h1 em { color: var(--blue); font-style: normal; }
        .lp-sub { font-size: 18px; color: var(--text-dim); max-width: 500px; line-height: 1.7; margin-bottom: 44px; font-weight: 300; }
        .lp-actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; justify-content: center; margin-bottom: 60px; }
        .lp-btn { background: var(--blue); color: white; border: none; border-radius: 10px; padding: 15px 32px; font-size: 16px; font-weight: 500; cursor: pointer; text-decoration: none; font-family: 'DM Sans', sans-serif; display: inline-flex; align-items: center; gap: 8px; transition: all .2s; }
        .lp-btn:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 8px 30px rgba(59,130,246,0.3); }
        .lp-btn-ghost { background: transparent; border: 1px solid var(--border2); color: var(--text-dim); border-radius: 10px; padding: 15px 28px; font-size: 15px; cursor: pointer; text-decoration: none; font-family: 'DM Sans', sans-serif; transition: all .2s; }
        .lp-btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: var(--text); }

        .lp-browser { width: 100%; max-width: 900px; margin: 0 auto 60px; border-radius: 14px; border: 1px solid var(--border2); overflow: hidden; box-shadow: 0 40px 120px rgba(0,0,0,0.6); animation: lp-float 4s ease-in-out infinite; }
        @keyframes lp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .lp-bar { background: #1e2433; padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border); }
        .lp-dots { display: flex; gap: 6px; }
        .lp-d { width: 12px; height: 12px; border-radius: 50%; }
        .lp-url { flex: 1; background: #111827; border-radius: 6px; padding: 5px 12px; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-muted); }

        .lp-dash { background: var(--bg); display: flex; min-height: 360px; }
        .lp-sb { width: 165px; background: #0f1522; border-right: 1px solid var(--border); padding: 16px; flex-shrink: 0; }
        .lp-sb-logo { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; }
        .lp-sb-logo span { color: var(--blue); }
        .lp-sb-sub { font-size: 9px; color: var(--text-muted); font-family: 'DM Mono', monospace; letter-spacing: 1.5px; }
        .lp-sb-b { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.25); border-radius: 6px; padding: 8px 10px; margin: 12px 0; font-size: 11px; color: #93c5fd; }
        .lp-sb-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; margin: 12px 0 6px; font-family: 'DM Mono', monospace; }
        .lp-sb-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 2px; color: var(--text-dim); }
        .lp-sb-item.active { background: rgba(59,130,246,0.15); color: var(--blue); }

        .lp-mat { width: 155px; background: #111827; border-right: 1px solid var(--border); padding: 12px; flex-shrink: 0; }
        .lp-mat-t { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-family: 'DM Mono', monospace; }
        .lp-mat-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; font-size: 11px; margin-bottom: 2px; }
        .lp-mat-item.active { background: rgba(59,130,246,0.1); }
        .lp-mat-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
        .lp-mat-count { margin-left: auto; font-size: 10px; color: var(--text-muted); }

        .lp-main { flex: 1; padding: 20px; }
        .lp-main-h { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 14px; }
        .lp-main-h span { color: var(--blue); }
        .lp-search { background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 9px 14px; font-size: 11px; color: var(--text-muted); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .lp-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
        .lp-tab { padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid var(--border); color: var(--text-dim); }
        .lp-tab.active { background: var(--blue); color: white; border-color: transparent; }
        .lp-cards { display: flex; gap: 12px; flex-wrap: wrap; }
        .lp-card { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; padding: 16px; max-width: 250px; }
        .lp-card-t { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
        .lp-fiche { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .lp-fiche-n { background: rgba(59,130,246,0.15); color: #93c5fd; border-radius: 5px; padding: 4px 9px; font-size: 11px; }
        .lp-score { color: white; border-radius: 5px; padding: 4px 8px; font-size: 11px; font-weight: 600; }
        .lp-steps { display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 6px; }
        .lp-step { width: 21px; height: 21px; border-radius: 4px; background: var(--surface2); font-size: 7px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
        .lp-step.done { background: rgba(16,185,129,0.2); color: var(--green); }
        .lp-step.today { background: rgba(59,130,246,0.25); color: var(--blue); border: 1px solid rgba(59,130,246,0.4); }
        .lp-date { font-size: 10px; color: var(--text-muted); }

        .lp-stats { display: flex; gap: 48px; align-items: center; border-top: 1px solid var(--border); padding-top: 32px; width: 100%; max-width: 600px; justify-content: center; }
        .lp-stat-n { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; display: block; }
        .lp-stat-l { font-size: 12px; color: var(--text-muted); margin-top: 4px; font-family: 'DM Mono', monospace; letter-spacing: 1px; text-transform: uppercase; }

        .lp-sec { padding: 100px 60px; max-width: 1200px; margin: 0 auto; }
        .lp-sec-badge { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--blue); margin-bottom: 12px; display: block; }
        .lp-sec-title { font-family: 'Syne', sans-serif; font-size: clamp(32px, 4vw, 52px); font-weight: 800; line-height: 1.1; margin-bottom: 20px; }
        .lp-sec-title em { color: var(--blue); font-style: normal; }
        .lp-sec-sub { font-size: 17px; color: var(--text-dim); max-width: 520px; line-height: 1.75; font-weight: 300; }

        .lp-fg { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; margin-top: 60px; }
        .lp-fg.rev { direction: rtl; }
        .lp-fg.rev > * { direction: ltr; }
        .lp-ft { display: inline-block; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 100px; padding: 5px 14px; font-size: 12px; color: #93c5fd; font-family: 'DM Mono', monospace; margin-bottom: 20px; }
        .lp-fh3 { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
        .lp-fh3 em { color: var(--blue); font-style: normal; }
        .lp-fp { font-size: 16px; color: var(--text-dim); line-height: 1.75; font-weight: 300; margin-bottom: 24px; }
        .lp-fl { list-style: none; }
        .lp-fl li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text-dim); margin-bottom: 10px; line-height: 1.5; }
        .lp-fl li::before { content: '✓'; color: var(--green); font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .lp-mw { border-radius: 14px; overflow: hidden; border: 1px solid var(--border2); box-shadow: 0 20px 80px rgba(0,0,0,0.5); }

        .lp-qcm { background: var(--bg); display: flex; min-height: 350px; }
        .lp-ql { width: 185px; background: #0f1522; border-right: 1px solid var(--border); padding: 16px; flex-shrink: 0; }
        .lp-ql-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-family: 'DM Mono', monospace; }
        .lp-qg { display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; }
        .lp-qb { aspect-ratio: 1; border-radius: 6px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 7px; color: var(--text-muted); }
        .lp-qb.today { background: rgba(59,130,246,0.25); color: var(--blue); border: 1px solid rgba(59,130,246,0.4); }
        .lp-qr { flex: 1; padding: 18px; }
        .lp-qr-h { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--amber); margin-bottom: 12px; }
        .lp-qtabs { display: flex; gap: 4px; margin-bottom: 10px; }
        .lp-qtab { flex: 1; padding: 8px; border-radius: 6px; text-align: center; font-size: 11px; }
        .lp-qtab.on { background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.35); color: #c4b5fd; }
        .lp-qtab.off { background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); }
        .lp-qta { background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 10px; font-size: 11px; color: var(--text-muted); min-height: 65px; margin-bottom: 10px; line-height: 1.6; }
        .lp-qctrl { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
        .lp-qsel { background: var(--surface); border: 1px solid var(--border2); border-radius: 6px; padding: 5px 8px; font-size: 10px; color: var(--text-dim); font-family: 'DM Mono', monospace; }
        .lp-qbtn { width: 100%; background: linear-gradient(135deg, #7c3aed, #8b5cf6); border: none; border-radius: 8px; padding: 10px; color: white; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .lp-qq { background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; padding: 12px; margin-top: 10px; }
        .lp-qqt { font-size: 11px; font-weight: 500; margin-bottom: 8px; }
        .lp-qopt { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; font-size: 11px; margin-bottom: 3px; border: 1px solid var(--border); }
        .lp-qopt.ok { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #6ee7b7; }
        .lp-qopt.no { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); color: #fca5a5; }
        .lp-radio { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid currentColor; flex-shrink: 0; }
        .lp-qopt.ok .lp-radio { background: #10b981; border-color: #10b981; }
        .lp-qopt.no .lp-radio { background: #ef4444; border-color: #ef4444; }

        .lp-cal { background: var(--bg); padding: 18px; }
        .lp-cal-h { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .lp-cal-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; font-size: 11px; color: var(--text-dim); cursor: pointer; }
        .lp-cal-range { font-size: 13px; font-weight: 600; }
        .lp-cal-week { display: grid; grid-template-columns: repeat(7,1fr); gap: 5px; }
        .lp-cal-day { background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 9px 6px; min-height: 95px; }
        .lp-cal-day.today { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.05); }
        .lp-cal-dn { font-size: 8px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-family: 'DM Mono', monospace; }
        .lp-cal-num { font-size: 14px; font-weight: 700; margin-bottom: 5px; }
        .lp-cal-day.today .lp-cal-num { color: var(--blue); }
        .lp-cal-ev { border-radius: 4px; padding: 3px 5px; font-size: 9px; margin-bottom: 3px; }
        .lp-cal-ev.planned { background: rgba(59,130,246,0.15); color: #93c5fd; }
        .lp-cal-ev.done { background: rgba(16,185,129,0.15); color: #6ee7b7; }
        .lp-cal-ev.up { background: rgba(139,92,246,0.15); color: #c4b5fd; }

        .lp-how { padding: 100px 60px; max-width: 1100px; margin: 0 auto; }
        .lp-how-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 32px; margin-top: 60px; }
        .lp-how-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 32px; position: relative; }
        .lp-how-n { font-family: 'Syne', sans-serif; font-size: 56px; font-weight: 800; color: rgba(59,130,246,0.12); line-height: 1; margin-bottom: 14px; }
        .lp-how-icon { font-size: 28px; margin-bottom: 12px; display: block; }
        .lp-how-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 10px; }
        .lp-how-desc { font-size: 14px; color: var(--text-dim); line-height: 1.7; font-weight: 300; }
        .lp-how-arrow { position: absolute; right: -17px; top: 40px; width: 34px; height: 2px; background: var(--border2); z-index: 1; }
        .lp-how-arrow::after { content: ''; position: absolute; right: -4px; top: -3px; border: 4px solid transparent; border-left-color: var(--border2); }

        .lp-pricing { padding: 100px 60px; background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .lp-pricing-in { max-width: 1100px; margin: 0 auto; }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 800px; margin: 0 auto; }
        .lp-pc { background: var(--bg); border: 1px solid var(--border2); border-radius: 16px; padding: 36px; }
        .lp-pc.feat { border-color: rgba(59,130,246,0.4); }
        .lp-pc-rec { text-align: center; margin-bottom: -14px; }
        .lp-pc-rec span { display: inline-block; background: var(--amber); color: #451a03; border-radius: 100px; padding: 5px 16px; font-size: 12px; font-weight: 700; }
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
        .lp-pc-cta.prem:hover { background: #2563eb; transform: translateY(-1px); }

        .lp-auth { padding: 100px 60px; display: flex; align-items: center; justify-content: center; }
        .lp-auth-wrap { display: grid; grid-template-columns: 1fr 1fr; max-width: 960px; width: 100%; background: var(--surface); border: 1px solid var(--border2); border-radius: 20px; overflow: hidden; }
        .lp-auth-l { padding: 60px 50px; background: linear-gradient(135deg, #0f1a35 0%, #111827 100%); display: flex; flex-direction: column; justify-content: space-between; }
        .lp-auth-lt { font-family: 'Syne', sans-serif; font-size: 34px; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
        .lp-auth-lt em { color: var(--blue); font-style: normal; }
        .lp-auth-lsub { font-size: 15px; color: var(--text-dim); line-height: 1.7; font-weight: 300; margin-bottom: 40px; }
        .lp-testi { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
        .lp-testi-t { font-size: 14px; color: var(--text-dim); font-style: italic; line-height: 1.6; margin-bottom: 12px; }
        .lp-testi-a { font-size: 12px; color: var(--text-muted); font-family: 'DM Mono', monospace; }
        .lp-stars { color: var(--amber); margin-bottom: 8px; font-size: 14px; }
        .lp-auth-r { padding: 60px 50px; }
        .lp-auth-tabs { display: flex; background: var(--bg); border-radius: 10px; padding: 4px; margin-bottom: 32px; }
        .lp-auth-tab { flex: 1; padding: 10px; text-align: center; border-radius: 7px; font-size: 14px; cursor: pointer; border: none; background: transparent; font-family: 'DM Sans', sans-serif; color: var(--text-muted); transition: all .2s; }
        .lp-auth-tab.active { background: var(--blue); color: white; font-weight: 500; }
        .lp-fg-group { margin-bottom: 18px; }
        .lp-label { font-size: 13px; color: var(--text-dim); margin-bottom: 7px; display: block; }
        .lp-input { width: 100%; padding: 12px 14px; background: var(--bg); border: 1px solid var(--border2); border-radius: 9px; color: var(--text); font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color .2s; }
        .lp-input:focus { border-color: var(--blue); }
        .lp-input::placeholder { color: var(--text-muted); }
        .lp-auth-submit { width: 100%; padding: 14px; background: var(--blue); border: none; border-radius: 10px; color: white; font-size: 15px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; margin-top: 8px; transition: all .2s; }
        .lp-auth-submit:hover { background: #2563eb; transform: translateY(-1px); }
        .lp-auth-div { text-align: center; font-size: 12px; color: var(--text-muted); margin: 18px 0; position: relative; }
        .lp-auth-div::before, .lp-auth-div::after { content: ''; position: absolute; top: 50%; width: 42%; height: 1px; background: var(--border); }
        .lp-auth-div::before { left: 0; } .lp-auth-div::after { right: 0; }
        .lp-auth-terms { font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 16px; line-height: 1.6; }
        .lp-auth-terms a { color: var(--blue); }
        .lp-switch-link { color: var(--blue); background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 0; text-decoration: underline; }

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
          .lp-sec, .lp-how { padding: 60px 24px; }
          .lp-fg { grid-template-columns: 1fr; }
          .lp-fg.rev { direction: ltr; }
          .lp-pricing-grid { grid-template-columns: 1fr; max-width: 420px; }
          .lp-auth-wrap { grid-template-columns: 1fr; }
          .lp-auth-l { display: none; }
          .lp-auth-r { padding: 40px 24px; }
          .lp-how-grid { grid-template-columns: 1fr; }
          .lp-hero { padding: 100px 24px 60px; }
          .lp-stats { flex-wrap: wrap; gap: 24px; }
          .lp-how-arrow { display: none; }
          .lp-pricing { padding: 60px 24px; }
          .lp-auth { padding: 60px 24px; }
          .lp-footer { flex-direction: column; gap: 20px; text-align: center; padding: 40px 24px; }
          .lp-cal-week { grid-template-columns: repeat(4,1fr); }
        }
      `}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <a href="#" className="lp-logo">
          Med<span>Rev</span>
          <span className="lp-logo-sub">Révision Médicale IA</span>
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
        <div className="lp-glow" />
        <div className="lp-glow2" />
        <div className="lp-badge"><div className="lp-dot" />Conçu pour l&apos;EDN &amp; le PASS</div>
        <h1 className="lp-h1">Révise moins,<br /><em>retiens plus.</em></h1>
        <p className="lp-sub">La seule app de révision médicale avec génération de QCM par IA, planifiée automatiquement en révision espacée J0→J+120.</p>
        <div className="lp-actions">
          <a href="#auth" className="lp-btn">Créer mon compte gratuit →</a>
          <a href="#features" className="lp-btn-ghost">Voir les fonctionnalités</a>
        </div>

        <div className="lp-browser">
          <div className="lp-bar">
            <div className="lp-dots">
              <div className="lp-d" style={{background:'#ef4444'}} />
              <div className="lp-d" style={{background:'#f59e0b'}} />
              <div className="lp-d" style={{background:'#22c55e'}} />
            </div>
            <div className="lp-url">med-rev-eight.vercel.app/dashboard</div>
          </div>
          <div className="lp-dash">
            <div className="lp-sb">
              <div className="lp-sb-logo">Med<span>Rev</span></div>
              <div className="lp-sb-sub">Révision médicale IA</div>
              <div className="lp-sb-b">2 à réviser aujourd&apos;hui</div>
              <div className="lp-sb-label">Navigation</div>
              <div className="lp-sb-item active">📋 Fiches</div>
              <div className="lp-sb-item">📅 Calendrier</div>
              <div className="lp-sb-item">✈️ Voyage</div>
              <div className="lp-sb-item">📊 Statistiques</div>
              <div className="lp-sb-item">⭐ Premium</div>
            </div>
            <div className="lp-mat">
              <div className="lp-mat-t">Matières</div>
              {[{c:'#3b82f6',n:'Toutes',v:8},{c:'#f59e0b',n:'Cardio',v:3},{c:'#10b981',n:'Pneumo',v:2},{c:'#8b5cf6',n:'Neuro',v:3}].map((m,i) => (
                <div key={m.n} className={`lp-mat-item${i===0?' active':''}`}>
                  <div className="lp-mat-dot" style={{background:m.c}} />{m.n}<span className="lp-mat-count">{m.v}</span>
                </div>
              ))}
              <div style={{marginTop:'8px',opacity:.6,fontSize:'11px',color:'#3b82f6'}}>+ Ajouter</div>
            </div>
            <div className="lp-main">
              <div className="lp-main-h">Toutes les <span>fiches</span></div>
              <div className="lp-search">🔍 Rechercher une fiche…</div>
              <div className="lp-tabs">
                <div className="lp-tab active">Toutes</div>
                <div className="lp-tab">Non démarrées</div>
                <div className="lp-tab">En cours</div>
              </div>
              <div className="lp-cards">
                <div className="lp-card">
                  <div className="lp-card-t">❤️ Cardio</div>
                  <div className="lp-fiche"><div className="lp-fiche-n">✏️ Insuffisance cardiaque</div><div className="lp-score" style={{background:'#10b981'}}>7/10</div></div>
                  <div className="lp-steps">
                    {['J0','J1','J3','J7','J15','J30'].map((j,i) => <div key={j} className={`lp-step${i<2?' done':i===2?' today':''}`}>{j}</div>)}
                  </div>
                  <div className="lp-date">📅 J3 · Aujourd&apos;hui</div>
                </div>
                <div className="lp-card">
                  <div className="lp-card-t">🫁 Pneumo</div>
                  <div className="lp-fiche"><div className="lp-fiche-n">✏️ Asthme sévère</div><div className="lp-score" style={{background:'#f59e0b'}}>5/10</div></div>
                  <div className="lp-steps">
                    {['J0','J1','J3','J7','J15'].map((j,i) => <div key={j} className={`lp-step${i<3?' done':i===3?' today':''}`}>{j}</div>)}
                  </div>
                  <div className="lp-date">📅 J7 · Demain</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-stats">
          <div style={{textAlign:'center'}}><span className="lp-stat-n">J0→J+120</span><span className="lp-stat-l">Révision espacée</span></div>
          <div style={{textAlign:'center',borderLeft:'1px solid var(--border)',paddingLeft:'48px'}}><span className="lp-stat-n">IA</span><span className="lp-stat-l">QCM générés</span></div>
          <div style={{textAlign:'center',borderLeft:'1px solid var(--border)',paddingLeft:'48px'}}><span className="lp-stat-n">RGPD</span><span className="lp-stat-l">Données en France</span></div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="lp-how" id="how">
        <span className="lp-sec-badge">Comment ça marche</span>
        <h2 className="lp-sec-title">De zéro à une fiche révisée<br /><em>en 60 secondes.</em></h2>
        <div className="lp-how-grid">
          {[
            {n:'01',icon:'📋',title:'Crée ta fiche',desc:"Donne un nom, choisis une matière. MedRev planifie automatiquement 14 étapes de révision espacée de J0 à J+120, calibrées sur la courbe d'oubli d'Ebbinghaus.",arrow:true},
            {n:'02',icon:'✨',title:'Génère les questions',desc:"Colle ton cours ou uploade un PDF. L'IA génère instantanément des QCM, KFP et V/F niveau annales EDN — personnalisés sur ton contenu, pas des questions génériques.",arrow:true},
            {n:'03',icon:'📅',title:'Révise au bon moment',desc:"Le calendrier te dit chaque jour quelles fiches réviser. Note ta session de 1 à 5 — MedRev ajuste automatiquement ton score de progression.",arrow:false},
          ].map(s => (
            <div key={s.n} className="lp-how-card">
              <div className="lp-how-n">{s.n}</div>
              <span className="lp-how-icon">{s.icon}</span>
              <div className="lp-how-title">{s.title}</div>
              <div className="lp-how-desc">{s.desc}</div>
              {s.arrow && <div className="lp-how-arrow" />}
            </div>
          ))}
        </div>
      </div>

      {/* FEATURE 1 : QCM IA */}
      <section className="lp-sec" id="features">
        <span className="lp-sec-badge">Fonctionnalité 1</span>
        <div className="lp-fg">
          <div>
            <div className="lp-ft">QCM IA</div>
            <h3 className="lp-fh3">Des questions <em>niveau annales EDN</em> sur ton cours.</h3>
            <p className="lp-fp">Colle le contenu de ton cours, tes notes, ou un extrait de référentiel. MedRev génère des QCM, KFP et Vrai/Faux calibrées sur le niveau des vraies annales EDN — en quelques secondes.</p>
            <ul className="lp-fl">
              <li>Choisis le nombre de questions (5 à 20)</li>
              <li>3 formats : QCM, KFP, Vrai/Faux ou Mix</li>
              <li>Niveau ajustable : entraînement ou annales EDN</li>
              <li>Upload PDF de cours supporté (Premium)</li>
            </ul>
          </div>
          <div className="lp-mw">
            <div className="lp-qcm">
              <div className="lp-ql">
                <div className="lp-ql-label">14 étapes de révision</div>
                <div className="lp-qg">
                  {['J0','J1','J3','J7','J15','J21','J30','J45','J60','J75','J90','J105','J120'].map((j,i) => (
                    <div key={j} className={`lp-qb${i===1?' today':''}`}><span>{j}</span></div>
                  ))}
                </div>
              </div>
              <div className="lp-qr">
                <div className="lp-qr-h">✨ QCM IA — niveau annales EDN</div>
                <div className="lp-qtabs">
                  <div className="lp-qtab on">📋 Coller le cours</div>
                  <div className="lp-qtab off">📄 PDF</div>
                </div>
                <div className="lp-qta">Insuffisance cardiaque aiguë : défaillance brutale de la fonction de pompe du cœur. Étiologies : SCA, poussée HTA, arythmie…</div>
                <div className="lp-qctrl">
                  <span style={{fontSize:'10px',color:'var(--text-muted)'}}>Questions</span>
                  <div className="lp-qsel">10 ▾</div>
                  <span style={{fontSize:'10px',color:'var(--text-muted)'}}>Format</span>
                  <div className="lp-qsel">Mixte ▾</div>
                  <span style={{fontSize:'10px',color:'var(--text-muted)'}}>Niveau</span>
                  <div className="lp-qsel">Annales EDN ▾</div>
                </div>
                <div className="lp-qbtn">🤖 Générer les questions</div>
                <div className="lp-qq">
                  <div className="lp-qqt">1ère cause d&apos;insuffisance cardiaque aiguë en France ?</div>
                  <div className="lp-qopt ok"><div className="lp-radio" />Syndrome coronarien aigu</div>
                  <div className="lp-qopt no"><div className="lp-radio" />Fibrillation atriale</div>
                  <div className="lp-qopt"><div className="lp-radio" />Poussée hypertensive</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2 : CALENDRIER */}
      <section className="lp-sec">
        <div className="lp-fg rev">
          <div className="lp-mw">
            <div className="lp-cal">
              <div className="lp-cal-h">
                <div className="lp-cal-btn">← Préc.</div>
                <div className="lp-cal-range">24 – 30 mars 2026</div>
                <div className="lp-cal-btn">Suiv. →</div>
                <div className="lp-cal-btn" style={{background:'rgba(59,130,246,0.15)',color:'#93c5fd'}}>Aujourd&apos;hui</div>
                <div style={{marginLeft:'auto',fontSize:'10px',color:'var(--text-muted)',display:'flex',gap:'8px',alignItems:'center'}}>
                  {[{c:'#ef4444',l:'Non fait'},{c:'#3b82f6',l:'Planifiée'},{c:'#10b981',l:'Faite'}].map(s=>(
                    <span key={s.l} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                      <span style={{width:'7px',height:'7px',borderRadius:'50%',background:s.c,display:'inline-block'}} />{s.l}
                    </span>
                  ))}
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
            <div className="lp-ft">Calendrier de révision</div>
            <h3 className="lp-fh3">Sache exactement<br /><em>quoi réviser chaque jour.</em></h3>
            <p className="lp-fp">Plus jamais de &quot;j&apos;ai oublié de réviser ça&quot;. Le calendrier calcule automatiquement toutes tes échéances et les affiche jour par jour.</p>
            <ul className="lp-fl">
              <li>Vue hebdomadaire avec toutes tes fiches planifiées</li>
              <li>Code couleur : Faite · Planifiée · Non faite</li>
              <li>Clic sur une fiche → accès direct à la révision</li>
              <li>Badge &quot;à réviser aujourd&apos;hui&quot; dans la sidebar</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <div className="lp-pricing" id="pricing">
        <div className="lp-pricing-in">
          <div style={{textAlign:'center',marginBottom:'60px'}}>
            <span className="lp-sec-badge" style={{display:'block',textAlign:'center',marginBottom:'12px'}}>Tarifs</span>
            <h2 className="lp-sec-title" style={{textAlign:'center'}}>Simple. <em>Sans engagement.</em></h2>
            <p className="lp-sec-sub" style={{margin:'0 auto',textAlign:'center'}}>Commence gratuitement. Passe Premium quand tu es prêt·e.</p>
          </div>
          <div className="lp-pricing-grid">
            <div className="lp-pc">
              <div className="lp-pc-plan">Gratuit</div>
              <div className="lp-pc-price free">0€</div>
              <div className="lp-pc-period">pour toujours</div>
              <hr className="lp-pc-div" />
              {['Jusqu\'à 15 fiches','Révision espacée J0→J+120','Calendrier de révision','Module Voyage (2 passages)','Export / Import JSON'].map(f=>(
                <div key={f} className="lp-pc-feat on"><span className="lp-pc-check">✓</span> {f}</div>
              ))}
              {['QCM IA (upload cours PDF)','Fiches illimitées','Synchro multi-appareils'].map(f=>(
                <div key={f} className="lp-pc-feat off"><span className="lp-pc-cross">✗</span> {f}</div>
              ))}
              <button className="lp-pc-cta free" onClick={() => goToAuth('register')}>Commencer gratuitement</button>
            </div>
            <div>
              <div className="lp-pc-rec"><span>⭐ Recommandé</span></div>
              <div className="lp-pc feat">
                <div className="lp-pc-plan">Premium</div>
                <div className="lp-pc-price">9,99€</div>
                <div className="lp-pc-period">/mois · sans engagement</div>
                <hr className="lp-pc-div" />
                {['Fiches illimitées','Révision espacée J0→J+120','Calendrier de révision','Module Voyage (2 passages)','Export / Import JSON','✨ QCM IA profonds (upload PDF)','✨ Formats EDN : QCM, KFP, V/F','✨ Synchro cloud (bientôt)'].map(f=>(
                  <div key={f} className="lp-pc-feat on"><span className="lp-pc-check">✓</span> {f}</div>
                ))}
                <button className="lp-pc-cta prem" onClick={() => goToAuth('register')}>Passer Premium →</button>
              </div>
            </div>
          </div>
          <p style={{textAlign:'center',fontSize:'13px',color:'var(--text-muted)',marginTop:'24px'}}>
            🔒 Données hébergées en France (RGPD) · Annulation à tout moment
          </p>
        </div>
      </div>

      {/* AUTH */}
      <div className="lp-auth" id="auth">
        <div className="lp-auth-wrap">
          <div className="lp-auth-l">
            <div>
              <div className="lp-auth-lt">Commence à retenir<br /><em>pour de bon.</em></div>
              <p className="lp-auth-lsub">Rejoins les étudiants en médecine qui utilisent MedRev pour préparer l&apos;EDN sans stress.</p>
            </div>
            <div className="lp-testi">
              <div className="lp-stars">★★★★★</div>
              <div className="lp-testi-t">&quot;J&apos;ai arrêté de relire mes cours en boucle. MedRev me dit exactement quoi réviser chaque matin — j&apos;ai gagné 2h par jour.&quot;</div>
              <div className="lp-testi-a">— Étudiante, P2 · Faculté de Lyon</div>
            </div>
          </div>
          <div className="lp-auth-r">
            <div className="lp-auth-tabs">
              <button className={`lp-auth-tab${activeTab==='register'?' active':''}`} onClick={() => setActiveTab('register')}>Créer un compte</button>
              <button className={`lp-auth-tab${activeTab==='login'?' active':''}`} onClick={() => setActiveTab('login')}>Se connecter</button>
            </div>

            {activeTab === 'register' && (
              <div>
                <div className="lp-fg-group"><label className="lp-label">Adresse email</label><input type="email" className="lp-input" placeholder="prenom@univ-medecine.fr" /></div>
                <div className="lp-fg-group"><label className="lp-label">Mot de passe</label><input type="password" className="lp-input" placeholder="Minimum 8 caractères" /></div>
                <button className="lp-auth-submit" onClick={() => goToAuth('register')}>Créer mon compte gratuit →</button>
                <p className="lp-auth-terms">En créant un compte, tu acceptes nos <a href="/privacy">CGU</a>. Données hébergées en France 🇫🇷</p>
              </div>
            )}

            {activeTab === 'login' && (
              <div>
                <div className="lp-fg-group"><label className="lp-label">Adresse email</label><input type="email" className="lp-input" placeholder="ton@email.fr" /></div>
                <div className="lp-fg-group"><label className="lp-label">Mot de passe</label><input type="password" className="lp-input" placeholder="••••••••" /></div>
                <button className="lp-auth-submit" onClick={() => goToAuth('login')}>Se connecter →</button>
                <div className="lp-auth-div">ou</div>
                <p style={{textAlign:'center',fontSize:'13px',color:'var(--text-muted)'}}>
                  Pas encore de compte ?{' '}
                  <button className="lp-switch-link" onClick={() => setActiveTab('register')}>Créer un compte gratuit</button>
                </p>
              </div>
            )}
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
          <Link href="/privacy">Mentions légales</Link>
          <Link href="/privacy">CGU</Link>
          <Link href="/auth">Contact</Link>
        </div>
      </footer>
    </>
  )
}
