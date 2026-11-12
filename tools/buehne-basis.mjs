#!/usr/bin/env node
/**
 * `check:buehne-basis`: Misst zuerst die Vorher-Zellen der Bühne auf der Basis (`HEAD^1`, im PR-Merge-Ref main) und dann
 * den Kopf gegen diese Messung (`buehne-messen.mjs --basis`). So fällt ein Kontrast- oder Tippziel-Befund auf, den ein PR über
 * `web/src` in die echte App bringt, auch wenn kein Mockup ihn zeigt (PR-Basis statt nur Vorher-gegen-Nachher).
 *
 * Die Basis wird in einem Wegwerf-Ordner aus `git archive` gebaut; Messwerkzeug und Fälle bleiben die des Kopfs (nur `BUEHNE_DIST`
 * zeigt auf die Bühne der Basis). Ändert der PR `web/buehne` (Mockups, Fälle), kommt dieses Verzeichnis vom Kopf in die Basis, damit
 * die Vorher-Zellen beider Seiten dieselben Fälle zeigen und nur die App sie unterscheidet.
 * Ist die Basis nicht baubar, nicht vollständig messbar oder überschreitet sie ihr Zeitbudget, gibt es eine Warnung (Log,
 * `::warning::`, Job-Zusammenfassung) und der Lauf endet grün — „Bühne-Messen“ misst Vorher-gegen-Nachher ohnehin voll.
 *
 * Aufruf: node tools/buehne-basis.mjs [--ref <Commit>] [--mockup <Namensteil>]   (nach `npm run buehne:bauen`; Exit-Code = der des Kopf-Laufs)
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { warne } from './buehne-basis-warnung.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
/** Was die Bühne zum Bauen braucht (Konfiguration, Quelle, Bühne, Pakete). */
export const BAU_PFADE = ['web', 'shared', 'public/anbieter', 'vite.buehne.config.ts', 'package.json', 'tsconfig.json']
/**
 * Fristen in ms. CI-Messung 12.11.2026 (Lauf 43250375249): Basis-Messung 7 min 07 s, Kopf-Lauf 7 min 06 s, Einrichtung 2 min;
 * je 10 min geben 40 % Reserve, der Job bekommt dafür 25 statt 20 min (`frist` im Matrixeintrag).
 */
export const BASIS_BUDGET_MS = 10 * 60_000
export const KOPF_FRIST_MS = 10 * 60_000

/** Führt einen Befehl mit Frist aus; `{ status }` (null bei Frist/Start-Fehler). */
export function fuehreAus(befehl, args, optionen = {}) {
  const r = spawnSync(befehl, args, { stdio: 'inherit', timeout: 15 * 60_000, windowsHide: true, ...optionen })
  return { status: r.status }
}

/** Legt `web/buehne` des Kopfs über die Basis, wenn der PR es ändert; `{ status }` des ersten gescheiterten Befehls. */
function kopfBuehneDrueber({ ref, wurzel, ordner, baum, fuehre }) {
  const unterschied = fuehre('git', ['-C', wurzel, 'diff', '--quiet', ref, 'HEAD', '--', 'web/buehne'])
  if (unterschied.status !== 1) return unterschied
  const tar = path.join(ordner, 'kopf-buehne.tar')
  const archiv = fuehre('git', ['-C', wurzel, 'archive', '--format=tar', '-o', tar, 'HEAD', 'web/buehne'])
  if (archiv.status !== 0) return archiv
  rmSync(path.join(baum, 'web', 'buehne'), { recursive: true, force: true })
  return fuehre('tar', ['-xf', path.relative(baum, tar)], { cwd: baum })
}

/** Baut die Bühne von `ref` in `ordner` und misst deren Vorher-Zellen nach `ziel`; gibt `null` oder den Grund des Scheiterns zurück. */
function messeBasis({ ref, ordner, ziel, wurzel, fuehre, nurMockup, uhr }) {
  const tar = path.join(ordner, 'basis.tar')
  const baum = path.join(ordner, 'baum')
  const start = uhr()
  const rest = () => BASIS_BUDGET_MS - (uhr() - start)
  const schritte = [
    ['Archiv', () => fuehre('git', ['-C', wurzel, 'archive', '--format=tar', '-o', tar, ref, ...BAU_PFADE])],
    /* Relativer Pfad: GNU tar (Git Bash) hielte „C:/…“ für einen Rechnernamen. */
    ['Entpacken', () => fuehre('tar', ['-xf', path.relative(baum, tar)], { cwd: baum })],
    ['Bühne des Kopfs', () => kopfBuehneDrueber({ ref, wurzel, ordner, baum, fuehre })],
    ['Bau', () => fuehre(process.execPath, [path.join(wurzel, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.buehne.config.ts'], { cwd: baum, timeout: rest() })],
    ['Messung', () => fuehre(process.execPath, [path.join(wurzel, 'tools/buehne-messen.mjs'), '--schreibe', ziel, ...nurMockup], { cwd: wurzel, timeout: rest(), env: { ...process.env, BUEHNE_DIST: path.join(baum, 'buehne-dist') } })],
  ]
  for (const [name, schritt] of schritte) {
    if (rest() <= 0) return `Zeitbudget von ${BASIS_BUDGET_MS / 60_000} min vor „${name}“ aufgebraucht`
    if (name === 'Entpacken') mkdirSync(baum)
    if (name === 'Bau') symlinkSync(path.join(wurzel, 'node_modules'), path.join(baum, 'node_modules'), 'junction')
    const { status } = schritt()
    if (status !== 0) return rest() <= 0 ? `Zeitbudget von ${BASIS_BUDGET_MS / 60_000} min in „${name}“ überschritten` : `${name} (Exit ${status})`
  }
  return null
}

/** Der ganze Lauf; `fuehre` und `uhr` austauschbar (Test mit Attrappe). Gibt den Exit-Code zurück; ohne Basis nur Warnung und 0. */
export function lauf({ ref = 'HEAD^1', wurzel = WURZEL, fuehre = fuehreAus, ausgabe = console.log, mockup = '', uhr = Date.now, zusammenfassung } = {}) {
  const nurMockup = mockup ? ['--mockup', mockup] : []
  const ordner = mkdtempSync(path.join(tmpdir(), 'buehne-basis-'))
  const ziel = path.join(ordner, 'basis.json')
  try {
    const grund = messeBasis({ ref, ordner, ziel, wurzel, fuehre, nurMockup, uhr })
    if (grund) {
      warne(`${ref} nicht messbar: ${grund} — kein Vergleich gegen main in diesem Lauf`, ausgabe, zusammenfassung)
      return 0
    }
    const kopf = fuehre(process.execPath, [path.join(wurzel, 'tools/buehne-messen.mjs'), '--basis', ziel, '--nur-vorher', ...nurMockup], { cwd: wurzel, timeout: KOPF_FRIST_MS })
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
