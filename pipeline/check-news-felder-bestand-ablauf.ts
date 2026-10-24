/**
 * Zusicherungen: Der Bestandswächter `check-news-felder-bestand.ts` als eigener Prozess gegen ein Wegwerf-Repo (AK_ROOT, GIT_EXE):
 * Exit-Code und Ausgabe für Gleichstand, Wechsel, Vorstand ohne Datei, unbekannten Stand, kaputten Inhalt. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const meldung = (extra: Record<string, unknown> = {}) => ({ art: 'angekuendigt', platform: 'netflix', release: 'r-1', datum: '2099-01-01', hinweis: 'H1', kanal: 'Aniverse', ...extra })
const stand = (...meldungen: unknown[]) => JSON.stringify([{ am: '2026-10-01', titelId: 1, titel: 'T', slug: 't', meldungen }])

const wurzel = mkdtempSync(join(tmpdir(), 'news-felder-bestand-'))
try {
  const git = (...a: string[]): void => {
    const r = spawnSync(process.env.GIT_EXE ?? 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: wurzel, windowsHide: true, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`)
  }
  const datei = join(wurzel, 'public', 'data', 'news.json')
  const schreibe = (inhalt: string): void => writeFileSync(datei, inhalt)
  const lauf = (...args: string[]): { code: number | null; aus: string } => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'pipeline/check-news-felder-bestand.ts', ...args], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true })
    return { code: r.status, aus: `${r.stdout}${r.stderr}` }
  }
  git('init', '-q')
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })

  /* Vor dem ersten Stand der Datei: kein Vorstand mit news.json. */
  writeFileSync(join(wurzel, 'leer.txt'), 'x')
  git('add', '.')
  git('commit', '-q', '-m', 'leer')
  schreibe(stand(meldung()))
  const ohne = lauf()
  pruefe('Vorstand ohne news.json: grün, benennt es', ohne.code === 0 && /ohne news\.json/.test(ohne.aus), ohne)

  schreibe(stand(meldung()))
  git('add', '.')
  git('commit', '-q', '-m', 'eins')
  const gleich = lauf()
  pruefe('Gleichstand: grün, Ergebniszeile mit Zahlen', gleich.code === 0 && /check-news-felder-bestand: 1 Einträge gegen 1 des Vorstands HEAD, 0 geänderte Felder/.test(gleich.aus), gleich)

  schreibe(stand(meldung({ hinweis: 'H2' })))
  const wechsel = lauf()
  pruefe('Hinweis gewechselt: rot, nennt Feld, alt und neu', wechsel.code === 1 && /FEHLER: .*hinweis: "H1" -> "H2"/.test(wechsel.aus) && /1 geänderte Felder/.test(wechsel.aus), wechsel)

  schreibe(stand(meldung({ kanal: undefined })))
  pruefe('Feld weggefallen: rot', lauf().code === 1)

  schreibe(stand(meldung({ ersetzt: { datum: '2099-02-01', release: 'r-1' } }), meldung({ release: 'r-2' })))
  const lebenslauf = lauf()
  pruefe('Lebenslauf (ersetzt) und neue Meldung ändern kein eingefrorenes Feld: grün', lebenslauf.code === 0, lebenslauf)

  schreibe(stand(meldung({ hinweis: 'H2' })))
  git('add', '.')
  git('commit', '-q', '-m', 'zwei')
  pruefe('Nach dem Einchecken ist der Vorstand der neue Stand: grün', lauf().code === 0)
  const vorVorstand = lauf('--vorstand', 'HEAD^1')
  pruefe('--vorstand HEAD^1 sieht den Wechsel des letzten Commits: rot', vorVorstand.code === 1 && /hinweis/.test(vorVorstand.aus), vorVorstand)

  const unbekannt = lauf('--vorstand', 'gibt-es-nicht')
  pruefe('Unbekannter Vorstand: rot (Nichtauskunft ist kein Gleichstand)', unbekannt.code === 1 && /nicht lesbar/.test(unbekannt.aus), unbekannt)
  pruefe('--vorstand ohne Wert: rot', lauf('--vorstand').code === 1)

  writeFileSync(join(wurzel, 'x'), '')
  schreibe('{kaputt')
  git('add', '.')
  git('commit', '-q', '-m', 'kaputt')
  const kaputt = lauf()
  pruefe('Vorstand mit kaputtem JSON: rot', kaputt.code === 1 && /nicht lesbar/.test(kaputt.aus), kaputt)

  rmSync(datei)
  pruefe('Arbeitsstand fehlt, Vorstand kaputt: rot', lauf().code === 1)
  schreibe(stand(meldung()))
  pruefe('Arbeitsstand lesbar, Vorstand kaputt: weiter rot', lauf().code === 1)
  const gegenAlt = lauf('--vorstand', 'HEAD~1')
  pruefe('Gegen den lesbaren Vorgänger (hinweis H2) ist der Arbeitsstand (H1) rot', gegenAlt.code === 1 && /hinweis: "H2" -> "H1"/.test(gegenAlt.aus), gegenAlt)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(`check-news-felder-bestand-ablauf: ${faelle} Zusicherungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
