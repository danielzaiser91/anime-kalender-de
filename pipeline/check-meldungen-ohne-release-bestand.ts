/**
 * Bestandsteil des Wächters „Meldung mit Termin und deutschem Ton ohne Release“ (Ziel 0). Liest die Bau-Ausgabe
 * (`data/proposals/nicht-zugeordnet.json`, `anime2you.json`) und gehört deshalb in `check:bestand`, nicht in `check:logic`: dort färbte jede neue
 * unzuordenbare Meldung alle PR-Ketten rot. Verglichen werden Kennungen (Artikel | Titel) mit `BEKANNT_OHNE_RELEASE`, keine Anzahl:
 * eine neue Meldung wird als herabgestufte Warnzeile gemeldet (Posteingang, Exit 0 — sie bringt nichts Falsches live, der Bestandsbau soll nicht
 * stehen), eine erledigte als Hinweis, sie von der Liste zu streichen. Die Zeilen baut `pipeline/lib/meldungen-ohne-release-zeilen.ts`.
 */
import { readFileSync } from 'node:fs'
import { ueberfaelligOhneRelease } from './lib/meldungen-ohne-release.ts'
import { BEKANNT_OHNE_RELEASE } from './lib/meldungen-ohne-release-bekannt.ts'
import { zeilenOhneRelease } from './lib/meldungen-ohne-release-zeilen.ts'
import type { NichtZugeordnet } from './lib/sammel-unzugeordnet.ts'

const datei = JSON.parse(readFileSync('data/proposals/nicht-zugeordnet.json', 'utf8')) as { stand: string; eintraege: NichtZugeordnet[] }
const vorschlaege = (JSON.parse(readFileSync('data/proposals/anime2you.json', 'utf8')) as { proposals: { articleUrl: string; publishedAt: string }[] }).proposals
const tage = new Map(vorschlaege.map((v) => [v.articleUrl, v.publishedAt]))
const befunde = ueberfaelligOhneRelease(datei.eintraege, tage, datei.stand)
for (const zeile of zeilenOhneRelease(befunde, BEKANNT_OHNE_RELEASE, datei.stand)) console.log(zeile)
