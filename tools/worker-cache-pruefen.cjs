#!/usr/bin/env node
/**
 * **Eine gecachte Adresse, die niemand verwirft, hält einen überholten Stand.**
 *
 * Seit dem 01.09.2026 hält der Worker die Antworten der beiden Übersichts-
 * Endpunkte eine halbe Stunde im Cache der Edge (`ausCache` in
 * `worker/src/index.ts`). Das ist der Unterschied zwischen 9,9 Millionen
 * gelesenen Zeilen am Tag und 331.000 — an dem Tag hatte das Kontingent von
 * fünf Millionen nicht gereicht, und der Briefkasten war stundenlang tot.
 *
 * Die Frische hängt daran, dass jeder Schreibzugriff die Antwort verwirft.
 * `briefkastenCacheLeeren` kennt dafür eine **feste Liste** von Adressen —
 * und genau die veraltet lautlos: Wer einen dritten Endpunkt umhüllt oder der
 * Erweiterung einen neuen Abfrageweg gibt, merkt nichts. Der Titel steht dann
 * eine halbe Stunde nach der Meldung noch als offen da, und das ist der Fehler,
 * den Daniel am 01.09.2026 viermal melden musste, bevor er behoben war.
 *
 * Geprüft wird deshalb beides gegeneinander:
 *   1. jeder umhüllte Endpunkt hat einen Eintrag in der Verwerfen-Liste
 *   2. die Verwerfen-Liste läuft über die Weiterleitung, nicht je Schreibstelle
 */
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const datei = join(__dirname, '..', 'worker', 'src', 'index.ts')
const quelle = readFileSync(datei, 'utf8')

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

/* Und welche Adressen werden verworfen? */
const listeRoh = quelle.match(/const wege = \[([^\]]+)\]/)
pruefe(!!listeRoh, 'Verwerfen-Liste gefunden')
const wege = listeRoh ? [...listeRoh[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : []

for (const endpunkt of umhuellt) {
  pruefe(
    wege.some((w) => w.includes(endpunkt)),
    `«${endpunkt}» wird beim Schreiben verworfen`,
  )
}

/* Die Umkehrung: keine Adresse in der Liste, die es gar nicht mehr gibt. */
for (const weg of wege) {
  const kern = weg.replace(/^\?/, '').split('&')[0]
  pruefe(umhuellt.includes(kern), `«${weg}» gehört zu einem gehaltenen Endpunkt`)
}

/*
  Die Invalidierung hängt an der Weiterleitung. Steht sie stattdessen in einem
  einzelnen Zweig, ist sie beim nächsten neuen Zweig vergessen — der Grund,
  warum sie überhaupt dorthin gewandert ist.
*/
pruefe(
  /case '\/pruefung': \{[\s\S]{0,900}?briefkastenCacheLeeren/.test(quelle),
  'Verworfen wird an der Weiterleitung, nicht je Schreibstelle',
)
pruefe(
  /request\.method !== 'GET'\) ctx\.waitUntil\(briefkastenCacheLeeren/.test(quelle),
  'Verworfen wird bei jeder Methode außer GET',
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
  quelle.includes("SELECT DISTINCT plattform, url FROM pruefung WHERE url IS NOT NULL AND url != ''`,"),
  'ohne Zeitstempel gilt weiterhin die alte, strengere Rechnung',
)

console.log(fehler ? `\n${fehler} Fehler` : '\nalles grün')
process.exit(fehler ? 1 : 0)
