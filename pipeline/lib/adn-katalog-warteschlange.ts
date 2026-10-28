/**
 * Warteschlange des ADN-Katalog-Laufs (28.10.2026): Der Stand `data/adn-katalog-stand.json` kennt 661 Serien, gefragt wurden je Lauf nur 273, weil 388 Schlüssel
 * weder in der aktuellen ADN-Liste noch im Katalog noch im Archiv stehen. Sie kommen hier als Einträge ohne Titel zusätzlich in die Schlange.
 */
import { katalogShowAus, type AdnListenEintrag, type AdnVideo } from './adn-folgen.ts'
import type { AdnShow } from './adn.ts'
import type { KatalogAuskunft } from './adn-sprachriegel.ts'

/** Stand-Schlüssel, die weder `bekannt` noch gültige Kennung sind, als Einträge ohne Titel (der Titel kommt aus der Antwort, siehe `mitTitelAusAntwort`). */
export function standOhneKopf(stand: Readonly<Record<string, string>>, bekannt: ReadonlySet<number>): AdnListenEintrag[] {
  const out: AdnListenEintrag[] = []
  for (const schluessel of Object.keys(stand)) {
    const id = Number(schluessel)
    if (!Number.isInteger(id) || id <= 0 || bekannt.has(id)) continue
    out.push({ id, title: '' })
  }
  return out
}

/**
 * Zeit des letzten Versuchs ohne Antwort (Fehlantwort); getrennt von der Antwortzeit `stand[id]`, die nur eine echte Antwort setzt — sie lesen `--laufend`
 * (Drossel) und der Lesetag („ADN an diesem Tag gelesen“), und die Sprachriegel-Prüfung verlangt, dass Nichtauskunft dort nicht steht.
 */
export const versuchsSchluessel = (id: number): string => `v${id}`

/** Ältester Stempel zuerst (nie gefragt = 0), höchstens `limit` Einträge; `limit` 0 = alle. */
export function aelteste(alle: AdnListenEintrag[], stand: Readonly<Record<string, string>>, limit: number): AdnListenEintrag[] {
  const alter = (id: number): number => Math.max(Date.parse(stand[String(id)] ?? '') || 0, Date.parse(stand[versuchsSchluessel(id)] ?? '') || 0)
  if (limit <= 0) return alle
  return [...alle].sort((a, b) => alter(a.id) - alter(b.id)).slice(0, limit)
}

/** Fehlt der Titel (Eintrag nur aus dem Stand), nimmt die Antwort ihn aus `show.title`; ohne beides bleibt er leer und die Serie wird übersprungen. */
export function mitTitelAusAntwort(eintrag: AdnListenEintrag, videos: AdnVideo[]): AdnListenEintrag {
  if (eintrag.title) return eintrag
  const show = videos.find((v) => v.show?.title)?.show
  return show ? { ...eintrag, title: show.title, originalTitle: eintrag.originalTitle ?? show.originalTitle, age: eintrag.age ?? show.age } : eintrag
}

export function warteschlangeZeile(gefragt: number, gesamt: number): string {
  return `ADN-Katalog: ${gefragt} von ${gesamt} Serien in der Warteschlange gefragt`
}

/** Stand-Schlüssel ohne Archivdatei, die ein Lauf zusätzlich fragt (661 − 273 = 388 Gespenster, rund drei Läufe bis alle einmal dran waren, 28.10.2026). */
export const GESPENSTER_JE_LAUF = 130

/**
 * Bekannte Serien (Liste, Katalog, Archiv) wie bisher mit `limit`, dahinter höchstens `GESPENSTER_JE_LAUF` Stand-Schlüssel ohne Archivdatei, jeweils die ältesten
 * Stempel zuerst. Die bekannten werden so nie von den Gespenstern verdrängt (273 < 600), und die Fünf-Fehler-Bremse trifft zuerst die bekannten.
 * `limit` 0 = alles.
 */
export function baueWarteschlange(
  bekannte: AdnListenEintrag[],
  stand: Readonly<Record<string, string>>,
  limit: number,
): { alle: AdnListenEintrag[]; vorLimit: number } {
  const gespenster = standOhneKopf(stand, new Set(bekannte.map((e) => e.id)))
  const vorLimit = bekannte.length + gespenster.length
  return { alle: [...aelteste(bekannte, stand, limit), ...aelteste(gespenster, stand, limit > 0 ? GESPENSTER_JE_LAUF : 0)], vorLimit }
}

export function antwortZeile(gefragt: number, ohneAntwort: number): string {
  return `ADN-Katalog: ${gefragt} gefragt, davon ${ohneAntwort} ohne Antwort`
}

export type LaufHilfen = {
  ladeSerie: (id: number) => Promise<{ videos: AdnVideo[]; abbruch?: string }>
  archiviere: (id: number, videos: AdnVideo[]) => void
  pause: () => Promise<void>
  jetzt: () => string
  log: (text: string) => void
  warn: (text: string) => void
}

/** Fragt die Warteschlange der Reihe nach; `stand` wird fortgeschrieben (Stempel je gefragter Serie, auch bei Fehlantwort), fünf Fehler in Folge beenden den Lauf. */
export async function fragWarteschlange(
  alle: AdnListenEintrag[],
  stand: Record<string, string>,
  h: LaufHilfen,
): Promise<{ shows: AdnShow[]; auskunft: KatalogAuskunft }> {
  const out: AdnShow[] = []
  const auskunft: KatalogAuskunft = { gefragt: new Set(), entschieden: new Set() }
  let geprueft = 0
  let ohneAntwort = 0
  let fehlerInFolge = 0
  for (const eintrag of alle) {
    geprueft++
    auskunft.gefragt.add(eintrag.id)
    if (geprueft % 100 === 0) h.log(`  ${geprueft}/${alle.length} — ${out.length} mit Synchro`)
    try {
      const antwort = await h.ladeSerie(eintrag.id)
      if (antwort.abbruch) {
        // Der Versuch wird vermerkt, sonst bliebe eine dauerhaft stumme Serie für immer vorn; `stand[id]`, `entschieden`, Archiv und Katalog bleiben unberührt.
        stand[versuchsSchluessel(eintrag.id)] = h.jetzt()
        ohneAntwort++
        if (++fehlerInFolge >= 5) {
          h.warn(`ADN-Katalog: fünf Fehler in Folge (zuletzt ${antwort.abbruch}) — Lauf wird beendet.`)
          break
        }
        await h.pause()
        continue
      }
      fehlerInFolge = 0
      auskunft.entschieden.add(eintrag.id)
      stand[String(eintrag.id)] = h.jetzt()
      const videos = antwort.videos
      if (videos.length) h.archiviere(eintrag.id, videos)
      const mitTitel = mitTitelAusAntwort(eintrag, videos)
      const show = mitTitel.title ? katalogShowAus(mitTitel, videos) : undefined
      if (show) out.push(show)
    } catch (err) {
      h.warn(`ADN-Katalog ${eintrag.id}: ${(err as Error).message}`)
    }
    await h.pause()
  }
  h.log(antwortZeile(geprueft, ohneAntwort))
  return { shows: out, auskunft }
}
