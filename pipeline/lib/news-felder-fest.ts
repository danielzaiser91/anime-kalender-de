/**
 * **Was eine Meldung am Tag über Anbieter, Kanal, Sicherheit und Einordnung sagte, sagt sie weiter** (20.10.2026, `news-plan.md`).
 *
 * Diese Felder wurden bei jedem Bau aus dem heutigen Stand eines Titels neu abgeleitet; bestehende Meldungen kippten dadurch
 * (04.–20.10., 126 Stände von `news.json`: `hinweis` 46, `anbieter` 19, `kanal` 7, `geschaetzt` 7, `discSeitText` 40 Wechsel). Jetzt gilt der Stand
 * vom ersten Bau, der die Meldung auslieferte (`NewsHistorie.felder`). Eine Meldung, die schon in `news.json` steht, hält ihren ausgelieferten
 * Stand fest, nicht den neu abgeleiteten. Nicht festgehalten werden Darstellung und Belege (`teil`, `ausgabe`, `quelle`, `belege`), die
 * handgepflegten Nachträge (`nachgetragen`) und der Lebenslauf (`ersetzt`, `zurueckgezogen`).
 */
import type { NewsArt, NewsEintrag, NewsMeldung } from '../../shared/news-typen.ts'
import type { NewsHistorie } from './news.ts'
import type { DatiertNews } from './news-verlauf.ts'

export const FESTE_FELDER = ['hinweis', 'anbieter', 'kanal', 'geschaetzt', 'jahre', 'discSeitText', 'omu'] as const
export type FesteFelder = Partial<Pick<NewsMeldung, (typeof FESTE_FELDER)[number]>>

/** Nur diese Arten tragen die Felder aus der Ableitung; `nachgetragen` ist Handtext (`data/curated`), dessen Korrektur erlaubt bleibt. */
const FESTE_ARTEN: ReadonlySet<NewsArt> = new Set<NewsArt>(['neu', 'angekuendigt', 'disc', 'kino'])

export const felderVon = (m: NewsMeldung): FesteFelder => Object.fromEntries(FESTE_FELDER.filter((f) => m[f] !== undefined).map((f) => [f, m[f]]))

const istAbgeloest = (m: Pick<NewsMeldung, 'ersetzt' | 'zurueckgezogen'>): boolean => !!(m.ersetzt || m.zurueckgezogen)

/** Dieselbe Meldung in `baueNews` und in `news.json`: Tag, Titel (Teil oder Kopf), Art, Anbieter, Release, Termin. */
export const meldungsKennung = (am: string, titelId: number, m: Pick<NewsMeldung, 'art' | 'platform' | 'release' | 'datum'>): string =>
  [am, titelId, m.art, m.platform ?? '', m.release ?? '', m.datum ?? ''].join('|')

/** Ausgelieferte Meldungen können ihren Schlüssel nur aus Art, Release und Termin zurückgewinnen; abgelöste führen ihn so. */
export const festSchluessel = (m: DatiertNews): string => (istAbgeloest(m) ? `${m.art}:${m.release}:${m.datum}` : m.schluessel)

function ausgeliefert(vorherige: NewsEintrag[]): Map<string, FesteFelder> {
  const karte = new Map<string, FesteFelder>()
  for (const e of vorherige) {
    for (const m of e.meldungen ?? []) {
      const k = meldungsKennung(e.am, m.teilId ?? e.titelId, m)
      if (!karte.has(k)) karte.set(k, felderVon(m))
    }
  }
  return karte
}

/** Setzt die festgehaltenen Felder; gleiche Werte lassen das Objekt (und seine Feldreihenfolge) unberührt. */
function mitFeldern<T extends NewsMeldung>(m: T, fest: FesteFelder): T {
  if (FESTE_FELDER.every((f) => m[f] === fest[f])) return m
  const rest: NewsMeldung = { ...m }
  for (const f of FESTE_FELDER) delete rest[f]
  return { ...rest, ...fest } as T
}

/**
 * Hält die Felder jeder lebenden Meldung beim ersten Mal fest und setzt sie danach wieder ein. Läuft als letzter Schritt vor dem Gruppieren,
 * damit auch Verschmelzen und Verlauf nichts zurückschreiben. Abgelöste Meldungen bekommen nur, was schon festgehalten ist.
 */
export function haltFelderFest(historie: NewsHistorie, meldungen: DatiertNews[], vorherige: NewsEintrag[]): DatiertNews[] {
  const fest = (historie.felder ??= {})
  const bisher = ausgeliefert(vorherige)
  return meldungen.map((m) => {
    if (!FESTE_ARTEN.has(m.art)) return m
    const k = festSchluessel(m)
    if (!(k in fest)) {
      if (istAbgeloest(m)) return m
      fest[k] = bisher.get(meldungsKennung(m.am, m.titel.id, m)) ?? felderVon(m)
    }
    return mitFeldern(m, fest[k]!)
  })
}

/** Bestandswächter: Felder, die eine bestehende Meldung gegenüber dem Vorstand (`vorher`) ändert (mit `weiterer`); handgepflegte Arten zählen nicht. */
export function felderAenderungen(vorher: NewsEintrag[], jetzt: NewsEintrag[]): string[] {
  const alt = new Map<string, NewsMeldung>()
  for (const e of vorher) for (const m of e.meldungen ?? []) alt.set(meldungsKennung(e.am, m.teilId ?? e.titelId, m), m)
  const zeilen: string[] = []
  for (const e of jetzt) {
    for (const m of e.meldungen ?? []) {
      const a = alt.get(meldungsKennung(e.am, m.teilId ?? e.titelId, m))
      if (!a || !FESTE_ARTEN.has(m.art)) continue
      for (const f of [...FESTE_FELDER, 'weiterer' as const]) {
        if (JSON.stringify(a[f]) !== JSON.stringify(m[f])) zeilen.push(`${e.am} ${e.titel} [${m.art} ${m.release ?? m.platform ?? ''}] ${f}: ${JSON.stringify(a[f])} -> ${JSON.stringify(m[f])}`)
      }
    }
  }
  return zeilen
}
