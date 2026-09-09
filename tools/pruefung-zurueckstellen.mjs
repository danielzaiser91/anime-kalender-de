#!/usr/bin/env node
/**
 * **Einen Titel wieder zur Prüfung geben — ohne Konsolenbefehl im Browser.**
 *
 * Daniel am 09.09.2026: „mach das die prüfliste synchron ist … sodass du
 * einträge beliebig zur prüfung geben kannst, ich will keine console commands
 * bei mir lokal ausführen."
 *
 * Die Prüfliste der Erweiterung entscheidet über den Briefkasten: Was dort als
 * gemeldet steht, ist erledigt. Eine Meldung zu verwerfen öffnet den Auftrag
 * also wieder — seit Erweiterung 4.16.6 auch dann, wenn in Daniels Browser noch
 * ein lokaler Vermerk liegt (der wird beim nächsten Abgleich weggeworfen).
 *
 * Aufruf (Token aus `my_secrets.md`, Eintrag „Laufstatus-Token"):
 *
 *     LAUF_TOKEN=… node tools/pruefung-zurueckstellen.mjs --offen
 *     LAUF_TOKEN=… node tools/pruefung-zurueckstellen.mjs --suche "Relight"
 *     LAUF_TOKEN=… node tools/pruefung-zurueckstellen.mjs --zurueck 4319,4325
 *     LAUF_TOKEN=… node tools/pruefung-zurueckstellen.mjs --zurueck-adresse "https://…"
 *
 * `--trocken` zeigt nur, was geschähe.
 *
 * **Was das Werkzeug nicht tut:** einen Handbeleg aus
 * `data/dub-confirmed.yaml` entfernen. Wurde eine Meldung schon in den Bestand
 * eingearbeitet, steht das Urteil dort — und ein Beleg wird von Hand
 * zurückgenommen, mit Begründung im Commit. Das Werkzeug sagt, wenn es einen
 * findet.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRIEFKASTEN = 'https://newsletter.animekalender.workers.dev/pruefung'
const TOKEN = process.env.LAUF_TOKEN ?? ''
if (!TOKEN) {
  console.error('LAUF_TOKEN fehlt — steht in ai helper files/my_secrets.md.')
  process.exit(1)
}

const argumente = process.argv.slice(2)
const trocken = argumente.includes('--trocken')
const wert = (name) => {
  const i = argumente.indexOf(name)
  return i >= 0 ? argumente[i + 1] : null
}

async function offene() {
  const antwort = await fetch(`${BRIEFKASTEN}?token=${TOKEN}`)
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`)
  const { pruefungen } = await antwort.json()
  return pruefungen ?? []
}

/** Steht zu dieser Adresse schon ein Urteil im Bestand? */
function handbelegZu(url) {
  try {
    const text = readFileSync(join(WURZEL, 'data/dub-confirmed.yaml'), 'utf8')
    const kern = String(url).replace(/^https?:\/\/(www\.)?/, '').split('?')[0]
    return text.split(/\n(?=- )/).filter((block) => block.includes(kern))
  } catch {
    return []
  }
}

function zeile(m) {
  const url = decodeURIComponent(m.url ?? '').replace('https://www.amazon.de/', '')
  return `${String(m.id).padEnd(6)} ${(m.gemeldet_am ?? '').slice(0, 16)}  ${(m.befund ?? '').padEnd(9)} ${(m.titel ?? '').slice(0, 34).padEnd(34)} ${m.seiten_kennung ?? ''}\n       ${url.slice(0, 96)}`
}

const liste = await offene()

if (argumente.includes('--offen')) {
  console.log(`${liste.length} Meldungen im Briefkasten, noch nicht übernommen:\n`)
  for (const m of liste) console.log(zeile(m))
  process.exit(0)
}

const suche = wert('--suche')
if (suche) {
  const treffer = liste.filter((m) => JSON.stringify(m).toLowerCase().includes(suche.toLowerCase()))
  console.log(`${treffer.length} von ${liste.length} passen auf „${suche}":\n`)
  for (const m of treffer) console.log(zeile(m))
  process.exit(0)
}

const ids = wert('--zurueck')
const adresse = wert('--zurueck-adresse')
if (!ids && !adresse) {
  console.error('Erwartet: --offen, --suche <text>, --zurueck <ids> oder --zurueck-adresse <url>')
  process.exit(1)
}

const rumpf = ids
  ? { ids: ids.split(',').map((n) => Number(n.trim())).filter(Boolean) }
  : { url: adresse }

/* Erst zeigen, was getroffen wird — ein Löschbefehl ohne Vorschau ist eine Falle. */
const betroffen = ids
  ? liste.filter((m) => rumpf.ids.includes(m.id))
  : liste.filter((m) => m.url === adresse)
console.log(`Trifft ${betroffen.length} offene Meldung(en):\n`)
for (const m of betroffen) console.log(zeile(m))

for (const m of betroffen) {
  const belege = handbelegZu(m.url)
  if (belege.length) {
    console.log(`\n  ⚠ Zu ${m.titel} steht bereits ein Handbeleg in data/dub-confirmed.yaml:`)
    for (const b of belege.slice(0, 2)) console.log('    ' + b.trim().split('\n').slice(0, 4).join('\n    '))
    console.log('    Der bleibt stehen — er wird von Hand zurückgenommen, mit Begründung im Commit.')
  }
}

if (trocken) {
  console.log('\n--trocken: nichts gelöscht.')
  process.exit(0)
}

const antwort = await fetch(BRIEFKASTEN, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
  body: JSON.stringify(rumpf),
})
const ergebnis = await antwort.json()
console.log(`\nGelöscht: ${ergebnis.geloescht ?? 0} (HTTP ${antwort.status})`)
console.log('Die Erweiterung sieht den Auftrag beim nächsten Abgleich wieder — ohne Zutun.')
