/**
 * Prozesstest zu `check-anbieter-eintraege-bestand.ts`: der Wächter läuft als eigener Prozess gegen eine Wegwerf-Wurzel (`AK_ROOT`).
 * Ein toter oder zu weiter Eintrag macht ihn rot (Exit 1, Fehlerzeile, VERSTÖSSE), ein passender oder die leere Vorgabe nicht.
 * Aufruf: npm run check:bestand oder `tsx pipeline/check-anbieter-eintraege-bestand-lauf.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const repo = fileURLToPath(new URL('..', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'anbieter-eintraege-'))
const ausgabeOrdner = join(wurzel, 'public', 'data')
mkdirSync(ausgabeOrdner, { recursive: true })
const release = (slug: string, titleId: number, platform = 'crunchyroll') => ({ slug, titleId, platform })
const schreibe = (name: string, inhalt: unknown): void => writeFileSync(join(wurzel, name), JSON.stringify(inhalt))
const bestand = (releases: unknown[]): void => writeFileSync(join(ausgabeOrdner, 'releases.json'), JSON.stringify(releases))

function lauf(args: string[]): { status: number | null; ausgabe: string } {
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-anbieter-eintraege-bestand.ts'), ...args], {
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}

try {
  bestand([release('a', 1), release('b', 2)])
  schreibe('eintraege.json', { '1:crunchyroll': 'Grund' })
  const gut = lauf(['--eintraege=eintraege.json'])
  pruefe('ein Eintrag mit genau einem Release: Exit 0, Ergebniszeile nennt 1 Eintrag gegen 2 Releases', gut.status === 0 && gut.ausgabe.includes('1 Einträge gegen 2 Releases geprüft') && gut.ausgabe.includes('VERSTÖSSE: 0'), gut.ausgabe)
  const vorgabe = lauf([])
  pruefe('ohne Eintragsdatei gilt die leere Vorgabe: Exit 0, 0 Einträge', vorgabe.status === 0 && vorgabe.ausgabe.includes('0 Einträge gegen 2 Releases geprüft'), vorgabe.ausgabe)

  schreibe('tot.json', { '1:crunchyroll': 'Grund', '99:crunchyroll': 'Grund' })
  const tot = lauf(['--eintraege=tot.json'])
  pruefe('toter Eintrag: Exit 1, Fehlerzeile mit Schlüssel, VERSTÖSSE: 1', tot.status === 1 && tot.ausgabe.includes('"99:crunchyroll": kein Release im Bestand (Eintrag tot)') && tot.ausgabe.includes('VERSTÖSSE: 1'), tot.ausgabe)

  bestand([release('a', 1), release('b', 1), release('c', 2)])
  const weit = lauf(['--eintraege=eintraege.json'])
  pruefe('toter Eintrag trägt eine Marke auf seine Titelkennung 99', tot.ausgabe.includes('QUARANTAENE {"titleId":99,"pruefung":"anbieter-eintraege-bestand"'), tot.ausgabe)
  pruefe('zu weiter Eintrag trägt eine Marke auf Titelkennung 1', weit.ausgabe.includes('QUARANTAENE {"titleId":1,"pruefung":"anbieter-eintraege-bestand"'), weit.ausgabe)
  pruefe('ohne Verstoß keine Marke', !gut.ausgabe.includes('QUARANTAENE') && !vorgabe.ausgabe.includes('QUARANTAENE'), gut.ausgabe)
  pruefe('Eintrag mit zwei Releases (zwei Cours): Exit 1, „zu weit“', weit.status === 1 && weit.ausgabe.includes('"1:crunchyroll": trifft 2 Releases (Eintrag zu weit)'), weit.ausgabe)

  rmSync(join(ausgabeOrdner, 'releases.json'))
  const ohneDatei = lauf(['--eintraege=eintraege.json'])
  pruefe('fehlende Releases-Datei: Exit 1, nicht stillschweigend grün', ohneDatei.status === 1 && ohneDatei.ausgabe.includes('VERSTÖSSE: 1'), ohneDatei.ausgabe)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAnbieterdatum-Wächter: 5 Prozessfälle (Gut, Vorgabe, tot, zu weit, Datei fehlt) samt Marken halten.')
process.exit(verletzt ? 1 : 0)
