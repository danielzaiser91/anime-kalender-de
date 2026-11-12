/**
 * Die Titel hinter einem roten Wache-Befund: Zahlen allein ("netflix: 13 Synchro-Belege weniger") ließen am 26.10.–06.11.2026
 * nicht erkennen, dass Naruto Shippuden, Made in Abyss u. a. zu Unrecht ihre Streams verloren. Reine Funktionen ohne Dateizugriff
 * und ohne `js-yaml`: `delta-pruefen.mjs` läuft in `delta-wache.yml` ohne `npm ci`.
 */
import { anzeigeName } from '../../shared/titles.ts'
import type { Title } from '../../shared/types.ts'
import { sperrKern } from './sperr-kern.ts'

type Bestand = Pick<Title, 'id' | 'titleDe' | 'titleEn' | 'titleRomaji' | 'streams'>

/** Höchstens so viele Titelzeilen stehen im Befund; der Rest wird gezählt. */
export const HOECHSTENS_ZEILEN = 20

const schluessel = (platform: string, url: string | undefined): string => `${platform}|${sperrKern(url)}`

/** Der Parameterteil: bei ADN steht die Staffel dort (`?s=3`), `sperrKern` schneidet ihn ab. */
const parameter = (url: string | undefined): string => (url ?? '').split('?')[1]?.toLowerCase() ?? ''

/**
 * Der andere Titel, der dieselbe Adresse beim selben Anbieter mit Synchro-Urteil Ja führt (Weg verschoben, nicht verloren; Sailor Moon S=3,
 * 10.11.2026). Der Parameterteil zählt mit: Hält ein Titel nur `?s=1` derselben Serie, ist `?s=3` nicht verschoben.
 */
export function andererBesitzer(jetzt: readonly Bestand[], platform: string, url: string | undefined, ausserId: number): Bestand | undefined {
  const gesucht = schluessel(platform, url)
  const passt = (n: NonNullable<Bestand['streams']>[number]) => n.dub === true && schluessel(n.platform, n.url) === gesucht && parameter(n.url) === parameter(url)
  return jetzt.find((t) => t.id !== ausserId && (t.streams ?? []).some(passt))
}

/**
 * Was seit `vorher` einem Titel fehlt: der Titel selbst, ein Synchro-Beleg (`dub === true`), dessen Weg weg ist, oder dessen Urteil
 * nicht mehr Ja ist. `befundZu` liefert je Adresse einen Zusatz (z. B. den link-check-Status).
 */
export function betroffeneZeilen(vorher: readonly Bestand[], jetzt: readonly Bestand[], befundZu: (url: string) => string | undefined = () => undefined): string[] {
  const neu = new Map(jetzt.map((t) => [t.id, t]))
  const zeilen: string[] = []
  for (const t of vorher) {
    const name = `${anzeigeName(t)} (${t.id})`
    const nun = neu.get(t.id)
    if (!nun) {
      zeilen.push(`${name} · Titel entfernt`)
      continue
    }
    for (const s of t.streams ?? []) {
      if (s.dub !== true) continue
      const rest = (nun.streams ?? []).find((n) => schluessel(n.platform, n.url) === schluessel(s.platform, s.url))
      const zusatz = befundZu(s.url)
      const grund = zusatz ? ` (${zusatz})` : ''
      const neuer = rest ? undefined : andererBesitzer(jetzt, s.platform, s.url, t.id)
      if (neuer) zeilen.push(`${name} · ${s.platform} · Synchro-Beleg verschoben zu ${anzeigeName(neuer)} (${neuer.id})`)
      else if (!rest) zeilen.push(`${name} · ${s.platform} · Synchro-Beleg weg${grund}`)
      else if (rest.dub !== true) zeilen.push(`${name} · ${s.platform} · Synchro-Urteil jetzt ${rest.dub === false ? 'Nein' : 'offen'}${grund}`)
    }
  }
  return zeilen
}

/** Die ersten `max` Zeilen, danach „… und N weitere“. */
export function kuerzeZeilen(zeilen: readonly string[], max = HOECHSTENS_ZEILEN): string[] {
  if (zeilen.length <= max) return [...zeilen]
  return [...zeilen.slice(0, max), `… und ${zeilen.length - max} weitere`]
}

/** Die eingerückten Ausgabezeilen der Wache für eine Historie-Zeile; nur bei einem roten Befund, sonst leer. */
export function betroffenAusgabe(zeile: { betroffen?: unknown }, rot: boolean): string[] {
  if (!rot || !Array.isArray(zeile.betroffen)) return []
  return zeile.betroffen.filter((z): z is string => typeof z === 'string').map((z) => `${' '.repeat(15)}• ${z}`)
}
