/**
 * Tonspur-Zeile der Netflix-Titelseite für **offene Filme** lesen und als Handbeleg melden (Daniel, F97, 01.11.2026).
 *
 * Läuft am Ende von `pipeline/check-links.ts` (Wochenlauf). Gemeldet wird nur ein Ja (Deutsch steht in der
 * Audio-Zeile) — dieselbe Beleg-Zeile wie eine Browser-Meldung, angehängt über `haengeBelegeAn`. Nein und
 * Nichtauskunft stehen nur im Linkbefund (`audio`), sie belegen nichts. Serien bleiben der Erweiterung (Player).
 */
import { leseNetflixTonspur, netflixKennung, type TonspurUrteil } from './netflix-tonspur.ts'
import type { DubCheck } from './dub-confirmed.ts'
import type { Title } from '../../shared/types.ts'

/** Mehr offene Filme als das holt ein Lauf nicht; der Rest kommt in der nächsten Woche. */
export const MAX_FILME_JE_LAUF = 10
/** Tage, bis ein Nein oder eine Nichtauskunft erneut gelesen wird. */
export const WIEDERHOLUNG_TAGE = 7

/** Was `check-links.ts` je Adresse speichert, soweit dieses Modul es berührt. */
export interface TonspurBefund {
  status: number | string
  geprueftAm: string
  audio?: TonspurUrteil
  audioAm?: string
}

export interface NetflixFilm {
  titleId: number
  titel: string
  url: string
}

/** `seit`-Tage der Prüfliste: je `anilistId|platform` das späteste Datum. */
export function erneutSeit(eintraege: Array<{ anilistId: number; platform: string; seit: string }>): Map<string, string> {
  const karte = new Map<string, string>()
  for (const e of eintraege) {
    const k = `${e.anilistId}|${e.platform}`
    if ((karte.get(k) ?? '') < e.seit) karte.set(k, e.seit)
  }
  return karte
}

/**
 * Offene Netflix-Filme: Format MOVIE, Netflix-Titelseite, und kein Sprachurteil als Handbeleg — oder ein
 * Urteil, das älter ist als die Wiedervorlage (`erneut-melden.yaml`, `seit`). Fällig nur, wenn die letzte
 * Tonspur-Lesung eine Woche zurückliegt (`grenze` = heute minus `WIEDERHOLUNG_TAGE`, ISO-Datum).
 */
export function waehleNetflixFilme(o: {
  titles: Title[]
  checks: DubCheck[]
  erneut: Map<string, string>
  bestand: Record<string, TonspurBefund | undefined>
  grenze: string
}): NetflixFilm[] {
  const aus: NetflixFilm[] = []
  for (const t of o.titles) {
    if (t.format !== 'MOVIE') continue
    const weg = (t.streams ?? []).find((s) => s.platform === 'netflix' && netflixKennung(s.url))
    if (!weg) continue
    const juengstes = o.checks
      .filter((c) => c.anilistId === t.id && c.platform === 'netflix' && typeof c.dub === 'boolean')
      .reduce((m, c) => (c.checkedAt > m ? c.checkedAt : m), '')
    const seit = o.erneut.get(`${t.id}|netflix`)
    const offen = !juengstes || (seit !== undefined && juengstes < seit)
    if (!offen) continue
    const letzte = o.bestand[weg.url]?.audioAm
    if (letzte && letzte >= o.grenze) continue
    aus.push({ titleId: t.id, titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id), url: weg.url })
  }
  return aus
}

/** Beleg-Zeilen wie `fetch-pruefungen.ts` sie für eine Browser-Meldung schreibt (`haengeBelegeAn` setzt sie an). */
export function tonspurBelegZeilen(film: NetflixFilm, sprachen: string[], datum: string): string[] {
  const note = `Film, Titelseite ohne Anmeldung (Linkprüfung): Audio ${sprachen.join(', ')} — gilt für den Film, nicht je Folge`
  return [
    '',
    `- anilistId: ${film.titleId}`,
    `  title: ${JSON.stringify(film.titel)}`,
    '  platform: netflix',
    `  url: ${film.url}`,
    '  dub: true',
    `  checkedAt: '${datum}'`,
    `  note: ${JSON.stringify(note)}`,
  ]
}

export interface TonspurLaufErgebnis {
  gelesen: number
  ja: number
  nein: number
  unbekannt: number
  /** true, wenn Netflix mit 403/429 antwortete und der Lauf abbrach. */
  gesperrt: boolean
  zeilen: string[]
}

/**
 * Liest die Filme nacheinander (`hole` liefert Status und Text, `pause` wartet), trägt das Urteil in
 * `bestand[url]` ein und sammelt die Beleg-Zeilen der Ja. 403/429 beenden den Lauf ohne Fehlschlag:
 * Das Urteil dieses Films bleibt leer und gilt nicht als Nein. 404, Zeitüberschreitung, Seite ohne
 * Audio-Zeile ergeben `unbekannt`.
 */
export async function leseNetflixFilme(o: {
  filme: NetflixFilm[]
  bestand: Record<string, TonspurBefund | undefined>
  hole: (url: string) => Promise<{ status: number; text: string }>
  pause: () => Promise<void>
  weiter: () => boolean
  heute: string
}): Promise<TonspurLaufErgebnis> {
  const erg: TonspurLaufErgebnis = { gelesen: 0, ja: 0, nein: 0, unbekannt: 0, gesperrt: false, zeilen: [] }
  for (const film of o.filme.slice(0, MAX_FILME_JE_LAUF)) {
    if (!o.weiter()) break
    if (erg.gelesen > 0) await o.pause()
    const antwort = await o.hole(film.url).catch(() => ({ status: 0, text: '' }))
    erg.gelesen++
    if (antwort.status === 403 || antwort.status === 429) {
      erg.gesperrt = true
      break
    }
    const gelesen = antwort.status === 200 ? leseNetflixTonspur(antwort.text) : { urteil: 'unbekannt' as const, sprachen: [] }
    erg[gelesen.urteil]++
    /* Ohne bisherigen Befund zählt nur eine echte Antwort als Status; eine Zeitüberschreitung (0) ist keine Auskunft. */
    const basis = o.bestand[film.url] ?? { status: antwort.status > 0 ? antwort.status : 'fehler', geprueftAm: o.heute }
    o.bestand[film.url] = { ...basis, audio: gelesen.urteil, audioAm: o.heute }
    if (gelesen.urteil === 'ja') erg.zeilen.push(...tonspurBelegZeilen(film, gelesen.sprachen, o.heute))
  }
  return erg
}
