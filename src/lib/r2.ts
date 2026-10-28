// src/lib/r2.ts — SERVEUR UNIQUEMENT
//
// Stockage des fichiers des fiches (polys, vidéos, sujets d'annales) sur
// Cloudflare R2 : 10 Go gratuits et téléchargements gratuits, contre 1 Go et
// 5 Go/mois sur Supabase Storage.
//
// Activé seulement si les 4 variables d'environnement sont présentes dans
// Vercel. Sans elles, tout reste sur Supabase Storage comme avant.
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//
// Les chemins sont les mêmes qu'avant : {uid}/{lessonId}/poly.pdf, etc.

import { AwsClient } from 'aws4fetch'

const ACCOUNT = process.env.R2_ACCOUNT_ID
const KEY = process.env.R2_ACCESS_KEY_ID
const SECRET = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET

export function r2Enabled(): boolean {
  return !!(ACCOUNT && KEY && SECRET && BUCKET)
}

let client: AwsClient | null = null
function aws(): AwsClient {
  if (!client) client = new AwsClient({ accessKeyId: KEY!, secretAccessKey: SECRET!, service: 's3', region: 'auto' })
  return client
}

function bucketUrl(): string {
  return `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}`
}

function objectUrl(path: string): string {
  return `${bucketUrl()}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** URL signée temporaire, pour lire (GET) ou envoyer (PUT) un fichier depuis le navigateur. */
export async function r2SignedUrl(method: 'GET' | 'PUT', path: string, expiresSec = 3600): Promise<string> {
  const url = new URL(objectUrl(path))
  url.searchParams.set('X-Amz-Expires', String(expiresSec))
  const signed = await aws().sign(new Request(url, { method }), { aws: { signQuery: true } })
  return signed.url
}

export async function r2Exists(path: string): Promise<boolean> {
  const res = await aws().fetch(objectUrl(path), { method: 'HEAD' })
  return res.ok
}

export async function r2Get(path: string): Promise<Blob | null> {
  const res = await aws().fetch(objectUrl(path))
  if (!res.ok) return null
  return await res.blob()
}

export async function r2Put(path: string, body: Blob | ArrayBuffer, contentType: string): Promise<void> {
  const res = await aws().fetch(objectUrl(path), { method: 'PUT', body, headers: { 'Content-Type': contentType } })
  if (!res.ok) throw new Error(`R2 PUT ${res.status}`)
}

export async function r2Delete(paths: string[]): Promise<void> {
  await Promise.all(paths.map(p => aws().fetch(objectUrl(p), { method: 'DELETE' }).catch(() => null)))
}

/** Autorise le navigateur (medrev.fr) à envoyer et lire les fichiers directement. */
export async function r2SetCors(origins: string[]): Promise<number> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration>${origins.map(o =>
    `<CORSRule><AllowedOrigin>${o}</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>Content-Length</ExposeHeader><ExposeHeader>Content-Range</ExposeHeader><ExposeHeader>Accept-Ranges</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule>`).join('')}</CORSConfiguration>`
  const res = await aws().fetch(`${bucketUrl()}?cors`, { method: 'PUT', body: xml, headers: { 'Content-Type': 'application/xml' } })
  return res.status
}
