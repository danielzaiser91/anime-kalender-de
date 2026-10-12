/**
 * **Folgenrhythmus als eigene Meldung** (Daniel, 12.10.2026, Avatar: Die sieben Häfen).
 *
 * Anime2You schrieb am 10.10.2026 „bis zum 30. Oktober … wöchentlich jeweils drei bis vier weitere Episoden". Der Artikel
 * ist ein anderer als der des Starts (09.10.) und trägt eine eigene Aussage; „eine Quelle, eine Meldung" (news-plan.md)
 * verlangt deshalb eine eigene Meldung an seinem Tag mit genau diesem Beleg. Der Handbeleg `Release.rhythmus` sagt, was
 * die Quelle sagt; hier wird er geprüft (auch gegen die Wochen der Folgenliste) und zur Meldung.
 */
import type { NewsMeldung, Release } from '../../shared/types.ts'
import { hostVon } from '../../shared/quelle.ts'

const TAG = /^\d{4}-\d{2}-\d{2}$/

/** Was am Handbeleg nicht stimmt — leer, wenn alles passt. Ein Fehler bricht den Bau ab (wie `ankuendigungenLaden`). */
export function rhythmusFehler(r: Release): string[] {
  const x = r.rhythmus
  if (!x) return []
  const wo = `"${r.slug}" rhythmus`
  const fehler: string[] = []
  if (!TAG.test(x.stand) || !TAG.test(x.bis)) fehler.push(`${wo}: stand und bis müssen Tage (JJJJ-MM-TT) sein`)
  if (!(r.sources ?? []).includes(x.quelle)) fehler.push(`${wo}: quelle steht nicht in sources`)
  const [von, bis] = x.proWoche
  if (!Number.isInteger(von) || !Number.isInteger(bis) || von < 1 || bis < von) fehler.push(`${wo}: proWoche ist keine Spanne ganzer Zahlen`)
  if (x.bis < r.schedule.firstEpisodeDate!) fehler.push(`${wo}: bis liegt vor dem Start`)
  /* Die Folgenliste darf dem Rhythmus nicht widersprechen: Folgen je Tag nach dem Start liegen in der Spanne. */
  const jeTag = new Map<string, number>()
  for (const tag of Object.values(r.schedule.observed ?? {})) jeTag.set(tag, (jeTag.get(tag) ?? 0) + 1)
  for (const [tag, n] of jeTag) {
    if (tag > r.schedule.firstEpisodeDate! && tag <= x.bis && (n < von || n > bis)) fehler.push(`${wo}: am ${tag} stehen ${n} Folgen, die Quelle nennt ${von}–${bis}`)
  }
  return fehler
}

/** Die Meldung zum Rhythmus eines Releases — keine, wenn der Handbeleg fehlt. Datum der Meldung: Tag der Quelle. */
export function rhythmusMeldung(r: Release): (NewsMeldung & { schluessel: string; fallback: string })[] {
  const x = r.rhythmus
  if (!x) return []
  const fehler = rhythmusFehler(r)
  if (fehler.length) throw new Error(fehler.join('\n'))
  return [{
    schluessel: `rhythmus:${r.slug}:${x.bis}`,
    fallback: x.stand,
    art: 'rhythmus',
    platform: r.platform,
    datum: x.bis,
    proWoche: x.proWoche,
    release: r.slug,
    quelle: x.quelle,
    belege: [{ url: x.quelle, name: hostVon(x.quelle) }],
  }]
}
