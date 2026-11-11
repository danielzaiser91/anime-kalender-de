/**
 * Tote TMDB-Kennungen im Cartoon-Bestand (11.11.2026): TMDB entfernt Einträge nachträglich, der Bestand wurde nie nachgeprüft
 * (9 von 924 mit 404, u. a. Transformers: Prime 327323). Nur ein eindeutiges 404 macht eine Kennung tot; 429, 5xx und
 * Netzfehler sind Nichtauskunft und lassen den Eintrag unverändert.
 *
 * 404 → Suche nach Name und Jahr: genau ein Animationstreffer (`waehleTreffer`) ersetzt die Kennung, sonst bleibt der Eintrag
 * in `data/cartoons.json` mit `tmdbTot` stehen und erscheint nicht (`hatAufnahmeBeleg`) — verschoben, nicht gelöscht.
 */
import type { CartoonEintrag } from './cartoons.ts'
import { waehleTreffer, type TmdbSuchtreffer } from './cartoon-handliste.ts'

export type TmdbStatus = 'ok' | 'tot' | 'unklar'

export interface ToteAbruf {
  status: (tmdbId: number) => Promise<TmdbStatus>
  suche: (begriff: string) => Promise<TmdbSuchtreffer[]>
  holen: (tmdbId: number) => Promise<CartoonEintrag | null>
}

export interface ToteBilanz {
  geprueft: number
  tot: number
  neuZugeordnet: number
  aufListe: number
  unklar: number
}

/** Der einzige Animationstreffer mit gleichem Namen (und Jahr) für einen toten Eintrag, sonst `undefined`. */
export async function neueKennung(e: CartoonEintrag, suche: ToteAbruf['suche']): Promise<number | undefined> {
  const name = e.titleDe ?? e.titleEn
  const begriffe = [...new Set([e.titleEn, name])]
  const treffer: TmdbSuchtreffer[] = []
  for (const b of begriffe) treffer.push(...(await suche(b)))
  const wahl = waehleTreffer({ adn: 0, name, original: e.titleEn, jahr: e.jahr }, treffer.filter((t) => t.id !== e.tmdbId))
  return 'id' in wahl ? wahl.id : undefined
}

/**
 * Prüft die Einträge `zuPruefen` (Schlüssel im Bestand) und schreibt das Ergebnis in `bestand`: neue Kennung (alter Schlüssel
 * weg, ADN-Kennung bleibt), Dublette einer schon geführten Kennung (alter Eintrag weg) oder `tmdbTot` samt Datum; ein wieder
 * erreichbarer Eintrag verliert `tmdbTot`. `log` bekommt eine Zeile je toter Kennung.
 */
export async function pruefeTote(
  bestand: Record<string, CartoonEintrag>,
  zuPruefen: string[],
  abruf: ToteAbruf,
  heute: string,
  log: (zeile: string) => void,
): Promise<ToteBilanz> {
  const b: ToteBilanz = { geprueft: 0, tot: 0, neuZugeordnet: 0, aufListe: 0, unklar: 0 }
  for (const schluessel of zuPruefen) {
    const alt = bestand[schluessel]
    if (!alt) continue
    b.geprueft++
    const status = await abruf.status(alt.tmdbId)
    if (status === 'unklar') {
      b.unklar++
      continue
    }
    if (status === 'ok') {
      if (alt.tmdbTot) bestand[schluessel] = { ...alt, tmdbTot: undefined }
      continue
    }
    b.tot++
    const neu = await neueKennung(alt, abruf.suche)
    if (neu !== undefined && bestand[String(-neu)]) {
      delete bestand[schluessel]
      b.neuZugeordnet++
      log(`  ${alt.tmdbId} „${alt.titleEn}“ tot, TMDB ${neu} steht schon im Bestand — alter Eintrag entfernt`)
      continue
    }
    const geholt = neu === undefined ? null : await abruf.holen(neu)
    if (geholt) {
      delete bestand[schluessel]
      bestand[String(geholt.id)] = alt.adnId ? { ...geholt, adnId: alt.adnId } : geholt
      b.neuZugeordnet++
      log(`  ${alt.tmdbId} „${alt.titleEn}“ tot, neu zugeordnet: TMDB ${geholt.id}`)
      continue
    }
    bestand[schluessel] = { ...alt, tmdbTot: alt.tmdbTot ?? heute }
    b.aufListe++
    log(`  ${alt.tmdbId} „${alt.titleEn}“ tot, kein eindeutiger Treffer — aus der Veröffentlichung genommen (tmdbTot)`)
  }
  return b
}

export function zaehlzeileTote(b: ToteBilanz): string {
  return `${b.tot} tote Kennungen, ${b.neuZugeordnet} neu zugeordnet, ${b.aufListe} auf Liste (${b.geprueft} geprüft, ${b.unklar} ohne Auskunft)`
}
