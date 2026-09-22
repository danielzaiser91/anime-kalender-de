#!/usr/bin/env node
/**
 * PoC Stufe 2, erster Schnitt — wie viele Rohmeldungen lassen sich allein über die Adresse zuordnen?
 *
 * Kandidaten sind die Titel, die im gebauten Datensatz einen Weg zu genau dieser Seite tragen
 * (Adresskern wie in `pipeline/lib/dub-confirmed.ts`). Ein Kandidat → eindeutig. Mehrere → es
 * braucht die Anbieter-Staffel (Netflix: Prüfliste in Netflix-Zählung, Prime: Seitenkennung je
 * Staffel). Keiner → Weg fehlt im Datensatz. Schreibt nichts in den Bestand.
 *
 * Aufruf: node tools/poc-urteil/zuordnung.mjs <beobachtungen.json>
 */
import { readFileSync } from 'node:fs'

const beobachtungen = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const titel = Array.isArray(roh) ? roh : roh.titles

const kern = (u) =>
  String(u ?? '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/(gp\/video\/detail|dp)\//, '/')
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')

const jeAdresse = new Map()
for (const t of titel) {
  /* Auch Bezugswege: Prime-Kaufseiten stehen unter `watchLinks`, nicht unter `streams`. */
  for (const w of [...(t.streams ?? []), ...(t.entfernteStreams ?? []), ...(t.watchLinks ?? [])]) {
    /* Nach der gti-Brücke steht die Amazon-Seite im Feld `seite` (17.09.2026). */
    for (const u of [w.url, w.seite].filter(Boolean)) {
      const k = kern(u)
      if (!jeAdresse.has(k)) jeAdresse.set(k, new Set())
      jeAdresse.get(k).add(t.id)
    }
  }
}

/*
  **Zweite Quelle: die frühere Zuordnung.** Wege ändern sich (gti-Brücke, neue ASINs); eine
  Meldung von damals trägt die Adresse von damals. Der Einleser hat sie seinerzeit einem Titel
  zugeordnet, und das steht als Adresse + anilistId in `dub-confirmed.yaml`.
*/
const frueher = new Map()
{
  let id = null
  for (const zeile of readFileSync('data/dub-confirmed.yaml', 'utf8').split('\n')) {
    const neu = /^- anilistId: (\d+)/.exec(zeile)
    if (neu) id = Number(neu[1])
    const url = /^  url: (\S+)/.exec(zeile)?.[1]
    if (url && id) {
      const k = kern(url)
      if (!frueher.has(k)) frueher.set(k, new Set())
      frueher.get(k).add(id)
    }
  }
}

const zaehl = new Map()
const beispiele = new Map()
for (const b of beobachtungen) {
  if (b.quelle !== 'erweiterung') continue
  let fall
  if (b.titelId != null) fall = 'titel_id aus der Meldung'
  else {
    const n = jeAdresse.get(kern(b.url))?.size ?? 0
    const f = frueher.get(kern(b.url))?.size ?? 0
    fall =
      n === 1
        ? 'eindeutig über die Adresse'
        : n > 1
          ? `mehrdeutig (${n > 5 ? '6+' : n} Titel an der Adresse)`
          : f === 1
            ? 'eindeutig über frühere Zuordnung'
            : f > 1
              ? 'mehrdeutig über frühere Zuordnung'
              : 'weder Weg noch frühere Zuordnung'
  }
  const k = `${b.anbieter} · ${fall}`
  zaehl.set(k, (zaehl.get(k) ?? 0) + 1)
  if (!beispiele.has(k)) beispiele.set(k, b.url)
}
for (const [k, v] of [...zaehl].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(6), k, ' z. B.', beispiele.get(k))
