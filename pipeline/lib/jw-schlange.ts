/**
 * Die Warteschlange des JustWatch-Abrufs (`fetch-justwatch-audio.ts`): welche Titel fällig sind und in welcher Reihenfolge sie drankommen.
 */
import type { Title } from '../../shared/types.ts'
import type { JwBefund } from './jw-vertrauen.ts'
import { titelMitJwFlagge, vorgezogen } from './jw-wiedervorlage.ts'
import { frischFaellig } from './jw-frische.ts'

export interface SchlangenEingabe {
  titles: Title[]
  bestand: Record<string, JwBefund & { tmdbId?: number }>
  tmdb: Record<string, { tmdbId?: number }>
  /** Befunde mit `geprueftAm` vor diesem Tag (ISO) sind fällig. */
  grenze: string
  heute: string
  /** Titel mit frischem Kino- oder Disc-Termin (`frischeTitel`): sie kommen vor der Frist wieder dran, solange kein Prime-Kauf bekannt ist. */
  frisch?: ReadonlySet<number>
  /** Kennungen der Cartoons unter `titles` (ihre Serien-Wege bekommen im Bau keine Flagge). */
  cartoonIds: Set<number>
}

/** Die drei Lücken der Warteschlange: Weg ohne Sprachurteil, Titel ganz ohne Weg, Weg nur auf die TMDB-Übersicht. */
export function dringend(t: Title): boolean {
  return (
    (t.streams ?? []).some((s) => s.dub === undefined) ||
    (!(t.streams ?? []).length && !(t.watchLinks ?? []).length) ||
    (t.watchLinks ?? []).some((w) => /themoviedb.org/.test(w.url ?? ''))
  )
}

/**
 * Titel mit TMDB-Kennung, die fällig sind: Alter, berichtigte Kennung, Fehlschlag ohne gespeicherte Kennung oder Wiedervorlage.
 * Reihenfolge: berichtigte Kennung, vorgezogen, dringend (`dringend`), dann der älteste Befund zuerst.
 */
export function warteschlange({ titles, bestand, tmdb, grenze, heute, frisch = new Set(), cartoonIds }: SchlangenEingabe): Title[] {
  const mitFlagge = titelMitJwFlagge(titles, bestand, cartoonIds)
  const tmdbVon = (t: Title) => (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId
  /*
    **Eine berichtigte TMDB-Zuordnung macht den alten Befund wertlos.** Gesucht wird
    gegen die Kennung; stand dort gestern ein anderer Film, sagt das Ergebnis nichts
    über diesen. Solche Titel gehen sofort wieder in die Schlange, ohne die Frist
    abzuwarten (17.09.2026).
  */
  const kennungGewechselt = (t: Title) => {
    const e = bestand[String(t.id)]
    const jetzt = tmdbVon(t)
    return Boolean(e?.tmdbId && jetzt && e.tmdbId !== jetzt)
  }
  /*
    **Ein Fehlschlag ohne gespeicherte Kennung ist nicht beweiskräftig** (23.09.2026).

    Seit dem 17.09.2026 schreibt jeder „ohne Treffer" die Kennung mit, gegen die gesucht
    wurde — die Wechselprüfung darüber erkennt einen berichtigten Titel daran. Ältere
    Fehlschläge haben dieses Feld nicht, und genau dort steckte der Fall: „Dragon Ball Super"
    kam als „ohne Treffer" zurück, weil die Kennung auf die für 2026 angekündigte
    Beerus-Serie zeigte. Mit der berichtigten Kennung hätte er trotzdem 28 Tage gewartet.

    Solche Befunde werden deshalb **fällig**, aber nicht **dringend**: Es sind 638 Stück, und
    die Schlange soll dadurch nicht vor den echten Wechseln stehen. Der Zweig erledigt sich
    von selbst, sobald jeder Befund seine Kennung trägt.
  */
  const fehlschlagOhneKennung = (t: Title) => {
    const e = bestand[String(t.id)]
    return Boolean(e?.ohneTreffer && !e.tmdbId && tmdbVon(t))
  }
  const vor = (t: Title) => vorgezogen(t, bestand, heute, mitFlagge) || frischFaellig(t.id, bestand[String(t.id)], frisch, heute)
  return titles
    .filter((t) => tmdbVon(t))
    .filter((t) => (bestand[String(t.id)]?.geprueftAm ?? '') < grenze || kennungGewechselt(t) || fehlschlagOhneKennung(t) || vor(t))
    .sort(
      (a, b) =>
        Number(kennungGewechselt(b)) - Number(kennungGewechselt(a)) ||
        Number(vor(b)) - Number(vor(a)) ||
        Number(dringend(b)) - Number(dringend(a)) ||
        (bestand[String(a.id)]?.geprueftAm ?? '').localeCompare(bestand[String(b.id)]?.geprueftAm ?? ''),
    )
}
