import { log } from '../lib/util.ts'
import { titelAusKatalogEintrag } from './katalog-titel.ts'
import { type Title } from '../../shared/types.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'
import { wegVerneint } from '../lib/dub-confirmed.ts'

type SerieMitTiteln = { serie: CrDubData['serien'][number]; titel: Map<number, Title> }

/**
 * **Ein deutscher Block, den keiner unserer Titel führt — das Special.**
 *
 * Der teuerste Fall dieser Woche: „Lord of Mysteries"
 * führt bei Crunchyroll vier Blöcke. Unser Datensatz kannte nur den ersten,
 * denn die drei anderen sind bei AniList **eigene Einträge** — Specials,
 * Chibi-Kurzfilme, der nächste Arc. Am 10.09.2026 erschienen die drei
 * Specials auf Deutsch; auf der Seite stand davon nichts, und zwar nicht
 * wegen eines fehlenden Abrufs: `beurteile()` fragt nur Titel, die diese
 * Adresse schon **tragen**. Ein Titel ohne Verweis wird nie beurteilt, und
 * ohne Urteil bekommt er keinen Verweis — eine Warteschlange, die ihre
 * eigene Lücke bewacht (dieselbe Klasse wie in `CLAUDE.md`, „Eine
 * Warteschlange, die sich aus dem Bestand bildet").
 *
 * Diese Runde schließt sie, und zwar eng:
 *
 * - Der Block muss **vollständig deutsch** sein (`deutsch === folgen`).
 * - Keiner der Titel dieser Adresse darf dieselbe Folgenzahl haben — sonst
 *   gehört der Block ihm, nicht einem Geschwister.
 * - Unter den Geschwistern derselben Reihe darf es **genau einen** Titel
 *   mit dieser Folgenzahl geben, und der darf noch keinen
 *   Crunchyroll-Verweis tragen.
 *
 * Bleibt es mehrdeutig, passiert nichts: Eine falsche Zuordnung behauptet
 * eine Sprachfassung über den falschen Titel, und das ist schlimmer als
 * eine Lücke, die eine Zeile im Log nennt.
 */
export function ordneGeschwisterBloeckeZu({ nachSerienId, titles, katalogEintraege, handNein }: {
  nachSerienId: Map<string, SerieMitTiteln>
  titles: Map<number, Title>
  katalogEintraege: KatalogEintrag[]
  handNein: ReadonlySet<string>
}) {
  let geschwisterBloecke = 0
  for (const { serie, titel: gruppe } of nachSerienId.values()) {
    if (serie.katalog !== 'de' || !serie.deutschImAngebot || serie.nichtVerfuegbar) continue
    const unsere = [...gruppe.values()]
    if (!unsere.length) continue
    const reihe = unsere[0]!.franchiseId ?? unsere[0]!.id
    const belegteZahlen = new Set(unsere.map((t) => t.episodes).filter(Boolean))
    for (const block of serie.staffeln ?? []) {
      const zahl = block.folgen ?? 0
      if (!zahl || block.deutsch !== zahl) continue
      if (belegteZahlen.has(zahl)) continue
      /* Geschwister aus dem Bestand **und** aus dem Katalog — das Special steht meist dort. */
      const ausBestand = [...titles.values()].filter(
        (t) => (t.franchiseId ?? t.id) === reihe && t.id !== reihe && t.episodes === zahl,
      )
      const ausKatalog = katalogEintraege.filter(
        (e) =>
          e.folgen === zahl &&
          !titles.has(e.id) &&
          (e.eltern ?? []).some((x) => unsere.some((t) => t.id === x)),
      )
      const treffer = [...ausBestand.map((t) => t.id), ...ausKatalog.map((e) => e.id)]
      if (treffer.length !== 1) continue
      const id = treffer[0]!
      if (wegVerneint(handNein, id, 'crunchyroll', serie.url)) continue
      let ziel = titles.get(id)
      if (!ziel) {
        const e = katalogEintraege.find((x) => x.id === id)!
        ziel = { ...titelAusKatalogEintrag(e), franchiseId: reihe }
        titles.set(e.id, ziel)
      }
      if (ziel.streams.some((x) => x.platform === 'crunchyroll')) continue
      ziel.streams.push({ platform: 'crunchyroll', url: serie.url, dub: true })
      geschwisterBloecke++
      log(
        `  Crunchyroll-Block „${block.name}" (${zahl} Folgen, deutsch) dem Titel ${ziel.id} ` +
          `(${ziel.titleDe ?? ziel.titleEn ?? ziel.titleRomaji}) zugeordnet`,
      )
    }
  }
  if (geschwisterBloecke)
    log(`${geschwisterBloecke} deutsche Blöcke einem Geschwistertitel zugeordnet, der bisher keinen Weg hatte`)
}
