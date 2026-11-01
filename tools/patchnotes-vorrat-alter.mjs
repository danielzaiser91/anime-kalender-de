/**
 * Warnung der Wache (`tools/delta-pruefen.mjs`): Ein vertagter Patch-Notes-Entwurf (`data/patchnotes/vorrat/`) darf nicht liegen bleiben.
 * Die Wache läuft ohne `npm ci` (delta-wache.yml): diese Datei importiert nur `node:`-Module und liest `seit`/`wartetAuf` zeilenweise,
 * ohne YAML-Bibliothek. Die Schema-Prüfung der Einträge steht in `pipeline/lib/patchnotes-vorrat.ts`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { heuteBerlin } from './patchnotes-stempel-alter.mjs'

export const VORRAT_ORDNER = 'data/patchnotes/vorrat'
/** Mehr Tage darf ein Eintrag im Vorrat liegen, bevor die Wache warnt. */
export const VORRAT_MAX_TAGE = 7

const tagNummer = (tag) => Date.parse(`${tag}T00:00:00Z`) / 86400000
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/

/** Warntexte für Einträge `{ name, seit, wartetAuf }`, die länger als `maxTage` im Vorrat liegen, ältester zuerst. Ohne gültiges `seit` zählt ein Eintrag nicht (das meldet die Schema-Prüfung). */
export function veralteterVorrat(eintraege, heute, maxTage = VORRAT_MAX_TAGE) {
  return eintraege
    .filter((e) => ISO_TAG.test(e.seit ?? ''))
    .filter((e) => tagNummer(heute) - tagNummer(e.seit) > maxTage)
    .sort((a, b) => (a.seit < b.seit ? -1 : 1))
    .map((e) => `Patch Notes: ${e.name} liegt seit ${e.seit} im Vorrat (wartet auf: ${e.wartetAuf ?? ''}) – prüfen, ob die Wirkung live ist, dann freigeben`)
}

/** Liest `seit` und `wartetAuf` aus dem Text einer Vorrats-Datei (einzeilige Werte, wahlweise in Anführungszeichen). */
export function vorratFelder(name, text) {
  const wert = (feld) => new RegExp(`^${feld}:\\s*['"]?(.*?)['"]?\\s*$`, 'm').exec(text)?.[1]
  return { name, seit: wert('seit'), wartetAuf: wert('wartetAuf') }
}

/** Warnungen für den Vorrat im Ordner (relativ zum Arbeitsordner); ohne Ordner gibt es nichts zu warnen. */
export function vorratWarnungenAusOrdner(ordner = VORRAT_ORDNER, heute = heuteBerlin()) {
  if (!existsSync(ordner)) return []
  const eintraege = readdirSync(ordner)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => vorratFelder(f.slice(0, -'.yaml'.length), readFileSync(`${ordner}/${f}`, 'utf8')))
  return veralteterVorrat(eintraege, heute)
}
