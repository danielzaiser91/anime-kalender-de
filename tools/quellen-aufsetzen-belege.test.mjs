/**
 * `quellen_aufsetzen` mit `data/dub-confirmed.yaml`: Der eigene Beleg des Laufs überlebt das Aufsetzen auf einen bewegten Fernstand,
 * und ein gescheitertes `dub-belege-vereinen` bricht laut ab (Prüfer 1578, A1: `|| true` ließ den Beleg still verloren gehen).
 * Mit js-yaml im Wegwerf-Repo muss es gelingen, ohne laut scheitern.
 * Aufruf: node tools/quellen-aufsetzen-belege.test.mjs
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const git = 'git -c user.name=t -c user.email=t@t'
const bash = (cwd, befehl) => spawnSync('bash', ['-c', befehl], { cwd, encoding: 'utf8', windowsHide: true })
const beleg = (id) => `- anilistId: ${id}\n  dub: true\n  checkedAt: '2026-10-0${id}'\n`

/** Lauf mit Beleg 1 (Start) und 3 (eigen), Fernstand bekommt Beleg 2; liefert Rückgabewert, Fehlerausgabe und Kennungen. */
function szenario(mitYaml) {
  const dir = mkdtempSync(join(tmpdir(), 'aufsetzen-belege-'))
  try {
    const sh = (cwd, befehl) => {
      const r = bash(cwd, befehl)
      if (r.status !== 0) throw new Error(`${befehl}\n${r.stdout}\n${r.stderr}`)
    }
    sh(dir, 'git init -q --bare -b main o.git && git clone -q o.git lauf 2>/dev/null && git clone -q o.git anderer 2>/dev/null')
    mkdirSync(join(dir, 'lauf/tools'), { recursive: true })
    mkdirSync(join(dir, 'lauf/data'), { recursive: true })
    for (const datei of ['quellen-liste.sh', 'quellen-aufsetzen.sh', 'health-vereinen.mjs', 'dub-belege-vereinen.mjs'])
      copyFileSync(join(wurzel, 'tools', datei), join(dir, 'lauf/tools', datei))
    if (mitYaml) cpSync(join(wurzel, 'node_modules/js-yaml'), join(dir, 'lauf/node_modules/js-yaml'), { recursive: true })
    writeFileSync(join(dir, 'lauf/data/dub-confirmed.yaml'), '# Kopf\n\n' + beleg(1))
    sh(join(dir, 'lauf'), `git add -A && ${git} commit -q -m start && git push -q origin HEAD:main`)
    sh(join(dir, 'anderer'), 'git pull -q origin main')
    writeFileSync(join(dir, 'anderer/data/dub-confirmed.yaml'), '# Kopf\n\n' + beleg(1) + '\n' + beleg(2))
    sh(join(dir, 'anderer'), `git add -A && ${git} commit -q -m anderer && git push -q origin HEAD:main`)
    writeFileSync(join(dir, 'lauf/data/dub-confirmed.yaml'), '# Kopf\n\n' + beleg(1) + '\n' + beleg(3))
    sh(join(dir, 'lauf'), 'git fetch -q origin main')
    const r = bash(join(dir, 'lauf'), 'source tools/quellen-liste.sh; source tools/quellen-aufsetzen.sh; quellen_aufsetzen origin/main; echo "rc=$?"')
    const text = readFileSync(join(dir, 'lauf/data/dub-confirmed.yaml'), 'utf8')
    return { rc: /rc=(\d+)/.exec(r.stdout)?.[1], stderr: r.stderr, ids: [...text.matchAll(/anilistId: (\d+)/g)].map((m) => m[1]).join(',') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const mit = szenario(true)
pruefe('mit node_modules: Aufsetzen gelingt', mit.rc === '0', mit)
pruefe('mit node_modules: Fernstand-Beleg und eigener Beleg stehen beide da', mit.ids === '1,2,3', mit.ids)

const ohne = szenario(false)
pruefe('ohne node_modules: Aufsetzen bricht ab (Rückgabewert ungleich 0)', ohne.rc !== undefined && ohne.rc !== '0', ohne)
pruefe('ohne node_modules: die Fehlermeldung nennt dub-belege-vereinen', /dub-belege-vereinen/.test(ohne.stderr), ohne.stderr)

if (fehler.length) {
  console.error(`${fehler.length} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('quellen-aufsetzen-belege: alle Prüfungen bestanden')
