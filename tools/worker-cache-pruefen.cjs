#!/usr/bin/env node
/**
 * **Eine gecachte Adresse, die niemand verwirft, hält einen überholten Stand — und eine, die bei
 * jeder Meldung verworfen wird, kostet das Tageskontingent.**
 *
 * Seit dem 01.09.2026 hält der Worker die Antworten seiner Übersichts-Endpunkte im Cache der Edge
 * (`ausCache`, `worker/src/pruefung.ts`). Das ist der Unterschied zwischen 9,9 Millionen gelesenen
 * Zeilen am Tag und 331.000 — an dem Tag hatte das Kontingent von fünf Millionen nicht gereicht,
 * und der Briefkasten war stundenlang tot.
 *
 * Bis zum 28.09.2026 verwarf dabei **jeder Schreibzugriff** die beiden Adressen von `?zaehlen=1`
 * (`briefkastenCacheLeeren`, eine feste Liste). Genau das hat sich gerächt: Beim Melde-Durchgang
 * liegt zwischen zwei Meldungen weniger als die Frist, der Cache greift also nie — der Worker
 * rechnete die teure Zählung **540-mal** neu, 4,35 Mio. gelesene Zeilen, **62 %** des Kontingents
 * (`wrangler d1 insights`). Dieselbe Lehre war am 24.09.2026 schon für `?stand=1` gezogen worden.
 *
 * Jetzt wird nichts mehr verworfen: Jede Antwort läuft nach ihrer eigenen Frist ab (eine Minute der
 * Stand, dreißig Minuten die Zählung). Wer selbst meldet, überbrückt das in der Erweiterung.
 *
 * Geprüft wird deshalb, dass **keine** Verwerfen-Liste mehr existiert und dass die gehaltenen
 * Endpunkte ihre Frist tragen.
 */
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

/* Der ganze Worker als ein Text: `index.ts` zuerst, dann die Module (`pruefung.ts`, …). */
const ordner = join(__dirname, '..', 'worker', 'src')
const dateien = ['index.ts', ...readdirSync(ordner).filter((f) => f.endsWith('.ts') && f !== 'index.ts').sort()]
const quelle = dateien.map((f) => readFileSync(join(ordner, f), 'utf8')).join('\n')

let fehler = 0
const pruefe = (bedingung, text) => {
  if (bedingung) {
    console.log('  ok   ' + text)
  } else {
    console.log('  FEHL ' + text)
    fehler++
  }
}

console.log('Worker-Cache')

/* Welche Endpunkte werden gehalten? Jeder trägt `return ausCache(` in seiner if-Zeile. */
const umhuellt = []
for (const zeile of quelle.split('\n')) {
  if (!zeile.includes('return ausCache(')) continue
  const treffer = zeile.match(/searchParams\.get\('([^']+)'\) === '([^']+)'/)
  if (treffer) umhuellt.push(treffer[1] + '=' + treffer[2])
}
pruefe(umhuellt.length >= 2, `${umhuellt.length} Endpunkte gehalten: ${umhuellt.join(', ') || '—'}`)

/*
  **Und welche Adressen werden verworfen? Keine** (28.09.2026).

  Bis heute stand hier eine Verwerfen-Liste mit `?zaehlen=1` und `?zaehlen=1&nummern=1`. Genau sie
  hat das Tageskontingent gekostet: Der Endpunkt liest je Neuberechnung die **ganze** Adresstabelle
  (im Mittel 8049 Zeilen), und weil jede Meldung den Eintrag löschte, rechnete der Worker ihn am
  Tag des Melde-Durchgangs **540-mal** neu — 4,35 Mio. Zeilen, **62 %** des Kontingents
  (`wrangler d1 insights`). Dieselbe Lehre war am 24.09.2026 schon für `?stand=1` gezogen worden
  (1.834 Neuberechnungen, 9,2 Mio. Zeilen); sie fehlte nur beim teuren Endpunkt.

  Jede Antwort läuft jetzt nach ihrer eigenen Frist ab (eine Minute der Stand, dreißig Minuten die
  Zählung). Wer gerade selbst gemeldet hat, überbrückt das in der Erweiterung
  (`frischGemeldetNetflix`) — für alle anderen ist ein halbstündlich alter Zähler harmlos.
*/
pruefe(
  !/const wege = \[/.test(quelle),
  'keine Verwerfen-Liste mehr — sonst rechnet der Melde-Durchgang die teure Zählung je Meldung neu',
)

/*
  Eine Fehlerantwort darf sich nicht festsetzen — sonst hält ein einzelner
  D1-Ausfall den Briefkasten eine halbe Stunde lang für leer.
*/
pruefe(/if \(frisch\.status === 200\)/.test(quelle), 'Nur erfolgreiche Antworten werden gehalten')

/*
  **Der Prüfstand-Endpunkt zieht nur ab, was er noch nicht kennt.**

  Am 10.09.2026 zeigte die Statusanzeige eine einzige Pille („Amazon 2 Suchen"),
  während die Prüfliste fünf Aufgaben führte — Daniel: „im todo stehen viel mehr
  meldungen etc die ich machen muss als im status app als pill stehen."

  Die Ursache war ein `SELECT DISTINCT plattform, url` **ohne Zeitfilter**: Jede
  jemals gemeldete Adresse galt als erledigt. Das stimmte, solange eine Meldung
  je Adresse den ganzen Titel abhakte; seit die Prüfliste einzelne Folgen nennt
  („S1 Folge 26"), kann dieselbe Adresse weiter offen sein.

  Geprüft wird beides: dass der Zeitstempel des Prüfstands gelesen wird und dass
  die Abfrage ihn benutzt. Ohne den zweiten Teil wäre es ein Wert, den niemand
  einsetzt — genau der Fehler, den dieses Projekt fünfmal an Datendateien hatte
  (CLAUDE.md, „Eine Datei zu schreiben ist nicht dasselbe wie sie zu benutzen").
*/
pruefe(
  quelle.includes('const seit = stand.erzeugtAm ?? null'),
  'Der Prüfstand-Zeitstempel wird gelesen',
)
pruefe(
  quelle.includes('gemeldet_am > ?1'),
  'und die Abfrage der gemeldeten Adressen benutzt ihn',
)
/*
  Der Rückfall ohne Zeitstempel bleibt: Ein alter oder kaputter Prüfstand soll
  lieber ein Ziel zu wenig zeigen als eins, das längst erledigt ist.
*/
pruefe(
  quelle.includes("SELECT DISTINCT plattform, url, staffel, gemeldet_am FROM pruefung WHERE url IS NOT NULL AND url != ''`,"),
  'ohne Zeitstempel gilt weiterhin die alte, strengere Rechnung',
)
/*
  29.09.2026: Eine Wiedervorlage ist erst erledigt, wenn eine Meldung **nach ihrem `seit`**
  angekommen ist — nicht durch ihren alten Beleg (dann „7 statt 9") und nicht nie (dann App 9,
  Erweiterung 0). Geprüft wird beides: die Frist und ihr Vergleich mit der jüngsten Meldung.
*/
pruefe(quelle.includes('if (z.seit) {'), 'eine Wiedervorlage hat ihre eigene Frist (`seit`)')
pruefe(quelle.includes('am <= z.seit'), 'und erledigt sie erst durch eine Meldung danach')
/* 22.09.2026: Ein Ziel mit offenen Staffeln ist erst erledigt, wenn jede gemeldet ist. */
pruefe(
  quelle.includes('return !z.staffeln.every((nr) => gemeldet?.has(nr))'),
  'ein Ziel mit Staffelangabe verschwindet erst, wenn jede seiner Staffeln gemeldet ist',
)

pruefe(
  quelle.includes("for (const r of [...(jemals ?? []), ...(results ?? []).filter((x) => x.url)])"),
  'eine unübernommene Meldung zählt als gemeldet, unabhängig vom Prüfstand-Zeitstempel',
)

console.log(fehler ? `\n${fehler} Fehler` : '\nalles grün')
process.exit(fehler ? 1 : 0)
