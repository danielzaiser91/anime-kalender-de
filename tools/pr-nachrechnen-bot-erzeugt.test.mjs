/**
 * Wächter: Jeder Pfad unter `data/`, den ein Lauf schreiben darf (`QUELLEN`, tools/quellen-liste.sh), steht in `ERZEUGTE_DATEIEN` /
 * `ERZEUGTE_ORDNER` oder mit Grund in `ERZEUGT_AUSNAHMEN` (`pr-nachrechnen-bot-erzeugt.mjs`). Anlass: PR 4033, neue Bau-Ausgabe fehlte in der
 * Liste, jeder offene PR wäre „nicht aktuell“ geworden (16.11.2026). Die Schreibziele des Baus deckt `check-workflows.mjs` gegen `QUELLEN`
 * ab (ein Bau-Ziel ohne Eintrag dort scheitert dort), die Kette hier schließt die zweite Lücke. Pfade außerhalb `data/` sind andere Klassen
 * (`istDatenpfad`, Listen, Wache, Erweiterung in `pr-nachrechnen.mjs`).
 */
import { readFileSync } from 'node:fs'
import { ERZEUGT_AUSNAHMEN, ERZEUGTE_DATEIEN, ERZEUGTE_ORDNER, nichtErfasst } from './pr-nachrechnen-bot-erzeugt.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const skript = readFileSync(new URL('./quellen-liste.sh', import.meta.url), 'utf8')
const block = skript.match(/^QUELLEN=\(\n([\s\S]*?)\n\)/m)?.[1]
pruefe('QUELLEN-Block gefunden', block !== undefined)
const quellen = (block ?? '').split('\n').map((z) => z.trim()).filter((z) => z && !z.startsWith('#'))
const unterData = quellen.filter((p) => p.startsWith('data/'))
pruefe('QUELLEN enthält Pfade unter data/ (Parser liest)', unterData.length > 100, unterData.length)

// Echter Stand: nichts fällt durch.
const heute = nichtErfasst(quellen)
pruefe('kein geschriebener Pfad fehlt in ERZEUGTE_* oder ERZEUGT_AUSNAHMEN', heute.length === 0, heute)

// Roter Fall 1: Datei aus der Liste nehmen (Schlüssel aus der Liste selbst, nie ein Literal).
const erste = unterData.find((p) => ERZEUGTE_DATEIEN.includes(p.slice(5)))
pruefe('Probe: ein erzeugter Pfad aus QUELLEN gefunden', erste !== undefined)
const ohne = ERZEUGTE_DATEIEN.filter((d) => d !== erste?.slice(5))
pruefe('rot: Datei aus ERZEUGTE_DATEIEN genommen -> genau sie fällt durch', JSON.stringify(nichtErfasst(quellen, ohne)) === JSON.stringify([erste]), nichtErfasst(quellen, ohne))

// Roter Fall 2: Ausnahme streichen.
const eine = Object.keys(ERZEUGT_AUSNAHMEN)[0]
const weniger = Object.fromEntries(Object.entries(ERZEUGT_AUSNAHMEN).filter(([k]) => k !== eine))
pruefe('rot: Ausnahme gestrichen -> sie fällt durch', nichtErfasst(quellen, ERZEUGTE_DATEIEN, ERZEUGTE_ORDNER, weniger).includes(eine))

// Roter Fall 3: Ordner-Eintrag ohne Schrägstrich am Ende (QUELLEN schreibt Ordner so) wird über ERZEUGTE_ORDNER erkannt, ohne Ordnerliste nicht.
const ordnerPfad = unterData.find((p) => ERZEUGTE_ORDNER.includes(`${p}/`))
pruefe('Probe: ein Ordner-Eintrag aus QUELLEN gefunden', ordnerPfad !== undefined)
pruefe('rot: Ordnerliste leer -> Ordner fällt durch', nichtErfasst(quellen, ERZEUGTE_DATEIEN, []).includes(ordnerPfad))

// Neue, unbekannte Ausgabe.
pruefe('rot: unbekannte neue Datei fällt durch', JSON.stringify(nichtErfasst([...quellen, 'data/neue-bau-ausgabe-xyz.json'])) === JSON.stringify(['data/neue-bau-ausgabe-xyz.json']))

// Ausnahmen sind keine Karteileichen und kein Doppel: jede steht in QUELLEN, keine zugleich in der Positivliste, jede mit Grund.
pruefe('jede Ausnahme steht in QUELLEN', Object.keys(ERZEUGT_AUSNAHMEN).every((k) => quellen.includes(k)), Object.keys(ERZEUGT_AUSNAHMEN).filter((k) => !quellen.includes(k)))
pruefe('keine Ausnahme zugleich in ERZEUGTE_DATEIEN', Object.keys(ERZEUGT_AUSNAHMEN).every((k) => !ERZEUGTE_DATEIEN.includes(k.slice(5))))
pruefe('jede Ausnahme hat einen Grund', Object.values(ERZEUGT_AUSNAHMEN).every((g) => typeof g === 'string' && g.length > 3))

if (fehler.length) {
  console.error(`\n${fehler.length} Fall/Fälle rot`)
  process.exit(1)
}
console.log('\npr-nachrechnen-bot-erzeugt: alle Fälle grün')
