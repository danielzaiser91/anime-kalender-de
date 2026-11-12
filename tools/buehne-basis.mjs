#!/usr/bin/env node
/**
 * `check:buehne-messen` mit Basis: Misst zuerst die Vorher-Zellen der Bühne auf der Basis (`HEAD^1`, im PR-Merge-Ref main) und dann
 * den Kopf gegen diese Messung (`buehne-messen.mjs --basis`). So fällt ein Kontrast- oder Tippziel-Befund auf, den ein PR über
 * `web/src` in die echte App bringt, auch wenn kein Mockup ihn zeigt (PR-Basis statt nur Vorher-gegen-Nachher).
 *
 * Die Basis wird in einem Wegwerf-Ordner aus `git archive` gebaut; Messwerkzeug und Fälle bleiben die des Kopfs (nur `BUEHNE_DIST`
 * zeigt auf die Bühne der Basis). Ist die Basis nicht baubar oder nicht vollständig messbar, läuft der Kopf wie bisher ohne sie
 * und das Log nennt es („⚠ WARNUNG“) — nie still grün und nie rot wegen der Basis.
 *
 * Aufruf: node tools/buehne-basis.mjs [--ref <Commit>] [--mockup <Namensteil>]   (nach `npm run buehne:bauen`; Exit-Code = der des Kopf-Laufs)
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const WURZEL = path.resolve(import.meta.dirname, '..')
/** Was die Bühne zum Bauen braucht (Konfiguration, Quelle, Bühne, Pakete). */
const BAU_PFADE = ['web', 'shared', 'vite.buehne.config.ts', 'package.json', 'tsconfig.json']

/** Führt einen Befehl mit Frist aus; `{ status }` (null bei Frist/Start-Fehler). */
export function fuehreAus(befehl, args, optionen = {}) {
  const r = spawnSync(befehl, args, { stdio: 'inherit', timeout: 15 * 60_000, windowsHide: true, ...optionen })
  return { status: r.status }
}

/** Baut die Bühne von `ref` in `ordner` und misst deren Vorher-Zellen nach `ziel`; gibt `null` oder den Grund des Scheiterns zurück. */
function messeBasis({ ref, ordner, ziel, wurzel, fuehre, nurMockup }) {
  const tar = path.join(ordner, 'basis.tar')
  const baum = path.join(ordner, 'baum')
  const schritte = [
    ['Archiv', () => fuehre('git', ['-C', wurzel, 'archive', '--format=tar', '-o', tar, ref, ...BAU_PFADE])],
    /* Relativer Pfad: GNU tar (Git Bash) hielte „C:/…“ für einen Rechnernamen. */
    ['Entpacken', () => fuehre('tar', ['-xf', path.relative(baum, tar)], { cwd: baum })],
    ['Bau', () => fuehre(process.execPath, [path.join(wurzel, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.buehne.config.ts'], { cwd: baum })],
    ['Messung', () => fuehre(process.execPath, [path.join(wurzel, 'tools/buehne-messen.mjs'), '--schreibe', ziel, ...nurMockup], { cwd: wurzel, env: { ...process.env, BUEHNE_DIST: path.join(baum, 'buehne-dist') } })],
  ]
  for (const [name, schritt] of schritte) {
    if (name === 'Entpacken') mkdirSync(baum)
    if (name === 'Bau') symlinkSync(path.join(wurzel, 'node_modules'), path.join(baum, 'node_modules'), 'junction')
    const { status } = schritt()
    if (status !== 0) return `${name} (Exit ${status})`
  }
  return null
}

/** Der ganze Lauf; `fuehre` austauschbar (Test mit Attrappe). Gibt den Exit-Code des Kopf-Laufs zurück. */
export function lauf({ ref = 'HEAD^1', wurzel = WURZEL, fuehre = fuehreAus, ausgabe = console.log, mockup = '' } = {}) {
  const nurMockup = mockup ? ['--mockup', mockup] : []
  const ordner = mkdtempSync(path.join(tmpdir(), 'buehne-basis-'))
  const ziel = path.join(ordner, 'basis.json')
  try {
    const grund = messeBasis({ ref, ordner, ziel, wurzel, fuehre, nurMockup })
    if (grund) ausgabe(`⚠ WARNUNG Bühne-Basis ${ref} nicht messbar: ${grund} — Kopf läuft ohne Basis`)
    const kopf = fuehre(process.execPath, [path.join(wurzel, 'tools/buehne-messen.mjs'), ...(grund ? [] : ['--basis', ziel, '--nur-vorher', ...nurMockup])], { cwd: wurzel })
    return kopf.status ?? 1
  } finally {
    const modul = path.join(ordner, 'baum', 'node_modules')
    /* Erst die Verknüpfung lösen: ein rekursives Löschen darf nie in das echte node_modules laufen. */
    try {
      unlinkSync(modul)
    } catch {}
    rmSync(ordner, { recursive: true, force: true })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--ref')
  const m = process.argv.indexOf('--mockup')
  process.exitCode = lauf({ ref: i > 0 ? process.argv[i + 1] : 'HEAD^1', mockup: m > 0 ? process.argv[m + 1] : '' })
}
