import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function log(...args: unknown[]): void {
  console.log('[pipeline]', ...args)
}

export function warn(...args: unknown[]): void {
  console.warn('[pipeline] ⚠ ', ...args)
}

export function readJson<T>(path: string, fallback: T): T {
  const full = resolve(ROOT, path)
  if (!existsSync(full)) return fallback
  return JSON.parse(readFileSync(full, 'utf8')) as T
}

export function writeJson(path: string, data: unknown, pretty = false): void {
  const full = resolve(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data), 'utf8')
}

/** Löscht den Inhalt eines Ordners, legt ihn bei Bedarf an. */
export function clearDir(path: string): void {
  const full = resolve(ROOT, path)
  rmSync(full, { recursive: true, force: true })
  mkdirSync(full, { recursive: true })
}

export function writeText(path: string, text: string): void {
  const full = resolve(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, text, 'utf8')
}

/** fetch mit Retry und exponentiellem Backoff; respektiert Retry-After. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const res = await fetch(url, init)
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`${res.status} nach ${attempt} Versuchen: ${url}`)
    const retryAfter = Number(res.headers.get('retry-after') ?? 0)
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000
    warn(`${res.status} — warte ${waitMs} ms und versuche erneut (${url.slice(0, 60)})`)
    await sleep(waitMs)
    return fetchJson<T>(url, init, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return (await res.json()) as T
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
