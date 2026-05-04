'use client'
// src/components/SourceLightbox.tsx
//
// Lightbox MedRev pour ouvrir la vidéo (au timestamp) ou le PDF (à la page)
// d'une fiche, en réponse à un clic "Voir la source ↗" depuis un QCM raté.
//
// - Génère des signed URLs Supabase Storage (1h)
// - Vidéo : <video> HTML5 avec currentTime = video_ts
// - PDF : <iframe> avec ancre #page=N (lecteur PDF natif du navigateur)
// - Tabs si vidéo + PDF disponibles, sinon affichage direct

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LessonMedia, AiQuestionSourceRef } from '@/types'
import './source-lightbox.css'

interface Props {
  media: LessonMedia
  sourceRef: AiQuestionSourceRef
  lessonName: string
  onClose: () => void
}

type Tab = 'video' | 'pdf'

export default function SourceLightbox({ media, sourceRef, lessonName, onClose }: Props) {
  const supabase = createClient()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasVideo = !!media.video_path && sourceRef.video_ts !== undefined
  const hasPdf = !!media.pdf_path && sourceRef.pdf_page !== undefined

  // Tab par défaut : vidéo si dispo, sinon pdf
  const [tab, setTab] = useState<Tab>(hasVideo ? 'video' : 'pdf')

  // Génère les signed URLs au montage
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const promises: Promise<void>[] = []

        if (media.video_path) {
          promises.push(
            supabase.storage
              .from('lesson-media')
              .createSignedUrl(media.video_path, 3600)
              .then(({ data }) => {
                if (cancelled) return
                if (data?.signedUrl) {
                  // L'ancre #t=N permet à HTML5 video de démarrer au timestamp
                  const ts = sourceRef.video_ts
                  const url = ts !== undefined ? `${data.signedUrl}#t=${ts}` : data.signedUrl
                  setVideoUrl(url)
                }
              })
          )
        }
        if (media.pdf_path) {
          promises.push(
            supabase.storage
              .from('lesson-media')
              .createSignedUrl(media.pdf_path, 3600)
              .then(({ data }) => {
                if (cancelled) return
                if (data?.signedUrl) {
                  const page = sourceRef.pdf_page
                  // L'ancre #page=N est interprétée par le viewer PDF natif (Chrome/Firefox/Safari)
                  const url = page !== undefined ? `${data.signedUrl}#page=${page}` : data.signedUrl
                  setPdfUrl(url)
                }
              })
          )
        }

        await Promise.all(promises)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erreur de chargement')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [media.video_path, media.pdf_path, sourceRef.video_ts, sourceRef.pdf_page, supabase])

  // Force le seek au timestamp quand la vidéo est prête (l'ancre #t= ne fonctionne
  // pas toujours sur les signed URLs derrière redirection — on garantit le seek manuellement)
  useEffect(() => {
    const v = videoRef.current
    if (!v || tab !== 'video' || sourceRef.video_ts === undefined) return
    function onLoaded() {
      if (v && sourceRef.video_ts !== undefined) {
        try { v.currentTime = sourceRef.video_ts } catch {}
      }
    }
    v.addEventListener('loadedmetadata', onLoaded)
    return () => v.removeEventListener('loadedmetadata', onLoaded)
  }, [videoUrl, tab, sourceRef.video_ts])

  // Fermeture par ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const showTabs = hasVideo && hasPdf

  return (
    <div className="srcl-overlay" onClick={onClose}>
      <div className="srcl-card" onClick={e => e.stopPropagation()}>

        <div className="srcl-head">
          <h3 className="srcl-title">
            Cours · <em>{lessonName}</em>
          </h3>
          {showTabs && (
            <div className="srcl-tabs">
              <button
                type="button"
                className={`srcl-tab${tab === 'video' ? ' active' : ''}`}
                onClick={() => setTab('video')}
              >
                {'▶'} Vidéo
              </button>
              <button
                type="button"
                className={`srcl-tab${tab === 'pdf' ? ' active' : ''}`}
                onClick={() => setTab('pdf')}
              >
                {'\u{1F4C4}'} PDF
              </button>
            </div>
          )}
          <button
            type="button"
            className="srcl-close"
            onClick={onClose}
            aria-label="Fermer"
          >{'×'}</button>
        </div>

        <div className="srcl-body">
          {loading && (
            <div className="srcl-state">Chargement de la source…</div>
          )}
          {error && (
            <div className="srcl-state error">Erreur : {error}</div>
          )}

          {!loading && !error && tab === 'video' && (
            videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                autoPlay
                playsInline
                className="srcl-video"
              />
            ) : (
              <div className="srcl-state">Vidéo indisponible.</div>
            )
          )}

          {!loading && !error && tab === 'pdf' && (
            pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="srcl-pdf"
                title="Polycopié"
              />
            ) : (
              <div className="srcl-state">PDF indisponible.</div>
            )
          )}
        </div>

        <div className="srcl-foot">
          {tab === 'video' && sourceRef.video_ts !== undefined && (
            <span className="srcl-foot-meta">
              Reprise au timestamp <em>{formatTs(sourceRef.video_ts)}</em>
            </span>
          )}
          {tab === 'pdf' && sourceRef.pdf_page !== undefined && (
            <span className="srcl-foot-meta">
              Ouvert à la <em>page {sourceRef.pdf_page}</em>
            </span>
          )}
          <button type="button" className="srcl-back" onClick={onClose}>
            {'←'} Retour à la question
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}
