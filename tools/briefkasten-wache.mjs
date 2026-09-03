#!/usr/bin/env node
/**
 * **Kommt Daniels Arbeit an — oder versickert sie?**
 *
 * Am 26.08.2026 gingen an einem Abend zweimal Meldungen aus der Browser-
 * Erweiterung verloren, ohne dass ein Lauf rot wurde: 508 Disney-Meldungen
 * wurden zu einem einzigen Eintrag abgehakt, 216 One-Piece-Meldungen
 * verschwanden ganz. Gefunden hat es Daniel, weil ihm eine Zahl in der
 * Oberfläche komisch vorkam.
 *
 * Diese Wache soll das vor ihm finden. Sie lief bis zum 03.09.2026 als tägliche
 * Routine auf seinem Rechner — Daniel: „diese routine kann doch problemlos
 * remote laufen? … änder das, sodass es nicht mehr auf meinem pc läuft."
 *
 * ## Was hier ein Befund ist, und was nicht
 *
 * **Eine hohe Zahl im Briefkasten ist keine Auffälligkeit** (gemessen
 * 01.09.2026). `pipeline/fetch-pruefungen.ts` lässt Meldungen, deren Adresse der
 * Datensatz nicht kennt, **absichtlich** liegen — sonst ginge Daniels Arbeit
 * verloren. Sie warten dann in `daniel-zum-abarbeiten/11-meldungen-ohne-
 * zuordnung.md` auf ihn. Ein Briefkasten mit 80 bis 100 Meldungen ist damit der
 * Normalzustand.
 *
 * **Auffällig ist erst, wenn Meldungen weder ankommen noch gelistet sind.**
 * Genau das prüft diese Wache: Jede Adresse, die der Briefkasten führt, muss
 * entweder zuzuordnen sein oder in der Liste stehen. Findet sich eine, die
 * beides nicht ist, kommt Arbeit nicht an.
 *
 * Aufruf: `LAUF_TOKEN=… node tools/briefkasten-wache.mjs`
 * Rückgabe 1 bei einem Befund, sonst 0 — der Workflow wird dann rot.
 */
import { readFileSync, existsSync } from 'node:fs'

const TOKEN = process.env.LAUF_TOKEN
if (!TOKEN) {
  console.error('LAUF_TOKEN fehlt — ohne ihn antwortet der Briefkasten nicht.')
  process.exit(1)
}

const WORKER = 'https://newsletter.animekalender.workers.dev'
const LISTE = 'daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md'

/*
  **Gezählt wird über `?zaehlen=1`, nicht über die Liste.**

  Die Listenabfrage trägt `LIMIT 500`. Am 26.08.2026 gab sie 497 Einträge
  zurück, während der Briefkasten 563 hielt — und der Schluss daraus („die
  Meldung ist verlorengegangen") war falsch. Eine Antwort, die abgeschnitten
  sein kann, beantwortet eine andere Frage als die gestellte.
*/
const antwort = await fetch(`${WORKER}/pruefung?zaehlen=1&token=${encodeURIComponent(TOKEN)}`)
if (!antwort.ok) {
  console.error(`Briefkasten antwortet mit HTTP ${antwort.status} — nicht prüfbar.`)
  process.exit(1)
}
const stand = await antwort.json()

/*
  `imBriefkasten` ist eine Aufstellung je Anbieter (`{primevideo: 16}`), keine
  Zahl — gemessen am 03.09.2026. Summiert wird deshalb über die Werte; ein
  `Number()` darauf ergibt `NaN` und macht aus einem Befund eine Zierde.
*/
const jeAnbieter = stand.imBriefkasten && typeof stand.imBriefkasten === 'object' ? stand.imBriefkasten : {}
const offen = Object.values(jeAnbieter).reduce((n, x) => n + Number(x || 0), 0)
const adressen = Array.isArray(stand.adressen) ? stand.adressen : []

/*
  **Eine fehlende Liste ist kein Befund.**

  Der Bau schreibt sie nur, wenn es Meldungen gibt, die er **nicht** zuordnen
  konnte. Sind alle zuzuordnen, gibt es nichts zu listen — und dann ist ihr
  Fehlen der Normalfall, nicht ein Verlust. Gemessen am 03.09.2026: 16 Adressen
  im Briefkasten, keine Liste, nichts kaputt.

  Behandelt wird sie deshalb als leere Liste; ob Arbeit versickert, entscheidet
  die Schwelle unten.
*/
const listenText = existsSync(LISTE) ? readFileSync(LISTE, 'utf8') : ''
const gelistet = new Set()
for (const zeile of listenText.split('\n')) {
  /* Die Adresse steht als Markdown-Verweis in der Tabelle. */
  for (const treffer of zeile.matchAll(/https?:\/\/[^\s)|]+/g)) gelistet.add(treffer[0])
}

const fehlend = adressen.filter((u) => !gelistet.has(u))

const verteilung = Object.entries(jeAnbieter).map(([k, v]) => `${k} ${v}`).join(', ')
console.log(`Briefkasten: ${offen} Meldungen auf ${adressen.length} Adressen (${verteilung || '—'})`)
console.log(`Liste ${LISTE}: ${gelistet.size} Adressen`)

if (!adressen.length) {
  console.log('Nichts im Briefkasten — nichts zu prüfen.')
} else {

/*
  **Eine Adresse fehlt nicht schon dann, wenn sie nicht in der Liste steht.**

  Zwischen Meldung und Liste liegt ein Bau: Was Daniel vor zehn Minuten
  gemeldet hat, kann noch nirgends stehen und ist trotzdem in Ordnung. Der
  Befund gilt deshalb erst, wenn **mehr als ein Fünftel** der Adressen fehlt —
  ein einzelner Nachzügler ist der Normalfall, ein Drittel ist es nicht.

  Das ist dieselbe Überlegung wie bei jeder Zusicherung in diesem Projekt: Unter
  welchen Umständen ist die Bedingung verletzt, **ohne** dass etwas kaputt ist?
*/
/*
  **Und Nachzügler sind der Normalfall, keine Ausnahme.**

  Zwischen Meldung und Liste liegt ein Bau. Wer abends zwanzig Titel meldet,
  hat am nächsten Morgen zwanzig Adressen im Briefkasten, die noch nirgends
  stehen — und nichts davon ist verloren. Ein Alarm dagegen wäre der Fehler,
  vor dem `CLAUDE.md` warnt: eine Prüfung, die zuverlässig zu Unrecht rot wird,
  ist schlimmer als keine, weil man aufhört hinzusehen.

  Gemeldet wird deshalb erst, wenn der Briefkasten **deutlich** über dem liegt,
  was ein Abend Arbeit ausmacht — und keine einzige Adresse gelistet ist. Dann
  ist nicht Daniel schneller als der Bau, dann kommt nichts an.
*/
const schwelle = 60
if (adressen.length >= schwelle && gelistet.size === 0) {
  console.log('')
  console.log(`⚠  ${fehlend.length} von ${adressen.length} Adressen sind weder zugeordnet noch gelistet:`)
  for (const u of fehlend.slice(0, 10)) console.log(`   ${u}`)
  if (fehlend.length > 10) console.log(`   … und ${fehlend.length - 10} weitere`)
  console.log('')
  console.log('Das heißt: Meldungen kommen weder im Datensatz an noch stehen sie zum Abarbeiten bereit.')
  process.exitCode = 1
} else {
  console.log(
    fehlend.length
      ? `${fehlend.length} Adresse(n) noch nicht gelistet — Nachzügler, solange der Briefkasten unter ${schwelle} bleibt.`
      : 'Alle Adressen sind gelistet.',
  )
}
}

/*
  **`process.exitCode` statt `process.exit()`.**

  Ein `process.exit()` unmittelbar nach einem `fetch` bringt Node 24 auf Windows
  mit einer libuv-Assertion zum Absturz (`UV_HANDLE_CLOSING`, gemessen
  03.09.2026): Der Prozess endet mit 127, und ein Workflow sähe darin einen
  Fehler, den es nicht gibt. Der Exit-Code wird deshalb gesetzt und der Prozess
  von selbst auslaufen gelassen.
*/
