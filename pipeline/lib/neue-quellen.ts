/**
 * Neue Beleg-Adressen eines PR: Welche Adressen in `sources`, `source` und `quelle` kommen gegenüber der Basis dazu,
 * und was folgt aus der Antwort? (PR 2628 trug eine UCI-Adresse ein, die 404 lieferte; alle Checks blieben grün.)
 *
 * Rot ist nur eine eindeutige Verneinung (404/410). 403, 429, 5xx, Zeitüberschreitung und Netzfehler sagen etwas über den
 * Weg, nicht über die Seite (Grundsatz wie in `pipeline/check-links.ts`).
 */
import { load } from 'js-yaml'

export type NeueQuelle = { datei: string; schluessel: string; adresse: string }
export type Urteil = 'ok' | 'tot' | 'nichtauskunft'

const QUELL_SCHLUESSEL = new Set(['sources', 'source', 'quelle'])

/** Hosts, die ohne Browser immer 403 liefern (Crunchyroll, ADN) oder nie abgerufen werden (aniSearch). */
const AUSGELASSEN = [/(^|\.)crunchyroll\.com$/, /(^|\.)animationdigitalnetwork\.(com|de)$/, /(^|\.)anisearch\.[a-z]+$/]

/** Ob eine Adresse nicht abgerufen wird: Ausnahme-Host oder keine http(s)-Adresse. */
export function wirdAusgelassen(adresse: string): boolean {
  let u: URL
  try {
    u = new URL(adresse)
  } catch {
    return true
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return true
  return AUSGELASSEN.some((r) => r.test(u.hostname))
}

function adressenVon(wert: unknown): string[] {
  const liste = Array.isArray(wert) ? wert : [wert]
  return liste.filter((a): a is string => typeof a === 'string' && /^https?:\/\//.test(a.trim())).map((a) => a.trim())
}

function laufe(knoten: unknown, pfad: string, aus: Map<string, string>): void {
  if (Array.isArray(knoten)) {
    knoten.forEach((k, i) => laufe(k, `${pfad}[${i}]`, aus))
    return
  }
  if (!knoten || typeof knoten !== 'object') return
  const objekt = knoten as Record<string, unknown>
  const name = typeof objekt.slug === 'string' ? objekt.slug : pfad
  for (const [schluessel, wert] of Object.entries(objekt)) {
    if (QUELL_SCHLUESSEL.has(schluessel)) {
      for (const a of adressenVon(wert)) if (!aus.has(a)) aus.set(a, `${name}.${schluessel}`)
    } else {
      laufe(wert, `${name}.${schluessel}`, aus)
    }
  }
}

/** Alle Beleg-Adressen eines YAML-Textes: Adresse → Schlüssel der ersten Fundstelle. */
export function quellenAusYaml(text: string | null): Map<string, string> {
  const aus = new Map<string, string>()
  if (text === null) return aus
  laufe(load(text), '', aus)
  return aus
}

/** Adressen, die der Kopf-Stand hat und der Basis-Stand nicht hatte (Basis `null` = Datei neu). */
export function neueQuellen(datei: string, basisText: string | null, kopfText: string): NeueQuelle[] {
  const basis = quellenAusYaml(basisText)
  const kopf = quellenAusYaml(kopfText)
  return [...kopf].filter(([adresse]) => !basis.has(adresse)).map(([adresse, schluessel]) => ({ datei, schluessel, adresse }))
}

/** Urteil aus dem Statuscode; `null` = kein Statuscode (Zeitüberschreitung, Netzfehler). */
export function urteilVon(status: number | null): Urteil {
  if (status === null) return 'nichtauskunft'
  if (status === 404 || status === 410) return 'tot'
  if (status >= 200 && status < 400) return 'ok'
  return 'nichtauskunft'
}

export type Befund = NeueQuelle & { urteil: Urteil | 'ausgelassen' | 'ungeprueft'; status: number | null }

/**
 * Ruft jede neue Adresse einmal ab (höchstens `maximal`, Rest `ungeprueft`); `abruf` liefert den Statuscode oder null.
 * Ausgelassene Hosts kosten keinen Abruf und zählen nicht gegen das Maximum.
 */
export async function pruefeQuellen(neue: NeueQuelle[], abruf: (adresse: string) => Promise<number | null>, maximal: number): Promise<Befund[]> {
  const befunde: Befund[] = []
  const gesehen = new Set<string>()
  let abgerufen = 0
  for (const n of neue) {
    if (gesehen.has(n.adresse)) continue
    gesehen.add(n.adresse)
    if (wirdAusgelassen(n.adresse)) {
      befunde.push({ ...n, urteil: 'ausgelassen', status: null })
    } else if (abgerufen >= maximal) {
      befunde.push({ ...n, urteil: 'ungeprueft', status: null })
    } else {
      abgerufen++
      const status = await abruf(n.adresse)
      befunde.push({ ...n, urteil: urteilVon(status), status })
    }
  }
  return befunde
}
