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
import { liegengeblieben as liegengebliebeneAdressen, uebernahmeStau } from './briefkasten-wache-logik.mjs'

const TOKEN = process.env.LAUF_TOKEN
if (!TOKEN) {
  console.error('LAUF_TOKEN fehlt — ohne ihn antwortet der Briefkasten nicht.')
  process.exit(1)
}

const WORKER = 'https://newsletter.animekalender.workers.dev'
const LISTE = 'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md'
const UEBERNAHME = 'data/meldungen-uebernahme.json'
const ZURUECK = 'data/meldungen-zurueckgestellt.json'

/*
  **Gezählt wird über `?zaehlen=1`, nicht über die Liste.**

  Die Listenabfrage trägt ein Fenster (damals 500). Am 26.08.2026 gab sie 497 Einträge
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
/* `adressen` führt eine Adresse je Meldung (189 Meldungen auf 36 Adressen, gemessen 11.10.2026) — gezählt wird je Adresse. */
const adressen = [...new Set(Array.isArray(stand.adressen) ? stand.adressen : [])]

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

/* Was der Bestandslauf beim Eingrenzen zurückgestellt hat, ist bekannt und Arbeitsvorrat, kein Verlust (`meldungen-eingrenzen.mjs`). */
const zurueck = existsSync(ZURUECK) ? JSON.parse(readFileSync(ZURUECK, 'utf8')) : []
const zurueckJeAdresse = new Map(zurueck.map((e) => [e.url, e]))
const fehlend = adressen.filter((u) => !gelistet.has(u) && !zurueckJeAdresse.has(u))

const verteilung = Object.entries(jeAnbieter).map(([k, v]) => `${k} ${v}`).join(', ')
console.log(`Briefkasten: ${offen} Meldungen auf ${adressen.length} Adressen (${verteilung || '—'})`)
console.log(`Liste ${LISTE}: ${gelistet.size} Adressen`)
const zurueckImKasten = adressen.filter((u) => zurueckJeAdresse.has(u))
console.log(`Zurückgestellt (${ZURUECK}): ${zurueckImKasten.length} Adressen im Briefkasten`)
for (const u of zurueckImKasten.slice(0, 10)) {
  const e = zurueckJeAdresse.get(u)
  console.log(`   zurückgestellt seit ${e.seit}: ${u} — ${e.grund ?? 'ungeprüft (Versuchsgrenze)'}`)
}

if (!adressen.length) {
  console.log('Nichts im Briefkasten — nichts zu prüfen.')
} else {

/*
  **Nachzügler sind der Normalfall — aber nur bis zum nächsten Datenlauf.**

  Zwischen Meldung und Liste liegt ein Bau. Wer abends zwanzig Titel meldet,
  hat am nächsten Morgen Adressen im Briefkasten, die noch nirgends stehen,
  und nichts davon ist verloren. Eine Prüfung, die dagegen anschlägt, wird
  zuverlässig zu Unrecht rot (`CLAUDE.md`).

  Ein Befund ist deshalb jede ungelistete Adresse, deren **älteste Meldung über
  NACHZUEGLER_STUNDEN Stunden** alt ist: Seitdem lief mindestens ein Datenlauf,
  und die Liste führt auch, was er wegen unklarer Staffel liegen lässt (seit
  11.10.2026). Das Alter liest die Listenabfrage (`gemeldet_am`). Sie trägt
  ein Fenster (`OFFEN_FENSTER`, die ältesten 5000): eine Adresse, die fehlt, hat kein bekanntes Alter
  und zählt nicht als alt — ein Alarm aus Unwissen wäre falsch, und ein
  abgeschnittener Rest verbirgt höchstens weitere Funde, nie einen erfundenen.
  So geht es ohne Zustand.
*/
const NACHZUEGLER_STUNDEN = 24
const listeAntwort = await fetch(`${WORKER}/pruefung?token=${encodeURIComponent(TOKEN)}`)
if (!listeAntwort.ok) {
  console.error(`Meldungsliste antwortet mit HTTP ${listeAntwort.status} — Alter nicht prüfbar.`)
  process.exit(1)
}
const meldungen = (await listeAntwort.json()).pruefungen ?? []
const liegengeblieben = liegengebliebeneAdressen(fehlend, meldungen, Date.now(), NACHZUEGLER_STUNDEN)
if (liegengeblieben.length) {
  console.log('')
  console.log(`⚠  ${liegengeblieben.length} von ${adressen.length} Adressen sind weder zugeordnet noch gelistet:`)
  for (const u of liegengeblieben.slice(0, 10)) console.log(`   ${u}`)
  if (liegengeblieben.length > 10) console.log(`   … und ${liegengeblieben.length - 10} weitere`)
  console.log('')
  console.log('Das heißt: Meldungen kommen weder im Datensatz an noch stehen sie zum Abarbeiten bereit.')
  process.exitCode = 1
} else {
  console.log(
    fehlend.length
      ? `${fehlend.length} Adresse(n) noch nicht gelistet — Nachzügler, jünger als ${NACHZUEGLER_STUNDEN} Stunden.`
      : 'Alle Adressen sind gelistet.',
  )
}
/* Der Stau nennt die Ursache; rot macht den Lauf schon der Befund oben, dessen Bedingung der Stau voraussetzt. */
const stempel = existsSync(UEBERNAHME) ? JSON.parse(readFileSync(UEBERNAHME, 'utf8')).zuletzt : null
console.log(`Übernahme: zuletzt ${stempel ?? 'unbekannt'} (${UEBERNAHME})`)
const stau = uebernahmeStau(stempel, fehlend, meldungen, Date.now(), NACHZUEGLER_STUNDEN)
if (stau) {
  console.log(`⚠  Übernahme-Stau: seit ${stau.stunden} Stunden keine Meldung übernommen, ${stau.wartend} zuzuordnende warten länger als ${NACHZUEGLER_STUNDEN} Stunden.`)
  console.log('Das heißt: Der Bestandslauf nimmt neue Meldungen zurück (Schritt „Neue Handbelege prüfen“) oder sieht sie nicht.')
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
