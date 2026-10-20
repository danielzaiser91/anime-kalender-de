#!/usr/bin/env node
/**
 * **Kanal-Nachmessung: alter Beleg gegen neue Messung** (Daniel, 12.10.2026: „erst messen, dann entscheiden").
 *
 *   node tools/kanal-nachmessung-vergleich.mjs                  Summen
 *   node tools/kanal-nachmessung-vergleich.mjs --liste          dazu je Adresse eine Zeile
 *   node tools/kanal-nachmessung-vergleich.mjs --einreihen      YAML-Zeilen für data/erneut-melden.yaml (Titel ohne Gegenprobe mit Deutsch)
 *   Optionen: --seit=2026-10-13 (Stichtag der Nachmessung, Vorgabe)
 *
 * Je Adresse mit altem Kanal-Ja (`dub-confirmed.yaml`, Notiz „Kanal-Titel", ohne `zweiteQuelle`): alt = Ja, neu = `kanalMessung` ab dem
 * Stichtag (`ja` / `nein` / `fehlt`), dazu die Gegenprobe aus `data/prime-zugeordnet.json` (je Folge, ab 28.09.2026, ohne Datum).
 * Kern und Begründung: `tools/kanal-nachmessung.mjs`. Die Zahl der Abweichungen (alt Ja, neu Nein) trägt die Entscheidung, ob Amazons
 * Angabe auf Kanal-Seiten wieder zählt — die Kanal-Regel selbst ändert dieses Werkzeug nicht.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { einzureihen, vergleiche, zaehle } from './kanal-nachmessung.mjs'
import { leseZugeordnet } from '../pipeline/lib/prime-meldung-riegel.ts'

const wurzel = resolve(import.meta.dirname, '..')
const arg = (name, vorgabe) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? vorgabe
const seit = arg('seit', '2026-10-13')

const belege = yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')) ?? []
const zugeordnet = leseZugeordnet()
const titelRoh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titelListe = Array.isArray(titelRoh) ? titelRoh : titelRoh.titles
const name = new Map(titelListe.map((t) => [t.id, t.titleDe ?? t.titleEn ?? t.titleRomaji]))
/* Die Prüfliste öffnet nur Titel mit einem Prime-Weg im Bestand (Hell Mode hat seit 11.10. keinen). */
const mitPrimeWeg = new Set(titelListe.filter((t) => (t.streams ?? []).some((s) => s.platform === 'primevideo')).map((t) => t.id))

const zeilen = vergleiche(belege, zugeordnet, seit)
const titel = new Set(zeilen.map((z) => z.anilistId))
const ohneGegenprobe = einzureihen(zeilen)
const aufListe = new Map([...ohneGegenprobe].filter(([id]) => mitPrimeWeg.has(id)))

function ausgabe() {
  const zahl = (k, v) => `${k} ${v ?? 0}`
  const neu = zaehle(zeilen, 'neu')
  const probe = zaehle(zeilen, 'gegenprobe')
  const gemessen = zeilen.filter((z) => z.neu !== 'fehlt')
  console.log(`Kanal-Ja-Belege: ${zeilen.length} Adressen, ${titel.size} Titel; davon vor Erweiterung 4.20.10 (bis 14.09.): ${zaehle(zeilen, 'vorErweiterung').true ?? 0}`)
  console.log(`Gegenprobe (gemeldete Folgen, undatiert): ${zahl('Deutsch', probe.ja)} · ${zahl('nie Deutsch', probe.nein)} · ${zahl('keine', probe.keine)}`)
  console.log(`Neue Messung ab ${seit}: ${zahl('Ja', neu.ja)} · ${zahl('Nein', neu.nein)} · ${zahl('fehlt', neu.fehlt)}`)
  const abweichung = zeilen.filter((z) => z.neu === 'nein')
  console.log(`Abweichungen (alt Ja, neu Nein): ${abweichung.length} von ${gemessen.length} gemessenen (${gemessen.length ? Math.round((100 * abweichung.length) / gemessen.length) : 0} %)`)
  console.log(`Ohne Gegenprobe mit Deutsch: ${ohneGegenprobe.size} Titel, davon auf der Prüfliste ${aufListe.size}, ohne Prime-Weg im Bestand ${ohneGegenprobe.size - aufListe.size}`)
}

function liste() {
  for (const z of zeilen.sort((a, b) => a.anilistId - b.anilistId)) {
    const abw = z.neu === 'nein' ? ' ABWEICHUNG' : ''
    console.log(`${z.anilistId}\t${z.asin}\talt Ja ${z.alt}\tneu ${z.neu}${z.neuAm ? ` ${z.neuAm}` : ''}\tGegenprobe ${z.gegenprobe}\t${name.get(z.anilistId) ?? ''}${abw}`)
  }
}

/** YAML-Zeilen im Format von `data/erneut-melden.yaml`, Vorrang 1 zuerst. */
function einreihenZeilen() {
  const grund = 'Kanal-Nachmessung: altes Ja nur aus Amazons Kanal-Angabe, ohne Gegenprobe mit Deutsch (12.10.2026)'
  const sortiert = [...aufListe].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  for (const [id, vorrang] of sortiert) {
    console.log(`- { anilistId: ${id}, platform: primevideo, seit: '${seit}', grund: ${JSON.stringify(grund)}, kanal: true, vorrang: ${vorrang} }`)
  }
}

if (process.argv.includes('--einreihen')) einreihenZeilen()
else {
  ausgabe()
  if (process.argv.includes('--liste')) liste()
}
