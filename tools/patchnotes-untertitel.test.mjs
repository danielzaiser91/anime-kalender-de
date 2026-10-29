// Verdrahtung des Untertitel-Wächters: pipeline/check-patchnotes.ts als eigener Prozess gegen einen Wegwerf-Ordner
// (cwd = Ordner mit data/patchnotes). Ohne Git-Historie meldet das Skript nebenbei weitere Zeilen; geprüft wird nur die Untertitel-Zeile.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..")
const loader = pathToFileURL(join(wurzel, "node_modules", "tsx", "dist", "loader.mjs")).href
const skript = join(wurzel, "pipeline", "check-patchnotes.ts")
const ZEILE = "kein Untertitel steht in zwei Einträgen"

function fahre(eintraege) {
  const ordner = mkdtempSync(join(tmpdir(), "patchnotes-untertitel-"))
  try {
    mkdirSync(join(ordner, "data", "patchnotes"), { recursive: true })
    for (const [name, text] of Object.entries(eintraege)) writeFileSync(join(ordner, "data", "patchnotes", `${name}.yaml`), text)
    const r = spawnSync(process.execPath, ["--import", loader, skript], { cwd: ordner, encoding: "utf8", windowsHide: true, timeout: 120_000 })
    assert.notEqual(r.status, null, "Prozess lief nicht bis zum Ende")
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

const eintrag = (text, untertitel) => `kategorie: bugfix\ntext: ${text}\nuntertitel: ${untertitel}\n`

const doppelt = fahre({ a: eintrag("Eins", "Du siehst mehr"), b: eintrag("Zwei", "Du siehst mehr") })
assert.match(doppelt.aus, new RegExp(`✖ Patch-Notes: ${ZEILE}[^\\n]*mehrfach: a, b`), doppelt.aus)
assert.equal(doppelt.status, 1, doppelt.aus)

const gut = fahre({ a: eintrag("Eins", "Du siehst mehr"), b: eintrag("Zwei", "Du siehst weniger") })
assert.ok(gut.aus.includes(`✓ Patch-Notes: ${ZEILE}`), gut.aus)
assert.ok(!gut.aus.includes(`✖ Patch-Notes: ${ZEILE}`), gut.aus)

console.log("patchnotes-untertitel.test: ok (Doppel -> Meldung und Exit 1, verschiedene Untertitel -> ✓)")
