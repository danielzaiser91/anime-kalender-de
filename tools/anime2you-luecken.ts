/**
 * Anime2You-Lücken: Titelblöcke, in denen der Artikel „Sprache: Deutsch“ nennt, zu denen der Datensatz aber keinen Termin beim
 * genannten Anbieter führt (13.10.2026, zweite Runde der Anime2You-Handeinträge: 36 Blöcke von 86, davon 15 echte Lücken).
 *
 * Liest die Aussagen, die `fetch-sammelartikel.ts` aus den Artikeln gezogen hat (`data/proposals/aussagen.json`), und gleicht sie
 * **neu** gegen die veröffentlichten Daten ab (`public/data/`): Der gespeicherte Abgleich ist so alt wie der letzte Vorschlagslauf und
 * hielte schon eingetragene Titel noch für Lücken. Nichts wird geschrieben, kein Abruf.
 *
 * Aufruf: `npx tsx tools/anime2you-luecken.ts [--seit JJJJ-MM-TT]` (Vorgabe: alle gespeicherten Aussagen).
 * `neu` = Titel zugeordnet, aber kein Release beim Anbieter; `ohne-zuordnung` = der Titel ließ sich nicht zuordnen (Namen prüfen, ggf. `anisearch-ids-hand.yaml`).
 * Vor jedem Eintrag den Artikel lesen: Auch Meldungen über Katalogabgänge erscheinen hier (Death Note und Kuroko’s Basketball, 13.10.2026: „bleiben bei Netflix“),
 * und das Datenmodell kennt keine Abgänge.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Aussage } from '../pipeline/lib/aussagen.ts'
import { katalogLaden, releasesLaden, ergebnisseZu, type Ergebnis } from '../pipeline/lib/aussagen-abgleich.ts'

export interface Luecke {
  status: 'neu' | 'ohne-zuordnung'
  titel: string
  zusatz?: string
  plattformen: string[]
  datum: string
  artikel: string
}

/** Blöcke mit Deutsch-Zusage und Start, zu denen der Bestand nichts führt (`neu`) oder die sich nicht zuordnen ließen. */
export function luecken(ergebnisse: Ergebnis[], seit = ''): Luecke[] {
  return ergebnisse
    .filter((e) => e.deutsch === 'ja' && e.art === 'start' && e.quelle.veroeffentlicht >= seit)
    .filter((e) => e.bestand.status === 'neu' || e.bestand.status === 'ohne-zuordnung')
    .map((e) => ({
      status: e.bestand.status as Luecke['status'],
      titel: e.titel,
      ...(e.zusatz ? { zusatz: e.zusatz } : {}),
      plattformen: e.plattformen,
      datum: e.quelle.veroeffentlicht,
      artikel: e.quelle.url,
    }))
}

/** Gespeicherte Ergebnisse ohne ihren alten Abgleich: Nur die Aussage selbst zählt. */
function aussagenLesen(datei: string): Aussage[] {
  const roh = JSON.parse(readFileSync(datei, 'utf8')) as { aussagen: { ergebnis: Aussage & Partial<Ergebnis> }[] }
  return roh.aussagen.map(({ ergebnis: { zuordnung, offen, bestand, ...aussage } }) => aussage as Aussage)
}

function main(): void {
  const i = process.argv.indexOf('--seit')
  const seit = i > 0 ? process.argv[i + 1] : ''
  const { katalog, titel } = katalogLaden()
  const neu = ergebnisseZu(aussagenLesen('data/proposals/aussagen.json'), katalog, titel, releasesLaden())
  const liste = luecken(neu, seit).sort((a, b) => a.datum.localeCompare(b.datum))
  for (const l of liste) console.log(`${l.status.padEnd(14)} ${l.datum} ${l.plattformen.join('+').padEnd(18)} ${l.titel}${l.zusatz ? ` – ${l.zusatz}` : ''}  ${l.artikel}`)
  console.log(`${liste.length} Lücken (${liste.filter((l) => l.status === 'neu').length} neu, ${liste.filter((l) => l.status === 'ohne-zuordnung').length} ohne Zuordnung) aus ${neu.length} Aussagen.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
