import { readJson, log } from '../lib/util.ts'
import { dubKey, type DubCheck } from '../lib/dub-confirmed.ts'
import { type Title } from '../../shared/types.ts'

/**
 * Was auf Crunchyrolls Serienseiten steht — als Beleg, nicht als Vorbild.
 *
 * Der Scraper liest dort je Folge, ob eine deutsche Tonspur vorliegt.
 * Übernommen wird ausschließlich diese Auskunft; Crunchyrolls
 * Staffeleinteilung bleibt draußen. Sie enthält Folgendoppelungen, mehrfache
 * Wähler-Einträge zur selben Staffel und Blöcke, die zwei unserer Staffeln
 * zusammenfassen. Unsere Einteilung kommt von AniList
 * und bleibt maßgeblich.
 *
 * Handgeprüftes schlägt auch das: Der Block läuft **vor** dem Einlesen von
 * `dub-confirmed.yaml`, damit ein Mensch das letzte Wort behält.
 */
/*
  **Titel ohne Verweis, für die der deutsche Crunchyroll-Katalog Deutsch führt.**

  1.331 Titel im Bestand haben keinen einzigen Verweis. Für 101 nannte TMDB
  Crunchyroll als Anbieter; `tools/cr-vorschlaege-pruefen.mjs` hat sie am
  28.08.2026 einzeln in der Suche nachgeschlagen — von einer deutschen Leitung,
  weil Crunchyroll die Region aus der IP ableitet.

  Sieben davon führen `de-DE` in ihren Tonspuren. Das ist ein **Beleg**, keine
  Vermutung: Die Angabe steht am Werk selbst und kommt aus dem Katalog, den ein
  Besucher hier sieht.

  **Ein Handbeleg schlägt sie trotzdem.** Wer in `dub-confirmed.yaml` steht,
  wurde angesehen — auch wenn dort ein Nein steht. Das ist die Regel, an der
  am 25.08.2026 ein Lauf fünf geprüfte Neins überschrieben hat.
*/
export function ergaenzeCrAusVorschlaegen({ titles, checks }: {
  titles: Map<number, Title>
  checks: Map<string, DubCheck>
}) {
  const crVorschlaege = readJson<
    Record<string, { gefunden?: boolean; seriesId?: string; crTitel?: string; deutsch?: boolean }>
  >('data/cr-vorschlaege.json', {})
  let crErgaenzt = 0
  for (const [id, v] of Object.entries(crVorschlaege)) {
    if (!v.deutsch || !v.seriesId) continue
    const title = titles.get(Number(id))
    if (!title) continue
    if (title.streams.some((x) => x.platform === 'crunchyroll')) continue
    /* Ein Handbeleg — auch ein verneinender — hat Vorrang. */
    if (checks.has(dubKey(Number(id), 'crunchyroll'))) continue
    title.streams.push({
      platform: 'crunchyroll',
      url: `https://www.crunchyroll.com/de/series/${v.seriesId}`,
      dub: true,
    })
    crErgaenzt++
  }
  if (crErgaenzt) log(`${crErgaenzt} Crunchyroll-Verweise aus der Suche ergänzt (deutscher Katalog nennt de-DE)`)
}
