// „Kalender heute“ (Daniel, 19.11.2026): Termine des heutigen Berliner Tages aus woche.json (events.json, wenn „heute“ außerhalb ihrer Woche liegt).
// Filter wie die Tagesansicht (web/src/components/WeekView.tsx, tageDerWoche): Stream-Termine des Tages, Disc ist ein eigener Weg und fällt weg;
// TV nur als Premiere (`tvPremiere: true`), Wiederholungen und Termine ohne Aussage fallen weg (Daniel, 20.11.2026: „tv nur premiere“);
// „Im Angebot seit“ (`imAngebot`) ist kein Erscheinen und fällt weg (shared/logic.ts setzt es nur bei dateMeaning „available-from“).
export type KalenderTermin = {
  date: string
  time?: string
  name: string
  platform: string
  sender?: string
  episode?: number
  episodeCount?: number
  estimated?: boolean
  timeEstimated?: boolean
  releaseType?: string
  imAngebot?: boolean
  tvPremiere?: boolean
}
export type KalenderZeile = { zeit: string | null; geschaetzt: boolean; name: string; anbieter: string; folgen: string }
export type KalenderStand = { datum: string; zeilen: KalenderZeile[] }
export type WocheDatei = { von?: string; bis?: string; events?: KalenderTermin[] }

// Anzeigenamen wie `PLATFORMS` in shared/types.ts; TV zeigt den Sender.
const ANBIETER: Record<string, string> = {
  crunchyroll: 'Crunchyroll', netflix: 'Netflix', primevideo: 'Prime Video', disneyplus: 'Disney+', joyn: 'Joyn',
  rtlplus: 'RTL+', paramountplus: 'Paramount+', adn: 'ADN', kino: 'Kino', tv: 'TV',
}
export const anbieterName = (platform: string, sender?: string): string => (platform === 'tv' && sender) || ANBIETER[platform] || platform

// Berliner Kalendertag („2026-11-19“) zu einem Zeitpunkt, nie das UTC-Datum.
export function heuteBerlin(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}

// Berliner Uhrzeit „HH:MM“ zu einem Zeitpunkt.
export function uhrzeitBerlin(ms: number): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))
}

// Vorbei ist ein Termin, dessen Uhrzeit heute schon verstrichen ist; ohne Uhrzeit nie.
export const istVorbei = (z: KalenderZeile, datum: string, jetztMs: number): boolean =>
  !!z.zeit && datum === heuteBerlin(jetztMs) && z.zeit < uhrzeitBerlin(jetztMs)

// „62“ → „F62“, „62, 63“ → „F62–63“, getrennte Nummern bis drei einzeln, sonst „n Folgen“; ohne Nummern bei Batch „alle n Folgen“.
export function folgenText(nummern: number[], batchAnzahl?: number): string {
  const n = [...new Set(nummern)].sort((a, b) => a - b)
  if (!n.length) return batchAnzahl ? `alle ${batchAnzahl} Folgen` : ''
  if (n.length === 1) return `F${n[0]}`
  if (n[n.length - 1]! - n[0]! === n.length - 1) return `F${n[0]}–${n[n.length - 1]}`
  return n.length <= 3 ? n.map(x => `F${x}`).join(', ') : `${n.length} Folgen`
}

// Eine Zeile je Titel und Anbieter (TV: je Sender); mit Uhrzeit nach Zeit, ohne Uhrzeit danach.
export function kalenderHeute(termine: KalenderTermin[], datum: string): KalenderZeile[] {
  const gruppen = new Map<string, KalenderTermin[]>()
  for (const t of termine) {
    if (t.date !== datum || t.releaseType === 'disc' || t.platform === 'disc' || t.imAngebot || (t.platform === 'tv' && t.tvPremiere !== true)) continue
    const k = [t.name, t.platform, t.sender ?? ''].join('|')
    gruppen.set(k, [...(gruppen.get(k) ?? []), t])
  }
  const zeilen = [...gruppen.values()].map((g): KalenderZeile => {
    const erste = g.filter(t => t.time).sort((a, b) => a.time!.localeCompare(b.time!))[0]
    const nummern = g.flatMap(t => (t.episode ? [t.episode] : []))
    const batch = nummern.length ? undefined : g.find(t => t.releaseType === 'batch')?.episodeCount
    return {
      zeit: erste?.time ?? null,
      geschaetzt: !!erste && !!(erste.estimated || erste.timeEstimated),
      name: g[0]!.name,
      anbieter: anbieterName(g[0]!.platform, g[0]!.sender),
      folgen: folgenText(nummern, batch),
    }
  })
  return zeilen.sort((a, b) => (a.zeit ?? '99:99').localeCompare(b.zeit ?? '99:99') || a.name.localeCompare(b.name, 'de') || a.anbieter.localeCompare(b.anbieter, 'de'))
}

export const kalenderZeilenText = (z: KalenderZeile): string =>
  [z.zeit ? `${z.geschaetzt ? '≈' : ''}${z.zeit}` : '', z.name].filter(Boolean).join(' ') + ` · ${z.anbieter}` + (z.folgen ? ` · ${z.folgen}` : '')

// Die Wochen-Datei trägt „heute“, wenn der Tag in ihrer Woche liegt; sonst events.json.
export const wocheDeckt = (w: WocheDatei, datum: string): boolean => !!w.von && !!w.bis && datum >= w.von && datum <= w.bis

// woche.json ist ein Objekt mit `events`, events.json eine flache Liste.
export function termineAusDatei(text: string): WocheDatei {
  const d = JSON.parse(text) as WocheDatei | KalenderTermin[]
  return Array.isArray(d) ? { events: d } : d
}
