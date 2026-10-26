/** Test der Wache `check-cover-luecken-bestand.ts`: Logik mit Kulisse und Prozesslauf im Wegwerf-Ordner (kein Echtdatenzugriff). */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { pruefeCoverLuecken } from './lib/cover-luecken.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const bild = 'https://image.tmdb.org/t/p/w500/a.jpg'
const reihen = { '1': [{ id: 1, cover: bild }, { id: 10_021_148 }], '2': [{ id: 10_021_059 }] }
const datenbank = [{ id: 1, coverImage: bild }, { id: 10_021_148 }, { id: 10_000_005 }]
const r = (luecken: Record<string, string>) => pruefeCoverLuecken(reihen, datenbank, luecken)

const ohneListe = r({})
pruefe('ohne Liste: alle drei Einträge ohne Cover fehlen, sortiert, ohne Doppelte', JSON.stringify(ohneListe.fehlt) === '[10000005,10021059,10021148]' && ohneListe.veraltet.length === 0, ohneListe)
const teil = r({ '10021148': 'nicht-gefunden' })
pruefe('ein Eintrag auf der Liste: die anderen zwei fehlen weiter', JSON.stringify(teil.fehlt) === '[10000005,10021059]', teil)
const alle = r({ '10021148': 'a', '10021059': 'b', '10000005': 'c' })
pruefe('alle auf der Liste: nichts fehlt, nichts veraltet', alle.fehlt.length === 0 && alle.veraltet.length === 0, alle)
const genau1 = r({ '10021148': 'a', '10021059': 'b' })
pruefe('genau 1 fehlt: wird gemeldet', JSON.stringify(genau1.fehlt) === '[10000005]', genau1)
const veraltet = r({ '10021148': 'a', '10021059': 'b', '10000005': 'c', '1': 'x', '77': 'x' })
pruefe('Liste führt Kennung mit Cover (1) oder ohne jeden Eintrag (77): beide veraltet', JSON.stringify(veraltet.veraltet) === '[1,77]' && veraltet.fehlt.length === 0, veraltet)
const nurDatenbank = pruefeCoverLuecken({ '5': [{ id: 5 }] }, [{ id: 5, coverImage: bild }], {})
pruefe('Cover nur in der Datenbank, Reihe leer: Lücke (die Reihen-Kachel bliebe leer)', JSON.stringify(nurDatenbank.fehlt) === '[5]', nurDatenbank)
const nurReihe = pruefeCoverLuecken({ '5': [{ id: 5, cover: bild }] }, [{ id: 5 }], {})
pruefe('Cover nur in der Reihe, Datenbank leer: Lücke', JSON.stringify(nurReihe.fehlt) === '[5]', nurReihe)
const leererText = pruefeCoverLuecken({ '5': [{ id: 5, cover: '' }] }, [{ id: 5, coverImage: '' }], {})
pruefe('leere Adresse zählt als kein Cover', JSON.stringify(leererText.fehlt) === '[5]', leererText)
const leer = pruefeCoverLuecken({}, [], {})
pruefe('leere Eingaben: nichts', leer.fehlt.length === 0 && leer.veraltet.length === 0, leer)

const ordner = mkdtempSync(join(tmpdir(), 'cover-luecken-wache-'))
const skript = fileURLToPath(new URL('./check-cover-luecken-bestand.ts', import.meta.url))
function prozess(name: string, liste: string | null, reihenDatei: unknown, titel: unknown[]): { status: number; out: string; err: string } {
  const wurzel = join(ordner, name)
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'public/data'), { recursive: true })
  if (liste !== null) writeFileSync(join(wurzel, 'data', 'cover-luecken.json'), liste)
  writeFileSync(join(wurzel, 'public', 'data', 'franchises.json'), JSON.stringify(reihenDatei))
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titel))
  writeFileSync(join(wurzel, 'public', 'data', 'ohne-synchro.json'), JSON.stringify([]))
  const lauf = spawnSync(process.execPath, ['--import', 'tsx', skript, wurzel], { encoding: 'utf8', windowsHide: true })
  return { status: lauf.status ?? -1, out: lauf.stdout, err: lauf.stderr }
}
const gut = prozess('gut', '{"10021148":"nicht-gefunden"}', { '1': [{ id: 10_021_148 }] }, [{ id: 10_021_148 }])
pruefe('Prozess: gedeckt endet mit Exit 0 und ✓-Zeile', gut.status === 0 && gut.out.includes('✓ Cover: jeder Eintrag') && !gut.out.includes('WARNUNG'), gut)
const luecke = prozess('luecke', '{}', { '1': [{ id: 10_021_148 }] }, [{ id: 10_021_148 }])
pruefe('Prozess: Eintrag ohne Cover und ohne Liste endet mit Exit 0 und Zeile „⚠ WARNUNG Cover: 1 Eintrag“ mit Kennung', luecke.status === 0 && luecke.out.includes('⚠ WARNUNG Cover: 1 Eintrag') && luecke.out.includes('10021148') && !luecke.out.includes('✓'), luecke)
const elf = Array.from({ length: 11 }, (_, i) => ({ id: 10_000_001 + i }))
const viele = prozess('viele', '{}', { '1': elf }, [])
pruefe('Prozess: 11 Lücken nennen zehn Kennungen und „…“', viele.out.includes('11 Eintrag') && viele.out.includes('10000010, …') && !viele.out.includes('10000011'), viele)
const zehn = prozess('zehn', '{}', { '1': elf.slice(0, 10) }, [])
pruefe('Prozess: genau 10 Lücken nennen alle ohne „…“', zehn.out.includes('10000010') && !zehn.out.includes('…'), zehn)
const alt = prozess('alt', '{"1":"x"}', { '1': [{ id: 1, cover: bild }] }, [{ id: 1, coverImage: bild }])
pruefe('Prozess: veralteter Listeneintrag endet mit Exit 0 und Warnzeile', alt.status === 0 && alt.out.includes('⚠ WARNUNG Cover: 1 Kennung') && !alt.out.includes('✓'), alt)
const fehlt = prozess('fehlt', null, {}, [])
pruefe('Prozess: fehlende Liste endet mit Exit 1, Meldung auf stderr', fehlt.status === 1 && fehlt.err.includes('✖ Lückenliste') && fehlt.out === '', fehlt)
const kaputt = prozess('kaputt', '{kaputt', {}, [])
pruefe('Prozess: kaputte Liste endet mit Exit 1', kaputt.status === 1 && kaputt.err.includes('✖ Lückenliste'), kaputt)
const feldliste = prozess('feldliste', '[1,2]', {}, [])
pruefe('Prozess: Liste als Feld endet mit Exit 1', feldliste.status === 1 && feldliste.err.includes('✖ Lückenliste'), feldliste)

if (verletzt) {
  console.error(`check-cover-luecken-wache: ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-cover-luecken-wache: alle Zusicherungen halten (9 Logik-, 8 Prozessfälle)')
