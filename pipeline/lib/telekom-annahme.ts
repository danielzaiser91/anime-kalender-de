import type { Title, WatchLink } from '../../shared/types.ts'

/**
 * **Videoload und MagentaTV (Kauf/Leihe) gelten als deutsch** (Daniel, 22.09.2026: Telekom Deutschland, Katalog
 * durchstöbert, „bis wir irgendwann ein Gegenteil beweisen“; MagentaTV seit 13.10.2026 gleich, weil es derselbe
 * Katalog mit derselben Gracenote-Kennung ist). Gemessen 13.10.2026: JustWatch nennt bei 303 von 304 MagentaTV-Angeboten
 * deutschen Ton, die Ausnahme ist „Angry Birds Toons“ Staffel 2 (nur Englisch). Darum gilt die Annahme nicht, wo
 * JustWatch bei MagentaTV für den Titel eine Tonspur ohne Deutsch meldet.
 *
 * Der Weg bekommt `dubRanges` (die Antwort des Titels rechnet weiter damit) **und** `dubAbgeleitet: 'telekom-annahme'`:
 * die Oberfläche zeigt „Deutsch angenommen“ statt „✓ Deutsch“, und kein freenet-Weg leitet daraus etwas ab.
 * Ein Weg mit eigener Angabe (`dubRanges`) behält sie. MagentaTV-Abo (Magenta TV+) ist ein anderer Katalog und bleibt offen.
 */
export type JwAngebot = { anbieter?: string; audio?: string[] }

const istTelekomShop = (w: WatchLink): boolean => w.name === 'Videoload' || (w.name === 'MagentaTV' && w.zugang === 'kauf')

/** JustWatch nennt für den Titel bei MagentaTV eine Tonspur, aber keine deutsche. */
export function magentaOhneDeutsch(angebote: JwAngebot[]): boolean {
  return angebote.some((a) => /^magentatv$/i.test(a.anbieter ?? '') && (a.audio?.length ?? 0) > 0 && !a.audio?.includes('de'))
}

/** Gracenote-Kennung (`GN_…`) aus der Adresse eines Telekom-Wegs. */
export function gnKennung(url: string): string | undefined {
  if (!/magenta\.tv\/|videoload\.de\//i.test(url)) return undefined
  return /\/(GN_[A-Z0-9_]+)/i.exec(url)?.[1]?.toUpperCase()
}

const gemessenDeutsch = (w: WatchLink): boolean => !w.dubAbgeleitet && Boolean(w.dubRanges?.length) && w.dubRanges!.every((r) => r.dub)

/**
 * Videoload führt JustWatch nicht, der MagentaTV-Weg mit derselben Gracenote-Kennung ist derselbe Katalogeintrag (19.10.2026,
 * „Your Name“). Hat dieser Zwilling bei einem Film gemessenes Deutsch, übernimmt der Videoload-Weg es als Messung statt der
 * Annahme. Serien nicht (JustWatch-Ton gilt dort nur je Staffel, Regel 07.09.2026).
 */
export function uebernehmeZwilling(title: Title): number {
  if (title.format !== 'MOVIE') return 0
  const wege = title.watchLinks ?? []
  let n = 0
  for (const w of wege) {
    if (w.name !== 'Videoload' || w.dubRanges?.length) continue
    const gn = gnKennung(w.url)
    const zwilling = gn ? wege.find((z) => z.name === 'MagentaTV' && gemessenDeutsch(z) && gnKennung(z.url) === gn) : undefined
    if (!zwilling) continue
    w.dubRanges = zwilling.dubRanges!.map((r) => ({ ...r }))
    n++
  }
  return n
}

/** Wächter (Bestand): Ein Telekom-Weg trägt die Annahme, obwohl ein MagentaTV-Zwilling mit gleicher Kennung gemessenes Deutsch hat. */
export function zwillingFehler(titles: Iterable<Title>): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    const wege = t.watchLinks ?? []
    for (const w of wege) {
      if (w.dubAbgeleitet !== 'telekom-annahme') continue
      const gn = gnKennung(w.url)
      if (gn && wege.some((z) => z !== w && z.name === 'MagentaTV' && gemessenDeutsch(z) && gnKennung(z.url) === gn)) {
        fehler.push(`Anime ${t.id}: „${w.name}" nimmt Deutsch an, obwohl der MagentaTV-Zwilling ${gn} es gemessen hat`)
      }
    }
  }
  return fehler
}

/** Setzt die Annahme an den Telekom-Wegen ohne eigene Angabe (vorher übernimmt Videoload die Messung des Zwillings); gibt die Zahl der gesetzten Wege zurück. */
export function setzeTelekomAnnahme(title: Title, angebote: JwAngebot[]): number {
  if (magentaOhneDeutsch(angebote)) return 0
  uebernehmeZwilling(title)
  let gesetzt = 0
  for (const w of title.watchLinks ?? []) {
    if (!istTelekomShop(w) || w.dubRanges?.length) continue
    w.dubRanges = [{ from: 1, to: title.format === 'MOVIE' ? 1 : Math.max(1, title.episodes ?? 1), dub: true }]
    w.dubAbgeleitet = 'telekom-annahme'
    gesetzt++
  }
  return gesetzt
}

/** Zusicherung für den Bau: Die Kennzeichnung steht nur an Telekom-Wegen, nur mit reinen Deutsch-Bereichen. */
export function telekomFehler(titles: Iterable<Title>): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    for (const w of t.watchLinks ?? []) {
      if (w.dubAbgeleitet !== 'telekom-annahme') continue
      if (!istTelekomShop(w)) fehler.push(`Anime ${t.id}: „${w.name}" trägt die Telekom-Annahme, ist aber kein Telekom-Shop`)
      else if (!w.dubRanges?.length || !w.dubRanges.every((r) => r.dub)) fehler.push(`Anime ${t.id}: „${w.name}" trägt die Telekom-Annahme ohne reine Deutsch-Bereiche`)
    }
  }
  return fehler
}
