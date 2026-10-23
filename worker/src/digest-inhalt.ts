/** Was ein einzelner Abonnent im Digest bekommt — reine Rechnung, kein Abruf, keine Datenbank. */
import type { NewsEintrag, ReleaseEvent } from '../../shared/types.ts'
import { digestMail, type NeuMitSynchro, type ReleaseLink } from './templates.ts'
import { leseFavoriten, type Kennungen } from './favoriten-kennung.ts'
import { newsFuerAbonnent } from './news-quelle.ts'

export interface SubscriberRow {
  id: string
  email: string
  frequency: 'daily' | 'weekly'
  platforms: string
  favorites: string
  /** Auch Neues aus Reihen melden, von denen ein Titel gemerkt ist. */
  franchise_hinweis: number
  unsub_token: string
  pref_token: string
  /**
   * Wann diese Adresse zuletzt eine Mail bekam — die Grenze dafür, welcher
   * Neuzugang schon gemeldet wurde. `null`, solange noch keine verschickt ist.
   */
  last_sent_at: string | null
  created_at: string
}

/** Je Titel seine Reihe und sein Jahr — siehe `reihen.json` im Bau. */
export type Reihen = Record<string, { f: number; j: number | null }>

/** Was für alle Abonnenten eines Durchgangs gleich ist. */
export interface DigestKontext {
  frequency: 'daily' | 'weekly'
  iso: string
  until: string
  window: ReleaseEvent[]
  alleNeu: NeuMitSynchro[]
  reihen: Reihen
  weitereAnbieter: { id: number; name: string; anbieter: string; am: string }[]
  kennungen: Kennungen
  news: NewsEintrag[]
  links: Map<string, ReleaseLink>
  workerUrl: string
  siteUrl: string
}

export interface DigestPost {
  sub: SubscriberRow
  mail: { subject: string; html: string; text: string }
  unsubUrl: string
  syncToken: string
}

/**
 * **Neues aus einer Reihe, von der etwas gemerkt ist.**
 *
 * Daniel am 28.08.2026: „ich will informiert werden weil ich es sonst
 * evtl verpasse." Wer die letzte Staffel gemerkt hat, erfaehrt sonst nie,
 * dass eine neue angekuendigt wurde — sie ist ein eigener Titel, und den
 * hat er noch nicht gemerkt, weil es ihn gerade erst gibt.
 *
 * **Zwei Riegel gegen Laerm**, beide einfach:
 *
 * - Nur, was **nicht aelter** ist als der gemerkte Titel. Wird eine OVA
 *   von 2005 erstmals erfasst, ist sie fuer den Bestand neu, aber keine
 *   Ankuendigung. Ohne Jahresangabe gilt sie als neu — Schweigen waere
 *   hier der groessere Fehler.
 * - Nur einmal, ueber dieselbe Grenze wie die uebrigen Neuzugaenge.
 *
 * Gemessen kommen rund 0,2 Titel je Tag neu in den Bestand; eine Flut
 * ist daraus nicht zu erwarten.
 */
function neuAusReihen(sub: SubscriberRow, favorites: Set<number>, seit: string, k: DigestKontext): NeuMitSynchro[] {
  const meineReihen = new Map<number, number>()
  if (sub.franchise_hinweis) {
    for (const id of favorites) {
      const ausReihenDatei = k.reihen[String(id)]
      const reihe = ausReihenDatei?.f ?? k.alleNeu.find((n) => n.id === id)?.franchiseId
      if (!reihe) continue
      const jahr = ausReihenDatei?.j ?? null
      const bisher = meineReihen.get(reihe)
      if (bisher === undefined || (jahr !== null && jahr < bisher)) meineReihen.set(reihe, jahr ?? 0)
    }
  }
  return sub.franchise_hinweis
    ? k.alleNeu.filter(
        (n) =>
          !favorites.has(n.id) &&
          (!seit || n.seit > seit) &&
          n.franchiseId !== undefined &&
          meineReihen.has(n.franchiseId) &&
          (n.jahr == null || n.jahr >= (meineReihen.get(n.franchiseId) ?? 0)),
      )
    : []
}

/** Die Mail für einen Abonnenten, oder `null`, wenn es für ihn nichts zu erzählen gibt. */
export function digestFuer(sub: SubscriberRow, k: DigestKontext): DigestPost | null {
  const wanted = sub.platforms ? sub.platforms.split(',') : []
  const events = wanted.length ? k.window.filter((e) => wanted.includes(e.platform)) : k.window

  // Gemerkte Titel nach vorn: Eine neue Folge einer Serie, der jemand
  // folgt, ist ihm wichtiger als irgendein Disc-Release.
  const favorites = leseFavoriten(sub.favorites, k.kennungen)

  /**
   * Gemerkte Titel, die **seit der letzten Mail an diesen Abonnenten** eine
   * Synchro bekommen haben.
   *
   * Die Grenze ist bewusst der persönliche Versandzeitpunkt und nicht ein
   * festes Fenster: Wer eine Woche lang keine Mail bekam, weil nichts
   * anstand, soll die Nachricht trotzdem noch sehen. Umgekehrt verhindert
   * sie, dass derselbe Titel in jeder Mail erneut gefeiert wird.
   */
  const seit = (sub.last_sent_at ?? '').slice(0, 10)
  const eigene = k.alleNeu.filter((n) => favorites.has(n.id) && (!seit || n.seit > seit))
  const ausReihe = neuAusReihen(sub, favorites, seit, k)
  const neuMitSynchro = [...eigene, ...ausReihe.map((n) => ({ ...n, ausReihe: true }))]
  /* Ein weiterer Anbieter für einen gemerkten Titel, seit der letzten Mail (18.09.2026). */
  const auchBei = k.weitereAnbieter.filter((w) => favorites.has(w.id) && (!seit || w.am > seit))

  /**
   * Ohne Termine **und** ohne Neuzugang gibt es nichts zu erzählen.
   *
   * Eine angekündigte Synchro ohne Termin ist genau die Nachricht, auf die
   * jemand monatelang wartet — sie löst eine Mail aus, auch ohne Termine.
   */
  if (!events.length && !neuMitSynchro.length && !auchBei.length) return null

  const base = k.workerUrl.replace(/\/$/, '')
  const unsubUrl = `${base}/unsubscribe?token=${sub.unsub_token}`
  /**
   * Befristeter Abgleich-Link statt des Dauerschlüssels.
   *
   * Der `pref_token` verlässt den Server nicht mehr (siehe `handleSync`).
   * Je Versand entsteht ein neuer, dreißig Tage gültiger Schlüssel — eine
   * drei Monate alte weitergeleitete Mail führt damit ins Leere, eine
   * gestern empfangene funktioniert.
   */
  const syncToken = crypto.randomUUID()
  const syncUrl = `${base}/sync?token=${syncToken}`
  // Der Umstell-Knopf zeigt auf den jeweils **anderen** Rhythmus — was in
  // der Mail steht, ist ja der aktuelle.
  const rhythmusUrl = `${base}/rhythmus?token=${syncToken}&auf=${k.frequency === 'daily' ? 'weekly' : 'daily'}`
  const meineNews = newsFuerAbonnent(k.news, seit, k.iso, k.until, k.frequency)
  const mail = digestMail(events, k.frequency, k.siteUrl, unsubUrl, {
    favorites,
    syncUrl,
    rhythmusUrl,
    links: k.links,
    neuMitSynchro,
    auchBei,
    news: meineNews,
  })
  return { sub, mail, unsubUrl, syncToken }
}
