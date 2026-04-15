'use client'
// src/components/LandingPage.tsx

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const FACS = [
  { id: 'sorbonne', name: 'Sorbonne Université', badge: 'Paris 6', hasOptions: true },
  { id: 'paris-cite', name: 'Université Paris Cité', badge: 'Paris 5', hasOptions: false },
  { id: 'sorbonne-paris-nord', name: 'Sorbonne Paris Nord', badge: 'Paris 13', hasOptions: false },
  { id: 'upec', name: 'UPEC Créteil', badge: 'Paris 12', hasOptions: false },
  { id: 'lyon', name: 'Université de Lyon', badge: 'Lyon', hasOptions: false },
  { id: 'montpellier', name: 'Université de Montpellier', badge: 'Montpellier', hasOptions: false },
  { id: 'autre', name: 'Autre faculté', badge: 'Autre', hasOptions: false },
]

const FAC_SYSTEMS: Record<string, Record<string, { name: string; icon: string; semestre: number }[]>> = {
  sorbonne: {
    sciences: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Physique', icon: '⚡', semestre: 1 },
      { name: 'Chimie', icon: '🔭', semestre: 1 },
      { name: 'Biophysique', icon: '📊', semestre: 2 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
      { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
    ],
    lettres: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Sociolinguistique', icon: '📚', semestre: 1 },
      { name: 'Linguistique', icon: '🗣️', semestre: 1 },
      { name: 'Biophysique', icon: '📊', semestre: 2 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
      { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
    ],
  },
  'paris-cite': {
    default: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Physique', icon: '⚡', semestre: 1 },
      { name: 'Chimie', icon: '🔭', semestre: 1 },
      { name: 'Biophysique', icon: '📊', semestre: 2 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
      { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
    ],
  },
  'sorbonne-paris-nord': {
    default: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Physique', icon: '⚡', semestre: 1 },
      { name: 'Chimie', icon: '🔭', semestre: 1 },
      { name: 'Biophysique', icon: '📊', semestre: 2 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
      { name: 'Anatomie spécifique', icon: '🫀', semestre: 2 },
    ],
  },
  upec: {
    default: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
    ],
  },
  lyon: {
    default: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
    ],
  },
  montpellier: {
    default: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
    ],
  },
  autre: {
    default: [
      { name: 'Biochimie', icon: '🧪', semestre: 1 },
      { name: 'Biologie cellulaire', icon: '🔬', semestre: 1 },
      { name: 'Anatomie générale', icon: '🦴', semestre: 1 },
      { name: 'Physiologie', icon: '❤️', semestre: 2 },
      { name: 'Biostatistiques', icon: '📈', semestre: 2 },
      { name: 'Pharmacologie', icon: '💊', semestre: 2 },
      { name: 'Santé, Société, Humanité', icon: '🌍', semestre: 2 },
    ],
  },
}

type Step = 'form' | 'fac' | 'option'

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register')
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fac, setFac] = useState('')
  const [option, setOption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const selectedFac = FACS.find(f => f.id === fac)

  const handleContinueForm = () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Merci de remplir tous les champs.')
      return
    }
    setError(null)
    setStep('fac')
  }

  const handleContinueFac = () => {
    if (!fac) return
    if (selectedFac?.hasOptions) {
      setStep('option')
    } else {
      handleRegister(fac, 'default')
    }
  }

  const handleRegister = async (facId: string, opt: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, fac: facId, option: opt } }
      })
      if (error) throw error
      if (!data.user) throw new Error('Erreur création compte')

      await supabase.from('profiles').update({ username, fac: facId }).eq('id', data.user.id)

      const matieres = FAC_SYSTEMS[facId]?.[opt] || FAC_SYSTEMS[facId]?.['default'] || FAC_SYSTEMS['autre']['default']
      if (matieres?.length) {
        await supabase.from('systems').insert(
          matieres.map(m => ({
            user_id: data.user!.id,
            name: m.name,
            icon: m.icon,
            semestre: m.semestre,
            cal_hidden: false,
          }))
        )
      }

      window.location.href = '/dashboard'
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  const totalSteps = selectedFac?.hasOptions ? 3 : 2
  const currentStepNum = step === 'form' ? 1 : step === 'fac' ? 2 : 3

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,500;0,700;1,300;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');

        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --cream: #F5F1EA;
          --dark: #111310;
          --green: #1B4332;
          --gm: #2D6A4F;
          --gl: #D8EAE0;
          --amber: #C47B2B;
          --al: #FBF0E0;
          --gray: #6B7280;
          --border: #DDD8CE;
          --fh: 'Fraunces', Georgia, serif;
          --fb: 'Plus Jakarta Sans', sans-serif;
        }

        .lp { font-family: var(--fb); background: var(--cream); color: var(--dark); overflow-x: hidden; }

        /* NAV */
        .lp-nav { display: flex; align-items: center; justify-content: space-between; padding: 0 48px; height: 64px; border-bottom: 1px solid var(--border); background: var(--cream); position: sticky; top: 0; z-index: 100; }
        .lp-logo { font-family: var(--fh); font-size: 22px; font-weight: 700; color: var(--dark); text-decoration: none; }
        .lp-logo span { color: var(--gm); }
        .lp-nav-links { display: flex; gap: 28px; }
        .lp-nav-links a { font-size: 14px; color: var(--gray); text-decoration: none; font-weight: 500; }
        .lp-nav-links a:hover { color: var(--dark); }
        .lp-nav-cta { background: var(--green); color: white; border: none; font-family: var(--fb); font-size: 14px; font-weight: 600; padding: 10px 22px; border-radius: 8px; cursor: pointer; }
        .lp-nav-cta:hover { background: #1a3d2e; }

        /* HERO */
        .lp-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; padding: 72px 48px 80px; max-width: 1160px; margin: 0 auto; }
        .lp-eyebrow { display: inline-block; font-size: 11px; font-weight: 700; color: var(--amber); text-transform: uppercase; letter-spacing: .09em; background: var(--al); border: 1px solid #E8C89A; border-radius: 4px; padding: 4px 11px; margin-bottom: 24px; }
        .lp-h1 { font-family: var(--fh); font-size: clamp(36px, 4vw, 52px); line-height: 1.1; font-weight: 500; color: var(--dark); margin-bottom: 20px; }
        .lp-h1 em { font-style: italic; color: var(--gm); }
        .lp-hero-p { font-size: 16px; line-height: 1.75; color: var(--gray); margin-bottom: 32px; }
        .lp-hero-btns { display: flex; align-items: center; gap: 12px; margin-bottom: 36px; flex-wrap: wrap; }
        .lp-btn { background: var(--green); color: white; border: none; font-family: var(--fb); font-size: 15px; font-weight: 600; padding: 13px 26px; border-radius: 9px; cursor: pointer; }
        .lp-btn:hover { background: #1a3d2e; }
        .lp-btn-outline { background: transparent; border: 1.5px solid var(--border); font-family: var(--fb); font-size: 15px; font-weight: 500; padding: 12px 20px; border-radius: 9px; cursor: pointer; color: var(--dark); display: flex; align-items: center; gap: 8px; }
        .lp-btn-play { width: 20px; height: 20px; background: var(--dark); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 7px; }
        .lp-trust { display: flex; gap: 20px; flex-wrap: wrap; }
        .lp-trust-item { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--gray); }
        .lp-trust-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--gm); }

        /* APP PREVIEW */
        .lp-app-preview { background: white; border: 1px solid var(--border); border-radius: 15px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.07); }
        .lp-app-bar { background: #F3F0E8; border-bottom: 1px solid var(--border); padding: 10px 14px; display: flex; align-items: center; gap: 6px; }
        .lp-dot { width: 9px; height: 9px; border-radius: 50%; }
        .lp-dot-r { background: #FF5F57; }
        .lp-dot-y { background: #FFBD2E; }
        .lp-dot-g { background: #28CA41; }
        .lp-app-bar span { margin-left: 8px; font-size: 11.5px; color: var(--gray); }
        .lp-app-body { padding: 16px; }
        .lp-upload-zone { border: 1.5px dashed var(--border); border-radius: 9px; padding: 22px 14px; text-align: center; margin-bottom: 12px; background: #FAFAF8; }
        .lp-upload-zone strong { font-size: 13.5px; font-weight: 600; color: var(--dark); display: block; margin-bottom: 5px; }
        .lp-upload-zone p { font-size: 12px; color: var(--gray); line-height: 1.5; }
        .lp-upload-tags { display: flex; gap: 5px; justify-content: center; margin-top: 9px; flex-wrap: wrap; }
        .lp-tag { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
        .lp-tag-g { background: var(--gl); color: var(--green); }
        .lp-tag-a { background: var(--al); color: var(--amber); }
        .lp-qcm-box { background: var(--gl); border-radius: 9px; padding: 13px; }
        .lp-qcm-label { font-size: 10px; font-weight: 700; color: var(--green); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 7px; }
        .lp-qcm-q { font-size: 12.5px; font-weight: 600; color: var(--dark); margin-bottom: 9px; line-height: 1.4; }
        .lp-qcm-opts { display: flex; flex-direction: column; gap: 4px; }
        .lp-qcm-opt { font-size: 11.5px; padding: 6px 10px; border-radius: 6px; background: white; color: var(--gray); }
        .lp-qcm-opt-ok { background: var(--green); color: white; font-weight: 600; }
        .lp-qcm-opt-ko { background: #FEE2E2; color: #B91C1C; text-decoration: line-through; }
        .lp-qcm-src { margin-top: 7px; font-size: 11px; color: var(--gm); font-weight: 500; }
        .lp-qcm-src span { background: white; border-radius: 4px; padding: 2px 7px; }

        /* SECTIONS */
        .lp-section { padding: 72px 48px; max-width: 1160px; margin: 0 auto; }
        .lp-section-white { background: white; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .lp-section-label { font-size: 11px; font-weight: 700; color: var(--gm); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 12px; }
        .lp-section-title { font-family: var(--fh); font-size: clamp(28px, 3vw, 36px); font-weight: 500; line-height: 1.15; color: var(--dark); max-width: 480px; margin-bottom: 44px; }

        /* STEPS */
        .lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .lp-step { padding: 24px; background: white; border: 1px solid var(--border); border-radius: 13px; }
        .lp-step-num { width: 32px; height: 32px; border-radius: 8px; background: var(--gl); color: var(--green); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 13px; }
        .lp-step h3 { font-family: var(--fh); font-size: 18px; font-weight: 500; margin-bottom: 7px; }
        .lp-step p { font-size: 13px; color: var(--gray); line-height: 1.6; }
        .lp-new-tag { display: inline-block; margin-top: 9px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 3px 9px; border-radius: 20px; background: var(--al); color: var(--amber); }

        /* DIFF */
        .lp-diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; align-items: center; }
        .lp-diff-cards { display: flex; flex-direction: column; gap: 11px; }
        .lp-diff-card { display: flex; align-items: flex-start; gap: 13px; padding: 17px; background: white; border: 1px solid var(--border); border-radius: 11px; }
        .lp-diff-icon { width: 36px; height: 36px; min-width: 36px; border-radius: 8px; background: var(--gl); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--green); }
        .lp-diff-card h4 { font-size: 13.5px; font-weight: 600; margin-bottom: 3px; }
        .lp-diff-card p { font-size: 12.5px; color: var(--gray); line-height: 1.5; }

        /* PRICING */
        .lp-pricing-bg { background: var(--dark); padding: 72px 48px; }
        .lp-pricing-inner { max-width: 1160px; margin: 0 auto; }
        .lp-pricing-title { font-family: var(--fh); font-size: clamp(28px, 3vw, 36px); font-weight: 500; color: white; text-align: center; margin-bottom: 7px; }
        .lp-pricing-sub { font-size: 15px; color: rgba(255,255,255,.42); text-align: center; margin-bottom: 40px; }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 700px; margin: 0 auto; }
        .lp-pcard { border-radius: 15px; padding: 26px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
        .lp-pcard-ft { background: white; border-color: white; }
        .lp-pcard-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: rgba(255,255,255,.38); margin-bottom: 16px; }
        .lp-pcard-ft .lp-pcard-name { color: var(--gm); }
        .lp-pcard-price { font-family: var(--fh); font-size: 44px; font-weight: 500; color: white; line-height: 1; margin-bottom: 5px; }
        .lp-pcard-ft .lp-pcard-price { color: var(--dark); }
        .lp-pcard-price sub { font-family: var(--fb); font-size: 14px; }
        .lp-pcard-desc { font-size: 12.5px; color: rgba(255,255,255,.32); margin-bottom: 20px; }
        .lp-pcard-ft .lp-pcard-desc { color: var(--gray); }
        .lp-pcard-features { list-style: none; display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
        .lp-pcard-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: rgba(255,255,255,.62); }
        .lp-pcard-ft .lp-pcard-features li { color: var(--dark); }
        .lp-pcard-features li::before { content: '✓'; color: var(--gm); font-weight: 700; font-size: 12px; margin-top: 1px; }
        .lp-pcard-btn { width: 100%; padding: 11px; border-radius: 8px; font-family: var(--fb); font-size: 14px; font-weight: 600; cursor: pointer; border: 1.5px solid rgba(255,255,255,.16); background: transparent; color: white; }
        .lp-pcard-ft .lp-pcard-btn { background: var(--green); border-color: var(--green); color: white; }

        /* AUTH */
        .lp-auth { padding: 72px 48px; background: var(--cream); }
        .lp-auth-wrap { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
        .lp-auth-left-title { font-family: var(--fh); font-size: 32px; font-weight: 500; line-height: 1.2; margin-bottom: 12px; }
        .lp-auth-left-title em { font-style: italic; color: var(--gm); }
        .lp-auth-left-sub { font-size: 14px; color: var(--gray); line-height: 1.6; margin-bottom: 24px; }
        .lp-auth-testi { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
        .lp-auth-stars { color: #F59E0B; font-size: 13px; margin-bottom: 8px; }
        .lp-auth-testi-text { font-size: 13px; color: var(--dark); line-height: 1.6; margin-bottom: 8px; }
        .lp-auth-testi-author { font-size: 11.5px; color: var(--gray); font-weight: 500; }
        .lp-auth-card { background: white; border: 1px solid var(--border); border-radius: 14px; padding: 28px; }
        .lp-auth-tabs { display: flex; gap: 4px; background: #F0EDE6; border-radius: 9px; padding: 4px; margin-bottom: 22px; }
        .lp-auth-tab { flex: 1; padding: 8px; border-radius: 7px; border: none; font-family: var(--fb); font-size: 13px; font-weight: 500; cursor: pointer; background: transparent; color: var(--gray); }
        .lp-auth-tab-active { background: white; color: var(--dark); box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .lp-auth-error { background: #FEE2E2; color: #B91C1C; font-size: 12.5px; padding: 10px 13px; border-radius: 8px; margin-bottom: 14px; border: 1px solid #FCA5A5; }
        .lp-prog-dots { display: flex; gap: 6px; margin-bottom: 16px; }
        .lp-prog-dot { width: 8px; height: 8px; border-radius: 50%; background: #E5E0D8; }
        .lp-prog-dot-on { background: var(--gm); width: 20px; border-radius: 4px; }
        .lp-prog-dot-done { background: var(--gm); }
        .lp-form-group { margin-bottom: 14px; }
        .lp-label { display: block; font-size: 12px; font-weight: 600; color: var(--dark); margin-bottom: 5px; }
        .lp-input { width: 100%; padding: 10px 13px; border: 1.5px solid var(--border); border-radius: 8px; font-family: var(--fb); font-size: 13.5px; color: var(--dark); outline: none; background: white; }
        .lp-input:focus { border-color: var(--gm); }
        .lp-submit { width: 100%; padding: 11px; border-radius: 8px; border: none; background: var(--green); color: white; font-family: var(--fb); font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 6px; }
        .lp-submit:disabled { opacity: .6; cursor: not-allowed; }
        .lp-terms { font-size: 11.5px; color: var(--gray); text-align: center; margin-top: 10px; }
        .lp-terms a { color: var(--gm); text-decoration: none; }
        .lp-step-title { font-size: 15px; font-weight: 600; color: var(--dark); margin-bottom: 4px; }
        .lp-step-sub { font-size: 12.5px; color: var(--gray); margin-bottom: 14px; }
        .lp-back-btn { background: none; border: none; font-family: var(--fb); font-size: 12.5px; color: var(--gray); cursor: pointer; padding: 0; margin-bottom: 12px; }
        .lp-fac-grid { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
        .lp-fac-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 13px; border: 1.5px solid var(--border); border-radius: 9px; cursor: pointer; font-size: 13px; font-weight: 500; background: white; }
        .lp-fac-item-sel { border-color: var(--gm); background: var(--gl); color: var(--green); }
        .lp-fac-badge { font-size: 10px; font-weight: 700; background: var(--gl); color: var(--green); border-radius: 20px; padding: 2px 8px; }
        .lp-fac-item-sel .lp-fac-badge { background: white; }
        .lp-opt-grid { display: flex; flex-direction: column; gap: 9px; margin-bottom: 14px; }
        .lp-opt-card { padding: 14px; border: 1.5px solid var(--border); border-radius: 10px; cursor: pointer; background: white; }
        .lp-opt-card-sel { border-color: var(--gm); background: var(--gl); }
        .lp-opt-card-title { font-size: 13.5px; font-weight: 600; color: var(--dark); margin-bottom: 3px; }
        .lp-opt-card-desc { font-size: 11.5px; color: var(--gray); }
        .lp-opt-card-matieres { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .lp-opt-matiere { font-size: 10px; font-weight: 600; background: var(--gl); color: var(--green); border-radius: 20px; padding: 2px 7px; }

        /* FOOTER */
        .lp-footer { background: var(--cream); border-top: 1px solid var(--border); padding: 20px 48px; display: flex; align-items: center; justify-content: space-between; }
        .lp-footer p { font-size: 13px; color: var(--gray); }
        .lp-footer-links { display: flex; gap: 16px; }
        .lp-footer-links a { font-size: 13px; color: var(--gray); text-decoration: none; }
        .lp-footer-links a:hover { color: var(--dark); }

        @media (max-width: 900px) {
          .lp-nav { padding: 0 20px; }
          .lp-nav-links { display: none; }
          .lp-hero { grid-template-columns: 1fr; padding: 48px 20px; gap: 36px; }
          .lp-section { padding: 48px 20px; }
          .lp-steps { grid-template-columns: 1fr; }
          .lp-diff-grid { grid-template-columns: 1fr; }
          .lp-pricing-bg { padding: 48px 20px; }
          .lp-pricing-grid { grid-template-columns: 1fr; }
          .lp-auth { padding: 48px 20px; }
          .lp-auth-wrap { grid-template-columns: 1fr; gap: 32px; }
          .lp-footer { flex-direction: column; gap: 12px; text-align: center; padding: 20px; }
        }
      `}</style>

      <div className="lp">

        {/* NAV */}
        <nav className="lp-nav">
          <a href="#" className="lp-logo">Med<span>Rev</span></a>
          <div className="lp-nav-links">
            <a href="#how">Comment ça marche</a>
            <a href="#features">Fonctionnalités</a>
            <a href="#pricing">Tarifs</a>
          </div>
          <button className="lp-nav-cta" onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>
            Commencer gratuitement
          </button>
        </nav>

        {/* HERO */}
        <div className="lp-hero">
          <div>
            <div className="lp-eyebrow">La méthode des prépas, sans les frais</div>
            <h1 className="lp-h1">La médecine<br />devrait être<br /><em>méritocratique.</em></h1>
            <p className="lp-hero-p">Les prépas coûtent jusqu&apos;à 400 €/mois. MedRev te donne les mêmes outils — QCMs générés depuis tes cours, répétition espacée, planning automatique — gratuitement.</p>
            <div className="lp-hero-btns">
              <button className="lp-btn" onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>
                Commencer gratuitement →
              </button>
              <button className="lp-btn-outline">
                <span className="lp-btn-play">▶</span>
                Voir la démo
              </button>
            </div>
            <div className="lp-trust">
              <div className="lp-trust-item"><span className="lp-trust-dot"></span> Gratuit pour démarrer</div>
              <div className="lp-trust-item"><span className="lp-trust-dot"></span> Données en France</div>
              <div className="lp-trust-item"><span className="lp-trust-dot"></span> Sans engagement</div>
            </div>
          </div>
          <div>
            <div className="lp-app-preview">
              <div className="lp-app-bar">
                <div className="lp-dot lp-dot-r"></div>
                <div className="lp-dot lp-dot-y"></div>
                <div className="lp-dot lp-dot-g"></div>
                <span>MedRev — Génération QCM</span>
              </div>
              <div className="lp-app-body">
                <div className="lp-upload-zone">
                  <strong>Colle le lien de ta rediffusion</strong>
                  <p>YouTube, Moodle, Panopto… ou upload un PDF de cours</p>
                  <div className="lp-upload-tags">
                    <span className="lp-tag lp-tag-g">Vidéo</span>
                    <span className="lp-tag lp-tag-g">PDF</span>
                    <span className="lp-tag lp-tag-a">Nouveau</span>
                  </div>
                </div>
                <div className="lp-qcm-box">
                  <div className="lp-qcm-label">Généré à l&apos;instant</div>
                  <div className="lp-qcm-q">Concernant le métabolisme du glucose, quelle affirmation est exacte ?</div>
                  <div className="lp-qcm-opts">
                    <div className="lp-qcm-opt lp-qcm-opt-ko">A. La glycolyse produit 36 ATP directement</div>
                    <div className="lp-qcm-opt lp-qcm-opt-ok">B. La phosphofructokinase est l&apos;enzyme régulatrice ✓</div>
                    <div className="lp-qcm-opt">C. Le pyruvate est formé dans la mitochondrie</div>
                  </div>
                  <div className="lp-qcm-src">Retour au cours : <span>Vidéo · 18:42</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COMMENT ÇA MARCHE */}
        <div className="lp-section-white" id="how">
          <div className="lp-section">
            <div className="lp-section-label">Comment ça marche</div>
            <div className="lp-section-title">Trois étapes, zéro organisation manuelle.</div>
            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-num">1</div>
                <h3>Importe ton cours</h3>
                <p>Colle un lien de rediffusion, upload un PDF ou copie tes notes. MedRev extrait l&apos;essentiel automatiquement.</p>
                <span className="lp-new-tag">Vidéo — Nouveau</span>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">2</div>
                <h3>MedRev génère les QCMs</h3>
                <p>Des questions calibrées sur le format de ton concours, avec retour direct vers le passage du cours si tu rates.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-num">3</div>
                <h3>Ton planning se construit seul</h3>
                <p>La courbe d&apos;Ebbinghaus et tes dates de partiels génèrent un calendrier quotidien qui s&apos;ajuste à ton avancement réel.</p>
              </div>
            </div>
          </div>
        </div>

        {/* POURQUOI PAS ANKI */}
        <div id="features">
          <div className="lp-section">
            <div className="lp-diff-grid">
              <div>
                <div className="lp-section-label">Pourquoi pas juste Anki ?</div>
                <div className="lp-section-title" style={{ marginBottom: 0 }}>MedRev est un coach, pas un carnet.</div>
              </div>
              <div className="lp-diff-cards">
                <div className="lp-diff-card">
                  <div className="lp-diff-icon">◎</div>
                  <div>
                    <h4>Apprentissage adaptatif</h4>
                    <p>MedRev détecte tes angles morts et t&apos;attaque un même concept sous différents angles jusqu&apos;à maîtrise complète.</p>
                  </div>
                </div>
                <div className="lp-diff-card">
                  <div className="lp-diff-icon">⊕</div>
                  <div>
                    <h4>Decks collaboratifs par promo</h4>
                    <p>Tes camarades importent les mêmes cours. La valeur grandit pour tout le monde, sans effort supplémentaire.</p>
                  </div>
                </div>
                <div className="lp-diff-card">
                  <div className="lp-diff-icon">◷</div>
                  <div>
                    <h4>Connecté à tes vraies dates</h4>
                    <p>Anki ne sait pas que tes partiels sont dans trois semaines. MedRev ajuste l&apos;intensité en conséquence.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div className="lp-pricing-bg" id="pricing">
          <div className="lp-pricing-inner">
            <div className="lp-pricing-title">Ton niveau ne devrait pas<br />dépendre de ton budget.</div>
            <div className="lp-pricing-sub">Commence gratuitement, passe Premium quand tu veux.</div>
            <div className="lp-pricing-grid">
              <div className="lp-pcard">
                <div className="lp-pcard-name">Gratuit</div>
                <div className="lp-pcard-price">0 <sub>€</sub></div>
                <div className="lp-pcard-desc">Pour démarrer sans risque.</div>
                <ul className="lp-pcard-features">
                  <li>30 QCMs générés par mois</li>
                  <li>Répétition espacée (J0 → J+120)</li>
                  <li>Calendrier de révision automatique</li>
                  <li>Import PDF et vidéo (limité)</li>
                </ul>
                <button className="lp-pcard-btn" onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>
                  Commencer gratuitement
                </button>
              </div>
              <div className="lp-pcard lp-pcard-ft">
                <div className="lp-pcard-name">Premium</div>
                <div className="lp-pcard-price">9<sub>,99 €/mois</sub></div>
                <div className="lp-pcard-desc">L&apos;équivalent d&apos;une heure de prépa.</div>
                <ul className="lp-pcard-features">
                  <li>QCMs illimités</li>
                  <li>Import vidéo illimité avec timestamps</li>
                  <li>Decks collaboratifs par promo</li>
                  <li>Coach adaptatif et angles morts</li>
                  <li>Simulateur examen officiel</li>
                </ul>
                <button className="lp-pcard-btn" onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}>
                  Essayer 14 jours gratuits
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AUTH */}
        <div className="lp-auth" id="auth">
          <div className="lp-auth-wrap">
            <div>
              <div className="lp-auth-left-title">
                Commence à retenir<br /><em>pour de bon.</em>
              </div>
              <p className="lp-auth-left-sub">Rejoins les étudiants en PASS et en médecine qui révisent avec MedRev. Gratuit pour commencer.</p>
              <div className="lp-auth-testi">
                <div className="lp-auth-stars">★★★★★</div>
                <p className="lp-auth-testi-text">&quot;Dès l&apos;inscription mes matières Sorbonne étaient déjà là. J&apos;ai commencé à réviser en 2 minutes.&quot;</p>
                <div className="lp-auth-testi-author">— Étudiant PASS · Sorbonne</div>
              </div>
            </div>
            <div className="lp-auth-card">
              <div className="lp-auth-tabs">
                <button
                  className={`lp-auth-tab${activeTab === 'register' ? ' lp-auth-tab-active' : ''}`}
                  onClick={() => { setActiveTab('register'); setError(null); setStep('form') }}
                >
                  Créer un compte
                </button>
                <button
                  className={`lp-auth-tab${activeTab === 'login' ? ' lp-auth-tab-active' : ''}`}
                  onClick={() => { setActiveTab('login'); setError(null); setStep('form') }}
                >
                  Se connecter
                </button>
              </div>

              {error && <div className="lp-auth-error">{error}</div>}

              {/* ÉTAPE 1 : Formulaire inscription */}
              {activeTab === 'register' && step === 'form' && (
                <div>
                  <div className="lp-prog-dots">
                    <div className="lp-prog-dot lp-prog-dot-on"></div>
                    <div className="lp-prog-dot"></div>
                    {totalSteps === 3 && <div className="lp-prog-dot"></div>}
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-label">Nom d&apos;utilisateur</label>
                    <input type="text" className="lp-input" placeholder="Ex: sophie_m" value={username} onChange={e => setUsername(e.target.value)} />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-label">Adresse email</label>
                    <input type="email" className="lp-input" placeholder="prenom@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-label">Mot de passe</label>
                    <input type="password" className="lp-input" placeholder="Min. 8 caractères" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <button className="lp-submit" onClick={handleContinueForm}>Continuer →</button>
                  <p className="lp-terms">En créant un compte, tu acceptes nos <a href="/privacy">CGU</a>. Données en France 🇫🇷</p>
                </div>
              )}

              {/* ÉTAPE 2 : Choix de la fac */}
              {activeTab === 'register' && step === 'fac' && (
                <div>
                  <div className="lp-prog-dots">
                    <div className="lp-prog-dot lp-prog-dot-done"></div>
                    <div className="lp-prog-dot lp-prog-dot-on"></div>
                    {totalSteps === 3 && <div className="lp-prog-dot"></div>}
                  </div>
                  <button className="lp-back-btn" onClick={() => setStep('form')}>← Retour</button>
                  <div className="lp-step-title">Quelle est ta fac ?</div>
                  <div className="lp-step-sub">On pré-configure tes matières automatiquement.</div>
                  <div className="lp-fac-grid">
                    {FACS.map(f => (
                      <div
                        key={f.id}
                        className={`lp-fac-item${fac === f.id ? ' lp-fac-item-sel' : ''}`}
                        onClick={() => setFac(f.id)}
                      >
                        <span>{f.name}</span>
                        <span className="lp-fac-badge">{f.badge}</span>
                      </div>
                    ))}
                  </div>
                  <button className="lp-submit" onClick={handleContinueFac} disabled={!fac || loading}>
                    {loading ? 'Création en cours…' : 'Continuer →'}
                  </button>
                  {fac && <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--gray)', marginTop: '10px' }}>Sélectionne ta faculté pour continuer</p>}
                </div>
              )}

              {/* ÉTAPE 3 : Choix de l'option (Sorbonne uniquement) */}
              {activeTab === 'register' && step === 'option' && (
                <div>
                  <div className="lp-prog-dots">
                    <div className="lp-prog-dot lp-prog-dot-done"></div>
                    <div className="lp-prog-dot lp-prog-dot-done"></div>
                    <div className="lp-prog-dot lp-prog-dot-on"></div>
                  </div>
                  <button className="lp-back-btn" onClick={() => setStep('fac')}>← Retour</button>
                  <div className="lp-step-title">Quelle est ton option ?</div>
                  <div className="lp-step-sub">Sorbonne PASS — choisir la mineure disciplinaire pour pré-configurer tes matières.</div>
                  <div className="lp-opt-grid">
                    <div
                      className={`lp-opt-card${option === 'sciences' ? ' lp-opt-card-sel' : ''}`}
                      onClick={() => setOption('sciences')}
                    >
                      <div className="lp-opt-card-title">⚗ Option Sciences</div>
                      <div className="lp-opt-card-desc">Biologie-Chimie-Physique · Mineure Sciences</div>
                      <div className="lp-opt-card-matieres">
                        {['Biochimie','Biologie cell.','Anatomie','Physique','Chimie','Biophysique','Physiologie','Biostat','Pharmaco','SSH','Anatomie spéc.'].map(m => (
                          <span key={m} className="lp-opt-matiere">{m}</span>
                        ))}
                      </div>
                    </div>
                    <div
                      className={`lp-opt-card${option === 'lettres' ? ' lp-opt-card-sel' : ''}`}
                      onClick={() => setOption('lettres')}
                    >
                      <div className="lp-opt-card-title">📚 Option Lettres</div>
                      <div className="lp-opt-card-desc">Sciences du langage et humanités · Mineure Lettres</div>
                      <div className="lp-opt-card-matieres">
                        {['Biochimie','Biologie cell.','Anatomie','Sociolinguistique','Linguistique','Biophysique','Physiologie','Biostat','Pharmaco','SSH'].map(m => (
                          <span key={m} className="lp-opt-matiere">{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    className="lp-submit"
                    onClick={() => handleRegister(fac, option)}
                    disabled={!option || loading}
                  >
                    {loading ? 'Création en cours…' : 'Créer mon compte gratuit →'}
                  </button>
                  {option && <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--gray)', marginTop: '10px' }}>Sélectionne ton option pour continuer</p>}
                </div>
              )}

              {/* CONNEXION */}
              {activeTab === 'login' && (
                <div>
                  <div className="lp-form-group">
                    <label className="lp-label">Adresse email</label>
                    <input type="email" className="lp-input" placeholder="prenom@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-label">Mot de passe</label>
                    <input type="password" className="lp-input" placeholder="Ton mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <button className="lp-submit" onClick={handleLogin} disabled={loading}>
                    {loading ? 'Connexion…' : 'Se connecter →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="lp-footer">
          <p>© 2026 MedRev · Hébergé en France</p>
          <div className="lp-footer-links">
            <a href="/privacy">Mentions légales</a>
            <a href="/privacy">CGU</a>
            <a href="#">Contact</a>
          </div>
        </footer>

      </div>
    </>
  )
}
