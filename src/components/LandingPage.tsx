'use client'
// src/components/LandingPage.tsx

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleRegister = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').update({ username }).eq('id', data.user.id)
    }
    window.location.href = '/dashboard'
  }

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        .lp * { box-sizing: border-box; margin: 0; padding: 0; }
        .lp { font-family: 'DM Sans', sans-serif; background: #fafaf8; color: #1a1a18; overflow-x: hidden; }
        .lp-nav { display: flex; align-items: center; justify-content: space-between; padding: 20px 60px; border-bottom: 1px solid #e8e6e0; background: #fafaf8; position: sticky; top: 0; z-index: 50; }
        .lp-nav-logo { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; color: #1a1a18; text-decoration: none; line-height: 1.1; }
        .lp-nav-logo span { color: #2d6a4f; }
        .lp-nav-sub { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px; color: #9b9890; text-transform: uppercase; display: block; }
        .lp-nav-links { display: flex; gap: 32px; }
        .lp-nav-links a { font-size: 14px; color: #4a4a46; text-decoration: none; }
        .lp-nav-links a:hover { color: #1a1a18; }
        .lp-nav-cta { background: #2d6a4f; color: white; border: none; border-radius: 9px; padding: 10px 22px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; font-family: 'DM Sans', sans-serif; }
        .lp-nav-cta:hover { background: #1b4332; }
        .lp-hero { max-width: 1100px; margin: 0 auto; padding: 80px 60px 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
        .lp-hero-tag { display: inline-flex; align-items: center; gap: 6px; background: #e8f5ee; border: 1px solid #b7dfca; border-radius: 100px; padding: 5px 14px; font-size: 12px; color: #2d6a4f; margin-bottom: 24px; font-weight: 500; font-family: 'DM Mono', monospace; }
        .lp-hero-dot { width: 6px; height: 6px; border-radius: 50%; background: #2d6a4f; animation: lp-pulse 2s infinite; }
        @keyframes lp-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .lp-h1 { font-family: 'Fraunces', serif; font-size: clamp(40px, 4.5vw, 58px); font-weight: 700; line-height: 1.08; margin-bottom: 20px; }
        .lp-h1 em { font-style: italic; color: #2d6a4f; }
        .lp-hero-p { font-size: 17px; color: #6b6860; line-height: 1.75; margin-bottom: 36px; font-weight: 300; }
        .lp-hero-btns { display: flex; gap: 12px; align-items: center; margin-bottom: 40px; flex-wrap: wrap; }
        .lp-btn { background: #2d6a4f; color: white; border: none; border-radius: 10px; padding: 14px 28px; font-size: 15px; font-weight: 500; cursor: pointer; text-decoration: none; font-family: 'DM Sans', sans-serif; transition: all .2s; display: inline-block; }
        .lp-btn:hover { background: #1b4332; transform: translateY(-1px); }
        .lp-btn-outline { background: transparent; border: 1.5px solid #d4d2cc; color: #1a1a18; border-radius: 10px; padding: 13px 22px; font-size: 15px; cursor: pointer; font-family: 'DM Sans', sans-serif; text-decoration: none; display: inline-block; }
        .lp-btn-outline:hover { border-color: #9b9890; }
        .lp-trust { display: flex; gap: 20px; flex-wrap: wrap; }
        .lp-trust-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #9b9890; }
        .lp-trust-check { width: 16px; height: 16px; border-radius: 50%; background: #e8f5ee; border: 1px solid #b7dfca; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #2d6a4f; flex-shrink: 0; }
        .lp-app-card { background: white; border: 1px solid #e8e6e0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .lp-app-bar { background: #f5f4f0; border-bottom: 1px solid #e8e6e0; padding: 10px 16px; display: flex; align-items: center; gap: 10px; }
        .lp-app-dots { display: flex; gap: 5px; }
        .lp-app-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-app-url { flex: 1; background: #ede9e0; border-radius: 5px; padding: 4px 10px; font-size: 10px; color: #9b9890; font-family: 'DM Mono', monospace; }
        .lp-app-body { display: flex; min-height: 280px; }
        .lp-app-sb { width: 130px; background: #f9f8f5; border-right: 1px solid #e8e6e0; padding: 12px; flex-shrink: 0; }
        .lp-app-logo { font-family: 'Fraunces', serif; font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #1a1a18; }
        .lp-app-logo span { color: #2d6a4f; }
        .lp-app-navlabel { font-size: 9px; color: #c0bdb5; text-transform: uppercase; letter-spacing: 1.5px; margin: 8px 0 5px; font-family: 'DM Mono', monospace; }
        .lp-app-item { display: flex; align-items: center; gap: 6px; padding: 5px 7px; border-radius: 6px; font-size: 11px; color: #6b6860; margin-bottom: 1px; }
        .lp-app-item.on { background: #e8f5ee; color: #2d6a4f; font-weight: 500; }
        .lp-app-main { flex: 1; padding: 14px; }
        .lp-app-main-h { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #1a1a18; font-family: 'Fraunces', serif; }
        .lp-app-fiche { background: #f9f8f5; border: 1px solid #e8e6e0; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
        .lp-app-fiche-title { font-size: 11px; font-weight: 600; margin-bottom: 7px; color: #1a1a18; }
        .lp-app-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .lp-app-badge { background: #e8f5ee; color: #2d6a4f; border-radius: 4px; padding: 3px 8px; font-size: 10px; }
        .lp-app-score { color: white; border-radius: 4px; padding: 3px 7px; font-size: 10px; font-weight: 600; }
        .lp-app-steps { display: flex; gap: 2px; margin-bottom: 5px; }
        .lp-app-step { width: 18px; height: 18px; border-radius: 3px; background: #ede9e0; font-size: 7px; display: flex; align-items: center; justify-content: center; color: #9b9890; }
        .lp-app-step.done { background: #e8f5ee; color: #2d6a4f; }
        .lp-app-step.now { background: #2d6a4f; color: white; }
        .lp-app-date { font-size: 9px; color: #9b9890; }
        .lp-section { padding: 80px 60px; max-width: 1100px; margin: 0 auto; }
        .lp-sec-label { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #2d6a4f; margin-bottom: 12px; display: block; }
        .lp-sec-title { font-family: 'Fraunces', serif; font-size: clamp(32px, 3.5vw, 46px); font-weight: 700; line-height: 1.1; margin-bottom: 16px; }
        .lp-sec-title em { font-style: italic; color: #2d6a4f; }
        .lp-sec-sub { font-size: 17px; color: #6b6860; max-width: 520px; line-height: 1.75; font-weight: 300; }
        .lp-steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 48px; }
        .lp-step-card { background: white; border: 1px solid #e8e6e0; border-radius: 14px; padding: 28px; position: relative; }
        .lp-step-num { font-family: 'Fraunces', serif; font-size: 52px; font-weight: 700; color: rgba(45,106,79,0.1); line-height: 1; margin-bottom: 12px; }
        .lp-step-icon { font-size: 26px; margin-bottom: 12px; display: block; }
        .lp-step-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #1a1a18; }
        .lp-step-desc { font-size: 14px; color: #6b6860; line-height: 1.7; font-weight: 300; }
        .lp-step-arrow { position: absolute; right: -13px; top: 36px; width: 26px; height: 1.5px; background: #d4d2cc; z-index: 1; }
        .lp-step-arrow::after { content: ''; position: absolute; right: -4px; top: -3px; border: 4px solid transparent; border-left-color: #d4d2cc; }
        .lp-feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; margin-top: 60px; }
        .lp-feat-grid.rev { direction: rtl; }
        .lp-feat-grid.rev > * { direction: ltr; }
        .lp-feat-tag { display: inline-block; background: #e8f5ee; border: 1px solid #b7dfca; border-radius: 100px; padding: 5px 14px; font-size: 12px; color: #2d6a4f; font-family: 'DM Mono', monospace; margin-bottom: 18px; }
        .lp-feat-h3 { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 700; line-height: 1.15; margin-bottom: 14px; }
        .lp-feat-h3 em { font-style: italic; color: #2d6a4f; }
        .lp-feat-p { font-size: 16px; color: #6b6860; line-height: 1.75; font-weight: 300; margin-bottom: 22px; }
        .lp-feat-list { list-style: none; }
        .lp-feat-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #4a4a46; margin-bottom: 10px; line-height: 1.5; }
        .lp-feat-list li::before { content: '✓'; color: #2d6a4f; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .lp-mockup-wrap { border-radius: 14px; overflow: hidden; border: 1px solid #e8e6e0; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .lp-qcm { background: #fafaf8; display: flex; min-height: 320px; }
        .lp-qcm-left { width: 155px; background: #f5f4f0; border-right: 1px solid #e8e6e0; padding: 14px; flex-shrink: 0; }
        .lp-qcm-label { font-size: 9px; color: #9b9890; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; font-family: 'DM Mono', monospace; }
        .lp-qcm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
        .lp-qcm-box { aspect-ratio: 1; border-radius: 5px; background: #ede9e0; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #9b9890; }
        .lp-qcm-box.now { background: #2d6a4f; color: white; }
        .lp-qcm-right { flex: 1; padding: 16px; }
        .lp-qcm-header { font-family: 'Fraunces', serif; font-size: 14px; font-weight: 600; color: #2d6a4f; margin-bottom: 12px; }
        .lp-qcm-tabs { display: flex; gap: 3px; margin-bottom: 10px; }
        .lp-qcm-tab { flex: 1; padding: 7px; border-radius: 6px; text-align: center; font-size: 11px; }
        .lp-qcm-tab.on { background: #e8f5ee; border: 1px solid #b7dfca; color: #2d6a4f; }
        .lp-qcm-tab.off { background: #f5f4f0; border: 1px solid #e8e6e0; color: #9b9890; }
        .lp-qcm-textarea { background: white; border: 1px solid #e8e6e0; border-radius: 8px; padding: 10px; font-size: 11px; color: #6b6860; min-height: 58px; margin-bottom: 8px; line-height: 1.6; font-style: italic; }
        .lp-qcm-controls { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
        .lp-qcm-sel { background: white; border: 1px solid #e8e6e0; border-radius: 6px; padding: 4px 8px; font-size: 10px; color: #4a4a46; }
        .lp-qcm-btn { width: 100%; background: #2d6a4f; border: none; border-radius: 8px; padding: 9px; color: white; font-size: 12px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .lp-qcm-q { background: white; border: 1px solid #e8e6e0; border-radius: 8px; padding: 10px; margin-top: 8px; }
        .lp-qcm-qt { font-size: 11px; font-weight: 500; margin-bottom: 7px; color: #1a1a18; }
        .lp-qcm-opt { display: flex; align-items: center; gap: 7px; padding: 5px 8px; border-radius: 6px; font-size: 11px; margin-bottom: 3px; border: 1px solid #e8e6e0; color: #4a4a46; }
        .lp-qcm-opt.ok { background: #e8f5ee; border-color: #b7dfca; color: #2d6a4f; }
        .lp-qcm-opt.no { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }
        .lp-radio { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid currentColor; flex-shrink: 0; }
        .lp-qcm-opt.ok .lp-radio { background: #2d6a4f; border-color: #2d6a4f; }
        .lp-qcm-opt.no .lp-radio { background: #dc2626; border-color: #dc2626; }
        .lp-cal { background: #fafaf8; padding: 16px; }
        .lp-cal-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .lp-cal-btn { background: white; border: 1px solid #e8e6e0; border-radius: 6px; padding: 4px 9px; font-size: 11px; color: #4a4a46; cursor: pointer; }
        .lp-cal-range { font-size: 13px; font-weight: 600; color: #1a1a18; }
        .lp-cal-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
        .lp-cal-day { background: white; border: 1px solid #e8e6e0; border-radius: 9px; padding: 8px 6px; min-height: 88px; }
        .lp-cal-day.today { border-color: #b7dfca; background: #f0faf5; }
        .lp-cal-dn { font-size: 8px; color: #9b9890; text-transform: uppercase; letter-spacing: 1px; font-family: 'DM Mono', monospace; }
        .lp-cal-num { font-size: 14px; font-weight: 700; margin-bottom: 5px; color: #1a1a18; }
        .lp-cal-day.today .lp-cal-num { color: #2d6a4f; }
        .lp-cal-ev { border-radius: 4px; padding: 3px 5px; font-size: 9px; margin-bottom: 3px; }
        .lp-cal-ev.planned { background: #e8f5ee; color: #2d6a4f; }
        .lp-cal-ev.done { background: #dcfce7; color: #15803d; }
        .lp-cal-ev.up { background: #ede9fe; color: #6d28d9; }
        .lp-testi-band { background: #f5f4f0; padding: 72px 60px; border-top: 1px solid #e8e6e0; border-bottom: 1px solid #e8e6e0; }
        .lp-testi-inner { max-width: 680px; margin: 0 auto; text-align: center; }
        .lp-testi-stars { color: #d97706; font-size: 18px; margin-bottom: 20px; letter-spacing: 2px; }
        .lp-testi-quote { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 400; font-style: italic; line-height: 1.4; color: #1a1a18; margin-bottom: 18px; }
        .lp-testi-author { font-size: 13px; color: #9b9890; font-family: 'DM Mono', monospace; }
        .lp-pricing { padding: 80px 60px; max-width: 900px; margin: 0 auto; text-align: center; }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left; margin-top: 48px; }
        .lp-pc { background: white; border: 1px solid #e8e6e0; border-radius: 16px; padding: 32px; }
        .lp-pc.feat { border: 2px solid #2d6a4f; }
        .lp-pc-rec { text-align: center; margin-bottom: -14px; }
        .lp-pc-rec span { display: inline-block; background: #d97706; color: white; border-radius: 100px; padding: 4px 16px; font-size: 12px; font-weight: 600; }
        .lp-pc-plan { font-size: 13px; color: #9b9890; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-family: 'DM Mono', monospace; }
        .lp-pc-price { font-family: 'Fraunces', serif; font-size: 50px; font-weight: 700; color: #1a1a18; line-height: 1; margin-bottom: 4px; }
        .lp-pc-price.free { color: #2d6a4f; }
        .lp-pc-period { font-size: 13px; color: #9b9890; margin-bottom: 24px; }
        .lp-pc-div { border: none; border-top: 1px solid #e8e6e0; margin-bottom: 20px; }
        .lp-pc-feat { display: flex; align-items: flex-start; gap: 9px; font-size: 14px; margin-bottom: 10px; color: #4a4a46; }
        .lp-pc-feat.on { color: #1a1a18; }
        .lp-pc-feat.off { opacity: .4; text-decoration: line-through; }
        .lp-pc-check { color: #2d6a4f; font-weight: 700; flex-shrink: 0; }
        .lp-pc-cross { color: #9b9890; flex-shrink: 0; }
        .lp-pc-cta { width: 100%; padding: 13px; border-radius: 10px; font-size: 15px; font-weight: 500; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; margin-top: 24px; transition: all .2s; }
        .lp-pc-cta.free { background: #f5f4f0; color: #1a1a18; border: 1px solid #e8e6e0; }
        .lp-pc-cta.free:hover { background: #edeae3; }
        .lp-pc-cta.prem { background: #2d6a4f; color: white; }
        .lp-pc-cta.prem:hover { background: #1b4332; transform: translateY(-1px); }
        .lp-auth { padding: 80px 60px; display: flex; align-items: center; justify-content: center; background: #f5f4f0; border-top: 1px solid #e8e6e0; }
        .lp-auth-wrap { display: grid; grid-template-columns: 1fr 1fr; max-width: 940px; width: 100%; background: white; border: 1px solid #e8e6e0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
        .lp-auth-left { padding: 52px 48px; background: #f9f8f5; border-right: 1px solid #e8e6e0; display: flex; flex-direction: column; justify-content: space-between; }
        .lp-auth-lt { font-family: 'Fraunces', serif; font-size: 32px; font-weight: 700; line-height: 1.15; margin-bottom: 14px; color: #1a1a18; }
        .lp-auth-lt em { font-style: italic; color: #2d6a4f; }
        .lp-auth-lsub { font-size: 15px; color: #6b6860; line-height: 1.7; font-weight: 300; margin-bottom: 36px; }
        .lp-auth-testi { background: white; border: 1px solid #e8e6e0; border-radius: 12px; padding: 20px; }
        .lp-auth-stars { color: #d97706; margin-bottom: 8px; font-size: 14px; }
        .lp-auth-testi-text { font-size: 14px; color: #4a4a46; font-style: italic; line-height: 1.6; margin-bottom: 10px; }
        .lp-auth-testi-author { font-size: 12px; color: #9b9890; font-family: 'DM Mono', monospace; }
        .lp-auth-right { padding: 52px 48px; }
        .lp-auth-tabs { display: flex; background: #f5f4f0; border-radius: 10px; padding: 4px; margin-bottom: 28px; }
        .lp-auth-tab { flex: 1; padding: 10px; text-align: center; border-radius: 7px; font-size: 14px; cursor: pointer; border: none; background: transparent; font-family: 'DM Sans', sans-serif; color: #9b9890; transition: all .2s; }
        .lp-auth-tab.active { background: #2d6a4f; color: white; font-weight: 500; }
        .lp-form-group { margin-bottom: 16px; }
        .lp-label { font-size: 13px; color: #4a4a46; margin-bottom: 6px; display: block; }
        .lp-input { width: 100%; padding: 11px 13px; background: #f9f8f5; border: 1px solid #e8e6e0; border-radius: 9px; color: #1a1a18; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color .2s; }
        .lp-input:focus { border-color: #2d6a4f; }
        .lp-input::placeholder { color: #9b9890; }
        .lp-auth-error { color: #dc2626; font-size: 13px; margin-bottom: 10px; padding: 8px 12px; background: #fef2f2; border-radius: 8px; border: 1px solid #fca5a5; }
        .lp-auth-submit { width: 100%; padding: 13px; background: #2d6a4f; border: none; border-radius: 10px; color: white; font-size: 15px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .2s; margin-top: 6px; }
        .lp-auth-submit:hover { background: #1b4332; transform: translateY(-1px); }
        .lp-auth-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        .lp-auth-terms { font-size: 12px; color: #9b9890; text-align: center; margin-top: 14px; line-height: 1.6; }
        .lp-auth-terms a { color: #2d6a4f; }
        .lp-switch-link { color: #2d6a4f; background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; padding: 0; text-decoration: underline; }
        .lp-auth-or { text-align: center; font-size: 12px; color: #9b9890; margin: 16px 0; }
        .lp-footer { border-top: 1px solid #e8e6e0; padding: 36px 60px; display: flex; align-items: center; justify-content: space-between; background: #fafaf8; }
        .lp-footer-logo { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 700; color: #1a1a18; }
        .lp-footer-logo span { color: #2d6a4f; }
        .lp-footer-copy { font-size: 13px; color: #9b9890; }
        .lp-footer-links { display: flex; gap: 24px; }
        .lp-footer-links a { font-size: 13px; color: #9b9890; text-decoration: none; }
        .lp-footer-links a:hover { color: #1a1a18; }
        @media(max-width: 900px) {
          .lp-nav { padding: 16px 24px; }
          .lp-nav-links { display: none; }
          .lp-hero { grid-template-columns: 1fr; padding: 48px 24px; gap: 40px; }
          .lp-section { padding: 60px 24px; }
          .lp-feat-grid { grid-template-columns: 1fr; }
          .lp-feat-grid.rev { direction: ltr; }
          .lp-steps-grid { grid-template-columns: 1fr; }
          .lp-step-arrow { display: none; }
          .lp-pricing { padding: 60px 24px; }
          .lp-pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin: 48px auto 0; }
          .lp-testi-band { padding: 48px 24px; }
          .lp-auth { padding: 48px 24px; }
          .lp-auth-wrap { grid-template-columns: 1fr; }
          .lp-auth-left { display: none; }
          .lp-auth-right { padding: 36px 24px; }
          .lp-footer { flex-direction: column; gap: 20px; text-align: center; padding: 32px 24px; }
          .lp-cal-week { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

      <div className="lp">

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
          <a href="#auth" className="lp-nav-cta">Commencer gratuitement</a>
        </nav>

        {/* HERO */}
        <div className="lp-hero">
          <div>
            <div className="lp-hero-tag"><div className="lp-hero-dot" />Conçu pour l&apos;EDN &amp; le PASS</div>
            <h1 className="lp-h1">Révise moins,<br /><em>retiens plus.</em></h1>
            <p className="lp-hero-p">La révision espacée intelligente, avec des QCM générés par IA sur tes propres cours. Zéro effort d&apos;organisation.</p>
            <div className="lp-hero-btns">
              <a href="#auth" className="lp-btn">Créer mon compte gratuit →</a>
              <a href="#how" className="lp-btn-outline">Comment ça marche</a>
            </div>
            <div className="lp-trust">
              <div className="lp-trust-item"><div className="lp-trust-check">✓</div>Gratuit pour commencer</div>
              <div className="lp-trust-item"><div className="lp-trust-check">✓</div>RGPD · France</div>
              <div className="lp-trust-item"><div className="lp-trust-check">✓</div>Sans engagement</div>
            </div>
          </div>
          <div>
            <div className="lp-app-card">
              <div className="lp-app-bar">
                <div className="lp-app-dots">
                  <div className="lp-app-dot" style={{background:'#ef4444'}} />
                  <div className="lp-app-dot" style={{background:'#f59e0b'}} />
                  <div className="lp-app-dot" style={{background:'#22c55e'}} />
                </div>
                <div className="lp-app-url">med-rev-eight.vercel.app/dashboard</div>
              </div>
              <div className="lp-app-body">
                <div className="lp-app-sb">
                  <div className="lp-app-logo">Med<span>Rev</span></div>
                  <div className="lp-app-navlabel">Navigation</div>
                  <div className="lp-app-item on">📋 Fiches</div>
                  <div className="lp-app-item">📅 Calendrier</div>
                  <div className="lp-app-item">📊 Stats</div>
                  <div className="lp-app-item">⭐ Premium</div>
                </div>
                <div className="lp-app-main">
                  <div className="lp-app-main-h">Toutes les fiches</div>
                  {[
                    {title:'❤️ Cardio', name:'Insuffisance cardiaque', score:'7/10', bg:'#2d6a4f', steps:[1,1,2,0,0,0]},
                    {title:'🫁 Pneumo', name:'Asthme sévère', score:'5/10', bg:'#d97706', steps:[1,1,1,2,0,0]},
                  ].map((f,i) => (
                    <div key={i} className="lp-app-fiche">
                      <div className="lp-app-fiche-title">{f.title}</div>
                      <div className="lp-app-row">
                        <div className="lp-app-badge">{f.name}</div>
                        <div className="lp-app-score" style={{background:f.bg}}>{f.score}</div>
                      </div>
                      <div className="lp-app-steps">
                        {f.steps.map((s,j) => (
                          <div key={j} className={`lp-app-step${s===1?' done':s===2?' now':''}`}>
                            {['J0','J1','J3','J7','J15','J30'][j]}
                          </div>
                        ))}
                      </div>
                      <div className="lp-app-date">📅 {i===0?"Aujourd'hui · J3":"Demain · J7"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="lp-section" id="how">
          <span className="lp-sec-label">Comment ça marche</span>
          <h2 className="lp-sec-title">De zéro à une fiche révisée<br /><em>en 60 secondes.</em></h2>
          <div className="lp-steps-grid">
            {[
              {n:'01', icon:'📋', title:'Crée ta fiche', desc:"Donne un nom, choisis une matière. MedRev planifie automatiquement 14 étapes de révision espacée de J0 à J+120, basées sur la courbe d'oubli d'Ebbinghaus.", arrow:true},
              {n:'02', icon:'✨', title:'Génère les questions', desc:"Colle ton cours ou uploade un PDF. L'IA génère des QCM, KFP et V/F niveau annales EDN, personnalisés sur ton contenu — pas des questions génériques.", arrow:true},
              {n:'03', icon:'📅', title:'Révise au bon moment', desc:"Le calendrier te dit chaque jour quelles fiches réviser. Note ta session, MedRev ajuste ta progression automatiquement sur toutes les étapes.", arrow:false},
            ].map(s => (
              <div key={s.n} className="lp-step-card">
                <div className="lp-step-num">{s.n}</div>
                <span className="lp-step-icon">{s.icon}</span>
                <div className="lp-step-title">{s.title}</div>
                <div className="lp-step-desc">{s.desc}</div>
                {s.arrow && <div className="lp-step-arrow" />}
              </div>
            ))}
          </div>
        </div>

        {/* FEATURE 1 : QCM IA */}
        <div className="lp-section" id="features">
          <span className="lp-sec-label">Fonctionnalité 1</span>
          <div className="lp-feat-grid">
            <div>
              <div className="lp-feat-tag">QCM IA</div>
              <h3 className="lp-feat-h3">Des questions <em>niveau annales EDN</em> sur ton cours.</h3>
              <p className="lp-feat-p">Colle tes notes ou uploade un PDF. MedRev génère des QCM, KFP et Vrai/Faux calibrés sur le niveau des vraies annales — en quelques secondes.</p>
              <ul className="lp-feat-list">
                <li>Choisis le nombre de questions (5 à 20)</li>
                <li>3 formats : QCM, KFP, Vrai/Faux ou Mix</li>
                <li>Niveau ajustable : entraînement ou annales EDN</li>
                <li>Upload PDF de cours (Premium)</li>
              </ul>
            </div>
            <div className="lp-mockup-wrap">
              <div className="lp-qcm">
                <div className="lp-qcm-left">
                  <div className="lp-qcm-label">14 étapes</div>
                  <div className="lp-qcm-grid">
                    {['J0','J1','J3','J7','J15','J21','J30','J45','J60','J75','J90','J105','J120'].map((j,i) => (
                      <div key={j} className={`lp-qcm-box${i===1?' now':''}`}><span>{j}</span></div>
                    ))}
                  </div>
                </div>
                <div className="lp-qcm-right">
                  <div className="lp-qcm-header">✨ QCM IA — niveau annales EDN</div>
                  <div className="lp-qcm-tabs">
                    <div className="lp-qcm-tab on">📋 Coller le cours</div>
                    <div className="lp-qcm-tab off">📄 PDF</div>
                  </div>
                  <div className="lp-qcm-textarea">Insuffisance cardiaque aiguë : défaillance brutale de la fonction de pompe. Étiologies : SCA, poussée HTA, arythmie…</div>
                  <div className="lp-qcm-controls">
                    <span style={{fontSize:'10px',color:'#9b9890'}}>Questions</span>
                    <div className="lp-qcm-sel">10 ▾</div>
                    <span style={{fontSize:'10px',color:'#9b9890'}}>Format</span>
                    <div className="lp-qcm-sel">Mixte ▾</div>
                    <span style={{fontSize:'10px',color:'#9b9890'}}>Niveau</span>
                    <div className="lp-qcm-sel">Annales ▾</div>
                  </div>
                  <div className="lp-qcm-btn">🤖 Générer les questions</div>
                  <div className="lp-qcm-q">
                    <div className="lp-qcm-qt">1ère cause d&apos;insuffisance cardiaque aiguë en France ?</div>
                    <div className="lp-qcm-opt ok"><div className="lp-radio" />Syndrome coronarien aigu</div>
                    <div className="lp-qcm-opt no"><div className="lp-radio" />Fibrillation atriale</div>
                    <div className="lp-qcm-opt"><div className="lp-radio" />Poussée hypertensive</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 2 : CALENDRIER */}
        <div className="lp-section">
          <div className="lp-feat-grid rev">
            <div className="lp-mockup-wrap">
              <div className="lp-cal">
                <div className="lp-cal-header">
                  <div className="lp-cal-btn">← Préc.</div>
                  <div className="lp-cal-range">24 – 30 mars 2026</div>
                  <div className="lp-cal-btn">Suiv. →</div>
                  <div className="lp-cal-btn" style={{background:'#e8f5ee',color:'#2d6a4f',borderColor:'#b7dfca'}}>Aujourd&apos;hui</div>
                </div>
                <div className="lp-cal-week">
                  <div className="lp-cal-day"><div className="lp-cal-dn">LUN</div><div className="lp-cal-num">24</div><div className="lp-cal-ev done">Cardio · J3</div></div>
                  <div className="lp-cal-day"><div className="lp-cal-dn">MAR</div><div className="lp-cal-num">25</div><div className="lp-cal-ev done">Pneumo</div><div className="lp-cal-ev done">Neuro</div></div>
                  <div className="lp-cal-day"><div className="lp-cal-dn">MER</div><div className="lp-cal-num">26</div></div>
                  <div className="lp-cal-day today"><div className="lp-cal-dn">JEU</div><div className="lp-cal-num">27</div><div className="lp-cal-ev planned">Cardio · J7</div><div className="lp-cal-ev planned">Dermato</div></div>
                  <div className="lp-cal-day"><div className="lp-cal-dn">VEN</div><div className="lp-cal-num">28</div><div className="lp-cal-ev up">Pneumo</div></div>
                  <div className="lp-cal-day"><div className="lp-cal-dn">SAM</div><div className="lp-cal-num">29</div><div className="lp-cal-ev up">Neuro</div></div>
                  <div className="lp-cal-day"><div className="lp-cal-dn">DIM</div><div className="lp-cal-num">30</div></div>
                </div>
              </div>
            </div>
            <div>
              <div className="lp-feat-tag">Calendrier de révision</div>
              <h3 className="lp-feat-h3">Sache exactement<br /><em>quoi réviser chaque jour.</em></h3>
              <p className="lp-feat-p">Plus jamais de &quot;j&apos;ai oublié de réviser ça&quot;. Le calendrier calcule automatiquement toutes tes échéances et les affiche jour par jour.</p>
              <ul className="lp-feat-list">
                <li>Vue hebdomadaire avec toutes tes fiches planifiées</li>
                <li>Code couleur : Faite · Planifiée · À venir</li>
                <li>Clic sur une fiche → accès direct à la révision</li>
                <li>Badge &quot;à réviser aujourd&apos;hui&quot; dans la sidebar</li>
              </ul>
            </div>
          </div>
        </div>

        {/* TESTIMONIAL */}
        <div className="lp-testi-band">
          <div className="lp-testi-inner">
            <div className="lp-testi-stars">★★★★★</div>
            <div className="lp-testi-quote">&quot;J&apos;ai arrêté de relire mes cours en boucle. MedRev me dit exactement quoi réviser chaque matin — j&apos;ai gagné 2h par jour.&quot;</div>
            <div className="lp-testi-author">— Étudiante en médecine, P2 · Faculté de Lyon</div>
          </div>
        </div>

        {/* PRICING */}
        <div className="lp-pricing" id="pricing">
          <span className="lp-sec-label" style={{display:'block',textAlign:'center',marginBottom:'12px'}}>Tarifs</span>
          <h2 className="lp-sec-title" style={{textAlign:'center'}}>Simple. <em>Sans engagement.</em></h2>
          <p className="lp-sec-sub" style={{margin:'0 auto',textAlign:'center'}}>Commence gratuitement. Passe Premium quand tu es prêt·e.</p>
          <div className="lp-pricing-grid">
            <div className="lp-pc">
              <div className="lp-pc-plan">Gratuit</div>
              <div className="lp-pc-price free">0€</div>
              <div className="lp-pc-period">pour toujours</div>
              <hr className="lp-pc-div" />
              {["Jusqu'à 15 fiches","Révision espacée J0→J+120","Calendrier de révision","Module Voyage (2 passages)","Export / Import JSON"].map(f=>(
                <div key={f} className="lp-pc-feat on"><span className="lp-pc-check">✓</span> {f}</div>
              ))}
              {["QCM IA (upload cours PDF)","Fiches illimitées","Synchro multi-appareils"].map(f=>(
                <div key={f} className="lp-pc-feat off"><span className="lp-pc-cross">✗</span> {f}</div>
              ))}
              <button className="lp-pc-cta free" onClick={() => document.getElementById('auth')?.scrollIntoView({behavior:'smooth'})}>Commencer gratuitement</button>
            </div>
            <div>
              <div className="lp-pc-rec"><span>⭐ Recommandé</span></div>
              <div className="lp-pc feat">
                <div className="lp-pc-plan">Premium</div>
                <div className="lp-pc-price">9,99€</div>
                <div className="lp-pc-period">/mois · sans engagement</div>
                <hr className="lp-pc-div" />
                {["Fiches illimitées","Révision espacée J0→J+120","Calendrier de révision","Module Voyage (2 passages)","Export / Import JSON","✨ QCM IA profonds (upload PDF)","✨ Formats EDN : QCM, KFP, V/F","✨ Synchro cloud (bientôt)"].map(f=>(
                  <div key={f} className="lp-pc-feat on"><span className="lp-pc-check">✓</span> {f}</div>
                ))}
                <button className="lp-pc-cta prem" onClick={() => document.getElementById('auth')?.scrollIntoView({behavior:'smooth'})}>Passer Premium →</button>
              </div>
            </div>
          </div>
          <p style={{textAlign:'center',fontSize:'13px',color:'#9b9890',marginTop:'24px'}}>
            🔒 Paiement sécurisé via Stripe · Données hébergées en France (RGPD)
          </p>
        </div>

        {/* AUTH */}
        <div className="lp-auth" id="auth">
          <div className="lp-auth-wrap">
            <div className="lp-auth-left">
              <div>
                <div className="lp-auth-lt">Commence à retenir<br /><em>pour de bon.</em></div>
                <p className="lp-auth-lsub">Rejoins les étudiants en médecine qui préparent l&apos;EDN avec MedRev. Gratuit pour commencer.</p>
              </div>
              <div className="lp-auth-testi">
                <div className="lp-auth-stars">★★★★★</div>
                <div className="lp-auth-testi-text">&quot;J&apos;ai arrêté de relire mes cours en boucle. MedRev me dit exactement quoi réviser chaque matin.&quot;</div>
                <div className="lp-auth-testi-author">— Étudiante P2 · Lyon</div>
              </div>
            </div>
            <div className="lp-auth-right">
              <div className="lp-auth-tabs">
                <button className={`lp-auth-tab${activeTab==='register'?' active':''}`} onClick={() => { setActiveTab('register'); setError(null); }}>Créer un compte</button>
                <button className={`lp-auth-tab${activeTab==='login'?' active':''}`} onClick={() => { setActiveTab('login'); setError(null); }}>Se connecter</button>
              </div>
              {error && <div className="lp-auth-error">{error}</div>}
              {activeTab === 'register' && (
                <div>
                  <div className="lp-form-group"><label className="lp-label">Nom d&apos;utilisateur</label><input type="text" className="lp-input" placeholder="ex : lou_medecine" value={username} onChange={e => setUsername(e.target.value)} /></div>
                  <div className="lp-form-group"><label className="lp-label">Adresse email</label><input type="email" className="lp-input" placeholder="prenom@univ-medecine.fr" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div className="lp-form-group"><label className="lp-label">Mot de passe</label><input type="password" className="lp-input" placeholder="Minimum 8 caractères" value={password} onChange={e => setPassword(e.target.value)} /></div>
                  <button className="lp-auth-submit" onClick={handleRegister} disabled={loading}>{loading ? 'Création en cours…' : 'Créer mon compte gratuit →'}</button>
                  <p className="lp-auth-terms">En créant un compte, tu acceptes nos <a href="/privacy">CGU</a>. Données en France 🇫🇷</p>
                </div>
              )}
              {activeTab === 'login' && (
                <div>
                  <div className="lp-form-group"><label className="lp-label">Adresse email</label><input type="email" className="lp-input" placeholder="ton@email.fr" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div className="lp-form-group"><label className="lp-label">Mot de passe</label><input type="password" className="lp-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} /></div>
                  <button className="lp-auth-submit" onClick={handleLogin} disabled={loading}>{loading ? 'Connexion en cours…' : 'Se connecter →'}</button>
                  <div className="lp-auth-or">ou</div>
                  <p style={{textAlign:'center',fontSize:'13px',color:'#9b9890'}}>
                    Pas encore de compte ?{' '}
                    <button className="lp-switch-link" onClick={() => { setActiveTab('register'); setError(null); }}>Créer un compte gratuit</button>
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
            <div style={{fontSize:'12px',color:'#9b9890',marginTop:'4px'}}>Révision médicale intelligente</div>
          </div>
          <div className="lp-footer-copy">© 2026 MedRev · Données hébergées en France 🇫🇷 · RGPD</div>
          <div className="lp-footer-links">
            <Link href="/privacy">Mentions légales</Link>
            <Link href="/privacy">CGU</Link>
            <Link href="/auth">Contact</Link>
          </div>
        </footer>

      </div>
    </>
  )
}
