/**
 * Die Liste der Disney+-Seiten, bei denen eine Prüfung noch etwas bringt.
 *
 * Dasselbe Prinzip wie bei Netflix (`extension-offene-liste.mjs`), zwei
 * Unterschiede:
 *
 * - **Zwei Adressformen.** Disney+ führt dieselbe Serie unter
 *   `/browse/entity-<uuid>` und unter `/series/<slug>/<id>`; unser Bestand hat
 *   27 der einen und 19 der anderen. Beide werden als Schlüssel eingetragen,
 *   damit die Erweiterung eine Seite wiedererkennt, egal über welchen Weg
 *   Daniel dort gelandet ist.
 * - **Keine Anbieter-Staffeln.** Bei Netflix stammen die aus früheren
 *   Meldungen. Für Disney+ gibt es die noch nicht; die Staffelzahlen kommen
 *   deshalb aus unserem eigenen Bestand und werden vom ersten Durchlauf
 *   berichtigt.
 *
 * Aufruf: node tools/extension-offene-disney.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
import { verdachtHinweis, verdachtsfaelle } from './verdacht.mjs'
/** Verweise, denen eine zweite Quelle widerspricht — siehe `verdacht.mjs`. */
const verdaechtig = verdachtsfaelle(wurzel, 'disneyplus')
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))

/**
 * Die Kennung einer Disney+-Adresse.
 *
 * `/browse/entity-8019edc8-…` → `8019edc8-…`
 * `/series/medalist/4LgC0zEd5JEx` → `4LgC0zEd5JEx`
 *
 * Beides sind Kennungen derselben Sorte Sache — eine Serienseite. Welche davon
 * in unserem Bestand steht, hängt daran, woher der Verweis stammt.
 */
export function kennung(url) {
  return (
    /\/browse\/entity-([0-9a-f-]{8,})/i.exec(url)?.[1] ??
    /\/(?:series|movies)\/[^/]+\/([A-Za-z0-9]{6,})/.exec(url)?.[1] ??
    null
  )
}

/** Reihenfolge der Staffeln: japanische Erstausstrahlung, nicht AniList-Kennung. */
const JAHRESZEIT = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
const vergleiche = (a, b) =>
  (a.t.jpYear ?? 0) - (b.t.jpYear ?? 0) ||
  (JAHRESZEIT[a.t.jpSeason] ?? 0) - (JAHRESZEIT[b.t.jpSeason] ?? 0)

const jeAdresse = new Map()
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'disneyplus') continue
    const id = kennung(s.url)
    if (!id) continue
    jeAdresse.set(id, [...(jeAdresse.get(id) ?? []), { t, dub: s.dub, url: s.url }])
  }
}

const offen = {}
for (const [id, eintraege] of jeAdresse) {
  const sortiert = [...eintraege].sort(vergleiche)
  const verdacht = eintraege.map((e) => verdaechtig.get(e.t?.id ?? e.id)).find(Boolean)
  /* Ist alles beantwortet, gehört die Seite nicht auf die Liste — außer eine
     zweite Quelle widerspricht dem Urteil. */
  if (!verdacht && sortiert.every((e) => e.dub !== undefined)) continue
  offen[id] = {
    ...(verdacht ? { wiedervorlage: verdachtHinweis(verdacht) } : {}),
    titel: sortiert[0].t.titleDe ?? sortiert[0].t.titleEn ?? sortiert[0].t.titleRomaji ?? '',
    url: sortiert[0].url,
    staffeln: sortiert.map((e, i) => ({
      nr: i + 1,
      name: e.t.titleDe ?? e.t.titleEn ?? e.t.titleRomaji ?? '',
      folgen: e.t.episodes ?? 0,
      film: e.t.format === 'MOVIE',
      offen: e.dub === undefined || verdaechtig.has(e.t?.id ?? e.id),
    })),
  }
}

const ziel = resolve(wurzel, 'extension/offene-disney.js')
writeFileSync(ziel, 'globalThis.AK_OFFENE_DISNEY = ' + JSON.stringify(offen) + '\n')
const staffeln = Object.values(offen).reduce((n, o) => n + o.staffeln.filter((s) => s.offen).length, 0)
console.log(`${Object.keys(offen).length} Disney+-Adressen mit ${staffeln} offenen Staffeln`)
