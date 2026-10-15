import { log } from '../lib/util.ts'
import { type StreamLink, type Title } from '../../shared/types.ts'
import { stripAffiliate } from '../../shared/mappings.ts'
import { wegVerneint } from '../lib/dub-confirmed.ts'
import { plattformVon } from '../lib/cartoons.ts'

export type JwAbo = { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string; audio?: string[] }[] }

/**
 * **Ein Abo-Angebot mit belegtem deutschem Ton kommt auch dazu, wenn der Titel schon Wege
 * hat**.
 *
 * Die Runde darüber ergänzt nur Titel **ohne jeden** Weg — eine Regel gegen Listen von zwölf
 * Amazon-Varianten. Sie ließ 40 Angebote liegen, bei denen JustWatch die deutsche Tonspur je
 * Angebot ausweist: One Piece bei Disney+, Naruto Shippuden und Trigun bei Prime, Dragon Ball
 * Super: Broly bei Disney+, wo wir nur Crunchyroll und Prime zeigen (gemessen 23.09.2026:
 * 24 Prime, 9 Crunchyroll, 7 Disney+).
 *
 * Drei Riegel halten die Pillenreihe schmal und die Aussage belegt:
 *
 * 1. Nur **Abo** (`FLATRATE`/`ADS`) — Kauf und Leihe stehen weiter in `watchLinks`.
 * 2. Nur mit `audio`, das `de` enthält. Ein Angebot ohne Sprachangabe belegt nichts
 *    (CLAUDE.md: „Eine Zahl am Weg braucht einen Beleg an genau diesem Weg").
 * 3. Nur Anbieter, die wir als Plattform führen, und höchstens **zwei** je Titel.
 *
 * Der Weg trägt **kein** `dub` (11.10.2026): JustWatch ist kein Beleg. Bei Prime setzt `11-6-jw-vertrauen.ts`
 * danach den Umriss „Deutsch laut JustWatch", wo die Vertrauensregel greift.
 */
export function ergaenzeAboWege({ titles, jw, handNein, tmdbMehrdeutig, toteAdressen }: {
  titles: Map<number, Title>
  jw: Record<string, JwAbo>
  handNein: ReadonlySet<string>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
}) {
  /**
   * **Eine Handprüfung hat das letzte Wort** (Lauf 35900967510, 23.09.2026).
   *
   * Der erste Anlauf dieser Runde legte vier Wege an, die jemand von Hand geprüft und
   * verneint hatte: Free! und Free!: Eternal Summer bei Crunchyroll („ohne deutsche
   * Tonspur"), AIR GEAR Special und Girls und Panzer Specials bei Prime („nicht
   * verfügbar"). `check:handbelege` hat den Bau dafür zu Recht rot gemacht — genau dafür
   * gibt es die Prüfung.
   *
   * JustWatch weiß, was ein Anbieter **listet**. Wer nachgesehen hat, weiß, was dort
   * wirklich läuft. Bei einem Widerspruch gewinnt das Nachsehen.
   */
  let ergaenzt = 0
  for (const title of titles.values()) {
    const b = jw[String(title.id)]
    if (!b || b.ohneTreffer || !b.angebote?.length) continue
    if (tmdbMehrdeutig.has(String(title.id))) continue
    const vorhanden = new Set((title.streams ?? []).map((x) => x.platform))
    let neueHier = 0
    for (const a of b.angebote) {
      if (neueHier >= 2) break
      if (a.art !== 'FLATRATE' && a.art !== 'ADS') continue
      if (!(a.audio ?? []).includes('de')) continue
      if (!a.url || toteAdressen.has(a.url)) continue
      /*
        **Ein Amazon-Kanal ist nicht der Anbieter selbst** (gemessen 23.09.2026, bevor das
        live ging): `plattformVon()` vergleicht mit `startsWith`, und „RTL+ Max Amazon
        Channel" beginnt nun einmal mit „RTL+". Von 112 Kandidaten waren 68 solche Kanäle —
        ihre Adresse führt zu `watch.amazon.de`, die Pille hätte „RTL+" behauptet und Amazon
        geöffnet. Wer den Kanal gebucht hat, sieht den Weg ohnehin über Prime.
      */
      if (/Amazon Channel/i.test(a.anbieter)) continue
      const plattform = plattformVon(a.anbieter)
      if (!plattform || vorhanden.has(plattform)) continue
      if (wegVerneint(handNein, title.id, plattform, a.url)) continue
      title.streams = [
        ...(title.streams ?? []),
        {
          platform: plattform,
          url: stripAffiliate(a.url),
          ...(a.art === 'ADS' ? { zugang: 'kostenlos' as const } : { zugang: 'abo' as const }),
        } as StreamLink,
      ]
      vorhanden.add(plattform)
      neueHier++
      ergaenzt++
    }
  }
  if (ergaenzt) log(`${ergaenzt} Abo-Weg(e) aus JustWatch ergänzt (deutsche Tonspur laut JustWatch, ohne eigenes Urteil)`)
}
