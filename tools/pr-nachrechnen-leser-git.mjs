/**
 * Git-Anschluss der Leser-Regel (`pr-nachrechnen-leser.mjs`): holt Kopf und main des PR in den Checkout des Aufrufers und liest den
 * Code beider Stände in wenigen Abrufen (`ls-tree`, `cat-file --batch`) in den Speicher; die Regel selbst läuft dann ohne weiteres git.
 * Jeder Fehler wird zum Grund „nicht ermittelbar“, der PR gilt dann als veraltet.
 */
import { execFileSync } from 'node:child_process'
import { LESBAR, bewegtesGelesen, geaenderteSkripte, leserIn } from './pr-nachrechnen-leser.mjs'

export const SUCHORDNER = ['pipeline', 'shared', 'tools', 'web', 'worker', 'extension', '.github']

/** Höchstdauer eines git-Aufrufs (der Abruf geht gegen das Netz); danach wirft der Aufruf und der PR gilt als nicht ermittelbar. */
export const GIT_TIMEOUT_MS = 120000

/** git-Aufruf über `ausfuehren` (execFileSync oder eine Attrappe); mit `roh` kommen die Bytes (Dateiinhalte), sonst Text; `input` geht auf stdin. */
export const gitAufrufMit = (ausfuehren) => (args, { input, roh = false } = {}) =>
  ausfuehren('git', args, { input: input === undefined ? undefined : Buffer.from(input), encoding: roh ? 'buffer' : 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], timeout: GIT_TIMEOUT_MS })

export const gitAufruf = gitAufrufMit(execFileSync)

/**
 * Inhalte der Dateien `pfade` im Stand `ref` als Karte; fehlende Dateien fehlen in der Karte. Antwort von `cat-file --batch`:
 * je Eingabezeile `<oid> blob <Bytes>\n<Inhalt>\n` oder `<Name> missing\n`, in der Reihenfolge der Eingabe.
 */
export function inhalte(git, ref, pfade) {
  if (pfade.length === 0) return new Map()
  const aus = git(['cat-file', '--batch'], { input: pfade.map((p) => `${ref}:${p}\n`).join(''), roh: true })
  const karte = new Map()
  let pos = 0
  for (const pfad of pfade) {
    const ende = aus.indexOf(10, pos)
    const kopf = aus.toString('utf8', pos, ende)
    pos = ende + 1
    if (kopf.endsWith(' missing')) continue
    const groesse = Number(kopf.split(' ')[2])
    karte.set(pfad, aus.toString('utf8', pos, pos + groesse))
    pos += groesse + 1
  }
  return karte
}

/** Lesbare Code-Dateien (Skripte, Workflows) der Ordner im Stand `ref`. */
const codeDateien = (git, ref) => git(['ls-tree', '-r', '--name-only', ref, '--', ...SUCHORDNER]).split(/\r?\n/).filter((p) => LESBAR.test(p))

/** Leser für `botSprungAusnahme`: (bewegt, prDateien, { nummer, kopf, main }) -> null | Grund. */
export const gitLeser = (git) => (bewegt, pr, refs) => {
  try {
    git(['fetch', '-q', 'origin', `refs/pull/${refs.nummer}/head`, refs.main])
    const mainTexte = inhalte(git, refs.main, codeDateien(git, refs.main))
    if (mainTexte.size === 0) return 'Leser nicht ermittelbar (kein Code auf main gelesen)'
    const kopfTexte = inhalte(git, refs.kopf, pr.filter((p) => LESBAR.test(p)))
    const lies = (pfad) => kopfTexte.get(pfad) ?? mainTexte.get(pfad) ?? null
    const paket = (ref) => inhalte(git, ref, ['package.json']).get('package.json') ?? null
    const paketSkripte = pr.includes('package.json') ? geaenderteSkripte(paket(refs.main), paket(refs.kopf)) : null
    return bewegtesGelesen({ bewegt, pr, leser: leserIn(mainTexte, bewegt), lies, liesMain: (pfad) => mainTexte.get(pfad) ?? null, paketSkripte })
  } catch (e) {
    return `Leser nicht ermittelbar (${String(e.message).split('\n')[0].slice(0, 120)})`
  }
}
