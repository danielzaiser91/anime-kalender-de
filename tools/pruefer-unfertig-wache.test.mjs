// Kennzahl „Prüfer sah unfertige Kette“: Tabellentest der reinen Funktionen, Abruffehler und die Verdrahtung in der Wachphase.
// Die Kommentartexte sind wörtlich die erste Zeile echter Urteile (Abruf 31.10.2026).
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { prueferZeilen, unfertigZeile, unfertigeKette, urteile } from './pruefer-unfertig-wache.mjs'

const BOT = 'github-actions[bot]'
const k = (titel, login = BOT) => ({ user: { login }, body: `**Prüfer-Review** für 03a88a18e - Urteil: **${titel}**\n\nProtokoll` })
const OK = k('ok')
const LAEUFT = k('ok, Checks laufen noch: PR-Prüfkette')
const ROT = k('ok, Checks rot: PR-Datenbau, PR-Prüfkette')
const AENDERN = k('aendern, Auflagen offen: Dirigent entscheidet')
const viele = (unfertig, gesamt) => Array.from({ length: gesamt }, (_, i) => (i < unfertig ? LAEUFT : OK))

let faelle = 0
const gleich = (name, ist, soll) => {
  assert.deepEqual(ist, soll, name)
  faelle++
}

// Auswahl: nur der Bot, nur die Urteilszeile, höchstens n
gleich('Urteilszeilen des Bots', urteile([OK, LAEUFT, ROT, AENDERN]), ['ok', 'ok, Checks laufen noch: PR-Prüfkette', 'ok, Checks rot: PR-Datenbau, PR-Prüfkette', 'aendern, Auflagen offen: Dirigent entscheidet'])
gleich('fremder Autor mit gleichem Text zählt nicht', urteile([k('ok', 'fremder'), OK]), ['ok'])
gleich('anderer Bot-Kommentar zählt nicht', urteile([{ user: { login: BOT }, body: '## Mutationsprobe für abc' }]), [])
gleich('Zeile muss am Textanfang stehen', urteile([{ user: { login: BOT }, body: 'Hallo\n**Prüfer-Review** für abc - Urteil: **ok**' }]), [])
gleich('ohne Text und ohne Nutzer', urteile([{}, { user: { login: BOT } }]), [])
gleich('höchstens n, die ersten (neuesten) zählen', urteile([OK, LAEUFT, ROT], 2), ['ok', 'ok, Checks laufen noch: PR-Prüfkette'])
gleich('Standard 30 Urteile', urteile(viele(0, 45)).length, 30)

// Zählung: nur „Checks laufen noch“ ist unfertig (rot, aendern, ok nicht)
gleich('leere Liste', unfertigeKette([]), { gesamt: 0, unfertig: 0, anteil: 0 })
gleich('rot und aendern sind nicht unfertig', unfertigeKette([ROT, AENDERN, OK]), { gesamt: 3, unfertig: 0, anteil: 0 })
gleich('2 von 5', unfertigeKette([LAEUFT, OK, LAEUFT, OK, OK]), { gesamt: 5, unfertig: 2, anteil: 0.4 })
gleich('älter als n zählt nicht', unfertigeKette([...viele(0, 30), LAEUFT, LAEUFT]).unfertig, 0)
gleich('Zähler im Fenster, nicht davor', unfertigeKette([LAEUFT, ...viele(0, 40)]).unfertig, 1)

// Schwelle: genau 10 %, eins darunter, deutlich darüber; Mindestprobe genau 10 und 9
const z = (u, g) => unfertigZeile(unfertigeKette(viele(u, g)))
gleich('3 von 30 = 10 % warnt', z(3, 30), 'PRUEFER: 3 von 30 Prüfer-Urteilen sahen eine unfertige Kette (10 %, Grenze 10 %)')
gleich('2 von 30 = 6,7 % warnt nicht', z(2, 30), null)
gleich('15 von 30 warnt', z(15, 30), 'PRUEFER: 15 von 30 Prüfer-Urteilen sahen eine unfertige Kette (50 %, Grenze 10 %)')
gleich('1 von 10 = 10 % warnt (Mindestprobe genau erreicht)', z(1, 10)?.startsWith('PRUEFER: 1 von 10'), true)
gleich('9 Urteile reichen nicht, auch bei 100 %', z(9, 9), null)
gleich('0 von 30 warnt nicht', z(0, 30), null)
gleich('0 Urteile warnt nicht', unfertigZeile({ gesamt: 0, unfertig: 0, anteil: 0 }), null)

// Abruf: Endpunkt, JSON, Fehlerarten
const aufrufe = []
const gh = (...a) => {
  aufrufe.push(a)
  return JSON.stringify(viele(6, 30))
}
gleich('Warnzeile aus dem Abruf', prueferZeilen(gh, 'o/r'), ['PRUEFER: 6 von 30 Prüfer-Urteilen sahen eine unfertige Kette (20 %, Grenze 10 %)'])
gleich('Abruf: genau ein gh-Aufruf auf die jüngsten Kommentare', aufrufe, [['api', 'repos/o/r/issues/comments?sort=created&direction=desc&per_page=100']])
gleich('ruhige Kette: keine Zeile', prueferZeilen(() => JSON.stringify(viele(0, 30)), 'o/r'), [])
gleich('Abruffehler: eigene Zeile, nur die erste Fehlerzeile', prueferZeilen(() => { throw new Error('gh: HTTP 503\nzweite Zeile') }, 'o/r'), ['PRUEFER? Prüfer-Urteile nicht lesbar: gh: HTTP 503'])
gleich('kaputtes JSON: eigene Zeile', prueferZeilen(() => 'kein json', 'o/r').length, 1)
gleich('kaputtes JSON: beginnt mit PRUEFER?', prueferZeilen(() => 'kein json', 'o/r')[0].startsWith('PRUEFER? '), true)
gleich('Antwort ist kein Array (Fehlerobjekt): eigene Zeile', prueferZeilen(() => '{"message":"Not Found"}', 'o/r')[0].startsWith('PRUEFER? '), true)

// Verdrahtung: die Wachphase ruft die Funktion wirklich auf (Prozess mit gh-Attrappe, die den Kopf-Hash des Tests liefert)
const { spawnSync } = await import('node:child_process')
const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
const { pathToFileURL } = await import('node:url')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')
const ordner = mkdtempSync(join(tmpdir(), 'pruefer-unfertig-'))
const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
const abruf = join(ordner, 'abruf-abgelehnt.mjs')
writeFileSync(abruf, "globalThis.fetch = async () => { throw new Error('offline') }\n")
const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
const SCHLUESSEL = 'api repos/danielzaiser91/anime-kalender-de/issues/comments?sort=created&direction=desc&per_page=100'
const starte = (antwort) => {
  writeFileSync(join(ordner, 'daten.json'), JSON.stringify({ [SCHLUESSEL]: antwort }))
  const env = { ...process.env, ATTRAPPE_LOG: join(ordner, 'log.txt'), ATTRAPPE_DATEN: join(ordner, 'daten.json'), LAUF_TOKEN: '' }
  const args = ['--import', vorlader, '--import', pathToFileURL(abruf).href, werkzeug, '--trocken', '--wurzel', ordner, '--gesundheit', join(ordner, 'fehlt.json')]
  return spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, timeout: 60_000, env })
}
const warnt = starte({ aus: JSON.stringify(viele(6, 30)) })
gleich('Prozess: Warnzeile steht in der Ausgabe der Wachphase', /^PRUEFER: 6 von 30 Prüfer-Urteilen sahen eine unfertige Kette \(20 %/m.test(warnt.stdout), true)
const ruhig = starte({ aus: JSON.stringify(viele(0, 30)) })
gleich('Prozess: ruhige Kette, keine PRUEFER-Zeile', /^PRUEFER/m.test(ruhig.stdout), false)
const kaputt = starte({ fehler: 'HTTP 502' })
gleich('Prozess: Abruffehler als PRUEFER?-Zeile', /^PRUEFER\? Prüfer-Urteile nicht lesbar: HTTP 502$/m.test(kaputt.stdout), true)
rmSync(ordner, { recursive: true, force: true })

console.log(`pruefer-unfertig-wache: ${faelle} Fälle grün (Tabelle, Schwelle 10 %/Mindestprobe 10, Abruffehler, Prozess)`)
