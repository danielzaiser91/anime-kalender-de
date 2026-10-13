import { klartext, kurzMitMarke } from './zaehlen'
import type { Eintrag } from './zaehlen'

// „## Regelmäßig“: Zeilen `- ⟳ **Titel** — Beschreibung · Rhythmus: <Klartext> · cron: <5 Felder, UTC>`;
// ohne `cron:` bleibt nur der Klartext.
export type Regel = Eintrag & { rhythmus: string; cron?: string }

export function zaehleRegelmaessig(text: string): Regel[] {
  const aus: Regel[] = []
  let drin = false
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) drin = zeile.startsWith('## Regelmäßig')
    else if (drin && zeile.startsWith('- ')) {
      const cron = / · cron: (.+?)\s*$/.exec(zeile)
      const ohneCron = cron ? zeile.slice(0, cron.index) : zeile
      const rhythmus = / · Rhythmus: (.+?)\s*$/.exec(ohneCron)
      const kopf = (rhythmus ? ohneCron.slice(0, rhythmus.index) : ohneCron).slice(2).replace(/^⟳\s*/, '')
      // Titel immer am ersten „ — “ trennen (kurz() hält kurze Vorsätze zusammen).
      const [vorn, ...hinten] = kopf.split(' — ')
      const eintrag = kurzMitMarke(kopf)
      eintrag.titel = klartext(vorn!.replace(/^\[(groß|klein)\]\s*/, ''))
      eintrag.rest = klartext(hinten.join(' — '))
      aus.push({ ...eintrag, rhythmus: (rhythmus?.[1] ?? '').replace(/,?\s*Cloudflare-Wecker, Beginn ±Minuten/, '').trim(), ...(cron ? { cron: cron[1] } : {}) })
    }
  }
  return aus
}

const GRENZEN: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]

// Ein Cron-Feld: null = `*`, sonst die erlaubten Zahlen (Liste `2,8,14`); undefined = ungültig.
function feld(text: string, [min, max]: [number, number]): number[] | null | undefined {
  if (text === '*') return null
  const zahlen = text.split(',').map(t => (/^\d+$/.test(t) ? Number(t) : NaN))
  return zahlen.every(n => n >= min && n <= max) ? [...new Set(zahlen)].sort((a, b) => a - b) : undefined
}

const TAG_MS = 86_400_000

// Nächster Zeitpunkt (UTC-ms) strikt nach `nach`; null bei ungültigem Cron. Tag und Wochentag
// verknüpft wie in cron: sind beide eingeschränkt, genügt einer.
export function naechsterLauf(cron: string, nach: number): number | null {
  const teile = cron.trim().split(/\s+/)
  if (teile.length !== 5) return null
  const f = teile.map((t, i) => feld(t, GRENZEN[i]!))
  if (f.includes(undefined)) return null
  const [min, std, tag, monat, wtag] = f as (number[] | null)[]
  const wochentage = wtag?.map(n => n % 7) ?? null
  const start = Math.floor(nach / TAG_MS) * TAG_MS
  for (let i = 0; i < 800; i++) {
    const t0 = start + i * TAG_MS
    const d = new Date(t0)
    if (monat && !monat.includes(d.getUTCMonth() + 1)) continue
    const tagOk = !tag || tag.includes(d.getUTCDate())
    const wtagOk = !wochentage || wochentage.includes(d.getUTCDay())
    if (tag && wochentage ? !(tagOk || wtagOk) : !(tagOk && wtagOk)) continue
    for (const h of std ?? Array.from({ length: 24 }, (_, k) => k)) {
      for (const m of min ?? Array.from({ length: 60 }, (_, k) => k)) {
        const t = t0 + h * 3_600_000 + m * 60_000
        if (t > nach) return t
      }
    }
  }
  return null
}

// Letzter Sonntag des Monats (0-basiert), 01:00 UTC: dort wechselt die EU-Zeit.
function umstellung(jahr: number, monat: number): number {
  const ende = Date.UTC(jahr, monat + 1, 0, 1)
  return ende - new Date(ende).getUTCDay() * TAG_MS
}

// Versatz Europe/Berlin zu UTC in Stunden (Sommerzeit: letzter Sonntag März bis letzter Sonntag Oktober).
export function berlinVersatz(ms: number): 1 | 2 {
  const j = new Date(ms).getUTCFullYear()
  return ms >= umstellung(j, 2) && ms < umstellung(j, 9) ? 2 : 1
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const zwei = (n: number) => String(n).padStart(2, '0')

// Schwellen der Chip-Farbe (10.10.2026): bis 60 min dringend (warning, fett), bis 6 h normal, darüber gedimmt.
export const DRINGEND_MIN = 60
export const BALD_MIN = 360

// Minuten bis zum Lauf, minutengenau gegen den Minutenbeginn von „jetzt“.
export const abstandMin = (ms: number, jetzt: number): number =>
  Math.max(0, Math.round((ms - Math.floor(jetzt / 60_000) * 60_000) / 60_000))

// Relativer Chip, abgerundet („in 1 h“ heißt mindestens 1 h): „jetzt“, „in 37 min“, „in 13 h“, „in 2 d“; höchstens 9 Zellen.
export function inKurz(ms: number, jetzt: number): string {
  const min = abstandMin(ms, jetzt)
  return min === 0 ? 'jetzt' : min < 60 ? `in ${min} min` : min < 1440 ? `in ${Math.floor(min / 60)} h` : `in ${Math.floor(min / 1440)} d`
}

// Berliner Kalendertag als fortlaufende Zahl.
const tagIndex = (ms: number): number => Math.floor((ms + berlinVersatz(ms) * 3_600_000) / TAG_MS)

// Absolute Zeit in Berliner Zeit: „heute 17:00“, „morgen 06:00“, sonst „Mo 12.10. 07:00“.
export function formatWann(ms: number, jetzt: number): string {
  const d = new Date(ms + berlinVersatz(ms) * 3_600_000)
  const uhr = `${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}`
  const dt = tagIndex(ms) - tagIndex(jetzt)
  if (dt === 0) return `heute ${uhr}`
  if (dt === 1) return `morgen ${uhr}`
  return `${WOCHENTAG[d.getUTCDay()]} ${zwei(d.getUTCDate())}.${zwei(d.getUTCMonth() + 1)}. ${uhr}`
}

export type RegelTermin = { r: Regel; ms: number | null; datei: number }

// Nach nächstem Lauf aufsteigend; ohne Cron (oder ungültig) hinten in Dateireihenfolge. `datei` bleibt der
// Index in der Datei (stabiler Schlüssel für das Aufklappen); der Lauf wird je Regel einmal berechnet.
export function sortiereRegeln(regeln: Regel[], jetzt: number): RegelTermin[] {
  return regeln
    .map((r, datei) => ({ r, datei, ms: r.cron ? naechsterLauf(r.cron, jetzt) : null }))
    .sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity) || a.datei - b.datei)
}

// Detailzeile beim Aufklappen: Rhythmus und, mit Cron, die absolute Zeit.
export const detailZeile = (r: Regel, ms: number | null, jetzt: number): string =>
  [r.rhythmus, ms === null ? '' : formatWann(ms, jetzt)].filter(Boolean).join(' · ')
