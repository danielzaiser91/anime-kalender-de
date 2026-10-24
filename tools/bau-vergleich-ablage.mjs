/**
 * Ablage und Optionen von `tools/bau-vergleich.mjs`: Der Name der Ablage eines Baus trägt alles, was sein Ergebnis ändert
 * (Commit, Basis, Katalog-Datei, Umgebungsvariablen). Sonst vergliche ein Lauf gegen eine Basis, die mit anderer Einstellung
 * gebaut wurde (13.10.2026: `REIHEN_QUELLE=anilist` gegen eine Basis ohne), und ein Umbau am Katalogpfad meldete „gleich“,
 * ohne ihn je zu durchlaufen.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * Umgebungsvariablen, die das Ergebnis von `pipeline/build.ts` ändern (`REIHEN_QUELLE`: Reihenweg, `SITE_URL`: Adressen in Feeds und ICS,
 * `BAU_QUARANTAENE`: zurückgestellte Titel — der Name trägt den Pfad der Liste, nicht ihren Inhalt).
 */
export const BAU_UMGEBUNG = ['REIHEN_QUELLE', 'SITE_URL', 'BAU_QUARANTAENE']

export const KATALOG_DATEI = 'data/cache/anilist-katalog.json'

const kurz = (inhalt) => createHash('sha1').update(inhalt).digest('hex').slice(0, 10)

/** Kurze Werte bleiben lesbar, lange (Adressen) werden zum Hash. */
const dateiteil = (wert) => {
  const rein = wert.replace(/[^A-Za-z0-9.-]+/g, '_')
  return rein.length <= 24 ? rein : kurz(wert)
}

/** `-reihen_quelle-anilist` je gesetzter Variable aus `BAU_UMGEBUNG`; ohne gesetzte Variable leer (Ablagen von vor dem 13.10.2026 bleiben gültig). */
export const umgebungsMarke = (env) =>
  BAU_UMGEBUNG.filter((name) => env[name]).map((name) => `-${name.toLowerCase()}-${dateiteil(env[name])}`).join('')

/** Die Katalog-Datei nach Inhalt, nicht nach Größe: eine neu gezogene Datei gleicher Größe ist ein anderer Bau. */
export const katalogMarke = (pfad) => (pfad ? `-katalog${kurz(readFileSync(pfad))}` : '')

export const ablageName = (sha, basisSha, katalogPfad, env) =>
  `${sha.slice(0, 12)}-auf-${basisSha.slice(0, 12)}${sha === basisSha ? '' : '-delta'}${katalogMarke(katalogPfad)}${umgebungsMarke(env)}`

/**
 * `--katalog` (die Datei des Hauptordners, `data/cache/anilist-katalog.json`) oder `--katalog=<Pfad>`; ohne Option gilt
 * `BAU_VERGLEICH_KATALOG`. `positionen` sind Basis und Kandidat.
 */
export function liesOptionen(argv, env, hauptordner) {
  const option = argv.find((a) => a === '--katalog' || a.startsWith('--katalog='))
  const gewaehlt = option ? option.slice('--katalog='.length) || join(hauptordner, KATALOG_DATEI) : env.BAU_VERGLEICH_KATALOG
  const katalog = gewaehlt ? resolve(gewaehlt) : undefined
  if (katalog && !existsSync(katalog)) throw new Error(`Katalog-Datei fehlt: ${katalog}`)
  return { positionen: argv.filter((a) => !a.startsWith('--')), katalog }
}

/** Zeilen für den Anfang und das „gleich“: was die Ablage unterscheidet und was nicht mitgelaufen ist. */
export function einstellungsZeilen(katalogPfad, env) {
  const gesetzt = BAU_UMGEBUNG.filter((name) => env[name]).map((name) => `${name}=${env[name]}`)
  return [
    ...(gesetzt.length ? [`Umgebung des Baus: ${gesetzt.join(' ')}`] : []),
    katalogPfad
      ? `Katalog-Cache: ${katalogPfad}`
      : 'HINWEIS: ohne anilist-katalog.json im Ersatz-Cache — der Katalogpfad (ohne-synchro.json, Katalog-Reihen) läuft nicht mit; ein „gleich“ sagt dazu nichts. Mit --katalog bauen.',
  ]
}

/**
 * Hauptordner des Repos aus der Ausgabe von `git rev-parse --git-common-dir`: im Worktree ein absoluter Pfad `<Hauptordner>/.git`,
 * im Hauptordner selbst das relative `.git`. `startordner` ist der Ordner, in dem git gefragt wurde.
 */
export const hauptordnerAus = (gitCommonDir, startordner) => dirname(resolve(startordner, gitCommonDir))
