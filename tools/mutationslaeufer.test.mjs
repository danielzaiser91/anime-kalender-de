// Test für tools/mutationslaeufer.mjs. Aufruf: node tools/mutationslaeufer.test.mjs [läufer.mjs]
// Wegwerf-Dateien unter os.tmpdir(); der Läufer ist als eigener Prozess aufgerufen (Exit-Code, Zurücksetzen).
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beiSignal, normalisierePfad, planeMutant, registriereSignale, SIGNALE } from "./mutationslaeufer.mjs"

const hier = dirname(fileURLToPath(import.meta.url))
const laeufer = process.argv[2] ?? join(hier, "mutationslaeufer.mjs")
const ordner = mkdtempSync(join(tmpdir(), "mutlaeufer-test-"))
const knoten = `"${process.execPath}"`

// BOM, CRLF, Umlaut und doppelte Zeile: bytegleiches Zurücksetzen, n-tes Vorkommen, mehrzeilig.
const A = "\uFEFFexport const A = 1 // Größe\r\nexport function f() {\r\n  return 1\r\n}\r\nexport function g() {\r\n  return 1\r\n}\r\n"
const B = "export const B = 1\n"
const TEST = `import { A, g } from "./a.mjs"
import { B } from "./b.mjs"
import * as a from "./a.mjs"
if (g() !== 1) process.exit(1)
if (A === 0 && B === 0) process.exit(1)
if (a.ENDE) process.exit(1)
`
const TEST_F = 'import { f } from "./a.mjs"\nif (f() !== 1) process.exit(1)\n'
writeFileSync(join(ordner, "test.mjs"), TEST)
writeFileSync(join(ordner, "test-f.mjs"), TEST_F)
const dateien = { "a.mjs": A, "b.mjs": B }
for (const [n, t] of Object.entries(dateien)) writeFileSync(join(ordner, n), t)

function lauf(mutanten, extra = [], tests = [`${knoten} test.mjs`]) {
  const liste = join(ordner, "m.json")
  writeFileSync(liste, JSON.stringify(mutanten))
  const args = [laeufer, liste, "--cwd", ordner, "--timeout", "20", ...tests.flatMap((t) => ["--test", t]), ...extra]
  const r = spawnSync(process.execPath, args, { encoding: "utf8", stdin: "ignore", windowsHide: true })
  return { exit: r.status, aus: r.stdout + r.stderr }
}

function unversehrt() {
  for (const [n, t] of Object.entries(dateien)) {
    assert.equal(readFileSync(join(ordner, n), "utf8"), t, `${n} nicht zurückgesetzt`)
    assert.ok(!existsSync(join(ordner, `${n}.mutlauf-orig`)), `${n}: Sicherungskopie übrig`)
  }
}

const zeile = (aus, name) => aus.split("\n").find((z) => z.includes(name)) ?? ""
const urteilVon = (aus, name) => zeile(aus, name).split(/\s+/)[0]
const mut = [
  { name: "plain", datei: "a.mjs", suche: "return 1\r\n}\r\nexport function g", ersetze: "return 2\r\n}\r\nexport function g" },
  { name: "mehrzeilig", datei: "a.mjs", suche: "export function g() {\n  return 1\n}", ersetze: "export function g() {\n  return 2\n}" },
  { name: "zweites", datei: "a.mjs", suche: "return 1", ersetze: "return 2", nr: 2 },
  { name: "zeile6", datei: "a.mjs", suche: "return 1", ersetze: "return 2", zeile: 6 },
  { name: "zeile3-g-egal", datei: "a.mjs", suche: "return 1", ersetze: "return 2", zeile: 3 },
  { name: "doppelt", datei: "a.mjs", suche: "return 1", ersetze: "return 2" },
  { name: "fehlt", datei: "a.mjs", suche: "gibt es nicht", ersetze: "x" },
  { name: "nr3", datei: "a.mjs", suche: "return 1", ersetze: "return 2", nr: 3 },
  { name: "nichts", datei: "a.mjs", suche: "return 1", ersetze: "return 1", nr: 1 },
  { name: "nur-A", datei: "a.mjs", suche: "A = 1", ersetze: "A = 0" },
  { name: "nur-B", datei: "b.mjs", suche: "B = 1", ersetze: "B = 0" },
  { name: "beide", aenderungen: [{ datei: "a.mjs", suche: "A = 1", ersetze: "A = 0" }, { datei: "b.mjs", suche: "B = 1", ersetze: "B = 0" }] },
  { name: "anhang", datei: "a.mjs", suche: "@ENDE", ersetze: "export const ENDE = 1" },
  { name: "Kontrolle", aenderungen: [] },
]

// 1. Urteile je Form; Exit 1, weil es Überlebende gibt.
const r1 = lauf(mut)
assert.equal(r1.exit, 1, r1.aus)
const erwartet = {
  plain: "GRÜN", // f() wird vom Test nur über test-f geprüft, hier unentdeckt
  mehrzeilig: "rot",
  zweites: "rot",
  zeile6: "rot",
  "zeile3-g-egal": "GRÜN",
  doppelt: "mehrdeutig",
  fehlt: "nicht",
  nr3: "nicht",
  nichts: "wirkungslos",
  "nur-A": "GRÜN",
  "nur-B": "GRÜN",
  beide: "rot",
  anhang: "rot",
  Kontrolle: "GRÜN",
}
for (const [name, urteil] of Object.entries(erwartet)) assert.equal(urteilVon(r1.aus, name), urteil, `${name}: ${zeile(r1.aus, name)}`)
unversehrt()

// 2. Alle rot (und Kontrolle grün): Exit 0; Test je Mutant überschreibt --test.
const gut = [mut[1], mut[2], mut[11], { ...mut[0], name: "plain-mit-test-f", tests: [`${knoten} test-f.mjs`] }, mut[13]]
const r2 = lauf(gut)
assert.equal(r2.exit, 0, r2.aus)
assert.match(zeile(r2.aus, "plain-mit-test-f"), /^rot/)
unversehrt()

// 3. Log: Diff mit Datei:Zeile, Tabelle für den PR, Test des Fängers.
const logOrdner = join(ordner, "log")
const r3 = lauf([mut[2], mut[11]], ["--log", logOrdner])
assert.equal(r3.exit, 0, r3.aus)
const dateienLog = readdirSync(logOrdner).sort()
assert.deepEqual(dateienLog, ["01-zweites.diff", "01-zweites.log", "02-beide.diff", "02-beide.log", "tabelle.md"])
assert.match(readFileSync(join(logOrdner, "01-zweites.diff"), "utf8"), /^@@ a\.mjs:6\n- return 1\n\+ return 2\n$/)
assert.match(readFileSync(join(logOrdner, "02-beide.diff"), "utf8"), /@@ a\.mjs:1[\s\S]*@@ b\.mjs:1/)
const md = readFileSync(join(logOrdner, "tabelle.md"), "utf8")
assert.match(md, /\| 2 \| beide \| a\.mjs, b\.mjs \| rot \(Exit 1\) \| .*test\.mjs/)
unversehrt()

// 4. Rest eines toten Laufs verweigert den Start und lässt die Dateien in Ruhe.
writeFileSync(join(ordner, "b.mjs.mutlauf-orig"), B)
const r4 = lauf([mut[10]])
assert.equal(r4.exit, 2, r4.aus)
assert.match(r4.aus, /Rest eines abgebrochenen Laufs/)
rmSync(join(ordner, "b.mjs.mutlauf-orig"))
unversehrt()

// 5. Grundlauf rot und fehlender Testbefehl: Exit 2, nichts verändert.
writeFileSync(join(ordner, "kaputt.mjs"), "process.exit(1)\n")
assert.equal(lauf([mut[2]], [], [`${knoten} kaputt.mjs`]).exit, 2)
assert.equal(lauf([mut[2]], [], []).exit, 2)
unversehrt()

// 6. Pfade: Git-Bash-Form nur unter Windows umgesetzt, relative und Slash-Pfade gegen --cwd.
assert.equal(normalisierePfad("/c/code/x.ts", "/egal", "win32").replace(/\\/g, "/"), "C:/code/x.ts")
assert.equal(normalisierePfad("/c/code/x.ts", "/egal", "linux").replace(/\\/g, "/").endsWith("/c/code/x.ts"), true)
assert.equal(normalisierePfad("sub/x.ts", ordner, "win32"), join(ordner, "sub", "x.ts"))
const bashForm = process.platform === "win32" ? `/${ordner[0].toLowerCase()}${ordner.slice(2).replace(/\\/g, "/")}/a.mjs` : join(ordner, "a.mjs")
const r6 = lauf([{ name: "bash-pfad", datei: bashForm, suche: "A = 1", ersetze: "A = 0" }, { name: "b", datei: "b.mjs", suche: "B = 1", ersetze: "B = 0" }])
assert.equal(urteilVon(r6.aus, "bash-pfad"), "GRÜN", r6.aus)
unversehrt()

// 7. Mehrere Änderungen einer Datei beziehen sich aufs Original (kürzere/längere Ersetzung verschiebt nichts); Überlappung ist unbrauchbar.
const roh = Buffer.from("aaa\nbbb\nccc\n")
const mapX = () => new Map([[normalisierePfad("x", "/w"), roh]])
const plan = planeMutant(
  { aenderungen: [{ datei: "x", suche: "aaa", ersetze: "a" }, { datei: "x", suche: "ccc", ersetze: "cccccc" }, { datei: "x", suche: "bbb", ersetze: "" }] },
  mapX(),
  "/w",
)
assert.equal([...plan.texte.values()][0], "a\n\ncccccc\n")
const lap = planeMutant({ aenderungen: [{ datei: "x", suche: "aaa\nb", ersetze: "1" }, { datei: "x", suche: "a\nbbb", ersetze: "2" }] }, mapX(), "/w")
assert.equal(lap.urteil, "nicht gefunden")
assert.match(lap.detail, /überlappen/)

// 8. Meldungen der Anker und Anhängen an eine Datei ohne Schlusszeilenumbruch.
const ohneNl = new Map([[normalisierePfad("y", "/w"), Buffer.from("abc")]])
const anhang = planeMutant({ aenderungen: [{ datei: "y", suche: "@ENDE", ersetze: "d" }] }, ohneNl, "/w")
assert.equal([...anhang.texte.values()][0], "abc\nd\n")
const fehltZeile = planeMutant({ aenderungen: [{ datei: "y", suche: "abc", ersetze: "d", zeile: 99 }] }, ohneNl, "/w")
assert.equal(fehltZeile.detail, "y: nicht gefunden auf Zeile 99")
assert.equal(planeMutant({ aenderungen: [{ datei: "y", suche: "xyz", ersetze: "d" }] }, ohneNl, "/w").detail, "y: nicht gefunden")

// 9. Laufzeit: Sicherungskopie liegt während des Mutanten da; Grundlauf prüft auch die Tests je Mutant; Zeitlimit tötet den Test;
// leere suche und --timeout 0 sind Aufruffehler.
writeFileSync(join(ordner, "kopie-da.mjs"), `import { readFileSync } from "node:fs"\nif (readFileSync("a.mjs.mutlauf-orig", "utf8") !== ${JSON.stringify(A)}) process.exit(1)\n`)
const mitKopie = lauf([{ ...mut[9], name: "kopie", tests: [`${knoten} kopie-da.mjs`] }], [], [])
assert.equal(urteilVon(mitKopie.aus, "kopie"), "GRÜN", mitKopie.aus)
assert.equal(lauf([{ ...mut[9], tests: [`${knoten} kaputt.mjs`] }], [], []).exit, 2)
const haengt = 'import { readFileSync, writeFileSync } from "node:fs"\nif (readFileSync("a.mjs", "utf8").includes("A = 0")) setTimeout(() => writeFileSync("fertig.txt", "x"), 4000)\n'
writeFileSync(join(ordner, "haengt.mjs"), haengt)
const lang = lauf([mut[9]], ["--timeout", "2"], [`${knoten} haengt.mjs`])
assert.match(zeile(lang.aus, "nur-A"), /^rot\s+nur-A \(Zeitlimit\)/, lang.aus)
assert.ok(!existsSync(join(ordner, "fertig.txt")), "Testprozess wurde nicht beendet")
unversehrt()
const leer = lauf([{ name: "leer", datei: "a.mjs", suche: "", ersetze: "x" }])
assert.equal(leer.exit, 2)
assert.match(leer.aus, /datei\/suche\/ersetze fehlen/)
const nullZeit = lauf([mut[9]], ["--timeout", "0"])
assert.equal(nullZeit.exit, 2)
assert.match(nullZeit.aus, /^Aufruf:/m)

// 9b. Signal-Handler mit Attrappen (läuft auch unter win32): Reihenfolge, Exit 130, feste Signalliste.
const spur = []
const abh = {
  kinder: new Set([{ pid: 1 }, { pid: 2 }]),
  beendeBaum: (k) => spur.push(`baum${k.pid}`),
  zuruecksetzen: () => spur.push("zurueck"),
  exit: (code) => spur.push(`exit${code}`),
}
beiSignal(abh)
assert.deepEqual(spur, ["baum1", "baum2", "zurueck", "exit130"])
const angemeldet = new Map()
registriereSignale({ on: (sig, fn) => angemeldet.set(sig, fn) }, abh)
assert.deepEqual([...angemeldet.keys()], ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"])
assert.deepEqual(SIGNALE, ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"])
for (const fn of angemeldet.values()) {
  spur.length = 0
  fn()
  assert.deepEqual(spur, ["baum1", "baum2", "zurueck", "exit130"])
}

// 10. SIGTERM mitten im Mutanten: Exit 130, Dateien bytegleich, keine Sicherungskopie, der Testprozess ist beendet.
// Unter win32 gibt es kein abfangbares SIGTERM (Kind wird hart beendet), dort übersprungen.
if (process.platform === "win32") {
  console.log("mutationslaeufer.test: Signal-Fall übersprungen (win32)")
} else {
  const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms))
  const hang = 'import { readFileSync, writeFileSync } from "node:fs"\nif (readFileSync("a.mjs", "utf8").includes("A = 0")) {\n  writeFileSync("hang.pid", String(process.pid))\n  setInterval(() => {}, 1000)\n}\n'
  writeFileSync(join(ordner, "hang.mjs"), hang)
  writeFileSync(join(ordner, "m-signal.json"), JSON.stringify([mut[9]]))
  const args = [laeufer, join(ordner, "m-signal.json"), "--cwd", ordner, "--timeout", "60", "--test", `${knoten} hang.mjs`]
  const kind = spawn(process.execPath, args, { stdio: "ignore" })
  const ende = new Promise((fertig) => kind.on("close", (code, signal) => fertig({ code, signal })))
  for (let i = 0; i < 100 && !existsSync(join(ordner, "hang.pid")); i++) await warte(100)
  assert.ok(existsSync(join(ordner, "hang.pid")), "Mutant wurde nicht gestartet")
  kind.kill("SIGTERM")
  const erg = await ende
  assert.deepEqual(erg, { code: 130, signal: null })
  unversehrt()
  const pid = Number(readFileSync(join(ordner, "hang.pid"), "utf8"))
  let lebt = true
  for (let i = 0; i < 30 && lebt; i++) {
    try {
      process.kill(pid, 0)
      await warte(100)
    } catch {
      lebt = false
    }
  }
  assert.ok(!lebt, "Testprozess läuft nach dem Signal weiter")
}

rmSync(ordner, { recursive: true, force: true })
console.log("mutationslaeufer.test: ok")
