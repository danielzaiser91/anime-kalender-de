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
      if (!rest) zeilen.push(`${name} · ${s.platform} · Synchro-Beleg weg${grund}`)
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
