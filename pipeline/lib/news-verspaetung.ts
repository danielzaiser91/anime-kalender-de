/**
 * **Verspätungen als Meldungen — unsere eigene Messung, mit eigenem Beleg** (docs/wissen/news-plan.md).
 *
 * Ein ausgebliebener Termin ist eine Meldung an seinem Tag und bleibt so stehen; kommt die Folge
 * später, ist das eine neue Meldung am Tag des Erscheinens, je Tag gebündelt. Belegt wird beides
 * nicht mit den Quellen des Termins, sondern mit der Stelle, an der wir nachgesehen haben:
 * Crunchyrolls Simulcast-Kalender an genau diesem Tag.
 */
import type { NewsBeleg, NewsMeldung, Release } from '../../shared/types.ts'
import type { VermerkMitAnkuendigung, WocheBelegVermerk } from '../../shared/woche-beleg-typ.ts'
import { WOCHENPROGRAMM_UEBERSICHT } from '../../shared/wochenprogramm.ts'
import { toIsoDate } from '../../shared/time.ts'
import { expandEvents } from '../../shared/logic.ts'
import { tagIstAngekuendigt } from '../../shared/news-typen.ts'
import type { DatiertNews } from './news-verlauf.ts'

/**
 * Crunchyrolls Kalender mit genau diesem Tag — die Adresse der Foto-Belege (`messbelege.ts`, bestehende Messfotos; der Kalender leitet seit
 * ~21.10.2026 um). Meldungen verlinken das Wochenprogramm (`WOCHENPROGRAMM_UEBERSICHT`).
 */
export function kalenderTag(tag: string): string {
  return `https://www.crunchyroll.com/de/simulcastcalendar?filter=premium&date=${tag}`
}

export function messBeleg(tag: string, gemessenAm: string, bild?: string): NewsBeleg {
  return { url: kalenderTag(tag), name: 'Crunchyroll-Kalender', gemessenAm, ...(bild ? { bild } : {}) }
}

/** Die Ankündigung im Wochenprogramm: das Bild mit der markierten Zeile. Es zeigt den Stand von vorher und steht vor dem Kalender (Nachher). */
function wochenBeleg(w: WocheBelegVermerk): NewsBeleg {
  return {
    url: w.url,
    name: 'Crunchyroll-Wochenprogramm',
    erstGeprueftAm: toIsoDate(new Date(w.gesehenAm)),
    bildAm: toIsoDate(new Date(w.bildAm)),
    bild: w.bild,
    ...(w.markierung ? { markierung: w.markierung } : {}),
  }
}

type Roh = NewsMeldung & { schluessel: string; fallback: string }

/** Folgen, die am Nachreich-Tag planmäßig dazukamen: am selben Tag beobachtet, nach der letzten nachgereichten. */
function planFolgenAm(r: Release, tag: string, letzte: number): number[] {
  return Object.entries(r.schedule?.observed ?? {}).filter(([n, d]) => d === tag && Number(n) > letzte).map(([n]) => Number(n)).sort((a, b) => a - b)
}

/** Je ausgebliebenem Termin eine `verspaetet`-Meldung, je Nachreich-Tag eine `nachgereicht`-Meldung. */
export function verspaetungsMeldungen(r: Release): Roh[] {
  /* Gemessen wird nur bei Crunchyroll — nur dort lesen wir einen Kalender (`termine-pruefen.ts`). */
  const gemessen = r.platform === 'crunchyroll'
  const raus: Roh[] = []
  const events = r.schedule?.verpasst ? expandEvents(r) : []
  const nachTag = new Map<string, { nummer: number; erwartet: string; bild?: string; angekuendigt: boolean }[]>()
  for (const [nummer, v] of Object.entries<VermerkMitAnkuendigung>(r.schedule?.verpasst ?? {})) {
    if (!v?.erwartetAm) continue
    const erwartet = toIsoDate(new Date(v.erwartetAm))
    /* Dasselbe Urteil wie im Detailfenster und in der Mail (`tagIstAngekuendigt`); ohne Termin im Plan gilt der Tag als errechnet. */
    const imPlan = events.find((e) => e.verpasst === v)
    const angekuendigt = tagIstAngekuendigt(v, imPlan ? imPlan.estimated : true)
    raus.push({
      schluessel: `verspaetet:${r.slug}:${nummer}:${v.erwartetAm}`,
      fallback: erwartet,
      art: 'verspaetet',
      platform: r.platform,
      datum: erwartet,
      von: Number(nummer),
      release: r.slug,
      ...(angekuendigt ? { angekuendigtBelegt: true as const } : {}),
      ...(gemessen ? { quelle: WOCHENPROGRAMM_UEBERSICHT, belege: [...(v.wocheBeleg ? [wochenBeleg(v.wocheBeleg)] : []), messBeleg(erwartet, toIsoDate(new Date(v.bemerktAm ?? v.erwartetAm)), v.messBild)] } : {}),
    })
    if (!v.erschienenAm) continue
    const tag = toIsoDate(new Date(v.erschienenAm))
    nachTag.set(tag, [...(nachTag.get(tag) ?? []), { nummer: Number(nummer), erwartet, bild: v.nachBild, angekuendigt }])
  }
  for (const [tag, folgen] of nachTag) {
    folgen.sort((a, b) => a.nummer - b.nummer); const plan = planFolgenAm(r, tag, folgen.at(-1)!.nummer)
    raus.push({
      schluessel: `nachgereicht:${r.slug}:${tag}`,
      fallback: tag,
      art: 'nachgereicht',
      platform: r.platform,
      datum: tag,
      von: folgen[0]!.nummer,
      bis: folgen.at(-1)!.nummer,
      anzahl: folgen.length,
      erwartet: folgen.map((f) => f.erwartet), ...(plan.length ? { planmaessig: plan } : {}),
      release: r.slug,
      ...(folgen.every((f) => f.angekuendigt) ? { angekuendigtBelegt: true as const } : {}),
      ...(gemessen ? { quelle: WOCHENPROGRAMM_UEBERSICHT, belege: [messBeleg(tag, tag, folgen.find((f) => f.bild)?.bild)] } : {}),
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
          (m.von ?? 0) >= n.von! && (m.bis ?? m.von ?? 0) <= Math.max(n.bis!, ...(n.planmaessig ?? [])),
      ),
  )
}
