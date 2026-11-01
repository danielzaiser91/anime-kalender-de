import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { istTag, pruefePatchnotes } from '../../shared/patchnotes.ts'
import { veralteterVorrat as warnungen, VORRAT_MAX_TAGE } from '../../tools/patchnotes-vorrat-alter.mjs'
import { lesePatchnotesDateien, PATCHNOTES_ORDNER, type PatchnotesDatei } from './patchnotes.ts'

/**
 * Vorrat: Patch-Notes-Entwürfe für PRs, deren Wirkung erst nach einem Lauf oder Bau sichtbar wird („Patch Notes: vertagt“).
 * Der Bau liest nur `data/patchnotes/*.yaml`, der Unterordner wird nicht ausgeliefert. Freigeben = die Datei in den Hauptordner
 * verschieben: Der Tag des Eintrags ist der Tag dieser Freigabe (Anlagetag der neuen Datei, `patchnotes-datum.ts`).
 */
export const VORRAT_UNTERORDNER = 'vorrat'
export { VORRAT_MAX_TAGE }
const VORRAT_FELDER = ['wartetAuf', 'seit'] as const

const vorratOrdner = (ordner: string): string => `${ordner}/${VORRAT_UNTERORDNER}`

/** Liest den Vorrat (ohne Unterordner: leer). */
export function leseVorrat(ordner = PATCHNOTES_ORDNER): PatchnotesDatei[] {
  return lesePatchnotesDateien(vorratOrdner(ordner))
}

/** Der Eintrag ohne die Vorrats-Felder: so, wie ihn die Auslieferung liest. */
function ohneVorratsfelder(eintrag: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(eintrag).filter(([k]) => !(VORRAT_FELDER as readonly string[]).includes(k)))
}

/** Widersprüche im Vorrat: Schema wie ein Eintrag, dazu `wartetAuf` (Text) und `seit` (Tag) Pflicht, kein `datum`, kein Namens- oder Textdoppel zum Hauptordner. */
export function pruefeVorrat(vorrat: PatchnotesDatei[], haupt: PatchnotesDatei[]): string[] {
  const fehler = pruefePatchnotes(vorrat.map((d) => ohneVorratsfelder(d.eintrag)), vorrat.map((d) => d.name))
  for (const d of vorrat) {
    const e = d.eintrag
    if (typeof e.wartetAuf !== 'string' || !e.wartetAuf.trim()) fehler.push(`${d.name}: wartetAuf fehlt (worauf wartet der Eintrag?)`)
    if (!istTag(e.seit)) fehler.push(`${d.name}: seit fehlt oder ist kein Tag (JJJJ-MM-TT, in Anführungszeichen)`)
    if (e.datum !== undefined) fehler.push(`${d.name}: im Vorrat kein datum (der Tag ist der Freigabetag)`)
    if (haupt.some((h) => h.name === d.name)) fehler.push(`${d.name}: gleicher Dateiname liegt schon im Hauptordner`)
    if (haupt.some((h) => h.eintrag.text === e.text)) fehler.push(`${d.name}: gleicher Text steht schon im Hauptordner („${String(e.text)}“)`)
  }
  return fehler
}

/** Warntexte für Einträge, die länger als `maxTage` im Vorrat liegen; die Regel steht dependency-frei in `tools/patchnotes-vorrat-alter.mjs` (die Wache läuft ohne `npm ci`). */
export function veralteterVorrat(vorrat: PatchnotesDatei[], heute: string, maxTage = VORRAT_MAX_TAGE): string[] {
  return warnungen(vorrat.map((d) => ({ name: d.name, seit: d.eintrag.seit as string | undefined, wartetAuf: d.eintrag.wartetAuf as string | undefined })), heute, maxTage)
}

/** Verschiebt einen Vorrats-Eintrag in den Hauptordner und streicht seine Vorrats-Felder. Der Tag ergibt sich beim Einchecken (Anlagetag der neuen Datei). */
export function gibFrei(name: string, ordner = PATCHNOTES_ORDNER): string {
  const von = `${vorratOrdner(ordner)}/${name}.yaml`
  const nach = `${ordner}/${name}.yaml`
  if (!existsSync(von)) throw new Error(`Vorrat: ${von} gibt es nicht`)
  if (existsSync(nach)) throw new Error(`Vorrat: ${nach} gibt es schon`)
  const eintrag = yaml.load(readFileSync(von, 'utf8'), { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>
  mkdirSync(ordner, { recursive: true })
  writeFileSync(nach, yaml.dump(ohneVorratsfelder(eintrag), { lineWidth: -1 }))
  rmSync(von)
  return nach
}
