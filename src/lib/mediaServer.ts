// src/lib/mediaServer.ts — SERVEUR UNIQUEMENT
//
// Lecture et suppression des fichiers des fiches, quel que soit l'endroit où
// ils sont : R2 d'abord (si activé), puis Supabase Storage. Pendant la
// migration, un fichier pas encore copié reste donc lisible.

import { r2Enabled, r2Get, r2Delete } from '@/lib/r2'

type StorageClient = {
  storage: { from: (b: string) => {
    download: (p: string) => PromiseLike<{ data: Blob | null; error: unknown }>
    remove: (p: string[]) => PromiseLike<{ error: unknown }>
  } }
}

export const MEDIA_BUCKET = 'lesson-media'

export async function downloadMedia(supabase: StorageClient, path: string): Promise<Blob | null> {
  if (r2Enabled()) {
    const b = await r2Get(path).catch(() => null)
    if (b) return b
  }
  const { data } = await supabase.storage.from(MEDIA_BUCKET).download(path)
  return data ?? null
}

export async function removeMedia(supabase: StorageClient, paths: string[]): Promise<void> {
  const list = paths.filter(Boolean)
  if (!list.length) return
  if (r2Enabled()) await r2Delete(list).catch(() => {})
  await Promise.resolve(supabase.storage.from(MEDIA_BUCKET).remove(list)).catch(() => {})
}
