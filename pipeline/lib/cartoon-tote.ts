/**
 * Tote TMDB-Kennungen im Cartoon-Bestand (11.11.2026): TMDB entfernt Einträge nachträglich, der Bestand wurde nie nachgeprüft
 * (9 von 924 mit 404, u. a. Transformers: Prime 327323). Nur ein eindeutiges 404 macht eine Kennung tot; 429, 5xx und
 * Netzfehler sind Nichtauskunft — auch die der Suche und des Einzelabrufs — und lassen den Eintrag unverändert.
 *
 * 404 → Suche nach Name und Jahr: genau ein Animationstreffer (`waehleTreffer`) ersetzt die Kennung, sonst bleibt der Eintrag
 * in `data/cartoons.json` mit `tmdbTot` stehen und erscheint nicht (`hatAufnahmeBeleg`; ein ADN-belegter Titel bleibt sichtbar).
 */
import type { CartoonEintrag } from './cartoons.ts'
import { waehleTreffer, type TmdbSuchtreffer } from './cartoon-handliste.ts'

export type TmdbStatus = 'ok' | 'tot' | 'unklar'

export interface ToteAbruf {
  status: (tmdbId: number) => Promise<TmdbStatus>
  /** `null` = Nichtauskunft (429, 5xx, Netz), nie „kein Treffer“. */
  suche: (begriff: string) => Promise<TmdbSuchtreffer[] | null>
  /** `null` = TMDB kennt die Kennung, aber kein Animationseintrag; `'unklar'` = Nichtauskunft. */
  holen: (tmdbId: number) => Promise<CartoonEintrag | null | 'unklar'>
  /** Pause nach jeder Nichtauskunft (Rate-Limit), damit die Prüfung nicht weiterfeuert. */
  pause?: () => Promise<void>
}

export interface ToteBilanz {
  geprueft: number
  tot: number
  neuZugeordnet: number
  aufListe: number
  unklar: number
  /** Such- und Einzelabrufe nach toten Kennungen in diesem Lauf. */
  zusatz: number
  abgebrochen: boolean
}

/** Grenzen je Lauf: so viele Nichtauskünfte hintereinander brechen die Prüfung ab; so viele tote Kennungen werden höchstens neu gesucht. */
export const MAX_UNKLAR_FOLGE = 5
export const MAX_TOT_JE_LAUF = 50

/** Der einzige Animationstreffer mit gleichem Namen (und Jahr) für einen toten Eintrag; `undefined` = keiner, `'unklar'` = Suche ohne Auskunft. */
export async function neueKennung(e: CartoonEintrag, suche: ToteAbruf['suche']): Promise<number | undefined | 'unklar'> {
  const name = e.titleDe ?? e.titleEn
  const begriffe = [...new Set([e.titleEn, name])]
  const treffer: TmdbSuchtreffer[] = []
  for (const b of begriffe) {
    const antwort = await suche(b)
    if (!antwort) return 'unklar'
    treffer.push(...antwort)
  }
  const wahl = waehleTreffer({ adn: 0, name, original: e.titleEn, jahr: e.jahr }, treffer.filter((t) => t.id !== e.tmdbId))
  return 'id' in wahl ? wahl.id : undefined
}

/** Entscheidet einen Eintrag mit 404: neu zuordnen, Dublette entfernen oder auf die Liste; `'unklar'` lässt ihn unverändert. */
async function behandleTot(
  bestand: Record<string, CartoonEintrag>,
  schluessel: string,
  abruf: ToteAbruf,
  heute: string,
  log: (zeile: string) => void,
  b: ToteBilanz,
): Promise<'fertig' | 'unklar'> {
  const alt = bestand[schluessel]
  if (b.neuZugeordnet + b.aufListe >= MAX_TOT_JE_LAUF) return 'unklar'
  const neu = await neueKennung(alt, abruf.suche)
  if (neu === 'unklar') return 'unklar'
  if (neu !== undefined && bestand[String(-neu)]) {
    delete bestand[schluessel]
    b.tot++
    b.neuZugeordnet++
    log(`  ${alt.tmdbId} „${alt.titleEn}“ tot, TMDB ${neu} steht schon im Bestand — alter Eintrag entfernt`)
    return 'fertig'
  }
  const geholt = neu === undefined ? null : await abruf.holen(neu)
  if (geholt === 'unklar') return 'unklar'
  b.tot++
  if (geholt) {
    delete bestand[schluessel]
    bestand[String(geholt.id)] = alt.adnId ? { ...geholt, adnId: alt.adnId } : geholt
    b.neuZugeordnet++
    log(`  ${alt.tmdbId} „${alt.titleEn}“ tot, neu zugeordnet: TMDB ${geholt.id}`)
    return 'fertig'
  }
  bestand[schluessel] = { ...alt, tmdbTot: alt.tmdbTot ?? heute }
  b.aufListe++
  log(`  ${alt.tmdbId} „${alt.titleEn}“ tot, kein eindeutiger Treffer — aus der Veröffentlichung genommen (tmdbTot)`)
  return 'fertig'
}

/** Prüft einen Eintrag; `'unklar'` bei jeder Nichtauskunft (Status, Suche, Einzelabruf, Riegel). */
async function pruefeEinen(
  bestand: Record<string, CartoonEintrag>,
  schluessel: string,
  abruf: ToteAbruf,
  heute: string,
  log: (zeile: string) => void,
  b: ToteBilanz,
): Promise<'fertig' | 'unklar'> {
  const status = await abruf.status(bestand[schluessel].tmdbId)
  if (status === 'unklar') return 'unklar'
  if (status === 'ok') {
    if (bestand[schluessel].tmdbTot) bestand[schluessel] = { ...bestand[schluessel], tmdbTot: undefined }
    return 'fertig'
  }
  return behandleTot(bestand, schluessel, abruf, heute, log, b)
}

/**
 * Prüft die Einträge `zuPruefen` (Schlüssel im Bestand) und schreibt das Ergebnis in `bestand`: neue Kennung (alter Schlüssel
 * weg, ADN-Kennung bleibt), Dublette einer schon geführten Kennung (alter Eintrag weg) oder `tmdbTot` samt Datum; ein wieder
 * erreichbarer Eintrag verliert `tmdbTot`. Nach `MAX_UNKLAR_FOLGE` Nichtauskünften in Folge endet die Prüfung, der Rest gilt als
 * unklar (nie als tot). `log` bekommt eine Zeile je toter Kennung.
 */
export async function pruefeTote(
  bestand: Record<string, CartoonEintrag>,
  zuPruefen: string[],
  abruf: ToteAbruf,
  heute: string,
  log: (zeile: string) => void,
): Promise<ToteBilanz> {
  const b: ToteBilanz = { geprueft: 0, tot: 0, neuZugeordnet: 0, aufListe: 0, unklar: 0, zusatz: 0, abgebrochen: false }
  const gezaehlt: ToteAbruf = {
    ...abruf,
    suche: async (begriff) => (b.zusatz++, abruf.suche(begriff)),
    holen: async (id) => (b.zusatz++, abruf.holen(id)),
  }
  let folge = 0
  for (let i = 0; i < zuPruefen.length; i++) {
    if (!bestand[zuPruefen[i]]) continue
    b.geprueft++
    const ergebnis = await pruefeEinen(bestand, zuPruefen[i], gezaehlt, heute, log, b)
    folge = ergebnis === 'unklar' ? folge + 1 : 0
    if (ergebnis === 'fertig') continue
    b.unklar++
    await abruf.pause?.()
    if (folge < MAX_UNKLAR_FOLGE) continue
    const rest = zuPruefen.slice(i + 1).filter((k) => bestand[k]).length
    b.geprueft += rest
    b.unklar += rest
    b.abgebrochen = true
    log(`⚠ WARNUNG: ${MAX_UNKLAR_FOLGE} Nichtauskünfte von TMDB hintereinander — Prüfung abgebrochen, ${rest} Einträge ungeprüft (gelten als unklar, nicht als tot)`)
    break
  }
  return b
}

export function zaehlzeileTote(b: ToteBilanz): string {
  return `${b.tot} tote Kennungen, ${b.neuZugeordnet} neu zugeordnet, ${b.aufListe} auf Liste (${b.geprueft} geprüft, ${b.unklar} ohne Auskunft)`
}

export function zusatzzeileTote(b: ToteBilanz): string {
  return `${b.zusatz} Zusatzabfragen (Suche, Einzelabruf) nach toten Kennungen`
}
