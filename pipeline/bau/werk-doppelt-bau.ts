import { log, readJson, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import { ANISEARCH_ID_BASIS, alle as anisearchEintraege } from './anisearch-titel.ts'
import { GRENZE, findeWerkDubletten, type WerkEintrag, type WerkPaar, type WerkTitel, type WerkUrteil } from './werk-doppelt.ts'

/** Die Prüfliste der wahrscheinlichen Paare: `fetch-anisearch-eintraege.ts` holt zuerst deren Synonyme und Beziehungen, die das Paar bestätigen oder widerlegen. */
export const PRUEFLISTE = 'data/dubletten-pruefliste.json'

type MitFeldern = WerkTitel & { anisearchId?: number }

/**
 * Führt sichere Paare zusammen (`werk-doppelt.ts`): Steht die Zeile im Hauptbestand oder trägt einen Termin (`geschuetzt`), entfällt der Katalogtitel; sonst entfällt die
 * Zeile hinter dem Schalter, und der Katalogtitel trägt ihre aniSearch-Kennung (der Beleg dafür kommt von aniSearch selbst, nie aus dem Namen allein).
 * @param katalog      die Titel für `ohne-synchro.json` (AniList-Katalog und nachgetragene Zeilen)
 * @param hauptbestand die Titel des Hauptbestands, nur als Wissen über Reihen und als geschützte Zeilen
 */
export function werkDublettenAbziehen<T extends MitFeldern>(katalog: T[], hauptbestand: WerkTitel[], geschuetzt: Set<number>, eintraege: Record<string, WerkEintrag>): { titel: T[]; urteil: WerkUrteil } {
  const katalogIds = new Set(katalog.filter((t) => t.id < ANISEARCH_ID_BASIS).map((t) => t.id))
  const urteil = findeWerkDubletten([...hauptbestand, ...katalog], eintraege, katalogIds)
  const imHaupt = new Set(hauptbestand.map((t) => t.id))
  const weg = new Set<number>()
  const kennung = new Map<number, number>()
  for (const p of urteil.sicher) {
    if (imHaupt.has(p.zeile) || geschuetzt.has(p.zeile)) weg.add(p.titel)
    else {
      weg.add(p.zeile)
      kennung.set(p.titel, p.zeile - ANISEARCH_ID_BASIS)
    }
  }
  const titel = katalog.filter((t) => !weg.has(t.id)).map((t) => (kennung.has(t.id) ? { ...t, anisearchId: kennung.get(t.id) } : t))
  const nach = (grund: WerkPaar['grund']) => urteil.sicher.filter((p) => p.grund === grund).length
  log(`Werk-Dubletten: ${urteil.sicher.length} zusammengeführt (${nach('synonym')} über ein Synonym, ${nach('beziehung')} über Prequel/Sequel), ${urteil.wahrscheinlich.length} wahrscheinlich (Prüfliste ${PRUEFLISTE})`)
  return { titel, urteil }
}

/** Schreibt die Prüfliste nur bei Änderung, damit der Stand nicht täglich committet wird. */
export function schreibePruefliste(wahrscheinlich: WerkPaar[], titel: WerkTitel[]): void {
  const name = new Map(titel.map((t) => [t.id, t.titleRomaji ?? t.titleEn ?? '']))
  const paare = [...wahrscheinlich].sort((a, b) => a.zeile - b.zeile || a.titel - b.titel).map((p) => ({ ...p, zeileName: name.get(p.zeile), titelName: name.get(p.titel) }))
  const alt = readJson<{ paare?: unknown }>(PRUEFLISTE, {})
  if (JSON.stringify(alt.paare) !== JSON.stringify(paare)) writeJson(PRUEFLISTE, { stand: todayIso(), anzahl: paare.length, paare })
}

/** Für `schreibeOhneSynchro`: führt sichere Paare zusammen und schreibt die Prüfliste. Der Hauptbestand kommt aus der schon geschriebenen `titles.json` (wie bei der Zusicherung). */
export function ohneWerkDubletten<T extends MitFeldern>(katalog: T[], geschuetzt: Set<number>): T[] {
  const hauptbestand = readJson<WerkTitel[]>('public/data/titles.json', [])
  const { titel, urteil } = werkDublettenAbziehen(katalog, hauptbestand, geschuetzt, anisearchEintraege())
  schreibePruefliste(urteil.wahrscheinlich, [...hauptbestand, ...katalog])
  return titel
}

/**
 * Zusicherung an der **ausgelieferten** Ausgabe: Kein sicheres Paar bleibt stehen (rot), und die wahrscheinlichen bleiben unter der Grenze (rot darüber, Hinweis darunter).
 * Leer heißt in Ordnung.
 */
export function werkDoppelt(titles: WerkTitel[], ohneSynchro: WerkTitel[], eintraege: Record<string, WerkEintrag>): string[] {
  const katalogIds = new Set(ohneSynchro.filter((t) => t.id < ANISEARCH_ID_BASIS).map((t) => t.id))
  const u = findeWerkDubletten([...titles, ...ohneSynchro], eintraege, katalogIds)
  const fehler = u.sicher.map((p) => `aniSearch-Zeile ${p.zeile} und AniList-Titel ${p.titel} sind sicher dasselbe Werk (${p.grund === 'synonym' ? 'Synonym' : 'Prequel/Sequel'} von aniSearch, Format, Jahr, Folgen, Staffelzählung) und stehen beide in der Ausgabe`)
  const grenze = readJson<{ wahrscheinlich?: number }>(GRENZE, {}).wahrscheinlich ?? 0
  if (u.wahrscheinlich.length > grenze) fehler.push(`${u.wahrscheinlich.length} wahrscheinliche Dubletten (gleicher Name, ohne Beleg von aniSearch) über der Grenze ${grenze} (${GRENZE}): ${PRUEFLISTE} ansehen, Synonyme/Beziehungen nachholen (fetch-anisearch-eintraege.ts)`)
  else if (u.wahrscheinlich.length < grenze) log(`Werk-Dubletten: ${u.wahrscheinlich.length} wahrscheinlich, Grenze ${grenze} — in ${GRENZE} senken`)
  return fehler
}
