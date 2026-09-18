import type { NewsEintrag } from '../../shared/types.ts'
import { newsSatz } from '../../web/src/lib/news-text.ts'

/**
 * **Die Nachrichtenseite als RSS 2.0** (18.09.2026, Feature-Vergleich: animeschedule.net).
 *
 * Für Feedreader und Discord-Webhooks, die RSS lesen. Ein Eintrag je Titel und Tag,
 * wie auf der Seite; die Sätze kommen aus `newsSatz()`, also derselbe Wortlaut.
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function newsRss(eintraege: NewsEintrag[], siteUrl: string, max = 60): string {
  const basis = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`
  const items = eintraege.slice(0, max).map((e) => {
    const saetze = e.meldungen.map((m) => `${m.teil ? `${m.teil}: ` : ''}${newsSatz(m)}`)
    const link = `${basis}#/news?t=${e.titelId}`
    /* 12 Uhr Berliner Zeit: Die Meldungen tragen nur einen Tag, keine Uhrzeit. */
    const datum = new Date(`${e.am.slice(0, 10)}T10:00:00Z`).toUTCString()
    return [
      '<item>',
      `<title>${esc(`${e.titel}: ${saetze[0] ?? ''}${saetze.length > 1 ? ` (+${saetze.length - 1})` : ''}`)}</title>`,
      `<link>${esc(link)}</link>`,
      `<guid isPermaLink="false">${esc(`${e.am.slice(0, 10)}-${e.titelId}`)}</guid>`,
      `<pubDate>${datum}</pubDate>`,
      `<description>${esc(saetze.join('\n'))}</description>`,
      '</item>',
    ].join('')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    '<title>Anime-Kalender DE – News</title>',
    `<link>${esc(basis)}#/news</link>`,
    `<atom:link href="${esc(basis)}data/feeds/news.xml" rel="self" type="application/rss+xml"/>`,
    '<description>Neue deutsche Synchros, Folgen, Starttermine, Disc- und Kinostarts</description>',
    '<language>de-de</language>',
    ...items,
    '</channel></rss>',
    '',
  ].join('\n')
}
