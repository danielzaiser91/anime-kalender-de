import type { StreamLink, Title } from '../../shared/types.ts'
import { anbieterWegMitJa, geerbteWege } from '../../shared/kanal-anbieter.ts'
import { todayIso } from '../../shared/time.ts'
import { readJson } from '../lib/util.ts'
import { jwTonAnSeite } from '../lib/jw-seite.ts'
import type { JwBefund } from '../lib/jw-vertrauen.ts'

/** Ein Weg, den der Anbieter noch führt (`entferntAm` markiert einen Weg, der nur noch als Vermerk steht). */
const geschaltet = (s: StreamLink): boolean => !s.entferntAm

/**
 * Sagt JustWatch an genau der Seite des Kanal-Wegs Ton ohne Deutsch? Dann ist die Seite gemessen und schlägt die Annahme,
 * der Kanal sei so deutsch wie sein Anbieter (16.10.2026). Ein Serien-„ohne de“ gilt auch bei Mehrteilern: keine Staffel hat es.
 */
export function jwNeinAnSeite(): (t: Title, s: StreamLink) => boolean {
  return jwNeinAus(readJson<Record<string, JwBefund>>('data/justwatch-audio.json', {}), todayIso())
}

/** Ohne Befund oder ohne Tonangabe an der Seite ist nichts gemessen: kein Nein. */
export function jwNeinAus(befunde: Record<string, JwBefund>, heute: string): (t: Title, s: StreamLink) => boolean {
  return (t, s) => jwTonAnSeite(befunde[String(t.id)], s.url, heute)?.deutsch === false
}

/**
 * **Ein Prime-Kanal ist so deutsch wie sein Anbieter** (Daniel, 13.10.2026: „Prime Video (Crunchyroll)“ wie Crunchyroll,
 * Reborn as a Space Mercenary). Hat der Anbieter-Weg (Crunchyroll, ADN) ein belegtes Ja und der Kanal-Weg kein eigenes
 * Urteil, übernimmt der Kanal `dub` und `dubRanges`. Ein Nein oder ein offenes Urteil des Anbieters (Golden Wind, Hell Mode),
 * ein fehlender Anbieter-Weg, ein eigenes Urteil des Kanals (Ja oder Nein) und JustWatchs Ton an der Kanal-Seite (Flagge, `jwNein`)
 * bleiben unberührt: JustWatch zur selben Seite schlägt die Annahme. Gibt die Zahl der Wege zurück.
 */
export function kanalErbtVomAnbieter(titles: Iterable<Title>, jwNein: (t: Title, s: StreamLink) => boolean = () => false): number {
  let geerbt = 0
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      /* Ein Weg aus einem Termin trägt nie ein Tonurteil (`tonOhneBeleg`); der Termin kann das Gegenteil sagen (`sprache: offen`). */
      if (s.dub !== undefined || s.herkunft === 'termin' || !geschaltet(s)) continue
      const quelle = anbieterWegMitJa(s, t.streams)
      if (!quelle || (s.dubQuelle && !s.dubHintOnly) || jwNein(t, s)) continue
      s.dub = true
      s.dubAbgeleitet = 'kanal-erbt'
      delete s.dubQuelle
      delete s.dubStand
      delete s.dubHintOnly
      geerbteWege.add(s)
      if (!s.dubRanges?.length && quelle.dubRanges?.length) s.dubRanges = quelle.dubRanges.map((r) => ({ ...r }))
      geerbt++
    }
  }
  return geerbt
}
