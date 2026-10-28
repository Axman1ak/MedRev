// src/lib/media.ts — NAVIGATEUR
//
// Envoi, lecture et suppression des fichiers des fiches. Passe par
// /api/media/* qui choisit R2 ou Supabase Storage (voir src/lib/r2.ts).
// Remplace les appels directs à supabase.storage.from('lesson-media').

import { createClient } from '@/lib/supabase/client'

const BUCKET = 'lesson-media'

async function sign(op: 'get' | 'put', path: string): Promise<{ backend: 'r2' | 'supabase'; url?: string }> {
  const res = await fetch('/api/media/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, path }) })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`)
  return res.json()
}

/** Envoie un fichier au chemin donné (remplace s'il existe). */
export async function uploadMedia(path: string, file: Blob, contentType: string): Promise<void> {
  const s = await sign('put', path)
  if (s.backend === 'r2' && s.url) {
    const res = await fetch(s.url, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })
    if (!res.ok) throw new Error(`Envoi du fichier échoué (${res.status})`)
    return
  }
  const { error } = await createClient().storage.from(BUCKET).upload(path, file, { upsert: true, contentType })
  if (error) throw error
}

/** URL temporaire (1 h) pour afficher un fichier, ou null s'il est introuvable. */
export async function mediaUrl(path: string): Promise<string | null> {
  try {
    const s = await sign('get', path)
    if (s.backend === 'r2' && s.url) return s.url
  } catch { /* on tente Supabase */ }
  const { data } = await createClient().storage.from(BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

/** Supprime des fichiers (où qu'ils soient). */
export async function removeMediaFiles(paths: (string | undefined | null)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p)
  if (!list.length) return
  await fetch('/api/media/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: list }) }).catch(() => {})
}
