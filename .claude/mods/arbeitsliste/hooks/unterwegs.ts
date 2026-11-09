// „## Titel unterwegs“ (Daniel, 08.11.2026): jede neue Synchro-Information mit Status, Alter des Status und Dauer bis live.
// Zeile: `- [Status TT.MM. HH:MM] Titel SxEy — de Synchro seit TT.MM.JJJJ (Anbieter) · Info TT.MM. HH:MM · live TT.MM. HH:MM`;
// „im Bestand TT.MM. HH:MM“ ersetzt die Info-Zeit als Start der Dauer, „live gemessen“ gilt wie „live“. Zeiten in Ortszeit, ohne Jahr.
import { klartext } from './zaehlen'

export type UStatus = 'Info' | 'Queue' | 'In Arbeit' | 'Pipeline' | 'Live'
export type UnterwegsEintrag = {
  status: string
  seit: number
  titel: string
  meta: string
  start: number | null
  startArt: 'Info' | 'Bestand' | null
  live: number | null
}

// Farben sind Themenschlüssel; ein unbekanntes Status-Wort zeigt die Oberfläche als „?wort“ in Rot.
export const U_FARBE: Record<UStatus, string> = { Info: 'inactive', Queue: 'suggestion', 'In Arbeit': 'warning', Pipeline: 'merged', Live: 'success' }
// Ab wann ein Status als hängend gilt (Minuten, Daniel 08.11.2026); Live hängt nie. Pipeline = Bestandsbau + Deploy, Median noch nicht gemessen.
export const U_SCHWELLE_MIN: Record<Exclude<UStatus, 'Live'>, number> = { Info: 15, Queue: 15, 'In Arbeit': 60, Pipeline: 30 }
// Info → live länger als das ist rot (Ziel „live < 5 min“).
export const U_DAUER_MAX_MIN = 5
// Live-Zeilen verschwinden nach 2 Tagen.
export const U_LIVE_TAGE = 2

const MIN = 60_000
const ZEIT = '(\\d{2})\\.(\\d{2})\\. (\\d{2}):(\\d{2})'
const KOPF = new RegExp(`^- \\[(.+?) ${ZEIT}\\]\\s+(.+)$`)

// Ohne Jahr: das jüngste Jahr, in dem die Zeit nicht nach `jetzt` liegt; ungültiges Datum (31.02.) → null.
function zeitMs(m: RegExpExecArray | null, ab: number, jetzt: number): number | null {
  if (!m) return null
  const [tag, monat, std, min] = [+m[ab]!, +m[ab + 1]!, +m[ab + 2]!, +m[ab + 3]!]
  const jahr = new Date(jetzt).getFullYear()
  const bau = (j: number) => new Date(j, monat - 1, tag, std, min)
  let d = bau(jahr)
  if (d.getTime() > jetzt) d = bau(jahr - 1)
  if (d.getMonth() !== monat - 1 || d.getDate() !== tag || d.getHours() !== std) return null
  return d.getTime()
}

const zeitNach = (rest: string, wort: string, jetzt: number) => zeitMs(new RegExp(`(?:^|\\s)${wort} ${ZEIT}`).exec(rest), 1, jetzt)

function lies(zeile: string, jetzt: number): UnterwegsEintrag | null {
  const m = KOPF.exec(zeile)
  if (!m) return null
  const seit = zeitMs(m, 2, jetzt)
  if (seit === null) return null
  const [kopf, ...tail] = m[6]!.split(' — ')
  const rest = tail.join(' — ')
  const info = zeitNach(rest, 'Info', jetzt)
  const bestand = zeitNach(rest, 'im Bestand', jetzt)
  const startArt = info !== null ? 'Info' : bestand !== null ? 'Bestand' : null
  return {
    status: m[1]!,
    seit,
    titel: klartext(kopf!),
    meta: klartext(rest.split(' · ')[0]!),
    start: info ?? bestand,
    startArt,
    live: zeitNach(rest, 'live(?: gemessen)?', jetzt),
  }
}

// Zeilen „- “ unter „## Titel unterwegs“ bis zur nächsten „## “; Live-Zeilen älter als U_LIVE_TAGE fallen weg. Zeile unlesbar: weggelassen.
export function zaehleUnterwegs(text: string, jetzt: number): UnterwegsEintrag[] {
  const aus: UnterwegsEintrag[] = []
  let drin = false
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) drin = zeile.startsWith('## Titel unterwegs')
    else if (drin) {
      const e = lies(zeile, jetzt)
      if (!e || (e.status === 'Live' && jetzt - e.seit > U_LIVE_TAGE * 86_400_000)) continue
      aus.push(e)
    }
  }
  return aus
}

export const alterMin = (e: UnterwegsEintrag, jetzt: number): number => Math.max(0, Math.floor((jetzt - e.seit) / MIN))

// Hängend: bekannter Status außer Live steht länger als seine Schwelle (genau die Schwelle ist noch grün); Unbekanntes ist immer rot.
export function haengt(e: UnterwegsEintrag, jetzt: number): boolean {
  if (e.status === 'Live') return false
  const grenze = U_SCHWELLE_MIN[e.status as keyof typeof U_SCHWELLE_MIN]
  return grenze === undefined || alterMin(e, jetzt) > grenze
}

// Minuten Start → live, wenn beides bekannt und in richtiger Reihenfolge.
export function dauerMin(e: UnterwegsEintrag): number | null {
  if (e.start === null || e.live === null || e.live < e.start) return null
  return Math.round((e.live - e.start) / MIN)
}

export const langsam = (e: UnterwegsEintrag): boolean => (dauerMin(e) ?? 0) > U_DAUER_MAX_MIN

export function kurzDauer(min: number): string {
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.floor(min / 60)} h ${min % 60} min`
  return `${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`
}

const zwei = (n: number) => String(n).padStart(2, '0')
// „08.11. 14:38“ für das Label.
export function labelZeit(ms: number): string {
  const d = new Date(ms)
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}`
}

export const labelText = (e: UnterwegsEintrag): string => `${e.status} ${labelZeit(e.seit)}`

// „seit 2 h 10 min“ hinter dem Titel; Live zeigt das Alter nicht (Dauer genügt).
export function seitText(e: UnterwegsEintrag, jetzt: number): string {
  return e.status === 'Live' ? '' : `seit ${kurzDauer(alterMin(e, jetzt))}`
}

export function dauerText(e: UnterwegsEintrag): string {
  const min = dauerMin(e)
  return min === null ? '' : `${e.startArt === 'Info' ? 'Info' : 'Bestand'} → live ${kurzDauer(min)}`
}
