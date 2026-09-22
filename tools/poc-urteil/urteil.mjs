#!/usr/bin/env node
/**
 * PoC Stufe 3, erster Schnitt — ein Urteil je (Titel, Anbieter) aus allen eindeutig zugeordneten
 * Beobachtungen, verglichen mit dem `dub` im heutigen Datensatz. Schreibt nichts.
 *
 * Gewichte wie im Konzept (docs/konzept-meldungen-architektur.md). Es gilt das höchste Gewicht,
 * bei Gleichstand das jüngste. Ein Kanal-Nein zählt nur schwach (ohne Abo kein Beleg).
 *
 * Aufruf: node tools/poc-urteil/urteil.mjs <beobachtungen.json>
 */
import { readFileSync } from 'node:fs'

const beobachtungen = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const titel = Array.isArray(roh) ? roh : roh.titles
const byId = new Map(titel.map((t) => [t.id, t]))

const kern = (u) =>
  String(u ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/(gp\/video\/detail|dp)\//, '/').replace(/[?#].*$/, '').replace(/\/$/, '')
const jeAdresse = new Map()
for (const t of titel)
  for (const w of [...(t.streams ?? []), ...(t.watchLinks ?? [])])
    for (const u of [w.url, w.seite].filter(Boolean)) {
      const k = kern(u)
      if (!jeAdresse.has(k)) jeAdresse.set(k, new Set())
      jeAdresse.get(k).add(t.id)
    }
const frueher = new Map()
{
  let id = null
  for (const z of readFileSync('data/dub-confirmed.yaml', 'utf8').split('\n')) {
    const n = /^- anilistId: (\d+)/.exec(z)
    if (n) id = Number(n[1])
    const u = /^  url: (\S+)/.exec(z)?.[1]
    if (u && id) {
      const k = kern(u)
      if (!frueher.has(k)) frueher.set(k, new Set())
      frueher.get(k).add(id)
    }
  }
}

const GEWICHT = { gemessen: 100, abgeleitet: 90, angenommen: 70 }
const gewicht = (b) => {
  if (b.quelle === 'hand') return 95
  if (b.kanalNein) return 20
  return GEWICHT[b.art] ?? 50
}
const titelVon = (b) => {
  if (b.titelId != null) return b.titelId
  const a = jeAdresse.get(kern(b.url))
  if (a?.size === 1) return [...a][0]
  const f = frueher.get(kern(b.url))
  if (!a?.size && f?.size === 1) return [...f][0]
  return null
}

/* Je (Titel, Anbieter) die stärkste, dann jüngste Beobachtung. */
const bestes = new Map()
let ohneTitel = 0
for (const b of beobachtungen) {
  const id = titelVon(b)
  if (id == null) {
    ohneTitel++
    continue
  }
  const k = `${id}|${b.anbieter}`
  const alt = bestes.get(k)
  const w = gewicht(b)
  if (!alt || w > alt.w || (w === alt.w && String(b.zeitpunkt) > String(alt.b.zeitpunkt))) bestes.set(k, { w, b })
}

const urteilVon = ({ b }) => (b.vorhanden === 'nein' ? 'nicht verfügbar' : b.tonDe === 'ja' ? 'deutsch' : b.tonDe === 'nein' ? 'kein deutsch' : 'unbekannt')
const heuteVon = (t, anbieter) => {
  const s = (t?.streams ?? []).filter((x) => x.platform === anbieter)
  if (!s.length) return (t?.entfernteStreams ?? []).some((x) => x.platform === anbieter) ? 'nicht verfügbar' : 'kein Weg'
  if (s.some((x) => x.dub === true)) return 'deutsch'
  if (s.every((x) => x.dub === false)) return 'kein deutsch'
  return 'unbekannt'
}

const matrix = new Map()
const abweichungen = []
for (const [k, e] of bestes) {
  const [id, anbieter] = k.split('|')
  const t = byId.get(Number(id))
  const neu = urteilVon(e)
  const alt = heuteVon(t, anbieter)
  const mk = `${neu.padEnd(16)} ← heute ${alt}`
  matrix.set(mk, (matrix.get(mk) ?? 0) + 1)
  if (neu !== alt && !(neu === 'nicht verfügbar' && alt === 'kein Weg'))
    abweichungen.push(`${id} ${t?.titleDe ?? t?.titleEn ?? '?'} · ${anbieter}: PoC ${neu} (${e.b.quelle}/${e.b.art}, ${String(e.b.zeitpunkt).slice(0, 10)}) · heute ${alt}`)
}
console.log(`${bestes.size} Urteile (Titel × Anbieter); ${ohneTitel} Beobachtungen ohne eindeutigen Titel ausgelassen\n`)
for (const [k, v] of [...matrix].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(6), k)
console.log(`\n${abweichungen.length} Abweichungen, die ersten 25:`)
for (const a of abweichungen.slice(0, 25)) console.log('  ' + a)
