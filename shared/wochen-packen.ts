import type { Release, ReleaseEvent } from './types.ts'
import type { WochenDatei } from './wochen-datei.ts'
import { addDays } from './time.ts'

/**
 * **Packform der Kachel-Datei** (`woche-kacheln.json`): verlustfrei kleiner, die App packt beim Laden wieder aus (`entpackeKachel`).
 * Gemessen am Bestand vom 07.11.2026 (gzip): Termine ohne die Felder, die ihr Release schon trägt, 22,1 → 19,2 KB; Folgenreihen
 * (`observed`, `zeiten`) als Läufe weitere 1,3 KB. Der Bau prüft jedes Mal, dass Auspacken die Kachel-Datei Wert für Wert zurückgibt.
 *
 * Termin: Felder, die dem Release gleichen (`VOM_RELEASE`), entfallen; fehlt eines im Termin, das das Release trägt, steht `null`.
 * `id` entfällt, wenn sie `<releaseSlug>@<date>` ist, und steht als `#`, wenn sie `<releaseSlug>@<date>#<episode>` ist.
 * `releaseSlug` wird zur Stelle `r` in der Release-Liste. Folgenreihen: Folgen `a`–`b` mit gleichem Wert (oder bei Daten gleichem
 * Abstand in Tagen) werden zu einem Schlüssel `a-b`, Wert `2026-10-03+7` bzw. `16:05`.
 */
export const VOM_RELEASE = ['name', 'titleId', 'platform', 'releaseType', 'sender'] as const

type Roh = Record<string, unknown>
const TAG = /^(\d{4}-\d\d-\d\d)(?:\+(\d+))?$/

const tage = (von: string, bis: string): number => Math.round((Date.parse(bis) - Date.parse(von)) / 86400000)

/** Läufe aufeinanderfolgender Folgen; `schritt` liefert den Abstand zweier Nachbarn oder `null` (kein Lauf). */
function packeFolgen(reihe: Record<string, string>, schritt: (a: string, b: string) => number | null): Record<string, string> {
  const nummern = Object.keys(reihe)
  if (!nummern.every((k) => /^\d+$/.test(k))) return reihe
  const k = nummern.map(Number).sort((a, b) => a - b)
  const aus: Record<string, string> = {}
  for (let i = 0; i < k.length; ) {
    let j = i
    const s = k[i + 1] === k[i] + 1 ? schritt(reihe[k[i]]!, reihe[k[i + 1]!]!) : null
    while (s !== null && k[j + 1] === k[j]! + 1 && schritt(reihe[k[j]!]!, reihe[k[j + 1]!]!) === s) j++
    aus[j > i ? `${k[i]}-${k[j]}` : String(k[i])] = j > i && s ? `${reihe[k[i]!]}+${s}` : reihe[k[i]!]!
    i = j + 1
  }
  return aus
}

function entpackeFolgen(reihe: Record<string, string>): Record<string, string> {
  const aus: Record<string, string> = {}
  for (const [schluessel, wert] of Object.entries(reihe)) {
    const lauf = /^(\d+)-(\d+)$/.exec(schluessel)
    if (!lauf) {
      aus[schluessel] = wert
      continue
    }
    const [, von, bis] = lauf
    const tag = TAG.exec(wert)
    for (let n = Number(von); n <= Number(bis); n++) aus[n] = tag && tag[2] ? addDays(tag[1]!, (n - Number(von)) * Number(tag[2])) : wert
  }
  return aus
}

const gleicheZeit = (a: string, b: string): number | null => (a === b ? 0 : null)
const abstandTage = (a: string, b: string): number | null => {
  const abstand = a.length === 10 && b.length === 10 && TAG.test(a) && TAG.test(b) ? tage(a, b) : -1
  return abstand >= 0 ? abstand : null
}

function packeRelease(release: Release): Release {
  const s = release.schedule
  if (!s || (!s.observed && !s.zeiten)) return release
  const schedule = { ...s }
  if (s.observed) schedule.observed = packeFolgen(s.observed, abstandTage)
  if (s.zeiten) schedule.zeiten = packeFolgen(s.zeiten, gleicheZeit)
  return { ...release, schedule }
}

/** Ändert das Release an Ort und Stelle: ein Kopieren (`{ ...release }`) läse jedes Feld, und die Lesepfad-Messung (`tools/kachel-felder-messen.mjs`) hielte es für gelesen. */
function entpackeRelease(release: Release): void {
  const s = release.schedule
  if (s?.observed) s.observed = entpackeFolgen(s.observed)
  if (s?.zeiten) s.zeiten = entpackeFolgen(s.zeiten)
}

function packeTermin(e: ReleaseEvent, releases: Release[]): Roh {
  const stelle = releases.findIndex((r) => r.slug === e.releaseSlug)
  const aus: Roh = { ...e }
  const plain = `${e.releaseSlug}@${e.date}`
  if (e.id === plain) delete aus.id
  else if (e.episode !== undefined && e.id === `${plain}#${e.episode}`) aus.id = '#'
  if (stelle < 0) return aus
  const release = releases[stelle] as unknown as Roh
  for (const f of VOM_RELEASE) {
    if (aus[f] === undefined) {
      if (release[f] !== undefined) aus[f] = null
    } else if (aus[f] === release[f]) delete aus[f]
  }
  delete aus.releaseSlug
  aus.r = stelle
  return aus
}

function entpackeTermin(p: Roh, releases: Release[]): ReleaseEvent {
  const { r, ...rest } = p
  const release = typeof r === 'number' ? (releases[r] as unknown as Roh) : undefined
  const slug = release ? (release.slug as string) : (rest.releaseSlug as string)
  const e: Roh = { ...rest, releaseSlug: slug }
  for (const f of VOM_RELEASE) {
    if (e[f] === null) delete e[f]
    else if (e[f] === undefined && release?.[f] !== undefined) e[f] = release[f]
  }
  const plain = `${slug}@${e.date}`
  if (e.id === undefined) e.id = plain
  else if (e.id === '#') e.id = `${plain}#${e.episode}`
  return e as unknown as ReleaseEvent
}

/** Die Kachel-Datei in Packform (Titel bleiben, wie sie sind). */
export function packeKachel(kachel: WochenDatei): WochenDatei {
  return { ...kachel, releases: kachel.releases.map(packeRelease), events: kachel.events.map((e) => packeTermin(e, kachel.releases) as unknown as ReleaseEvent) }
}

/** Gegenstück zu `packeKachel`; eine ungepackte Datei kommt unverändert heraus. Die Releases der übergebenen Datei werden dabei selbst ausgepackt. */
export function entpackeKachel(gepackt: WochenDatei): WochenDatei {
  const events = gepackt.events.map((p) => entpackeTermin(p as unknown as Roh, gepackt.releases))
  gepackt.releases.forEach(entpackeRelease)
  return { ...gepackt, events }
}
