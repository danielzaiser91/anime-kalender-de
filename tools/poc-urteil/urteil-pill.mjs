#!/usr/bin/env node
/**
 * PoC Stufe 3 nach dem Modell vom 22.09.2026, Ebene (a): Urteil je Pill (Titel × Anbieter × Adresse)
 * aus der **jüngsten eigenen Prüfung** (Erweiterung oder Daniel von Hand; gemessen vor angenommen),
 * verglichen mit dem `dub` des Weges gleicher Adresse im heutigen Datensatz. Schreibt nichts.
 *
 * Aufruf: node tools/poc-urteil/urteil-pill.mjs <beobachtungen.json>
 */
import { readFileSync } from 'node:fs'

const beobachtungen = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const titel = Array.isArray(roh) ? roh : roh.titles

const kern = (u) =>
  String(u ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/(gp\/video\/detail|dp)\//, '/').replace(/[?#].*$/, '').replace(/\/$/, '')

/* Heutiger Stand je Pill: Adresskern → { titel, dub } */
const heute = new Map()
for (const t of titel)
  for (const s of t.streams ?? [])
    for (const u of [s.url, s.seite].filter(Boolean))
      heute.set(`${t.id}|${s.platform}|${kern(u)}`, { t, dub: s.dub, weg: false })
for (const t of titel)
  for (const s of t.entfernteStreams ?? []) {
    const k = `${t.id}|${s.platform}|${kern(s.url)}`
    if (!heute.has(k)) heute.set(k, { t, dub: undefined, weg: true })
  }
/* Welcher Titel steht an einer Adresse? Nur eindeutige Adressen. */
const jeAdresse = new Map()
for (const k of heute.keys()) {
  const [id, , a] = k.split('|')
  if (!jeAdresse.has(a)) jeAdresse.set(a, new Set())
  jeAdresse.get(a).add(Number(id))
}

const RANG = { gemessen: 3, abgeleitet: 2, angenommen: 1 }
const eigene = new Map()
for (const b of beobachtungen) {
  if (b.quelle !== 'erweiterung' && b.quelle !== 'hand') continue
  if (!b.url) continue
  const a = kern(b.url)
  const id = b.titelId ?? (jeAdresse.get(a)?.size === 1 ? [...jeAdresse.get(a)][0] : null)
  if (id == null) continue
  const k = `${id}|${b.anbieter}|${a}`
  const alt = eigene.get(k)
  /* Jüngste gilt; am selben Tag gemessen vor abgeleitet vor angenommen. */
  const tag = String(b.zeitpunkt).slice(0, 10)
  const altTag = alt ? String(alt.zeitpunkt).slice(0, 10) : ''
  if (!alt || tag > altTag || (tag === altTag && (RANG[b.art] ?? 0) > (RANG[alt.art] ?? 0))) eigene.set(k, b)
}

const urteil = (b) => (b.vorhanden === 'nein' ? 'nicht verfügbar' : b.tonDe === 'ja' ? 'deutsch' : b.tonDe === 'nein' ? 'kein deutsch' : 'unbekannt')
const heuteUrteil = (h) => (!h ? 'kein Weg an dieser Adresse' : h.weg ? 'nicht verfügbar' : h.dub === true ? 'deutsch' : h.dub === false ? 'kein deutsch' : 'unbekannt')

const matrix = new Map()
const abw = []
for (const [k, b] of eigene) {
  const neu = urteil(b)
  const alt = heuteUrteil(heute.get(k))
  const m = `${neu.padEnd(16)} ← heute ${alt}`
  matrix.set(m, (matrix.get(m) ?? 0) + 1)
  if (neu !== alt && alt !== 'kein Weg an dieser Adresse') abw.push(`${k} · PoC ${neu} (${b.quelle}/${b.art}${b.kanalNein ? '/Kanal' : ''}, ${String(b.zeitpunkt).slice(0, 10)}) · heute ${alt}`)
}
console.log(`${eigene.size} Pills mit eigener Prüfung\n`)
for (const [k, v] of [...matrix].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(6), k)
console.log(`\n${abw.length} Abweichungen bei Pills, die heute im Datensatz stehen, die ersten 20:`)
for (const a of abw.slice(0, 20)) console.log('  ' + a)
