/**
 * **Woher kommt dieser Verweis?** — verfolgt jede Änderung an den Streams eines Titels im Bau.
 *
 * Aufruf: `node tools/streams-verfolgen.mjs <AniList-Id> [Plattform]`
 *
 * Legt eine instrumentierte Kopie von `pipeline/build.ts` an, lässt sie laufen und löscht sie
 * wieder. Jede Zuweisung, jedes `push` und jeder direkt gesetzte Platz in `title.streams` wird
 * mit Aufrufstelle und den Adressen danach ausgegeben. Der Bau schreibt dabei, was er immer
 * schreibt — die Erzeugnisse werden danach per `git checkout` zurückgesetzt.
 *
 * Anlass (21.09.2026): Ein Handbeleg trug B0CG7KDCTS bei Golden Wind mit `available: false` aus,
 * und `check:handbelege` fand den Weg trotzdem im Datensatz. Drei Vermutungen über die Ursache
 * waren falsch; das Protokoll zeigte beim ersten Lauf, dass eine Prime-Suche erst nach dem
 * Belegfilter in diese Adresse umgesetzt wurde. Dieselbe Frage hatte der Bau schon am 26.08.
 * und am 17.09.2026 gestellt.
 *
 * Mit altem `data/cache/` bricht der Bau am Ende ab („Titel würden aus dem Datensatz fallen") —
 * für das Protokoll spielt das keine Rolle, es entsteht vorher.
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawnSync, execSync } from 'node:child_process'

const id = Number(process.argv[2])
const plattform = process.argv[3] ?? ''
if (!id) {
  console.error('Aufruf: node tools/streams-verfolgen.mjs <AniList-Id> [Plattform]')
  process.exit(1)
}

/*
  Danach wird zurückgesetzt, was der Bau geschrieben hat — das darf keine eigene, noch nicht
  committete Arbeit treffen. Liegt dort etwas, bricht das Werkzeug ab, bevor es anfängt.
*/
const BAU_PFADE = 'public/data data daniel-zum-abarbeiten'
if (execSync(`git status --porcelain -- ${BAU_PFADE}`, { encoding: 'utf8' }).trim()) {
  console.error(`In ${BAU_PFADE} liegen uncommittete Änderungen — erst committen oder sichern.`)
  process.exit(1)
}
const meldungenVorher = existsSync('data/meldungen-an-claude.jsonl')

const QUELLE = 'pipeline/build.ts'
const KOPIE = 'pipeline/_build-verfolgt.ts'
const anker = '  const titles = new Map<number, Title>()\n'
const bau = readFileSync(QUELLE, 'utf8')
if (!bau.includes(anker)) {
  console.error(`Anker nicht gefunden in ${QUELLE} — die Titelkarte heißt nicht mehr so.`)
  process.exit(1)
}

const einschub = `
  {
    const ZIEL = ${id}
    const NUR = ${JSON.stringify(plattform)}
    const kurz = (a: any[]) =>
      (a ?? [])
        .filter((s) => !NUR || s?.platform === NUR)
        .map((s) => \`\${s?.platform}:\${String(s?.url ?? '').replace(/^https?:\\/\\/(www\\.)?/, '').slice(0, 60)}\`)
        .join('  ')
    const zeig = (was: string, a: any[]) => {
      const stelle = (new Error().stack ?? '').split('\\n').slice(3, 4).map((z) => z.trim().replace(/.*_build-verfolgt\\.ts:/, 'Zeile ')).join('')
      console.log(\`[verfolgt] \${was.padEnd(12)} \${stelle.padEnd(16)} \${kurz(a)}\`)
    }
    const hülle = (a: any[]) =>
      new Proxy(a, {
        set(o: any, k, v) { o[k] = v; if (k !== 'length') zeig('Platz ' + String(k), o); return true },
        get(o: any, k) {
          if (k === 'push' || k === 'splice' || k === 'unshift')
            return (...args: unknown[]) => { const r = o[k](...args); zeig(String(k), o); return r }
          return o[k]
        },
      })
    const setzen = titles.set.bind(titles)
    titles.set = (k: number, v: Title) => {
      if (k === ZIEL) {
        let innen = hülle(v.streams ?? [])
        Object.defineProperty(v, 'streams', {
          get: () => innen,
          set: (neu) => { innen = hülle(neu); zeig('zugewiesen', neu) },
          enumerable: true, configurable: true,
        })
        zeig('angelegt', innen)
      }
      return setzen(k, v)
    }
  }
`
// Zeilennummern der Kopie verschieben sich um den Einschub — umgerechnet wird für die Ausgabe.
const versatz = einschub.split('\n').length - 1
writeFileSync(KOPIE, bau.replace(anker, anker + einschub))
try {
  const lauf = spawnSync('npx', ['tsx', KOPIE], { encoding: 'utf8', shell: true, maxBuffer: 256 * 1024 * 1024 })
  const zeilen = `${lauf.stdout}\n${lauf.stderr}`.split('\n').filter((z) => z.startsWith('[verfolgt]'))
  const ankerZeile = bau.slice(0, bau.indexOf(anker)).split('\n').length
  for (const z of zeilen)
    console.log(z.replace(/Zeile (\d+):\d+\)?/, (_, n) => `build.ts:${Number(n) > ankerZeile ? Number(n) - versatz : n}`))
  if (!zeilen.length) console.log(`Keine Änderungen an Titel ${id} gesehen — steht er im Bau überhaupt?`)
} finally {
  rmSync(KOPIE, { force: true })
  /* Der Bau schreibt seine Erzeugnisse; die gehören nicht zu dieser Messung. */
  execSync(`git checkout -- ${BAU_PFADE}`, { stdio: 'ignore' })
  if (!meldungenVorher) rmSync('data/meldungen-an-claude.jsonl', { force: true })
}
