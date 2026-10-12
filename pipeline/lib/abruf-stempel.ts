/**
 * **Abgeleitete Dateien nicht bei jedem Bau neu vom Worker holen** (12.10.2026,
 * `daniel-zum-abarbeiten/berichte/d1-umbau-entwurf-2026-10-12.md`, Maßnahme 2).
 *
 * `fetch-folgen-zuordnung.ts` und `fetch-urteile.ts` lesen jedes Mal alle Beobachtungen aus D1 (rund 72.000
 * Zeilen je Abruf, bis zu 40 Bauten am Tag). Beide Ergebnisse sind abgeleitet; der Bau braucht sie nur für den
 * Lückenschluss und das JustWatch-Vertrauen. Sie werden deshalb höchstens alle `FRISCH_STUNDEN` neu geholt, es sei denn
 * `--voll` steht auf der Kommandozeile.
 *
 * **Der Zeitpunkt steht in einer eigenen Datei, nicht in der Änderungszeit:** Ein CI-Lauf checkt frisch aus, jede Datei
 * wäre dort „gerade erzeugt". Die beiden Ergebnisdateien tragen selbst keinen Erzeugungszeitpunkt (nur den je Beobachtung).
 * Gestempelt wird nur, wenn der Abruf die Ergebnisdatei wirklich geschrieben hat (eine Störung des Workers ändert nichts).
 */
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, readJson, ROOT, writeJson } from './util.ts'

export const FRISCH_STUNDEN = 6

/** Ort der Stempel; `ABRUF_STEMPEL` verlegt ihn (Tests). */
const stempelDatei = () => process.env.ABRUF_STEMPEL ?? 'data/abruf-stempel.json'

type Stempel = Record<string, string>

/** Die Stempeldatei; fehlt sie oder ist sie kaputt, gibt es keine Stempel (der Abruf läuft dann, statt still zu unterbleiben). */
function leseStempel(): Stempel {
  try {
    return readJson<Stempel>(stempelDatei(), {})
  } catch {
    return {}
  }
}

/** Ist der letzte Abruf jünger als `stunden`? Ein fehlender, unlesbarer oder in der Zukunft liegender Stempel zählt als alt. */
export function istFrisch(name: string, jetzt: number, stunden = FRISCH_STUNDEN): boolean {
  const von = Date.parse(leseStempel()[name] ?? '')
  return Number.isFinite(von) && von <= jetzt && jetzt - von < stunden * 3_600_000
}

function stempeln(name: string, jetzt: number): void {
  writeJson(stempelDatei(), { ...leseStempel(), [name]: new Date(jetzt).toISOString() }, true)
}

/** Änderungszeit der Ergebnisdatei, 0 wenn es sie nicht gibt. */
const geschriebenUm = (ziel: string) => (existsSync(resolve(ROOT, ziel)) ? statSync(resolve(ROOT, ziel)).mtimeMs : 0)

/**
 * Führt `abruf` aus, außer der letzte Abruf von `name` ist frisch und `--voll` fehlt. Stempelt danach, wenn `ziel`
 * dabei neu geschrieben wurde. Mit `--aus` (Eingabe aus einer Datei, ohne Worker) wird nie übersprungen und nie gestempelt.
 */
export async function abrufMitStempel(name: string, ziel: string, abruf: () => Promise<void>, jetzt = Date.now()): Promise<void> {
  const lokal = process.argv.includes('--aus')
  if (!lokal && !process.argv.includes('--voll') && istFrisch(name, jetzt)) {
    log(`${ziel}: Abruf übersprungen — der letzte ist jünger als ${FRISCH_STUNDEN} Stunden (mit --voll erzwingen).`)
    return
  }
  const vorher = geschriebenUm(ziel)
  await abruf()
  if (!lokal && geschriebenUm(ziel) > vorher) stempeln(name, jetzt)
}
