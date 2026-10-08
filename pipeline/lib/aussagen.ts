/**
 * **Aussagen aus Sammelartikeln** — das Zwischenformat des PoC (08.10.2026, `docs/wissen/sammelartikel-poc.md`).
 *
 * Ein Sammelartikel („Netflix: Alle Anime-Neuzugänge im Oktober", Crunchyrolls Season-Lineup) ist eine
 * Liste von Behauptungen. Jede wird hier zu **einer** Aussage mit ihrem Zitat, ihrer Quelle und einer
 * Konfidenz, die sagt, wie wörtlich der Artikel sie trägt. Erst danach kommt die Zuordnung zu einem Titel
 * (`aussagen-zuordnung.ts`) — getrennt, damit eine falsche Zuordnung nie die Lesung verfälscht.
 */

/** Was der Artikel zur deutschen Fassung sagt. `nein` = ausdrücklich nur Untertitel. */
export type Deutsch = 'ja' | 'nein' | 'angekuendigt' | 'unklar'

export type AussageArt =
  /** Ein Titel startet an einem Tag bei einem Anbieter (mit oder ohne deutschen Ton, siehe `deutsch`). */
  | 'start'
  /** Crunchyroll-Lineup: OmU-Start mit „DE: TBA" oder ohne DE-Angabe. */
  | 'omu-start'
  /** Nur die Zusage einer Synchro, ohne Termin (Crunchyrolls Synchro-Artikel, „Hinweis: Synchronisation angekündigt"). */
  | 'synchro-angekuendigt'

export type Leser = 'anime2you-sammel' | 'crunchyroll-lineup' | 'crunchyroll-synchros'

export interface Aussage {
  quelle: { url: string; veroeffentlicht: string; aktualisiert?: string; leser: Leser }
  /** Der Name, wie der Artikel ihn schreibt (ohne Guillemets). */
  titel: string
  /** „Staffel 2", „Part 1", „Staffel 4 bis 8" — so wie es dasteht. */
  zusatz?: string
  art: AussageArt
  /** `PlatformId`s; leer, wenn der Artikel keinen Anbieter nennt. */
  plattformen: string[]
  /** Prime-Zusatzkanal („aniverse"), wenn der Artikel einen nennt. */
  kanal?: string
  /** ISO-Tag; „JJJJ-MM", wo der Artikel nur den Monat nennt (ankert dann keinen Japan-Start). */
  datum?: string
  /** Woher der Tag stammt: ausdrücklich genannt, OmU-Start, oder „ab sofort" = Tag der Meldung. */
  datumBedeutung?: 'genannt' | 'omu-start' | 'tag-der-meldung'
  deutsch: Deutsch
  woechentlich?: boolean
  /** „HH:MM", nur wenn der Artikel sie nennt — nie geraten. */
  zeit?: string
  /** Alle Folgen an einem Tag („12 (komplett)"); eine Spanne („93 bis 206") steht in `zusatz`. */
  folgen?: number
  /** Handlungstext des Artikels, falls vorhanden (Crunchyroll: offizieller Text). */
  inhalt?: string
  /** 0–1: wie wörtlich der Artikel diese Aussage trägt. Berechnung: `konfidenz()`. */
  konfidenz: number
  gruende: string[]
  /** Die Zeilen, aus denen gelesen wurde — der Beleg der Aussage. */
  zitat: string
}

export const MONATE: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
  september: 9, oktober: 10, november: 11, dezember: 12,
}

/**
 * „7. Oktober", „30. September 2026", „12.10.", „01.10.2026" → ISO. Ohne Jahr gilt das Jahr der
 * Veröffentlichung; nennt ein Dezember-Artikel den Januar, ist das nächste Jahr gemeint.
 */
export function datumAus(text: string, veroeffentlicht: string): string | undefined {
  const m = /(\d{1,2})\.\s*(?:([A-Za-zÄÖÜäöü]+)|(\d{1,2})\.)\s*(\d{4})?/.exec(text)
  if (!m) return undefined
  const monat = m[2] ? MONATE[m[2].toLowerCase()] : Number(m[3])
  if (!monat || monat > 12) return undefined
  const tag = Number(m[1])
  if (tag < 1 || tag > 31) return undefined
  const jahrPub = Number(veroeffentlicht.slice(0, 4))
  const monatPub = Number(veroeffentlicht.slice(5, 7))
  const jahr = m[4] ? Number(m[4]) : monat < monatPub - 6 ? jahrPub + 1 : jahrPub
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

/** „Oktober" ohne Tag → „JJJJ-MM" (Crunchyroll schreibt bei PSYREN „OmU: Oktober"); mit Tag undefined — dafür ist `datumAus` da. */
export function monatAus(text: string, veroeffentlicht: string): string | undefined {
  if (datumAus(text, veroeffentlicht)) return undefined
  const m = /\b([A-Za-zÄÖÜäöü]+)\b/g
  let w: RegExpExecArray | null
  while ((w = m.exec(text))) {
    const monat = MONATE[w[1]!.toLowerCase()]
    if (!monat) continue
    const jahrPub = Number(veroeffentlicht.slice(0, 4))
    const jahr = monat < Number(veroeffentlicht.slice(5, 7)) - 6 ? jahrPub + 1 : jahrPub
    return `${jahr}-${String(monat).padStart(2, '0')}`
  }
  return undefined
}

/** Anbieternamen im Artikeltext → `PlatformId`; `kanal` für Prime-Kanäle. */
const ANBIETER: Record<string, { platform: string; kanal?: string }> = {
  netflix: { platform: 'netflix' },
  adn: { platform: 'adn' },
  crunchyroll: { platform: 'crunchyroll' },
  'prime video': { platform: 'primevideo' },
  'amazon prime video': { platform: 'primevideo' },
  aniverse: { platform: 'primevideo', kanal: 'aniverse' },
  'disney+': { platform: 'disneyplus' },
  joyn: { platform: 'joyn' },
  'rtl+': { platform: 'rtlplus' },
  wow: { platform: 'wow' },
  youtube: { platform: 'youtube' },
}

export function anbieterAus(name: string): { platform: string; kanal?: string } | undefined {
  return ANBIETER[name.trim().toLowerCase()]
}

/** „Jeden Mittwoch um 19:15 Uhr" → „19:15"; ohne Uhrzeit undefined. */
export function zeitAus(text: string): string | undefined {
  const m = /\b(\d{1,2}):(\d{2})\s*Uhr/.exec(text)
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : undefined
}

/**
 * Konfidenz = das schwächste Glied: Sprache, Tag, Anbieter. Jede Stufe steht hier mit Zahl, damit die
 * Schwelle im Bau (`docs/wissen/sammelartikel-poc.md`, Empfehlung) nachvollziehbar bleibt.
 */
export function konfidenz(a: Pick<Aussage, 'deutsch' | 'datum' | 'datumBedeutung' | 'plattformen' | 'art'>, gruende: string[]): number {
  const sprache = a.deutsch === 'unklar' ? 0.5 : a.deutsch === 'angekuendigt' ? 0.9 : 0.95
  const tag =
    a.art === 'synchro-angekuendigt' ? 1 : !a.datum ? 0.6 : a.datumBedeutung === 'tag-der-meldung' ? 0.8 : a.datum.length === 7 ? 0.7 : 0.95
  const anbieter = a.plattformen.length ? 1 : 0.6
  if (a.deutsch === 'unklar') gruende.push('Sprache nicht genannt')
  if (a.art !== 'synchro-angekuendigt' && !a.datum) gruende.push('kein Tag genannt')
  if (a.datumBedeutung === 'tag-der-meldung') gruende.push('„ab sofort" = Tag der Meldung')
  if (!a.plattformen.length) gruende.push('kein Anbieter genannt')
  return Math.round(Math.min(sprache, tag, anbieter) * 100) / 100
}
