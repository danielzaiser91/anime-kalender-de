/** Reine Teile von `pipeline/fetch-cr-einzelwerke.mjs` (Abruf und Schreiben bleiben im Skript). */
import { katalogTrefferPasst } from './cr-einzelwerk-urteil.ts'

type Lose = Record<string, any>

/** Crunchyroll-Wege ohne Urteil und ohne Serienkennung — die Suchkandidaten des Laufs. */
export function offeneOhneSerienkennung(titles: Lose[], cr: { serien: Lose[] }): Lose[] {
  const nachUrl = new Map(cr.serien.map((s) => [s.url, s]))
  const offen: Lose[] = []
  for (const x of titles) {
    for (const s of x.streams ?? []) {
      if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
      const serie = nachUrl.get(s.url)
      if (serie?.seriesId) continue
      offen.push({ id: x.id, titel: x.titleDe ?? x.titleEn, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes, url: s.url })
    }
  }
  return offen
}

/** Die Suchnamen eines offenen Verweises, ohne Leere und Doppelte. */
export function suchNamen(o: Lose): string[] {
  return [...new Set([o.titel, o.en, o.romaji].filter(Boolean))]
}

/**
 * Erster passender Katalogeintrag einer Suchantwort, sonst null.
 *
 * Der Katalogtitel darf ein Teil unseres Titels sein (29.08.2026: „Fruits Basket -prelude-" heißt bei Crunchyroll „-prelude-"),
 * mindestens sechs Zeichen lang; umgekehrt träfe „Fruits Basket" jede Staffel der Reihe.
 */
export function treffferInAntwort(antwort: Lose | null, namen: string[]): Lose | null {
  for (const gruppe of antwort?.data ?? []) {
    for (const it of gruppe.items ?? []) {
      const { passt, exakt } = katalogTrefferPasst(it, namen)
      if (!passt) continue
      return { id: it.id, typ: gruppe.type ?? it.type, art: it.type, exakt, titel: it.title, meta: it.movie_listing_metadata ?? it.series_metadata ?? it.movie_metadata ?? {} }
    }
  }
  return null
}

/** Tonspuren des Treffers (`audio_locales` vor `audio_locale`). */
export function audioVon(treffer: Lose | null): string[] {
  if (!treffer) return []
  return treffer.meta.audio_locales ?? (treffer.meta.audio_locale ? [treffer.meta.audio_locale] : [])
}

/** Eintrag für `data/cr-einzelwerke.json`. */
export function formeFund(o: Lose, treffer: Lose | null): Lose {
  const audio = audioVon(treffer)
  return { ...o, treffer: treffer ? { id: treffer.id, typ: treffer.typ, art: treffer.art, exakt: treffer.exakt, titel: treffer.titel, audio } : null }
}

/** Kurzzeichen der Logzeile: — kein Treffer, DE, Tonspuren oder ?. */
export function zeichenVon(treffer: Lose | null): string {
  const audio = audioVon(treffer)
  return !treffer ? '—' : audio.includes('de-DE') ? 'DE' : audio.length ? audio.join(',').slice(0, 24) : '?'
}

/** Die Schlusszeilen des Laufs und die Trefferzahl für `recordSource`. */
export function zusammenfassung(funde: Lose[]): { mitTreffer: number; zeilen: string[] } {
  const mit = funde.filter((f) => f.treffer)
  return {
    mitTreffer: mit.length,
    zeilen: [
      `\n${mit.length} von ${funde.length} im deutschen Katalog gefunden`,
      `  mit de-DE: ${mit.filter((f) => f.treffer.audio.includes('de-DE')).length}`,
      `  ohne de-DE: ${mit.filter((f) => f.treffer.audio.length && !f.treffer.audio.includes('de-DE')).length}`,
    ],
  }
}
