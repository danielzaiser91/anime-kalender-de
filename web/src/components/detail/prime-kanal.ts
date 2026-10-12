import { expandEvents } from '@shared/logic.ts'
import type { PlatformId, Release, StreamLink } from '@shared/types.ts'
import { zaehleErschienen } from './antwort-regeln.ts'

/**
 * **Kanal → Anbieter: Prime-Video-Kanäle, deren Bestand der Anbieter selbst führt** (11.10.2026,
 * Daniel: „die echte Webseite führt den Prime-Kanal“). Schlüssel ist `kanal` klein geschrieben.
 * Beleg je Eintrag: der Kanalname in Amazons Meldung und die Anbieter-Domain des eigenen Weges
 * (crunchyroll.com, animationdigitalnetwork.com); `PLATFORM_LABEL['primevideo-channel-…']` in
 * `shared/mappings.ts` führt dieselben Kanäle. Aniverse und RTL+ fehlen mit Absicht: Dort gibt es
 * im Bestand (11.10.2026) keinen eigenen Weg, aus dem eine Zahl käme. Neuer Kanal erst mit
 * eigenem Weg des Anbieters und Domain-Beleg.
 */
const KANAL_ANBIETER: Record<string, PlatformId> = {
  crunchyroll: 'crunchyroll',
  adn: 'adn',
}

/**
 * Der Anbieter-Weg, dessen Bestand ein Prime-Kanal-Weg teilt. Nur mit belegtem Deutsch an beiden:
 * Bei Golden Wind liegt auf Crunchyroll nur Französisch und Japanisch (dub false), die
 * Kanal-Pille ohne Urteil (dub undefined) darf davon keine Zahl erben.
 */
export function kanalQuelle(s: { platform?: string; kanal?: string; dub?: boolean }, streams: StreamLink[]): StreamLink | undefined {
  if (s.platform !== 'primevideo' || s.dub !== true) return undefined
  const anbieter = KANAL_ANBIETER[(s.kanal ?? '').toLowerCase()]
  return anbieter ? streams.find((q) => q.platform === anbieter && q.dub === true) : undefined
}

type Bereiche = NonNullable<StreamLink['dubRanges']>

/** Deutsche Bereiche beider Seiten zusammen (überlappende und angrenzende verschmolzen); „ohne Ton“ der Quelle nur, wo kein deutscher Bereich darüber liegt. */
function vereinigeDeutsch(eigene: Bereiche, quelle: Bereiche): Bereiche {
  const deutsch: Bereiche = []
  for (const b of [...eigene, ...quelle].filter((x) => x.dub).sort((a, c) => a.from - c.from)) {
    const letzter = deutsch[deutsch.length - 1]
    if (letzter && b.from <= letzter.to + 1) letzter.to = Math.max(letzter.to, b.to)
    else deutsch.push({ from: b.from, to: b.to, dub: true })
  }
  const ohneTon = quelle.filter((x) => !x.dub && !deutsch.some((d) => d.from <= x.to && x.from <= d.to))
  return [...deutsch, ...ohneTon].sort((a, c) => a.from - c.from)
}

/** Die Plattform, nach deren Releases die Pille zählt: bei einem Kanal-Weg ohne eigene deutsche Bereiche der Anbieter. */
export function zaehlPlattform(s: { platform?: string; kanal?: string; dub?: boolean; dubRanges?: StreamLink['dubRanges'] }, streams: StreamLink[]): string | undefined {
  const anbieter = s.dubRanges?.some((r) => r.dub) ? undefined : kanalQuelle(s, streams)
  return anbieter?.platform ?? s.platform
}

/** Die deutschen Bereiche des Anbieter-Wegs; ohne belegte zählt der Wochenplan, wie die Pille des Anbieters selbst. */
function quelleBereiche(quelle: StreamLink, releases: Release[]): Bereiche {
  if (quelle.dubRanges?.some((b) => b.dub)) return quelle.dubRanges
  const wochen = releases.filter((r) => r.platform === quelle.platform && r.releaseType === 'weekly')
  const erschienen = zaehleErschienen(wochen.flatMap((r) => expandEvents(r)))
  return erschienen ? [{ from: 1, to: erschienen, dub: true }] : []
}

/**
 * **Der Kanal-Weg zeigt die Vereinigung seiner eigenen deutschen Bereiche und derer des
 * Anbieter-Wegs** (10.10.2026, Slime Staffel 4: Crunchyroll „23 Fg.“, Prime-Kanal „Fg. 1–19“,
 * obwohl der Kanal denselben Bestand führt). Ein belegter Bestand wird nie kleiner (Lupin III
 * Part 6: Kanal 25 Folgen, Crunchyroll belegt 1–24). Eigene „ohne Ton“-Handbelege weichen den
 * Bereichen des Anbieters (Hensuki, Daniels Entscheidung 11.10.2026). Ohne eigene Bereiche
 * bleibt der Weg, wie er ist; die Pille zählt dann nach dem Anbieter (`folgenAuskunft`).
 *
 * Hier und nicht im Bau, weil die Zahl vom Tag abhängt (erschienene Folgen). Erwartet Streams,
 * deren Bereiche schon um den Wochenplan ergänzt sind (`titelMitTerminBereichen`).
 */
export function streamsMitKanalBestand(streams: StreamLink[], releases: Release[]): StreamLink[] {
  return streams.map((s) => {
    const quelle = kanalQuelle(s, streams)
    if (!quelle || !s.dubRanges?.length) return s
    const vomAnbieter = quelleBereiche(quelle, releases)
    const gemeinsam = vereinigeDeutsch(s.dubRanges, vomAnbieter)
    /* Belegt der Anbieter keine Bereiche, zählt seine Pille nach Wochenplan oder ganzem Titel; der Kanal zählt dann genauso („23 Fg.“ statt „Fg. 1–23“), solange er nicht weiter ist. */
    const wieAnbieter = !quelle.dubRanges?.some((b) => b.dub) && (!vomAnbieter.length || JSON.stringify(gemeinsam) === JSON.stringify(vomAnbieter))
    return { ...s, dubRanges: wieAnbieter ? undefined : gemeinsam }
  })
}
