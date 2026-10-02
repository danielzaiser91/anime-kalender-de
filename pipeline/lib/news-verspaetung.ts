/**
 * **Verspätungen als Meldungen — unsere eigene Messung, mit eigenem Beleg** (docs/wissen/news-plan.md).
 *
 * Ein ausgebliebener Termin ist eine Meldung an seinem Tag und bleibt so stehen; kommt die Folge
 * später, ist das eine neue Meldung am Tag des Erscheinens, je Tag gebündelt. Belegt wird beides
 * nicht mit den Quellen des Termins, sondern mit der Stelle, an der wir nachgesehen haben:
 * Crunchyrolls Simulcast-Kalender an genau diesem Tag.
 */
import type { NewsBeleg, NewsMeldung, Release } from '../../shared/types.ts'
import { toIsoDate } from '../../shared/time.ts'
import type { DatiertNews } from './news-verlauf.ts'

/**
 * Crunchyrolls Kalender mit genau diesem Tag. Die Seite zeigt dessen Woche (gemessen 02.10.2026:
 * `date=2026-09-30` liefert 28.09.–04.10.), und jede Meldung behält ihren eigenen Link.
 */
export function kalenderTag(tag: string): string {
  return `https://www.crunchyroll.com/de/simulcastcalendar?filter=premium&date=${tag}`
}

function messBeleg(tag: string, gemessenAm: string): NewsBeleg {
  return { url: kalenderTag(tag), name: 'Crunchyroll-Kalender', gemessenAm }
}

type Roh = NewsMeldung & { schluessel: string; fallback: string }

/** Je ausgebliebenem Termin eine `verspaetet`-Meldung, je Nachreich-Tag eine `nachgereicht`-Meldung. */
export function verspaetungsMeldungen(r: Release): Roh[] {
  /* Gemessen wird nur bei Crunchyroll — nur dort lesen wir einen Kalender (`termine-pruefen.ts`). */
  const gemessen = r.platform === 'crunchyroll'
  const raus: Roh[] = []
  const nachTag = new Map<string, { nummer: number; erwartet: string }[]>()
  for (const [nummer, v] of Object.entries(r.schedule?.verpasst ?? {})) {
    if (!v?.erwartetAm) continue
    const erwartet = toIsoDate(new Date(v.erwartetAm))
    raus.push({
      schluessel: `verspaetet:${r.slug}:${nummer}:${v.erwartetAm}`,
      fallback: erwartet,
      art: 'verspaetet',
      platform: r.platform,
      datum: erwartet,
      von: Number(nummer),
      release: r.slug,
      ...(gemessen ? { quelle: kalenderTag(erwartet), belege: [messBeleg(erwartet, toIsoDate(new Date(v.bemerktAm ?? v.erwartetAm)))] } : {}),
    })
    if (!v.erschienenAm) continue
    const tag = toIsoDate(new Date(v.erschienenAm))
    nachTag.set(tag, [...(nachTag.get(tag) ?? []), { nummer: Number(nummer), erwartet }])
  }
  for (const [tag, folgen] of nachTag) {
    folgen.sort((a, b) => a.nummer - b.nummer)
    raus.push({
      schluessel: `nachgereicht:${r.slug}:${tag}`,
      fallback: tag,
      art: 'nachgereicht',
      platform: r.platform,
      datum: tag,
      von: folgen[0]!.nummer,
      bis: folgen.at(-1)!.nummer,
      anzahl: folgen.length,
      erwartet: folgen.map((f) => f.erwartet),
      release: r.slug,
      ...(gemessen ? { quelle: kalenderTag(tag), belege: [messBeleg(tag, tag)] } : {}),
    })
  }
  return raus
}

/**
 * **Dieselben Folgen nicht zweimal am selben Tag.** Die Folgen-Meldung aus Crunchyrolls Neuheiten
 * sagt dasselbe wie die Nachreich-Meldung — sie entfällt, wenn diese alle ihre Folgen nennt.
 */
export function ohneDoppelteFolgen(datiert: DatiertNews[]): DatiertNews[] {
  const nachgereicht = datiert.filter((m) => m.art === 'nachgereicht')
  return datiert.filter(
    (m) =>
      m.art !== 'folgen' ||
      !nachgereicht.some(
        (n) =>
          n.titel.id === m.titel.id && n.am === m.am && n.platform === m.platform &&
          (m.von ?? 0) >= n.von! && (m.bis ?? m.von ?? 0) <= n.bis!,
      ),
  )
}
