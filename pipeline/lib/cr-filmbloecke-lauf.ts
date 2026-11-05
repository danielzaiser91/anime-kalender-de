/** Reine Teile von `pipeline/fetch-cr-filmbloecke.mjs` (Abruf und Schreiben bleiben im Skript). */
import { kennwort } from './cr-kennwort.ts'
import { normSchluessel } from './util.ts'

type Lose = Record<string, any>

/** Offene Crunchyroll-Wege von Filmen, OVAs und Specials (kein TV/ONA). */
export function offeneFilme(titles: Lose[], cr: { serien: Lose[] }): Lose[] {
  const nachUrl = new Map(cr.serien.map((s) => [s.url, s]))
  const offen: Lose[] = []
  for (const x of titles) {
    for (const s of x.streams ?? []) {
      if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
      if (x.format === 'TV' || x.format === 'ONA') continue
      offen.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, jahr: x.jpYear, url: s.url, serie: nachUrl.get(s.url) })
    }
  }
  return offen
}

/** Der Reihenname vor dem ersten Trenner. */
export function reiheVon(o: Lose): string {
  return (o.titel ?? o.en ?? '').split(/\s[-–—:]\s|\s*:\s*/)[0]
}

/** Nimmt Serien aus einer Suchantwort auf, deren Titel die Reihe enthält. */
export function sammleSerienIds(ids: Set<string>, antwort: Lose | null, reihe: string): void {
  for (const it of (antwort?.data ?? []).flatMap((g: Lose) => g.items ?? [])) {
    if (normSchluessel(it.title).includes(normSchluessel(reihe))) ids.add(it.id)
  }
}

/** Blöcke (Staffeln) einer Serienantwort. */
export function bloeckeAusAntwort(antwort: Lose | null): Lose[] {
  return (antwort?.data ?? []).map((st: Lose) => ({ id: st.id, titel: st.title ?? '', audio: st.audio_locales ?? [] }))
}

/** Erster Block, dessen Titel exakt einem Namen entspricht oder das Kennwort (≥ 6 Zeichen) enthält. */
export function blockTreffer(serienId: string, bloecke: Lose[], namen: string[]): Lose | null {
  for (const b of bloecke) {
    const bn = normSchluessel(b.titel)
    const passt = namen.some((n) => normSchluessel(n) === bn) || namen.some((n) => bn.includes(kennwort(n)) && kennwort(n).length >= 6)
    if (!passt) continue
    return { serienId, blockId: b.id, blockTitel: b.titel, audio: b.audio }
  }
  return null
}

/** Dritter Weg: die OVA als Folge einer Serie; Serienname und Kennwort müssen beide passen. */
export function folgenTreffer(items: Lose[], reihe: string, namen: string[]): Lose | null {
  for (const it of items) {
    const md = it.episode_metadata ?? {}
    const serieOk = normSchluessel(md.series_title ?? '').includes(normSchluessel(reihe)) || normSchluessel(reihe).includes(normSchluessel(md.series_title ?? ''))
    const kw = namen.map(kennwort).find((k) => k.length >= 6 && normSchluessel(it.title).includes(k))
    if (!serieOk || !kw) continue
    const versionen = (md.versions ?? []).map((v: Lose) => v.audio_locale).filter(Boolean)
    if (!versionen.length) continue
    return { serienId: md.series_id ?? null, blockId: it.id, blockTitel: `Folge „${it.title}" in ${md.series_title}`, audio: versionen }
  }
  return null
}

/** Kurzzeichen der Logzeile. */
export function zeichenVon(treffer: Lose | null): string {
  return !treffer ? '—' : treffer.audio.includes('de-DE') ? 'DE' : treffer.audio.length ? 'kein DE' : '?'
}

/** Neue Funde in den alten Bestand: ein Lauf ohne Treffer überschreibt keinen alten Treffer. */
export function fuehreZusammen(vorher: unknown, funde: Lose[]): { gesamt: Lose[]; neuDazu: number; ersetzt: number; behalten: number } {
  const zusammen = new Map<number, Lose>()
  for (const f of Array.isArray(vorher) ? vorher : []) if (f?.id != null) zusammen.set(f.id, f)
  let ersetzt = 0
  let neuDazu = 0
  let behalten = 0
  for (const f of funde) {
    if (f?.id == null) continue
    const alt = zusammen.get(f.id)
    if (alt?.treffer && !f.treffer) {
      behalten++
      continue
    }
    if (alt) ersetzt++
    else neuDazu++
    zusammen.set(f.id, f)
  }
  const gesamt = [...zusammen.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  return { gesamt, neuDazu, ersetzt, behalten }
}

/** Die Schlusszeilen der Treffer-Zählung. */
export function zaehlzeilen(funde: Lose[]): { mit: number; zeilen: string[] } {
  const mit = funde.filter((f) => f.treffer)
  return {
    mit: mit.length,
    zeilen: [
      `\n${mit.length} von ${funde.length} über einen eigenen Block gefunden`,
      `  mit de-DE: ${mit.filter((f) => f.treffer.audio.includes('de-DE')).length}`,
      `  ohne de-DE: ${mit.filter((f) => f.treffer.audio.length && !f.treffer.audio.includes('de-DE')).length}`,
    ],
  }
}
