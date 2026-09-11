#!/usr/bin/env node
/**
 * **Identische Doppel aus `data/dub-confirmed.yaml` entfernen — textgenau.**
 *
 * Gemessen am 11.09.2026: 3.289 Belege, davon 136 mehrfach, zusammen **1.489
 * Zeilen zu viel** (1.456 Netflix, 20 Disney+, 13 Prime). Entstanden sind sie
 * zwischen dem 22. und 24.08.2026, als `fetch-pruefungen.ts` mehrfach lokal
 * lief; seitdem wächst die Zahl nicht mehr (bei „Haikyu!! Zweite Staffel" von
 * 0 auf 13 in neun Commits, danach unverändert).
 *
 * Die Datei wird **nicht** über `yaml.dump` neu geschrieben: Sie trägt über
 * sechshundert Kommentarzeilen, und ein Durchlauf durch den Parser würde sie
 * alle entfernen. Stattdessen werden Eintragsblöcke als Text verglichen, und
 * nur der zweite und jeder weitere identische Block fällt weg.
 *
 * Die Gegenprobe steht im Skript: Vor und nach dem Aufräumen muss die **Menge**
 * der Belege dieselbe sein, nur ihre Anzahl kleiner.
 *
 * Aufruf: `node tools/handbelege-doppel-entfernen.mjs [--trocken]`
 */
import { readFileSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'

const pfad = 'data/dub-confirmed.yaml'
const trocken = process.argv.includes('--trocken')
const text = readFileSync(pfad, 'utf8')
const zeilen = text.split('\n')

/* Ein Block beginnt mit „- " in Spalte 0 und reicht bis vor die nächste Zeile, die nicht eingerückt ist. */
const raus = []
const gesehen = new Set()
let entfernt = 0
for (let i = 0; i < zeilen.length; ) {
  if (!zeilen[i].startsWith('- ')) {
    raus.push(zeilen[i])
    i++
    continue
  }
  let j = i + 1
  while (j < zeilen.length && zeilen[j].startsWith('  ')) j++
  const block = zeilen.slice(i, j)
  const schluessel = block.map((z) => z.trimEnd()).join('\n')
  if (gesehen.has(schluessel)) {
    entfernt++
    /* Die Leerzeile hinter einem entfernten Block fällt mit, sonst stapeln sie sich. */
    if (j < zeilen.length && zeilen[j] === '') j++
  } else {
    gesehen.add(schluessel)
    raus.push(...block)
  }
  i = j
}
const neu = raus.join('\n')

const vorher = yaml.load(text) ?? []
const nachher = yaml.load(neu) ?? []
const menge = (liste) => new Set(liste.map((b) => JSON.stringify(b)))
const a = menge(vorher)
const b = menge(nachher)
const gleich = a.size === b.size && [...a].every((x) => b.has(x))
console.log(`Belege vorher ${vorher.length}, nachher ${nachher.length}, entfernt ${entfernt}`)
console.log(`Menge der Belege unverändert: ${gleich ? 'ja' : 'NEIN'} (${a.size} verschiedene)`)
console.log(`Kommentarzeilen vorher ${zeilen.filter((z) => z.startsWith('#')).length}, nachher ${raus.filter((z) => z.startsWith('#')).length}`)
if (!gleich || vorher.length - nachher.length !== entfernt) {
  console.error('Gegenprobe gescheitert — nichts geschrieben.')
  process.exit(1)
}
if (!trocken) writeFileSync(pfad, neu)
console.log(trocken ? '(trocken — nichts geschrieben)' : `${pfad} geschrieben`)
