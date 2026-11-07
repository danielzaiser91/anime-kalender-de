/**
 * Nacht-Merger (F99, Daniel 01.11.2026: „solang es nicht auf meinem PC läuft“): mergt offene PRs, die alle Kandidaten-Regeln
 * aus `nacht-merger-wahl.mjs` erfüllen und deren Kette `pr-nachrechnen` als aktuell bestätigt. Läuft als GitHub-Workflow
 * (`.github/workflows/nacht-merger.yml`, vom Cloudflare-Wecker stündlich per workflow_dispatch gestartet), nie auf Daniels Rechner.
 *
 *   node tools/nacht-merger.mjs [--trocken] [--hoechstens N]      (GH_TOKEN und GITHUB_REPOSITORY aus der Umgebung)
 *
 * Riegel: höchstens N Merges je Lauf (Vorgabe 3); jeder Merge und jede Abweisung steht mit Grund im Protokoll. Nach einem Merge
 * rechnet `pr-nachrechnen` für jeden weiteren Kandidaten neu: die Kette der übrigen rechnete gegen den alten main, sie wird neu gestartet
 * (Exit 1) und der PR kommt im nächsten Lauf dran. Kein `--admin`. Im Trockenlauf wird nichts geschlossen, geöffnet oder gemergt.
 * Exit 0 sonst, 1 wenn ein Merge scheiterte, 2 bei Aufruffehlern.
 */
import { pathToFileURL } from 'node:url'
import { kandidat, reihenfolge, vorabGrund } from './nacht-merger-wahl.mjs'

export const HOECHSTENS_VORGABE = 3

/**
 * Ein Lauf. `welt` bringt alle Seiteneffekte mit (im Test eine Attrappe):
 *   offene() -> PRs der Liste; details(pr) -> pr + { kopf, stufe, pfade, checks, kommentare }; kopfVon(n); nachrechnen(n) -> { exit, text };
 *   bauCommittet(); bestandRot(); merge(pr); zeile(text).
 * Rückgabe { gemergt: [Nummern], fehler: Zahl }.
 */
export function lauf(welt, { hoechstens = HOECHSTENS_VORGABE, trocken = false } = {}) {
  const abgewiesen = (pr, grund) => welt.zeile(`ÜBERSPRUNGEN #${pr.nummer}: ${grund}`)
  const kandidaten = []
  for (const pr of welt.offene()) {
    const vorab = vorabGrund(pr)
    if (vorab !== null) {
      abgewiesen(pr, vorab)
      continue
    }
    const voll = welt.details(pr)
    const urteil = kandidat(voll)
    if (urteil.kandidat) kandidaten.push({ ...voll, grund: urteil.grund })
    else abgewiesen(pr, urteil.grund)
  }
  const gemergt = []
  let fehler = 0
  for (const pr of reihenfolge(kandidaten, welt.bestandRot())) {
    if (gemergt.length >= hoechstens) {
      abgewiesen(pr, `Riegel: höchstens ${hoechstens} Merges je Lauf, kommt im nächsten Lauf dran`)
      continue
    }
    const kopf = welt.kopfVon(pr.nummer)
    if (kopf !== pr.kopf) {
      abgewiesen(pr, `Kopf hat sich geändert (${pr.kopf.slice(0, 9)} -> ${kopf.slice(0, 9)}), nächster Lauf`)
      continue
    }
    const r = welt.nachrechnen(pr.nummer)
    if (r.exit !== 0) {
      abgewiesen(pr, `Kette nicht als aktuell bestätigt (nachrechnen Exit ${r.exit}): ${r.text}`)
      continue
    }
    if (welt.bauCommittet()) {
      abgewiesen(pr, 'Bestandsbau committet gerade, ein Merge erzwänge einen zweiten Bau')
      continue
    }
    if (trocken) {
      gemergt.push(pr.nummer)
      welt.zeile(`WÜRDE MERGEN #${pr.nummer}: ${pr.grund} (Trockenlauf)`)
      continue
    }
    try {
      welt.merge(pr)
    } catch (e) {
      fehler += 1
      welt.zeile(`MERGE FEHLGESCHLAGEN #${pr.nummer}: ${String(e.message).split('\n')[0]}`)
      break
    }
    gemergt.push(pr.nummer)
    welt.zeile(`GEMERGT #${pr.nummer}: ${pr.grund}`)
  }
  welt.zeile(`Nacht-Merger: ${gemergt.length} ${trocken ? 'wären gemergt' : 'gemergt'}, ${fehler} Fehler, ${kandidaten.length} Kandidaten`)
  return { gemergt, fehler }
}

/** Argumente: `--trocken`, `--hoechstens N`; sonst null (Aufruffehler). */
export function argumente(argv) {
  const opt = { trocken: false, hoechstens: HOECHSTENS_VORGABE }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--trocken') opt.trocken = true
    else if (argv[i] === '--hoechstens' && /^[1-9]\d?$/.test(argv[i + 1] ?? '')) opt.hoechstens = Number(argv[++i])
    else return null
  }
  return opt
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opt = argumente(process.argv.slice(2))
  if (opt === null) {
    console.error('Aufruf: node tools/nacht-merger.mjs [--trocken] [--hoechstens N]')
    process.exit(2)
  }
  const { echteWelt } = await import('./nacht-merger-welt.mjs')
  const ergebnis = lauf(echteWelt({ trocken: opt.trocken }), opt)
  process.exit(ergebnis.fehler > 0 ? 1 : 0)
}
