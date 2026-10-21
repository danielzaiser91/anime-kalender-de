/**
 * `tools/dub-belege-vereinen.mjs`: Ein Beleg landet höchstens einmal in der Datei, auch wenn er anders geschrieben ist.
 * Anlass (19.10.2026, Issue 1577): Der Bestandsbau scheiterte an „1 identische Doppel“, weil ein Kommentar hinter einem Block
 * den Textvergleich störte. Aufruf: node tools/dub-belege-vereinen.test.mjs [wurzel-ordner-fuer-temp-dateien]
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const skript = join(dirname(fileURLToPath(import.meta.url)), 'dub-belege-vereinen.mjs')
const dir = mkdtempSync(join(process.argv[2] ?? tmpdir(), 'belege-vereinen-'))

/** Ein Beleg; `art` ändert nur die Schreibweise (Anführungszeichen), nie den Inhalt. */
const beleg = (id, art = 'plain') => {
  const titel = art === 'plain' ? `title: Titel ${id}` : `title: "Titel ${id}"`
  const datum = "checkedAt: '2026-10-18'"
  return `- anilistId: ${id}\n  ${titel}\n  platform: netflix\n  dub: true\n  ${datum}\n`
}

/** Gelesene Belege; eine absichtlich kaputte Datei liefert keine. */
const lesbar = (text) => {
  try {
    return yaml.load(text) ?? []
  } catch {
    return []
  }
}

function vereine(name, fern, arbeit) {
  const f = join(dir, `${name}-fern.yaml`)
  const a = join(dir, `${name}-arbeit.yaml`)
  writeFileSync(f, fern)
  writeFileSync(a, arbeit)
  const r = spawnSync(process.execPath, [skript, f, a], { encoding: 'utf8', windowsHide: true })
  const text = readFileSync(f, 'utf8')
  const ids = lesbar(text).map((b) => b.anilistId)
  return { status: r.status, text, ids }
}

try {
  const kopf = '# Kopf\n\n'
  const fall1 = vereine(
    'kommentar',
    kopf + beleg(1) + '# --- Aus dem Browser gemeldet ---\n\n' + beleg(2),
    kopf + beleg(1) + '\n' + beleg(2),
  )
  pruefe('Kommentar hinter dem Block im Fernstand: Beleg nicht noch einmal ergänzt', fall1.ids.join() === '1,2', fall1.ids)

  const fall2 = vereine('doppelt', kopf + beleg(1), kopf + beleg(1) + '\n' + beleg(7) + '\n' + beleg(7))
  pruefe('doppelt im Arbeitsstand: nur einmal ergänzt', fall2.ids.join() === '1,7', fall2.ids)

  const fall3 = vereine('anders', kopf + beleg(1), kopf + beleg(1) + '\n' + beleg(8, 'plain') + '\n' + beleg(8, 'quoted'))
  pruefe('anders geschrieben, gleicher Inhalt: nur einmal ergänzt', fall3.ids.join() === '1,8', fall3.ids)

  const fall4 = vereine('im-fern-anders', kopf + beleg(1, 'quoted'), kopf + beleg(1, 'plain'))
  pruefe('im Fernstand anders geschrieben: nicht ergänzt', fall4.ids.join() === '1', fall4.ids)

  const fall5 = vereine('neu', kopf + beleg(1), kopf + beleg(1) + '\n' + beleg(9) + '\n' + beleg(10))
  pruefe(
    'wirklich neue Belege kommen hinter den Fernstand',
    fall5.ids.join() === '1,9,10' && fall5.text.startsWith(kopf + beleg(1)),
    fall5.ids,
  )
  pruefe(
    'Volltext: Fernstand, Leerzeile, die neuen Belege, kein Rest',
    fall5.text === kopf + beleg(1) + '\n' + beleg(9) + '\n' + beleg(10),
    fall5.text,
  )

  // A3: Der Abschnittskopf gehört zum Beleg dahinter und bleibt erhalten.
  const abschnitt = '# --- Aus dem Browser gemeldet, abgeholt am 2026-10-19 ---\n'
  const fall6 = vereine('kopf', kopf + beleg(1), kopf + beleg(1) + '\n' + abschnitt + '\n' + beleg(11) + '\n' + beleg(12))
  pruefe(
    'Abschnittskopf vor neuen Belegen wird mit ergänzt',
    fall6.text === kopf + beleg(1) + '\n' + abschnitt + '\n' + beleg(11) + '\n' + beleg(12),
    fall6.text,
  )
  const fall7 = vereine('kopf-bekannt', kopf + beleg(1), kopf + abschnitt + '\n' + beleg(1))
  pruefe('Kopf vor einem bekannten Beleg bleibt draußen, nichts ergänzt', fall7.text === kopf + beleg(1), fall7.text)

  // A2: Rückfallzweig von inhalt(): Blöcke, die nicht genau ein Beleg sind, gelten nach ihrem Text.
  const kaputt = '- anilistId: 5\n  title: [offen\n'
  const fall8 = vereine('kaputt', kopf + beleg(1) + '\n' + kaputt, kopf + beleg(1) + '\n' + kaputt)
  pruefe('nicht lesbarer Block in beiden Ständen: nichts angehängt, Datei unverändert', fall8.text === kopf + beleg(1) + '\n' + kaputt, fall8.text)
  const fall9 = vereine('kaputt-neu', kopf + beleg(1), kopf + beleg(1) + '\n' + kaputt)
  pruefe('nicht lesbarer neuer Block wird ergänzt', fall9.text === kopf + beleg(1) + '\n' + kaputt, fall9.text)
  const mehrteilig = beleg(1) + '- platform: prime\n  anilistId: 4\n  dub: true\n'
  const fall10 = vereine('mehrteilig', kopf + beleg(1), kopf + mehrteilig)
  pruefe('Block mit zwei Belegen: der zweite geht nicht verloren', fall10.ids.includes(4), fall10.ids)
  const fall11 = vereine('mehrteilig-bekannt', kopf + mehrteilig, kopf + mehrteilig)
  pruefe('Block mit zwei Belegen in beiden Ständen: nichts angehängt', fall11.text === kopf + mehrteilig, fall11.text)
  const kaputt2 = '- anilistId: 6\n  title: [anders\n'
  const fall12 = vereine('kaputt-verschieden', kopf + beleg(1) + '\n' + kaputt, kopf + beleg(1) + '\n' + kaputt2)
  pruefe('zwei verschiedene nicht lesbare Blöcke: der Arbeitsstand-Block wird ergänzt', fall12.text.includes('anilistId: 6'), fall12.text)
  const mehrteilig2 = beleg(1) + '- platform: prime\n  anilistId: 6\n  dub: true\n'
  const fall13 = vereine('mehrteilig-verschieden', kopf + mehrteilig, kopf + mehrteilig2)
  pruefe('zwei verschiedene Blöcke mit zwei Belegen: der neue wird ergänzt', fall13.ids.includes(6), fall13.ids)
  const fall14 = vereine('schluss', kopf + beleg(1), kopf + beleg(1) + '\n# Schluss ohne Beleg\n')
  pruefe('Kommentar am Dateiende ohne Beleg wird nicht ergänzt', fall14.text === kopf + beleg(1), fall14.text)
  const alle = [fall1, fall2, fall3, fall4, fall5, fall6, fall7, fall8, fall9, fall10, fall11, fall12, fall13, fall14]
  pruefe('Exit 0 in allen Fällen', alle.every((f) => f.status === 0))
} finally {
  rmSync(dir, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`${fehler.length} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('dub-belege-vereinen: alle Prüfungen bestanden')
